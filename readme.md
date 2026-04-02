# Hotstar Ad Muter — Chrome Extension

Automatically mutes ads on Disney+ Hotstar during IPL, live sports, and video streaming. Detects ads by intercepting Hotstar's ad tracking requests — no DOM selectors, no breaking on UI updates.

## Features

- 🔇 Auto-mutes all ads on Hotstar
- ▶️ Auto-unmutes when ad ends
- ⚡ Detects ad duration from Hotstar's own tracking data
- 🏏 Works great during IPL and live sports ad breaks
- 🔁 Handles back-to-back ads correctly

## Install

1. Click the green **Code** button → **Download ZIP**
2. Unzip the folder
3. Open Chrome → go to `chrome://extensions/`
4. Enable **Developer Mode** (top-right toggle)
5. Click **Load unpacked** → select the unzipped folder
6. Open Hotstar and enjoy 🔇

> Works on all Chromium-based browsers too — Brave, Edge, Arc. Just go to `brave://extensions/` or `edge://extensions/` instead.

## Update (when I push changes)

1. Download ZIP again
2. Go to `chrome://extensions/`
3. Click the 🔄 refresh icon on the extension card

## How It Works

Hotstar fires a tracking request to their ad billing server every time an ad plays. That request contains the ad name and its duration. This extension intercepts that request, mutes the tab, and unmutes it automatically when the ad duration is over — or earlier if the ad gets cut short.

No fragile CSS selectors. No breaking when Hotstar updates their UI.

## Contributing

PRs welcome! If you see an ad that isn't being muted, open the extension's service worker console (`chrome://extensions/` → Inspect views → service worker) and share the `Ad detected:` log line in an issue.

---

> Built for IPL 2026 🏏 — because Vimal Elaichi ads deserve silence.