# Official API evidence

Consulted during implementation on 2026-10-22. This documents the APIs actually used, not a claim of live runtime validation. Sources were read before implementation and rechecked as code was refined.

## GNOME / GJS

- [Current extension review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html): initialization, disable cleanup, library/process boundaries, clipboard metadata disclosure, scripts, readable source and packaging. AI-assisted submissions still require maintainer understanding.
- [GNOME Shell 51 porting](https://gjs.guide/extensions/upgrading/gnome-shell-51.html): removed St `vertical`, new `orientation`, PopupMenu parameter objects, synchronous disable, KeyController and `get_key`/`get_state`.
- GNOME Shell **51.1** official source: [panelMenu.js](https://github.com/GNOME/gnome-shell/blob/51.1/js/ui/panelMenu.js), [popupMenu.js](https://github.com/GNOME/gnome-shell/blob/51.1/js/ui/popupMenu.js), [layout.js](https://github.com/GNOME/gnome-shell/blob/51.1/js/ui/layout.js), [st-scroll-view.h](https://github.com/GNOME/gnome-shell/blob/51.1/src/st/st-scroll-view.h). Verified monitor/workarea lookup, menu behavior, text-arrow handling, scroll adjustment getters and modern child APIs.
- [St clipboard source](https://github.com/GNOME/gnome-shell/blob/51.1/src/st/st-clipboard.h): explicit `set_text`; no image watching.
- Composer focus fix: [St.Entry source](https://github.com/GNOME/gnome-shell/blob/51.1/src/st/st-entry.c) centers the text actor within the content box and proxies keyboard-navigation focus to it; [Clutter.Text source](https://github.com/GNOME/mutter/blob/51.1/clutter/clutter/pango/clutter-text.c) implements native click positioning and selection. The verified [Actor::captured-event](https://mutter.gnome.org/clutter/signal.Actor.captured-event.html) signal observes presses in the entry and returns false (`EVENT_PROPAGATE`). PopupMenu's `open()` returns whether it opened, after showing the actor and setting up initial navigation, so the composer is focused there rather than in the earlier `open-state-changed` signal. No competing click gesture is installed.
- Mutter **51.1** [selection header](https://github.com/GNOME/mutter/blob/51.1/src/meta/meta-selection.h), [implementation](https://github.com/GNOME/mutter/blob/51.1/src/core/meta-selection.c), [selection type](https://github.com/GNOME/mutter/blob/51.1/src/meta/meta-selection-source.h): bounded cancellable `transfer_async(selection_type, mimetype, size, output, cancellable, callback)` and 15-second internal transfer timeout.
- [GJS TextDecoder implementation](https://github.com/GNOME/gjs/blob/master/modules/esm/_encoding/encoding.js): `stream` explicitly unsupported. The parser assembles bytes into complete lines instead.
- [GdkPixbuf scaled async loader](https://docs.gtk.org/gdk-pixbuf/type_func.Pixbuf.new_from_stream_at_scale_async.html), [async save](https://docs.gtk.org/gdk-pixbuf/method.Pixbuf.save_to_streamv_async.html), [save finish](https://docs.gtk.org/gdk-pixbuf/type_func.Pixbuf.save_to_stream_finish.html): off-main-thread decode/resize and encode without Gtk or Gdk imports.
- [Soup 3 async transport](https://libsoup.gnome.org/libsoup-3.0/method.Session.send_async.html), [starting signal](https://libsoup.gnome.org/libsoup-3.0/signal.Message.starting.html): streamed response bodies and reused-connection timeout handoff.
- [Gio atomic replacement](https://docs.gtk.org/gio/method.File.replace_contents_async.html): use the bytes-owning async variant so buffers remain valid through completion.
- [St theme parser](https://github.com/GNOME/gnome-shell/blob/51.1/src/st/st-theme-node.c): only verified `-st-accent-color`/`st-transparentize`, no invented foreground/background CSS variables.

## Desktop portals

- [FileChooser](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html): OpenFile `(ssa{sv})`, MIME filters `a(sa(us))`, response `uris`.
- [Screenshot](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Screenshot.html): Screenshot `(sa{sv})`, v2 interactive mode, response `uri`. Newer v3 `target` is not assumed.
- [Request lifecycle](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Request.html): handle token path, Response and Close. No X11 tools or guessed screenshot D-Bus signatures.

## Ollama

- [Model list](https://docs.ollama.com/api/tags): native `GET /api/tags`, exact `models[].name`, including remote/cloud names.
- [Model details](https://docs.ollama.com/api-reference/show-model-details): native `POST /api/show`, `capabilities` including `vision`, and model-specific `thinking.values`.
- [Chat](https://docs.ollama.com/api/chat): native `POST /api/chat`, messages, stream events, `message.content`, separate `message.thinking`, `done` and error behavior.
- [Vision](https://docs.ollama.com/capabilities/vision): REST `messages[].images` is an array of base64 strings, not paths or data-URI prefixes.
- [Thinking](https://docs.ollama.com/capabilities/thinking): do not assume every model can disable it; discard separate traces.
- [Streaming](https://docs.ollama.com/api/streaming), [errors](https://docs.ollama.com/api/errors), [cloud](https://docs.ollama.com/cloud), [FAQ](https://docs.ollama.com/faq): NDJSON, cloud routing/sign-in, `OLLAMA_HOST`, normal loopback binding, network access and cloud privacy distinctions.
