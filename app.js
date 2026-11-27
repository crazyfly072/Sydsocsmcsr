(() => {
  const $ = id => document.getElementById(id);
  const state = { rows: [], unis: {}, updated: 0, sort: "elo", uni: "", q: "" };

  const fmtTime = ms => {
    if (ms == null) return "--:--.---";
    const m = String(Math.floor(ms / 60000)).padStart(2, "0");
    const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    const t = String(Math.floor(ms % 1000)).padStart(3, "0");
    return `${m}:${s}.${t}`;
  };

  const ago = ts => {
    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
    return `${Math.round(sec / 86400)} d ago`;
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uniInfo = key => state.unis[key] || state.unis.OTHER || { name: key, color: "#94a3b8" };

  // Sorting: missing values always go to the bottom.
  function compare(a, b) {
    const by = {
      elo: r => (r.elo == null ? null : -r.elo),
      pb: r => r.pbMs,
      avg: r => r.avgMs,
    }[state.sort];
    const x = by(a), y = by(b);
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return x - y || a.name.localeCompare(b.name);
  }

  function renderStandings() {
    const byUni = {};
    for (const r of state.rows) if (r.elo != null) (byUni[r.uni] ||= []).push(r.elo);
    const list = Object.entries(byUni).map(([uni, elos]) => {
      const top = elos.sort((a, b) => b - a).slice(0, 3);
      return { uni, score: Math.round(top.reduce((a, b) => a + b, 0) / top.length), n: elos.length };
    }).sort((a, b) => b.score - a.score);

    $("standings").hidden = list.length < 2;
    const max = Math.max(...list.map(l => l.score), 1);
    $("standings-list").innerHTML = list.map((l, i) => {
      const u = uniInfo(l.uni);
      return `<div class="st-row">
        <span class="st-pos">${i + 1}</span>
        <div class="st-bar"><div class="st-fill" style="width:${(l.score / max) * 100}%;background:${esc(u.color)}33;border-right:3px solid ${esc(u.color)}"></div>
          <span class="st-label">${esc(l.uni)}<small>${l.n} ranked</small></span></div>
        <span class="st-score">${l.score}</span>
      </div>`;
    }).join("");
  }

  function renderTable() {
    const q = state.q.trim().toLowerCase();
    const rows = state.rows
      .filter(r => (!state.uni || r.uni === state.uni) && (!q || r.name.toLowerCase().includes(q)))
      .sort(compare);

    $("rows").innerHTML = rows.map((r, i) => {
      const u = uniInfo(r.uni);
      const tierBase = r.tier.split(" ")[0];
      const head = r.uuid ? `<img src="https://mc-heads.net/avatar/${esc(r.uuid)}/44" alt="" loading="lazy" onerror="this.remove()">` : "";
      return `<tr>
        <td class="pos">${i + 1}</td>
        <td><a class="player" href="https://mcsrranked.com/stats/${encodeURIComponent(r.name)}" target="_blank" rel="noopener">${head}${esc(r.name)}</a></td>
        <td><span class="badge" style="color:${esc(u.color)};border-color:${esc(u.color)}66" title="${esc(u.name)}">${esc(r.uni)}</span></td>
        <td class="num">${r.elo ?? '<span class="dim">–</span>'}</td>
        <td class="tier tier-${esc(tierBase)}">${esc(r.tier)}</td>
        <td class="num ${r.pbMs == null ? "dim" : ""}">${fmtTime(r.pbMs)}</td>
        <td class="num ${r.avgMs == null ? "dim" : ""}">${fmtTime(r.avgMs)}</td>
      </tr>`;
    }).join("");

    const empty = $("empty");
    if (state.rows.length === 0) {
      empty.hidden = false;
      empty.textContent = "No data yet. Add players to players.json and run the Action once.";
    } else if (rows.length === 0) {
      empty.hidden = false;
      empty.textContent = "No players match.";
    } else empty.hidden = true;
  }

  function renderUpdated() {
    $("updated").textContent = state.updated ? `Updated ${ago(state.updated)}` : "";
  }

  function fillFilter() {
    const used = [...new Set(state.rows.map(r => r.uni))].sort();
    $("uni-filter").innerHTML = `<option value="">All unis</option>` +
      used.map(u => `<option value="${esc(u)}">${esc(uniInfo(u).name)}</option>`).join("");
  }

  function bind() {
    $("sort").addEventListener("click", e => {
      const b = e.target.closest("button[data-sort]");
      if (!b) return;
      state.sort = b.dataset.sort;
      for (const x of $("sort").children) x.classList.toggle("active", x === b);
      renderTable();
    });
    $("search").addEventListener("input", e => { state.q = e.target.value; renderTable(); });
    $("uni-filter").addEventListener("change", e => { state.uni = e.target.value; renderTable(); });
  }

  async function load() {
    const bust = `?t=${Math.floor(Date.now() / 60000)}`;
    const [data, unis] = await Promise.all([
      fetch(`data/leaderboard.json${bust}`).then(r => r.json()),
      fetch(`unis.json${bust}`).then(r => r.json()),
    ]);
    state.rows = data.rows || [];
    state.updated = data.updated || 0;
    state.unis = unis;
    fillFilter();
    renderStandings();
    renderTable();
    renderUpdated();
  }

  bind();
  load().catch(err => {
    console.error(err);
    $("empty").hidden = false;
    $("empty").textContent = "Couldn't load leaderboard data.";
  });
  setInterval(renderUpdated, 30000);
})();
