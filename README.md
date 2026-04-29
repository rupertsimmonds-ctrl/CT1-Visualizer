# CT1 Visualizer

Live broker-facing site for City Tower 1, served on Vercel.

The site **is** the two HTML files at the repo root, served unchanged. A
tiny Next.js wrapper picks the right HTML based on user agent:

- iPhone / Android Mobile → `public/mobile.html` (= `CT1 Visualizer Mobile.html`)
- Everything else (laptop / desktop / iPad) → `public/desktop.html` (= `CT1 Visualiser.html`)

Both HTMLs already self-fetch from the Google Sheets `07_HTML_Export`
tab via gviz JSONP every 5 minutes — no server required.

## Routes

| URL | What you get |
|---|---|
| `/` | Auto-routed by user-agent (mobile or desktop) |
| `/m` or `/mobile` | Force the mobile HTML |
| `/d` or `/desktop` | Force the desktop HTML |
| `/mobile.html` / `/desktop.html` | Served directly from `public/` |

## Updating the site

When you tweak either HTML file, just commit and push. The build script
copies them into `public/` on every deploy via the `prebuild` step (or
copy them manually with `cp "CT1 Visualizer Mobile.html" public/mobile.html`).

## Deploy on Vercel

Already wired. Pushes to `main` auto-deploy.
