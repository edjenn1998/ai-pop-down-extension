# GNOME submission checklist

Do not upload automatically. The owner should:

1. Read the [current official review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) again; rules can change.
2. Understand the [maintainer walkthrough](MAINTAINER.md), including clipboard, byte parser, images, storage and teardown decisions. AI assistance is not automatic acceptability or approval.
3. Run the GJS integration tests and the GNOME 51.1 manual checklist. Fix exceptions, focus/layout issues, cancellation races and portal integration before submission. Record actual results honestly.
4. Confirm UUID `ai-pop-down-extension@edjenn1998.github.io`, name, public repository URL, GPL-3.0-or-later, `shell-version: ["51"]`, schema namespace/path and clipboard access declaration. Do not add website-managed `version` or unnecessary `session-modes`.
5. Build, inspect and checksum the **extension ZIP**. Include readable runtime source, icon, stylesheet, preferences, schema XML/compiled schema and licenses only. Do not upload source archives, tests, docs, screenshots, tools, caches or package/development dependencies as runtime files.
6. Check source for secrets and excessive/content-bearing logging. Confirm no Gtk/Gdk/Adw in Shell import graph and no Shell libraries in preferences graph; no subprocesses, eval, telemetry, executable downloads or automatic Ollama/model management.
7. Install and test the exact ZIP that will be submitted. Capture genuine screenshots with benign content only if desired for the website listing.
8. Owner manually uploads the ZIP to extensions.gnome.org, describes local/LAN Ollama requirements and clipboard actions, and responds to reviewer questions. No compatibility beyond tested GNOME releases should be claimed.

Website review is independent of GitHub releases and is not guaranteed. Keep the first GitHub release a prerelease until the owner’s runtime validation is complete.
