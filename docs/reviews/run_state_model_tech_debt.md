# Run State Model Tech Debt

**Created**: 2026-03-06  
**Status**: Tech debt / design note  
**Scope**: Run lifecycle, job lifecycle, Celery orchestration, provider-side state

## Why This Doc Exists

This document explains a class of bugs we found in RLX around:

- run termination
- stuck or duplicated jobs
- confusing terminal states
- Celery workers continuing after the run is effectively dead

The goal is to make this easy to understand even if you come back to the project months later and do not remember the recent work.

This is not a task list for one quick bugfix. It is a system design note explaining why these bugs keep happening and what architectural change would prevent them from coming back.

## Short Version

RLX currently treats lifecycle state as a few string columns that can be written from many places:

- FastAPI routers
- Celery worker tasks
- Celery beat / pod polling
- retry and terminate endpoints

That means the system has no single place that decides:

- which transitions are allowed
- whether a state change came from the user or from infrastructure failure
- whether one worker is allowed to claim a job that another worker already claimed

Because of that, it is possible to write code that is locally reasonable but globally wrong.

The main proposed fix is:

1. split "what RLX wants" from "what RLX last observed"
2. centralize transitions behind a state-machine-like layer
3. stop letting every caller directly set raw status strings
4. model execution attempts separately from logical jobs
5. make provider side effects durable and recoverable

## Mental Model Of The System Today

At a high level:

1. a `Run` is created
2. RLX creates a Prime Intellect pod
3. RLX creates a sequence of `Job` rows
4. Celery waits for the pod to become active
5. Celery queues and executes jobs over SSH
6. jobs update their own status as they run
7. the user can terminate the run at any time

Today, the same `Run.status` column is trying to represent multiple different ideas at once:

- whether the user still wants the run to exist
- whether the pod currently exists
- whether the provider reports the pod as healthy
- whether RLX should continue queueing jobs
- whether the run ended because of a user action or a failure

That is the first major design problem.

## Bugs We Found

### 1. A non-user failure can look like a user cancellation

We found a worker path where any non-`ACTIVE` run caused the current job to be rewritten as:

- `CANCELLED`
- `error_type = run_terminated`

That means these two very different situations can look the same in the database and UI:

- the user clicked Terminate
- the provider killed the pod or the run entered `ERROR`

Why that is bad:

- operators lose the real cause
- debugging becomes harder
- retry behavior can become inconsistent
- the UI teaches the wrong mental model

### 2. A `RUNNING` job can be executed twice

We found a worker claim path that treated `RUNNING` as still executable.

That means a duplicate Celery delivery, worker restart, or revoke race can lead to:

1. worker A claims job `123`
2. job `123` becomes `RUNNING`
3. worker B sees the same job and is still allowed to execute it
4. the same SSH command runs twice

Why that is bad:

- duplicate repo setup commands
- duplicate Prime RL launches
- conflicting writes on the pod
- inconsistent logs and final state

This is not just a code style problem. It is a concurrency control problem.

### 3. Termination mutates the provider before the database is durably updated

We found a termination flow that:

1. deletes the pod first
2. then updates run/job state in PostgreSQL

If the database commit fails after the pod is already deleted, RLX can end up in a split-brain state:

- the pod is gone in the real world
- the database still says the run is active or jobs are running

Why that is bad:

- the UI becomes wrong
- cleanup paths get harder
- users lose trust in the system state
- repair becomes manual

### 4. Termination rewrites never-started jobs

We found a cleanup helper that marked `PENDING` jobs as `CANCELLED`, not just truly in-flight work.

That means a job that never started is treated the same way as a job that was actively interrupted.

Why that is bad:

- history becomes less accurate
- `sync-jobs` gets weaker because the sequence already exists
- it becomes hard to tell "missing work" from "cancelled work"

## Shared Root Cause

All four bugs come from the same deeper issue:

**RLX does not have a strong lifecycle model.**

More specifically:

- statuses are plain strings
- status writes happen in many places
- there is no single transition authority
- "desired state" and "observed state" are mixed together
- logical jobs and execution attempts are mixed together
- external side effects are not modeled as durable state transitions

This means you can write code like:

```python
run.status = RunStatus.TERMINATED
job.status = JobStatus.CANCELLED
```

and it looks fine locally, but the code may still be semantically wrong because:

- maybe the provider says the pod is still alive
- maybe the user did not request termination
- maybe the job never started
- maybe another worker already owns the job

## Why Split States

The most important design change is to stop forcing one column to mean everything.

### Current overloaded model

Today a single `Run.status` has to answer all of these questions:

- What does the user want?
- What does the provider currently report?
- Should workers continue doing work?
- Why did the run stop?

That is too much.

### Proposed model

Split the run lifecycle into at least these concepts:

#### 1. Desired state

What RLX wants to happen.

Examples:

- `PENDING`
- `RUNNING`
- `TERMINATING`
- `TERMINATED`

This is mainly driven by user intent and system policy.

#### 2. Observed state

What RLX last observed from the provider / worker reality.

Examples:

- `PROVISIONING`
- `ACTIVE`
- `STOPPED`
- `ERROR`
- `DELETED`

This is mainly driven by Prime Intellect responses, SSH failures, and worker observations.

#### 3. Terminal reason

Why the run ended or why a job became terminal.

Examples:

- `user_terminated`
- `provider_error`
- `pod_deleted`
- `command_failed`
- `timeout`
- `cancelled_before_start`

This is important because "ended" is not enough. The cause matters for retry, UI messaging, and debugging.

## Concrete Examples Of Why Split States Helps

### Case A: User clicks Terminate

What happens today:

- code may delete the pod
- code may mark jobs cancelled
- code may mark run terminated
- if a worker finishes late, it might still try to write success or failure

What split states would look like:

1. set `desired_state = TERMINATING`
2. keep `observed_state = ACTIVE` until the provider confirms deletion
3. workers see `desired_state = TERMINATING` and stop claiming new work
4. provider deletion succeeds
5. set `observed_state = DELETED`
6. finalize run as terminal with `terminal_reason = user_terminated`

Why this is better:

- the system can represent "user wants termination but provider cleanup is still in progress"
- late worker writes are easier to reject consistently
- the UI can show a truthful intermediate state

### Case B: Provider kills the pod unexpectedly

What happens today:

- a worker may notice the run is no longer active
- the current job may get rewritten as cancelled
- the UI can look like the user terminated it

What split states would look like:

1. `desired_state` is still `RUNNING`
2. provider polling changes `observed_state` to `ERROR` or `STOPPED`
3. transition layer decides the run is terminal because observed reality no longer supports progress
4. `terminal_reason = provider_error`

Why this is better:

- we preserve the difference between user intent and infra failure
- retries and alerts can behave differently
- the UI tells the truth

### Case C: Duplicate Celery delivery

What happens today:

- two workers may both think they can run the same job

What the improved model would look like:

- the logical `Job` stays the same
- a single `JobAttempt` row is claimed atomically
- only one active attempt can exist at a time
- duplicate deliveries either fail the claim or attach to the same attempt as no-ops

Why this is better:

- concurrency control becomes explicit
- retries are represented as new attempts instead of mutating history
- the system is easier to debug

### Case D: Job never started, then run is terminated

What happens today:

- a future job can be changed from `PENDING` to `CANCELLED`

What the improved model would look like:

- the job remains logically unstarted
- if needed, a terminal reason can say the run ended before this job began
- or the cancellation is attached to an attempt record only if an attempt actually existed

Why this is better:

- history remains accurate
- later repair or resync is easier
- "not started" stays distinct from "interrupted"

## Proposed Data Model Direction

This is the design direction, not a final migration plan.

### Run

Suggested fields:

- `desired_state`
- `observed_state`
- `terminal_reason`
- `state_version`
- `termination_requested_at`
- `terminated_at`

Notes:

- `state_version` supports optimistic concurrency
- `termination_requested_at` is useful for stuck cleanup and auditability

### Job

Suggested responsibility:

- represent the logical step in the pipeline
- keep sequence and durable identity
- keep a high-level lifecycle only

Possible fields:

- `status`
- `terminal_reason`
- `current_attempt_id`
- `state_version`

### JobAttempt

This is the missing concept that would make worker behavior cleaner.

Suggested fields:

- `job_id`
- `attempt_number`
- `status`
- `worker_id`
- `celery_task_id`
- `claimed_at`
- `started_at`
- `completed_at`
- `lease_expires_at`
- `exit_code`
- `error_message`

Why this helps:

- retries do not overwrite the same execution record
- duplicate claims are easier to block
- one logical job can have many attempts without losing history

## State Machine Pattern

Even if RLX stays on Celery, run/job transitions should go through one layer.

That layer should answer:

- can this transition happen?
- who is allowed to cause it?
- what side effects should be scheduled?
- what terminal reason should be attached?

Examples:

- `ACTIVE -> TERMINATED` because the user requested termination
- `ACTIVE -> ERROR` because the provider reported failure
- `QUEUED -> RUNNING` only if the claim is atomic and current
- `RUNNING -> SUCCESS` only if the run is still allowed to complete

Without that layer, every new endpoint or worker path can accidentally invent a new lifecycle rule.

## Why This Is Better Than More Local Bugfixes

Local bugfixes are still necessary, but they do not solve the underlying problem.

If we only patch the four bugs we found:

- another route may still write an invalid state
- another worker path may still confuse failure and cancellation
- another cleanup flow may still interleave DB and provider writes incorrectly

The stronger design goal is:

**make invalid state transitions hard to express**

That means:

- one transition authority
- fewer direct raw status writes
- explicit reason codes
- explicit concurrency control

## Useful Design Patterns For A Future Refactor

These are not required immediately, but they are the right direction.

### 1. State machine / reducer

Good for:

- legal transitions
- guards
- consistent side effects

This is the smallest architectural improvement with the biggest payoff.

### 2. Optimistic concurrency or row locking

Good for:

- preventing duplicate claims
- preventing late writes from stale workers

This matters especially for Celery.

### 3. Outbox pattern

Good for:

- making external side effects durable
- avoiding "provider changed, DB did not" split-brain bugs

Example:

- transaction stores `desired_state = TERMINATING`
- transaction inserts `DeletePod` outbox event
- background worker performs the deletion
- reconciliation updates observed state

### 4. Reconciliation loop

Good for:

- repairing mismatches between database belief and provider reality
- handling crashes mid-transition

This is useful even if the rest of the design stays mostly the same.

## Packages Worth Considering Later

These are options, not immediate requirements.

### `python-statemachine`

Good fit if we want:

- explicit states and transitions
- guards and callbacks
- a modest change inside the current architecture

### `transitions`

Good fit if we want:

- a lighter FSM library
- simpler lifecycle enforcement

### SQLAlchemy versioning or stronger DB claim patterns

Good fit if we want:

- atomic ownership changes
- stale write detection

This is important even if we do not adopt a separate FSM package.

### Temporal

Good fit if RLX grows into a more workflow-heavy system and Celery orchestration becomes too fragile.

Temporal would help with:

- durable workflow execution
- retries
- cancellation
- crash recovery
- long-running orchestration

This is a much larger move and probably not the next step unless RLX becomes much more complex.

## Practical Recommendation

If this work becomes a real project later, the recommended order is:

1. define explicit lifecycle semantics for runs and jobs
2. split `desired_state` from `observed_state`
3. add terminal reason fields
4. stop direct status writes outside a transition layer
5. add atomic claim semantics for job execution
6. introduce `JobAttempt`
7. add outbox + reconciliation for provider side effects

That order gives the most safety without forcing a huge rewrite all at once.

## What To Remember Later

If you return to this project and do not remember the details, remember this:

- the problem is not just "a few buggy endpoints"
- the problem is that RLX currently mixes intent, observation, execution, and failure cause into too few fields
- that makes the code easy to write but hard to make correct
- the right long-term fix is to make lifecycle state explicit and centralized

If new bugs show up around:

- terminate vs stop vs error
- Celery retries
- duplicate execution
- stuck running jobs
- confusing UI state

they are probably symptoms of this same design gap.
