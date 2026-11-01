# Architecture and lifecycle

The extension has two entry points: `extension.js` runs inside GNOME Shell;
`prefs.js` runs in the separate GTK4/libadwaita preferences process. Shared modules
use Gio, GLib and Soup, without importing either process's UI libraries.

## Ownership

`extension.js` owns one `ChatController` per enable session. The controller owns
the chat view, settings connection, shortcut, clients, portal requests and history
store. `destroy()` cancels requests, removes sources and keybindings, disconnects
settings and destroys the view.

Asynchronous work checks the session cancellable before updating widgets. Model
discovery also checks its request ID so an older result cannot replace a newer
selection. Each generation captures its own destination, model, context and
cancellable. Switching conversations waits for generation or image selection to
finish.

| Module | Responsibility |
| --- | --- |
| `chatController.js` | Chat state, drafts, sending, search and save scheduling |
| `ui.js` | Panel popup, composer, messages, sources and clipboard copy buttons |
| `core.js` | URL validation, NDJSON, context selection, Markdown and history format |
| `ollama.js` | Streaming HTTP requests and model-discovery cache |
| `webCore.js` / `webSearch.js` | Retrieval scheduling, evidence context and hosted HTTP transport |
| `credentials.js` | Lazy libsecret access for the search API key |
| `images.js` | Bounded image loading, resizing, encoding and clipboard image transfer |
| `portal.js` | File chooser and interactive screenshot requests |
| `storage.js` / `io.js` / `bytes.js` | Serialized saves, attachment cleanup and bounded asynchronous I/O |

## Streaming and cancellation

NDJSON is buffered as bytes and decoded one complete line at a time. GJS's
`TextDecoder` does not support streaming decode, so decoding arbitrary network
chunks would break split UTF-8 characters. The parser requires a final `done`
record and enforces record and wire-size limits.

Ollama requests have a ten-second connection timeout, followed by fifteen seconds
for discovery or ten minutes for generation. Those are total operation deadlines,
not inactivity timers. Streams close in `finally`; client teardown cancels the
requests, removes their timers and aborts the Soup session.

Search uses fixed Ollama HTTPS endpoints, with separate credentials and deadlines.
Two workers fetch at most three pages from up to five results. Failed page fetches
retain search excerpts; a failed search offers explicit retry or fallback on the
same response. See [WEB-SEARCH.md](WEB-SEARCH.md).

## Widgets and focus

The view uses PanelMenu, PopupMenu and St widgets. The menu owns its child actors;
the tooltip is owned separately in `Main.uiGroup`. Teardown disconnects the menu,
scroll-adjustment and one-shot stage handlers before destroying widgets.

The indicator lets editable text keep Left/Right navigation. Primary-button
events on the composer focus its text actor and propagate, preserving native
cursor positioning and selection. Initial focus is set after the popup opens.
Streaming and copy actions do not move focus.

Streaming text updates at most ten times per second. Completed responses render
escaped basic Markdown, falling back to plain text above 200 blocks. Source lists
start collapsed. Opening a list pauses auto-follow and restores the scroll anchor
after layout; disclosure state is not saved in history.

## Storage and images

History writes are queued and coalesced. Each save commits the index before
collecting unused attachments. Newly prepared images are reserved so an overlapping
save cannot delete them. Corrupt history is preserved read-only until reset.

The session cancels writes on disable rather than blocking Shell to flush them.
The last committed partial answer survives; saved `generating` states become
`interrupted` when loaded. Temporary-image deletion can finish after the UI is gone.

Image headers are checked before asynchronous scaled decoding. Rotation and JPEG
encoding operate on the resized image. Clipboard paste uses Mutter's bounded
selection transfer. Copy buttons write text through St's clipboard; both uses are
declared in the extension description.

Portal requests subscribe to their token-specific response path before issuing
the D-Bus call. Timeout or disable closes the request and removes its subscription.
The screenshot portal is interactive: choose **Selection** to capture a region.

See [PRIVACY.md](PRIVACY.md) for storage paths and limits,
[API-REFERENCES.md](API-REFERENCES.md) for API links, and
[TESTING.md](TESTING.md) for desktop checks.
