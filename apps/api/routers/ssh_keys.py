from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from database import UserSshKey
from deps import CurrentUser, DbSession
from services.aws_secrets_manager import SecretsManagerError, create_private_key_secret
from services.prime_intellect import PrimeIntellectAPIError, upload_prime_ssh_key


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
