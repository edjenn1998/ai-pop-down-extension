# Build and package

Runtime source is plain JavaScript ES modules. There is no npm install step and no production dependency tree.

## Checks

On a development machine with GJS:

```sh
gjs -m tests/run.js
gjs -m tests/web.js
gjs -m tests/gjs-storage.js
eslint extension.js prefs.js lib tests
glib-compile-schemas --strict --dry-run schemas
```

`tests/run.js` is pure portable logic and can alternatively run with a development-only Node.js installation:

```sh
npm test
npm run lint
```

The GJS storage/image integration tests require GJS, Gio and GdkPixbuf. They use a temporary directory and check private atomic writes, history round trips, corruption preservation, attachment cleanup and image decoding/re-encoding. See [VALIDATION.md](VALIDATION.md) for results and unavailable checks.

## Build

The development-only packager needs Python 3’s standard library and `glib-compile-schemas`:

```sh
python3 tools/package.py
```

The packager produces a root-layout ZIP with Python’s standard `zipfile`, after strictly compiling the schema in temporary staging for validation. Only the schema XML is shipped: modern GNOME extension installation compiles it on the destination system. Python is not included in or needed by the installed extension.

Output:

```text
dist/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip
dist/SHA256SUMS
```

The builder validates checksums, UUID, shell-version, clipboard description, absence of website-managed version/session fields and **exact ZIP contents**. Runtime files only: metadata, extension, preferences, stylesheet, lib modules, icon, schema XML and license texts. No tests, docs, build scripts, package.json, compiled schemas, caches, local settings, screenshots or source archives enter the ZIP.

Install with `gnome-extensions install /absolute/path/to/zip`; add `--force` for an update. Log out and back in on Wayland to reload changed JavaScript.

## Release

Update the version and release notes, record the checks performed, and tag the matching source commit. Create a regular GitHub release with the installable ZIP and `SHA256SUMS` as assets. Keep generated archives out of source commits and retain earlier release assets.

GitHub’s automatic source archives are not installable extension packages. Never substitute them for the release attachment.
