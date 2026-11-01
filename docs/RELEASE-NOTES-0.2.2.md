# AI Pop Down Extension v0.2.2 — lifecycle and packaging maintenance

## Changes

- Separate the chat controller from the small extension lifecycle entry point.
- Use cancellation state for shutdown guards and suppress late history/UI updates.
- Bound model discovery caching to 64 entries and reject cancelled discovery results.
- Cancel preferences connection tests when their connection is removed.
- Simplify portal request ownership while preserving timeout, subscription and cancellation cleanup.
- Package schema XML without compiled schemas; retain runtime modules, resources and GPL terms.
- Keep the existing chat, web search, image, history and preferences behavior.

## Validation

The owner reports that the extension works as expected on the target GNOME desktop.
Automated validation passes 18 core groups, 16 web groups and two transport/cache
regression tests, plus lint, syntax, schema compilation, import isolation,
metadata, documentation and ZIP checks.

The build environment has no GJS or GNOME Shell. Its automated checks do not
independently verify live Soup, Secret Service, portal or native widget behavior.
This release retains prerelease status.

## Installation

Download `ai-pop-down-extension@edjenn1998.github.io.shell-extension.zip` and
`SHA256SUMS` from this release. Verify with `sha256sum --check SHA256SUMS`, then
follow the installation/update instructions in the project README. GitHub's
automatic source archives are not installable extension packages.
