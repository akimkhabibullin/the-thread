# The Thread: video brief

Paste this into whatever is helping you plan the video. Target: **about 2 minutes, voiceover, simple cuts.**

## Links
- Repo (public): https://github.com/akimkhabibullin/the-thread
- Architecture: https://github.com/akimkhabibullin/the-thread/blob/main/ARCHITECTURE.md
- Shot list with timings: https://github.com/akimkhabibullin/the-thread/blob/main/DEMO.md
- Run locally: `npm install && npm run dev` → http://localhost:5280, then `claude "/thread"` in the folder (or the Band room)

## One-line pitch
The Thread is a go-to-market agent for founders: it finds the people most likely to buy, then the person in your own network who can introduce you, and drafts the ask with a source for every claim. Nothing is sent without your OK.

Tagline: **"Your next customer is two people away."**

## The problem (say this in the first 15 seconds)
Every AI sales tool does the same thing: scrape a list, blast cold email. Cold email is a coin toss. But somebody you already know usually knows your buyer, and a warm intro converts far better. Nobody uses that.

## What makes it different (mention all four)
1. **Warm paths first.** It reads your own LinkedIn export, schools and past jobs and finds You → your connection → the buyer. Where a path exists it writes an intro request to the mutual contact, not a cold email.
2. **Proof on every sentence.** Every factual sentence in a draft links to the page that proves it. An independent reviewer agent opens each source and blocks anything unsupported (proof score).
3. **Every deal grows your network.** Close a deal and the customer joins your network and gets a referral ask; connections who change jobs open new paths; shared communities count; it suggests people to meet.
4. **You stay in control.** Approve / edit / reject every message; full audit log of what the AI did vs. what you did.

## How it's built (one sentence each)
- **Claude Code is the brain**, connected over **MCP** to a local bridge (19 tools: save the ICP, add companies/people/signals, find warm paths, graph queries, draft, review…). It researches with web search, so citations come for free. No API key needed.
- **Band** runs it as a team of **4 agents in one room**: @planner (plans, talks to you), @scout (research + graph), @writer (outreach), @reviewer (checks every claim). They hand off with @mentions.
- **Knowledge graph**: companies, people, your connections, competitors, signals and drafts, with multi-hop queries (warm paths, hiring signals, competitor displacement, super-connectors, job changes).
- **Hunter.io** finds and verifies emails (credit-gated). **Flexprice** meters usage (leads enriched, outreach queued, graph queries) and the credits show in the app.
- **Scoring** is explainable: fit (≤60) + intent signals (≤25) + warm path (≤15) = 0–100, Tier A/B/C, with the reasons shown.
- **Privacy**: no passwords, no scraping logged-in sites; only your own LinkedIn export. LinkedIn's Dec 2026 export dropped connections' companies, so the agent finds where they work now from public pages, with sources.
- **Security**: Snyk dependency scan clean; code-scan findings fixed.
- Stack: React + Vite + TypeScript front end, Express + MCP SDK + WebSocket bridge.

## What the video must show (in this order)
| # | Shot | Seconds | Voiceover idea |
|---|---|---|---|
| 1 | Your Director ad / title | 0–15 | "Cold email is a coin toss. Your next customer is two people away." |
| 2 | Home page: the red thread draws You → Diego → Alexander (Webflow) | 15–25 | "The Thread finds the buyer, and the person you already know who can introduce you." |
| 3 | Get started → LinkedIn export step → "Connected." | 25–40 | "Your own LinkedIn export, your school, your old jobs. No passwords. Claude Code is the brain." |
| 4 | Band room: planner → scout → writer → reviewer hand-offs (sped up), next to the app's thinking feed | 40–60 | "Four agents in a Band room split the work; an independent reviewer checks every claim." |
| 5 | Leads: Tier A lead with its score reasons and warm path | 60–75 | "Every score explains itself." |
| 6 | Outreach: intro request, hover an underlined claim → its source, proof score, Approve → credits tick down | 75–95 | "Every sentence links to its proof. Nothing goes out until I approve it. Usage is metered with Flexprice." |
| 7 | Pipeline: drag a lead to Closed → referral ask appears; Network: people to meet | 95–110 | "And every deal grows your network." |
| 8 | Insights (conversion, A/B, warm vs cold, audit log) → logo + repo link | 110–120 | "The Thread. Your next customer is two people away." |

## Say honestly
- The warm paths in the demo come from a **sample network** (made-up connections), unless you upload your real export. Say "with a sample network" once.
- Pipeline replies/meetings are moved by hand in the demo (nothing is really sent).

## Recording tips
- Menu (☰) → **Load demo snapshot** before recording the finished-run shots.
- 1440-wide window, browser zoom 100%, notifications off, slow cursor.
- Record each shot as its own clip; speed up agent research 4–8x; voiceover on top.
- End card: logo, "The Thread", github.com/akimkhabibullin/the-thread.
