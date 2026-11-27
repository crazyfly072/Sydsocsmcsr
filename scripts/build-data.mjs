// Fetches stats for every player in players.json from the MCSR Ranked API
// and writes data/leaderboard.json. Run by the GitHub Action (Node 20+).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = (process.env.MCSR_API_BASE || "https://api.mcsrranked.com").replace(/\/$/, "");
const OUT = path.join(root, "data", "leaderboard.json");
const DELAY_MS = Number(process.env.REQUEST_DELAY_MS ?? 400);

const players = JSON.parse(fs.readFileSync(path.join(root, "players.json"), "utf8"));
const unis = JSON.parse(fs.readFileSync(path.join(root, "unis.json"), "utf8"));

let previous = { rows: [] };
try { previous = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}
const prevByName = new Map(previous.rows.map(r => [r.name.toLowerCase(), r]));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getUser(name) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${API}/users/${encodeURIComponent(name)}`, {
      headers: { "User-Agent": "syd-mcsr-leaderboard (github pages)" },
    });
    if (res.status === 404) return { notFound: true };
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || attempt * 3000;
      console.warn(`  ${name}: HTTP ${res.status}, retrying in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const json = await res.json();
    if (json.status !== "success" || !json.data) throw new Error(`bad response: ${JSON.stringify(json).slice(0, 200)}`);
    return { data: json.data };
  }
  throw new Error("gave up after retries");
}

// MCSR Ranked tier thresholds (verified against the Maccord leaderboard).
function tierFor(elo) {
  if (elo == null) return "Unranked";
  if (elo >= 2000) return "Netherite";
  const bands = [
    ["Diamond", 1500, 150], ["Emerald", 1200, 100], ["Gold", 900, 100],
    ["Iron", 600, 100], ["Coal", 0, 200],
  ];
  for (const [tier, min, step] of bands) {
    if (elo >= min) {
      const div = Math.min(2, Math.floor((elo - min) / step));
      return `${tier} ${["I", "II", "III"][div]}`;
    }
  }
  return "Coal I";
}

const rows = [];
for (const p of players) {
  if (!p.name) continue;
  const uni = unis[p.uni] ? p.uni : "OTHER";
  if (!unis[p.uni]) console.warn(`  ${p.name}: unknown uni "${p.uni}", using OTHER (add it to unis.json)`);
  try {
    const r = await getUser(p.name);
    if (r.notFound) {
      console.warn(`  ${p.name}: not found on MCSR Ranked, skipping (check the spelling)`);
    } else {
      const d = r.data;
      const s = d.statistics?.total ?? {};
      const comps = s.completions?.ranked ?? 0;
      const totalTime = s.completionTime?.ranked ?? 0;
      rows.push({
        name: d.nickname ?? p.name,
        uuid: d.uuid ?? null,
        uni,
        elo: d.eloRate ?? null,
        tier: tierFor(d.eloRate ?? null),
        pbMs: s.bestTime?.ranked ?? null,
        avgMs: comps > 0 && totalTime > 0 ? Math.round(totalTime / comps) : null,
        completions: comps,
      });
      console.log(`  ${d.nickname ?? p.name}: elo=${d.eloRate ?? "-"} pb=${s.bestTime?.ranked ?? "-"}`);
    }
  } catch (e) {
    console.warn(`  ${p.name}: fetch failed (${e.message})`);
    const old = prevByName.get(p.name.toLowerCase());
    if (old) rows.push({ ...old, uni }); // keep last known stats
  }
  await sleep(DELAY_MS);
}

if (rows.length === 0 && players.length > 0 && previous.rows.length > 0) {
  console.error("No rows fetched at all - keeping previous data.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ updated: Date.now(), rows }, null, 1));
console.log(`Wrote ${rows.length} players to data/leaderboard.json`);
