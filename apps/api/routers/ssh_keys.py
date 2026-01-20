import logging
import os
import time
from datetime import datetime, timezone

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
    set_prime_ssh_key_primary,
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/ssh-keys", tags=["ssh-keys"])


class UploadSshKeyRequest(BaseModel):
    public_key: str
    private_key: str
    name: str | None = None


class SshKeyResponse(BaseModel):
    id: int
    public_key: str
    prime_ssh_key_id: str
    name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SshKeyStatusResponse(BaseModel):
    configured: bool
    keys: list[SshKeyResponse] = []
    aws_region: str | None = None


@router.get("", response_model=SshKeyStatusResponse)
async def get_ssh_key_status(user: CurrentUser, db: DbSession) -> SshKeyStatusResponse:
    """Get all SSH keys for the user."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(UserSshKey)
        .where(UserSshKey.clerk_user_id == clerk_user_id)
        .order_by(UserSshKey.created_at.desc())
    )
    ssh_keys = result.scalars().all()

    # Log secret ARNs for debugging
    for key in ssh_keys:
        logger.info(
            f"User {clerk_user_id} has key {key.id} with AWS secret ARN: {key.aws_secret_arn}"
        )

    aws_region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")

    return SshKeyStatusResponse(
        configured=len(ssh_keys) > 0,
        keys=[SshKeyResponse.model_validate(key) for key in ssh_keys],
        aws_region=aws_region,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ssh_key(key_id: int, user: CurrentUser, db: DbSession) -> None:
    """Delete a specific SSH key by ID from database, AWS, and Prime Intellect."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(UserSshKey).where(UserSshKey.id == key_id, UserSshKey.clerk_user_id == clerk_user_id)
    )
    ssh_key = result.scalar_one_or_none()

    if not ssh_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found")

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

    secret_arn = None
    try:
        # Generate unique secret name with timestamp to avoid conflicts
        secret_name = f"rlx/user-ssh-key/{clerk_user_id}/{int(time.time())}"
        logger.info(f"Creating AWS secret for user {clerk_user_id}")
        secret_arn = create_private_key_secret(
            clerk_user_id=clerk_user_id, private_key=body.private_key, secret_name=secret_name
        )
    except SecretsManagerError as exc:
        logger.error(f"Failed to create AWS secret: {exc.message}")
        raise HTTPException(status_code=500, detail=exc.message)

    prime_key_id = None
    try:
        # Prime Intellect requires a name field, so generate one if user didn't provide
        key_name = body.name or f"rlx-key-{int(time.time())}"
        logger.info(
            f"Uploading public key to Prime Intellect for user {clerk_user_id} with name: {key_name}"
        )
        prime_key = await upload_prime_ssh_key(body.public_key, name=key_name)
        prime_key_id = prime_key.get("id") or prime_key.get("key_id")
        if not prime_key_id:
            logger.error(f"Prime Intellect response missing key ID: {prime_key}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Prime Intellect did not return SSH key id",
            )

        # Try to set the key as primary so it's used by default for new pods
        # This is best-effort - don't fail if it doesn't work
        try:
            logger.info(f"Setting SSH key {prime_key_id} as primary in Prime Intellect")
            await set_prime_ssh_key_primary(prime_key_id)
        except PrimeIntellectAPIError as primary_exc:
            logger.warning(
                f"Failed to set SSH key as primary (non-fatal): {primary_exc.status_code} - {primary_exc.message}"
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
            name=key_name,  # Store the name we sent (either user-provided or auto-generated)
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
