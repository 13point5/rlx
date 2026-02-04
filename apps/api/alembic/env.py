import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context

# Load environment variables
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import your models' Base for autogenerate support
from rlx_api.database import Base

target_metadata = Base.metadata


def get_database_url() -> str:
    """Get and convert DATABASE_URL for sync Alembic migrations."""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")

    # Convert async driver to sync driver for Alembic
    # postgresql+asyncpg:// -> postgresql://
    if "+asyncpg" in database_url:
        database_url = database_url.replace("+asyncpg", "")

    # Convert sslmode to sslmode=require format for psycopg2
    # (asyncpg uses ssl=require, psycopg2 uses sslmode=require)
    if "ssl=require" in database_url:
        database_url = database_url.replace("ssl=require", "sslmode=require")

    # Remove channel_binding which psycopg2 may not support in all contexts
    database_url = database_url.replace("channel_binding=require&", "")
    database_url = database_url.replace("&channel_binding=require", "")
    database_url = database_url.replace("?channel_binding=require", "?")

    # Clean up any trailing ? or &
    if database_url.endswith("?"):
        database_url = database_url[:-1]

    return database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Get database URL and set it in the config
    database_url = get_database_url()
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
