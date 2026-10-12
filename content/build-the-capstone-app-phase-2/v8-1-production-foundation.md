# v8.1 · Production Foundation

**What you'll build:** before adding more AI capabilities, give the deployed v8 HelpDesk one tenant-safe domain model, durable job mechanism, authorization context, and repeatable test harness that every later milestone must extend.

## Why this version

Phase 1 stored users and messages, but Phase 2 needs orders, persisted tickets, evidence, tool executions, background jobs, vectors, traces, and prompt releases. Adding each as an isolated table would create a demo collection rather than one product. v8.1 defines the shared spine once.

## Repository contract

Keep the Next.js frontend and FastAPI backend from v8. Organize the backend by responsibility:

```text
backend/
  app/api/          # HTTP/SSE routes only
  app/domain/       # typed business models and state transitions
  app/services/     # tools, evidence, embeddings, workflows, prompts
  app/providers/    # OpenAI/Hugging Face adapters
  app/workers/      # durable background-job handlers
  app/db/           # queries and migrations
  tests/unit/ tests/integration/ tests/browser/
frontend/
  app/ components/ lib/api.ts
```

Route handlers authenticate, authorize, validate, call a service, and translate its result to HTTP. They do not contain prompts, provider loops, or SQL.

## Tenant and authorization model

An **organization** is one company account. A **membership** connects a user to an organization with a role. The backend derives this context from the verified Supabase JWT and database membership; request bodies never supply a trusted `user_id`, `organization_id`, or role.

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now()
);
create type member_role as enum ('customer','agent','admin');
create table memberships (
  organization_id uuid references organizations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role member_role not null,
  status text not null default 'active' check (status in ('active','suspended')),
  primary key (organization_id, user_id),
  unique (user_id)
);
create table tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations,
  customer_user_id uuid not null references auth.users,
  category text not null check (category in ('order','refund','technical','account','other')),
  status text not null check (status in ('draft','analyzing','awaiting_review','submitted','resolved','failed')),
  summary text not null default '', resolution_summary text,
  revision integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id, customer_user_id)
    references memberships (organization_id, user_id)
);
create index tickets_tenant_status on tickets (organization_id, status, updated_at desc);
```

Keep that category enum canonical through v22. New wording maps into it; changing the taxonomy requires a migration and backfill. Enable Row Level Security on tenant tables. Customers may access their own records; agents/admins may access records only through an active membership in the same organization. The service-role key exists only in trusted server/worker environments and every service-role query includes `organization_id` explicitly.

```python
@dataclass(frozen=True)
class TenantContext:
    user_id: UUID
    organization_id: UUID
    role: Literal["customer", "agent", "admin"]

async def require_tenant(auth_header: str, db) -> TenantContext:
    user_id = await verify_supabase_jwt(auth_header)
    membership = await db.fetch_one(
        "select organization_id, role from memberships where user_id=:u and status='active'",
        {"u": user_id},
    )
    if not membership:
        raise HTTPException(403, "No active organization membership")
    return TenantContext(user_id, membership.organization_id, membership.role)
```

This learning build deliberately allows one active organization per user, enforced by `unique(user_id)`, so tenant choice cannot be ambiguous. A later multi-org product would accept an explicit active-organization selector and validate that exact membership. Workers receive a previously validated `TenantContext` or trusted identifiers from the claimed job; they never infer tenant identity from user payload fields.

## Durable work instead of in-request work

Uploads, model analysis, batch imports, deletion, and compaction may outlive an HTTP request. Persist the domain change and an **outbox event** in one database transaction. A worker claims jobs with a lease; if it crashes, the lease expires and another worker resumes. `dedupe_key` prevents duplicate job creation; fencing and downstream idempotency keys prevent stale commits and repeated side effects.

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations,
  kind text not null, status text not null check (status in ('queued','running','retry','done','failed','cancelled')),
  payload jsonb not null, dedupe_key text not null, attempts integer not null default 0,
  available_at timestamptz not null default now(), leased_until timestamptz,
  lease_token uuid, lease_generation bigint not null default 0,
  last_error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create table workflow_events (
  id bigint generated always as identity primary key, organization_id uuid not null references organizations,
  workflow_id uuid not null, event_type text not null, public_payload jsonb not null,
  created_at timestamptz not null default now()
);
```

An upload returns `202 {workflow_id, evidence_id}` after storage metadata and its job are committed. Claiming rotates `lease_token` and increments `lease_generation`; completion uses `update ... where id=:id and lease_token=:token and status='running'`, preventing an expired worker from overwriting its replacement. Every external side effect receives a stable idempotency key—row deduplication alone cannot prevent duplicate execution. Authenticated SSE reads durable `workflow_events`, checks tenant ownership, and resumes from `Last-Event-ID`. A reconciliation job finds expired leases, orphaned private objects, and workflows stuck beyond their deadline.

## Shared operational tables

Add tables only when their milestone arrives, but require these fields on every derived artifact: stable ID, `organization_id`, owning user or ticket, status, content hash where relevant, producer/model/prompt/schema version, timestamps, and provenance. `llm_runs` stores tokens, latency, cached tokens, provider request ID, deployment SHA, and safe error code—not raw customer content. Cache and object keys begin with the server-derived organization ID.

## Test harness and acceptance gate

Seed two organizations, two customers, one agent per organization, orders, messages, and resolved tickets. Use fake provider adapters by default so tests cost nothing and reproduce failures. Every version must pass:

```text
unit: schema, state transition, retry/validation policy
integration: route + database + fake provider/worker
browser: one complete visible user outcome
security: cross-user and cross-organization request denied
recovery: worker crashes after claiming work, then resumes without duplication
```

Run migrations forward and backward against a disposable database. CI runs type checks, tests, dependency/container scans, and verifies that secrets and private payloads are absent from logs. Each feature has a flag and kill switch; migrations remain compatible with the previous application release until rollout finishes.

## Practice — assignments

1. Create the organization, membership, ticket, job, and event migrations.
2. Seed two isolated organizations with realistic Dubai support data.
3. Derive `TenantContext` from authentication and membership.
4. Implement job claiming, lease expiry, retry, cancellation, and reconciliation.
5. Stream durable workflow events with authenticated reconnect support.
6. Prove cross-user and cross-organization access fails in routes and workers.
7. Add fake providers, CI checks, feature flags, and a rollback checklist.
8. Tag the stable foundation `v8.1` before starting v9.
