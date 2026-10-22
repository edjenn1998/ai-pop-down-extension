# AI Pop Down Extension v0.2.1 — compact sources and setup guide

- Replaces the always-expanded source list with a compact **Sources (N) ▸** disclosure beneath each researched answer. Click, Enter or Space expands/collapses that answer's sources. The answer remains fully visible.
- Sources start collapsed, including after closing/reopening the popup and restoring history. Expansion is view-only state, not saved metadata.
- Uses native St buttons/symbolic disclosure arrows and ATK expandable/expanded states. Source links show compact wrapped titles and domains, with original numbering and URL validation. Raw URL paths, excerpts and downloaded evidence are not displayed in the list. Coverage/citation notices are available in the disclosure tooltip; search-failure/fallback notices without sources remain visible.
- Keeps inline citations opening validated source URLs on explicit click. They do not expand other answers. Source changes pause streaming auto-follow and preserve the viewport through allocation, subject to natural bounds clamping when content shrinks. Hiding a focused source returns focus to its disclosure, never the composer.
- Rewrites the root GitHub README for first-time users: installation, local/remote Ollama, LAN address selection, systemd overrides, trusted-subnet firewall examples, model/image controls, search key setup, troubleshooting, privacy/history, updating and uninstalling.

## Download and update

Use **ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip**, attached with SHA256SUMS. GitHub's source-code archives are not the installable extension. On the GNOME client, run `gnome-extensions install --force /path/to/the/zip`, then save work and log out/in on Wayland to load the updated code.

## Validation

Passed the 18 existing logic groups and 16 web/source groups with development-only Node.js, ESLint, strict schema validation/compilation, source/import/metadata/license/document-link checks, README shell-block syntax/UUID checks, whitespace checks and runtime ZIP content/CRC audit. No server, firewall, keyring or desktop configuration commands from the README were executed; commands and URLs were reviewed against implementation and official documentation. The installer CLI was unavailable, so the standard ZIP fallback was used.

**Live GNOME 51/GJS testing is unavailable here.** Actual disclosure mouse/keyboard operation, accessible state announcements, long-title wrapping, source links, scaling/monitor boundaries and focus/scroll stability during streaming still need the owner’s desktop checklist in docs/TESTING.md. No screenshots or runtime results were fabricated. Existing chat/search operation was reported by the owner; the new UI behavior is not claimed desktop-tested. No existing release assets are overwritten and no extensions.gnome.org submission is performed.
