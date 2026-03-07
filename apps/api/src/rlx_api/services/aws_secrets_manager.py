import logging
import os
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


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


def get_secret_arn_by_name(secret_name: str) -> Optional[str]:
    """Get the ARN of a secret by name if it exists."""
    client = _get_client()
    try:
        response = client.describe_secret(SecretId=secret_name)
        return response.get("ARN")
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code == "ResourceNotFoundException":
            return None
        raise SecretsManagerError(
            exc.response.get("Error", {}).get("Message", str(exc))
        )
    except BotoCoreError as exc:
        raise SecretsManagerError(str(exc))


def create_private_key_secret(
    *, clerk_user_id: str, private_key: str, secret_name: Optional[str] = None
) -> str:
    """Create a secret in AWS Secrets Manager. Secret name must be unique."""
    client = _get_client()
    name = secret_name or f"rlx/user-ssh-key/{clerk_user_id}"

    try:
        logger.info(f"Creating secret {name}")
        response = client.create_secret(Name=name, SecretString=private_key)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        error_message = exc.response.get("Error", {}).get("Message", str(exc))
        logger.error(
            f"AWS Secrets Manager error: code={error_code}, message={error_message}"
        )
        raise SecretsManagerError(error_message)
    except BotoCoreError as exc:
        logger.error(f"AWS BotoCore error: {exc}")
        raise SecretsManagerError(str(exc))

    arn = response.get("ARN")
    if not arn:
        raise SecretsManagerError("AWS Secrets Manager did not return ARN")
    logger.info(f"Successfully created secret {name} with ARN {arn}")
    return arn


def wandb_secret_name(clerk_user_id: str) -> str:
    return f"rlx/wandb-api-key/{clerk_user_id}"


def create_wandb_api_key_secret(*, clerk_user_id: str, api_key: str) -> str:
    """Create a W&B API key secret in AWS Secrets Manager."""
    client = _get_client()
    name = wandb_secret_name(clerk_user_id)

    try:
        logger.info(f"Creating secret {name}")
        response = client.create_secret(Name=name, SecretString=api_key)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        error_message = exc.response.get("Error", {}).get("Message", str(exc))
        logger.error(
            f"AWS Secrets Manager error: code={error_code}, message={error_message}"
        )
        raise SecretsManagerError(error_message)
    except BotoCoreError as exc:
        logger.error(f"AWS BotoCore error: {exc}")
        raise SecretsManagerError(str(exc))

    arn = response.get("ARN")
    if not arn:
        raise SecretsManagerError("AWS Secrets Manager did not return ARN")
    logger.info(f"Successfully created secret {name} with ARN {arn}")
    return arn


def get_secret_string(secret_id: str) -> str:
    """Retrieve a string secret from AWS Secrets Manager by ARN or name."""
    client = _get_client()
    try:
        logger.info(f"Retrieving secret {secret_id}")
        response = client.get_secret_value(SecretId=secret_id)
        secret_string = response.get("SecretString")
        if not secret_string:
            raise SecretsManagerError("Secret does not contain a string value")
        return secret_string
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        error_message = exc.response.get("Error", {}).get("Message", str(exc))
        logger.error(
            f"AWS Secrets Manager error: code={error_code}, message={error_message}"
        )
        raise SecretsManagerError(error_message)
    except BotoCoreError as exc:
        logger.error(f"AWS BotoCore error: {exc}")
        raise SecretsManagerError(str(exc))


def get_secret_string_if_exists(secret_id: str) -> Optional[str]:
    """Retrieve a string secret when it exists, otherwise return None."""
    client = _get_client()
    try:
        logger.info(f"Retrieving secret {secret_id}")
        response = client.get_secret_value(SecretId=secret_id)
        secret_string = response.get("SecretString")
        if not secret_string:
            raise SecretsManagerError("Secret does not contain a string value")
        return secret_string
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code == "ResourceNotFoundException":
            return None
        error_message = exc.response.get("Error", {}).get("Message", str(exc))
        logger.error(
            f"AWS Secrets Manager error: code={error_code}, message={error_message}"
        )
        raise SecretsManagerError(error_message)
    except BotoCoreError as exc:
        logger.error(f"AWS BotoCore error: {exc}")
        raise SecretsManagerError(str(exc))


def get_private_key_secret(secret_arn: str) -> str:
    """
    Retrieve a private key from AWS Secrets Manager.

    Args:
        secret_arn: The ARN of the secret to retrieve

    Returns:
        The private key string
    """
    return get_secret_string(secret_arn)


def get_wandb_api_key_secret(clerk_user_id: str) -> Optional[str]:
    """Retrieve the user's W&B API key if it exists."""
    return get_secret_string_if_exists(wandb_secret_name(clerk_user_id))


def delete_private_key_secret(secret_arn: str) -> None:
    """Delete a secret from AWS Secrets Manager."""
    client = _get_client()
    try:
        client.delete_secret(
            SecretId=secret_arn,
            ForceDeleteWithoutRecovery=True,
        )
    except ClientError as exc:
        raise SecretsManagerError(
            exc.response.get("Error", {}).get("Message", str(exc))
        )
    except BotoCoreError as exc:
        raise SecretsManagerError(str(exc))
