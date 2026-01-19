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
    client = _get_client()
    name = secret_name or f"rlx/user-ssh-key/{clerk_user_id}"
    
    # Try to check if secret already exists (orphaned from previous failed attempt)
    # If DescribeSecret permission is not available, we'll handle the "already exists" error during create
    try:
        existing_arn = get_secret_arn_by_name(name)
        if existing_arn:
            logger.warning(f"Secret {name} already exists, deleting orphaned secret")
            try:
                client.delete_secret(
                    SecretId=existing_arn,
                    ForceDeleteWithoutRecovery=True,
                )
                logger.info(f"Deleted orphaned secret {name}")
            except ClientError as exc:
                error_code = exc.response.get("Error", {}).get("Code")
                error_msg = exc.response.get("Error", {}).get("Message", str(exc))
                
                # Handle case where secret is scheduled for deletion - restore it first
                if "scheduled for deletion" in error_msg.lower() or error_code == "InvalidRequestException":
                    logger.info(f"Secret {name} is scheduled for deletion, restoring it first")
                    try:
                        client.restore_secret(SecretId=existing_arn)
                        logger.info(f"Restored secret {name}, now deleting")
                        client.delete_secret(
                            SecretId=existing_arn,
                            ForceDeleteWithoutRecovery=True,
                        )
                        logger.info(f"Deleted restored secret {name}")
                    except ClientError as restore_exc:
                        logger.error(f"Failed to restore/delete secret: {restore_exc}")
                        raise SecretsManagerError(
                            f"Secret is scheduled for deletion and could not be restored/deleted: {restore_exc.response.get('Error', {}).get('Message', str(restore_exc))}"
                        )
                else:
                    logger.error(f"Failed to delete orphaned secret: {exc}")
                    raise SecretsManagerError(
                        f"Secret already exists and could not be deleted: {error_msg}"
                    )
    except SecretsManagerError as exc:
        # If DescribeSecret permission is missing, log and continue - we'll handle "already exists" error during create
        if "is not authorized to perform: secretsmanager:DescribeSecret" in str(exc):
            logger.info(f"DescribeSecret permission not available, will handle 'already exists' error during create")
        else:
            # Re-raise other errors
            raise
    
    try:
        logger.info(f"Creating secret {name}")
        response = client.create_secret(Name=name, SecretString=private_key)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        error_message = exc.response.get("Error", {}).get("Message", str(exc))
        
        # Handle "already exists" error - try to delete and recreate
        if error_code == "ResourceExistsException":
            logger.warning(f"Secret {name} already exists, attempting to delete and recreate")
            try:
                # Try to delete the existing secret
                client.delete_secret(
                    SecretId=name,
                    ForceDeleteWithoutRecovery=True,
                )
                logger.info(f"Deleted existing secret {name}, retrying create")
                # Retry creating the secret
                response = client.create_secret(Name=name, SecretString=private_key)
            except ClientError as delete_exc:
                delete_error_code = delete_exc.response.get("Error", {}).get("Code")
                delete_error_msg = delete_exc.response.get("Error", {}).get("Message", str(delete_exc))
                
                # Handle case where secret is scheduled for deletion - restore it first
                if "scheduled for deletion" in delete_error_msg.lower() or delete_error_code == "InvalidRequestException":
                    logger.info(f"Secret {name} is scheduled for deletion, restoring it first")
                    try:
                        client.restore_secret(SecretId=name)
                        logger.info(f"Restored secret {name}, now deleting")
                        client.delete_secret(
                            SecretId=name,
                            ForceDeleteWithoutRecovery=True,
                        )
                        logger.info(f"Deleted restored secret {name}, retrying create")
                        # Retry creating the secret
                        response = client.create_secret(Name=name, SecretString=private_key)
                    except ClientError as restore_exc:
                        logger.error(f"Failed to restore/delete secret: {restore_exc}")
                        raise SecretsManagerError(
                            f"Secret is scheduled for deletion and could not be restored/deleted: {restore_exc.response.get('Error', {}).get('Message', str(restore_exc))}"
                        )
                else:
                    logger.error(f"Failed to delete existing secret: {delete_exc}")
                    raise SecretsManagerError(
                        f"Secret already exists and could not be deleted: {delete_error_msg}"
                    )
        else:
            logger.error(f"AWS Secrets Manager error: code={error_code}, message={error_message}")
            raise SecretsManagerError(error_message)
    except BotoCoreError as exc:
        logger.error(f"AWS BotoCore error: {exc}")
        raise SecretsManagerError(str(exc))

    arn = response.get("ARN")
    if not arn:
        raise SecretsManagerError("AWS Secrets Manager did not return ARN")
    logger.info(f"Successfully created secret {name} with ARN {arn}")
    return arn


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
