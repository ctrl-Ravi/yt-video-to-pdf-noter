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
    if not text: return ""
    # FPDF default fonts only support latin-1. This strips unsupported chars to prevent crash.
    return text.encode("latin-1", "ignore").decode("latin-1")

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
        "video_title": data.get("video_title", "General Session"),
        "video_url": data.get("video_url", ""),
        "timestamp": data.get("timestamp", "00:00"),
        "note": data.get("note", ""),
        "image_path": img_path,
        "created_at": datetime.datetime.now().isoformat()
    }
    notes = load_notes()
    notes.append(entry)
    save_notes(notes)
    return jsonify({"status": "saved", "id": entry["id"]})

@app.route("/notes")
def get_notes():
    notes = load_notes()
    url = request.args.get("video_url")
    if url: notes = [n for n in notes if n.get("video_url") == url]
    return jsonify(notes)

@app.route("/delete", methods=["POST"])
def delete_single():
    note_id = request.json.get("id")
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
    notes = load_notes()
    remains = []
    
    for n in notes:
        # If video_url is provided, only delete notes for that video
        # If NO video_url is provided, delete EVERYTHING (Master Clear)
        if video_url:
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

class NoirPDF(FPDF):
    def header(self):
        self.set_fill_color(11, 14, 20)
        self.rect(0, 0, 210, 297, "F") # Global Dark Background

@app.route("/export-pdf")
def export_pdf():
    video_url = request.args.get("video_url")
    notes = load_notes()
    if video_url: notes = [n for n in notes if n.get("video_url") == video_url]
    if not notes: return jsonify({"error": "No notes found"}), 400

    pdf = NoirPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Header
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 20, "YT NOTER PRO", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(59, 130, 246)
    pdf.cell(0, 10, "OFFICIAL DOCUMENTATION REPORT", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    pdf.ln(10)

    # Group by Video
    grouped = {}
    for n in notes: grouped.setdefault(n.get("video_title", "General Notes"), []).append(n)

    for title, vnotes in grouped.items():
        # Title Section
        pdf.set_fill_color(22, 27, 34)
        pdf.set_draw_color(59, 130, 246)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 12, f"  {safe_text(title)}", border="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        pdf.ln(5)

        for n in vnotes:
            # Timestamp
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(59, 130, 246)
            pdf.cell(0, 8, f"Timestamp: {safe_text(n.get('timestamp','00:00'))}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Image
            if n.get("image_path") and os.path.exists(n["image_path"]):
                try:
                    img = Image.open(n["image_path"])
                    w, h = img.size
                    dw = 170; dh = dw * (h / w)
                    if pdf.get_y() + dh + 10 > 270: pdf.add_page()
                    pdf.image(n["image_path"], x=20, w=dw, h=dh)
                    pdf.ln(5)
                except: pass

            # Note Text
            if n.get("note"):
                pdf.set_font("Helvetica", "", 11)
                pdf.set_text_color(230, 230, 230)
                pdf.multi_cell(0, 6, safe_text(n["note"]))
            
            pdf.ln(10)
            pdf.set_draw_color(40, 40, 40)
            pdf.line(20, pdf.get_y(), 190, pdf.get_y())
            pdf.ln(5)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name="Noir_Study_Report.pdf")

@app.route("/export-md")
def export_md():
    notes = load_notes()
    lines = ["# YT NOTER PRO - STUDY REPORT\n", f"*Generated: {datetime.datetime.now()}*\n\n---\n"]
    grouped = {}
    for n in notes: grouped.setdefault(n.get("video_title", "General"), []).append(n)
    for title, vnotes in grouped.items():
        lines.append(f"\n## {title}\n")
        for n in vnotes:
            lines.append(f"\n### `{n.get('timestamp','00:00')}`\n")
            if n.get("note"): lines.append(n["note"] + "\n")
            lines.append("\n---\n")
    buf = io.BytesIO("\n".join(lines).encode())
    return send_file(buf, mimetype="text/markdown", as_attachment=True, download_name="Noir_Notes.md")

if __name__ == "__main__":
    app.run(debug=True, port=5001)
