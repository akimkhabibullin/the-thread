// The Thread's local bridge. One process:
//   • /mcp — Claude Code connects here (see .mcp.json) and does the GTM work through tools
//   • /ws  — the web app gets live state and sends the founder's input, approvals and rejections
//   • /api — network upload, demo snapshots, health
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import express from 'express';
import {createMcpExpressApp} from '@modelcontextprotocol/express';
import {NodeStreamableHTTPServerTransport} from '@modelcontextprotocol/node';
import {McpServer} from '@modelcontextprotocol/server';
import {WebSocketServer, WebSocket} from 'ws';
import * as z from 'zod/v4';
import {Actor, Company, Contact, DB, emptyDB, Person, Stage, STAGES, uid} from '../shared/types';
import {leads, norm, parseConnections, proofScore, sameOrg, superConnectors} from '../shared/logic';
import {enrichPerson} from './hunter';
import {flexpriceStatus, initFlexprice, meter} from './meter';

const PORT = Number(process.env.PORT ?? 5299);
const DATA = join(process.cwd(), 'data');
const DB_FILE = join(DATA, 'db.json'), DEMO_FILE = join(DATA, 'demo-snapshot.json');
mkdirSync(DATA, {recursive: true});

/* ---------- state ---------- */
let db: DB = existsSync(DB_FILE) ? {...emptyDB(), ...JSON.parse(readFileSync(DB_FILE, 'utf8'))} : emptyDB(Number(process.env.CREDITS ?? 50));
let saveTimer: NodeJS.Timeout | undefined;
const clients = new Set<WebSocket>();
const send = (msg: object) => { const s = JSON.stringify(msg); for (const w of clients) if (w.readyState === WebSocket.OPEN) w.send(s); };
function changed() {
  send({type: 'db', db});
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeFileSync(DB_FILE, JSON.stringify(db, null, 1)), 300);
}
const audit = (actor: Actor, action: string, target?: string, detail?: string, agent?: string) => { db.audit.push({at: Date.now(), actor, agent, action, target, detail}); };
const think = (agent: string, step: string, detail?: string) => { db.thoughts.push({at: Date.now(), agent, step, detail}); if (db.thoughts.length > 400) db.thoughts.splice(0, 100); };

/* ---------- tasks from the founder ---------- */
type Task = {text: string; kind: string; at: number};
const queue: Task[] = [];
let waiter: ((t: Task | null) => void) | null = null;
let lastAgentAt = 0;
const status = (s: 'listening' | 'working' | 'offline') => send({type: 'agent_status', status: s});
function pushTask(text: string, kind = 'chat') {
  const t = {text, kind, at: Date.now()};
  if (waiter) { const w = waiter; waiter = null; w(t); } else queue.push(t);
}

function stateSummary() {
  const L = leads(db);
  const lines = [
    db.icp ? `ICP: ${db.icp.summary}` : 'No ICP yet.',
    `Companies: ${db.companies.length} (${db.companies.filter((c) => c.negative).length} excluded by negative signals). People: ${db.people.length}. Signals: ${db.signals.length}. Competitors: ${db.competitors.length}.`,
    `Founder network: ${db.founder.network.length} connections; schools: ${db.founder.schools.join(', ') || 'none'}; past companies: ${db.founder.pastCompanies.join(', ') || 'none'}.`,
    `Leads with a warm path: ${L.filter((l) => l.paths.length).length}. Tier A/B/C: ${['A', 'B', 'C'].map((t) => L.filter((l) => l.tier === t).length).join('/')}.`,
    `Drafts: ${db.drafts.filter((d) => d.status === 'pending').length} pending, ${db.drafts.filter((d) => d.status === 'approved').length} approved, ${db.drafts.filter((d) => d.status === 'rejected').length} rejected.`,
    `Credits left for enrichment: ${db.usage.credits}.`,
  ];
  return lines.join('\n');
}

/** Learning from the founder's no's: when rejections cluster, ask the agent to propose an ICP change. */
function checkRejectionPattern() {
  const rejected = db.drafts.filter((d) => d.status === 'rejected');
  const byIndustry = new Map<string, {n: number; reasons: string[]}>();
  for (const d of rejected) {
    const p = db.people.find((x) => x.id === d.personId), c = db.companies.find((x) => x.id === p?.companyId);
    const k = c?.industry ?? 'unknown';
    const e = byIndustry.get(k) ?? {n: 0, reasons: []};
    e.n++; if (d.rejectReason) e.reasons.push(d.rejectReason);
    byIndustry.set(k, e);
  }
  for (const [ind, e] of byIndustry) {
    if (e.n < 2 || ind === 'unknown') continue;
    if (db.icpChanges.some((x) => x.change.toLowerCase().includes(ind.toLowerCase()))) continue;
    pushTask(`Pattern: the founder has rejected ${e.n} leads in "${ind}"${e.reasons.length ? ` (reasons: ${e.reasons.join('; ')})` : ''}. If this looks like a real preference, call suggest_icp_change (don't change the ICP yourself).`, 'pattern');
    return;
  }
}

/* ---------- MCP ---------- */
const INSTRUCTIONS = `You are The Thread, a thoughtful go-to-market agent for a founder. You find the right buyers, prefer warm introductions through the founder's own network over cold outreach, and never claim anything you can't source. The founder approves every message; nothing is sent without them.

Loop: call wait_for_task, do the work with the tools below, then call wait_for_task again. Narrate meaningful steps with think (short, concrete: "Searching for SaaS companies hiring motion designers"), so the founder can follow along in the Agent Thinking feed.

When you tell the founder to go somewhere ("review the drafts", "check your leads"), attach it as an action on say, e.g. actions: [{label: "Review 4 drafts", to: "outreach"}], so it becomes a button that opens that page. Never mention ids, tool names or env vars.

Typical flow for a new product: save_icp (with honest confidences and 2–4 expansions) → research with WebSearch/WebFetch → add_competitors → add_companies (exclude bad fits with a negative signal and its source) → add_people (real, role-matched buyers with public sources; include their past companies and schools when public, since that's what finds warm paths) → add_signals (hiring, funding, launches, with URLs) → enrich the best leads → find_warm_paths → draft_outreach for Tier A/B leads → review_draft each draft as the Reviewer.

Rules: every company, person, signal and competitor needs at least one real source URL you actually read. Never invent people or emails. Every factual sentence in a draft goes in claims[] with its source URL; if you can't source it, cut it. Where a warm path exists, write an intro_request to the mutual connection (short, easy to forward, with a 2-sentence blurb they can paste), not a cold email to the buyer. Ask the founder (ask_founder) only when a choice is genuinely theirs, at most one question at a time. When the founder rejects things, look for the pattern and propose an ICP change with suggest_icp_change instead of silently changing course.`;

const src = z.array(z.object({url: z.string().url(), title: z.string().optional()})).min(1);
const conf = <T extends z.ZodType>(v: T) => z.object({value: v, confidence: z.number().min(0).max(1), why: z.string().optional()});
const ok = (text: string) => ({content: [{type: 'text' as const, text}]});
const err = (text: string) => ({content: [{type: 'text' as const, text}], isError: true});
const findCompany = (ref: string) => db.companies.find((c) => c.id === ref || sameOrg(c.name, ref) || (c.domain && norm(c.domain) === norm(ref)));

function makeServer() {
  const mcp = new McpServer({name: 'thread', version: '0.1.0'}, {instructions: INSTRUCTIONS});
  const reg = mcp.registerTool.bind(mcp) as (...a: unknown[]) => unknown;
  (mcp as unknown as {registerTool: unknown}).registerTool = (name: string, cfg: unknown, cb: (...a: unknown[]) => Promise<{isError?: boolean; content: {type: string; text?: string}[]}>) =>
    reg(name, cfg, async (...args: unknown[]) => {
      lastAgentAt = Date.now();
      const r = await cb(...args);
      if (name !== 'wait_for_task' || !r.content[0]?.text?.startsWith('Nothing')) console.log(`[mcp] ${name} ${r.isError ? 'ERROR ' + (r.content[0]?.text ?? '').slice(0, 160) : 'ok'}`);
      if (name !== 'wait_for_task') changed();
      return r;
    });

  mcp.registerTool('wait_for_task', {
    description: 'Wait for the founder\'s next input (product description, a request, an answer, a rejection pattern). Returns within ~90 s; if nothing came, call it again.',
    inputSchema: z.object({}),
  }, async () => {
    let t = queue.shift() ?? null;
    if (!t) {
      status('listening');
      t = await new Promise<Task | null>((res) => { waiter = res; setTimeout(() => { if (waiter === res) { waiter = null; res(null); } }, 90_000); });
    }
    lastAgentAt = Date.now();
    if (!t) return ok('Nothing yet. Call wait_for_task again.');
    status('working');
    return ok(`From the founder (${t.kind}): "${t.text}"\n\nCurrent state:\n${stateSummary()}`);
  });

  mcp.registerTool('get_state', {description: 'Everything so far as JSON: ICP, companies, people, signals, competitors, scored leads with warm paths, drafts, founder network size.', inputSchema: z.object({})},
    async () => ok(JSON.stringify({icp: db.icp, expansions: db.expansions, companies: db.companies, competitors: db.competitors,
      leads: leads(db).map((l) => ({id: l.person.id, name: l.person.name, title: l.person.title, company: l.company?.name, email: l.person.email, score: l.score, tier: l.tier, reasons: l.reasons, paths: l.paths, stage: l.person.stage})),
      drafts: db.drafts.map((d) => ({id: d.id, personId: d.personId, kind: d.kind, status: d.status, rejectReason: d.rejectReason, review: d.review})),
      founder: {name: db.founder.name, schools: db.founder.schools, pastCompanies: db.founder.pastCompanies, connections: db.founder.network.length}})));

  mcp.registerTool('think', {description: 'Add a line to the founder\'s live Agent Thinking feed. Use for meaningful steps, not every call.',
    inputSchema: z.object({agent: z.string().default('planner').describe('your role, e.g. planner, scout, writer, reviewer'), step: z.string(), detail: z.string().optional()}),
  }, async ({agent, step, detail}) => { think(agent, step, detail); return ok('Shown.'); });

  mcp.registerTool('say', {
    description: 'Say something to the founder in the chat. Write like a person: short, plain words, no ids, no env vars or tool names. When the founder has something to do, add actions (buttons to the right page) instead of describing where to click; put each next step on its own line starting with "1.", "2."…',
    inputSchema: z.object({text: z.string(), actions: z.array(z.object({label: z.string().describe('verb first, e.g. "Review 4 drafts"'), to: z.enum(['brief', 'profile', 'leads', 'network', 'outreach', 'pipeline', 'insights'])})).max(3).optional()}),
  }, async ({text, actions}) => { db.chat.push({at: Date.now(), from: 'agent', text, actions}); send({type: 'speak', text}); return ok('Said.'); });

  mcp.registerTool('ask_founder', {description: 'Ask the founder a question with 2–4 options (they can also type their own). Then call wait_for_task for the answer.',
    inputSchema: z.object({question: z.string(), options: z.array(z.string()).min(2).max(4), agent: z.string().default('planner')}),
  }, async ({question, options, agent}) => { db.questions.push({qid: uid('q'), question, options, agent, at: Date.now()}); status('listening'); return ok('Asked. Call wait_for_task for the answer.'); });

  mcp.registerTool('save_icp', {
    description: 'Save (or replace) the ideal customer profile, with an honest confidence 0–1 per field, plus 2–4 expansion suggestions the founder can accept, adjust or dismiss.',
    inputSchema: z.object({
      product: z.string(), summary: z.string().describe('one sentence'),
      industries: conf(z.array(z.object({name: z.string(), naics: z.string().optional()}))),
      companySize: conf(z.object({min: z.number(), max: z.number()})).describe('employees'),
      personas: conf(z.array(z.object({title: z.string(), seniority: z.string().optional(), department: z.string().optional()}))),
      triggers: conf(z.array(z.string())).describe('trigger events that signal buying intent'),
      geos: conf(z.array(z.string())), negatives: conf(z.array(z.string())).describe('who is NOT a fit'),
      expansions: z.array(z.object({field: z.string(), suggestion: z.string(), why: z.string()})).max(4).default([]),
      agent: z.string().default('planner'),
    }),
  }, async ({expansions, agent, ...icp}) => {
    db.icp = {...icp, updatedAt: Date.now()};
    db.expansions = [...db.expansions.filter((e) => e.status !== 'open'), ...expansions.map((e) => ({...e, id: uid('x'), status: 'open' as const}))];
    audit('ai', 'saved ICP', icp.product, icp.summary, agent);
    return ok('ICP saved and shown to the founder.');
  });

  mcp.registerTool('add_competitors', {
    description: 'Add competitors with positioning, pricing and differentiators (how the founder\'s product differs), each with sources.',
    inputSchema: z.object({competitors: z.array(z.object({name: z.string(), domain: z.string().optional(), positioning: z.string(), pricing: z.string(), differentiators: z.array(z.string()), sources: src})), agent: z.string().default('scout')}),
  }, async ({competitors, agent}) => {
    for (const c of competitors) { const i = db.competitors.findIndex((x) => sameOrg(x.name, c.name)); const row = {...c, id: i >= 0 ? db.competitors[i].id : uid('k')}; if (i >= 0) db.competitors[i] = row; else db.competitors.push(row); }
    audit('ai', `added ${competitors.length} competitors`, undefined, competitors.map((c) => c.name).join(', '), agent);
    return ok(`Saved ${competitors.length} competitors.`);
  });

  mcp.registerTool('add_companies', {
    description: 'Add target companies found on the public web. Set negative (with a source) to exclude a bad fit, e.g. recent layoffs, already a competitor customer, wrong segment.',
    inputSchema: z.object({companies: z.array(z.object({
      name: z.string(), domain: z.string().optional(), industry: z.string().optional(), naics: z.string().optional(), employees: z.number().optional().describe('approximate headcount; look it up (LinkedIn company page, Crunchbase, About page) and include that page in sources'), hq: z.string().optional(),
      why: z.string().describe('why it fits the ICP, one sentence'), sources: src,
      negative: z.object({reason: z.string(), sources: src}).optional(),
    })), agent: z.string().default('scout')}),
  }, async ({companies, agent}) => {
    const out: string[] = [];
    for (const c of companies) {
      const ex = findCompany(c.domain ?? c.name) ?? findCompany(c.name);
      if (ex) Object.assign(ex, c); else db.companies.push({...c, id: uid('c')});
      out.push(`${c.name} → ${(ex ?? db.companies[db.companies.length - 1]).id}${c.negative ? ' (excluded)' : ''}`);
    }
    audit('ai', `added ${companies.length} companies`, undefined, companies.map((c) => c.name).join(', '), agent);
    return ok(`Saved:\n${out.join('\n')}`);
  });

  mcp.registerTool('add_people', {
    description: 'Add role-matched buyers at saved companies (company = id, name or domain). Include public past companies and schools: they power warm paths.',
    inputSchema: z.object({people: z.array(z.object({
      name: z.string(), title: z.string(), seniority: z.string().optional(), company: z.string(), linkedin: z.string().optional(),
      pastCompanies: z.array(z.string()).default([]), schools: z.array(z.string()).default([]),
      communities: z.array(z.string()).optional().describe('public shared contexts beyond LinkedIn: communities, accelerators, events they spoke at, podcasts, open-source projects (each must be on one of the sources)'),
      sources: src,
    })), agent: z.string().default('scout')}),
  }, async ({people, agent}) => {
    const out: string[] = [], missing: string[] = [];
    for (const {company, ...p} of people) {
      const c = findCompany(company);
      if (!c) { missing.push(`${p.name} (${company})`); continue; }
      const ex = db.people.find((x) => norm(x.name) === norm(p.name) && x.companyId === c.id);
      if (ex) { Object.assign(ex, p); out.push(`${p.name} → ${ex.id}`); continue; }
      const row: Person = {...p, id: uid('p'), companyId: c.id, stage: 'matched', stageBy: 'ai', stageAt: Date.now()};
      db.people.push(row); out.push(`${p.name} → ${row.id}`);
    }
    audit('ai', `added ${out.length} people`, undefined, people.map((p) => p.name).join(', '), agent);
    return missing.length && !out.length ? err(`Add these companies first: ${missing.join(', ')}`) : ok(`Saved:\n${out.join('\n')}${missing.length ? `\nSkipped (add the company first): ${missing.join(', ')}` : ''}`);
  });

  mcp.registerTool('add_signals', {
    description: 'Add buying signals for saved companies: hiring (job postings), funding, launches, leadership changes, tech used, news. Each needs its URL.',
    inputSchema: z.object({signals: z.array(z.object({company: z.string(), kind: z.enum(['hiring', 'funding', 'launch', 'leadership', 'tech', 'news']), text: z.string(), url: z.string().url(), date: z.string().optional()})), agent: z.string().default('scout')}),
  }, async ({signals, agent}) => {
    let n = 0;
    for (const {company, ...s} of signals) { const c = findCompany(company); if (!c) continue; if (!db.signals.some((x) => x.url === s.url && x.companyId === c.id)) { db.signals.push({...s, id: uid('s'), companyId: c.id}); n++; } }
    audit('ai', `added ${n} signals`, undefined, undefined, agent);
    return ok(`Saved ${n} signals.`);
  });

  mcp.registerTool('enrich', {
    description: 'Find verified work emails (Hunter.io) for saved people. Costs 1 credit per person not already cached; refused when credits run out.',
    inputSchema: z.object({person_ids: z.array(z.string()).min(1).max(15), agent: z.string().default('scout')}),
  }, async ({person_ids, agent}) => {
    const lines: string[] = [];
    for (const id of person_ids) {
      const p = db.people.find((x) => x.id === id), c = db.companies.find((x) => x.id === p?.companyId);
      if (!p || !c) { lines.push(`${id}: not found`); continue; }
      const r = await enrichPerson(db, p, c);
      lines.push(`${p.name}: ${r}`);
    }
    think(agent, `Enriched ${person_ids.length} leads`, lines.join(' · '));
    return ok(lines.join('\n'));
  });

  mcp.registerTool('find_warm_paths', {
    description: 'Check the founder\'s own network (LinkedIn connections, schools, past employers) for warm paths to each lead. Returns the paths and the scored leads.',
    inputSchema: z.object({person_id: z.string().optional()}),
  }, async ({person_id}) => {
    meter(db, 'graph_queries');
    if (!db.founder.network.length && !db.founder.schools.length && !db.founder.pastCompanies.length) return ok('The founder has not added their network yet. Ask them to upload their LinkedIn Connections.csv in the Network tab (or skip warm paths for now).');
    const L = leads(db).filter((l) => !person_id || l.person.id === person_id);
    return ok(L.map((l) => `${l.person.name} (${l.person.title}, ${l.company?.name}) score ${l.score} tier ${l.tier}\n  ${l.paths.length ? l.paths.map((p) => `${p.kind}: ${p.text}${p.viaContactId ? ` [via ${p.viaContactId}]` : ''}`).join('\n  ') : 'no warm path → cold'}`).join('\n'));
  });

  mcp.registerTool('list_contacts', {
    description: "The founder's LinkedIn connections. LinkedIn exports from Dec 2026 have no company or title, so use missing_company=true to get the ones to look up.",
    inputSchema: z.object({missing_company: z.boolean().optional(), limit: z.number().optional()}),
  }, async ({missing_company, limit}) => {
    const cs = db.founder.network.filter((c) => !missing_company || !c.company).slice(0, limit ?? 50);
    return ok(`${cs.length} of ${db.founder.network.length} connections${missing_company ? ' without a company' : ''}:\n` + cs.map((c) => `${c.id} · ${c.name}${c.company ? ` · ${c.position} at ${c.company}` : ''}${c.url ? ` · ${c.url}` : ''}`).join('\n'));
  });

  mcp.registerTool('update_contacts', {
    description: "Fill in where the founder's connections work now, from a public page you actually read (their public profile, a team page, a talk bio). Never guess; skip anyone you can't source.",
    inputSchema: z.object({contacts: z.array(z.object({id: z.string(), company: z.string(), position: z.string().optional(), source_url: z.string()}))}),
  }, async ({contacts}) => {
    let n = 0; const moves: string[] = [];
    for (const u of contacts) {
      const c = db.founder.network.find((x) => x.id === u.id);
      if (!c || !/^https?:\/\//.test(u.source_url)) continue;
      const from = c.company;
      c.company = u.company; if (u.position) c.position = u.position; c.companySource = u.source_url; n++;
      if (from && !sameOrg(from, u.company)) moves.push(recordMove(c, from, u.source_url));
    }
    audit('ai', 'looked up connections', undefined, `${n} updated${moves.length ? `, ${moves.length} changed jobs` : ''}`);
    return ok(`Updated ${n} connections.${moves.length ? ` Job changes: ${moves.join('; ')}.` : ''} Run find_warm_paths to see new paths.`);
  });

  mcp.registerTool('suggest_connectors', {
    description: "Suggest 3–5 people the founder should get to know this week: not buyers, but people next to several buyers on the list (a design-community host, a recruiter or ex-employee who knows the brand teams, a podcast host who interviewed them). Each needs a source showing why they're close to those buyers.",
    inputSchema: z.object({connectors: z.array(z.object({name: z.string(), title: z.string(), company: z.string(), why: z.string().describe('one sentence: why they are close to these buyers'), unlocks: z.array(z.string()).describe('company or buyer names they could open'), sources: src})), agent: z.string().default('scout')}),
  }, async ({connectors, agent}) => {
    for (const c of connectors) {
      const ex = db.connectors.find((x) => norm(x.name) === norm(c.name));
      if (ex) Object.assign(ex, c); else db.connectors.push({id: uid('k'), ...c, status: 'open', at: Date.now()});
    }
    think(agent, `Suggested ${connectors.length} people to meet`, connectors.map((c) => c.name).join(', '));
    audit('ai', 'suggested people to meet', undefined, connectors.map((c) => c.name).join(', '), agent);
    return ok(`Saved ${connectors.length}. They show on the Network page under "People to meet".`);
  });

  mcp.registerTool('graph_query', {
    description: 'Run a named multi-hop query over the knowledge graph: warm_paths (Founder→knows→Person→works_at→Company←matched_to), hiring_signals (Signal[hiring]→Company→Person matching a persona), competitor_displacement (Company uses a Competitor → its buyers), super_connectors (Contact→opens paths to→many Persons: who in the network matters most), job_changes (Contact moved→into a target Company).',
    inputSchema: z.object({name: z.enum(['warm_paths', 'hiring_signals', 'competitor_displacement', 'super_connectors', 'job_changes'])}),
  }, async ({name}) => {
    meter(db, 'graph_queries');
    const L = leads(db);
    if (name === 'warm_paths') return ok(L.filter((l) => l.paths.length).map((l) => `${l.paths[0].hops.join(' → ')} @ ${l.company?.name} (${l.paths[0].kind})`).join('\n') || 'No warm paths yet.');
    if (name === 'super_connectors') return ok(superConnectors(db).map((x) => `${x.contact.name} (${x.contact.company}) opens ${x.leads.length}: ${x.leads.join(', ')}`).join('\n') || 'No connection opens a path yet.');
    if (name === 'job_changes') return ok(db.moves.map((m) => `${m.name}: ${m.from} → ${m.to}${m.intoTarget ? ' (target company)' : ''} [${m.source}]`).join('\n') || 'No job changes recorded yet.');
    if (name === 'hiring_signals') return ok(L.filter((l) => l.signals.some((s) => s.kind === 'hiring')).map((l) => `${l.company?.name}: ${l.signals.filter((s) => s.kind === 'hiring').map((s) => s.text).join('; ')} → ${l.person.name}, ${l.person.title}`).join('\n') || 'No hiring signals yet.');
    const hits = L.filter((l) => l.signals.some((s) => db.competitors.some((k) => s.text.toLowerCase().includes(k.name.toLowerCase()))));
    return ok(hits.map((l) => `${l.company?.name} uses ${db.competitors.filter((k) => l.signals.some((s) => s.text.toLowerCase().includes(k.name.toLowerCase()))).map((k) => k.name).join(', ')} → ${l.person.name}`).join('\n') || 'No competitor users found yet (add tech signals that name a competitor).');
  });

  mcp.registerTool('draft_outreach', {
    description: 'Draft a multi-touch sequence for one lead. kind=intro_request goes to the mutual connection (viaContactId from find_warm_paths) asking for an intro; kind=cold goes to the lead. Every factual sentence must be in claims with its source URL. The founder approves, edits or rejects it.',
    inputSchema: z.object({
      person_id: z.string(), kind: z.enum(['intro_request', 'cold', 'referral_ask']).describe('referral_ask = to a customer you closed, asking for 1–2 intros to named people like them'), variant: z.enum(['A', 'B']).default('A'), via_contact_id: z.string().optional(),
      angle: z.string().describe('the personalised hook in a few words, e.g. "hiring 2 motion designers"'),
      touches: z.array(z.object({channel: z.enum(['email', 'linkedin']), day: z.number().int().min(0), subject: z.string().optional(), body: z.string()})).min(1).max(4),
      claims: z.array(z.object({text: z.string().describe('the exact sentence or phrase as it appears in a touch'), url: z.string().url()})),
      agent: z.string().default('writer'),
    }),
  }, async ({person_id, kind, variant, via_contact_id, angle, touches, claims, agent}) => {
    const p = db.people.find((x) => x.id === person_id);
    if (!p) return err('No such person.');
    if (kind === 'intro_request' && !db.founder.network.some((c) => c.id === via_contact_id)) return err('intro_request needs via_contact_id from find_warm_paths.');
    const via = db.founder.network.find((c) => c.id === via_contact_id);
    const d = {id: uid('d'), personId: person_id, kind, variant, viaContactId: via_contact_id, angle, claims, createdAt: Date.now(), status: 'pending' as const,
      touches: touches.map((t) => ({...t, to: kind === 'intro_request' ? via?.email ?? via?.name : p.email ?? p.name}))};
    db.drafts = db.drafts.filter((x) => !(x.personId === person_id && x.status === 'pending' && x.variant === variant));
    db.drafts.push(d);
    audit('ai', `drafted ${kind === 'intro_request' ? 'intro request' : 'cold sequence'} (${variant})`, p.name, angle, agent);
    return ok(`Draft ${d.id} is waiting for review and the founder's approval.`);
  });

  mcp.registerTool('review_draft', {
    description: 'As the Reviewer: check a draft. List every factual statement that has no source in claims (or whose source doesn\'t say it). verdict=fix if anything is unsupported, salesy, or risky; the writer should then redraft.',
    inputSchema: z.object({draft_id: z.string(), verdict: z.enum(['pass', 'fix']), unsupported: z.array(z.string()).default([]), note: z.string().optional(), agent: z.string().default('reviewer')}),
  }, async ({draft_id, verdict, unsupported, note, agent}) => {
    const d = db.drafts.find((x) => x.id === draft_id);
    if (!d) return err('No such draft.');
    d.review = {verdict, unsupported, note, proofScore: proofScore(d.claims, unsupported), by: agent};
    audit('ai', `reviewed draft: ${verdict}`, db.people.find((p) => p.id === d.personId)?.name, note, agent);
    return ok(`Proof score ${d.review.proofScore}.`);
  });

  mcp.registerTool('suggest_icp_change', {
    description: 'Propose an ICP change based on the founder\'s behaviour (e.g. repeated rejections). The founder accepts or dismisses; you then save_icp if accepted.',
    inputSchema: z.object({change: z.string(), evidence: z.string()}),
  }, async ({change, evidence}) => { db.icpChanges.push({id: uid('ic'), change, evidence, status: 'open', at: Date.now()}); status('listening'); return ok('Shown to the founder. Call wait_for_task for their answer.'); });

  return mcp;
}

/* ---------- HTTP + WebSocket ---------- */
const app = createMcpExpressApp({host: '127.0.0.1', allowedHosts: ['127.0.0.1', 'localhost']});
app.post('/mcp', async (req, res) => {
  const server = makeServer();
  const transport = new NodeStreamableHTTPServerTransport({sessionIdGenerator: undefined});
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.get('/mcp', (_req, res) => { res.status(405).set('Allow', 'POST').end(); });

app.post('/api/network', express.json({limit: '20mb'}), (req, res) => {
  const {csv, name, schools, pastCompanies, communities, fileName} = req.body as {csv?: string; name?: string; schools?: string[]; pastCompanies?: string[]; communities?: string[]; fileName?: string};
  if (communities) db.founder.communities = communities.filter(Boolean);
  if (name != null) db.founder.name = name;
  if (schools) db.founder.schools = schools.filter(Boolean);
  if (pastCompanies) db.founder.pastCompanies = pastCompanies.filter(Boolean);
  let added = 0;
  if (csv) {
    const rows = parseConnections(csv);
    if (!rows.length) { res.status(400).json({error: 'That doesn\'t look like a LinkedIn Connections.csv (no "First Name … Company" header).'}); return; }
    db.founder.network = rows.map((r) => ({...r, id: uid('n')}));
    db.founder.networkFile = fileName; added = rows.length;
    audit('founder', `imported ${rows.length} LinkedIn connections`, fileName);
  } else audit('founder', 'updated background', undefined, [...db.founder.schools, ...db.founder.pastCompanies].join(', '));
  changed();
  res.json({ok: true, connections: db.founder.network.length, added});
});
app.post('/api/demo/save', (_req, res) => { writeFileSync(DEMO_FILE, JSON.stringify(db)); res.json({ok: true}); });
app.post('/api/demo/load', (_req, res) => {
  if (!existsSync(DEMO_FILE)) { res.status(404).json({error: 'No demo snapshot yet.'}); return; }
  db = {...emptyDB(), ...JSON.parse(readFileSync(DEMO_FILE, 'utf8'))}; changed(); res.json({ok: true});
});
app.post('/api/reset', (_req, res) => { const keep = db.founder; db = emptyDB(Number(process.env.CREDITS ?? 50)); db.founder = keep; changed(); res.json({ok: true}); });
app.get('/api/health', (_req, res) => { res.json({ok: true, clients: clients.size, agentSeenSecondsAgo: lastAgentAt ? Math.round((Date.now() - lastAgentAt) / 1000) : null, hunter: !!process.env.HUNTER_API_KEY, flexprice: flexpriceStatus}); });

/** Every deal grows the network: someone you met or closed becomes a node that can open paths to their colleagues and ex-colleagues. */
function growNetwork(p: Person, st: Stage) {
  if (st !== 'meeting' && st !== 'closed') return;
  const c = db.companies.find((x) => x.id === p.companyId);
  let k = db.founder.network.find((x) => x.personId === p.id);
  if (!k) { k = {id: uid('ct'), name: p.name, company: c?.name ?? '', position: p.title, url: p.linkedin, origin: st === 'closed' ? 'customer' : 'met', personId: p.id, companySource: 'pipeline'}; db.founder.network.push(k); }
  else if (st === 'closed') k.origin = 'customer';
  think('planner', `${p.name} joined your network`, st === 'closed' ? 'A customer now opens paths to their colleagues and ex-colleagues.' : 'Someone you met now counts as a connection.');
  audit('ai', 'added to your network', p.name, st === 'closed' ? 'customer' : 'met');
  if (st === 'closed') pushTask(`Deal closed with ${p.name} (${p.title}, ${c?.name}). Ask them for intros: draft_outreach kind=referral_ask to person_id ${p.id}, asking for 1–2 intros to specific people like them (look for buyers at their past companies ${p.pastCompanies.join(', ') || '(none known)'} and at ICP companies they'd plausibly know; name them). Keep it short and easy to say yes to. Then review it and tell the founder with an action to Outreach.`, 'referral');
}
function recordMove(c: Contact, from: string, source: string): string {
  const target = db.companies.find((x) => sameOrg(x.name, c.company) && !x.negative);
  db.moves.push({at: Date.now(), contactId: c.id, name: c.name, from, to: c.company, position: c.position, source, intoTarget: target?.id});
  if (target) {
    db.signals.push({id: uid('s'), companyId: target.id, kind: 'job_change', text: `Your connection ${c.name} just joined ${target.name}${c.position ? ` as ${c.position}` : ''}`, url: source, date: new Date().toISOString().slice(0, 10)});
    think('scout', `${c.name} moved to ${target.name}`, 'A company on your list now has someone you know inside.');
  }
  return `${c.name}: ${from} → ${c.company}${target ? ' (a company on your list)' : ''}`;
}

type Msg = {type: string; [k: string]: unknown};
function onMessage(m: Msg) {
  const s = (k: string) => String(m[k] ?? '');
  if (m.type === 'task') {
    db.chat.push({at: Date.now(), from: 'founder', text: s('text')});
    audit('founder', 'asked', undefined, s('text'));
    pushTask(s('text'), s('kind') || 'chat');
  } else if (m.type === 'answer') {
    const q = db.questions.find((x) => x.qid === s('qid'));
    if (q) { q.answered = s('text'); pushTask(`Answer to "${q.question}": ${s('text')}`, 'answer'); }
  } else if (m.type === 'expansion') {
    const e = db.expansions.find((x) => x.id === s('id'));
    if (!e) return;
    e.status = s('action') as typeof e.status; e.note = s('note') || undefined;
    audit('founder', `${e.status} ICP expansion`, e.field, e.suggestion);
    if (e.status !== 'dismissed') pushTask(`The founder ${e.status} your ICP expansion "${e.suggestion}"${e.note ? ` with this adjustment: ${e.note}` : ''}. Update the ICP with save_icp (keep the open expansions) and find matching companies.`, 'expansion');
  } else if (m.type === 'icp_change') {
    const c = db.icpChanges.find((x) => x.id === s('id'));
    if (!c) return;
    c.status = s('action') as typeof c.status;
    audit('founder', `${c.status} ICP change`, undefined, c.change);
    pushTask(c.status === 'accepted' ? `The founder accepted: "${c.change}". Update the ICP with save_icp and adjust the lead list.` : `The founder dismissed "${c.change}". Keep the ICP as it is.`, 'icp_change');
  } else if (m.type === 'draft') {
    const d = db.drafts.find((x) => x.id === s('id'));
    if (!d) return;
    const p = db.people.find((x) => x.id === d.personId);
    if (m.action === 'edit' && Array.isArray(m.touches)) { d.touches = m.touches as typeof d.touches; d.editedByFounder = true; audit('founder', 'edited draft', p?.name); }
    else if (m.action === 'approve') {
      d.status = 'approved'; d.decidedAt = Date.now();
      if (p && p.stage === 'matched') { p.stage = 'contacted'; p.stageBy = 'ai'; p.stageAt = Date.now(); }
      meter(db, 'outreach_sent');
      audit('founder', `approved ${d.editedByFounder ? 'edited ' : ''}outreach → queued`, p?.name, d.angle);
    } else if (m.action === 'reject') {
      d.status = 'rejected'; d.decidedAt = Date.now(); d.rejectReason = s('reason') || undefined;
      audit('founder', 'rejected outreach', p?.name, d.rejectReason);
      if (d.rejectReason) pushTask(`The founder rejected the draft for ${p?.name}: "${d.rejectReason}". Note it for future drafts${/redo|rewrite|again|try/i.test(d.rejectReason) ? ' and write a new version' : ''}.`, 'rejection');
      checkRejectionPattern();
    }
  } else if (m.type === 'stage') {
    const p = db.people.find((x) => x.id === s('personId'));
    const st = s('stage') as Stage;
    if (p && STAGES.includes(st)) { const from = p.stage; p.stage = st; p.stageBy = 'founder'; p.stageAt = Date.now(); audit('founder', `moved ${from} → ${st}`, p.name); growNetwork(p, st); }
  } else if (m.type === 'connector') {
    const k = db.connectors.find((x) => x.id === s('id'));
    if (!k) return;
    k.status = s('action') as typeof k.status;
    audit('founder', k.status === 'done' ? 'met' : 'dismissed', k.name);
    if (k.status === 'done') db.founder.network.push({id: uid('ct'), name: k.name, company: k.company, position: k.title, origin: 'typed', companySource: 'founder'});
  } else if (m.type === 'contact') {
    const c = db.founder.network.find((x) => x.id === s('id'));
    if (!c) return;
    c.company = s('company').trim(); if (m.position != null) c.position = s('position').trim(); c.companySource = 'founder';
    audit('founder', 'filled in a connection', c.name, `${c.position ? c.position + ' at ' : ''}${c.company}`);
  } else if (m.type === 'enrich') {
    const p = db.people.find((x) => x.id === s('personId')), c = db.companies.find((x) => x.id === p?.companyId) as Company | undefined;
    if (p && !c) { p.enrichNote = 'no company on file'; changed(); }
    if (p && c) { p.enrichNote = 'looking…'; void enrichPerson(db, p, c).then((msg) => { p.enrichNote = p.email ? undefined : msg; audit('founder', 'looked up email', p.name, msg); changed(); }); }
    return;
  }
  changed();
}

const http = createServer(app);
const wss = new WebSocketServer({server: http, path: '/ws'});
wss.on('connection', (w) => {
  clients.add(w);
  w.send(JSON.stringify({type: 'db', db}));
  w.send(JSON.stringify({type: 'agent_status', status: Date.now() - lastAgentAt < 120_000 ? (waiter ? 'listening' : 'working') : 'offline'}));
  w.on('message', (raw) => { try { onMessage(JSON.parse(String(raw))); } catch (e) { console.warn('[ws] bad message', e); } });
  w.on('close', () => clients.delete(w));
});
setInterval(() => { if (lastAgentAt && Date.now() - lastAgentAt > 150_000 && !waiter) status('offline'); }, 15_000);
void initFlexprice(db.founder.name);
http.listen(PORT, '127.0.0.1', () => console.log(`[thread] bridge on http://127.0.0.1:${PORT}  (MCP: /mcp, app: /ws)  hunter:${!!process.env.HUNTER_API_KEY} flexprice:${!!process.env.FLEXPRICE_API_KEY}`));
