#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Development-only packager; nothing from tools/ is installed."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
UUID = "ai-pop-down-extension@edjenn1998.github.io"
FILES = ["metadata.json", "extension.js", "prefs.js", "stylesheet.css", "LICENSE", "COPYING"]
FILES += [str(p.relative_to(ROOT)) for folder in ("lib", "icons", "schemas")
          for p in sorted((ROOT / folder).rglob("*")) if p.is_file() and p.suffix != ".compiled"]
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)
DEST = DIST / f"{UUID}.shell-extension.zip"

with tempfile.TemporaryDirectory(prefix="ai-pop-down-build-") as temp:
    stage = Path(temp)
    for name in FILES:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    subprocess.run(["glib-compile-schemas", "--strict", str(stage / "schemas")], check=True)
    if shutil.which("gnome-extensions"):
        subprocess.run(["gnome-extensions", "pack", "--force", "--out-dir", str(DIST),
                        "--extra-source", "lib", "--extra-source", "icons",
                        "--extra-source", "LICENSE", "--extra-source", "COPYING", str(stage)], check=True)
        print("Packaged with gnome-extensions pack")
    else:
        with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(stage.rglob("*")):
                if path.is_file():
                    info = zipfile.ZipInfo(str(path.relative_to(stage)), (2026, 1, 1, 0, 0, 0))
                    info.external_attr = 0o100644 << 16
                    info.compress_type = zipfile.ZIP_DEFLATED
                    archive.writestr(info, path.read_bytes())
        print("gnome-extensions unavailable: used standard ZIP format with compiled schema")

with zipfile.ZipFile(DEST) as archive:
    assert archive.testzip() is None, "ZIP checksum failed"
    names = set(archive.namelist())
    expected = set(FILES) | {"schemas/gschemas.compiled"}
    assert names == expected, f"Unexpected package contents: {names ^ expected}"
    metadata = json.loads(archive.read("metadata.json"))
    assert metadata["uuid"] == UUID and metadata["shell-version"] == ["51"]
    assert "version" not in metadata and "session-modes" not in metadata
    assert "clipboard" in metadata["description"].lower()
    for name in sorted(names):
        print(f"  {name}")
digest = hashlib.sha256(DEST.read_bytes()).hexdigest()
(DIST / "SHA256SUMS").write_text(f"{digest}  {DEST.name}\n", encoding="utf-8")
print(f"ZIP: {DEST}\nSHA256: {digest}")
