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
