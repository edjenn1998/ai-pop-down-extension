# AI Pop Down Extension v0.2.0 — optional web search preview

- Adds an off-by-default **Search Web** composer toggle and compact editable query override (max 1,000 characters). It resets for new/opened conversations and is snapshotted on Send.
- Explicit search-before-answer workflow uses Ollama's hosted HTTPS search/fetch APIs, then streams answers through the existing selected local/LAN Ollama connection/model. No model tool-calling support is needed.
- Search queries alone go to search; selected page URLs go to fetch. Conversation history and image/screenshot attachments are not uploaded to those services. Local inference does not make search local.
- Preferences provide a masked API-key entry, official setup link, Save / Replace, Remove and explicit Test Search. Credentials use asynchronous libsecret/Secret Service only, separate from Ollama server authentication. Ordinary chat needs no search credential.
- Retrieval is bounded: five results, three pages, two concurrent fetches, 15 seconds per request, 45 seconds overall, 256/512 KiB response read limits. Evidence is capped at 12,000 characters inside the existing 24,000-character total context budget. No automatic retries.
- Page failures retain excerpts with a coverage notice. Search failures offer explicit Retry or Answer without web search, reusing the same user turn without duplicate messages.
- Source IDs, explicit-click HTTP/HTTPS links, independent Sources sections and compact saved source metadata. Retrieved material is untrusted evidence; page instructions are ignored, no returned code/tools are executed, and citations do not guarantee correctness. No publication dates are invented when absent from the documented API.
- Preserves the v0.1.1 composer mouse-focus and popup-open focus fix.

## Install and try

Download **ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip**, not the source archive. For an owner-approved update, use `gnome-extensions install --force /path/to/zip`; log out/in if the old module remains loaded.

Open Preferences → Web Search → API-key setup, obtain an Ollama key, enter it in the masked field, Save / Replace, then Test Search. Check current provider account requirements, limits and potential costs. Choose a model, enable Search Web, and ask “What is the latest stable GNOME release as of today? Cite official sources.” Inspect the actual Sources links. Use the query override for ambiguous follow-ups.

## Validation and outstanding desktop checks

Passed **18 existing + 14 new portable test groups**, ESLint, strict schema validation/compilation, source syntax/import-boundary checks, metadata/documentation/license checks, whitespace checks and ZIP runtime-content/CRC audit. Tests cover request schemas/auth handling, byte/concurrency limits, simulated deadline/cancellation/error behavior, safe bounded evidence, source mapping/history and unchanged ordinary request construction.

The environment has **no GJS, GNOME Shell or gnome-extensions CLI**. The standard ZIP fallback was used. No live Secret Service, hosted credentialed search/fetch, GNOME focus/selection, browser launching or full desktop lifecycle testing was possible here. Those remain manual target-machine checks in docs/TESTING.md. No packages or separate services were installed, and no extensions.gnome.org submission is performed. This is a prerelease, not a fully desktop-tested stable release.
