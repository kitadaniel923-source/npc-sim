"""Pack Blender-baked PNG frames into Everglen's runtime 3D mega atlas."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--columns", type=int, default=16)
    args = parser.parse_args()

    root = Path(args.input_dir)
    source = json.loads((root / "export_manifest.json").read_text())
    assets = source["assets"]
    cell = int(source["cell"])
    frames = int(source["frames"])
    columns = max(1, args.columns)
    rows = math.ceil(len(assets) / columns)
    atlas = Image.new("RGBA", (columns * cell, rows * frames * cell), (0, 0, 0, 0))
    packed = []

    for index, asset in enumerate(assets):
        x = (index % columns) * cell
        y = (index // columns) * frames * cell
        for frame, relative in enumerate(asset["frames"]):
            sprite = Image.open(root / relative).convert("RGBA")
            atlas.alpha_composite(sprite, (x, y + frame * cell))
        packed.append({
            **asset,
            "x": x,
            "y": y,
            "w": cell,
            "h": cell,
            "frames": frames,
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, format="WEBP", quality=90, method=6)
    Path(args.manifest).write_text(json.dumps({
        "version": 2,
        "type": "3d-baked-runtime-mega-atlas",
        "image": output.name,
        "cell": [cell, cell],
        "columns": columns,
        "framesPerAsset": frames,
        "assets": packed,
        "source": source["source"],
        "pipeline": "Blender import/export -> orthographic sprite bake -> atlas pack",
    }, indent=2))
    print(json.dumps({"assets": len(assets), "sprites": len(assets) * frames, "atlas": str(output)}))


if __name__ == "__main__":
    main()
