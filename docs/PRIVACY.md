# Privacy and storage

## Destinations

Only the selected Ollama server receives chat requests. Available models/capabilities are discovered with `/api/tags` and `/api/show`; lists are cached for 60 seconds, never polled. Refresh explicitly invalidates the relevant cache. Requests validate HTTPS certificates and refuse **all** HTTP redirects, including same-origin ones. URLs cannot contain credentials. No prompts, answers, image content or credentials are logged.

Local inference, LAN inference and server-routed cloud inference are different. The extension cannot guarantee where an Ollama server ultimately runs a model. The UI warns that cloud models may transmit text/images beyond the server. HTTP on a LAN is plaintext on the network.

There is no telemetry, analytics, advertising, clipboard watcher, executable download, model download or model tool execution.

## Clipboard and captures

Explicit image paste uses Mutter’s bounded selection transfer, capped at 10 MiB plus one overflow-detection byte, with cancellation. Copy actions use St’s native text clipboard. Text input/selection supports normal desktop clipboard behavior. No default shortcut reads the clipboard.

File choice and screenshots use desktop portal requests. GNOME’s screenshot UI chooses the region: select **Selection** rather than Screen/Window. This v2-compatible path works without relying on a newer portal’s optional area-target hint. Portal cancellation preserves drafts; successful captures are processed and attached but not sent. The returned temporary capture file is deleted after processing. Disabling closes outstanding portal requests; late results cannot reopen the UI.

## Files

`$XDG_DATA_HOME/ai-pop-down-extension/` contains:

```text
history.json          # version: 1, conversation metadata and message text
images/<uuid>.jpg     # prepared, resized and re-encoded attachments
```

The index and attachments are **plaintext and unencrypted**. The containing directories are restricted to the user (0700), and writes use private atomic replacement (0600). Image identifiers are validated as filenames, never arbitrary paths. History contains attachment references rather than repeated base64 blobs. No storage is written into the installed extension directory.

Titles come from the first user message, locally; no extra model request is made. Conversations bind the stable connection ID, normalized URL and exact model. Selecting a different connection/model makes a new chat. Editing a URL requires confirmation before copying old content to the changed destination. A removed connection cannot silently fall back to a different server.

Each save atomically commits the versioned index before removing images that are no longer referenced by retained chats or session drafts. Newly staged images are reserved to avoid a save/attachment race. Deleting chats also drops their draft reservations. Startup collects leftover unreferenced images. A corrupt/unknown-format index is preserved read-only; **Delete all history** explicitly resets it. Back it up before reset if recovery matters to you.

Streaming updates are saved no more often than roughly every two seconds and at completion. A disabled/crashed Shell can lose the last uncommitted tokens, but atomic writes retain the previous complete file. A saved `generating` response becomes **interrupted** on load. Unsent drafts are session-only. Disabling cancels all I/O rather than blocking Shell to flush history. Temporary draft image files can remain until the next enable/collection; explicit Delete all history removes them now. The storage budget bounds abandoned files too.

When persistent history is disabled, the disk index is emptied; conversations remain in memory only for that enabled session. Prepared images still need private temporary disk files for previews/context. They are not referenced in saved history and are removed on the next enable. This is **not** a promise of zero disk traces or forensic erasure. Delete all history and remove backups separately when required. The extension cannot delete copies already sent to your server/cloud service or copied to the system clipboard.

## Bounds

50 conversations, 200 messages each, an 8 MiB index, 128 MiB attachment storage, at most 2,000 attachment files. No automatic silent eviction. Context is bounded separately (24 messages / 24,000 characters / 4 prepared images) and omission is disclosed. These bounds protect the Shell but do not imply token-level accounting of every model’s context window.
