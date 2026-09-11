# EXIF Photo Printer

A minimal desktop application for creating printable photos with EXIF camera data displayed in clean borders.

## Features

- **Drag & Drop Interface** - Simply drag photos into the app
- **EXIF Data Integration** - Automatically extracts and displays camera settings
- **Multiple Print Sizes** - 4x6, 5x7, 8x10, 8x12, 11x14, and 5x5 square formats  
- **Batch Processing** - Download all prints at once to a selected folder
- **Professional Output** - 300 DPI resolution for high-quality printing
- **Dark Mode Support** - Clean, minimal interface with native macOS feel
- **Rank by Taste** - Scores every photo on contrast, tonal range, symmetry and subject
  placement, then sorts your best work to the front
- **Collapse Bursts** - Keeps the best frame of each run of near-identical shots
- **Paginated contact sheets** - Every photo across as many sheets as it takes, with
  continuous rank numbering
- **MCP server** - The whole pipeline, card to print, driveable by an agent

## Choosing photos

Two buttons do the selecting.

**Rank by Taste** scores each photo on contrast, tonal range, symmetry, and how centred
its single subject is, then reorders the tray best first. It is a port of
[ejtaste](https://github.com/ejfox/ejtaste) v1 with the same weights.

**Collapse Bursts** keeps only the best frame of each run of near-identical shots. Two
frames count as the same shot only when they are close in time *and* look alike, so
shooting steadily while walking is not mistaken for a burst.

Frames that are dark *and* have no highlights anywhere are set aside as featureless,
which is what a camera firing inside a bag looks like. Night photographs keep their
highlights, so fireworks and lit streets are not thrown away.

## Agent control (MCP)

The app ships an MCP server exposing ten tools: card import, EXIF, ranking, selection,
Finder tagging, contact sheets and single prints. A whole card, start to finish:

```
import_card   source=/Volumes/UNTITLED/DCIM  dest=~/Pictures/2026-09-10-card
select_best   folder=~/Pictures/2026-09-10-card  n=250
tag_photos    paths=<returned paths>  tag=Yellow
make_contact_sheets  paths=<returned paths>  out_dir=~/Pictures/contacts
```

Setup and the full tool list are in [mcp/README.md](mcp/README.md).

## Quick Start

1. Launch the app
2. Drag photos into the window
3. Adjust global settings (print size, fit mode)
4. Click "Download All" to save prints to your chosen folder
5. Use "Open in Finder" to view saved files

## Technical Details

- Built with **Tauri** and **Vue 3**
- Uses **exifr** library for EXIF data extraction
- **Canvas-based** image processing for precise layout
- **Code signed** for macOS distribution
- **Unsandboxed** for full directory access

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
npm run electron:dev

# Build for production
npm run build
npm run build:electron

# Distribution build (creates DMG)
npm run dist
```

## Release Management

```bash
# Version bumping
npm run version:patch  # 1.0.0 → 1.0.1
npm run version:minor  # 1.0.0 → 1.1.0
npm run version:major  # 1.0.0 → 2.0.0

# Build and release to GitHub
npm run release        # Release current version
npm run release:patch  # Bump patch version and release
npm run release:minor  # Bump minor version and release
npm run release:major  # Bump major version and release
```

## macOS Permissions

For development mode, grant Terminal.app "Full Disk Access" in System Preferences > Security & Privacy > Privacy.

The built app includes proper entitlements for directory access.

## Output Format

Each print includes:
- Original photo (auto-rotated for portraits)
- 0.3" border with EXIF data:
  - Camera make/model
  - Lens information  
  - Exposure settings (aperture, shutter, ISO)
  - Date/time in DD.MM.YY format
  - Additional metadata when available

Perfect for photographers who want clean, professional prints with technical details preserved.
