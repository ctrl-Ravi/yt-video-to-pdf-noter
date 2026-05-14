import os, json, datetime, io, base64, uuid, re, sqlite3
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from PIL import Image

app = Flask(__name__)
CORS(app)

DB_PATH = "notes.db"
IMG_DIR = "screenshots"
if not os.path.exists(IMG_DIR): os.makedirs(IMG_DIR)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS notes
                 (id TEXT PRIMARY KEY,
                  notebook_name TEXT,
                  video_title TEXT,
                  video_url TEXT,
                  timestamp TEXT,
                  note TEXT,
                  image_path TEXT,
                  created_at TEXT)''')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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

def timestamp_to_seconds(ts):
    """Convert MM:SS or HH:MM:SS to total seconds."""
    if not ts: return 0
    parts = ts.split(':')
    try:
        if len(parts) == 3: # HH:MM:SS
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return int(parts[0]) * 60 + int(parts[1])
    except: return 0

def load_notes():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM notes')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_image(image_file):
    if not image_file: return None
    try:
        fname = f"{IMG_DIR}/{uuid.uuid4()}.png"
        image_file.save(fname)
        return fname
    except: return None

@app.route("/save", methods=["POST"])
def save():
    data = request.form
    image_file = request.files.get("image")
    img_path = save_image(image_file)
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
    
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO notes (id, notebook_name, video_title, video_url, timestamp, note, image_path, created_at)
                 VALUES (:id, :notebook_name, :video_title, :video_url, :timestamp, :note, :image_path, :created_at)''', 
              entry)
    conn.commit()
    conn.close()
    return jsonify({"status": "saved", "entry": entry})

@app.route("/notebooks")
def get_notebooks():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT DISTINCT notebook_name FROM notes')
    rows = c.fetchall()
    conn.close()
    notebooks = sorted(set(row["notebook_name"] or "General Session" for row in rows))
    if "General Session" not in notebooks:
        notebooks.insert(0, "General Session")
    return jsonify(notebooks)

@app.route("/notes")
def get_notes():
    url = request.args.get("video_url")
    notebook_name = request.args.get("notebook_name")
    
    conn = get_db()
    c = conn.cursor()
    
    if notebook_name:
        c.execute('SELECT * FROM notes WHERE notebook_name = ?', (notebook_name,))
    elif url:
        c.execute('SELECT * FROM notes WHERE video_url = ?', (url,))
    else:
        c.execute('SELECT * FROM notes')
        
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route("/delete", methods=["POST"])
def delete_single():
    data = request.json or {}
    note_id = data.get("id")
    if not note_id:
        return jsonify({"error": "Missing id"}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    # Get image path before deleting
    c.execute('SELECT image_path FROM notes WHERE id = ?', (note_id,))
    row = c.fetchone()
    if row and row["image_path"] and os.path.exists(row["image_path"]):
        try: os.remove(row["image_path"])
        except: pass
        
    c.execute('DELETE FROM notes WHERE id = ?', (note_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted"})

@app.route("/delete_all", methods=["POST"])
def delete_all():
    data = request.json or {}
    video_url = data.get("video_url")
    notebook_name = data.get("notebook_name")
    
    conn = get_db()
    c = conn.cursor()
    
    # Need to delete images first
    if notebook_name:
        c.execute('SELECT image_path FROM notes WHERE notebook_name = ?', (notebook_name,))
    elif video_url:
        c.execute('SELECT image_path FROM notes WHERE video_url = ?', (video_url,))
    else:
        c.execute('SELECT image_path FROM notes')
        
    rows = c.fetchall()
    for row in rows:
        if row and row["image_path"] and os.path.exists(row["image_path"]):
            try: os.remove(row["image_path"])
            except: pass
            
    if notebook_name:
        c.execute('DELETE FROM notes WHERE notebook_name = ?', (notebook_name,))
    elif video_url:
        c.execute('DELETE FROM notes WHERE video_url = ?', (video_url,))
    else:
        c.execute('DELETE FROM notes')
        
    conn.commit()
    
    # Get remaining count
    c.execute('SELECT COUNT(*) FROM notes')
    total = c.fetchone()[0]
    conn.close()
    
    return jsonify({"status": "cleared", "total": total})

@app.route("/screenshot/<path:filepath>")
def serve_screenshot(filepath):
    # Prevent Path Traversal by extracting only the filename
    safe_filename = os.path.basename(filepath)
    safe_path = os.path.join(IMG_DIR, safe_filename)
    
    if os.path.exists(safe_path) and os.path.isfile(safe_path):
        return send_file(safe_path, mimetype="image/png")
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

    # Group by Video FIRST so we can use it for stats
    grouped = {}
    for n in notes: grouped.setdefault(n.get("video_title", "General Notes"), []).append(n)

    # ── Centered Premium Header Block (Ultra-Compact) ───────────────────────
    # Primary Title: Notebook Name
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_PDF_WHITE)
    pdf.cell(0, 10, safe_text(notebook_name or "General Session").upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    # Subtitle
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(59, 130, 246) # #3B82F6 Blue
    pdf.cell(0, 5, "PRECISION KNOWLEDGE CAPTURE", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    # ── Pro Ribbon Stats (Minimalist) ───────────────────────────────────────
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139) # Slate Gray
    
    v_count = len(grouped.keys())
    n_count = len(notes)
    date_str = datetime.datetime.now().strftime("%d %b %Y").upper()
    
    stats_line = f"{v_count} VIDEOS   |   {n_count} CAPTURES   |   {date_str}"
    pdf.cell(0, 5, stats_line, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    # Subtle Divider
    pdf.set_draw_color(*_PDF_BORDER)
    pdf.set_line_width(0.1)
    pdf.line(60, pdf.get_y() + 2, 150, pdf.get_y() + 2)
    
    pdf.ln(8) # Compact jump to content

    for title, vnotes in grouped.items():
        # ── Video Section Header (Responsive Styled Block) ──
        if pdf.get_y() > 220: pdf.add_page()
        pdf.ln(5)
        video_url = vnotes[0].get("video_url", "")
        
        # Responsive Font Scaling
        title_text = safe_text(title).upper()
        font_size = 11
        line_height = 5
        
        # If title is longer than 170mm, decrease font size and line height
        if pdf.get_string_width(title_text) > 170:
            font_size = 9
            line_height = 4 # Tighter line height for smaller font
        
        pdf.set_font("Helvetica", "B", font_size)
        start_y = pdf.get_y()
        
        # Use multi_cell to calculate height
        pdf.set_text_color(*_PDF_BG) 
        pdf.set_xy(20, start_y + 1.5)
        pdf.multi_cell(170, line_height, title_text, border=0, align='L')
        
        end_y = pdf.get_y()
        # Reduce padding and min-height for a "sleeker" box
        block_height = max(10, (end_y - start_y) + 3) 
        
        # Draw the Container Decoration
        pdf.set_xy(15, start_y)
        pdf.set_fill_color(17, 24, 39)
        pdf.rect(15, start_y, 180, block_height, "F")
        pdf.set_fill_color(59, 130, 246)
        pdf.rect(15, start_y, 1.5, block_height, "F")
        
        # Draw the Actual Text
        pdf.set_xy(20, start_y + 1.5)
        pdf.set_text_color(*_PDF_WHITE)
        pdf.multi_cell(170, line_height, title_text, border=0, align='L', link=video_url)
        
        pdf.set_y(start_y + block_height + 6) # Reduced margin bottom

        for n in vnotes:
            # Check for page break before starting a new note card
            if pdf.get_y() > 220: pdf.add_page()

            # Note Card Start
            start_y = pdf.get_y()
            
            # 1. Timestamp / Link
            ts = n.get('timestamp', '00:00')
            v_url = n.get('video_url', '')
            seconds = timestamp_to_seconds(ts)
            deep_link = f"{v_url}&t={seconds}" if v_url else ""
            
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*_PDF_ACCENT)
            pdf.cell(0, 8, f"TIMESTAMP: {safe_text(ts)}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, link=deep_link)

            # 2. Snapshot (The Hero - Full Width)
            if n.get("image_path") and os.path.exists(n["image_path"]):
                try:
                    img = Image.open(n["image_path"])
                    w, h = img.size
                    max_w = 180
                    max_h = 100 
                    
                    # Calculate aspect ratio scaling
                    ratio = min(max_w / w, max_h / h)
                    dw = w * ratio
                    dh = h * ratio
                    
                    # Center the image
                    x_pos = (210 - dw) / 2
                    pdf.image(n["image_path"], x=x_pos, w=dw, h=dh)
                    pdf.ln(4)
                except: pass

            # 3. Note Text (Underneath)
            if n.get("note"):
                pdf.set_font("Helvetica", "", 11)
                pdf.set_text_color(*_PDF_WHITE)
                # Subtle background for text
                pdf.set_fill_color(*_PDF_SURFACE)
                pdf.multi_cell(0, 7, f"Note: {safe_text(n['note'])}", border=0, align='L', fill=True)
            
            pdf.ln(10)
            pdf.set_draw_color(*_PDF_BORDER)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())
            pdf.ln(8)

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
        video_url = vnotes[0].get("video_url", "")
        if video_url:
            lines.append(f"## [{title}]({video_url})")
        else:
            lines.append(f"## {title}")
        lines.append("")
        for n in vnotes:
            ts = n.get('timestamp', '00:00')
            v_url = n.get('video_url', '')
            seconds = timestamp_to_seconds(ts)
            deep_link = f"{v_url}&t={seconds}" if v_url else ""
            
            if deep_link:
                lines.append(f"### [`{ts}`]({deep_link})")
            else:
                lines.append(f"### `{ts}`")
                
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
