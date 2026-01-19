import os
from datetime import datetime, timezone
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Convert sslmode to ssl for asyncpg compatibility
if DATABASE_URL:
    # asyncpg uses 'ssl' instead of 'sslmode'
    DATABASE_URL = DATABASE_URL.replace("sslmode=require", "ssl=require")
    # Also remove channel_binding which asyncpg doesn't support
    DATABASE_URL = DATABASE_URL.replace("channel_binding=require&", "")
    DATABASE_URL = DATABASE_URL.replace("&channel_binding=require", "")
    DATABASE_URL = DATABASE_URL.replace("?channel_binding=require", "?")
    # Clean up any trailing ? or &
    if DATABASE_URL.endswith("?"):
        DATABASE_URL = DATABASE_URL[:-1]

engine = (
    create_async_engine(
        DATABASE_URL,
        echo=True,
        pool_pre_ping=True,  # Test connections before using them (handles idle timeouts)
        pool_recycle=300,  # Recycle connections after 5 minutes
    )
    if DATABASE_URL
    else None
)
async_session = (
    async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    if engine
    else None
)


class Base(DeclarativeBase):
    pass


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    github_user_id = Column(String)
    github_username = Column(String)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String)
    token_expires_at = Column(DateTime(timezone=True))
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    repo_id = Column(
        Integer, nullable=False
    )  # GitHub repo ID (permanent unique identifier)
    repo_name = Column(String, nullable=False)  # repo name
    repo_owner = Column(String, nullable=False)  # repo owner
    repo_owner_type = Column(String, nullable=False)  # "User" or "Organization"
    repo_url = Column(String, nullable=False)  # Full GitHub URL
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Unique constraint: one project per user per repo
    __table_args__ = (
        UniqueConstraint("clerk_user_id", "repo_id", name="unique_user_repo"),
    )

    # Property to derive full_name when needed (not stored in DB)
    @property
    def repo_full_name(self) -> str:
        return f"{self.repo_owner}/{self.repo_name}"


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, nullable=False, index=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    branch = Column(String, nullable=False)
    config_path = Column(String, nullable=False)
    status = Column(String, nullable=False, default="provisioning")
    provider = Column(String, nullable=False)
    region = Column(String, nullable=False)
    data_center = Column(String)
    country = Column(String)
    gpu_type = Column(String, nullable=False)
    gpu_count = Column(Integer, nullable=False)
    security = Column(String, nullable=False)
    cloud_id = Column(String, nullable=False)
    pod_id = Column(String, nullable=False)
    is_spot = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class UserSshKey(Base):
    __tablename__ = "user_ssh_keys"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    public_key = Column(String, nullable=False)
    prime_ssh_key_id = Column(String, nullable=False)
    aws_secret_arn = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    if async_session is None:
        raise RuntimeError(
            "Database not configured. Set DATABASE_URL environment variable."
        )
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
