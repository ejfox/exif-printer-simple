# Changelog

All notable changes to EXIF Photo Printer.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-11

The app stops being only a renderer and starts having an opinion about which photos are
worth printing. Everything it can do is also reachable by an agent over MCP.

### Added

- **Rank by Taste.** Scores every loaded photo on contrast, tonal range, symmetry and
  how centred its single subject is, then sorts the tray best first. Scores stay on each
  photo so contact sheets can print them. Port of
  [ejtaste](https://github.com/ejfox/ejtaste) v1, weights unchanged.
- **Collapse Bursts.** Keeps the best frame of each run of near-identical shots and drops
  the rest. Two frames count as the same shot only when they are close in time *and* look
  alike, so shooting steadily while walking is not mistaken for a burst.
- **Paginated contact sheets.** `generateContactSheets` renders every photo across as many
  sheets as it takes, with continuous rank numbering. Previously anything past the first
  56 frames was silently dropped.
- **Contact sheet options.** `showRank`, `rankOffset`, `title`, and a `dark` theme
  alongside the original paper look.
- **MCP server** (`mcp/`). Ten tools covering the whole path from card to print: card
  import, EXIF, ranking, selection, Finder tagging, contact sheets and single prints.
  See [mcp/README.md](mcp/README.md).
- **Dark-frame detection.** Frames that are dark *and* have no highlights anywhere are
  flagged as featureless, which is what a camera firing inside a bag produces. They are
  excluded from scoring so they cannot skew the population.
- 38 new tests covering scoring, deduplication and pagination.

### Changed

- `generateContactSheet` gained optional rank, title and theme parameters. The existing
  call signature and default appearance are unchanged.

### Notes

- Night photographs survive the dark-frame filter. Fireworks and lit street scenes are
  dark on average but keep their highlights; only frames with no highlight at all are
  discarded. Filtering on average brightness alone throws away real night work.
- The MCP server will not apply a Green Finder tag. Green triggers a publish in this
  workflow, so machine picks are tagged Yellow and a person promotes them.
- `useTasteRanking.ts` and `mcp/ejprint.py` implement the same blend. The TypeScript test
  suite pins its output to values measured from the Python on an identical frame, so the
  two implementations cannot drift apart unnoticed.

## [1.1.1] - 2026-01-26

### Fixed

- Aligned the Tauri bundle version with `package.json`.

## [1.1.0]

### Added

- Modular advanced margin controls for professional printing workflows.

### Changed

- Refined print layout and general UI polish.

## [1.0.2]

### Fixed

- CI workflow corrections and test updates.
- Increased text safety margins so EXIF data is not cut off in commercial printing.

## [1.0.1] - 2025-06-01

First tagged release: drag and drop photos, EXIF borders, multiple print sizes, batch
export at 300 DPI.

[1.2.0]: https://github.com/ejfox/exif-printer-simple/releases/tag/v1.2.0
[1.1.1]: https://github.com/ejfox/exif-printer-simple/releases/tag/v1.1.1
[1.1.0]: https://github.com/ejfox/exif-printer-simple/releases/tag/v1.1.0
[1.0.2]: https://github.com/ejfox/exif-printer-simple/releases/tag/v1.0.2
[1.0.1]: https://github.com/ejfox/exif-printer-simple/releases/tag/v1.0.1
