# Research informing Major Tom

Inspected on 2026-10-25: the current README of each of these ten GitHub repositories, through the connected GitHub reader. This is a focused design comparison, not an implementation audit, security certification or installation recommendation. Patterns below are our design choices inferred from their descriptions. No third-party code or skills were copied.

| Repository | Relevant documented pattern | Adopted decision / boundary |
|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | Dynamic, self-contained skill folders | Keep a small entrypoint and load only relevant references; do not copy third-party skill implementations. |
| [openai/plugins](https://github.com/openai/plugins) | Skills packaged alongside optional tools and other plugin surfaces | Separate reusable instructions from runtime tools. No plugin or new MCP installation is required here. |
| [obra/superpowers](https://github.com/obra/superpowers) | Composable skills, plans, task reviews and behavior evaluation | Make handoffs concrete and validate behavior. Do not import its blanket pre-design approval or coding-only ceremony. |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | Agents as tools, handoffs, sessions, guardrails and tracing | Keep a supervisor accountable for scoped handoffs and results; use the host's existing task tools instead of installing an SDK. |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Durable execution, persisted state, interrupts and memory | Reserve before side effects and resume from original state; a fresh trigger does not justify replay. |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework) | Sequential, concurrent and handoff workflows, checkpointing and observability | Keep ownership and workflow state explicit. Do not add a runtime to an already operating host. |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Role-based Crews and event-driven Flows | Separate role judgment from deterministic orchestration. A role description alone is not execution evidence. |
| [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | Planning, filesystem context, on-demand skills and isolated subagent context | Use small purpose-specific context packets; do not inherit an entire archive. Existing project delegation limits still apply. |
| [letta-ai/letta-code](https://github.com/letta-ai/letta-code) | Stateful memory, skill learning and versioned context | Retain scoped experience and change history. Reject autonomous rewriting of user objectives or protected authority. |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | User/session/agent memory and temporal retrieval | Retrieve relevant dated evidence. Do not treat agent-generated statements as equal to independently verified actions, adopt benchmark claims, or sign up for services. |

Version awareness: initial reads found `openai/skills` deprecated in favor of `openai/plugins`, `microsoft/autogen` archived in favor of `microsoft/agent-framework`, and `letta-ai/letta` directing current source work to `letta-ai/letta-code`. The ten entries above use those current destinations.

A search for “workbody” did not establish one unambiguous authoritative orchestration project matching the user's analogy; no such dependency or compatibility is claimed. The selected design is a portable Agent Skill using existing host capabilities, with private project bindings kept outside its published package.

The public skill has no fixed business goal, account identity, chat ID, platform scope, timer or private document content. Those belong to the adopting project's mandate. In particular, an idea library can inform a choice without becoming a required publication backlog.

