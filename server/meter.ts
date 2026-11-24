// Usage metering. Counted locally (shown in the app) and, when FLEXPRICE_API_KEY is set, sent to Flexprice as usage events.
// TODO(tomorrow): confirm the Flexprice events endpoint and payload against their docs, create the 3 meters there.
import type {DB, Usage} from '../shared/types';

type Meter = Exclude<keyof Usage, 'credits'>;
const COST: Record<Meter, number> = {leads_enriched: 1, outreach_sent: 0, graph_queries: 0};

export function meter(db: DB, name: Meter, n = 1) {
  db.usage[name] += n;
  db.usage.credits = Math.max(0, db.usage.credits - COST[name] * n);
  const key = process.env.FLEXPRICE_API_KEY;
  if (!key) return;
  const base = process.env.FLEXPRICE_API_URL ?? 'https://api.cloud.flexprice.io/v1';
  void fetch(`${base}/events`, {
    method: 'POST', headers: {'Content-Type': 'application/json', 'x-api-key': key},
    body: JSON.stringify({event_name: name, external_customer_id: process.env.FLEXPRICE_CUSTOMER_ID ?? 'demo-founder', properties: {count: n}, source: 'warmpath', timestamp: new Date().toISOString()}),
  }).then(async (r) => { if (!r.ok) console.warn('[flexprice]', r.status, (await r.text()).slice(0, 200)); }).catch((e) => console.warn('[flexprice]', String(e)));
}
