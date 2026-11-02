# Task Execution Coordinator — Turn Intent into Verified Outcomes

Major Tom helps an agent carry a human request through existing owners to an observable result.
It keeps intent, rules, references, skills and learned experience distinct, so a reference example
does not silently become a command and completed activity does not masquerade as a useful outcome.

## What it does

- Routes clear work directly, unresolved choices into exploration, and dependent work into coordination.
- Finds metadata in explicit skill roots without reading every skill or installing new tools.
- Selects relevant evidence, preserves the original owner and checks exact handoff source bytes.
- Separates preparation, execution, independent verification and delayed business outcomes.
- Returns corrections and useful observations to the existing project record and optional memory.

It is an instruction skill with small Python tools, not a background dispatcher or permission system.

## Who it's for

Use it when a request spans existing owners, execution keeps drifting from the user's purpose,
or outcomes and dependencies need follow-through. A single clear local edit needs no packet or
coordinator. It works without Work Memory; authoritative project files remain the fallback.

## Install

```sh
npx skills add m1nga/major-tom
```

Then ask: `Use $major-tom to coordinate this approved task across its existing owners and verify the result.`
The bundled tools require Python 3.10+ and use the standard library. Replace SCRIPT_DIR with the
installed skill's scripts directory; run them from any current directory.

```sh
python3 SCRIPT_DIR/capabilities.py --root INSTALLED_SKILL_ROOT --query "memory recall"
python3 SCRIPT_DIR/validate_packet.py CASE_PACKET --registry OWNER_MAP --observation CURRENT_OWNER_STATUS
```

The packet validator never reserves, sends or grants authority. A real dispatch still requires
an authorized supported task tool and a fresh check of the original outcome and owner.

## Example

Request: “Compare two ways to help visitors understand this page, then implement the selected one.”
The executor first compares concrete directions using the same real content. The selected direction,
reason and scope stay in the project. If implementation needs another existing owner, Major Tom
passes the exact decision and acceptance evidence; it does not order every owner to redesign the
whole product. The actual resulting page is checked, and any unmeasured user impact remains unknown.

## Design notes

The design addresses interpretation drift and repeated administrative work. Inspiration from
layered memory and reference-led design is adapted into bounded evidence selection and concrete
comparisons. It does not install a new agent network or treat multi-agent count as a quality metric.
See [workflow integration](https://github.com/m1nga/skills/blob/main/major-tom/references/workflow.md).

Canonical maintained source: [m1nga/skills](https://github.com/m1nga/skills/tree/main/major-tom).
The initial implementation was recovered from the published
[m1nga/skill-builder source](https://github.com/m1nga/skill-builder/tree/8926217d18fb4a3ef19dcee770d283210e942064/skills/major-tom).
Related optional capability: [Work Memory](https://github.com/m1nga/work-memory).

## Validation

17 isolated Python tests passed, covering packet provenance, original owner, source freshness,
no-resend state, metadata discovery, missing roots, aliases and conflicting skill versions.
Routing and new-user cases were also walked through as author simulations, not independent live
user research. These checks do not prove host auto-selection, remote delivery or improved outcomes.

```sh
python3 -B -m unittest discover -s skills/major-tom/scripts -p 'test_*.py'
```

## Author

Built and maintained by [Ming](https://github.com/m1nga).
