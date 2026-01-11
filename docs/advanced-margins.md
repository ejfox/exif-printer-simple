# Advanced Margin Controls

## Overview
The EXIF Photo Printer now features a professional-grade, modular margin control system that allows precise control over bleeds, safety margins, and individual side spacing.

## Margin Types

### 1. Text Safety Margin (Text Bleed)
- **Purpose**: Distance from print edge to EXIF text
- **Range**: 20-150 pixels
- **Default (Normal)**: 30px (0.1" at 300 DPI)
- **Default (Commercial Safe)**: 75px (0.25" at 300 DPI)
- **Use Case**: Protect text from commercial printer cutting

### 2. Image Safety Margin (Image Bleed)
- **Purpose**: Distance from print edge to image content
- **Range**: 30-300 pixels
- **Default (Normal)**: 90px (0.3" at 300 DPI)
- **Default (Commercial Safe)**: 180px (0.6" at 300 DPI)
- **Use Case**: Create aesthetic borders and protect image from edge damage

### 3. Individual Side Margins
- **Purpose**: Override margins on specific sides (top, bottom, left, right)
- **Range**: 0-500 pixels
- **Default**: Uses Image Safety Margin value
- **Use Case**: Create asymmetric layouts, compensate for specific printer biases

## How It Works

### Automatic Mode (Default)
When "Commercial Print Safe" is enabled:
- Text safety margin: 75px (protects against 0.25" cutting)
- Image safety margin: 180px (generous border)

When disabled:
- Text safety margin: 30px (minimal for home printing)
- Image safety margin: 90px (standard border)

### Manual Override Mode
1. Click "⚙️ Advanced Margin Controls" to expand
2. Adjust sliders to set custom values
3. Values override automatic calculations
4. Click "Reset to auto" to return to automatic mode

### Individual Side Overrides
- Override specific sides for asymmetric layouts
- Useful for compensating for printer-specific cutting patterns
- Leave blank (null) to use the global image safety margin

## Professional Workflow Examples

### Scenario 1: CVS/Walmart Printing with Extra Top Protection
```
Commercial Print Safe: ✓ ON
Advanced Margins:
  Text Safety: Auto (75px)
  Image Safety: Auto (180px)
  Individual Overrides:
    Top: 200px (extra protection for top edge)
    Others: Auto
```

### Scenario 2: Home Printing with Minimal Borders
```
Commercial Print Safe: ✗ OFF
Advanced Margins:
  Text Safety: 25px (custom minimal)
  Image Safety: 60px (tighter than default)
```

### Scenario 3: Gallery Print with Wide Bottom Margin for Signature
```
Commercial Print Safe: ✗ OFF
Advanced Margins:
  Text Safety: Auto (30px)
  Image Safety: Auto (90px)
  Individual Overrides:
    Bottom: 250px (space for hand-written signature)
```

### Scenario 4: Asymmetric Layout for Binding
```
Advanced Margins:
  Individual Overrides:
    Left: 250px (binding edge)
    Right: 90px (standard)
    Top: 90px (standard)
    Bottom: 90px (standard)
```

## Technical Implementation

### Margin Calculation Method
```javascript
calculateMargins(sizeConfig) {
  // Determine text bleed (custom or automatic)
  const textBleedMargin = this.globalSettings.textBleedMargin !== null 
    ? this.globalSettings.textBleedMargin 
    : (this.globalSettings.commercialPrintSafe ? 75 : 30)
  
  // Determine image bleed (custom or automatic)
  const baseImageMargin = this.globalSettings.imageBleedMargin !== null
    ? this.globalSettings.imageBleedMargin
    : (this.globalSettings.marginSize || (this.globalSettings.commercialPrintSafe ? 180 : 90))
  
  // Apply individual side overrides
  return {
    top: this.globalSettings.topMargin !== null ? this.globalSettings.topMargin : baseImageMargin,
    bottom: this.globalSettings.bottomMargin !== null ? this.globalSettings.bottomMargin : baseImageMargin,
    left: this.globalSettings.leftMargin !== null ? this.globalSettings.leftMargin : baseImageMargin,
    right: this.globalSettings.rightMargin !== null ? this.globalSettings.rightMargin : baseImageMargin,
    textBleed: textBleedMargin
  }
}
```

### Usage in Rendering
```javascript
const margins = this.calculateMargins(sizeConfig)
const imageArea = {
  x: margins.left,
  y: margins.top,
  width: sizeConfig.width - margins.left - margins.right,
  height: sizeConfig.height - margins.top - margins.bottom
}
const textPad = margins.textBleed
```

## Benefits

1. **Modularity**: Each margin type is independently controllable
2. **Flexibility**: Supports both symmetric and asymmetric layouts
3. **Professional Control**: Fine-tune margins to pixel precision
4. **Safety**: Maintains commercial print safety while allowing customization
5. **Intuitive**: Auto mode works for most users, advanced mode for pros
6. **Non-Destructive**: Easy to reset to automatic values

## UI Design Philosophy

- **Progressive Disclosure**: Advanced controls hidden by default
- **Smart Defaults**: Automatic mode handles 90% of use cases
- **Visual Feedback**: Real-time display of actual values and measurements
- **Easy Reset**: Quick return to automatic calculations
- **Clear Labels**: Each control explains its purpose

## Future Enhancements

Potential future additions:
- Preset margin templates (Gallery, Commercial, Minimal, etc.)
- Save/load custom margin configurations
- Per-photo margin overrides
- Visual margin guides on canvas
- Bleed zone indicators
