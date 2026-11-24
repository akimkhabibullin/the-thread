// Step 03: real companies and buyers, each with sources, a fit & intent score and the best warm path. Click a row for why.
import {Fragment, useEffect, useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Source} from '../../shared/types';
import {Empty, PageHead} from './Chrome';
import {readSeen, writeSeen} from './Agent';

export const Sources = ({s}: {s: Source[]}) => <span className="sources">{s.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" title={x.title ?? x.url} onClick={(e) => e.stopPropagation()}>{i + 1}</a>)}</span>;
export const Num = ({n, className = ''}: {n: number | string; className?: string}) => <span className={`num ${className}`}>{n}<i>.</i></span>;
export const Tier = ({tier, score}: {tier: string; score: number}) => <span className="tier" title={`Score ${score}`}>Tier {tier} · {score}</span>;
const PATH_LABEL = {colleague: 'knows someone there', former_colleague: 'knows an ex-colleague', shared_employer: 'same ex-employer', shared_school: 'same school', shared_community: 'same community'};

type Sort = 'score' | 'tier' | 'company' | 'newest';
const FIND_MORE = 'Find 10 more leads that fit the ICP, avoiding companies already in the list; prioritise ones reachable through my network.';
const REFRESH = 'Refresh hiring, funding and launch signals for the companies in my list, with sources, and re-check where my connections near the ICP work now (job changes).';

export function LeadsView() {
  const {db, status, connected} = useLink();
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('score');
  const [tiers, setTiers] = useState<Set<string>>(new Set());
  const [warmOnly, setWarmOnly] = useState<'' | 'yes' | 'no'>('');
  const [emailOnly, setEmailOnly] = useState(false);
  const [asked, setAsked] = useState('');
  // "New since last visit": ids not in the set stored on the previous visit. First visit ever marks nothing.
  const [seen] = useState(readSeen);
  useEffect(() => { if (db.people.length) writeSeen(db.people.map((p) => p.id)); }, [db.people.length]);
  const order = new Map(db.people.map((p, i) => [p.id, i]));
  const all = leads(db);
  const excluded = db.companies.filter((c) => c.negative);
  const needle = q.trim().toLowerCase();
  let L = all.filter((l) => showExcluded || !l.excluded)
    .filter((l) => !needle || [l.person.name, l.person.title, l.company?.name, l.company?.industry, ...l.signals.map((x) => x.text)].some((x) => x?.toLowerCase().includes(needle)))
    .filter((l) => !tiers.size || tiers.has(l.tier))
    .filter((l) => !warmOnly || (warmOnly === 'yes') === l.paths.length > 0)
    .filter((l) => !emailOnly || !!l.person.email);
  L = [...L].sort((a, b) => sort === 'tier' ? a.tier.localeCompare(b.tier) || b.score - a.score
    : sort === 'company' ? (a.company?.name ?? '').localeCompare(b.company?.name ?? '')
    : sort === 'newest' ? (order.get(b.person.id) ?? 0) - (order.get(a.person.id) ?? 0) : b.score - a.score);
  const fresh = (id: string) => !!seen && !seen.has(id);
  const nNew = all.filter((l) => fresh(l.person.id)).length;
  const toggleTier = (t: string) => setTiers((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const ask = (text: string, label: string) => { sendWs({type: 'task', text, kind: 'chat'}); setAsked(label); setTimeout(() => setAsked(''), 4000); };
  const agentOn = connected && status !== 'offline';
  const actions = (
    <div className="lead-actions">
      <button className="pill solid" onClick={() => ask(FIND_MORE, 'Asked the agent for 10 more leads.')}>Find more leads</button>
      <button className="pill" onClick={() => ask(REFRESH, 'Asked the agent to refresh signals.')}>Refresh signals</button>
      <span className="quiet small">{asked || (agentOn ? (status === 'working' ? 'The agent is working…' : 'New leads appear here as the agent finds them.') : <>The agent isn't running. <a className="u" href="#/start/3">Connect it</a></>)}</span>
    </div>
  );
  if (!db.people.length) return <><PageHead title="Leads" /><Empty title="No leads yet">Once the profile is set, the agent searches the public web for matching companies and the right people there, each with a source link.</Empty>{db.icp && <div className="center">{actions}</div>}</>;
  return (
    <div className="leads-page">
      <div className="leads-head">
        <div>
          <h1>Leads</h1>
          <p className="quiet">{all.filter((l) => !l.excluded).length} people at companies that fit{nNew > 0 && <> · <span className="new-count">{nNew} new since your last visit</span></>}</p>
        </div>
        {actions}
      </div>
      <div className="lead-tools">
        <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, title, signal" aria-label="Search leads" />
        <div className="chipset">
          {['A', 'B', 'C'].map((t) => <button key={t} className={`chip ${tiers.has(t) ? 'on' : ''}`} onClick={() => toggleTier(t)}>Tier {t}</button>)}
          <button className={`chip ${warmOnly === 'yes' ? 'on' : ''}`} onClick={() => setWarmOnly(warmOnly === 'yes' ? '' : 'yes')}>Warm path</button>
          <button className={`chip ${warmOnly === 'no' ? 'on' : ''}`} onClick={() => setWarmOnly(warmOnly === 'no' ? '' : 'no')}>Cold</button>
          <button className={`chip ${emailOnly ? 'on' : ''}`} onClick={() => setEmailOnly(!emailOnly)}>Has email</button>
          {excluded.length > 0 && <button className={`chip ${showExcluded ? 'on' : ''}`} onClick={() => setShowExcluded(!showExcluded)}>{excluded.length} excluded</button>}
        </div>
        <label className="sort">Sort by <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="score">Score</option><option value="tier">Tier</option><option value="company">Company</option><option value="newest">Newest</option>
        </select></label>
        <span className="count">{L.length} {L.length === 1 ? 'result' : 'results'}</span>
      </div>
      <table className="leads">
        <thead><tr><th>Score</th><th>Person</th><th>Company</th><th>Signal</th><th>Sources</th><th>Warm path</th><th>Email</th></tr></thead>
        <tbody>{L.map((l) => (
          <Fragment key={l.person.id}>
            <tr className={`row ${open === l.person.id ? 'open' : ''} ${l.excluded ? 'excluded' : ''}`} onClick={() => setOpen(open === l.person.id ? null : l.person.id)}>
              <td className="c-score"><Num n={l.score} /><div className="tier-s">Tier {l.tier}</div></td>
              <td><div className="lead-name">{l.person.name}{fresh(l.person.id) && <span className="new">New</span>}</div><div className="quiet">{l.person.title}</div></td>
              <td><div className="lead-co">{l.company?.name}</div><div className="quiet">{[l.company?.industry, l.company?.employees && `${l.company.employees} people`].filter(Boolean).join(', ')}</div></td>
              <td className="c-signal">{l.signals[0] ? <span>{l.signals.some((x) => x.kind === 'job_change') && <span className="joined">just joined</span>}{(l.signals.find((x) => x.kind === 'job_change') ?? l.signals[0]).text}{l.signals.length > 1 && <span className="quiet"> +{l.signals.length - 1}</span>}</span> : <span className="quiet">None</span>}</td>
              <td><Sources s={[...l.person.sources, ...(l.company?.sources ?? [])]} /></td>
              <td>{l.paths[0] ? <span className="warm">via {l.paths[0].hops[1]}<div className="quiet">{PATH_LABEL[l.paths[0].kind]}</div></span> : <span className="quiet">Cold</span>}</td>
              <td onClick={(e) => e.stopPropagation()}>{l.person.email ? <span className="email" title={l.person.emailStatus}>{l.person.email}</span> : <><button className="pill sm" onClick={() => sendWs({type: 'enrich', personId: l.person.id})}>Find email</button>{l.person.enrichNote && <div className="enrich-note">{/HUNTER_API_KEY/.test(l.person.enrichNote) ? 'Needs a Hunter key: get one free at hunter.io and put it in .env' : l.person.enrichNote}</div>}</>}</td>
            </tr>
            {open === l.person.id && <tr className="detail"><td colSpan={7}>
              <div className="detail-grid">
                <div><h4>Why this score</h4><ul>{l.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  <div className="quiet small">Fit {l.fit} of 60 · intent {l.intent} of 25 · warm {l.warm} of 15</div></div>
                <div><h4>Warm paths</h4>{l.paths.length ? l.paths.map((p, i) => <div key={i} className="mini-path"><Hops hops={p.hops} /><div className="quiet small">{p.text}</div></div>) : <div className="quiet">No path found in your network.</div>}</div>
                <div><h4>Signals</h4>{l.signals.map((s) => <div key={s.id} className="sig">{s.kind === 'job_change' ? <span className="joined">just joined</span> : <span className="kind">{s.kind}</span>}<a className="u" href={s.url} target="_blank" rel="noreferrer">{s.text}</a></div>)}
                  {!l.signals.length && <div className="quiet">None found.</div>}
                  <div className="small src-line">Person <Sources s={l.person.sources} /> Company <Sources s={l.company?.sources ?? []} /></div>
                  {l.company?.why && <p className="quiet small">{l.company.why}</p>}
                  {l.company?.negative && <p className="neg small">Excluded: {l.company.negative.reason} <Sources s={l.company.negative.sources} /></p>}
                </div>
              </div>
            </td></tr>}
          </Fragment>))}
        </tbody>
      </table>
      {!L.length && <p className="quiet center mt">Nothing matches. <button className="link" onClick={() => { setQ(''); setTiers(new Set()); setWarmOnly(''); setEmailOnly(false); }}>Clear filters</button></p>}
    </div>
  );
}

/** You → Omar → Scott, joined by a red thread. */
export function Hops({hops, big}: {hops: string[]; big?: boolean}) {
  return (
    <div className={`hops ${big ? 'big' : ''}`}>
      {hops.map((h, j) => <Fragment key={j}>{j > 0 && <span className="thread" />}<span className={`hop ${j === 0 ? 'me' : j === hops.length - 1 ? 'buyer' : 'via'}`}>{h}</span></Fragment>)}
    </div>
  );
}
