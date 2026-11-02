# Product-system coverage model

Use this reference as a completeness lens, not a mandatory output template. Select the lenses that can change the decision at hand. For a whole-product audit, cover all lenses and show where evidence is missing.

## Evidence labels

- **Known** — supported by the user's statement, observed behavior, code, data, or an authoritative document.
- **Inferred** — the most likely interpretation of available evidence.
- **Proposed** — a recommended design that does not yet exist or is not yet approved.
- **Unknown** — material information that cannot be established safely.

Attach a source or short reason to consequential Known claims. Promote Inferred or Proposed items only after evidence or a decision.

## The nine lenses

### 1. Product truth

Establish:

- target actors, customers, and beneficiaries
- problem, promised outcome, and measurable value
- business model and incentives when relevant
- product boundary, non-goals, dependencies, and constraints
- success, misuse, and unacceptable outcomes

Watch for a product described only as technology, a different value proposition for every stakeholder, or a feature with no owner or outcome.

### 2. Journeys and states

Cover the lifecycle, not only the main screen:

- discovery and qualification
- identity, access, onboarding, and setup
- mandate/configuration creation and validation
- first successful outcome
- recurring normal operation
- review, correction, approval, and collaboration
- exception, dispute, support, and recovery
- renewal, expansion, offboarding, export, and deletion

Model meaningful entity states and allowed transitions. Check abandoned, duplicated, delayed, partially completed, expired, revoked, retried, and conflicting operations.

### 3. Capabilities and interfaces

Group capabilities by user or business outcome rather than UI page or team. For each critical capability record:

| Field | Question |
|---|---|
| Outcome | What becomes true, for whom? |
| Trigger | What starts it, and can it repeat? |
| Inputs | Which user, system, policy, and data inputs are required? |
| Decision | What rule or judgment selects the action? |
| Authority | Who or what is allowed to decide? |
| Action | What changes internally or externally? |
| Output/state | What is produced and persisted? |
| Consumer | Who or what depends on it next? |
| Failure | How is failure detected, contained, retried, or escalated? |
| Evidence | How do we know it is correct and valuable? |

Check external APIs, internal contracts, UI surfaces, batch jobs, events, notifications, exports, and administrative tools.

### 4. Mandates, policy, and governance

Use three explicit layers when the product performs governed or customer-specific decisions.

#### Platform mandate

Define product-wide invariants and authority:

- allowed and prohibited outcomes/actions
- security, privacy, legal, and safety boundaries
- authority hierarchy and conflict resolution
- required evidence and approval classes
- audit, explainability, and retention minimums
- versioning, rollout, rollback, and change authority

Keep hard enforcement in code even when the mandate expresses the rule. A mandate without an enforcement point is documentation, not control.

#### Customer mandate

Define the customer's permitted operating intent:

- goals and priority order
- domain definitions and business rules
- users, roles, entities, and jurisdictions
- approved data sources and purposes
- allowed tools/actions and spending or risk limits
- thresholds, preferences, outputs, SLAs, and escalation paths
- effective dates, approvals, versions, and exceptions

Reject or surface conflicts with the platform mandate. Do not silently weaken platform invariants.

#### Runtime mandate

Resolve an immutable execution snapshot containing:

- platform/customer mandate version IDs
- actor, tenant, agent/service identity, and delegated authority
- task objective and permitted actions/tools
- relevant data scope and provenance
- resource, time, cost, and risk limits
- required approval state
- decision/evidence references and expiry

Persist enough of the snapshot and result to reproduce why an action was allowed. Define behavior when mandates change during a long-running workflow.

### 5. Data and learning lifecycle

Trace data from origin to deletion:

`source → consent/purpose → ingestion → validation → identity/entity resolution → storage → access → transformation → decision use → output → feedback → analytics/learning → retention/deletion`

For important data, establish ownership, tenant boundary, schema, quality, lineage, freshness, sensitivity, residency, access policy, encryption, retention, deletion propagation, and incident impact.

Separate:

- operational state required to run the product
- event history required to explain what happened
- analytical models/metrics used to understand behavior
- evaluation data used to judge agents or decisions
- training/learning data, which requires explicit purpose and governance

Define events before dashboards. Every metric needs a decision it supports, a definition, an owner, and known failure modes.

### 6. Agent, service, and human operating model

Do not assume every capability needs an agent. Choose the execution type:

- deterministic code for stable rules and enforcement
- service/workflow for reliable orchestration and integration
- agent for context-sensitive interpretation or planning
- human for accountable judgment, exceptions, or high-impact approval

For each role define:

| Contract | Required detail |
|---|---|
| Purpose | One owned outcome |
| Trigger | Event, request, schedule, or handoff |
| Inputs/context | Required state and how it is retrieved |
| Tools/data | Explicit allowlist and tenant scope |
| Authority | Decide, recommend, execute, approve, or observe |
| Output | Schema, destination, and quality contract |
| State/memory | Ephemeral versus durable; source of truth |
| Handoffs | Preconditions, acknowledgement, idempotency |
| Failure | Timeout, retry, fallback, escalation, compensation |
| Evaluation | Correctness, policy, latency, cost, and outcome metrics |
| Owner | Team or accountable human |

Check for agents that can both propose and approve consequential actions, unclear final authority, prompt-only security, silent tool failure, non-idempotent retries, context leakage, runaway loops, and results no consumer validates.

### 7. Platform architecture

Map only the components needed to explain product behavior:

- client/product surfaces and access control
- API/edge and integration boundaries
- domain services and source-of-truth ownership
- workflow/orchestration and queues/events
- mandate/policy registry, resolver, and enforcement points
- agent runtime, tool gateway, memory/context, and evaluation
- operational, event, analytical, and audit stores
- external providers and failure containment
- observability, administration, and support tooling

For every boundary define interface, owner, state ownership, consistency expectation, authentication/authorization, failure semantics, versioning, and observability. Avoid premature service decomposition; a boundary can be logical before it is separately deployed.

### 8. Cross-cutting qualities

Evaluate proportionally to risk:

- security and threat model
- privacy, consent, residency, and deletion
- tenant isolation and least privilege
- safety, abuse, fraud, and policy enforcement
- reliability, availability, recovery, and disaster scenarios
- latency, throughput, concurrency, and scale
- explainability, auditability, and reproducibility
- accessibility, localization, and multi-device behavior
- cost, quotas, rate limits, and unit economics
- observability, support, incident response, and operational ownership
- testability, evaluation, rollout, rollback, and migration

Turn each important quality into an acceptance condition or operating limit, not an adjective such as “secure” or “scalable.”

### 9. Delivery and evolution

Slice vertically by demonstrated user outcome. A delivery slice should include the minimum journey, capability, policy, data, execution, interface, failure handling, and measurement needed to validate value safely.

Distinguish:

- decisions needed now because they shape foundations
- reversible choices that can wait
- launch requirements
- deliberate extension points
- speculative branches that should remain outside scope

Record consequential decisions with context, choice, rejected alternatives, tradeoffs, owner, date/status, and revisit trigger. Define migrations for schemas, mandates, APIs, prompts/models, and customer configurations.

## Coverage passes

Run these after the first model:

1. **Journey pass** — every primary actor reaches success or a defined terminal state.
2. **State pass** — every important entity transition has an owner, guard, and recovery path.
3. **Decision pass** — every consequential decision has authority, evidence, policy, and audit.
4. **Data pass** — every captured field/event has purpose, lineage, access, retention, and consumer.
5. **Failure pass** — dependency, agent, user, network, and partial-write failures are contained.
6. **Boundary pass** — tenant, trust, service, and human/agent boundaries are enforced explicitly.
7. **Operations pass** — someone can detect, explain, support, restore, and improve the behavior.
8. **Evolution pass** — versions, migrations, rollout, rollback, and compatibility are addressed.
9. **Value pass** — the system still connects to a user and business outcome.

Do not claim “complete” merely because every heading has text. Report coverage confidence, the highest-risk unknowns, and what evidence would close them.

## Compact full-map output

When no existing artifact dictates a format, use this order:

1. **System thesis** — one paragraph explaining what the product is and how value flows.
2. **Evidence and assumptions** — only consequential items.
3. **Journey/capability map** — actor-to-outcome trace.
4. **Architecture and boundaries** — components plus ownership and interfaces.
5. **Mandate/data/agent model** — core governed execution loop.
6. **Risk and gap register** — prioritized by impact and uncertainty.
7. **Decisions** — recommend now, defer deliberately, or validate.
8. **Delivery slices** — independently verifiable outcomes and dependencies.

Prefer one canonical map with linked detail over several overlapping taxonomies.
