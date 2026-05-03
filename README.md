# YT Noter v2 — AI-Powered YouTube Notes

## Quick Start

### 1. Start Backend
```bash
cd backend
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
python app.py
```

### 2. Load Extension in Chrome
- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `extension/` folder

### 3. Open Any YouTube Video
- Click the **NOTES** handle on the right edge of screen
- Or press **Alt+H** to toggle sidebar

## Features
| Feature | How |
|---------|-----|
| Screenshot | Click 📸 Snap or Alt+S |
| AI AutoNote | Take screenshot → click 🤖 AutoNote |
| OCR | Take screenshot → click 🔤 OCR |
| AutoSnap | Click ⏱ AutoSnap (auto screenshots every N seconds) |
| AI Summary | Click ✨ Summary |
| Ghost mode | Click 👁 Ghost (sidebar becomes transparent) |
| Export PDF | Click ⬇ PDF in footer |
| Export MD  | Click ⬇ MD in footer |

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Alt+S | Screenshot |
| Alt+H | Toggle sidebar |
| Alt+N | Focus note editor |
| Alt+A | Toggle AutoSnap |
| Alt+T | Insert timestamp in editor |
| Alt+Enter | Save note |

## Needs ANTHROPIC_API_KEY for: AutoNote, OCR, Summary
