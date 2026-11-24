// Pure, explainable logic shared by the bridge and the UI: name matching, warm paths, fit & intent score, CSV import.
import type {Company, Contact, DB, Founder, ICP, Person, Signal, WarmPath} from './types';

/* ---------- matching ---------- */
const SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc|technologies|technology|labs|hq|the)\b/g;
export const norm = (s = '') => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
/** Same organisation? Exact after normalising, or one name contains the other as whole words (e.g. "Northeastern" ~ "Northeastern University"). */
export function sameOrg(a = '', b = '') {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length < y.length ? [x, y] : [y, x];
  return s.length >= 4 && (` ${l} `).includes(` ${s} `);
}
const words = (s = '') => norm(s).split(' ').filter((w) => w.length > 2);

/* ---------- warm paths ---------- */
export function warmPaths(person: Person, company: Company | undefined, founder: Founder): WarmPath[] {
  const out: WarmPath[] = [];
  const me = founder.name || 'You';
  if (company) for (const c of founder.network) if (sameOrg(c.company, company.name) && c.name !== person.name)
    out.push({kind: 'colleague', strength: 1, viaContactId: c.id, hops: [me, c.name, person.name],
      text: `${c.name} (your connection, ${c.position || 'works'} at ${c.company}) works with ${person.name}.`});
  for (const past of person.pastCompanies) for (const c of founder.network) if (sameOrg(c.company, past))
    out.push({kind: 'former_colleague', strength: 0.6, viaContactId: c.id, hops: [me, c.name, person.name],
      text: `${c.name} (your connection) is at ${c.company}, where ${person.name} used to work.`});
  for (const past of founder.pastCompanies) if (person.pastCompanies.some((p) => sameOrg(p, past)) || (company && sameOrg(company.name, past)))
    out.push({kind: 'shared_employer', strength: 0.4, hops: [me, past, person.name], text: `You and ${person.name} both worked at ${past}.`});
  for (const s of founder.schools) if (person.schools.some((p) => sameOrg(p, s)))
    out.push({kind: 'shared_school', strength: 0.35, hops: [me, s, person.name], text: `You and ${person.name} both went to ${s}.`});
  const seen = new Set<string>();
  return out.sort((a, b) => b.strength - a.strength).filter((p) => { const k = p.kind + (p.viaContactId ?? p.hops[1]); if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ---------- fit & intent score ---------- */
export type Score = {score: number; tier: 'A' | 'B' | 'C'; fit: number; intent: number; warm: number; reasons: string[]; excluded?: string};
export function scoreLead(p: Person, c: Company | undefined, icp: ICP | null, signals: Signal[], paths: WarmPath[]): Score {
  const reasons: string[] = [];
  let fit = 0, intent = 0;
  if (icp && c) {
    const ind = icp.industries.value.find((i) => c.industry && (sameOrg(i.name, c.industry) || words(i.name).some((w) => words(c.industry).includes(w))));
    if (ind) { fit += 20; reasons.push(`Industry matches (${ind.name})`); }
    const {min, max} = icp.companySize.value;
    if (c.employees != null) { if (c.employees >= min && c.employees <= max) { fit += 15; reasons.push(`Size ${c.employees} in ${min}–${max}`); } else if (c.employees >= min / 2 && c.employees <= max * 2) { fit += 6; reasons.push(`Size ${c.employees} near range`); } }
  }
  if (icp) {
    const tw = words(p.title);
    const persona = icp.personas.value.find((x) => words(x.title).filter((w) => tw.includes(w)).length >= Math.min(2, words(x.title).length));
    if (persona) { fit += 15; reasons.push(`Title fits persona "${persona.title}"`); }
    else if (icp.personas.value.some((x) => words(x.title).some((w) => tw.includes(w)))) { fit += 7; reasons.push('Title partly fits a persona'); }
    const sen = (p.seniority ?? p.title).toLowerCase();
    if (/(head|director|vp|chief|founder|lead|manager)/.test(sen)) { fit += 10; reasons.push('Decision-maker seniority'); }
  }
  // Unknown headcount shouldn't punish a lead: rescale fit to the 45 points we could actually judge.
  if (icp && c && c.employees == null) { fit = Math.round((fit * 60) / 45); reasons.push('Size unknown: fit judged on industry, title and seniority'); }
  for (const s of signals.slice(0, 3)) { intent += s.kind === 'hiring' || s.kind === 'funding' ? 10 : 6; reasons.push(`Signal: ${s.text}`); }
  intent = Math.min(25, intent);
  const warm = Math.round((paths[0]?.strength ?? 0) * 15);
  if (paths[0]) reasons.push(`Warm path: ${paths[0].text}`);
  let score = Math.min(100, fit + intent + warm);
  let excluded: string | undefined;
  if (c?.negative) { excluded = c.negative.reason; score = Math.min(score, 20); reasons.unshift(`Negative signal: ${c.negative.reason}`); }
  return {score, tier: score >= 75 ? 'A' : score >= 50 ? 'B' : 'C', fit, intent, warm, reasons, excluded};
}

export type LeadView = {person: Person; company?: Company; signals: Signal[]; paths: WarmPath[]} & Score;
export function leads(db: DB): LeadView[] {
  return db.people.map((person) => {
    const company = db.companies.find((c) => c.id === person.companyId);
    const signals = db.signals.filter((s) => s.companyId === person.companyId);
    const paths = warmPaths(person, company, db.founder);
    return {person, company, signals, paths, ...scoreLead(person, company, db.icp, signals, paths)};
  }).sort((a, b) => b.score - a.score);
}

/** Proof score: share of a draft's sentences that make a factual claim backed by a cited source. */
export function proofScore(claims: {text: string; url: string}[], unsupported: string[]) {
  const total = claims.length + unsupported.length;
  return total ? Math.round((claims.filter((c) => /^https?:\/\//.test(c.url)).length / total) * 100) : 100;
}

/* ---------- LinkedIn Connections.csv ---------- */
function parseCsvLine(line: string) {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
/** LinkedIn's export starts with a few "Notes:" lines before the header row; skip to the header. */
export function parseConnections(csv: string): Omit<Contact, 'id'>[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  const h = lines.findIndex((l) => /first name/i.test(l) && /last name|url|company/i.test(l));
  if (h < 0) return [];
  const head = parseCsvLine(lines[h]).map((x) => x.toLowerCase());
  const col = (n: string) => head.findIndex((x) => x === n);
  const [fn, ln, url, em, co, pos, on] = ['first name', 'last name', 'url', 'email address', 'company', 'position', 'connected on'].map(col);
  return lines.slice(h + 1).filter((l) => l.trim()).map(parseCsvLine).map((r) => ({
    name: `${r[fn] ?? ''} ${r[ln] ?? ''}`.trim(), company: r[co] ?? '', position: r[pos] ?? '',
    url: r[url] || undefined, email: r[em] || undefined, connectedOn: r[on] || undefined,
  })).filter((c) => c.name); // LinkedIn exports from Dec 2026 drop company/position; the agent can fill them in later
}
