import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import UserSshKey
from deps import CurrentUser, DbSession
from services.aws_secrets_manager import (
    SecretsManagerError,
    create_private_key_secret,
    delete_private_key_secret,
)
from services.prime_intellect import (
    PrimeIntellectAPIError,
    upload_prime_ssh_key,
    delete_prime_ssh_key,
    list_prime_ssh_keys,
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/ssh-keys", tags=["ssh-keys"])


class UploadSshKeyRequest(BaseModel):
    public_key: str
    private_key: str


class SshKeyResponse(BaseModel):
    id: int
    public_key: str
    prime_ssh_key_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class SshKeyStatusResponse(BaseModel):
    configured: bool
    public_key: Optional[str] = None
    created_at: Optional[datetime] = None


@router.get("", response_model=SshKeyStatusResponse)
async def get_ssh_key_status(user: CurrentUser, db: DbSession) -> SshKeyStatusResponse:
    """Check if user has a configured SSH key."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id)
    )
    ssh_key = result.scalar_one_or_none()

    if not ssh_key:
        return SshKeyStatusResponse(configured=False)

    return SshKeyStatusResponse(
        configured=True,
        public_key=ssh_key.public_key,
        created_at=ssh_key.created_at,
    )


@router.get("/list-prime-keys", response_model=dict)
async def list_prime_keys(user: CurrentUser) -> dict:
    """List all SSH keys from Prime Intellect (for debugging/cleanup)."""
    try:
        result = await list_prime_ssh_keys()
        keys = result.get("data", [])
        logger.info(f"Found {len(keys)} SSH keys in Prime Intellect")
        return {
            "keys": keys,
            "total_count": result.get("total_count", len(keys)),
        }
    except PrimeIntellectAPIError as exc:
        logger.error(f"Failed to list Prime Intellect keys: {exc.message}")
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.delete("/prime/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prime_key(key_id: str, user: CurrentUser) -> None:
    """Delete an SSH key directly from Prime Intellect (for cleanup)."""
    try:
        await delete_prime_ssh_key(key_id)
        logger.info(f"Deleted SSH key {key_id} from Prime Intellect")
    except PrimeIntellectAPIError as exc:
        logger.error(f"Failed to delete Prime Intellect key {key_id}: {exc.message}")
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ssh_key(user: CurrentUser, db: DbSession) -> None:
    """Delete user's SSH key from database, AWS, and Prime Intellect."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id)
    )
    ssh_key = result.scalar_one_or_none()

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found"
        )

    # Delete from Prime Intellect
    try:
        await delete_prime_ssh_key(ssh_key.prime_ssh_key_id)
    except PrimeIntellectAPIError as exc:
        # If key not found on Prime Intellect, continue with deletion
        if exc.status_code != 404:
            raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # Delete from AWS Secrets Manager
    try:
        delete_private_key_secret(ssh_key.aws_secret_arn)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    # Delete from database
    await db.delete(ssh_key)
    await db.commit()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SshKeyResponse)
async def upload_ssh_key_route(
    body: UploadSshKeyRequest, user: CurrentUser, db: DbSession
) -> SshKeyResponse:
    clerk_user_id = user.get("sub")
    logger.info(f"Uploading SSH key for user {clerk_user_id}")

    existing = await db.execute(select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="SSH key already configured"
        )

    secret_arn = None
    try:
        logger.info(f"Creating AWS secret for user {clerk_user_id}")
        secret_arn = create_private_key_secret(
            clerk_user_id=clerk_user_id, private_key=body.private_key
        )
    except SecretsManagerError as exc:
        logger.error(f"Failed to create AWS secret: {exc.message}")
        raise HTTPException(status_code=500, detail=exc.message)

    prime_key_id = None
    try:
        logger.info(f"Uploading public key to Prime Intellect for user {clerk_user_id}")
        prime_key = await upload_prime_ssh_key(body.public_key)
        prime_key_id = prime_key.get("id") or prime_key.get("key_id")
        if not prime_key_id:
            logger.error(f"Prime Intellect response missing key ID: {prime_key}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Prime Intellect did not return SSH key id",
            )
    except PrimeIntellectAPIError as exc:
        logger.error(f"Failed to upload to Prime Intellect: {exc.status_code} - {exc.message}")
        # Clean up AWS secret if Prime Intellect fails
        if secret_arn:
            try:
                logger.info(f"Cleaning up orphaned AWS secret {secret_arn}")
                delete_private_key_secret(secret_arn)
            except SecretsManagerError as cleanup_exc:
                logger.error(f"Failed to cleanup AWS secret: {cleanup_exc.message}")
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    try:
        ssh_key = UserSshKey(
            clerk_user_id=clerk_user_id,
            public_key=body.public_key,
            prime_ssh_key_id=prime_key_id,
            aws_secret_arn=secret_arn,
            created_at=datetime.now(timezone.utc),
        )
        db.add(ssh_key)
        await db.commit()
        await db.refresh(ssh_key)
        logger.info(f"Successfully created SSH key record for user {clerk_user_id}")
        return ssh_key
    except Exception as exc:
        logger.error(f"Failed to save SSH key to database: {exc}")
        # Clean up both AWS and Prime Intellect if DB save fails
        if secret_arn:
            try:
                delete_private_key_secret(secret_arn)
            except SecretsManagerError:
                pass
        if prime_key_id:
            try:
                await delete_prime_ssh_key(prime_key_id)
            except PrimeIntellectAPIError:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save SSH key: {str(exc)}")
