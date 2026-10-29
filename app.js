// Field Fix Book front end. Data lives in a Google Sheet behind a Google Apps Script web app (see google/Code.gs).
const API = window.FFB_API || "";
const CATS = ["Power & DC","RF & antenna","Transmission & fiber","Alarms & sensors","Integration & SW","Installation & HW","Site & environment","Safety"];
const CACHE_KEY = "ffb-cache-v2", NAME_KEY = "ffb-name", WORKED_KEY = "ffb-worked";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICON = {
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};
const S = { fixes: [], steps: [], q: "", cat: "ALL", sort: "new", ready: false, openId: null };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const photoUrl = id => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
const photoLink = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const code = id => "FX-" + String(id).padStart(4, "0");
const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
const stepsFor = id => S.steps.filter(s => s.fixId === id).sort((a, b) => a.createdAt - b.createdAt);
const iWorked = id => (store.get(WORKED_KEY, [])).includes(id);
function showNotice(m) { const n = $("#notice"); n.textContent = m; n.hidden = !m; }

/* ---------- API ---------- */
async function apiGet() {
  const r = await fetch(API + "?t=" + Date.now());
  if (!r.ok) throw new Error("http " + r.status);
  const j = await r.json(); if (!j.ok) throw new Error(j.error || "failed");
  return j;
}
async function apiPost(body) {
  const r = await fetch(API, { method: "POST", body: JSON.stringify(body) }); // text/plain: no CORS preflight
  const j = await r.json(); if (!j.ok) throw new Error(j.error || "failed");
  return j;
}
async function load(quiet) {
  if (!API) { S.ready = true; showNotice("The logbook isn’t connected yet. Add the Google Apps Script URL to config.js."); render(); return; }
  const cached = store.get(CACHE_KEY, null);
  if (cached && !S.fixes.length) { S.fixes = cached.fixes; S.steps = cached.steps; S.ready = true; render(); }
  try {
    const d = await apiGet(); S.fixes = d.fixes; S.steps = d.steps; store.set(CACHE_KEY, { fixes: d.fixes, steps: d.steps }); if (!quiet) showNotice("");
  } catch { showNotice(cached ? "Couldn’t reach the logbook. Showing the last saved copy." : "Couldn’t reach the logbook. Check your connection and reload."); }
  S.ready = true; render();
  if (S.openId && $("#detail").open) openDetail(S.openId, true);
}

/* ---------- list ---------- */
function matches(f) {
  if (S.cat !== "ALL" && f.category !== S.cat) return false;
  if (!S.q) return true;
  const hay = [f.title, f.symptom, f.cause, f.equipment, f.country, f.avoid, f.name, f.tags.join(" "), f.steps.join(" "), stepsFor(f.id).map(s => s.text).join(" ")].join(" ").toLowerCase();
  return S.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function renderChips() {
  const counts = {}; S.fixes.forEach(f => counts[f.category] = (counts[f.category] || 0) + 1);
  $("#chips").innerHTML = ["ALL", ...CATS].map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat === c}">${esc(c === "ALL" ? "All" : c)} <span class="n">${c === "ALL" ? S.fixes.length : (counts[c] || 0)}</span></button>`).join("");
}
function renderStats() {
  const ppl = new Set(); S.fixes.forEach(f => f.name && ppl.add(f.name.toLowerCase())); S.steps.forEach(s => s.name && ppl.add(s.name.toLowerCase()));
  $("#st-fixes").textContent = S.fixes.length; $("#st-people").textContent = ppl.size;
  $("#st-worked").textContent = S.fixes.reduce((n, f) => n + (f.worked || 0), 0);
}
function cardHTML(f, example) {
  const n = f.steps.length + (example ? 0 : stepsFor(f.id).length);
  return `<${example ? "div" : 'button type="button"'} class="card" ${example ? "" : `data-open="${f.id}"`}>
    <div class="tagline"><span class="cat">${esc(f.category)}</span><span>${example ? "FX-EXAMPLE" : code(f.id)}</span></div>
    <h3 dir="auto">${esc(f.title)}</h3>
    <p class="sym" dir="auto">${esc(f.symptom || f.cause)}</p>
    <div class="meta"><span class="who"><span dir="auto">${esc(example ? "Example entry" : (f.name || "Field engineer"))}</span></span><span class="spacer"></span>
      <span class="pill steps">${ICON.list}${n} step${n === 1 ? "" : "s"}</span><span class="pill ok" title="Worked for me">${ICON.check}${f.worked || 0}</span></div>
  </${example ? "div" : "button"}>`;
}
function render() {
  renderChips(); renderStats();
  const list = S.fixes.filter(matches).sort((a, b) => S.sort === "worked" ? (b.worked - a.worked) || (b.createdAt - a.createdAt) : b.createdAt - a.createdAt);
  const empty = $("#empty"), grid = $("#list");
  if (!S.fixes.length) {
    grid.innerHTML = ""; empty.hidden = false;
    empty.innerHTML = `<div class="empty"><div><h2>${S.ready ? "No fixes logged yet" : "Loading the logbook…"}</h2>
      <p>Start with a fault you fixed recently: what you saw on site, what caused it, and the steps that cleared it. One good entry saves the next team a revisit.</p>
      <button class="btn btn-primary" type="button" data-add>Log the first fix</button></div>
      <div class="example"><div class="example-label">EXAMPLE · HOW AN ENTRY LOOKS</div>${cardHTML({ category: "RF & antenna", title: "High VSWR on one branch after rain", symptom: "VSWR alarm on sector B branch 2 only. Clears in dry weather, comes back after rain.", steps: [1, 2, 3, 4], worked: 0 }, true)}</div></div>`;
    return;
  }
  empty.hidden = !!list.length;
  if (!list.length) empty.innerHTML = `<div class="empty" style="grid-template-columns:1fr"><div><h2>No match</h2><p>Nothing fits that search yet. Try fewer words, another category, or log it as a new fix.</p><button class="btn" type="button" data-clear>Clear filters</button></div></div>`;
  grid.innerHTML = list.map(f => cardHTML(f, false)).join("");
}

/* ---------- detail ---------- */
function openDetail(id, refresh) {
  const f = S.fixes.find(x => x.id === id); const dlg = $("#detail"); if (!f) return;
  S.openId = id;
  const ex = stepsFor(id), worked = iWorked(id);
  const draft = refresh ? { text: ($("#d-add") || {}).value || "", name: ($("#d-name") || {}).value || "" } : { text: "", name: store.get(NAME_KEY, "") };
  const sec = (t, b, cls = "") => b ? `<section class="sec ${cls}"><h4>${t}</h4>${b}</section>` : "";
  const photos = l => l.length ? `<div class="photos">${l.map(p => `<a href="${photoLink(p)}" target="_blank" rel="noopener"><img alt="Site photo" loading="lazy" src="${photoUrl(p)}"></a>`).join("")}</div>` : "";
  dlg.innerHTML = `<div class="sheet">
    <div class="sheet-head"><div style="min-width:0">
      <div class="tagline"><span class="cat">${esc(f.category)}</span><span>${code(f.id)}</span>${f.country ? `<span>${esc(f.country)}</span>` : ""}</div>
      <h2 id="d-title" dir="auto">${esc(f.title)}</h2>
      <div class="meta" style="border:none;padding:0">${f.equipment ? `<span dir="auto"><b>${esc(f.equipment)}</b></span>·` : ""}<span dir="auto">${esc(f.name || "Field engineer")}</span><span>${esc(fmtDate(f.createdAt))}</span></div>
    </div><button class="iconbtn x" type="button" data-close aria-label="Close">${ICON.x}</button></div>
    <div class="sheet-body">
      ${sec("What you see on site", f.symptom ? `<div class="alarmbox" dir="auto">${esc(f.symptom)}</div>` : "")}
      ${sec("Root cause", f.cause ? `<p dir="auto">${esc(f.cause)}</p>` : "")}
      ${sec("Fix, step by step", f.steps.length ? `<ol class="steps">${f.steps.map(s => `<li><div dir="auto">${esc(s)}</div></li>`).join("")}</ol>` : "")}
      ${f.avoid ? `<section class="sec avoid"><h4>Avoid this</h4><p dir="auto">${esc(f.avoid)}</p></section>` : ""}
      ${sec("Photos", photos(f.photos))}
      ${f.tags.length ? `<div class="chips">${f.tags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
      <section class="sec"><h4>Added by the field · ${ex.length}</h4>
        <div class="extra">${ex.map(s => `<div class="extra-item" style="grid-template-columns:minmax(0,1fr)"><div><div class="t" dir="auto">${esc(s.text)}</div>${photos(s.photos)}<div class="by" dir="auto">${esc(s.name || "Field engineer")} · ${esc(fmtDate(s.createdAt))}</div></div></div>`).join("") || `<p style="color:var(--muted)">Did you solve it differently, or is there an extra step? Add it here.</p>`}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          <textarea id="d-add" rows="2" dir="auto" maxlength="2000" placeholder="Add a step, a tip, or what worked on your site…" aria-label="Add a step or tip">${esc(draft.text)}</textarea>
          <div class="addrow"><input id="d-name" type="text" dir="auto" maxlength="60" placeholder="Your name" aria-label="Your name" value="${esc(draft.name)}"><button class="btn" type="button" data-addstep>Add step</button></div>
          <div class="err" id="d-err" role="alert"></div>
        </div>
      </section>
    </div>
    <div class="sheet-foot">
      <button class="btn ${worked ? "btn-primary" : ""}" type="button" data-worked aria-pressed="${worked}">${ICON.check}${worked ? "Worked for me" : "This worked for me"} · ${f.worked || 0}</button>
    </div></div>`;
  if (!dlg.open) dlg.showModal();
}
$("#detail").addEventListener("close", () => { S.openId = null; });
$("#detail").addEventListener("click", async e => {
  const dlg = $("#detail"); if (e.target === dlg) { dlg.close(); return; }
  const t = e.target.closest("button"); if (!t) return;
  const f = S.fixes.find(x => x.id === S.openId); if (!f) return;
  if (t.hasAttribute("data-close")) dlg.close();
  else if (t.dataset.tag) { S.q = t.dataset.tag; $("#q").value = S.q; dlg.close(); render(); }
  else if (t.hasAttribute("data-worked")) {
    const undo = iWorked(f.id); const list = store.get(WORKED_KEY, []);
    store.set(WORKED_KEY, undo ? list.filter(x => x !== f.id) : [...list, f.id]);
    f.worked = Math.max(0, (f.worked || 0) + (undo ? -1 : 1)); render(); openDetail(f.id, true);
    try { const r = await apiPost({ action: "worked", fixId: f.id, undo }); f.worked = r.worked; render(); if (S.openId === f.id) openDetail(f.id, true); }
    catch { showNotice("Your vote didn’t save. Try again in a moment."); }
  }
  else if (t.hasAttribute("data-addstep")) {
    const text = $("#d-add").value.trim(), name = $("#d-name").value.trim();
    if (!text) { $("#d-err").textContent = "Write the step or tip first."; return; }
    if (!API) { $("#d-err").textContent = "The logbook isn’t connected yet."; return; }
    store.set(NAME_KEY, name); t.disabled = true; t.textContent = "Adding…";
    try { await apiPost({ action: "addStep", fixId: f.id, text, name }); $("#d-add").value = ""; await load(true); }
    catch { $("#d-err").textContent = "That step didn’t save. Check your connection and try again."; t.disabled = false; t.textContent = "Add step"; }
  }
});

/* ---------- editor ---------- */
let pendingPhotos = [];
function openEditor() {
  const dlg = $("#editor"); pendingPhotos = [];
  dlg.innerHTML = `<form class="sheet" id="fform" novalidate>
    <div class="sheet-head"><div><div class="eyebrow" style="color:var(--accent-ink)">New entry</div><h2 id="f-title">Log a fix</h2></div><button class="iconbtn x" type="button" data-close aria-label="Close">${ICON.x}</button></div>
    <div class="sheet-body">
      <label class="f">Problem in one line <input id="f-titlein" type="text" dir="auto" maxlength="140" placeholder="e.g. Radio not detected after power swap"></label>
      <div class="two">
        <label class="f">Category <select id="f-cat">${CATS.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
        <label class="f">Unit / equipment <small>optional</small><input id="f-prod" type="text" dir="auto" maxlength="80" placeholder="e.g. Radio 4415, PSU, Enclosure"></label>
      </div>
      <label class="f">What you saw on site <small>alarm text, symptom, when it happens</small><textarea id="f-sym" dir="auto" maxlength="2000"></textarea></label>
      <label class="f">Root cause <small>what was actually wrong</small><textarea id="f-cause" dir="auto" maxlength="2000"></textarea></label>
      <div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:13px;font-weight:600">Fix, step by step</span><div id="f-steps" style="display:flex;flex-direction:column;gap:8px"></div><button class="btn" type="button" data-addrow style="align-self:flex-start">+ Add step</button></div>
      <label class="f">Avoid this <small>the mistake that causes it, or what not to do</small><textarea id="f-avoid" dir="auto" maxlength="1000" style="min-height:56px"></textarea></label>
      <div class="two">
        <label class="f">Country / region <small>optional</small><input id="f-country" type="text" dir="auto" maxlength="40" placeholder="e.g. KSA"></label>
        <label class="f">Tags <small>comma separated</small><input id="f-tags" type="text" dir="auto" maxlength="160" placeholder="vswr, jumper, rain"></label>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:13px;font-weight:600">Photos <small style="font-weight:400;color:var(--muted)">up to 3 · hide site IDs and operator names</small></span><div class="photos" id="f-photos"></div><label class="btn" style="align-self:flex-start" id="f-photobtn">${ICON.cam}Add photo<input id="f-photo" type="file" accept="image/*" hidden></label></div>
      <label class="f">Your name <small>shown on the entry</small><input id="f-name" type="text" dir="auto" maxlength="60" value="${esc(store.get(NAME_KEY, ""))}"></label>
      <div class="err" id="f-err" role="alert"></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button><span style="flex:1"></span><button class="btn btn-primary" type="submit" id="f-save">Publish fix</button></div>
  </form>`;
  const box = dlg.querySelector("#f-steps"); addStepRow(box); addStepRow(box);
  if (!dlg.open) dlg.showModal();
  dlg.querySelector("#f-titlein").focus();
}
function addStepRow(box) {
  const row = document.createElement("div"); row.className = "steprow";
  row.innerHTML = `<span class="num"></span><textarea dir="auto" rows="2" maxlength="600" aria-label="Step" style="min-height:44px" placeholder="What to do"></textarea><button type="button" class="iconbtn" data-rmrow aria-label="Remove step">${ICON.x}</button>`;
  box.appendChild(row); [...box.children].forEach((r, i) => r.querySelector(".num").textContent = i + 1);
}
function renderPhotoThumbs() {
  $("#f-photos").innerHTML = pendingPhotos.map((p, i) => `<span style="position:relative"><a><img alt="Attached photo" src="data:${p.type};base64,${p.data}"></a><button type="button" class="iconbtn" data-rmphoto="${i}" aria-label="Remove photo" style="position:absolute;top:2px;right:6px;margin:0">${ICON.x}</button></span>`).join("");
  $("#f-photobtn").hidden = pendingPhotos.length >= 3;
}
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res({ type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.8).split(",")[1] }); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url;
  });
}
$("#editor").addEventListener("click", e => {
  const dlg = $("#editor"); if (e.target === dlg) { dlg.close(); return; }
  const t = e.target.closest("button"); if (!t) return;
  if (t.hasAttribute("data-close")) dlg.close();
  else if (t.hasAttribute("data-addrow")) { const box = $("#f-steps"); if (box.children.length < 20) { addStepRow(box); box.lastElementChild.querySelector("textarea").focus(); } }
  else if (t.hasAttribute("data-rmrow")) { const box = $("#f-steps"); if (box.children.length > 1) { t.closest(".steprow").remove(); [...box.children].forEach((r, i) => r.querySelector(".num").textContent = i + 1); } else t.closest(".steprow").querySelector("textarea").value = ""; }
  else if (t.dataset.rmphoto) { pendingPhotos.splice(Number(t.dataset.rmphoto), 1); renderPhotoThumbs(); }
});
$("#editor").addEventListener("change", async e => {
  if (e.target.id !== "f-photo" || !e.target.files[0]) return;
  const file = e.target.files[0]; e.target.value = "";
  try { pendingPhotos.push(await shrink(file)); renderPhotoThumbs(); $("#f-err").textContent = ""; }
  catch { $("#f-err").textContent = "That file couldn’t be read as a photo. Try a JPG or PNG."; }
});
$("#editor").addEventListener("submit", async e => {
  e.preventDefault();
  const title = $("#f-titlein").value.trim(), steps = [...$("#f-steps").querySelectorAll("textarea")].map(t => t.value.trim()).filter(Boolean);
  if (!title) { $("#f-err").textContent = "Add a one-line description of the problem."; $("#f-titlein").focus(); return; }
  if (!steps.length) { $("#f-err").textContent = "Add at least one step that fixed it."; return; }
  if (!API) { $("#f-err").textContent = "The logbook isn’t connected yet."; return; }
  const name = $("#f-name").value.trim(); store.set(NAME_KEY, name);
  const btn = $("#f-save"); btn.disabled = true; btn.textContent = pendingPhotos.length ? "Uploading…" : "Publishing…";
  try {
    await apiPost({ action: "addFix", title, category: $("#f-cat").value, equipment: $("#f-prod").value.trim(), symptom: $("#f-sym").value.trim(),
      cause: $("#f-cause").value.trim(), steps, avoid: $("#f-avoid").value.trim(), country: $("#f-country").value.trim(),
      tags: $("#f-tags").value.split(",").map(s => s.trim().replace(/^#/, "").toLowerCase()).filter(Boolean), photos: pendingPhotos, name });
    $("#editor").close(); showNotice(""); await load(true);
  } catch { $("#f-err").textContent = "That didn’t save. Check your connection and try again."; btn.disabled = false; btn.textContent = "Publish fix"; }
});

/* ---------- page ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-open],[data-cat],[data-add],[data-clear],#addBtn"); if (!t || t.closest("dialog")) return;
  if (t.dataset.open) openDetail(Number(t.dataset.open));
  else if (t.dataset.cat) { S.cat = t.dataset.cat; render(); }
  else if (t.hasAttribute("data-clear")) { S.cat = "ALL"; S.q = ""; $("#q").value = ""; render(); }
  else openEditor();
});
let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); render(); }, 120); });
$("#sort").addEventListener("change", e => { S.sort = e.target.value; render(); });
render(); load();
setInterval(() => { if (!document.hidden) load(true); }, 120000);
