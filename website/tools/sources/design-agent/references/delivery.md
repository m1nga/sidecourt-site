# Delivery: make the promise match the operation

## Name the scope in the task record

A reference study produces observed relationships and usable design implications.
A brand direction produces visual examples and provisional/accepted rules.
A clickable prototype produces linked routes and clearly simulated interactions.
A working product must perform the actual requested operations with failure recovery.
These are different deliverables; a successful build does not make a prototype a product.

Track only relevant routes and states. For each primary action, identify its input,
actual effect, stored state if promised, user feedback, failure behavior and next step.
Avoid decorative data, invented testimonials, fake activity and unearned “confirmed”
states. Label design fixtures clearly; do not publish them as real participants.

If an operation opens an email draft, say so. It has not sent a message.
If submission only changes React state, label it a demonstration.
If data should persist, verify storage and a read after restart/reload, not just a toast.
If deployment succeeds, distinguish hosting from app behavior and access testing.

## Visual and interaction checks

Use the available environment's permitted checks. Where browser testing is unavailable
or restricted, report the visual/interaction gap explicitly; source inspection and HTTP
200 responses cannot prove rendering, accessibility, touch behavior or successful writes.

For implemented interfaces, check the behaviors relevant to the change:
- Real content and a long/empty/error state; image failure and slow media where relevant.
- Desktop and mobile composition; at narrow widths reflow display text and major actions.
- Focus, keyboard actions, tap targets, menus without hover, safe areas and form keyboard.
- Motion interruption and reduced-motion; background contrast through representative frames.
- The primary route's actual success and meaningful failure/retry, with read-back for writes.
- Reload/restart for a promised durable local result.

When user input changes the design, verify the affected paths again, not every unrelated
page. Screenshots support visual judgments; build/type checks support code claims.
Neither substitutes for the other.

## Durable handoff

Keep one authoritative implementation unless the user asks for an independent version.
A local static artifact can use a stable file entry if all required resources resolve.
An application can use a maintained launcher that starts the needed services, resolves
routine port conflicts and opens the same entry. Choose the technical method to fit the
experience; do not hand infrastructure decisions back to a user directing aesthetics.

Reopen through the promised entry outside the original development process before
claiming restart durability. State any online dependencies.

Update the task state and plan at material milestones. In the final handoff identify
the usable result and material limitations. Do not mark every requested item complete
because some pages exist. Do not create extra demos, branches or deployments to conceal
an unfinished primary flow.

A showcase recording is a separate optional artifact: demonstrate the strongest real
journey, use a representative first frame, and describe actual capabilities. No invented
reach, adoption or guarantee of reposts.

