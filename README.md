# Sydney Uni MCSR Leaderboard

A static leaderboard for Sydney university Minecraft societies, hosted free on GitHub Pages.
A GitHub Action fetches stats from the MCSR Ranked API every ~20 minutes and commits
`data/leaderboard.json`, which the page (`index.html`) reads.

## One-time setup

1. Create a new **public** GitHub repo and upload everything in this folder
   (keep the `.github/workflows/update.yml` path exactly).
2. **Settings → Actions → General → Workflow permissions** → choose
   **Read and write permissions** → Save.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
4. **Actions** tab → **Update leaderboard** → **Run workflow** (first fill of the data).
5. Your site will be at `https://<your-username>.github.io/<repo-name>/`.

## Adding / removing players

Edit `players.json` on GitHub (pencil icon) and commit. Each entry is the player's
**MCSR Ranked username** (their Minecraft IGN) and a uni code from `unis.json`:

```json
[
  { "name": "SomeIGN", "uni": "USYD" },
  { "name": "AnotherIGN", "uni": "UNSW" }
]
```

Commas between entries, none after the last one. Committing `players.json` triggers the Action
automatically, and the site updates within a minute or two.

## Adding or changing unis

Edit `unis.json`. The key is the short code used in `players.json`; set the display name and a
badge colour. Unknown codes fall back to `OTHER`.

## Notes

- Players not found on MCSR Ranked are skipped (the Action log tells you which, usually a typo).
- Unranked players (no ELO yet) appear at the bottom when sorting by ELO.
- If the API is down for a player, their last known stats are kept.
- PB and average use all-time ranked completions. Average = total completion time / completions.
- Uni standings = average ELO of each uni's top 3 ranked players.
- Scheduled Actions can run a few minutes late. GitHub also pauses schedules on repos with no
  activity for 60 days, but the bot's own commits count as activity, so this shouldn't happen.
