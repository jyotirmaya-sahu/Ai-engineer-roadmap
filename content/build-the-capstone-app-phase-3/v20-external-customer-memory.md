# v20 · External Customer Memory

**What you'll build:** HelpDesk stores approved customer facts outside the conversation and loads only relevant memories for the current request.

## Why this version

Chat history is not reliable long-term memory. It becomes too large, contains corrections and outdated claims, and disappears from the model when trimmed. Useful facts—preferred language, confirmed product, accessibility preference—need their own lifecycle, provenance, and user controls.

## The mechanism

Separate episodic conversation summaries from durable profile facts. A memory candidate is extracted after a turn but is not automatically trusted. Validate its type, attach provenance, set an expiry when appropriate, and require user confirmation for sensitive or consequential facts.

```python
class MemoryCandidate(BaseModel):
    key: Literal["preferred_language", "preferred_channel", "owned_product"]
    value: str = Field(max_length=200)
    source_message_id: int
    confidence: float = Field(ge=0, le=1)

class MemoryFact(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    key: Literal["preferred_language", "preferred_channel", "owned_product"]
    value: str = Field(max_length=200)
    source_message_id: int
    status: Literal["candidate", "active", "rejected", "expired"]
    confirmed_at: datetime | None
    confirmed_by_user_id: UUID | None
    expires_at: datetime | None
```

The model may produce only `MemoryCandidate`. A server confirmation endpoint checks the authenticated owner and sets `confirmed_at` and `confirmed_by_user_id`; the model can never confirm its own suggestion. Persist tenant/user ownership, source provenance, extractor/release version, created/updated timestamps, and a uniqueness policy. Provide authenticated `GET`, `PATCH`, and `DELETE /api/memories` routes, RLS, expiry cleanup, cache invalidation, and cross-user tests.

Before a response, a deterministic memory service selects facts allowed for the current task and tenant. Format them in a clearly labelled context block. Tool results remain separate and turn-scoped; they should not silently become durable memory.

<div class="diagram">
  <div class="flow"><span class="dbox gray">conversation</span><span class="darr">→</span><span class="dbox orange">memory candidates</span><span class="darr">→</span><span class="dbox blue">validate + confirm + expire</span><span class="darr">→</span><span class="dbox purple">task-specific selection</span><span class="darr">→</span><span class="dbox green">personalized answer</span></div>
  <div class="dcap">External memory is governed data, not a permanent dump of everything the customer said.</div>
</div>

Add a settings screen where users can view, correct, and delete remembered facts. Deletion must remove the database record and invalidate caches. Never store passwords, payment numbers, health claims, identity documents, or speculative model inferences as convenience memory.

Context isolation matters here. The order-lookup stage may receive user ID and authorized order data; the tone-selection stage only needs preferred language. Avoid one global context object containing every customer field. Record which memory IDs each model call received so unwanted personalization can be investigated.

## How a company uses this

A bilingual support assistant remembers that a customer prefers Arabic after confirmation, but does not remember a one-time delivery address from chat. Facts may expire after 90 days or when the source record changes. Privacy requests can export or delete memory separately from operational ticket records. Metrics include memory acceptance, correction, deletion, and harmful-stale-memory rates.

## Common mistakes

- Treating the entire transcript or its summary as permanent truth.
- Saving model-generated inferences without confirmation.
- Loading all memories into every call.
- Failing to expire facts that change.
- Providing no customer view or delete control.

## Interview tip

Explain memory as a governed data product: typed facts, provenance, confirmation, TTL, task-scoped retrieval, and deletion—not a vector database magic feature.

## Practice — assignments

1. Define an allowlist of memory fact types.
2. Extract candidates but require confirmation before activation.
3. Load only task-relevant facts into each stage.
4. Add view, correction, and deletion controls.
5. Expire a deliberately stale preference.
6. Verify deleted memory disappears from caches and prompts.
7. Audit which memory IDs influenced a response.
