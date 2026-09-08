# website

The Kiroshi one page site.

## Run

```bash
bun run --filter=website dev
```

The page opens on http://127.0.0.1:5173.

## Read it at

The page is drawn for three viewports, all in light theme:

| Viewport | Layout |
|----------|--------|
| 1440x900 | Fullscreen |
| 2560x1080 | Fullscreen 21:9, from 2000 wide up |
| 390x844 | Mobile, under 1024 wide |

The app window interior is a slot: `<WebsitePage>{…}</WebsitePage>` fills it,
and without a child the window stays an empty bounded surface.
