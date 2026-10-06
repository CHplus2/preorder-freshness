# Mobile help placement

6 October 2026. Synthetic local owner basket; temporary SQLite only.

Moved the help component into the footer. At widths up to 600 px the launcher participates in footer layout rather than covering basket/checkout actions. Desktop retains its fixed launcher. The mobile open panel has explicit side insets and border-box sizing.

Verified at 390 × 844:
- Populated basket checkout button unobstructed; no horizontal document overflow.
- Launcher computed position static, below the basket.
- Help opens; final panel bounds left 16, right 359.2, top 118.4, bottom 828 within the viewport.
- Help closes and desktop reset restores fixed launcher positioning.
- Disposable basket item removed after testing.

Lint and build passed; build repeated after panel-bound correction. Final reload on port 8023 produced a blank tab; final layout verified using a fresh isolated server on port 8024 instead. No production verification. Screenshots: basket.png and help.png. This is targeted mobile verification, not a comprehensive device/browser audit.
