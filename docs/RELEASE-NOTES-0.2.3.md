# AI Pop Down Extension 0.2.3

## Changes

- Remove GI import version suffixes as requested during GNOME review, including the lazy Secret Service import.
- Simplify HTTP error handling and private-directory setup.
- Extract conversation deletion from the history chooser callback and remove unused preferences bookkeeping.
- Fix a late callback that could touch destroyed widgets when disabling during a conversation-deletion save.
- Clarify architecture and lifecycle documentation, correct outdated descriptions and shorten repetitive setup text.
- Add regression coverage for conversation deletion, shared attachments and cancellation during a pending save.

## Validation

- All 38 test groups/tests pass: 18 core groups, 16 web groups and four controller/transport regression tests.
- ESLint, syntax/import checks, strict schema validation, documentation links and package-content checks pass.
- The release ZIP passes integrity and checksum checks and contains schema XML without compiled schemas.
- Shexli reports **0 errors and 0 warnings**, with one **EGO-A-005 manual-review item** for the declared clipboard copy function. Copying text/code requires an explicit user action.

GJS and GNOME Shell are unavailable in the build environment. Native desktop checks remain documented in `docs/TESTING.md`.

## Install or update

Requires **GNOME Shell 51** and an existing Ollama server.

Download `ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip` and `SHA256SUMS` from the release assets. GitHub's automatic source archives are not installable extension packages.

```sh
sha256sum --check SHA256SUMS
gnome-extensions install --force ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip
```

Log out and back in to reload the JavaScript, then enable the extension:

```sh
gnome-extensions enable ai-pop-down-extension@edjenn1998.github.io
```
