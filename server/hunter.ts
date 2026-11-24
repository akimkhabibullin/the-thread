// Enrichment through Hunter.io's Email Finder. Results are cached (the free tier is small) and each new lookup costs a credit.
import type {Company, DB, Person} from '../shared/types';
import {meter} from './meter';

const domainOf = (c: Company) => (c.domain ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

export async function enrichPerson(db: DB, p: Person, c: Company): Promise<string> {
  const domain = domainOf(c);
  if (!domain) return 'no company domain, skipped';
  const key = `${p.name.toLowerCase()}@${domain}`;
  const cached = db.enrichCache[key];
  if (cached) { Object.assign(p, {email: cached.email, emailScore: cached.score, emailStatus: cached.status, enrichedAt: cached.at}); return cached.email ? `${cached.email} (cached, ${cached.status ?? 'unverified'})` : 'no email found (cached)'; }
  if (db.usage.credits <= 0) return 'out of credits: top up to enrich more leads';
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return 'not enriched: HUNTER_API_KEY is not set';
  const [first, ...rest] = p.name.split(' ');
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(rest.join(' '))}&api_key=${apiKey}`;
  try {
    const r = await fetch(url);
    const j = await r.json() as {data?: {email?: string; score?: number; verification?: {status?: string}}; errors?: {details?: string}[]};
    if (!r.ok) return `Hunter error: ${j.errors?.[0]?.details ?? r.status}`;
    const e = {email: j.data?.email ?? undefined, score: j.data?.score ?? undefined, status: j.data?.verification?.status ?? undefined, at: Date.now()};
    db.enrichCache[key] = e;
    Object.assign(p, {email: e.email, emailScore: e.score, emailStatus: e.status, enrichedAt: e.at});
    meter(db, 'leads_enriched');
    return e.email ? `${e.email} (confidence ${e.score ?? '?'}, ${e.status ?? 'unverified'})` : 'no email found';
  } catch (err) { return `Hunter request failed: ${String(err)}`; }
}
