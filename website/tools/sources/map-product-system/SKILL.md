---
name: map-product-system
description: "Map a product's user journeys, capabilities, data, responsibilities, and missing paths at the scope requested: one feature, one flow, or the whole system. Use for system structure or architecture changes, before adding a feature that touches several parts, or when the user says 画一下产品结构 / 系统地图 / 用户旅程 / 这个功能缺什么路径 / 谁负责哪块 / 架构怎么改. Output names journeys, capabilities, owners, gaps, and buildable slices. Not for experiencing a product as a new user (product-experience-officer), not for organizing task files (taskdock), not for a repair-or-rebuild verdict (diagnose-project-rebuild), not for runtime automation loops."
---

# Map Product System

Build a shared model of how the product works from user intent to system outcome. Accept raw, conversational, dictated, messy, or mixed-language explanations directly; do not require an optimized prompt first. Respond in the user's language.

## Operating principles

- Preserve the product intent before adding structure.
- Distinguish **Known**, **Inferred**, **Proposed**, and **Unknown**. Never present an invention as an existing fact.
- Do not fill **Known** claims from model memory. A fact recalled from training data rather than observed in the user's sources is at best **Inferred**.
- Seek traceability, not a long feature wishlist. A system is well mapped when journeys, capabilities, decisions, data, actors, states, and failure handling connect end to end.
- Separate product-wide foundations from tenant-specific behavior.
- Make consequential design recommendations. Explain the tradeoff briefly instead of hiding behind an unranked option list.
- Match depth to the request. Do not force a full architecture report onto a narrow question.
- Run broad coverage checks internally; expose only the structure, gaps, and evidence that affect the user's decision unless an exhaustive artifact is requested.

## Choose the job

1. **Discover** — turn an early or incomplete idea into the first coherent system model.
2. **Audit** — inspect existing code, documents, diagrams, or behavior and identify gaps, contradictions, and accidental architecture.
3. **Evolve** — place a new feature or mandate into the existing model and trace its downstream effects.

When sources exist, inspect them before proposing structure. Treat repository behavior and current documents as evidence, not automatically as correct product intent.

## Build the model

### 1. Establish the product spine

Identify the product outcome, actors, jobs to be done, entry points, successful end states, business boundary, and important non-goals. Infer non-blocking gaps and label them. Ask only when different answers would materially change the foundation.

### 2. Map outside-in

Trace each important actor through discovery, onboarding, configuration, normal use, review or approval, exception handling, and ongoing operation. Derive capabilities from these journeys instead of starting with internal components.

For each important capability, trace:

`trigger → inputs → decision/policy → action → output → state change → downstream consumer → failure/recovery → observability`

### 3. Map inside-out

Connect the capabilities to product surfaces, domain logic, mandate/policy resolution, orchestration, agents and services, integrations, data stores, analytics, security, and operations. Make ownership and boundaries explicit.

For whole-product, mandate, data, multi-agent, or completeness work, read [references/coverage-model.md](references/coverage-model.md) and use only the relevant lenses.

### 4. Separate mechanisms and policy when relevant

For ordinary products, distinguish code, configuration, and data. Read
[references/policy-layers.md](references/policy-layers.md) only when customer-specific
or governed decisions require explicit platform/customer/runtime authority.

### 5. Design responsibility, not an agent collection

Introduce an agent only where independent context, tools, authority, evaluation, scaling, or failure isolation justify it. Otherwise use deterministic code, a service, a workflow step, or a human decision.

Give every agent/service/human role a contract: purpose, trigger, inputs, allowed data and tools, decision authority, outputs, state, handoffs, timeout/failure behavior, evaluation, and owner. Flag circular handoffs, duplicated authority, hidden shared state, and unowned outcomes.

### 6. Challenge completeness

Select coverage checks relevant to the product and requested change:

- Trace every primary journey to capabilities and system owners.
- Trace every important decision to mandate authority, evidence, and auditability.
- Trace captured data to consent, lineage, retention, consumers, analysis, and deletion.
- Trace happy paths, recoverable failures, unrecoverable failures, and human escalation.
- Check tenant isolation, permissions, observability, versioning, rollback, cost, and operational ownership.
- Separate launch requirements from later extensibility; do not disguise speculation as MVP scope.

## Deliver the result

Lead with the clearest current model and the most consequential decision. Use the smallest useful mix of prose, tables, diagrams, and lists.

For a full-system request, include the relevant parts below; omit layers the product does not have:

1. Product spine and scope.
2. End-to-end journey and capability map.
3. System layers and key boundaries.
4. Mandate and data architecture.
5. Agent/service/human operating model.
6. Critical cross-cutting requirements and failure paths.
7. Decisions, assumptions, unknowns, and contradictions.
8. Sequenced delivery slices and independently assignable work packages.

Each work package should name its outcome, dependencies, owner type, interfaces affected, acceptance evidence, and decisions still required. Do not spawn agents merely because the architecture names them; delegate only when the user asks for execution or agent work.

When maintaining a living architecture artifact, update the existing source of truth instead of producing a competing document. Preserve decision history and show what changed. Keep the artifact in the user's project, not inside this skill package; if no file can be written, output the full artifact as copyable text.

## Final check

Before finishing, verify that the result:

1. Answers how the product creates value, not only how components connect.
2. Separates current evidence from recommendations.
3. Makes every critical journey and decision traceable end to end.
4. Exposes meaningful gaps rather than claiming impossible certainty.
5. Ends with decisions or executable next work, not architecture theater.
