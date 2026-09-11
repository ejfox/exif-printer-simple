#!/usr/bin/env python3
"""MCP server for EXIF Photo Printer.

Exposes the printer's rendering and the photo-selection pipeline as tools, so an agent
can take a memory card from import to ranked, deduped, tagged, printed output without
touching the GUI.

Run: .venv-mcp/bin/python mcp/server.py
"""
from __future__ import annotations

import os

from mcp.server.mcpserver import MCPServer

import ejprint as ep

server = MCPServer(
    name="exif-printer",
    instructions=(
        "Photo import, selection and printing for EJ's Fuji workflow.\n"
        "Typical order: import_card -> rank_photos -> select_best -> tag_photos -> "
        "make_contact_sheets / make_print.\n"
        "Tagging rule: tag machine picks Yellow. Green is a publish action in this "
        "setup (a Finder Quick Action uploads every Green file to Cloudinary), so "
        "never apply Green automatically."
    ),
)


@server.tool(description="List the print sizes the app supports, in pixels at 300 DPI.")
def list_print_sizes() -> dict:
    return {k: f"{w}x{h}" for k, (w, h) in ep.PRINT_SIZES.items()}


@server.tool(description="Read EXIF for specific files or every image in a folder.")
def read_photo_exif(paths: list[str] | None = None, folder: str | None = None,
                    tags: list[str] | None = None, recursive: bool = False) -> list[dict]:
    return ep.read_exif(ep.resolve(paths, folder, recursive), tags)


@server.tool(description=(
    "Flatten a camera card (DCIM tree) into one folder, renaming each file with its "
    "capture date so a single folder sorts chronologically. Copies, never moves."))
def import_card(source: str, dest: str, date_prefix: bool = True,
                extensions: list[str] | None = None) -> dict:
    return ep.flatten_card(source, dest, date_prefix=date_prefix, extensions=extensions)


@server.tool(description=(
    "Score photos with EJ-taste v1: contrast, tonal range, symmetry, and one visible "
    "subject as centered as possible. Returns every photo ranked best first. Frames that "
    "are dark with no highlights anywhere are flagged featureless (camera fired in a bag) "
    "and excluded from the scoring population; real night shots keep their highlights and stay."))
def rank_photos(folder: str | None = None, paths: list[str] | None = None,
                recursive: bool = False, csv_out: str | None = None,
                limit: int | None = None) -> dict:
    files = ep.resolve(paths, folder, recursive)
    rows = ep.score_photos(files)
    out = {"scored": sum(1 for r in rows if r.get("ejtaste") is not None),
           "featureless": sum(1 for r in rows if r.get("featureless")),
           "total": len(rows)}
    if csv_out:
        out["csv"] = ep.write_csv(rows, csv_out)
    out["ranked"] = [{"file": r["file"], "ejtaste": r["ejtaste"]}
                     for r in rows[:(limit or 50)] if r.get("ejtaste") is not None]
    return out


@server.tool(description=(
    "Rank, then collapse near-duplicates and return the best N. Two frames count as the "
    "same shot only if they are close in time AND look alike, so shooting steadily while "
    "walking does not get over-collapsed. Returns full paths ready to tag or print."))
def select_best(folder: str | None = None, paths: list[str] | None = None,
                n: int = 250, within_seconds: int = 30, hash_distance: int = 10,
                recursive: bool = False, csv_out: str | None = None) -> dict:
    files = ep.resolve(paths, folder, recursive)
    rows = ep.score_photos(files)
    keepers = ep.collapse_duplicates(rows, within_seconds, hash_distance)
    picks = keepers[:n] if n else keepers
    res = {
        "input": len(files),
        "featureless_dropped": sum(1 for r in rows if r.get("featureless")),
        "keepers_after_dedupe": len(keepers),
        "collapsed": sum(1 for r in rows if r.get("ejtaste") is not None) - len(keepers),
        "returned": len(picks),
        "score_range": [picks[0]["ejtaste"], picks[-1]["ejtaste"]] if picks else None,
        "paths": [r["path"] for r in picks],
    }
    if csv_out:
        res["csv"] = ep.write_csv(keepers, csv_out)
    return res


@server.tool(description=(
    "Add or remove one macOS Finder tag. Additive: other tags are preserved, so a re-run "
    "never clobbers a tag a person set. Use Yellow for machine picks. Do not apply Green "
    "automatically, it publishes."))
def tag_photos(paths: list[str], tag: str = "Yellow", remove: bool = False) -> dict:
    if tag == "Green" and not remove:
        return {"refused": "Green is a publish action here; tag Yellow and let a person "
                           "promote to Green."}
    return ep.tag_photos([os.path.expanduser(p) for p in paths], tag, remove=remove)


@server.tool(description=(
    "List files in a folder carrying a Finder tag. Reads the files directly rather than "
    "Spotlight, which lags several minutes after bulk tagging."))
def find_tagged(folder: str, tag: str = "Yellow") -> dict:
    hits = ep.find_tagged(folder, tag)
    return {"tag": tag, "count": len(hits), "paths": hits}


@server.tool(description=(
    "Render paginated contact sheets plus one PDF. Pages past any photo count, prints "
    "rank and EXIF under every frame, dark or light theme."))
def make_contact_sheets(out_dir: str, folder: str | None = None,
                        paths: list[str] | None = None, title: str = "CONTACT SHEET",
                        subtitle: str | None = None, cols: int = 4, rows: int = 5,
                        width: int = 2400, theme: str = "dark",
                        show_rank: bool = True, recursive: bool = False) -> dict:
    files = ep.resolve(paths, folder, recursive)
    return ep.contact_sheets(files, out_dir, title=title, subtitle=subtitle, cols=cols,
                             rows=rows, width=width, theme=theme, show_rank=show_rank)


@server.tool(description=(
    "Render one photo as a printable sheet with its camera data in the border, at the "
    "app's 300 DPI dimensions. fit is contain (whole frame, default) or cover (fill)."))
def make_print(path: str, out_path: str, print_size: str = "4x6",
               fit: str = "contain", caption: str | None = None,
               show_exif: bool = True) -> dict:
    return ep.exif_print(os.path.expanduser(path), os.path.expanduser(out_path),
                         print_size=print_size, fit=fit, caption=caption,
                         show_exif=show_exif)


@server.tool(description="Render a whole folder or list of photos as individual prints.")
def make_prints(out_dir: str, folder: str | None = None, paths: list[str] | None = None,
                print_size: str = "4x6", fit: str = "contain",
                show_exif: bool = True, recursive: bool = False) -> dict:
    files = ep.resolve(paths, folder, recursive)
    out_dir = os.path.expanduser(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for p in files:
        base = os.path.splitext(os.path.basename(p))[0]
        out = os.path.join(out_dir, f"{base}_{print_size}.jpg")
        try:
            ep.exif_print(p, out, print_size=print_size, fit=fit, show_exif=show_exif)
            written.append(out)
        except Exception as e:
            written.append(f"FAILED {p}: {e}")
    return {"count": len([w for w in written if not w.startswith("FAILED")]),
            "out_dir": out_dir, "files": written[:50]}


if __name__ == "__main__":
    server.run("stdio")
