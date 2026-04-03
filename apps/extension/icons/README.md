# YuktiHire Extension Icons

The existing `icon16.png`, `icon48.png`, and `icon128.png` are placeholder files.

## Generating proper PNG icons from the SVG

Use any of these methods to generate production icons from `icon.svg`:

### Option 1: ImageMagick (CLI)
```bash
magick icon.svg -resize 16x16 icon16.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 128x128 icon128.png
```

### Option 2: Inkscape (CLI)
```bash
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

### Option 3: Online
Upload `icon.svg` to https://convertio.co or https://svgtopng.com and download at 16px, 48px, and 128px sizes.
