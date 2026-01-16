import os
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class SecretsManagerError(Exception):
    """Raised when AWS Secrets Manager operations fail."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _get_client():
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
    if not region:
        raise SecretsManagerError("AWS region not configured")
    return boto3.client("secretsmanager", region_name=region)


def create_private_key_secret(
    *, clerk_user_id: str, private_key: str, secret_name: Optional[str] = None
) -> str:
    client = _get_client()
    name = secret_name or f"rlx/user-ssh-key/{clerk_user_id}"
    try:
        response = client.create_secret(Name=name, SecretString=private_key)
    except ClientError as exc:
        raise SecretsManagerError(
            exc.response.get("Error", {}).get("Message", str(exc))
        )
    except BotoCoreError as exc:
        raise SecretsManagerError(str(exc))

    arn = response.get("ARN")
    if not arn:
        raise SecretsManagerError("AWS Secrets Manager did not return ARN")
    return arn
