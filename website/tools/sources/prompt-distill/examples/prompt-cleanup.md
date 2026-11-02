# Clean up a dictated prompt without changing the task

An agent-simulated example from a September 2026 behavior check. No file operation
was performed; this demonstrates prompt editing, not measured productivity.

## Input

Use $prompt-distill: move PNG files from this week to exports, actually copy them,
keep originals. 别把 this week 改成 last 7 days.

## Output

Copy this week’s PNG files to the exports folder, keeping the originals.
“This week” means the current calendar week, not the last 7 days; the time zone
and week boundary remain unspecified.

## What to inspect

- The corrected `copy` replaces `move`; original files remain.
- PNG and the destination survive unchanged.
- Calendar week is not silently replaced by a rolling interval.
- The skill returns a prompt. It does not carry out the embedded file operation.

If the user instead directly asks the agent to copy files, the agent should execute
that task under its normal workflow rather than insert a prompt-editing step.
