# Warmpath — plan

> Working name. "Your next customer is two people away. Warmpath finds the path."

HackwithBay 4.0 (Nov 24 2026, AWS Builder Loft). Theme: Thoughtful Agents for Productivity.
Mandatory brief: AI GTM Engine (5 modules + Band / Flexprice bonuses).

## The idea in one paragraph
A founder describes their product. A Claude agent turns it into an ICP, finds real target companies and buyers
(with sources), and then, unlike every other GTM tool, checks the founder's **own network** (their LinkedIn
`Connections.csv` export, school, past jobs) for a warm path to each buyer. Where a path exists it drafts an
**intro request to the mutual contact**; only buyers with no path get a cold email. Every claim in every
message links to its proof, a Reviewer agent blocks anything unsupported, and nothing is queued until the
founder approves it. When the founder rejects things, the agent notices the pattern and asks before
changing the ICP.

Three things that set it apart:
1. **Warm paths first** (the knowledge graph is the hero, not a checkbox).
2. **Proof on every sentence** (citations → a proof score; the Reviewer blocks unsupported claims).
3. **Learns from your no's** (rejections → "should I drop agencies from the ICP?"), plus voice control.

Demo product the founder is selling: **Director** (AI motion-graphics editor for creators and small marketing teams).

## What it is
A local web app (localhost), same shape as Director:
- `src/` React + Vite + TS, served at **http://localhost:5280**
- `server/` Express bridge on **127.0.0.1:5299**: MCP over streamable HTTP for Claude Code, a WebSocket for the
  live UI, REST for uploads, Hunter, Flexprice and Neo4j.
- **Claude Code is the AI engine** (no Anthropic API key): it connects through `.mcp.json`, runs `/warmpath`, and
  uses its built-in WebSearch/WebFetch for discovery, so citations come for free.
- Data: one JSON file (`data/db.json`), plus a graph layer that runs in memory and mirrors to **Neo4j AuraDB**
  when `NEO4J_URI` is set (multi-hop queries in Cypher there).

No passwords, no scraping logged-in sites. Founder network = an uploaded LinkedIn export + what they type in.

## Brief → feature map
| Module | What we build | Notes |
|---|---|---|
| 1 Intake & ICP | Chat/voice intake → `save_icp` (industries + NAICS, size, personas/titles/seniority, triggers), confidence 0–1 per field; expansion cards (accept / adjust / dismiss) | |
| 2 Discovery | Agent web-searches companies + buyers; every record carries `sources[]`; negative-signal filter (e.g. layoffs, already uses a competitor, too small); competitor cards (positioning, pricing, differentiators) | |
| 3 Graph | Nodes Company, Person, Product, Competitor, Signal (+ Founder). Edges works_at, previously_employed_at, competes_with, matched_to, contacted_via, replied_to, knows, studied_at. Named multi-hop queries: warm intro paths, hiring → buying signal, competitor displacement. "Refresh signals" button | Animated path view = the visual wow |
| 4 Enrich + outreach | Hunter.io email + domain (cached, credit-gated); 3-touch sequences (email + LinkedIn), A/B variant, intro-request vs cold; Approve / Edit / Reject gate before "Queued" | Nothing is really sent |
| 5 Dashboard | Kanban Matched → Contacted → Replied → Meeting → Closed/Lost; fit & intent 0–100 + Tier A/B/C; AI-vs-rep attribution + audit log; conversion by industry/tier; A/B stats; collapsible Agent Thinking feed | Replies/meetings marked by hand; A/B on labelled demo data |
| Band (+20%) | 4 Claude Code agents in a Band room: @planner (ICP), @scout (discovery + graph), @writer (sequences), @reviewer (proof check + safety). @mention handoffs, founder approves in the app | Fallback: one Claude Code doing all roles |
| Flexprice (+20%) | Meter `leads_enriched`, `outreach_sent` (approved), `graph_queries`; credits shown in the top bar; enrichment blocked at 0 credits | |
| Snyk | `snyk test` + `snyk code test` once, results in README | 10 min |

## MCP tools (server/index.ts)
- `wait_for_task` — next thing from the founder (intake text, voice, "find leads", answers, rejections with reasons).
- `think(agent, step, detail?)` — a line in the Agent Thinking feed.
- `save_icp(fields with confidence, expansions[])`
- `add_companies([...])`, `add_people([...])`, `add_signals([...])`, `add_competitors([...])` — all require `sources`.
- `enrich(person_ids)` — server calls Hunter (checks Flexprice credits first).
- `find_warm_paths(person_id?)` — server-side graph query against the founder's network.
- `graph_query(name, params)` — named multi-hop queries (warm_paths / hiring_signals / competitor_displacement).
- `draft_outreach(lead, kind: intro_request|cold, variant, touches[], claims[{text, source_url}])`
- `review_draft(draft_id, verdict, unsupported[])` — Reviewer.
- `ask_founder(question, options)`, `suggest_icp_change(change, evidence)`, `say(text)`, `get_state`.

Scoring (server, deterministic, explainable): ICP fit (industry, size, title, seniority) up to 60 + intent
signals up to 25 + warm-path bonus up to 15 → 0–100. Tier A ≥ 75, B ≥ 50, else C.

## Build order
Tonight (≈ 9:45 PM → 12:30 AM): core loop working end to end, ugly is fine.
1. [x] Scaffold `src/` + `server/`, WebSocket state sync, JSON db, `/warmpath` command, `.mcp.json`.
2. [x] Intake panel → `save_icp` → ICP view with confidences + expansion cards.
3. [x] Discovery tools (companies/people/signals/competitors with sources); Leads table with scores.
4. [x] Connections.csv upload + typed background → warm path finder → paths on each lead (+ sample network).
5. [x] Drafts (intro request / cold) → Reviewer proof score → Approve / Edit / Reject → Queued; Kanban; Insights + audit log.
6. [x] "Save demo snapshot" / "Load demo" in the ⋯ menu.
7. [ ] First real run with Claude Code (`/warmpath`) on Director: tune the prompt/tools from what goes wrong.
8. [ ] Hunter key in `.env`, test enrichment on 2–3 leads.

Tomorrow 11:00–12:00: proof score + Reviewer, learning from rejections, animated graph view.
Tomorrow 13:00–14:00: Flexprice meters + credits, Neo4j mirror + Cypher queries, Band room with 4 agents.
Tomorrow 14:00–14:45: analytics (industry/tier conversion, A/B), voice intake (from Director), polish.
Tomorrow 14:45–15:30: demo video (2–3 min), README setup, ARCHITECTURE.md, Snyk, push, submit.
Cut first if late: wow teaser → voice → Band → Neo4j mirror (in-memory graph still answers the queries).

## Accounts / keys (tonight) → `.env`
- [ ] AWS Builder portal registration for the venue (required to get in) + physical ID, arrive by 9:55
- [ ] LinkedIn data export requested (Connections) → `Connections.csv`
- [ ] Hunter.io → `HUNTER_API_KEY`
- [ ] Neo4j AuraDB Free → `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (shown once, save it)
- [ ] Flexprice → `FLEXPRICE_API_KEY` (+ create the 3 meters)
- [ ] Band desktop app installed, room with 2 Claude Code agents tested (30 min cap)
- [ ] Snyk free account + CLI; public GitHub repo
- [ ] Optional: Nexla (main partner, agent data connectors over MCP), only if signup is quick

## Demo script (2–3 min)
1. "Cold email is dead; your next customer is two people away." Founder speaks a 30 s pitch for Director.
2. ICP appears with confidences; accept one expansion suggestion.
3. Agent Thinking feed scrolls while @scout finds companies + buyers, each with source links.
4. Upload Connections.csv → graph animates: You → Sarah → Jane (Head of Brand, Acme). Tier A, 88.
5. Draft is an intro request to Sarah, every claim underlined with its source; Reviewer flagged one claim → fixed.
6. Approve → Queued; credits tick down (Flexprice). Reject two agency leads → agent asks to drop agencies.
7. Kanban + analytics + audit log (AI vs founder actions). Band room shows the 4 agents handing off.
