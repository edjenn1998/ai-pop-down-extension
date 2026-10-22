# Troubleshooting

**Web search setup / authentication:** ordinary chat works with Search Web Off and does not read a search key. For search, use Preferences → Web Search, create a key using the official setup link, Save / Replace, then Test Search. The hosted search credential is separate from server-side `ollama signin` and local/LAN connection authentication. HTTP 401/403 requires checking/replacing that search key. An unlocked GNOME Secret Service/login keyring with libsecret introspection must be available. Missing support produces an error; no plaintext fallback or API-key environment file is used. Remove only clears unlocked matching items, so unlock and retry if the UI reports nothing removed.

**Web search rate limit / timeout / empty results:** no automatic retries occur. Respect Retry-After when shown, wait and check current provider account limits/costs. Use a more explicit query (max 1,000 characters) for ambiguous follow-ups. Search/fetch deadlines are 15 seconds each, 45 seconds overall. Search failure provides Retry or Answer without web search; neither duplicates your question. Individual page failures retain limited-coverage excerpts. Sources/citations are evidence, not a guarantee of truth; inspect actual source links. Very long questions may leave too little context budget for evidence: shorten them or explicitly answer without search.

**Extension does not appear:** confirm GNOME Shell 51, correct ZIP (not a source archive) and UUID. First installs may need logout/login for discovery. Check Extensions and the user journal for the extension’s error. The initial artifact has not yet had desktop validation; report concrete exceptions and versions.

**Unreachable Ollama:** verify it is already running. The extension does not start it. Check the base origin, port and hostname on the actual GNOME computer. For a LAN connection, check server bind interface, routing and trusted-LAN firewall rules. `localhost` always means the GNOME machine, not EVO-X2. Do not solve a routing error by exposing Ollama publicly or adding wildcard CORS.

**Timeout:** TCP/TLS setup is bounded at 10 seconds; discovery at 15 seconds; generation including model loading at 10 minutes. Slow models can need substantial RAM/VRAM and load time. Stop remains cancellable. A busy server/large model may need adjustment with Ollama’s own tools.

**No models / model unavailable:** Test Connection can succeed with an empty list. Make the desired model available using Ollama’s own tooling, then Refresh. No automatic pull is performed. Saved chats retain exact names; choosing a replacement model starts a new chat.

**Cloud authentication or 401/403:** the Ollama server owner needs Ollama app/CLI cloud sign-in under the account running the service. A CLI sign-in under an unrelated user may not authenticate a system service. Check server-side cloud usage/retirement too. The extension does not support arbitrary reverse-proxy API keys or direct provider authentication.

**HTTPS certificate / redirect refused:** use the actual final origin with a certificate trusted by the system. No TLS bypass exists. Proxy paths, credentials, query strings and fragments are unsupported. Redirects are deliberately not followed.

**Images refused:** only PNG/JPEG, maximum 10 MiB input, 40 MP/32,768 per side, four attachments. A genuine decoder validates the file after header checks. A model that advertises capabilities without `vision` cannot receive image context. When capabilities are unavailable, an explicit confirmed attempt is allowed. A server/model error can still reject that attempt; unknown is not a promise of support.

**Capture or file selection fails:** confirm the GNOME desktop portal/backend is available in the user session. Use **Selection** in the interactive screenshot UI; Escape cancels. Portal requests are closed on disable and expire after five minutes. No X11 screenshot utility or privileged helper is used. Clipboard image paste requires that the source app offers PNG/JPEG; copying a file icon or URL is not image content.

**No final answer, only preparation status:** some models emit separate thinking before content. The trace is intentionally discarded. Stop or wait. A stream ending before a final `done` record is marked failed; partial content remains visible. A response that exceeds bounds is stopped rather than allowed to grow indefinitely.

**History cannot save / corrupt:** storage limits and I/O errors appear in status. Delete older chats to free space. Corrupt or unsupported JSON is not overwritten; back up `history.json` before explicitly resetting with Delete all history. Storage is plaintext. Changing the URL does not silently migrate old chats, and deleting/recreating a connection does not restore its identity.

**Model forgot older context:** the UI states when only recent context was sent. Client bounds are 24 messages / 24,000 characters / four images, with interrupted/failed assistant answers excluded. The server/model may also have a smaller token context window. Start a concise new chat if necessary.

**Bug report:** include GNOME 51.x, distribution, Wayland session, GJS/portal/Soup versions, benign steps to reproduce and the exception text. Redact addresses if desired. Do not attach prompts, answers, clipboard contents, image data, credentials or complete private history unless intentionally sharing them.
