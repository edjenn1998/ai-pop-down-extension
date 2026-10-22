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

The GJS storage/image integration tests require GJS, Gio and GdkPixbuf. They operate in a temporary test directory, not the owner’s extension data. They check actual atomic private writes, round trips, corruption preservation, attachment cleanup and image decoding/re-encoding. They were **not runnable** in the initial build environment.

## Build

The development-only packager needs Python 3’s standard library and `glib-compile-schemas`:

```sh
python3 tools/package.py
```

If `gnome-extensions` is available, it invokes **`gnome-extensions pack`** with the runtime asset directories. Otherwise it produces the equivalent root-layout ZIP with Python’s standard `zipfile`, after compiling the schema. Python is not included in or needed by the installed extension.

Output:

```text
dist/ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip
dist/SHA256SUMS
```

The builder validates checksums, UUID, shell-version, clipboard description, absence of website-managed version/session fields and **exact ZIP contents**. Runtime files only: metadata, extension, preferences, stylesheet, lib modules, icon, schema XML/compiled schema and license texts. No tests, docs, build scripts, package.json, caches, local settings, screenshots or source archives enter the ZIP. The XML remains included for GNOME review.

Install the resulting file with `gnome-extensions install /absolute/path/to/zip`. This is separate from building: do not install into or restart someone’s active desktop without permission. For updates, use the Extensions UI or an explicit owner-approved force-reinstall, not a silent script.

## Release

Update the honest validation record with actual automated/manual results. Inspect `git status`, `git diff`, recent commits, and staged files for secrets/artifacts; fetch and preserve remote work before pushing. After the separately required owner confirmation, commit intended source/docs/tests and push without force. Use a new versioned prerelease (currently **v0.2.0**) with the installable ZIP, SHA256SUMS and the matching release notes (`docs/RELEASE-NOTES-0.2.0.md`). Never overwrite an existing release artifact. Do not put ZIP artifacts in the source commit; attach them to the release. Live GNOME validation outstanding must remain explicit in prerelease notes.

GitHub’s automatic source archives are not installable extension packages. Never substitute them for the release attachment.
