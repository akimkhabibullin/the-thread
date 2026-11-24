// Usage metering. Counted locally (shown in the app) and, when FLEXPRICE_API_KEY is set, sent to Flexprice as usage events.
// Flexprice (docs.flexprice.io): POST {base}/events with x-api-key; properties must be string values; events are processed
// async (202). The customer must exist first, so we create it once on startup (409 = already there).
// In the Flexprice dashboard create 3 metered features with these event names (aggregation: Sum of `count`):
//   thread.lead_enriched · thread.outreach_queued · thread.graph_query
import type {DB, Usage} from '../shared/types';

type Meter = Exclude<keyof Usage, 'credits'>;
const COST: Record<Meter, number> = {leads_enriched: 1, outreach_sent: 0, graph_queries: 0};
export const EVENT: Record<Meter, string> = {leads_enriched: 'thread.lead_enriched', outreach_sent: 'thread.outreach_queued', graph_queries: 'thread.graph_query'};

// api.cloud.flexprice.io is the India region; US is the SDK default. Set FLEXPRICE_API_URL for another region.
const base = () => process.env.FLEXPRICE_API_URL ?? 'https://us.api.flexprice.io/v1';
const customer = () => process.env.FLEXPRICE_CUSTOMER_ID ?? 'demo-founder';
export const flexpriceStatus = {enabled: false, customerReady: false, sent: 0, failed: 0, lastError: '' as string};

async function call(path: string, body: object) {
  const r = await fetch(`${base()}${path}`, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-api-key': process.env.FLEXPRICE_API_KEY!}, body: JSON.stringify(body)});
  return {ok: r.ok, status: r.status, text: r.ok ? '' : (await r.text()).slice(0, 200)};
}

/** Create the Flexprice customer once (idempotent: 409 means it already exists). */
export async function initFlexprice(founderName = 'Demo founder') {
  if (!process.env.FLEXPRICE_API_KEY) return;
  flexpriceStatus.enabled = true;
  try {
    const r = await call('/customers', {external_id: customer(), name: founderName || 'Demo founder', metadata: {app: 'the-thread'}});
    flexpriceStatus.customerReady = r.ok || r.status === 409;
    if (!flexpriceStatus.customerReady) { flexpriceStatus.lastError = `customer ${r.status}: ${r.text}`; console.warn('[flexprice]', flexpriceStatus.lastError); }
    else console.log(`[flexprice] customer ${customer()} ready`);
  } catch (e) { flexpriceStatus.lastError = String(e); console.warn('[flexprice]', String(e)); }
}

export function meter(db: DB, name: Meter, n = 1) {
  db.usage[name] += n;
  db.usage.credits = Math.max(0, db.usage.credits - COST[name] * n);
  if (!process.env.FLEXPRICE_API_KEY) return;
  const ts = new Date().toISOString();
  void call('/events', {
    event_name: EVENT[name], external_customer_id: customer(), event_id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts, source: 'the-thread', properties: {count: String(n), credits_left: String(db.usage.credits)},
  }).then((r) => { if (r.ok) flexpriceStatus.sent++; else { flexpriceStatus.failed++; flexpriceStatus.lastError = `event ${r.status}: ${r.text}`; console.warn('[flexprice]', flexpriceStatus.lastError); } })
    .catch((e) => { flexpriceStatus.failed++; flexpriceStatus.lastError = String(e); });
}
