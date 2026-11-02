# Policy layers for governed products


When the product makes governed or customer-specific decisions, classify behavior deliberately:

- **Code** — stable mechanisms, invariants, validation, enforcement, and execution primitives.
- **Platform mandate** — versioned product-wide authority, prohibitions, safety rules, and governance applied to every customer.
- **Customer mandate** — versioned customer objectives, domain rules, permissions, preferences, thresholds, and escalation paths, constrained by the platform mandate.
- **Runtime mandate** — the resolved, auditable policy snapshot for one execution, including identities, versions, data scope, tools, approvals, and limits.
- **Configuration** — operational choices that may change without redefining authority or product meaning.
- **Data** — observed facts and events; never use mutable data as an implicit policy source without an explicit resolution rule.

Prefer a resolution pipeline over scattered customer conditionals:

`platform mandate + customer mandate + runtime context → validate/resolve → runtime mandate → execution + audit record`

For products without governed or customer-specific decisions, separating code, configuration, and data is sufficient; do not force the mandate layers onto a product that has none.
