#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Development-only source checks; does not load or modify the desktop."""
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
IMPORT = re.compile(r"^import .*? from ['\"]([^'\"]+)['\"];", re.MULTILINE)


def walk(name, seen=None):
    seen = set() if seen is None else seen
    path = (ROOT / name).resolve()
    if path in seen:
        return set()
    seen.add(path)
    result = set()
    for module in IMPORT.findall(path.read_text()):
        result.add(module)
        if module.startswith("."):
            target = (path.parent / module).resolve()
            assert target.is_relative_to(ROOT) and target.is_file(), module
            result |= walk(target.relative_to(ROOT), seen)
    return result


shell = walk("extension.js")
prefs = walk("prefs.js")
assert not any(re.match(r"gi://(?:Gtk|Gdk\?|Gdk$|Adw)", m) for m in shell), shell
assert not any(re.match(r"gi://(?:St|Meta|Clutter|Shell)(?:\?|$)", m) for m in prefs), prefs
assert not any("resource:///org/gnome/shell/" in m for m in prefs), prefs
for path in [ROOT / "extension.js", ROOT / "prefs.js", *sorted((ROOT / "lib").glob("*.js")), *sorted((ROOT / "tests").glob("*.js"))]:
    subprocess.run(["node", "--check", str(path)], check=True)
    assert "SPDX-License-Identifier: GPL-3.0-or-later" in path.read_text(), path
metadata = json.loads((ROOT / "metadata.json").read_text())
assert metadata["shell-version"] == ["51"]
assert "version" not in metadata and "session-modes" not in metadata
schema = ET.parse(ROOT / "schemas/org.gnome.shell.extensions.ai-pop-down.gschema.xml").getroot().find("schema")
assert schema.get("id") == metadata["settings-schema"]
assert schema.get("path").startswith("/org/gnome/shell/extensions/")
for doc in [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]:
    for link in re.findall(r"\]\(([^)]+)\)", doc.read_text()):
        if not re.match(r"[a-z]+://|#", link):
            assert (doc.parent / link.split("#")[0]).exists(), (doc, link)
assert (ROOT / "COPYING").read_bytes() == Path("/usr/share/common-licenses/GPL-3").read_bytes() if Path("/usr/share/common-licenses/GPL-3").exists() else True
print("PASS: Shell/preferences import boundaries, syntax, source headers, metadata/schema, local documentation links and GPL text")
