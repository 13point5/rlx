from fastapi import APIRouter

from deps import CurrentUser

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Public health check endpoint."""
    return {"status": "ok", "message": "RLX API is running"}


@router.get("/api/secret")
async def get_secret(user: CurrentUser):
    """Protected endpoint that returns a secret."""
    user_id = user.get("sub")
    return {
        "secret": "🔐 This is a super secret message!",
        "user_id": user_id,
        "message": f"Hello authenticated user {user_id}!",
    }
