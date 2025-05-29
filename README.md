# EXIF Photo Printer

A minimal desktop application for creating printable photos with EXIF camera data displayed in clean borders.

## Features

- **Drag & Drop Interface** - Simply drag photos into the app
- **EXIF Data Integration** - Automatically extracts and displays camera settings
- **Multiple Print Sizes** - 4x6, 5x7, 8x10, 8x12, 11x14, and 5x5 square formats  
- **Batch Processing** - Download all prints at once to a selected folder
- **Professional Output** - 300 DPI resolution for high-quality printing
- **Dark Mode Support** - Clean, minimal interface with native macOS feel

## Quick Start

1. Launch the app
2. Drag photos into the window
3. Adjust global settings (print size, fit mode)
4. Click "Download All" to save prints to your chosen folder
5. Use "Open in Finder" to view saved files

## Technical Details

- Built with **Electron** and **Vue 3**
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
