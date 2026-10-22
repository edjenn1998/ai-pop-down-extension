# Validation record — v0.1.0 preview

Date: 2026-10-22. Build environment: Linux, Node.js v22.22.1, ESLint v6.4.0, GLib schema compiler and Python 3 available. **No GJS, GNOME Shell, gnome-extensions CLI or isolated nested GNOME session was available.** No packages were installed, no active desktop extension was installed/enabled and no desktop session was restarted.

## Checks run

- `npm test`: 18 portable logic test groups passed. These cover NDJSON byte/UTF-8 splitting, malformed/error/final/cancel/size cases, URLs, connection identities, native request construction, image capabilities, thinking controls, context bounds, Markdown safety, history serialization/corruption/deletion/shared attachments and image header limits.
- `npm run lint`: passed (ESLint, runtime and test JavaScript).
- `glib-compile-schemas --strict --dry-run schemas`: passed.
- `python3 tools/check.py`: source syntax, Shell/preferences transitive import boundaries, headers, metadata/schema identity, local documentation links and verbatim GPL text checks.
- `python3 tools/package.py`: strict schema compilation, runtime-only ZIP build and exact-content/CRC/metadata checks. Used the standard ZIP fallback because the GNOME packaging CLI was absent.
- `unzip -t` / `unzip -l`: ZIP integrity and runtime content review.
- Repository source/staged diff reviewed for credentials, unrelated files and build artifacts before publication.

The parser was corrected after checking official GJS source: `TextDecoder` does not support the streaming option. Complete NDJSON **byte lines** are assembled before UTF-8 decoding; Node-specific streaming behavior is not assumed.

## Not run

- `gjs -m tests/run.js` and `gjs -m tests/gjs-storage.js`: GJS not installed. The latter tests real Gio permissions/atomic files, garbage collection and GdkPixbuf decoding/encoding, rather than only pure logic.
- Actual `gnome-extensions pack` and `gnome-extensions install`: CLI absent; standard ZIP format/root layout was audited but installation has not been exercised here.
- GNOME 51.1 enable/disable, streaming while closed, stop/restart races, portals, clipboard image transfers, preferences, selection/copy/focus, themes, scaling, monitor boundaries and lock/logout/reboot.
- Live local/LAN Ollama text/vision/cloud models. No requests were made to the owner’s existing Ollama or guessed LAN hosts.

See [TESTING.md](TESTING.md) for the owner’s reproducible desktop checklist. **Static checks are not evidence of correct GNOME runtime behavior.** The release is a prerelease for target-machine validation, not a fully tested stable release or a promise of GNOME website approval.

## Known limitations

- Region capture uses the v2-compatible interactive portal: the owner must select **Selection**, rather than a forced area target.
- PNG/JPEG inputs are transmitted as resized/re-encoded JPEG. PNG transparency is not retained.
- Drafts are session-only; saved chats are plaintext. Atomic cancellation can lose the most recent uncommitted streaming tokens. Normal disable attempts private temporary image cleanup; crash leftovers are collected on the next enable.
- Context bounds count characters/messages/images, not exact model tokens. The UI reports omitted messages; Ollama can impose its own smaller window.
- Server origins only: no proxy paths, URL credentials or API-key proxy authentication. No direct provider auth, tools, rich HTML/tables, syntax highlighting or automatic model/service management.

GitHub publishing requires the separate confirmation mandated by the owner’s local instructions; that confirmation was obtained before publication. No extensions.gnome.org submission is performed.

## Composer mouse-focus patch

The owner reported that Tab-focus allows typing and Ollama send/receive works, but clicking the input does not focus it. Source inspection against GNOME 51.1 found that St.Entry allocates a centered, natural-height Clutter.Text rather than filling the entry's padded/minimum-height surface. No extension pointer handler covered that extra area. PopupMenu's outside-click gesture rejects internal targets; its border/hint decorations do not cover the editor with a reactive overlay. Native Clutter.Text has its own click-positioning and selection gestures, which must not be replaced or consumed.

The patch observes primary-button presses within the entry, focuses its editable Clutter.Text and always propagates the event. This covers the surrounding visible surface while leaving native text positioning/selection in charge. Initial popup focus now runs only on a successful closed-to-open transition, after `super.open()` has mapped the popup and performed its initial navigation; the former open-state signal fired too early. Streaming/render/copy paths do not refocus the composer. No deferred focus callback is introduced.

The focused mouse/keyboard regression checks are listed in TESTING.md. This environment still lacks GJS/GNOME Shell, so this patch has source/static validation and a rebuilt ZIP, not a locally reproduced live-desktop result. The owner's reported send/receive success is user-provided evidence, not a test run here.

## v0.2.0 optional web search

Re-read the official GNOME extension review guidelines and Ollama hosted search/fetch documentation. Verified the fixed endpoints, bearer-key request schemas, response fields, absent publication-date metadata, libsecret's JavaScript async schema/password APIs, masked Adw.PasswordEntryRow, Gio async URI launching and Clutter gesture coexistence APIs. The existing v0.1.1 input/popup focus fix is retained.

`npm test` passed **18 existing + 14 new web-search test groups**. New tests exercise the actual portable retrieval scheduler and shared bounded-reader implementation, fixed search/fetch request construction, sanitized auth/rate handling, query/URL/source validation, concurrency/results/page limits, simulated timeouts/deadlines/cancellation, excerpt fallback, safe bounded source context, citation-ID mapping, source metadata history round trips and unchanged ordinary request construction. No real credentials or hosted service calls were used. GJS storage integration tests now also include source metadata round trips, but cannot be run here.

ESLint, strict schema dry-run/compilation, source syntax/import-boundary checks, metadata/documentation/license checks, whitespace checks and ZIP content/CRC audit are run for this release. No schema key stores search state or credentials. The ZIP uses the standard fallback because gnome-extensions is unavailable. The new source/reference/test documentation is excluded from the runtime ZIP; readable new runtime modules are included.

**Still unavailable here:** GJS, GNOME Shell 51, Secret Service/libsecret runtime credential operations, live credentialed Ollama search/fetch, desktop URI launching, source-click/selection behavior, native preference rendering and full disable/re-enable/focus/portal/history lifecycle. Real GLib timeout firing and Soup cancellation are not established by injected portable timeout/cancellation tests. Follow TESTING.md's web-search desktop section. Local/LAN answer generation success was reported by the owner for the previous version, not newly tested here. This remains an honestly scoped prerelease; website review is not implied.

## v0.2.1 compact sources and beginner README

Inspected the source rendering/history/controller paths. Retrieved page content is used only for transient model context, not an extension-generated visible evidence block. Replaced the always-visible source buttons with an initially collapsed per-answer native disclosure. Display formatting uses validated titles/domains; metadata remains unchanged in history. Expansion state is view-only and is reset when closing the popup/restoring rows. Scroll restoration uses GNOME 51's verified Stage `prepare-frame` signal with teardown cleanup, not a delayed focus or bottom-scroll action.

Validation for this release runs 18 existing + 16 web/source test groups, linting, schema dry-run/compilation, syntax/import-boundary/metadata/license/document-link checks, root README shell-block syntax and command-UUID checks, whitespace checks and ZIP content/CRC auditing. README commands/URLs were reviewed against actual controls, official GNOME tool source, Ollama docs, systemctl documentation and firewall documentation. No extension installation, Ollama service restart, firewall modification, model loading or credential setup command from the README was executed. Those setup paths are documentation review, not tested configurations.

This environment still lacks GJS/GNOME Shell/gnome-extensions. Actual collapsed/restored behavior, mouse/keyboard activation, accessibility announcements, source links, long-title layout, scaling/bounds and scroll/focus during streaming remain manual checks in TESTING.md. No runtime testing or screenshots are claimed. The runtime ZIP excludes README/docs/tests/development tools and uses the standard ZIP fallback with compiled schema.
