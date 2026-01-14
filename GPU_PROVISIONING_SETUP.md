# GPU Provisioning and Job Queue Implementation

This document describes the GPU provisioning and job queue system for RLX.

## Overview

When a user creates a new run, the system:
1. Creates a Run record in the database
2. Provisions a GPU instance via Prime Intellect API
3. Polls the instance status until it's active
4. Automatically clones the user's GitHub repository to the instance via SSH
5. Provides status updates that can be polled from the web app

## Architecture

### Database Models

**Run Table** (`apps/api/database.py`):
- Stores run configuration (GPU type, count, provider, etc.)
- Tracks provisioning status: `pending` → `provisioning` → `active` → `failed`/`terminated`
- Stores SSH connection info and IP address once provisioned
- Tracks repo clone status: `pending` → `cloning` → `cloned` → `failed`

### Background Job Queue

**ProvisioningWorker** (`apps/api/services/provisioning_worker.py`):
- Runs continuously in the background (started via FastAPI lifespan)
- Polls database every 10 seconds for pending/provisioning runs
- Handles GPU provisioning workflow:
  1. Creates pod via Prime Intellect API
  2. Polls pod status until active
  3. Executes SSH command to clone GitHub repo
- Updates run status in database throughout the process

### API Endpoints

**POST /api/runs**
- Creates a new run
- Required fields:
  - `project_id`: ID of the project to run
  - `name`: Name for the run
  - `gpu_type`: GPU type (e.g., "H100_80GB")
  - `gpu_count`: Number of GPUs
  - `cloud_id`: Cloud ID from availability API
  - `provider`: Provider type (e.g., "hyperstack")
  - `region`: (optional) Region
  - `data_center_id`: (optional) Data center ID

**GET /api/runs/{run_id}**
- Get status of a specific run (for polling)
- Returns:
  - `status`: Current run status
  - `installation_progress`: 0-100
  - `ssh_connection`: SSH connection string (when active)
  - `ip_address`: Instance IP (when active)
  - `clone_status`: Repo clone status
  - Full run details

**GET /api/runs?project_id={id}**
- List all runs for a project

**DELETE /api/runs/{run_id}**
- Terminate a run (deletes pod and marks as terminated)

## Setup Instructions

### 1. Environment Variables

Add to `apps/api/.env`:

```bash
# Required for provisioning
PRIME_INTELLECT_API_KEY=your_api_key_here

# Existing variables (should already be set)
DATABASE_URL=postgresql+asyncpg://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 2. Database Migration

Run the migration to create the `runs` table:

```bash
cd apps/api
uv run alembic revision --autogenerate -m "add runs table for gpu provisioning"
uv run alembic upgrade head
```

### 3. SSH Key Setup

For the repo cloning to work, you need to set up SSH keys on the provisioned instances:

**Option 1: Use Prime Intellect SSH Keys (Recommended)**
1. Upload your SSH public key via Prime Intellect dashboard or API
2. Set it as the primary key
3. The provisioned instances will automatically include this key

**Option 2: Use GitHub Deploy Keys**
- For private repositories, you may want to use deploy keys instead
- This requires modifying the clone logic in `provisioning_worker.py`

### 4. Start the API

```bash
cd apps/api
uv run uvicorn main:app --reload --port 8000
```

The provisioning worker will start automatically.

## How It Works

### Creating a Run (Frontend Flow)

1. User selects a project and GPU configuration
2. Frontend calls `POST /api/runs` with configuration
3. Backend creates run record with status `pending`
4. Returns immediately with run ID

### Background Provisioning

1. Worker detects new `pending` run
2. Calls Prime Intellect API to create pod
3. Updates run status to `provisioning`
4. Polls pod status every 10 seconds
5. When `status=ACTIVE` and `installationProgress=100`:
   - Updates run status to `active`
   - Triggers repo clone

### Repo Cloning

1. Fetches project info and GitHub access token
2. Constructs authenticated clone URL: `https://{token}@github.com/{owner}/{repo}.git`
3. Executes SSH command: `cd /root && git clone {url} repo`
4. Updates `clone_status` to `cloned` or `failed`

### Frontend Polling

Frontend should poll `GET /api/runs/{run_id}` every 5-10 seconds to get status updates:

```typescript
// Example polling logic
const pollRunStatus = async (runId: number) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/runs/${runId}`);
    const { data } = await response.json();

    if (data.status === 'active' && data.clone_status === 'cloned') {
      // Run is ready!
      clearInterval(interval);
      // Show SSH connection info
    } else if (data.status === 'failed') {
      // Handle error
      clearInterval(interval);
    }

    // Update UI with progress
  }, 5000); // Poll every 5 seconds
};
```

## GitHub API for Cloning

The system uses GitHub's access token to clone repositories:

**For Public Repos:**
- Clone works with or without authentication
- Using token ensures higher rate limits

**For Private Repos:**
- Access token is required
- Token must have `repo` scope
- Clone URL: `https://{token}@github.com/{owner}/{repo}.git`

**Token Management:**
- Tokens are stored in `github_connections` table
- Tokens are automatically refreshed if expired
- If refresh fails, clone will fail (user needs to reconnect GitHub)

## Security Considerations

1. **SSH Key Management:**
   - Ensure proper SSH key setup on Prime Intellect
   - Keys should be user-specific or team-specific

2. **GitHub Tokens:**
   - Tokens are encrypted at rest in database
   - Tokens are only used in backend, never sent to frontend
   - Tokens in clone URLs are not logged

3. **Pod Access:**
   - SSH connection strings are only returned to authenticated users
   - Users can only access their own runs

4. **Network Security:**
   - Pods should be configured with appropriate firewalls
   - Only necessary ports should be exposed

## Error Handling

The system handles various error scenarios:

1. **Provisioning Failures:**
   - Pod creation fails → `status=failed`, `error_message` set
   - Installation fails → `status=failed`, `error_message` from Prime Intellect

2. **Clone Failures:**
   - GitHub token invalid → `clone_status=failed`, `clone_error` set
   - Repo not found → `clone_status=failed`, `clone_error` set
   - SSH failure → `clone_status=failed`, `clone_error` set

3. **Network Failures:**
   - Prime Intellect API down → Worker retries on next poll cycle
   - SSH connection timeout → `clone_status=failed`

## Monitoring

To monitor the provisioning worker:

1. **Check logs:**
   ```bash
   # Worker logs are printed to stdout
   # Look for "Error in provisioning worker" messages
   ```

2. **Database queries:**
   ```sql
   -- Check pending runs
   SELECT * FROM runs WHERE status = 'pending';

   -- Check provisioning runs
   SELECT * FROM runs WHERE status = 'provisioning' ORDER BY created_at DESC;

   -- Check failed runs
   SELECT * FROM runs WHERE status = 'failed' ORDER BY created_at DESC;
   ```

3. **Worker status:**
   - Worker runs as long as the FastAPI app is running
   - Stops gracefully on app shutdown

## Future Improvements

1. **Persistent Job Queue:**
   - Replace in-memory worker with Redis/Celery/ARQ
   - Enables multiple workers for scalability
   - Ensures jobs aren't lost on restart

2. **Better SSH Management:**
   - Use paramiko/asyncssh library instead of subprocess
   - Manage SSH keys per user/project
   - Support custom startup scripts

3. **Metrics and Monitoring:**
   - Track provisioning time
   - Monitor costs
   - Alert on failures

4. **Advanced Features:**
   - Support for custom Docker images
   - Environment variable injection
   - Jupyter notebook integration
   - TensorBoard integration

## Troubleshooting

**Run stuck in "pending":**
- Check worker is running (should start with FastAPI app)
- Check logs for errors
- Verify PRIME_INTELLECT_API_KEY is set

**Run stuck in "provisioning":**
- Check Prime Intellect dashboard for pod status
- Check pod ID in database matches actual pod
- Pod might be in queue due to capacity

**Clone fails:**
- Check GitHub token is valid (not expired)
- Check user has access to repository
- Check SSH is working on pod
- Verify SSH key is set up on Prime Intellect

**SSH connection not working:**
- Check pod is in ACTIVE state
- Check `ssh_connection` field is populated
- Verify SSH key is correct
- Check firewall rules
