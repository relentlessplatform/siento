# 📔 Journal PWA

A beautiful, Apple-inspired personal journal app — built as a Progressive Web App with Supabase.

---

## Features
- ✍️ Rich journal entries with title, text, date/time
- 😊 Emotion picker (10 moods)
- ⚡ Energy level tracker (1-5)
- 📍 Location (manual or GPS auto-detect via Nominatim)
- 🎵 Song / track logging
- 🖼️ Photo attachments
- 🏷️ Tags
- 📊 Mood tracker dashboard with bar chart
- 🖼️ Memories grid (photos from all entries)
- 🔐 Username + password auth (no email required)
- 📱 PWA — installable on iPhone, Android, desktop
- 🌙 Dark mode only

---

## Supabase Setup (Required)

1. Open your Supabase project → **SQL Editor**
2. Paste and run the contents of **`SUPABASE_SETUP.sql`**
3. That's it! Tables, RLS policies, and storage bucket are created automatically.

---

## Running the App

Since this is plain HTML/CSS/JS, you need a static web server (not `file://` due to SW registration):

### Option A — VS Code Live Server
Install the **Live Server** extension and click "Go Live".

### Option B — Python
```bash
cd journal-app
python3 -m http.server 8080
# Open http://localhost:8080
```

### Option C — Node.js serve
```bash
npx serve journal-app
```

### Option D — Deploy to Netlify / Vercel
Drag the `journal-app` folder to [netlify.com/drop](https://netlify.com/drop).

---

## Installing as PWA

- **iPhone/iPad**: Open in Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Add to Home Screen
- **Desktop Chrome/Edge**: Address bar → Install icon

---

## File Structure
```
journal-app/
├── index.html          # App shell
├── style.css           # All styles
├── app.js              # All logic (auth, CRUD, UI)
├── sw.js               # Service Worker (offline support)
├── manifest.json       # PWA manifest
├── SUPABASE_SETUP.sql  # DB schema
└── icons/              # App icons (add 192×192 and 512×512 PNGs)
```

---

## Icons
Add two PNG files to the `icons/` folder:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

You can generate them from any icon at [maskable.app](https://maskable.app/editor).
