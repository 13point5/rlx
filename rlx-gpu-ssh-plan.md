# RLX GPU SSH Execution Implementation Plan

## Scope
- Per-user SSH keys (public + private)
- Private key stored in AWS Secrets Manager
- Redis Cloud as Celery broker
- ECS deployment (API + worker services)
- One pod per run; fixed clone path (/workspace/repo)
- Worker command: clone repo → checkout branch → ls repo contents
- No sandbox hop

## Phase 0 — Requirements Lock
- Confirm JSON key upload
- Enforce single key per user
- Fixed clone path: /workspace/repo
Checkpoint A: scope confirmed before edits

## Phase 1 — DB + Models
- Add `user_ssh_keys` table:
  - id, clerk_user_id, public_key, prime_ssh_key_id, aws_secret_arn, created_at
- Add SQLAlchemy model + Alembic migration
Checkpoint B: migration applied and model available
Commit + push after approval

## Phase 2 — Secrets Manager + Key Upload API
- AWS Secrets Manager helper
- POST /api/ssh-keys
  - Store private key in Secrets Manager
  - Register public key with Prime Intellect
  - Save metadata in DB
Checkpoint C: endpoint returns saved key metadata
Commit + push after approval

## Phase 2.5 — Verification
- Configure AWS credentials and region
- Call POST /api/ssh-keys with test keys
- Confirm Prime Intellect key created + secret stored
Checkpoint C2: end-to-end key upload verified
Commit + push after approval

## Phase 3 — Pod Creation Update
- Lookup user key in `create_run`
- Include `sshKeyId` in pod payload
- Reject run creation if key missing
Checkpoint D: pods created with SSH key
Commit + push after approval

## Phase 4 — Celery Queue + Worker
- Celery config using Redis Cloud
- Enqueue job on run creation
- Worker flow:
  - Poll pod status to ACTIVE
  - Fetch sshConnection
  - Retrieve private key from Secrets Manager
  - SSH into pod and run:
    - git clone <repo_url> /workspace/repo
    - cd /workspace/repo
    - git checkout <branch>
    - ls -la
Checkpoint E: worker executes `ls` on GPU
Commit + push after approval

## Phase 5 — Run Status Updates
- Update run status to QUEUED → RUNNING → SUCCEEDED/FAILED
- Store exit code (optional)
Checkpoint F: status reflected in /runs/{id}/status
Commit + push after approval
