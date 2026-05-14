# 🌑 YT Video to PDF Noter

**Professional-grade YouTube documentation tool with real-time automation, multi-video persistence, and "Noir Modern" PDF export.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-5.0-3b82f6.svg)]()

---

## ✨ Features

### 🎬 Documentation Engine
- **Universal Timeline**: Keep notes from multiple videos in a single session. Smart title-detection automatically sections your timeline with blue headers.
- **SNAP (Instant Capture)**: Manual high-resolution snapshots with a single click or `Alt+S`.
- **LIVE (Auto-Snap)**: Set a custom interval (e.g., 30s) and let the engine document the video automatically with a breathing pulse animation.
- **SCAN (Deep Skimmer)**: Deep-scan entire videos in seconds to create a visual index.
- **You can take screenshot during fullscreen view mode**
<img width="270" height="142" alt="image" src="https://github.com/user-attachments/assets/36b7945d-0c53-4c48-9a5a-3e8a651efc72" />
<img width="214" height="93" alt="image" src="https://github.com/user-attachments/assets/41e6136d-0397-4cf4-b4cd-b001fe6233f1" />

### 🧠 Adaptive UI & Behavior
- **Normal Mode (Focus View)**: Hiding the sidebar cleanly slides it off-screen to remove distractions. You can always restore it instantly via the native **"OPEN YT NOTER PRO"** toggle next to the YouTube title.
- **Fullscreen Floating Pill**: When in fullscreen mode, hiding the sidebar shrinks it into an ultra-minimal floating pill (just a drag handle and SNAP button) so it never obscures your video but keeps core actions one click away. Entering fullscreen automatically reveals the pill even if the sidebar was hidden in normal mode.
- **SPA Robustness**: Engineered to survive YouTube's heavy Single-Page Application (SPA) navigations. Controls dynamically adapt and reinject to the actively visible video title without requiring page reloads.

### 🌑 Noir Design System
- **Midnight Aesthetic**: Deep charcoal theme (`#0b0e14`) with neon blue accents.
- **Glassmorphism**: Modern, translucent UI components that feel premium and integrated.
- **Micro-Animations**: Smooth transitions, breathing pulses, and radar scanning effects.

### 📄 Export & Security
- **Noir PDF Engine**: Export professional "Dark Mode" reports with charcoal backgrounds and neon accents.
- **Master Clear (Double-Lock)**: Intelligent safety guards that warn you twice if you haven't exported your notes yet.
- **Ironclad Security**: 100% CSP-compliant architecture (Zero-String DOM construction) for total safety on YouTube.

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment

# Windows (PowerShell)
venv\Scripts\Activate.ps1

# Windows (CMD)
venv\Scripts\activate.bat

cd backend
pip install -r requirements.txt
python app.py
```

### 2. Extension Installation
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer Mode**.
3. Click **Load Unpacked** and select the `extension` folder from this repo.

### 3. Documentation
- Open any YouTube video.
- Click the **"OPEN YT NOTER PRO"** button below the video title.
- Start capturing!

---

## 🛠 Tech Stack
- **Frontend**: Pure Vanilla JS (Zero-String Architecture), CSS3 (Modern Flex/Grid), MutationObservers for SPA handling.
- **Backend**: Python Flask, CORS-enabled.
- **PDF Engine**: FPDF2 & Pillow (High-DPI Noir Rendering).

---

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

---
*Developed with 💙 by Ravi Prakash.*