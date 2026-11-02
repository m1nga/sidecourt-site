# Visual methods: reference, asset, motion, revision

Read the relevant portions for the current task. These are methods to choose from,
not a mandatory cinematic style or a fixed production sequence.

## Reference notes that change the design

For each useful reference, record source, inspected surface, the user's reaction,
your observation, intended borrowing scope, and status (observed / proposed / accepted).
A still image says nothing reliable about timing. A screen recording may show a
transition, but not the implementation that produced it.

Study the relationships before collecting more images:
- What gets attention first, and what yields?
- Where can real text fit? How does its length affect the composition?
- What holds the page together through scrolling or state changes?
- What changes on a phone instead of merely shrinking?
- Which detail can be transferred without importing the reference's brand or content?

Pick resources by job, then verify availability and usage terms when acting:
- Pinterest: discovery and source tracing; a found image is not automatically a licensed asset.
- MotionSites: study prompt structure and motion references; verify access, asset rights
  and hosting before using a copied media URL in production.
- Higgsfield or an available image/video generator: generate original assets with explicit
  composition and motion constraints; current model names, settings and credits need checking.
- Figma or an available design surface: visual comparison, sampling, layout and brand examples.
- Local code and browser tools: responsive behavior, media integration, state transitions.
- Screen recording tools: demonstrate a completed flow when requested. Distribution
  and social posting are separate actions, not implied by making a website.

Do not force every project through these services. A useful supplied image or working
component can eliminate an entire generation step.

## Asset brief before generation

Design the asset for its intended layout, not as a standalone impressive picture.
Specify subject, composition, negative space, crop tolerance, palette relationship,
lighting/material, target aspect ratios, permitted motion, and prohibited camera changes.
Generate clean assets; render page copy and controls in HTML rather than baking them in.
Use a separate mobile crop when needed, not an automatic destructive center crop.

Example image prompt, adapt to the actual subject:

> Create an original image of [subject] for [placement]. Position it in [region].
> Reserve [region] for live text. Preserve [important silhouette] in desktop and
> mobile crops. Use [material and palette]. No text or interface elements.

Example motion prompt:

> Animate only [subject behavior] with [tempo]. Keep the camera, subject scale and
> anchor position stable. Preserve the negative space for text. Start and end in
> compatible states for a loop. Do not add cuts or unrequested elements.

Record the actual prompt/settings/output and whether it was generated, only prepared,
or failed. Reuse validated assets across related pages where composition supports it.
Never promise an unavailable model or claim a tutorial's credit price still applies.

## Integrate media without seams

Choose the text location and contrast against multiple frames and both crops.
A no-overlay instruction means solve contrast through framing, asset treatment where
authorized, type placement or neighboring surfaces; if still unreadable, show the
conflict rather than silently adding an overlay.

To match a media edge to a CSS surface, sample the relevant edge across representative
frames. Blurring a screenshot can suggest a base color, but a whole-image average may
not match its edges, temporal variation, video encoding or color profile. Verify the
rendered seam. A transparent-to-solid transition can bridge sections if appropriate.

Reserve dimensions, provide a poster/static state, load core copy first, and keep
autoplay media muted and inline where applicable. Handle loading failure. Avoid
shipping temporary CDN URLs without checking intended use and stability.

## Motion carries a relationship

Define trigger → change → settle, with interruption and reduced-motion behavior.
Examples: a control changes color after interaction, a passed item leaves a trace,
or a subject remains while the surrounding content changes. Decorative endless motion
needs a specific reason and a way to keep the experience usable.

For scroll-driven video, define start/end positions and map clamped progress to duration.
Wait for metadata, avoid piling up seeks, and stop scheduling work when offscreen or
reduced motion is enabled. Keyframe spacing and decoding can limit smooth seeking;
measure on the target browser before choosing re-encoding or a static fallback.
Do not cargo-cult fixed interpolation factors, viewport multipliers or encoder flags
from a tutorial. A pinned background must have a defined release point.

## Turn “AI-looking” into an edit

Look for actual symptoms, not a banned aesthetic:
repeated section silhouettes; cards where plain content would be clearer; borders
without a grouping role; tiny unexplained labels; a large empty area; harsh transitions;
bright media under text; unnecessary italic emphasis; identical motion on every block.

Use a short edit brief:

> At [route / viewport / state], [observable problem] makes [user goal] harder.
> Keep [valuable relationship]. Change [bounded variables].
> Success means [visible or interactive check]. Verify the paired mobile/desktop state.

When several variables interact, fix them as a coherent unit instead of forcing one
property per turn. Compare the result at the same scroll position and content length.
The aim is a site with a reason for its choices, not a new template called “less AI.”

