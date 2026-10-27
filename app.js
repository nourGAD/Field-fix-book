// Field Fix Book: reads "Log a site fix" issues from this repo through the public GitHub API.
const loc = location.hostname.endsWith(".github.io")
  ? { owner: location.hostname.split(".")[0], repo: location.pathname.split("/").filter(Boolean)[0] }
  : {};
const OWNER = loc.owner || "nourGAD";
const REPO = loc.repo || "Field-fix-book";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;
const NEW_URL = `${REPO_URL}/issues/new?template=fix.yml`;
const CACHE_KEY = "ffb-cache-v1";
const CACHE_MS = 3 * 60 * 1000;

const CATS = ["Power & DC","RF & antenna","Transmission & fiber","Alarms & sensors","Integration & SW","Installation & HW","Site & environment","Safety"];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICON = {
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
const S = { fixes: [], q: "", cat: "ALL", sort: "new", ready: false, comments: {} };

/* ---------- parsing ---------- */
const IMG_RE = /!\[[^\]]*\]\((https:\/\/[^)\s]+)\)|<img[^>]*src="(https:\/\/[^"]+)"[^>]*>/gi;
const okHost = u => { try { const h = new URL(u).hostname; return h === "github.com" || h.endsWith(".githubusercontent.com"); } catch { return false; } };
function images(text) { const out = []; String(text || "").replace(IMG_RE, (m, a, b) => { const u = a || b; if (okHost(u)) out.push(u); return ""; }); return out; }
const stripImages = t => String(t || "").replace(IMG_RE, "").trim();
function sections(body) {
  const map = {}; const parts = String(body || "").split(/^###\s+(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const v = parts[i + 1].trim();
    map[parts[i].trim().toLowerCase()] = v === "_No response_" ? "" : v;
  }
  return map;
}
function toFix(issue) {
  const s = sections(issue.body);
  const steps = (s["fix steps"] || "").split(/\r?\n/).map(l => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean);
  return {
    id: issue.number, url: issue.html_url,
    title: issue.title.replace(/^\[fix\]\s*/i, "").trim() || "Untitled fix",
    category: CATS.includes(s["category"]) ? s["category"] : "Other",
    product: s["unit / equipment"] || "", symptom: stripImages(s["what you saw on site"]), cause: stripImages(s["root cause"]),
    steps, avoid: stripImages(s["avoid this"]), country: s["country / region"] || "",
    tags: (s["tags"] || "").split(",").map(t => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean),
    photos: images(issue.body).slice(0, 6),
    author: issue.user?.login || "", avatar: issue.user?.avatar_url || "",
    created: Date.parse(issue.created_at) || 0, worked: issue.reactions?.["+1"] || 0, comments: issue.comments || 0
  };
}

/* ---------- data ---------- */
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } }
function writeCache(data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch {} }
async function fetchIssues() {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${API}/issues?state=open&per_page=100&page=${page}`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw Object.assign(new Error("http"), { status: r.status });
    const batch = await r.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.filter(i => !i.pull_request && /^###\s+Fix steps/m.test(i.body || ""));
}
async function load() {
  const cached = readCache();
  if (cached) { S.fixes = cached.data.map(toFix); S.ready = true; render(); }
  if (cached && Date.now() - cached.t < CACHE_MS) return;
  try {
    const issues = await fetchIssues();
    writeCache(issues); S.fixes = issues.map(toFix); showNotice("");
  } catch (e) {
    if (e.status === 403 || e.status === 429) showNotice("GitHub is limiting requests from your network right now. Showing the last saved copy; try again in a few minutes.");
    else if (e.status === 404) showNotice("The logbook repository wasn’t found. Check that it exists and is public.");
    else showNotice("Couldn’t reach GitHub. Check your connection and reload.");
  }
  S.ready = true; render();
}
async function loadComments(f) {
  if (S.comments[f.id] || !f.comments) return S.comments[f.id] || [];
  try {
    const r = await fetch(`${API}/issues/${f.id}/comments?per_page=100`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw 0;
    S.comments[f.id] = (await r.json()).map(c => ({ text: stripImages(c.body), photos: images(c.body), by: c.user?.login || "", avatar: c.user?.avatar_url || "", at: Date.parse(c.created_at) || 0, url: c.html_url }));
  } catch { return null; }
  return S.comments[f.id];
}

/* ---------- render ---------- */
const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
function matches(f) {
  if (S.cat !== "ALL" && f.category !== S.cat) return false;
  if (!S.q) return true;
  const hay = [f.title, f.symptom, f.cause, f.product, f.country, f.avoid, f.tags.join(" "), f.steps.join(" "), f.author].join(" ").toLowerCase();
  return S.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function renderChips() {
  const counts = {}; S.fixes.forEach(f => counts[f.category] = (counts[f.category] || 0) + 1);
  $("#chips").innerHTML = ["ALL", ...CATS].map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat === c}">${esc(c === "ALL" ? "All" : c)} <span class="n">${c === "ALL" ? S.fixes.length : (counts[c] || 0)}</span></button>`).join("");
}
function renderStats() {
  $("#st-fixes").textContent = S.fixes.length;
  $("#st-people").textContent = new Set(S.fixes.map(f => f.author)).size;
  $("#st-worked").textContent = S.fixes.reduce((n, f) => n + f.worked, 0);
}
function cardHTML(f, example) {
  const n = f.steps.length;
  return `<${example ? "div" : 'button type="button"'} class="card" ${example ? "" : `data-open="${f.id}"`}>
    <div class="tagline"><span class="cat">${esc(f.category)}</span><span>${example ? "FX-EXAMPLE" : "FX-" + String(f.id).padStart(4, "0")}</span></div>
    <h3 dir="auto">${esc(f.title)}</h3>
    <p class="sym" dir="auto">${esc(f.symptom || f.cause)}</p>
    <div class="meta">
      <span class="who">${f.avatar ? `<img alt="" src="${esc(f.avatar)}&s=48">` : ""}<span>${esc(example ? "Example entry" : f.author)}</span></span>
      <span class="spacer"></span>
      <span class="pill steps">${ICON.list}${n} step${n === 1 ? "" : "s"}</span>
      <span class="pill ok" title="Worked for me">${ICON.check}${f.worked}</span>
    </div></${example ? "div" : "button"}>`;
}
function render() {
  renderChips(); renderStats();
  const list = S.fixes.filter(matches).sort((a, b) => S.sort === "worked" ? (b.worked - a.worked) || (b.created - a.created) : b.created - a.created);
  const empty = $("#empty"), grid = $("#list");
  if (!S.fixes.length) {
    grid.innerHTML = ""; empty.hidden = false;
    empty.innerHTML = `<div class="empty"><div><h2>${S.ready ? "No fixes logged yet" : "Loading the logbook…"}</h2>
      <p>Start with a fault you fixed recently: what you saw on site, what caused it, and the steps that cleared it. One good entry saves the next team a revisit.</p>
      <a class="btn btn-primary" target="_blank" rel="noopener" href="${NEW_URL}">Log the first fix</a></div>
      <div class="example"><div class="example-label">EXAMPLE · HOW AN ENTRY LOOKS</div>${cardHTML({ category: "RF & antenna", title: "High VSWR on one branch after rain", symptom: "VSWR alarm on sector B branch 2 only. Clears in dry weather, comes back after rain.", cause: "", steps: [1, 2, 3, 4], worked: 0, avatar: "" }, true)}</div></div>`;
    return;
  }
  empty.hidden = !!list.length;
  if (!list.length) empty.innerHTML = `<div class="empty" style="grid-template-columns:1fr"><div><h2>No match</h2><p>Nothing fits that search yet. Try fewer words, another category, or log it as a new fix.</p><button class="btn" type="button" data-clear>Clear filters</button></div></div>`;
  grid.innerHTML = list.map(f => cardHTML(f, false)).join("");
}

/* ---------- detail ---------- */
async function openDetail(id) {
  const f = S.fixes.find(x => x.id === id); if (!f) return;
  const dlg = $("#detail");
  const sec = (t, body, cls = "") => body ? `<section class="sec ${cls}"><h4>${t}</h4>${body}</section>` : "";
  const photos = list => list.length ? `<div class="photos">${list.map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img alt="Site photo" loading="lazy" src="${esc(p)}"></a>`).join("")}</div>` : "";
  const draw = comments => {
    dlg.innerHTML = `<div class="sheet">
    <div class="sheet-head"><div style="min-width:0">
      <div class="tagline"><span class="cat">${esc(f.category)}</span><span>FX-${String(f.id).padStart(4, "0")}</span>${f.country ? `<span>${esc(f.country)}</span>` : ""}</div>
      <h2 id="d-title" dir="auto">${esc(f.title)}</h2>
      <div class="meta" style="border:none;padding:0">${f.product ? `<span dir="auto"><b>${esc(f.product)}</b></span>·` : ""}<span class="who"><img alt="" src="${esc(f.avatar)}&s=48"><span>${esc(f.author)}</span></span><span>${esc(fmtDate(f.created))}</span></div>
    </div><button class="iconbtn x" type="button" data-close aria-label="Close">${ICON.x}</button></div>
    <div class="sheet-body">
      ${sec("What you see on site", f.symptom ? `<div class="alarmbox" dir="auto">${esc(f.symptom)}</div>` : "")}
      ${sec("Root cause", f.cause ? `<p dir="auto">${esc(f.cause)}</p>` : "")}
      ${sec("Fix, step by step", f.steps.length ? `<ol class="steps">${f.steps.map(s => `<li><div dir="auto">${esc(s)}</div></li>`).join("")}</ol>` : "")}
      ${f.avoid ? `<section class="sec avoid"><h4>Avoid this</h4><p dir="auto">${esc(f.avoid)}</p></section>` : ""}
      ${sec("Photos", photos(f.photos))}
      ${f.tags.length ? `<div class="chips">${f.tags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
      <section class="sec"><h4>Added by the field · ${f.comments}</h4>
        <div class="extra">${comments === null ? `<p style="color:var(--muted)">Couldn’t load the added steps. <a href="${esc(f.url)}" target="_blank" rel="noopener" style="color:inherit">Read them on GitHub</a>.</p>`
          : comments.length ? comments.map(c => `<div class="extra-item"><img alt="" src="${esc(c.avatar)}&s=48"><div><div class="t" dir="auto">${esc(c.text)}</div>${photos(c.photos)}<div class="by">${esc(c.by)} · ${esc(fmtDate(c.at))}</div></div><span></span></div>`).join("")
          : `<p style="color:var(--muted)">Did you solve it differently, or is there an extra step? Add it as a comment on GitHub.</p>`}</div>
      </section>
    </div>
    <div class="sheet-foot">
      <a class="btn btn-primary" target="_blank" rel="noopener" href="${esc(f.url)}">${ICON.check}Worked for me? React 👍 · ${f.worked}</a>
      <a class="btn" target="_blank" rel="noopener" href="${esc(f.url)}#issuecomment-new">Add your step</a>
      <span style="flex:1"></span>
      <a class="btn btn-ghost" target="_blank" rel="noopener" href="${esc(f.url)}">Open on GitHub</a>
    </div></div>`;
  };
  draw(f.comments ? [] : []);
  if (!dlg.open) dlg.showModal();
  if (f.comments) { const c = await loadComments(f); if (dlg.open) draw(c); }
}
$("#detail").addEventListener("click", e => {
  const dlg = $("#detail"); if (e.target === dlg) { dlg.close(); return; }
  const t = e.target.closest("button"); if (!t) return;
  if (t.hasAttribute("data-close")) dlg.close();
  else if (t.dataset.tag) { S.q = t.dataset.tag; $("#q").value = S.q; dlg.close(); render(); }
});
function showNotice(m) { const n = $("#notice"); n.textContent = m; n.hidden = !m; }

/* ---------- page events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-open],[data-cat],[data-clear]"); if (!t || t.closest("dialog")) return;
  if (t.dataset.open) openDetail(Number(t.dataset.open));
  else if (t.dataset.cat) { S.cat = t.dataset.cat; render(); }
  else if (t.hasAttribute("data-clear")) { S.cat = "ALL"; S.q = ""; $("#q").value = ""; render(); }
});
let qt; $("#q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); render(); }, 120); });
$("#sort").addEventListener("change", e => { S.sort = e.target.value; render(); });
$("#addBtn").href = NEW_URL;
$("#repoLink").href = REPO_URL; $("#repoLink").textContent = `${OWNER}/${REPO}`;
render(); load();
