# SideCourt website deployment

Website source for sidecourt.space. CleanPause release assets are read at build time from a private source and verified by SHA-256. Installers are not committed here.

The product is available at https://sidecourt.space/cleanpause/.

Daycup, an offline coffee companion, is published from `website/daycup/` at https://sidecourt.space/drops/daycup/ (app at `/drops/daycup/app/`). Its source lives in the private `m1nga/daycup` repository; `scripts/publish_sidecourt.py` there refreshes `website/daycup/`.
