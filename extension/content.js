// ── YT Noter Pro — Native Integration Engine v4.9 ──
console.log("YT NOTER PRO: Engine Live (v4.9)");
const BACKEND = "http://localhost:5001";
let sidebar = null, sidebarVisible = true, isScanning = false, autoSnapInterval = null, autoSnapTimer = 0, notes = [], hasExported = false;

const ICONS = {
  snap: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  auto: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  scan: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  pdf: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  md: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M9 18V6"/><path d="M15 18V6"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  logo: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`
};

function init() {
  if (window.self !== window.top) return;
  
  // 1. Core Sidebar Check
  if (!document.getElementById("ytn-sidebar")) {
    injectSidebar(); loadNotes(); setupShortcuts();
  } else {
    const titleEl = document.getElementById("ytn-current-title");
    if (titleEl) titleEl.textContent = (document.title || "YouTube").replace(" - YouTube", "");
  }

  // 2. Native Toggle Injection
  injectNativeToggle();
}

function el(tag, className, id) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (id) e.id = id;
  return e;
}

function injectNativeToggle() {
  const target = document.querySelector("#title h1.ytd-watch-metadata") || document.querySelector("ytd-video-primary-info-renderer #title");
  if (!target || document.getElementById("ytn-native-toggle")) return;

  const toggle = el("div", "ytn-native-toggle", "ytn-native-toggle");
  toggle.innerHTML = `${ICONS.logo} <span>OPEN YT NOTER PRO</span>`;
  toggle.addEventListener("click", ytnToggle);
  
  target.parentElement.appendChild(toggle);
  console.log("YT NOTER: Native Toggle Injected");
}

function injectSidebar() {
  sidebar = el("div", null, "ytn-sidebar");

  const header = el("div", "ytn-header");
  const headerTop = el("div"); headerTop.style = "display:flex;justify-content:space-between;align-items:center";
  const title = el("div", "ytn-title"); title.textContent = "YT NOTER PRO";
  const closeIcon = el("div", null, "ytn-close-icon"); closeIcon.style = "cursor:pointer;color:var(--text-dim)";
  closeIcon.innerHTML = ICONS.close;
  headerTop.append(title, closeIcon);
  
  const videoTitleEl = el("div", "ytn-video-title", "ytn-current-title");
  videoTitleEl.style = "font-size:11px;color:var(--accent-blue);font-weight:700;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
  videoTitleEl.textContent = (document.title || "YouTube").replace(" - YouTube", "");

  const progTrack = el("div", "ytn-progress-track");
  const progBar = el("div", "ytn-progress-bar", "ytn-progress");
  progTrack.appendChild(progBar);
  header.append(headerTop, videoTitleEl, progTrack);
  sidebar.appendChild(header);

  const grid = el("div", "ytn-grid");
  const snapBtn = createBtnCard("SNAP", ICONS.snap, "ytn-snap-btn");
  const autoBtn = createBtnCard("LIVE", ICONS.auto, "ytn-auto-btn", true);
  const scanBtn = createBtnCard("SCAN", ICONS.scan, "ytn-scan-btn", true);
  grid.append(snapBtn, autoBtn, scanBtn);
  sidebar.appendChild(grid);

  const editorWrap = el("div", "ytn-editor-wrap");
  const textarea = el("textarea", "ytn-textarea", "ytn-editor");
  textarea.placeholder = "Start documenting...";
  const saveBtn = el("button", "ytn-save-btn", "ytn-save-btn");
  saveBtn.textContent = "Save Note";
  editorWrap.append(textarea, saveBtn);
  sidebar.appendChild(editorWrap);

  const tlHeader = el("div", "ytn-timeline-header");
  const tlTitle = el("div"); tlTitle.style = "font-size:11px;font-weight:800;color:var(--text-dim);letter-spacing:1px";
  tlTitle.textContent = "SESSION HISTORY";
  const clearBtn = el("button", "ytn-clear-btn", "ytn-clear-btn");
  clearBtn.textContent = "CLEAR ALL";
  tlHeader.append(tlTitle, clearBtn);
  sidebar.appendChild(tlHeader);

  const tlList = el("div", "ytn-timeline-list", "ytn-timeline-list");
  sidebar.appendChild(tlList);

  const footer = el("div", "ytn-footer");
  const pdfBtn = createFooterBtn("PDF", ICONS.pdf, "ytn-export-pdf");
  const mdBtn = createFooterBtn("MD", ICONS.md, "ytn-export-md");
  const exitBtn = createFooterBtn("EXIT", ICONS.close, "ytn-exit");
  footer.append(pdfBtn, mdBtn, exitBtn);
  sidebar.appendChild(footer);

  document.body.appendChild(sidebar);

  // ── Wiring ──
  closeIcon.addEventListener("click", ytnToggle);
  snapBtn.addEventListener("click", () => { console.log("YT NOTER: Manual Snap"); ytnSnap(true); });
  autoBtn.addEventListener("click", () => { console.log("YT NOTER: Toggle AutoSnap"); ytnToggleAuto(); });
  scanBtn.addEventListener("click", () => { console.log("YT NOTER: Toggle Scan"); ytnToggleSkimmer(); });
  saveBtn.addEventListener("click", () => { console.log("YT NOTER: Save Note"); ytnSaveText(); });
  clearBtn.addEventListener("click", () => { console.log("YT NOTER: Clear Request"); ytnClearAll(); });
  
  pdfBtn.addEventListener("click", () => {
    console.log("YT NOTER: Export PDF Initiated");
    hasExported = true;
    window.open(`${BACKEND}/export-pdf`);
  });
  mdBtn.addEventListener("click", () => {
    console.log("YT NOTER: Export MD Initiated");
    hasExported = true;
    window.open(`${BACKEND}/export-md`);
  });
  exitBtn.addEventListener("click", ytnToggle);
}

function createBtnCard(label, icon, id, hasTimer = false) {
  const card = el("div", "ytn-card", id);
  const dot = el("div", "ytn-dot");
  const iconWrap = el("div"); iconWrap.innerHTML = icon;
  const lbl = el("div"); lbl.style = "font-size:10px;font-weight:800"; lbl.textContent = label;
  card.append(dot, iconWrap, lbl);
  if (hasTimer) {
    const input = el("input", "ytn-timer-input", id + "-timer");
    input.type = "number"; input.value = "30"; input.min = "5";
    input.addEventListener("click", e => e.stopPropagation());
    card.appendChild(input);
  }
  return card;
}

function createFooterBtn(label, icon, id) {
  const btn = el("button", "ytn-footer-btn", id);
  const iconWrap = el("div"); iconWrap.innerHTML = icon;
  const lbl = el("div"); lbl.textContent = label;
  btn.append(iconWrap, lbl);
  return btn;
}

// ── Logic ──────────────────────────────────────────────
function getVideo() { return document.querySelector("video") || document.querySelector(".html5-main-video"); }
function formatTime(s) { s = Math.floor(s || 0); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }

async function ytnSnap(autoSave = false) {
  const v = getVideo(); if (!v) return;
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth; canvas.height = v.videoHeight;
  canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/png");
  if (autoSave) await ytnSave(data, "");
  return data;
}

function ytnToggleAuto() {
  const btn = document.getElementById("ytn-auto-btn");
  const input = document.getElementById("ytn-auto-btn-timer");
  if (autoSnapInterval) {
    clearInterval(autoSnapInterval); autoSnapInterval = null;
    btn.classList.remove("active"); if (input) input.disabled = false;
    document.getElementById("ytn-progress").style.width = "0%";
  } else {
    btn.classList.add("active"); if (input) input.disabled = true; autoSnapTimer = 0;
    const interval = parseInt(input?.value) || 30;
    autoSnapInterval = setInterval(async () => {
      autoSnapTimer++;
      const prog = document.getElementById("ytn-progress");
      if (prog) prog.style.width = (autoSnapTimer/interval * 100) + "%";
      if (autoSnapTimer >= interval) { autoSnapTimer = 0; await ytnSnap(true); }
    }, 1000);
  }
}

async function ytnToggleSkimmer() {
  const btn = document.getElementById("ytn-scan-btn");
  const input = document.getElementById("ytn-scan-btn-timer");
  if (isScanning) { isScanning = false; btn.classList.remove("active"); if (input) input.disabled = false; }
  else {
    isScanning = true; btn.classList.add("active"); if (input) input.disabled = true;
    const interval = parseInt(input?.value) || 30;
    const v = getVideo(); if (!v) return;
    while (isScanning && v.currentTime < v.duration - 1) {
      const img = await ytnSnap();
      if (img) await ytnSave(img, "");
      v.currentTime += interval;
      const prog = document.getElementById("ytn-progress");
      if (prog) prog.style.width = (v.currentTime/v.duration * 100) + "%";
      await new Promise(r => setTimeout(r, 600));
    }
    isScanning = false; btn.classList.remove("active"); if (input) input.disabled = false;
  }
}

async function ytnSave(img, text) {
  try {
    const title = (document.title || "YouTube").replace(" - YouTube", "");
    const response = await fetch(`${BACKEND}/save`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: text, image: img || "", timestamp: formatTime(getVideo()?.currentTime), video_url: window.location.href, video_title: title }),
      mode: 'cors'
    });
    const data = await response.json();
    if (data.entry) {
      notes.push(data.entry);
      addNoteToDOM(data.entry);
    }
  } catch (e) { console.error("YT NOTER: Save Failed", e); }
}

function addNoteToDOM(n) {
  const list = document.getElementById("ytn-timeline-list");
  if (!list) return;
  
  if (list.textContent === "Waiting for documentation...") {
    list.innerHTML = "";
  }

  // Check if we need a new title header at the top
  const firstHeader = list.querySelector(".ytn-timeline-section-header");
  if (!firstHeader || firstHeader.textContent !== (n.video_title || "General Session")) {
    const header = el("div", "ytn-timeline-section-header");
    header.style = "padding: 20px 0 10px; font-size: 11px; color: var(--accent-blue); font-weight: 800; border-bottom: 1px solid var(--border); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px";
    header.textContent = n.video_title || "General Session";
    list.insertBefore(header, list.firstChild);
  }

  const entry = el("div", "ytn-entry");
  entry.id = `ytn-entry-${n.id}`;
  const card = el("div", "ytn-entry-card");
  const dot = el("div", "ytn-entry-dot");
  const ts = el("span"); ts.style = "color:var(--accent-blue);font-weight:800;font-size:12px;display:block;margin-bottom:8px";
  ts.textContent = n.timestamp;
  const delBtn = el("div", "ytn-del-note"); delBtn.innerHTML = ICONS.trash;
  delBtn.addEventListener("click", () => ytnDeleteNote(n.id));
  card.append(ts, delBtn);
  
  if (n.image_path) {
    const img = el("img", "ytn-entry-img", `img-${n.id}`);
    img.src = `${BACKEND}/screenshot/${encodeURIComponent(n.image_path)}`;
    card.appendChild(img);
  }
  if (n.note) {
    const noteTxt = el("div"); noteTxt.style = "font-size:13px;line-height:1.5;color:#fff;margin-top:10px";
    noteTxt.textContent = n.note;
    card.appendChild(noteTxt);
  }
  entry.append(dot, card);
  
  // Insert exactly after the first header so it stays under its video title
  const activeHeader = list.querySelector(".ytn-timeline-section-header");
  if (activeHeader && activeHeader.nextSibling) {
    list.insertBefore(entry, activeHeader.nextSibling);
  } else {
    list.appendChild(entry);
  }
}

async function ytnSaveText() {
  const el = document.getElementById("ytn-editor");
  if (!el?.value.trim()) return;
  await ytnSave(null, el.value.trim()); el.value = "";
}

async function ytnClearAll() {
  console.log("YT NOTER: Safety Guard Active. Notes in memory:", notes.length);
  if (notes.length > 0 && !hasExported) {
    if (!confirm("⚠️ CAUTION: You haven't exported your PDF report yet! Are you sure you want to delete everything?")) return;
    if (!confirm("🚨 FINAL WARNING: This action is permanent and cannot be undone. Do you REALLY want to wipe all session history?")) return;
  } else {
    if (!confirm("Delete all session history?")) return;
  }

  try {
    await fetch(`${BACKEND}/delete_all`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), mode: 'cors' });
    hasExported = false;
    notes = [];
    loadNotes();
    console.log("YT NOTER: Session Cleared");
  } catch (e) { console.error("YT NOTER: Clear Failed", e); }
}

async function ytnDeleteNote(id) {
  try {
    await fetch(`${BACKEND}/delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }), mode: 'cors' });
    const el = document.getElementById(`ytn-entry-${id}`);
    if (el) el.remove();
    notes = notes.filter(n => n.id !== id);
    
    const list = document.getElementById("ytn-timeline-list");
    if (list) {
      if (notes.length === 0) {
        list.textContent = "Waiting for documentation...";
      } else {
        // Clean up empty headers if their last remaining note was deleted
        list.querySelectorAll(".ytn-timeline-section-header").forEach(h => {
          if (!h.nextElementSibling || h.nextElementSibling.classList.contains("ytn-timeline-section-header")) {
            h.remove();
          }
        });
      }
    }
  } catch (e) {}
}

async function loadNotes() {
  try {
    const res = await fetch(`${BACKEND}/notes`, { mode: 'cors' });
    notes = await res.json(); renderNotes();
  } catch (e) { console.error("YT NOTER: Load Failed", e); }
}

function renderNotes() {
  const list = document.getElementById("ytn-timeline-list");
  if (!list) return;
  if (!notes.length) { list.textContent = "Waiting for documentation..."; return; }
  list.innerHTML = "";
  let lastTitle = "";
  [...notes].reverse().forEach(n => {
    if (n.video_title !== lastTitle) {
      const header = el("div", "ytn-timeline-section-header");
      header.style = "padding: 20px 0 10px; font-size: 11px; color: var(--accent-blue); font-weight: 800; border-bottom: 1px solid var(--border); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px";
      header.textContent = n.video_title || "General Session";
      list.appendChild(header);
      lastTitle = n.video_title;
    }
    const entry = el("div", "ytn-entry");
    entry.id = `ytn-entry-${n.id}`;
    const card = el("div", "ytn-entry-card");
    const dot = el("div", "ytn-entry-dot");
    const ts = el("span"); ts.style = "color:var(--accent-blue);font-weight:800;font-size:12px;display:block;margin-bottom:8px";
    ts.textContent = n.timestamp;
    const delBtn = el("div", "ytn-del-note"); delBtn.innerHTML = ICONS.trash;
    delBtn.addEventListener("click", () => ytnDeleteNote(n.id));
    card.append(ts, delBtn);
    if (n.image_path) {
      const img = el("img", "ytn-entry-img", `img-${n.id}`);
      img.src = `${BACKEND}/screenshot/${encodeURIComponent(n.image_path)}`;
      card.appendChild(img);
    }
    if (n.note) {
      const noteTxt = el("div"); noteTxt.style = "font-size:13px;line-height:1.5;color:#fff;margin-top:10px";
      noteTxt.textContent = n.note;
      card.appendChild(noteTxt);
    }
    entry.append(dot, card);
    list.appendChild(entry);
  });
}

function ytnToggle() { if (sidebar) { sidebarVisible = !sidebarVisible; sidebar.classList.toggle("hidden", !sidebarVisible); } }

function setupShortcuts() {
  document.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); ytnSnap(true); }
    if (e.altKey && e.key.toLowerCase() === "h") { e.preventDefault(); ytnToggle(); }
  });
}

init();
setInterval(init, 2000); 
