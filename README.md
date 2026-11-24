# Warmpath

An AI go-to-market agent that finds your buyers and the warm path to each one: who in **your own network** can introduce you. Every claim it writes links to its source, and nothing is queued until you approve it.

Built for HackwithBay 4.0 (theme: Thoughtful Agents for Productivity). See `PLAN.md` for the full plan.

## Run it
```bash
npm install
cp .env.example .env   # add HUNTER_API_KEY (optional: Neo4j, Flexprice)
npm run dev            # bridge on 127.0.0.1:5299, app on http://localhost:5280
```
Then in another terminal in this folder: `claude`, then `/warmpath`. Claude Code connects through `.mcp.json` and waits for you in the app.

## How it fits together
- `server/index.ts`: the bridge. MCP tools for Claude Code (`wait_for_task`, `save_icp`, `add_companies`, `add_people`, `add_signals`, `add_competitors`, `enrich`, `find_warm_paths`, `graph_query`, `draft_outreach`, `review_draft`, `suggest_icp_change`, `ask_founder`, `say`, `think`, `get_state`), a WebSocket for the live app, REST for network upload and demo snapshots.
- `shared/logic.ts`: warm paths, the 0–100 fit & intent score (Tier A/B/C), proof score, LinkedIn CSV parsing. Pure and explainable.
- `server/hunter.ts`: email enrichment (cached, credit-gated). `server/meter.ts`: usage meters (Flexprice).
- `src/`: the React app (ICP, Leads, Network, Outreach approval, Pipeline, Insights + audit log, Agent Thinking feed).
- Your network = your own LinkedIn `Connections.csv` export plus your schools and past companies. No passwords, no scraping.
