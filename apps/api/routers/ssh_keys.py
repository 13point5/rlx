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
)


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

    existing = await db.execute(select(UserSshKey).where(UserSshKey.clerk_user_id == clerk_user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="SSH key already configured"
        )

    try:
        secret_arn = create_private_key_secret(
            clerk_user_id=clerk_user_id, private_key=body.private_key
        )
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    try:
        prime_key = await upload_prime_ssh_key(body.public_key)
    except PrimeIntellectAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    key_id = prime_key.get("id") or prime_key.get("key_id")
    if not key_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Prime Intellect did not return SSH key id",
        )

    ssh_key = UserSshKey(
        clerk_user_id=clerk_user_id,
        public_key=body.public_key,
        prime_ssh_key_id=key_id,
        aws_secret_arn=secret_arn,
        created_at=datetime.now(timezone.utc),
    )
    db.add(ssh_key)
    await db.commit()
    await db.refresh(ssh_key)

    return ssh_key
