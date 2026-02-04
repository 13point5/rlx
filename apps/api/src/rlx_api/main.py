import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rlx_api.routers import compute, github, health, jobs, projects, runs, ssh_keys, wandb

load_dotenv()

app = FastAPI(title="RLX API")

# CORS configuration - supports comma-separated origins from environment
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(compute.router)
app.include_router(github.router)
app.include_router(projects.router)
app.include_router(runs.router)
app.include_router(ssh_keys.router)
app.include_router(jobs.router)
app.include_router(wandb.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("rlx_api.main:app", host="0.0.0.0", port=8000, reload=True)
