# Testing

## Automated

`gjs -m tests/run.js` (or development-only `node tests/run.js`) checks:

- Every possible two-chunk split and byte-at-a-time delivery of UTF-8/NDJSON; split JSON/UTF-8, multiple lines, CRLF, no trailing newline, final record, malformed JSON, invalid records, explicit server errors, invalid UTF-8, unexpected EOF, cancellation, record/wire limits and trailing data.
- HTTP(S) normalization, credentials/scheme/path/query/fragment rejection, host/port/IPv4/IPv6 validation and connection identity validation.
- Exact native request shape, base64 image arrays, unknown/known-negative/positive vision gating and model-specific thinking controls.
- Versioned history round trips, strict corruption rejection, interrupted recovery, safe attachment IDs, whitelisted serialization, deletion and shared-reference cleanup planning.
- Markup escaping and basic Markdown safety, including untrusted markup, code and inert links.
- Header format/dimensions, source limits and oversized decode inputs.

`gjs -m tests/gjs-storage.js` additionally exercises actual Gio storage/image I/O. Run lint, strict schema validation and the packaging audit in [BUILDING.md](BUILDING.md). Pure logic/static checks do not prove the extension runs in GNOME.

`gjs -m tests/web.js` (or development-only `node tests/web.js`) adds 14 asynchronous groups: fixed request schemas/credential placement, sanitized auth/rate/redirect errors, explicit query limits, URL/source metadata validation, malformed/empty data, actual retrieval scheduler concurrency/page/result limits, excerpt fallback, simulated request timeout/deadline/cancellation behavior, the actual shared bounded reader including cancellation after a read completes, untrusted/bounded evidence context, citation-ID mapping, source-history round trips and unchanged ordinary request construction. These use injected provider responses/control state: no real account or paid requests, no claims of live Soup/keyring/timer/UI coverage.

## Owner’s target desktop checklist

Use CachyOS GNOME **51.1 / Wayland**, ideally the Dell XPS 13, with a disposable test conversation and benign images. Prefer an isolated nested GNOME session if already available; do not restart the active desktop to test. Record GNOME/GJS/Soup/portal versions and failures without sharing private chat content.

- [ ] Install the single ZIP using `gnome-extensions install`. First-enable icon, popup and preferences load without journal errors.
- [ ] Enable/disable 10 times, including while history loads. No duplicate icons, keybindings, tooltips, sources or exceptions.
- [ ] Default connection reaches the existing local Ollama; Refresh and preferences Test Connection work. No model downloads or automatic service changes occur.
- [ ] Add EVO-X2 using its **real** trusted-LAN address. Test connect, model names with tags/cloud suffixes, changing the default model, remove connection and confirmed URL changes.
- [ ] Unreachable host, refused port, bad TLS, redirect response, timeout, empty list, missing model, cloud sign-in/usage error, invalid/oversized response and unsupported images produce useful status.
- [ ] Streaming text appears incrementally, including non-ASCII characters; model loading remains stoppable. Multiturn text and image context behave correctly.
- [ ] Close/reopen while generating: no lost draft, scroll jump when scrolled up, extra send, or unwanted focus change. Response finishes while closed.
- [ ] Stop before headers, during thinking and during content; partial text is marked interrupted. Stop, wait for cancellation, immediately send again. No response/destination mixing.
- [ ] New Chat/model/server/history switching is blocked during generation. An edited URL requires explicit confirmation before old text/images can be reused; cancel sends nothing.
- [ ] Enter sends, Shift+Enter makes newline, arrows edit text, Escape/outside click closes. Tab/Shift+Tab reaches controls. Shortcut starts unassigned; assign, change and clear it. No default clipboard shortcut.
- [ ] Open by mouse and by the configured shortcut and type immediately without Tab. Move focus elsewhere, then click the empty hint, text, space after text, and the top/bottom/side padding of the composer: typing goes into the draft in each case.
- [ ] In a multiline draft, click between characters on different lines, drag-select, double-click a word, and Shift-click to check native behavior against a normal St.Entry. Tab/Shift+Tab still leave/re-enter the composer. During streaming and at completion, selecting/copying a message or focusing another control does not return focus to the composer.
- [ ] Select and copy long answers without input grabbing focus. Copy full answer and fenced code preserves exact text. Headings/lists/inline code render safely; HTML and links stay inert.
- [ ] Scroll up during a response: position stays; Jump to latest works. Reopening a closed popup preserves position.
- [ ] Choose PNG and JPEG files, rotated JPEGs and images larger than 2048 pixels. Previews/removal work. Confirm actual sent longest side ≤2048, correct aspect ratio and JPEG format. Try invalid/truncated files, 10 MiB overflow, >40 MP and fifth image.
- [ ] Explicit Paste image works on Wayland from common apps; empty/text-only/oversized clipboard produces a useful error. Opening popup alone never reads images.
- [ ] Capture: popup hidden, choose **Selection**, select region, return with thumbnail and draft intact; only Send transmits. Escape cancels without draft loss. Temporary capture output is cleaned.
- [ ] Disable while selecting file, selecting capture, transferring clipboard, decoding, loading history and streaming. Dialog/request closes or safely cancels; no late UI update after disable/re-enable.
- [ ] Text-only model refuses images; vision model works; failed/missing capabilities says unknown and asks before an explicit attempt. Separate thinking does not appear in saved JSON or context.
- [ ] History survives logout/reboot with titles/dates and retained image context after moving originals. Delete chat with confirmation, shared images survive until last reference, Delete all history resets storage, corruption is preserved until reset.
- [ ] Persistent history off clears saved index, keeps session-only chat behavior, and temporary leftovers are cleaned on next enable. Crash/disable during save leaves valid prior JSON.
- [ ] Bound context omission is clearly disclosed. Hit saved limits without silent eviction.
- [ ] Default light/dark Shell themes, high contrast, custom theme, 100%/200%/fractional scaling, small display, large font, multiple monitors and hotplug: popup stays within workarea, entry/buttons remain reachable, no horizontal overflow.
- [ ] Lock screen: no chat UI, tooltip or capture data remains visible. Unlock/re-enable has no stale operations.

After real captures, optionally add screenshots to source docs only, with consent and no private chat content. Do not invent mock screenshots or put docs/screenshots in the extension ZIP.

## Web Search — target desktop and live service

- [ ] With no saved key, normal chat/attachments/history work with Search Web Off. New Chat, model/server switching and reopening a saved conversation reset search Off. Popup close/reopen alone preserves the draft/toggle and running retrieval.
- [ ] Preferences setup link opens only on click; key entry is masked, never prefilled and cleared after actions/close. Save a key, replace it, Test Search (explicit hosted query), Remove, then test that search reports missing credentials. Check Secret Service item/schema and that no GSettings/history/repository file contains the key.
- [ ] Locked/unavailable keyring, missing Secret introspection, prompt cancellation, invalid key, HTTP 401/403/429, Retry-After, network/TLS/redirect/timeout, malformed and empty responses give clear errors with no raw credentials logged/displayed. Save/Remove/Test cancellation on preferences close is clean.
- [ ] Ask one current-information question with search On. Verify progress order, selected local/LAN generation destination and exact hosted request bodies: only the current/override query and result URLs, never screenshots, image base64 or prior turns. A follow-up override uses the explicit edited query without model rewrite.
- [ ] Verify five results maximum, three fetches maximum, two concurrent fetches maximum, 15-second per-request / 45-second overall deadlines, and incremental 256/512 KiB limits using a controlled test environment. A failed fetch uses excerpts and says so. A failed search does not generate an answer until explicit retry/fallback.
- [ ] Retry or Answer without web search reuses the original question once, captured destination/model and multimodal context; a newer draft survives. Fallback is visibly labeled. No automatic retries or background searches occur.
- [ ] Close during search/fetch: operation continues. Stop during key lookup, search, both concurrent fetches and generation; disable/re-enable during each stage. All requests/timers/callbacks settle without stale UI updates or mixed destinations.
- [ ] Valid inline `[1]` clicks and keyboard-focusable Sources buttons open actual metadata URLs, unknown `[99]`, code blocks, malformed URLs and model-generated links do not. Clicking/drag-selecting/copying normal response text retains native behavior and never refocuses the composer. No surprise browser opening during drag.
- [ ] Sources titles/URLs/IDs/coverage survive closing/reopening and logout/restart. Complete page bodies, override queries and credentials are absent from history. Later requests do not replay previous downloaded pages or duplicate the current user/image turn. Malformed saved source metadata is handled like corrupt history.
- [ ] Long/hostile page text, embedded role markers/instructions, missing publication dates and long questions remain bounded and separated from the original user request. Omitted older context and excerpt-only coverage are disclosed. Citations are not presented as a correctness guarantee.
- [ ] Native light/dark/high-contrast themes, scaling/small monitors, Search Web toggle state, query focus/tab navigation and all existing composer-focus checks remain usable. No Gtk/Gdk/Adw in Shell, no Shell UI imports in preferences, no separate runtime/service or installation step.
