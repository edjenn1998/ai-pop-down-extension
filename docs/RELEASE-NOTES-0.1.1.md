# AI Pop Down Extension v0.1.1 — composer focus fix

Fixes mouse focus across the composer's visible entry area, including its padding. Primary-button presses focus the editable Clutter.Text and propagate normally so native cursor positioning and text-selection gestures remain in control.

Initial composer focus now runs after the popup finishes its synchronous open/setup path, rather than in the earlier open-state signal. Focus is requested only when the dropdown actually opens, not during streaming or copying messages. No deferred focus callback is used.

The owner reported that sending/receiving Ollama messages works and Tab-focus allows typing in v0.1.0. This patch addresses the reported mouse-focus issue; live verification of the patch is still required on the owner's GNOME 51 desktop.

## Install

Download **ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip**, not a GitHub source archive. For an existing installation:

```sh
gnome-extensions install --force /path/to/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip
```

Log out and back in to load the updated code if GNOME still has the previous extension module loaded. The release includes SHA256SUMS.

## Validation

- All 18 existing portable logic test groups passed with development-only Node.js.
- ESLint, strict schema validation/compilation, syntax/import-boundary checks, metadata/documentation/license checks and whitespace checks passed.
- Installable ZIP rebuilt; exact runtime contents and CRC integrity checked.
- GNOME 51.1 official St.Entry, PopupMenu and Clutter.Text source and the Actor::captured-event API were checked.

GJS, GNOME Shell and the gnome-extensions CLI were unavailable in the build environment. The standard ZIP fallback was used. Mouse placement/selection, initial-open focus, keyboard navigation and focus while selecting/copying during streaming still require desktop testing; static checks do not prove that behavior. See docs/TESTING.md and docs/VALIDATION.md. This remains a prerelease; no extensions.gnome.org submission is performed.
