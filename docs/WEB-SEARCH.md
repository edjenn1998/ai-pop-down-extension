# Optional hosted web search

Search is a separate, explicitly opted-in retrieval step. `Search Web: Off` is the initial state and is restored for new/opened conversations. Closing/reopening the popup preserves its current draft/operation. Sending with search Off never reads the keyring or contacts the search provider.

## Setup and data flow

In Preferences → Web Search, open the official API-key setup link, create an Ollama account/key, enter it in the masked field and select Save / Replace. The key is stored via libsecret's asynchronous Secret Service password API, schema `org.gnome.shell.extensions.ai-pop-down.WebSearch`, non-secret attribute `purpose=ollama-web-search`. Matching saves replace the credential. Remove performs lookup (which may unlock) then clears matching unlocked items; if none were removed, the UI does not claim deletion. Unlock the login keyring in Passwords and Keys and retry when necessary. There is no plaintext fallback, environment-file setting or GSettings secret. The entry is never prefilled and is cleared after actions/window close. libsecret is imported lazily so missing keyring support does not break ordinary chat.

Test Search reads the stored key and sends **one** search for “Ollama web search”; it does not fetch pages or generate an answer. It requires explicit action and may count against quotas. Keys and Authorization headers are never logged or saved in history. JavaScript cannot promise deterministic secure wiping of transient strings; Secret Service provides persistent credential protection, not a guarantee against process-memory inspection.

The official fixed requests are:

```text
POST https://ollama.com/api/web_search
Authorization: Bearer <key from Secret Service>
Content-Type: application/json
{"query":"current question or explicit override","max_results":5}

POST https://ollama.com/api/web_fetch
Authorization: Bearer <same search key>
Content-Type: application/json
{"url":"validated HTTP/HTTPS result URL"}
```

All transport is asynchronous Soup 3/Gio. TLS uses the system trust store; redirects are refused, even same-origin redirects. Keys are never forwarded to result URLs: those URLs are JSON data sent to the fixed fetch service. The extension does not crawl returned `links` or issue direct page HTTP requests. Error response bodies and raw transport/Secret Service error details are not displayed/logged, avoiding accidental credential echoes.

The query is the trimmed **current user message**, or the explicitly edited override, maximum 1,000 characters. No silent truncation, conversation upload or model-assisted query rewrite occurs. Images, screenshots and previous turns are not sent to the hosted search/fetch APIs. The original question and appropriate existing multimodal context still go to the selected Ollama server for generation. A cloud model on that server may independently route them onward.

## Bounds and failure behavior

Five results, three fetched pages, two parallel fetches; no follow-up crawling. Search responses ≤256 KiB, fetch responses ≤512 KiB, enforced incrementally during reads. Each HTTP request has a 15-second total deadline. Overall retrieval, including key lookup, has a 45-second deadline. Stop and disable cancel child requests and keyring lookup; destroy removes timers, disconnects parent-cancellation signals and aborts Soup. Late callbacks cannot change a dead/re-enabled controller. Closing the popup alone leaves retrieval active.

Search errors, empty usable results or invalid schemas do not silently produce a “researched” answer. The response is failed and offers explicit Retry or Answer without web search. These actions reuse the original user/assistant pair, captured connection/model/query and image context, preserving any newer draft. Only one operation runs at a time. A retry can consume another request/charge. No automatic retry or backoff loop exists. HTTP 429 reports Retry-After seconds when provided, otherwise asks the user to wait and check account limits. Fetch authentication/rate-limit errors stop additional scheduling; already-in-flight fetches may finish. Other page failures leave excerpts available, with a limited-coverage notice. If all pages fail, search excerpts still support a transparently limited answer.

Evidence is bounded to **12,000 characters including instructions, metadata, JSON escaping and boundaries**, leaving room within the existing 24,000-character total sent-text budget. Long questions reduce this further; if useful evidence cannot fit, the user can shorten the question or explicitly answer without search. Recent conversation context is reselected against the remaining budget, and omission is disclosed. Model token limits can still be smaller: this is character-based budgeting, not tokenizer accounting. The official docs recommend large contexts for research agents; this first version is intentionally a small bounded retrieval workflow.

## Evidence, links and saved history

Source IDs `[1]` through `[5]` derive from usable search results and remain stable across asynchronous fetch completion. Page fetch replaces excerpt text, not the source identity. Titles, URLs and page/excerpt status are actual returned metadata; publication dates are absent from the documented API schema and are not inferred or invented.

Evidence is a separate system message of explicitly **untrusted JSON data**, with source boundaries and current local date/offset/timezone. The final user question remains a separate original user message, once only, with its image references intact. Instructions tell the model to ignore commands/role claims embedded in pages, cite relevant factual claims, acknowledge uncertainty and avoid invented IDs/dates. These instructions reduce confusion but cannot guarantee model compliance or truthfulness. No tool, script or command execution is supported.

Only actual retrieved IDs can activate inline citations. Fenced code and unknown IDs remain inert. The Sources section is built independently from validated metadata. Its keyboard-focusable buttons open HTTP/HTTPS sources through `Gio.AppInfo.launch_default_for_uri_async`, only after explicit clicks. Native Clutter.Text selection gestures are preserved; dragging can cancel citation activation. Model-generated links are not trusted for launching. Browser navigation after an explicit launch is managed by the normal browser, not by extension HTTP credentials.

Since v0.2.1, each answer has a compact **Sources (N) ▸** disclosure, initially collapsed. Click it, or Tab to it and press Enter/Space, to expand just that answer. Links show source numbers, wrapped titles and domains, not raw URL paths or excerpts. The disclosure exposes native expandable/expanded accessibility states. Coverage and citation caveats are in its tooltip; failure/fallback notes without sources remain visible. Popup close resets disclosures to collapsed, and restored history always starts collapsed. Expansion is never serialized. Inline citations retain their direct explicit-click browser behavior and do not expand any source list. Disclosure browsing pauses auto-follow and anchors the scroll adjustment through layout, with natural bounds clamping if a collapse shortens the content below the old position. It does not focus the composer.

History format version 1 gains optional whitelisted `sources` and `webNote` message fields. It remains readable by the new extension for all prior chats. Only compact IDs/titles/URLs/coverage/notes are retained; downloaded pages, Authorization headers and query overrides are not saved. Existing attachment references and history limits are unchanged. A downgrade to an older extension can drop optional source metadata when re-saving. Current evidence is transient and not reinserted into subsequent turns; later context contains the saved answer text, not its downloaded source bodies.

## Provider terms and validation

Official docs: <https://docs.ollama.com/capabilities/web-search>, API keys: <https://ollama.com/settings/keys>. A free Ollama account is documented as required; consult current account limits, rate limits and potential costs before using search. The extension does not assume unlimited usage or make pricing promises.

Portable tests mock the documented provider data and exercise the actual retrieval scheduler and bounded reader. They do not prove live Ollama search authentication, keyring marshaling, Shell selection/focus or browser launching works on GNOME. Run the Web Search section in TESTING.md on the target GNOME 51.1 desktop before relying on the prerelease.
