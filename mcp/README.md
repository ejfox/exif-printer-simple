# MCP server

Drives EXIF Photo Printer from an agent. Same job as the desktop app, no GUI: take a
memory card from import through ranking, deduplication and tagging to finished prints
and contact sheets.

## Setup

```bash
uv venv .venv-mcp --python 3.12
uv pip install --python .venv-mcp/bin/python -r mcp/requirements.txt
```

Needs `exiftool` on PATH (`brew install exiftool`).

Register it with Claude Code:

```bash
claude mcp add exif-printer -- /absolute/path/to/exif-printer-simple/.venv-mcp/bin/python \
  /absolute/path/to/exif-printer-simple/mcp/server.py
```

Or add to `~/.claude.json` under `mcpServers`:

```json
"exif-printer": {
  "type": "stdio",
  "command": "/absolute/path/to/exif-printer-simple/.venv-mcp/bin/python",
  "args": ["/absolute/path/to/exif-printer-simple/mcp/server.py"],
  "env": {}
}
```

## Tools

| Tool | What it does |
|---|---|
| `list_print_sizes` | The print dimensions the app supports, in pixels at 300 DPI |
| `read_photo_exif` | EXIF for given files or a whole folder |
| `import_card` | Flatten a DCIM tree into one folder, renaming by capture date |
| `rank_photos` | Score photos with EJ-taste v1, best first |
| `select_best` | Rank, collapse near-duplicates, return the best N |
| `tag_photos` | Add or remove a Finder tag, additively |
| `find_tagged` | List files carrying a tag, reading files rather than Spotlight |
| `make_contact_sheets` | Paginated proof sheets plus one PDF |
| `make_print` | One photo as a printable sheet with EXIF in the border |
| `make_prints` | The same across a folder |

## A card, end to end

```
import_card   source=/Volumes/UNTITLED/DCIM  dest=~/Pictures/2026-09-10-card
select_best   folder=~/Pictures/2026-09-10-card  n=250  csv_out=~/Pictures/scores.csv
tag_photos    paths=<the returned paths>  tag=Yellow
make_contact_sheets  paths=<the returned paths>  out_dir=~/Pictures/contacts
```

## Two rules worth knowing

**Green publishes.** In this setup a Finder Quick Action uploads every Green file it
finds to Cloudinary. So machine picks are tagged Yellow and a person promotes the
keepers to Green. `tag_photos` refuses to apply Green for exactly this reason.

**Dark is not the same as worthless.** A frame is discarded only when it is dark *and*
has no highlights anywhere, which is what a camera firing inside a bag looks like.
Fireworks and night street scenes are dark on average but keep their highlights, so
they survive. Filtering on brightness alone throws away real night photography.

## Shared scoring

`mcp/ejprint.py` and `src/composables/useTasteRanking.ts` implement the same EJ-taste v1
blend: contrast 0.31, tonal range 0.13, symmetry 0.28, subject placement 0.28, applied
to z-scores across the set. `src/composables/__tests__/useTasteRanking.spec.ts` pins the
TypeScript output to values measured from the Python on an identical synthetic frame, so
the two cannot drift apart unnoticed.

Scoring originates in [ejtaste](https://github.com/ejfox/ejtaste).
