# GNOME review

Current review: <https://extensions.gnome.org/review/77529>

Before uploading an update:

1. Run the checks in [BUILDING.md](BUILDING.md) and the relevant GNOME desktop
   checks in [TESTING.md](TESTING.md).
2. Build the ZIP and test that exact package. It should contain runtime modules,
   resources, schema XML and license texts, without compiled schemas or development files.
3. Run Shexli on the ZIP and inspect each finding. Clipboard access is declared in
   `metadata.json`: image paste and answer/code copy follow explicit user actions.
   Shexli's clipboard finding requires a human decision even with this declaration.
4. Keep changes focused and explain them on the review page. Include test results
   and answer the reviewer's authorship and maintainership questions accurately.

The [architecture](MAINTAINER.md) describes ownership and data flow. The
[official review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
cover lifecycle, process boundaries, clipboard disclosure and submission requirements.
