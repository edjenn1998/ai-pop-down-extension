# AI Pop Down Extension v0.1.0 — preview

Native GNOME 51 top-bar Ollama chat, with a theme-inheriting dropdown, streaming responses, multiline composer, connection/model selection, safe basic Markdown and explicit answer/code copy. Includes local/LAN server profiles and Test Connection preferences, optional popup shortcut, image file/clipboard/capture attachments, retained multimodal history and confirmed deletion/destination changes.

Install **ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip** using `gnome-extensions install`. No companion service or separate application runtime is needed. Existing Ollama and the GNOME desktop libraries/portal must be available.

## Validation and limitations

The build environment did **not** have GJS, GNOME Shell or gnome-extensions. Pure logic tests were run with development-only Node.js; ESLint, strict schema validation and ZIP contents/integrity checks were also run. The standard ZIP fallback was used. These are not proof of runtime functionality. GJS storage/image integration tests and all live GNOME 51.1 tests remain for the owner. No screenshots have been fabricated. See docs/VALIDATION.md for the precise record.

Screenshot capture uses the interactive desktop portal; choose **Selection** for a region. PNG/JPEG sources are bounded and transmitted as resized JPEG (no transparency). History is local **unencrypted plaintext**; temporary prepared draft images can remain until the next enable/cleanup. Unsent drafts are session-only. Disabling/crashing may lose the last uncommitted streaming tokens. Context is bounded and omission disclosed; this is not model-specific token accounting. Server origins only; no URL subpaths, embedded credentials, API-key proxy auth or direct provider integrations. Separate thinking is discarded, and model code/tools/links are never executed.

Cloud models routed through Ollama may transmit text/images beyond the configured server. Ordinary LAN HTTP is not encrypted. Clipboard access only follows explicit paste/copy actions (plus normal native text editing). GNOME website submission has not been performed; approval is not implied.
