# YT Noter v2 — AI-Powered YouTube Notes Tool

## Project Overview
A Chrome Extension + Python Flask backend that replicates and extends Askify's features.
Uses Claude AI (via Anthropic API) for AI-powered features like Image-to-Text OCR, Smart Summaries, Auto-Notes generation.

## Architecture
```
Chrome Extension (Sidebar UI) <──HTTP──> Flask Backend (localhost:5001)
                                              │
                                              ├── Claude AI API (OCR, summaries)
                                              ├── screenshots/ (saved images)
                                              └── notes.json (persistent storage)
```

## Features Implemented
1. Screenshot — Canvas API captures high-quality frame regardless of stream quality
2. Write/Crop — Canvas-based annotation tool in sidebar
3. Timestamp — Auto-inserted from video.currentTime
4. AutoSnap — Configurable interval screenshot (default 30s)
6. Markdown & Shortcuts — Full markdown editor with keyboard shortcuts
7. Fullscreen support — Sidebar overlays fullscreen YouTube player
8. Transparency Mode — Sidebar opacity slider
10. Floating Editor — Draggable sidebar anywhere on screen
11. Export PDF — fpdf2 generates structured PDF with screenshots
12. Export Markdown — Raw .md file download
13. Works on all websites — content script runs on all URLs


## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | /ping | Health check |
| POST | /save | Save note + screenshot |
| GET | /notes | Get all notes |
| GET | /notes?video_url=X | Filter by video |
| DELETE | /delete/<id> | Delete note |
| GET | /export-pdf | Download PDF |
| GET | /export-md | Download Markdown |
| GET | /screenshot/<path> | Serve screenshot image |

## Setup Instructions
```bash
# 1. Install Python deps
cd backend
pip install flask flask-cors pillow fpdf2 anthropic


# 3. Start backend
python app.py
# Runs at http://localhost:5001

# 4. Load Chrome Extension
# chrome://extensions → Developer mode → Load unpacked → select extension/
```

## Keyboard Shortcuts (in sidebar)
| Shortcut | Action |
|----------|--------|
| Alt+S | Take screenshot |
| Alt+N | New note |
| Alt+A | Toggle AutoSnap |
| Alt+T | Insert timestamp |
| Alt+E | Export PDF |
| Alt+H | Toggle sidebar |

## File Structure
```
yt-noter-v2/
├── CLAUDE.md               ← This file
├── backend/
│   ├── app.py              ← Flask server
│   └── requirements.txt
└── extension/
    ├── manifest.json
    ├── content.js          ← Main content script (all websites)
    ├── sidebar.html        ← Sidebar UI injected into page
    ├── sidebar.css         ← Sidebar styles
    ├── sidebar.js          ← Sidebar logic
    └── icons/
        └── icon48.png
```

## Tech Stack
- **Frontend**: Vanilla JS + CSS (no framework, fast injection)
- **Backend**: Python Flask + flask-cors
- **PDF**: fpdf2
- **Image Processing**: Pillow
- **Storage**: JSON file + local filesystem (screenshots/)
