# Brand and media assets

| File | Source | Notes |
|---|---|---|
| `logo.svg` | Original, drawn for this project | MIT; safe to reuse with attribution |
| `social-preview.svg` / `.png` | Original composition using the logo | MIT; upload the PNG (1280×640) in repository settings |
| `hero-blocks.png` | [Icons8 Ouch](https://icons8.com/illustrations) — “Glass cube block structure” | Free Icons8 licence, free distribution |
| `community-blocks.png` | [Icons8 Ouch](https://icons8.com/illustrations) — “Building blocks house” | Free Icons8 licence, free distribution |

Icons8 illustrations are used under the
[Icons8 free licence](https://icons8.com/license). They are commercial-free with
attribution; the README and site footer credit Icons8.

**Do not** add the SolidJS logo or imply endorsement by the Solid team. See
Solid's [Media & Brand](https://www.solidjs.com/media) guidance.

## Regenerating the social preview

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --screenshot=docs/assets/social-preview.png \
  --window-size=1280,640 --hide-scrollbars \
  "file://$PWD/docs/assets/social-preview.svg"
```

The PNG is 1280×640 and is uploaded manually under Settings → General → Social
preview. There is no supported API for that upload.
