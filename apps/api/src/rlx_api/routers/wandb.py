import os

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from rlx_api.deps import CurrentUser
from rlx_api.services.aws_secrets_manager import (
    SecretsManagerError,
    create_wandb_api_key_secret,
    get_secret_arn_by_name,
    wandb_secret_name,
    delete_private_key_secret,
)

router = APIRouter(prefix="/api/wandb-key", tags=["wandb"])


class WandbApiKeyRequest(BaseModel):
    api_key: str


class WandbKeyStatusResponse(BaseModel):
    configured: bool


class WandbKeyCreateResponse(BaseModel):
    configured: bool


@router.get("", response_model=WandbKeyStatusResponse)
async def get_wandb_key_status(user: CurrentUser) -> WandbKeyStatusResponse:
    clerk_user_id = user.get("sub")
    secret_name = wandb_secret_name(clerk_user_id)
    try:
        secret_arn = get_secret_arn_by_name(secret_name)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    return WandbKeyStatusResponse(
        configured=secret_arn is not None,
    )


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=WandbKeyCreateResponse
)
async def create_wandb_key(
    body: WandbApiKeyRequest, user: CurrentUser
) -> WandbKeyCreateResponse:
    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="API key is required"
        )

    clerk_user_id = user.get("sub")
    secret_name = wandb_secret_name(clerk_user_id)
    try:
        existing_arn = get_secret_arn_by_name(secret_name)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    if existing_arn:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="W&B API key already exists. Delete it first to set a new one.",
        )

    try:
        create_wandb_api_key_secret(clerk_user_id=clerk_user_id, api_key=api_key)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    return WandbKeyCreateResponse(configured=True)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wandb_key(user: CurrentUser) -> None:
    clerk_user_id = user.get("sub")
    secret_name = wandb_secret_name(clerk_user_id)
    try:
        secret_arn = get_secret_arn_by_name(secret_name)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)

    if not secret_arn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="W&B API key not found"
        )

    try:
        delete_private_key_secret(secret_arn)
    except SecretsManagerError as exc:
        raise HTTPException(status_code=500, detail=exc.message)
