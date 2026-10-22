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
