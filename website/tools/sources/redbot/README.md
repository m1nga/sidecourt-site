# RedBot — Turn Saved Links into a Useful Next Action

You saved something useful. When you finally need it, you still cannot decide which item to open or which part matters. RedBot connects a current goal to **one supported starting point**, the useful saved passage and a next action.

**[Open the mobile web beta](https://sidecourt.space/drops/redbot/app/) · [Product and privacy guide](https://sidecourt.space/drops/redbot/) · [Five-minute user test](https://sidecourt.space/drops/redbot/test/)**

## Who it's for

People who save useful links and notes but struggle to choose what to use when a real task arises. Ordinary testers use the mobile webpage; AI-assistant users can install the companion skill.

## Moving from the earlier GitHub Pages beta

RedBot now runs at SideCourt. Browser storage belongs to its original website, so it does not move automatically. The old GitHub Pages address offers an export of its existing browser library. Download that backup, open RedBot through SideCourt, and import it in Library & backups. Keep the original until the imported saves, notes and plan are confirmed. Nothing is uploaded by the migration page.

## Start without connecting an account

1. Open the beta in a current phone or desktop browser. It includes clearly labeled original examples.
2. Try a goal, or choose **Add save** and paste a link/share text. Add a title and a useful passage or personal note so there is content to find later.
3. Describe what you need. RedBot asks one clarification when the outcome is ambiguous, then offers one source and a concrete action.
4. Optionally choose **Enable AI search**. The first opt-in downloads a multilingual model and runtime; inference happens on your device. No new AI API key is needed.
5. **Keep this plan** to resume after a return. **Library & backups** exports or imports your library.

No Xiaohongshu sign-in, cookies, terminal, server installation or RedBot account is required for the public web beta. Pasting a link stores a reference; it does **not** fetch private posts, watch a video or copy all account favorites. Title-only matches say **Needs reading**. Add text/notes, import a compatible backup, or open the original yourself.

## What it does

| Need | Current behavior |
|---|---|
| Too many saves to choose from | Goal-first routing, a necessary clarification, one starting point |
| Cannot remember the exact words | Opt-in multilingual on-device embeddings compare meaning in saved text |
| Do not know which part to read | Existing passage or research note/time anchor, with its original source |
| Reading never turns into doing | One next action; imported guides can supply editable implementation instructions |
| Have to start over next visit | A saved plan, notes, read state, favorites, archive and recoverable trash |
| Want AI-assistant help | A portable RedBot skill reads a backup or the explicitly selected local Mac library |

The built-in text search remains available without the AI download. AI searches up to 300 current saves and methods, uses a similarity threshold, and can miss or misrank results. It retrieves text; it does not generate answers, watch original videos or verify the truth of sources. Broad goals still need clarification. Review the evidence before acting.

## AI and privacy

The web beta uses Transformers.js 3.8.1 and `Xenova/paraphrase-multilingual-MiniLM-L12-v2` at revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`. A first download is roughly 120 MB plus runtime; Wi-Fi is recommended. Hugging Face and jsDelivr receive normal asset requests such as IP/browser information. Saved text is processed locally, not sent to an inference API. An old or memory-constrained phone may fail to load the model; basic matching remains usable.

Libraries are stored in this browser's IndexedDB with a local-storage recovery fallback. There is no cloud account or automatic phone/desktop sync. Clearing browser storage can remove your library: export a backup first. Model assets and the app shell may be cached separately. Service-worker offline behavior and installation vary by browser. The standalone HTML uses basic matching; use the HTTPS beta for worker-based AI.

An assistant running the skill reads the file or local library you authorize. Its provider and privacy settings are separate from the browser beta. Do not send private backups in public GitHub issues. Feedback downloads contain only the test answers you enter; share them deliberately.

## Install

```sh
npx skills add m1nga/redbot
```

Then ask your AI assistant:

```text
Use $redbot with /path/to/my-redbot-backup.json.
My goal is to make the first task in my app easier to understand.
Choose one saved source, show the useful passage and give one next action.
```

The skill bundles a read-only Python standard-library helper. It first returns a bounded shortlist, then the assistant reads selected source material and reasons about the user's need. This helper is lexical; the host assistant supplies reasoning. The web embedding model and the skill are separate access paths to the same backup format, not an automatic synchronization service.

For the running local Mac app only:

```sh
python3 /path/to/installed/redbot/scripts/read_library.py --live --query "first task"
```

The Mac's optional existing Xiaohongshu connector is not included in the public beta. Connecting an account is not required to test the public product.

## Example: indirect wording to useful evidence

Input: “The screen feels busy; I need the main action to be obvious.”

A supported result can select the original layout example, point to its observation about competing headings and controls, and suggest changing one section's emphasis before comparing the same viewport. This is illustrative guidance, not evidence of improved conversion or a recruited user's outcome. If only a saved title is available, RedBot asks for reading instead of inventing that observation.

## What is not included yet

- Automatic reading/transcription of every linked post or video.
- Automatic Xiaohongshu account import in the public beta.
- Cloud synchronization, shared libraries or production account management.
- General web search, generative chat, automatic content publishing or paid video generation.
- Proven usability on every phone, validated market demand, sales or guaranteed search rankings.

Personal research packs can contain web-design, product-design, shared-method and product-promotion guides (SEO, AI-answer visibility, positioning and video workflows). The public example is deliberately small and original; it does not include the developer's personal collection or third-party videos.

## Why

The product started from a concrete failure: organizing a collection still left its owner unsure what to read at the moment of need. RedBot therefore starts with an outcome and reduces the next choice. It keeps source evidence close to the action and leaves unsupported content visibly unread. A mobile browser offers a low-setup test before a separate native app or cloud service is justified.

## Validation

Checks and observed browser scenarios are recorded in [BETA-VALIDATION.md](BETA-VALIDATION.md). Automated checks, builder-operated browser tests, instruction simulations and independent user studies are different evidence. This beta has no recruited-user effectiveness or customer-acquisition proof.

## Search visibility

The public product page contains crawlable descriptions, real setup steps, limitations, authorship, canonical metadata and matching SoftwareApplication data. Its sitemap lists the app and guides. These make the product understandable to people and retrieval systems; they do not prove indexing or AI recommendations. [Google's AI-feature documentation](https://developers.google.com/search/docs/appearance/ai-features) says its ordinary SEO practices still apply without special AI requirements. GitHub controls crawler policy on github.io; this repository cannot override host-level robots policy.

## Author

Built by [Ming](https://github.com/m1nga). Application and original skill source are MIT licensed. Transformers.js and the embedding model retain their own upstream licenses and notices. Third-party saved content belongs to its creators.
