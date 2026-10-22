# AI Pop Down Extension

A native GNOME Shell chat dropdown for **Ollama**. Click the symbolic chat icon in the top bar to talk to a model without opening a browser or another application.

**Initial target: GNOME Shell 51**, particularly CachyOS GNOME 51.1 / Wayland on the Dell XPS 13. This is a **0.2.0 preview**: the build environment had no GNOME Shell or GJS, so desktop operation has not yet been validated here. See [validation](docs/VALIDATION.md) and the [manual test checklist](docs/TESTING.md) before everyday use or GNOME submission. No screenshots are included because none were genuinely captured.

## Install

Requirements are an existing GNOME 51 desktop with GJS, Soup 3, GdkPixbuf 2, GTK4/libadwaita preferences, and the desktop portal with its GNOME backend. Optional web search uses the desktop's libsecret/Secret Service support and an unlocked login keyring. If that support is unavailable, search shows an error and ordinary chat still works. Ollama must already be reachable on your computer or trusted LAN. The extension does not install, configure, run or download Ollama or models.

Download the **installable extension ZIP**, not GitHub’s “Source code” archive:

```sh
gnome-extensions install /path/to/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip
```

On the first install, log out and back in if GNOME does not discover it immediately. Enable it in Extensions or explicitly:

```sh
gnome-extensions enable ai-pop-down-extension@edjenn1998.github.io
gnome-extensions prefs ai-pop-down-extension@edjenn1998.github.io
```

No separate service, helper script, Node runtime, Python runtime, root access or package installation is needed by the extension. Build/test tools are development-only.

## Use

1. Click the top-bar chat icon. The default connection is **This Computer**, `http://localhost:11434`.
2. Choose an available model, preserving its exact name/tag. Refresh retries discovery.
3. Type a message. **Enter sends**, **Shift+Enter inserts a newline**. Escape or clicking outside closes the popup. An optional popup shortcut is initially unassigned.
4. Use **Attach image**, **Paste image**, or **Capture screen region**. For capture, choose **Selection** in GNOME’s interactive screenshot dialog, drag your region, and capture it. The popup is hidden during capture. Successful capture reopens the draft; nothing is sent automatically. Cancel leaves your draft intact.
5. Check image thumbnails and the server/model below the composer, then Send. Remove an attachment with its close button. Image-only messages are allowed.
6. **Stop** cancels the client request and retains the partial answer. Wait for cancellation to settle before starting another request. The server may take a little longer to notice cancellation.
7. New Chat starts a fresh context. History lists local titles and dates, with per-chat delete buttons and a confirmed **Delete all history** action.

The popup preserves your conversation, draft and scroll position while closed; a response may finish in the background while the extension remains enabled. Answers are selectable. There are explicit copy actions for an entire answer and individual code blocks. Scrolling follows streaming only if you are near the bottom; otherwise use **Jump to latest**. Basic headings, paragraphs, lists, inline code and fenced code are rendered safely. Unsupported Markdown stays plain text; model-generated URLs remain inert and model code/tools are never executed. Validated retrieved source links open in your default browser only when explicitly clicked.

Connection or model selection starts a new chat. Stop active generation before switching conversations/destinations. Changing a connection URL does not authorize sending old conversations there: reusing content requires explicit confirmation and makes a copied conversation. Removed connection identities cannot send; deleting and recreating a same-named connection creates a different identity.

## Optional web search

**Search Web is off by default**, and resets to Off for a new/opened conversation. Ordinary Ollama chat needs no search credentials.

1. Open **Preferences → Web Search → API-key setup** and create a key at [Ollama's key settings](https://ollama.com/settings/keys). An Ollama account is required. Check [current search documentation](https://docs.ollama.com/capabilities/web-search), account limits and potential costs; free account requirements do not imply unlimited or permanently free usage.
2. Paste the key into the masked field and choose **Save / Replace**. It is stored only in GNOME Secret Service, not GSettings or history. **Remove** deletes an unlocked matching credential. **Test Search** uses the saved key for one hosted search query and may count against provider quotas. No test or search runs automatically.
3. Choose your existing local/LAN model and enable **Search Web: On** beside the composer. Ask, for example, **“What is the latest stable GNOME release as of today? Cite official sources.”**
4. For a vague follow-up such as “What about today?”, fill the small optional **search query override** with a specific query. Otherwise the current user message is used exactly (trimmed), capped at **1,000 characters**. Longer queries are rejected with an explanation, never silently truncated. There is no extra model call to rewrite queries.

On Send, the search toggle/query are snapshotted. Only that query goes to Ollama's hosted `web_search`; selected page URLs go to `web_fetch`. **History, screenshots and image attachments are not uploaded to search/fetch.** Generation still uses your selected Ollama connection/model, with its ordinary multimodal context. Local inference does **not** make web search entirely local.

The dropdown shows **Searching the web… → Reading sources… → Generating answer…**. It retrieves up to five results and fetches up to three pages with at most two fetches in parallel. Search/fetch requests have a 15-second deadline each, a 45-second overall retrieval deadline (including key lookup), and read-time response limits of 256 KiB / 512 KiB. No automatic retries occur, including for rate limits. Individual fetch failures fall back to excerpts with a limited-coverage notice. Search failures offer **Retry** or **Answer without web search** on the failed response; these reuse the original user turn without duplicating it. Choosing the latter visibly labels the answer as without web search. Retry is explicit and may incur another provider request/charge.

Up to **12,000 characters including evidence instructions/source boundaries** are added, further reduced to fit the existing **24,000-character total context budget**. This smaller-than-24,000 evidence cap leaves room for your question and recent conversation. Older conversation context may be omitted with a status notice. Evidence is supplied separately as untrusted data with current date/timezone; embedded page instructions must be ignored. The verified provider schemas do not include publication dates, so none are invented.

Answers are requested to cite stable IDs like `[1]`. Only references matching actual retrieved IDs can open a link; the independent **Sources** section always comes from actual metadata, never model-generated URLs. Source buttons also provide keyboard navigation. Citations do not guarantee factual correctness. Source titles/URLs/IDs and page-vs-excerpt coverage survive history reloads; complete downloaded pages and query overrides are not retained. Prior downloaded evidence is not repeatedly inserted into later requests. Stop cancels retrieval as well as generation; closing the popup does not stop it. See [web search details](docs/WEB-SEARCH.md).

## Images and limits

- PNG and JPEG input; **4 images per message**, **10 MiB per source**.
- Additional decode bound: **40 megapixels**, **32,768 pixels per side**.
- Asynchronous decode with proportional resizing to **2048 pixels on the longest side** (no upscaling). Bounded EXIF orientation is applied. Re-encoded JPEG at quality 88; metadata is not copied and PNG transparency is not preserved.
- Only prepared app-managed image files are retained. Originals can move or disappear. Base64 is created only for requests, not duplicated in history JSON.
- Vision is determined from `/api/show` capabilities. Known text-only models cannot send images. Missing/failed discovery displays **unknown** and requires an explicit confirmed attempt, including for retained image context.
- At most **24 recent messages**, **24,000 text characters**, and **4 images total** are sent per request. Incomplete assistant answers are excluded. The UI reports omitted older context. These are client bounds, not tokenizer accounting: Ollama/model context settings can impose smaller limits.
- Answers: 128 KiB of UTF-8 content; wire stream: 4 MiB; record: 256 KiB. One generation at a time. Connection deadline 10 seconds; discovery 15 seconds; generation/model loading 10 minutes.
- History: 50 chats, 200 messages per chat, 8 MiB structured index and 128 MiB attachments. Limits produce an error instead of silently evicting saved work.

## Connections, cloud and privacy

[Local/LAN setup](docs/OLLAMA.md) explains adding **EVO-X2 using its actual LAN address**, trusted-LAN firewall rules and server-side cloud sign-in.

Clipboard access is only used after explicit **Paste image**, **Copy answer** or **Copy code** actions. There is no clipboard watcher and no default clipboard shortcut. Text selection/entry also has normal native clipboard behavior.

Conversations and processed attachments are **local plaintext, not encrypted**, in `$XDG_DATA_HOME/ai-pop-down-extension/` (normally `~/.local/share/ai-pop-down-extension/`). Directories are mode 0700; atomic index/image writes use mode 0600. Do not put sensitive information in chat unless this storage and your chosen destination are acceptable to you. See [storage and privacy details](docs/PRIVACY.md).

Ollama can run inference on the configured server **or route cloud models to its cloud service**. Cloud model use may transmit your text and images beyond that server. Ordinary LAN HTTP is not encrypted. HTTPS uses system certificate validation. Ollama server base URLs reject credentials, non-HTTP(S) schemes, redirects, query strings, fragments and proxy subpaths. Direct cloud-provider answer-generation integrations are out of scope; the separate search key is used only for the fixed Ollama HTTPS search/fetch endpoints.

## Development and release

- [Build and package](docs/BUILDING.md)
- [Architecture / maintainer walkthrough](docs/MAINTAINER.md)
- [Verified API references](docs/API-REFERENCES.md)
- [Tests and manual desktop checklist](docs/TESTING.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Validation record](docs/VALIDATION.md)
- [GNOME submission checklist](docs/SUBMISSION.md)
- [0.1.0 release notes](docs/RELEASE-NOTES.md)
- [0.1.1 mouse-focus fix](docs/RELEASE-NOTES-0.1.1.md)
- [0.2.0 optional web search](docs/RELEASE-NOTES-0.2.0.md)

**License:** GPL-3.0-or-later; see [LICENSE](LICENSE) and [COPYING](COPYING). Website review/approval is not guaranteed. Maintainers must understand and verify the submitted code.
