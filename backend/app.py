import os, json, datetime, io, base64, uuid, re
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from PIL import Image

app = Flask(__name__)
CORS(app)

DB_PATH = "notes.json"
IMG_DIR = "screenshots"
if not os.path.exists(IMG_DIR): os.makedirs(IMG_DIR)

def safe_text(text):
    """Strip characters unsupported by FPDF's built-in latin-1 fonts."""
    if not text: return ""
    return text.encode("latin-1", "ignore").decode("latin-1")

def clean_title(title):
    """Remove YouTube's notification-count prefix e.g. '(416) Video Title'."""
    if not title: return "General Session"
    title = re.sub(r'^\(\d+\)\s*', '', title.strip())  # strip leading (N)
    title = re.sub(r'\s*-\s*YouTube\s*$', '', title, flags=re.IGNORECASE)  # strip trailing suffix
    return title.strip() or "General Session"

def load_notes():
    if not os.path.exists(DB_PATH): return []
    with open(DB_PATH, "r") as f: return json.load(f)

def save_notes(notes):
    with open(DB_PATH, "w") as f: json.dump(notes, f, indent=2)

def save_image(b64_data):
    if not b64_data: return None
    try:
        if "," in b64_data: b64_data = b64_data.split(",")[1]
        img_data = base64.b64decode(b64_data)
        fname = f"{IMG_DIR}/{uuid.uuid4()}.png"
        with open(fname, "wb") as f: f.write(img_data)
        return fname
    except: return None

@app.route("/save", methods=["POST"])
def save():
    data = request.json
    img_path = save_image(data.get("image", ""))
    entry = {
        "id": str(uuid.uuid4()),
        "notebook_name": clean_title(data.get("notebook_name", "General Session")),
        "video_title":   clean_title(data.get("video_title",   "General Session")),
        "video_url": data.get("video_url", ""),
        "timestamp": data.get("timestamp", "00:00"),
        "note": data.get("note", ""),
        "image_path": img_path,
        "created_at": datetime.datetime.now().isoformat()
    }
    notes = load_notes()
    notes.append(entry)
    save_notes(notes)
    return jsonify({"status": "saved", "entry": entry})

@app.route("/notebooks")
def get_notebooks():
    notes = load_notes()
    notebooks = sorted(set(n.get("notebook_name", "General Session") for n in notes))
    if "General Session" not in notebooks:
        notebooks.insert(0, "General Session")
    return jsonify(notebooks)

@app.route("/notes")
def get_notes():
    notes = load_notes()
    url = request.args.get("video_url")
    notebook_name = request.args.get("notebook_name")
    
    if notebook_name:
        notes = [n for n in notes if n.get("notebook_name", "General Session") == notebook_name]
    elif url:
        notes = [n for n in notes if n.get("video_url") == url]
        
    return jsonify(notes)

@app.route("/delete", methods=["POST"])
def delete_single():
    data = request.json or {}
    note_id = data.get("id")
    if not note_id:
        return jsonify({"error": "Missing id"}), 400
    notes = load_notes()
    new_notes = []
    for n in notes:
        if n["id"] == note_id:
            if n.get("image_path") and os.path.exists(n["image_path"]):
                try: os.remove(n["image_path"])
                except: pass
        else: new_notes.append(n)
    save_notes(new_notes)
    return jsonify({"status": "deleted"})

@app.route("/delete_all", methods=["POST"])
def delete_all():
    data = request.json or {}
    video_url = data.get("video_url")
    notebook_name = data.get("notebook_name")
    notes = load_notes()
    remains = []
    
    for n in notes:
        # If notebook_name is provided, delete notes for that notebook
        if notebook_name:
            if n.get("notebook_name", "General Session") == notebook_name:
                if n.get("image_path") and os.path.exists(n["image_path"]):
                    try: os.remove(n["image_path"])
                    except: pass
            else: remains.append(n)
        # If video_url is provided, only delete notes for that video
        elif video_url:
            if n.get("video_url") == video_url:
                if n.get("image_path") and os.path.exists(n["image_path"]):
                    try: os.remove(n["image_path"])
                    except: pass
            else: remains.append(n)
        else:
            # Master Clear: Delete all images
            if n.get("image_path") and os.path.exists(n["image_path"]):
                try: os.remove(n["image_path"])
                except: pass
    
    save_notes(remains)
    return jsonify({"status": "cleared", "total": len(remains)})

@app.route("/screenshot/<path:filepath>")
def serve_screenshot(filepath):
    if os.path.exists(filepath): return send_file(filepath, mimetype="image/png")
    return jsonify({"error": "Not found"}), 404

# ── Design tokens (exact dark navy fintech palette) ──────────────────────────
_PDF_BG       = (2,   8,  23)   # #020817  main background
_PDF_SURFACE  = (7,  18,  38)   # #071226  card surface
_PDF_OVERLAY  = (3,   7,  18)   # #030712  deep overlay
_PDF_ACCENT   = (91, 108,255)   # #5B6CFF  accent
_PDF_ACCENT2  = (122,140,255)   # #7A8CFF  accent lighter
_PDF_WHITE    = (255,255,255)   # #FFFFFF
_PDF_MID      = (138,151,176)   # #8A97B0  mid text
_PDF_FADED    = (59,  71,  93)  # #3B475D  faded text
_PDF_BORDER   = (19,  32,  58)  # #13203A  border

class NoirPDF(FPDF):
    def header(self):
        # Full-page dark background on every page
        self.set_fill_color(*_PDF_BG)
        self.rect(0, 0, 210, 297, "F")

    def footer(self):
        # Divider line
        self.set_y(-18)
        self.set_draw_color(*_PDF_BORDER)
        self.line(15, self.get_y(), 195, self.get_y())
        # Branding left + page number right
        self.set_y(-14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*_PDF_FADED)
        self.cell(0, 6, "YT NOTER PRO  |  Education Note-Taking Engine", align="L")
        self.set_y(-14)
        self.cell(0, 6, f"Page {self.page_no()}", align="R")

@app.route("/export-pdf")
def export_pdf():
    video_url = request.args.get("video_url")
    notebook_name = request.args.get("notebook_name")
    notes = load_notes()
    
    if notebook_name:
        notes = [n for n in notes if n.get("notebook_name", "General Session") == notebook_name]
    elif video_url: 
        notes = [n for n in notes if n.get("video_url") == video_url]
        
    if not notes: return jsonify({"error": "No notes found"}), 400

    pdf = NoirPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Cover header ────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_PDF_WHITE)
    pdf.cell(0, 18, "YT NOTER PRO", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*_PDF_ACCENT)
    nb_label = safe_text(notebook_name or "All Notebooks")
    pdf.cell(0, 8, f"NOTEBOOK: {nb_label.upper()}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_PDF_FADED)
    pdf.cell(0, 7, f"Generated {datetime.datetime.now().strftime('%d %b %Y, %H:%M')}",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.ln(10)

    # Group by Video
    grouped = {}
    for n in notes: grouped.setdefault(n.get("video_title", "General Notes"), []).append(n)

    for title, vnotes in grouped.items():
        # ── Video section heading ────────────────────────────────────────────
        pdf.set_fill_color(*_PDF_SURFACE)
        pdf.set_draw_color(*_PDF_ACCENT)
        pdf.set_text_color(*_PDF_WHITE)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 11, f"  {safe_text(title)}", border="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        pdf.ln(6)

        for n in vnotes:
            # Timestamp chip
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*_PDF_ACCENT)
            pdf.cell(0, 7, f"@ {safe_text(n.get('timestamp', '00:00'))}",
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Screenshot
            if n.get("image_path") and os.path.exists(n["image_path"]):
                try:
                    img = Image.open(n["image_path"])
                    w, h = img.size
                    dw = 170; dh = dw * (h / w)
                    if pdf.get_y() + dh + 10 > 270: pdf.add_page()
                    pdf.image(n["image_path"], x=20, w=dw, h=dh)
                    pdf.ln(4)
                except: pass

            # Note body
            if n.get("note"):
                pdf.set_font("Helvetica", "", 10)
                pdf.set_text_color(*_PDF_MID)
                pdf.multi_cell(0, 6, safe_text(n["note"]))

            pdf.ln(8)
            pdf.set_draw_color(*_PDF_FADED)
            pdf.line(20, pdf.get_y(), 190, pdf.get_y())
            pdf.ln(5)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    
    filename = "Pelupa_Study_Report.pdf"
    if notebook_name:
        safe_name = "".join(c for c in notebook_name if c.isalnum() or c in (' ', '-', '_')).strip()
        if safe_name:
            filename = f"{safe_name}.pdf"
            
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)

@app.route("/export-md")
def export_md():
    video_url = request.args.get("video_url")
    notebook_name = request.args.get("notebook_name")
    notes = load_notes()
    
    if notebook_name:
        notes = [n for n in notes if n.get("notebook_name", "General Session") == notebook_name]
    elif video_url: 
        notes = [n for n in notes if n.get("video_url") == video_url]
        
    ts = datetime.datetime.now().strftime("%d %b %Y, %H:%M")
    nb_label = notebook_name or "All Notebooks"
    lines = [
        f"# YT Noter Pro — Study Notes",
        f"",
        f"**Notebook:** {nb_label}  ",
        f"**Exported:** {ts}  ",
        f"",
        f"---",
        f"",
    ]
    grouped = {}
    for n in notes:
        grouped.setdefault(n.get("video_title", "General"), []).append(n)
    for title, vnotes in grouped.items():
        lines.append(f"## {title}")
        lines.append("")
        for n in vnotes:
            lines.append(f"### `{n.get('timestamp', '00:00')}`")
            if n.get("note"):
                lines.append("")
                lines.append(n["note"])
            lines.append("")
            lines.append("---")
            lines.append("")
    buf = io.BytesIO("\n".join(lines).encode("utf-8"))
    
    filename = "YTNoterPro_Notes.md"
    if notebook_name:
        safe_name = "".join(c for c in notebook_name if c.isalnum() or c in (' ', '-', '_')).strip()
        if safe_name:
            filename = f"{safe_name}.md"
            
    return send_file(buf, mimetype="text/markdown", as_attachment=True, download_name=filename)

if __name__ == "__main__":
    app.run(debug=True, port=5001)
