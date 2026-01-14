from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import compute, github, health, projects, runs
from services.provisioning_worker import start_worker, stop_worker

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup: Start the provisioning worker
    await start_worker()
    yield
    # Shutdown: Stop the provisioning worker
    await stop_worker()


app = FastAPI(title="RLX API", lifespan=lifespan)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
