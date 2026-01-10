import os
from typing import Annotated

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="RLX API")

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Clerk client
clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))


async def get_current_user(request: Request) -> dict:
    """
    Dependency that authenticates the request using Clerk.
    Returns the authenticated user's payload or raises 401.
    """
    # Get the Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # Build an httpx.Request for Clerk's authenticate_request
    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers),
    )

    # Authenticate the request
    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=["http://localhost:3000"],
        ),
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: {request_state.reason}",
        )

    return request_state.payload


# Type alias for the dependency
CurrentUser = Annotated[dict, Depends(get_current_user)]


@app.get("/")
async def root():
    """Public health check endpoint."""
    return {"status": "ok", "message": "RLX API is running"}


@app.get("/api/secret")
async def get_secret(user: CurrentUser):
    """
    Protected endpoint that returns a secret.
    Only accessible to authenticated users.
    """
    user_id = user.get("sub")
    return {
        "secret": "🔐 This is a super secret message!",
        "user_id": user_id,
        "message": f"Hello authenticated user {user_id}!",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
