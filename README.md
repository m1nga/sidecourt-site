# SideCourt website deployment

Website source for sidecourt.space. CleanPause release assets are read at build time from a private source and verified by SHA-256. Installers are not committed here.

The product is available at https://sidecourt.space/cleanpause/.

Daycup, an offline coffee companion, is published from `website/daycup/` at https://sidecourt.space/drops/daycup/ (app at `/drops/daycup/app/`). Its source lives in the private `m1nga/daycup` repository; `scripts/publish_sidecourt.py` there refreshes `website/daycup/`.


## Canonical product and skill entry points

All public product discovery starts from https://sidecourt.space/tools/ and the TOOLS link on the SideCourt homepage. RedBot runs at /drops/redbot/app/ with its product page at /drops/redbot/ and testing at /drops/redbot/test/. Released skills each have /skills/<name>/, an installation command, a source guide and a /tools/packages/<name>.zip download. GitHub remains the code and install backend.

`website/tools/catalog.json` is the committed public catalog. `website/tools/sources/` and `website/tools/packages/` contain only released public material, bound to the catalog source commit. `website/tools_pages.py` adds the homepage entry and builds the catalog and skill pages. Update the source snapshot, package, catalog and checks together when adding a released skill. Private local skills and unfinished drafts are not release inputs.

`website/redbot/app/` is the clean hosted RedBot distribution; never copy a personal library, backup, cookies or connector tokens into it. Earlier GitHub Pages storage cannot move across origins automatically: its index is an export/migration bridge. Preserve that bridge when publishing RedBot source updates. The source/skill package remains in m1nga/redbot.

Builds preserve the existing platform, DayCup, CleanPause releases and client update endpoints. A new entry is not a publication of a user Work or permission to operate paused services. Verify the production deployment SHA separately from a documentation-only commit.

<!-- sidecourt-referral:start -->
## Explore SideCourt

This repository contains the website; the projects people share are on [SideCourt](https://sidecourt.space/drops/?utm_source=github&utm_medium=readme&utm_campaign=tools&utm_content=sidecourt-site). Browse them, try something that catches your attention, or bring a work of your own.
<!-- sidecourt-referral:end -->
