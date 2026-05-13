// ── YT Noter Pro — Native Integration Engine v5.0 ──
console.log("YT NOTER PRO: Engine Live (v5.0)");
const BACKEND = "http://localhost:5001";
let sidebar = null, sidebarVisible = true, isScanning = false, autoSnapInterval = null, autoSnapTimer = 0, notes = [], hasExported = false;
let currentNotebook = "General Session";

const ICONS = {
  snap:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  auto:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  scan:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  pdf:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  md:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 15V9l4 4 4-4v6"/></svg>`,
  exit:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  logo:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="2.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  logoNative: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e4f42e" stroke-width="2.8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  note:  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  grip:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`,
};

function init() {
  if (window.self !== window.top) return;
  if (!document.getElementById("ytn-sidebar")) {
    injectSidebar(); loadNotes(); setupShortcuts();
  } else {
    const titleEl = document.getElementById("ytn-current-title");
    if (titleEl) titleEl.textContent = getVideoTitle();
  }
  injectNativeToggle();
  setupFullscreenListener();
}

function el(tag, className, id) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (id) e.id = id;
  return e;
}

// ── Native Toggle ─────────────────────────────────────
function injectNativeToggle() {
  const target = document.querySelector("#title h1.ytd-watch-metadata") ||
                 document.querySelector("ytd-video-primary-info-renderer #title");
  if (!target || document.getElementById("ytn-native-toggle")) return;

  const toggle = el("div", "ytn-native-toggle", "ytn-native-toggle");
  toggle.innerHTML = `${ICONS.logoNative}<span>OPEN YT NOTER PRO</span>`;
  toggle.addEventListener("click", ytnToggle);
  target.parentElement.appendChild(toggle);
}

// ── Sidebar Shell ─────────────────────────────────────
function injectSidebar() {
  sidebar = el("div", null, "ytn-sidebar");

  // Resize Handles
  const resizeL = el("div", "ytn-resize-l");
  const resizeBL = el("div", "ytn-resize-bl");
  sidebar.append(resizeL, resizeBL);

  // ─ Header ─
  const header = el("div", "ytn-header");

  // Top row: logo + title + toggles
  const headerTop = el("div", "ytn-header-top");
  const logoRow   = el("div", "ytn-logo-row");
  const logoBadge = el("div", "ytn-logo-badge");
  logoBadge.innerHTML = ICONS.logo;
  const titleWrap = el("div", "ytn-logo-row"); titleWrap.style.gap = "4px";
  const titleEl   = el("div", "ytn-title"); titleEl.textContent = "YT NOTER PRO";
  const versionEl = el("div", "ytn-version"); versionEl.textContent = "v5";
  titleWrap.append(logoBadge, titleEl, versionEl);
  logoRow.appendChild(titleWrap);

  const togglesWrap = el("div", "ytn-header-toggles");
  
  const dragHandle = el("div", "ytn-drag-grip", "ytn-drag-handle");
  dragHandle.innerHTML = ICONS.grip;
  dragHandle.title = "Drag to reposition";

  const autoToggle = el("div", "ytn-auto-toggle", "ytn-auto-pill");
  autoToggle.innerHTML = `<div class="ytn-toggle-dot"></div><span>AUTO</span>`;
  autoToggle.title = "Toggle Auto Snap";

  const hideBtn = el("div", "ytn-hide-btn", "ytn-hide-icon");
  hideBtn.innerHTML = ICONS.close;
  hideBtn.title = "Hide sidebar";

  togglesWrap.append(dragHandle, autoToggle, hideBtn);
  headerTop.append(logoRow, togglesWrap);

  // Notebook selector
  const nbWrap    = el("div", "ytn-nb-wrap");
  const nbLabel   = el("div", "ytn-nb-label"); nbLabel.textContent = "Notebook";
  const nbSelect  = el("select", "ytn-nb-select", "ytn-nb-select");
  const nbInputRow = el("div", "ytn-nb-input-row");
  const nbInput   = el("input", "ytn-nb-input", "ytn-nb-input");
  nbInput.type = "text";
  nbInput.placeholder = "New notebook name…";
  const nbCreateBtn = el("button", "ytn-nb-create-btn");
  nbCreateBtn.textContent = "Create";
  nbInputRow.append(nbInput, nbCreateBtn);
  nbWrap.append(nbLabel, nbSelect, nbInputRow);

  // Video title pill
  const videoTitle = el("div", "ytn-video-title", "ytn-current-title");
  videoTitle.textContent = getVideoTitle();

  // Progress bar
  const progTrack = el("div", "ytn-progress-track");
  const progBar   = el("div", "ytn-progress-bar", "ytn-progress");
  progTrack.appendChild(progBar);

  // Divider
  const divider = el("div", "ytn-header-divider");

  header.append(headerTop, nbWrap, videoTitle, progTrack, divider);
  sidebar.appendChild(header);

  // ─ Action Grid ─
  const grid = el("div", "ytn-grid");
  const snapBtn = createBtnCard("SNAP",  ICONS.snap, "ytn-snap-btn");
  const autoBtn = createBtnCard("LIVE",  ICONS.auto, "ytn-auto-btn",  true);
  const scanBtn = createBtnCard("SCAN",  ICONS.scan, "ytn-scan-btn",  true);
  grid.append(snapBtn, autoBtn, scanBtn);
  sidebar.appendChild(grid);

  // ─ Editor ─
  const editorWrap   = el("div", "ytn-editor-wrap");
  const textarea     = el("textarea", "ytn-textarea", "ytn-editor");
  textarea.placeholder = "Start documenting this moment…";
  const editorFooter = el("div", "ytn-editor-footer");
  const editorHint   = el("div", "ytn-editor-hint"); editorHint.textContent = "Alt+Enter to save";
  const saveBtn      = el("button", "ytn-save-btn", "ytn-save-btn");
  saveBtn.textContent = "Save Note";
  editorFooter.append(editorHint, saveBtn);
  editorWrap.append(textarea, editorFooter);
  sidebar.appendChild(editorWrap);

  // ─ Timeline Header ─
  const tlHeader = el("div", "ytn-timeline-header");
  const tlLabel  = el("div", "ytn-timeline-label"); tlLabel.textContent = "Session History";
  const clearBtn = el("button", "ytn-clear-btn", "ytn-clear-btn"); clearBtn.textContent = "Clear All";
  tlHeader.append(tlLabel, clearBtn);
  sidebar.appendChild(tlHeader);

  // ─ Timeline List ─
  const tlList = el("div", "ytn-timeline-list", "ytn-timeline-list");
  sidebar.appendChild(tlList);

  // ─ Footer ─
  const footer  = el("div", "ytn-footer");
  const pdfBtn  = createFooterBtn("Export PDF",  ICONS.pdf,  "ytn-export-pdf");
  const mdBtn   = createFooterBtn("Export MD",   ICONS.md,   "ytn-export-md");
  const exitBtn = createFooterBtn("Hide",        ICONS.exit, "ytn-exit");
  footer.append(pdfBtn, mdBtn, exitBtn);
  sidebar.appendChild(footer);

  document.body.appendChild(sidebar);

  // ── Restore State ──
  chrome.storage.local.get(["ytn_pos", "ytn_size"], (res) => {
    if (res.ytn_pos) {
      sidebar.style.right = "auto";
      sidebar.style.left = res.ytn_pos.x + "px";
      sidebar.style.top = res.ytn_pos.y + "px";
    }
    if (res.ytn_size) {
      sidebar.style.width = res.ytn_size.w + "px";
      sidebar.style.height = res.ytn_size.h + "px";
      checkCompact(res.ytn_size.w);
    }
  });

  // ── Wire up events ──
  hideBtn.addEventListener("click", ytnToggle);
  autoToggle.addEventListener("click", ytnToggleAuto);
  snapBtn.addEventListener("click", () => ytnSnap(true));
  autoBtn.addEventListener("click", ytnToggleAuto);
  scanBtn.addEventListener("click", ytnToggleSkimmer);
  saveBtn.addEventListener("click", ytnSaveText);
  clearBtn.addEventListener("click", ytnClearAll);

  dragHandle.addEventListener("pointerdown", ytnStartDrag);
  resizeL.addEventListener("mousedown", e => ytnStartResize(e, "w"));
  resizeBL.addEventListener("mousedown", e => ytnStartResize(e, "wh"));

  nbSelect.addEventListener("change", (e) => {
    currentNotebook = e.target.value;
    loadNotes();
  });

  nbCreateBtn.addEventListener("click", () => {
    const val = nbInput.value.trim();
    if (val) { currentNotebook = val; nbInput.value = ""; loadNotebooks(); loadNotes(); }
  });

  pdfBtn.addEventListener("click", () => {
    hasExported = true;
    window.open(`${BACKEND}/export-pdf?notebook_name=${encodeURIComponent(currentNotebook)}`);
  });
  mdBtn.addEventListener("click", () => {
    hasExported = true;
    window.open(`${BACKEND}/export-md?notebook_name=${encodeURIComponent(currentNotebook)}`);
  });
  exitBtn.addEventListener("click", ytnToggle);

  loadNotebooks();
}

// ── Interaction Logic ────────────────────────────────
let dragRAF = null;
function ytnStartDrag(e) {
  // Only allow left mouse button or touch
  if (e.button !== 0 && e.pointerType === 'mouse') return;

  e.preventDefault();
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);

  const rect = sidebar.getBoundingClientRect();
  sidebar.style.right = "auto";
  sidebar.style.bottom = "auto";
  sidebar.style.left = rect.left + "px";
  sidebar.style.top = rect.top + "px";

  const startX = e.clientX;
  const startY = e.clientY;
  let currentDeltaX = 0;
  let currentDeltaY = 0;

  function onPointerMove(e) {
    currentDeltaX = e.clientX - startX;
    currentDeltaY = e.clientY - startY;

    if (!dragRAF) {
      dragRAF = requestAnimationFrame(() => {
        // Clamping check for the final position (preview)
        let targetX = rect.left + currentDeltaX;
        let targetY = rect.top + currentDeltaY;
        
        targetX = Math.max(0, Math.min(window.innerWidth - sidebar.offsetWidth, targetX));
        targetY = Math.max(0, Math.min(window.innerHeight - sidebar.offsetHeight, targetY));

        const clampedDeltaX = targetX - rect.left;
        const clampedDeltaY = targetY - rect.top;

        sidebar.style.transform = `translate(${clampedDeltaX}px, ${clampedDeltaY}px)`;
        dragRAF = null;
      });
    }
  }

  function onPointerUp(e) {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    
    if (dragRAF) {
      cancelAnimationFrame(dragRAF);
      dragRAF = null;
    }

    const finalRect = sidebar.getBoundingClientRect();
    sidebar.style.transform = "none";
    sidebar.style.left = finalRect.left + "px";
    sidebar.style.top = finalRect.top + "px";

    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ ytn_pos: { x: finalRect.left, y: finalRect.top } });
      }
    } catch (e) {
      console.warn("YT Noter: Failed to save position", e);
    }
  }

  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
}

function ytnStartResize(e, mode) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = sidebar.offsetWidth;
  const startHeight = sidebar.offsetHeight;
  const startLeft = sidebar.offsetLeft;

  function onMouseMove(e) {
    if (mode.includes("w")) {
      const deltaX = startX - e.clientX;
      let newWidth = startWidth + deltaX;
      newWidth = Math.max(300, Math.min(640, newWidth));
      
      const actualDelta = newWidth - startWidth;
      sidebar.style.left = (startLeft - actualDelta) + "px";
      sidebar.style.width = newWidth + "px";
      checkCompact(newWidth);
    }
    if (mode.includes("h")) {
      const deltaY = e.clientY - startY;
      let newHeight = startHeight + deltaY;
      newHeight = Math.max(200, Math.min(window.innerHeight - sidebar.offsetTop, newHeight));
      sidebar.style.height = newHeight + "px";
    }
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    const r = sidebar.getBoundingClientRect();
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 
          ytn_size: { w: r.width, h: r.height },
          ytn_pos: { x: r.left, y: r.top }
        });
      }
    } catch (e) {
      console.warn("YT Noter: Failed to save size", e);
    }
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function checkCompact(width) {
  sidebar.classList.toggle("ytn-compact", width < 320);
}

function setupFullscreenListener() {
  const handler = () => {
    if (!sidebar) return;
    const isFullscreen = !!document.fullscreenElement;
    sidebar.classList.toggle("ytn-fullscreen", isFullscreen);
    
    if (isFullscreen) {
      // We entered fullscreen: inject our control button if it's not there
      injectFullscreenControl();
    } else {
      // Exited fullscreen: clean up forced state
      sidebar.classList.remove("ytn-force-expand");
    }
  };
  document.addEventListener("fullscreenchange", handler);
  document.addEventListener("webkitfullscreenchange", handler);
}

function injectFullscreenControl() {
  const rightControls = document.querySelector(".ytp-right-controls");
  if (!rightControls || document.getElementById("ytn-fs-toggle")) return;

  // Query the settings button *inside* the specific controls container we found
  const settingsBtn = rightControls.querySelector(".ytp-settings-button");

  const btn = document.createElement("button");
  btn.id = "ytn-fs-toggle";
  btn.className = "ytp-button";
  btn.setAttribute("aria-label", "Toggle YT Noter");
  btn.setAttribute("title", "Toggle YT Noter");
  btn.style.verticalAlign = "top";
  
  // Use a simple clean SVG for the button
  btn.innerHTML = `<svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
    <path fill="currentColor" d="M11,11 h14 v14 h-14 z" stroke="currentColor" stroke-width="2" fill-opacity="0"></path>
    <path fill="currentColor" d="M14,14 h8 v2 h-8 z M14,18 h6 v2 h-6 z"></path>
  </svg>`;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sidebar) {
      sidebar.classList.toggle("ytn-force-expand");
    }
  });

  // Insert safely: use settingsBtn.parentNode to guarantee they share a parent,
  // or fallback to appending to rightControls if settingsBtn isn't found.
  if (settingsBtn && settingsBtn.parentNode) {
    settingsBtn.parentNode.insertBefore(btn, settingsBtn);
  } else {
    rightControls.appendChild(btn);
  }
}

// ── Card & Button Builders ───────────────────────────
function createBtnCard(label, icon, id, hasTimer = false) {
  const card    = el("div", "ytn-card", id);
  const dot     = el("div", "ytn-dot");
  const iconWrap = el("div", "ytn-card-icon"); iconWrap.innerHTML = icon;
  const lbl     = el("div", "ytn-card-label"); lbl.textContent = label;
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
  const btn      = el("button", "ytn-footer-btn", id);
  const iconWrap = el("div"); iconWrap.innerHTML = icon;
  const lbl      = el("div"); lbl.textContent = label;
  btn.append(iconWrap, lbl);
  return btn;
}

// ── Core Logic ───────────────────────────────────────
function getVideo() { return document.querySelector("video") || document.querySelector(".html5-main-video"); }

// Strips notification-count prefix like "(416) " AND the " - YouTube" suffix
function getVideoTitle() {
  return (document.title || "YouTube")
    .replace(/ - YouTube$/i, "")   // remove trailing " - YouTube"
    .replace(/^\(\d+\)\s*/, "");    // remove leading "(N) " notification count
}
function formatTime(s) { s = Math.floor(s || 0); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }

async function ytnSnap(autoSave = false) {
  const v = getVideo(); if (!v) return;
  
  // Show flash animation if grabbing a snapshot while in fullscreen
  if (document.fullscreenElement) {
    const flash = document.createElement("div");
    flash.className = "ytn-glow-overlay";
    const container = document.fullscreenElement || document.body;
    container.appendChild(flash);
    setTimeout(() => { flash.remove(); }, 700); // remove after animation completes
  }
  
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth; canvas.height = v.videoHeight;
  canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/png");
  if (autoSave) await ytnSave(data, "");
  return data;
}

function ytnToggleAuto() {
  const btn   = document.getElementById("ytn-auto-btn");
  const pill  = document.getElementById("ytn-auto-pill");
  const input = document.getElementById("ytn-auto-btn-timer");
  if (autoSnapInterval) {
    clearInterval(autoSnapInterval); autoSnapInterval = null;
    btn.classList.remove("active"); 
    pill.classList.remove("active");
    if (input) input.disabled = false;
    const prog = document.getElementById("ytn-progress");
    if (prog) prog.style.width = "0%";
  } else {
    btn.classList.add("active");
    pill.classList.add("active");
    if (input) input.disabled = true; autoSnapTimer = 0;
    const interval = parseInt(input?.value) || 30;
    autoSnapInterval = setInterval(async () => {
      autoSnapTimer++;
      const prog = document.getElementById("ytn-progress");
      if (prog) prog.style.width = (autoSnapTimer / interval * 100) + "%";
      if (autoSnapTimer >= interval) { autoSnapTimer = 0; await ytnSnap(true); }
    }, 1000);
  }
}

async function ytnToggleSkimmer() {
  const btn   = document.getElementById("ytn-scan-btn");
  const input = document.getElementById("ytn-scan-btn-timer");
  if (isScanning) {
    isScanning = false; btn.classList.remove("active"); if (input) input.disabled = false;
  } else {
    isScanning = true; btn.classList.add("active"); if (input) input.disabled = true;
    const interval = parseInt(input?.value) || 30;
    const v = getVideo(); if (!v) return;
    while (isScanning && v.currentTime < v.duration - 1) {
      const img = await ytnSnap();
      if (img) await ytnSave(img, "");
      v.currentTime += interval;
      const prog = document.getElementById("ytn-progress");
      if (prog) prog.style.width = (v.currentTime / v.duration * 100) + "%";
      await new Promise(r => setTimeout(r, 600));
    }
    isScanning = false; btn.classList.remove("active"); if (input) input.disabled = false;
  }
}

async function ytnSave(img, text) {
  try {
    const title    = getVideoTitle();
    const response = await fetch(`${BACKEND}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notebook_name: currentNotebook,
        note: text, image: img || "",
        timestamp: formatTime(getVideo()?.currentTime),
        video_url: window.location.href,
        video_title: title
      }),
      mode: "cors"
    });
    const data = await response.json();
    if (data.entry) { notes.push(data.entry); addNoteToDOM(data.entry); }
  } catch (e) { console.error("YT NOTER: Save Failed", e); }
}

// ── DOM Note Rendering ────────────────────────────────
function buildEntryEl(n) {
  const entry = el("div", "ytn-entry"); entry.id = `ytn-entry-${n.id}`;
  const dot   = el("div", "ytn-entry-dot");
  const card  = el("div", "ytn-entry-card");
  const ts    = el("span", "ytn-entry-timestamp"); ts.textContent = n.timestamp;
  const del   = el("div", "ytn-del-note"); del.innerHTML = ICONS.trash;
  del.addEventListener("click", () => ytnDeleteNote(n.id));
  card.append(ts, del);
  if (n.image_path) {
    const img = el("img", "ytn-entry-img", `img-${n.id}`);
    img.src = `${BACKEND}/screenshot/${encodeURIComponent(n.image_path)}`;
    img.title = "Click to view full size";
    img.addEventListener("click", () => window.open(img.src, "_blank"));
    card.appendChild(img);
  }
  if (n.note) {
    const txt = el("div", "ytn-entry-text"); txt.textContent = n.note;
    card.appendChild(txt);
  }
  entry.append(dot, card);
  return entry;
}

function addNoteToDOM(n) {
  const list = document.getElementById("ytn-timeline-list"); if (!list) return;
  const empty = list.querySelector(".ytn-empty-state");
  if (empty) empty.remove();

  const firstHeader = list.querySelector(".ytn-timeline-section-header");
  if (!firstHeader || firstHeader.dataset.title !== (n.video_title || "General Session")) {
    const header = el("div", "ytn-timeline-section-header");
    header.textContent = n.video_title || "General Session";
    header.dataset.title = n.video_title || "General Session";
    list.insertBefore(header, list.firstChild);
  }

  const activeHeader = list.querySelector(".ytn-timeline-section-header");
  const entry = buildEntryEl(n);
  if (activeHeader && activeHeader.nextSibling) {
    list.insertBefore(entry, activeHeader.nextSibling);
  } else {
    list.appendChild(entry);
  }
}

async function ytnSaveText() {
  const ed = document.getElementById("ytn-editor");
  if (!ed?.value.trim()) return;
  await ytnSave(null, ed.value.trim()); ed.value = "";
}

async function ytnClearAll() {
  if (notes.length > 0 && !hasExported) {
    if (!confirm("⚠️ You haven't exported yet. Delete all notes anyway?")) return;
    if (!confirm("🚨 Final warning: this cannot be undone. Continue?")) return;
  } else {
    if (!confirm("Delete all session history?")) return;
  }
  try {
    await fetch(`${BACKEND}/delete_all`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notebook_name: currentNotebook }), mode: "cors"
    });
    hasExported = false; notes = []; loadNotes();
  } catch (e) { console.error("YT NOTER: Clear Failed", e); }
}

async function ytnDeleteNote(id) {
  try {
    await fetch(`${BACKEND}/delete`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }), mode: "cors"
    });
    const entryEl = document.getElementById(`ytn-entry-${id}`);
    if (entryEl) entryEl.remove();
    notes = notes.filter(n => n.id !== id);
    const list = document.getElementById("ytn-timeline-list");
    if (list && notes.length === 0) showEmptyState(list);
    else if (list) {
      list.querySelectorAll(".ytn-timeline-section-header").forEach(h => {
        if (!h.nextElementSibling || h.nextElementSibling.classList.contains("ytn-timeline-section-header")) h.remove();
      });
    }
  } catch (e) { console.error("YT NOTER: Delete Failed", e); }
}

function showEmptyState(list) {
  list.innerHTML = "";
  const es    = el("div", "ytn-empty-state");
  const icon  = el("div", "ytn-empty-state-icon"); icon.innerHTML = ICONS.note;
  const title = el("div", "ytn-empty-state-title"); title.textContent = "No notes yet";
  const sub   = el("div", "ytn-empty-state-sub");   sub.textContent  = "Hit SNAP or start typing below to capture this moment.";
  es.append(icon, title, sub);
  list.appendChild(es);
}

// ── Notebooks ─────────────────────────────────────────
async function loadNotebooks() {
  try {
    const res = await fetch(`${BACKEND}/notebooks`, { mode: "cors" });
    const nbs = await res.json();
    const select = document.getElementById("ytn-nb-select"); if (!select) return;
    if (!nbs.includes(currentNotebook)) nbs.push(currentNotebook);
    select.innerHTML = "";
    nbs.forEach(nb => {
      const opt = document.createElement("option");
      opt.value = nb; opt.textContent = nb;
      if (nb === currentNotebook) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) { console.error("YT NOTER: Load Notebooks Failed", e); }
}

async function loadNotes() {
  try {
    const res = await fetch(`${BACKEND}/notes?notebook_name=${encodeURIComponent(currentNotebook)}`, { mode: "cors" });
    notes = await res.json(); renderNotes();
  } catch (e) { console.error("YT NOTER: Load Failed", e); }
}

function renderNotes() {
  const list = document.getElementById("ytn-timeline-list"); if (!list) return;
  list.innerHTML = "";
  if (!notes.length) { showEmptyState(list); return; }
  let lastTitle = "";
  [...notes].reverse().forEach(n => {
    if (n.video_title !== lastTitle) {
      const header = el("div", "ytn-timeline-section-header");
      header.textContent = n.video_title || "General Session";
      header.dataset.title = n.video_title || "General Session";
      list.appendChild(header);
      lastTitle = n.video_title;
    }
    list.appendChild(buildEntryEl(n));
  });
}

// ── Sidebar Toggle & Shortcuts ────────────────────────
function ytnToggle() {
  if (sidebar) {
    if (document.fullscreenElement && sidebar.classList.contains("ytn-force-expand")) {
      sidebar.classList.remove("ytn-force-expand");
    } else {
      sidebarVisible = !sidebarVisible;
      sidebar.classList.toggle("hidden", !sidebarVisible);
    }
  }
}

function setupShortcuts() {
  document.addEventListener("keydown", e => {
    if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); ytnSnap(true); }
    if (e.altKey && e.key.toLowerCase() === "h") { e.preventDefault(); ytnToggle(); }
    if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); document.getElementById("ytn-editor")?.focus(); }
    if (e.altKey && e.key.toLowerCase() === "a") { e.preventDefault(); ytnToggleAuto(); }
    if (e.altKey && (e.key === "Enter")) { e.preventDefault(); ytnSaveText(); }
  });
}

init();
setInterval(init, 2000);
