// Step 07: what is working. Conversion by tier and industry, A/B, warm vs cold, competitors, and the audit log.
import {useState} from 'react';
import {useLink} from '../link';
import {leads, LeadView} from '../../shared/logic';
import {Stage, STAGES} from '../../shared/types';
import {PageHead} from './Chrome';
import {Num, Sources} from './Leads';

const REACHED: Record<Stage, number> = {matched: 0, contacted: 1, replied: 2, meeting: 3, closed: 4, lost: 1};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
function Funnel({title, groups}: {title: string; groups: [string, LeadView[]][]}) {
  return (
    <div className="stat-block">
      <h2 className="h-sub">{title}</h2>
      <table className="mini">
        <thead><tr><th></th><th>Leads</th><th>Contacted</th><th>Replied</th><th>Meeting</th><th>Won</th></tr></thead>
        <tbody>{groups.map(([k, ls]) => {
          const n = (lvl: number) => ls.filter((l) => REACHED[l.person.stage] >= lvl).length;
          return <tr key={k}><td>{k}</td><td>{ls.length}</td><td>{n(1)}</td><td>{n(2)} <span className="quiet">{pct(n(2), n(1))}</span></td><td>{n(3)}</td><td>{n(4)}</td></tr>;
        })}</tbody>
      </table>
    </div>
  );
}
function Bars({title, rows}: {title: string; rows: [string, number, boolean][]}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="bars">
      <h2 className="h-sub">{title}</h2>
      {rows.map(([k, v, hi]) => (
        <div key={k} className="bar-row"><span className="bar-k">{k}</span><span className="bar-track"><i className={hi ? 'hi' : ''} style={{width: `${(v / max) * 100}%`}} /></span><span className="bar-v">{v}</span></div>
      ))}
    </div>
  );
}
const group = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]); return [...m.entries()]; };

export function InsightsView() {
  const {db} = useLink();
  const [allAudit, setAllAudit] = useState(false);
  const L = leads(db).filter((l) => !l.excluded);
  const stageOf = (pid: string) => REACHED[db.people.find((p) => p.id === pid)?.stage ?? 'matched'];
  const variants = (['A', 'B'] as const).map((v) => {
    const ds = db.drafts.filter((d) => d.variant === v);
    const approved = ds.filter((d) => d.status === 'approved');
    return {v, drafted: ds.length, approved: approved.length, replied: approved.filter((d) => stageOf(d.personId) >= 2).length, angles: [...new Set(ds.map((d) => d.angle))].slice(0, 3)};
  });
  const kinds = (['intro_request', 'cold'] as const).map((k) => {
    const ap = db.drafts.filter((d) => d.kind === k && d.status === 'approved');
    return {k, approved: ap.length, replied: ap.filter((d) => stageOf(d.personId) >= 2).length};
  });
  const [warm, cold] = kinds;
  const audit = [...db.audit].reverse();
  const approvedN = warm.approved + cold.approved, repliedN = warm.replied + cold.replied;
  return (
    <div className="insights">
      <PageHead title="Insights" lede="What is working, and everything that happened, with who did it." />
      <dl className="kpis">
        <div><dt>Drafts written</dt><dd>{db.drafts.length}</dd><p>{db.drafts.filter((d) => d.kind === 'intro_request').length} are intro requests through someone you know</p></div>
        <div><dt>Approved and queued</dt><dd>{approvedN}</dd><p>{db.drafts.filter((d) => d.status === 'rejected').length} rejected; the agent learns from why</p></div>
        <div><dt>Replies</dt><dd>{repliedN}</dd><p>{warm.approved || cold.approved ? <>Warm intros {pct(warm.replied, warm.approved)}, cold emails {pct(cold.replied, cold.approved)}</> : 'Reply rates show up once something is queued'}</p></div>
      </dl>
      <div className="charts">
        <Bars title="Leads by tier" rows={(['A', 'B', 'C'] as const).map((t) => [`Tier ${t}`, L.filter((l) => l.tier === t).length, t === 'A'])} />
        <Bars title="Where they are" rows={STAGES.map((st) => [st.charAt(0).toUpperCase() + st.slice(1), L.filter((l) => l.person.stage === st).length, st === 'meeting' || st === 'closed'])} />
        <Bars title="How you reach them" rows={[['Warm path', L.filter((l) => l.paths.length).length, true], ['Cold', L.filter((l) => !l.paths.length).length, false]]} />
      </div>
      <div className="two">
        <Funnel title="By tier" groups={group(L, (l) => `Tier ${l.tier}`).sort()} />
        <Funnel title="By industry" groups={group(L, (l) => l.company?.industry ?? 'Unknown')} />
        <div className="stat-block"><h2 className="h-sub">A/B variants</h2>
          <table className="mini"><thead><tr><th></th><th>Drafted</th><th>Approved</th><th>Replied</th></tr></thead>
            <tbody>{variants.map((x) => <tr key={x.v}><td>{x.v}<div className="quiet small">{x.angles.join(' · ')}</div></td><td>{x.drafted}</td><td>{x.approved}</td><td>{x.replied}</td></tr>)}</tbody></table>
        </div>
        <div className="stat-block"><h2 className="h-sub">Warm vs cold</h2>
          <table className="mini"><thead><tr><th></th><th>Queued</th><th>Replied</th><th>Rate</th></tr></thead>
            <tbody>{kinds.map((x) => <tr key={x.k}><td>{x.k === 'intro_request' ? 'Intro requests' : 'Cold'}</td><td>{x.approved}</td><td>{x.replied}</td><td>{pct(x.replied, x.approved)}</td></tr>)}</tbody></table>
        </div>
      </div>

      <h2 className="center section-title">Competitors</h2>
      <div className="competitors">{db.competitors.map((c) => (
        <div key={c.id} className="comp">
          <h3>{c.name}</h3>
          <p>{c.positioning}</p>
          <p className="quiet small">Pricing: {c.pricing}</p>
          <ul className="small">{c.differentiators.map((d, i) => <li key={i}>{d}</li>)}</ul>
          <div className="small">Sources <Sources s={c.sources} /></div>
        </div>))}
        {!db.competitors.length && <p className="quiet center">None yet.</p>}
      </div>

      <h2 className="center section-title">Audit log</h2>
      <div className="audit">{audit.slice(0, allAudit ? 200 : 12).map((a, i) => (
        <div key={i} className="arow"><span className="t">{new Date(a.at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span><span className={`by ${a.actor}`}>{a.actor === 'ai' ? `Agent${a.agent ? ` · ${a.agent}` : ''}` : 'You'}</span><span>{a.action}{a.target && <b> {a.target}</b>}{a.detail && <span className="quiet"> · {a.detail}</span>}</span></div>))}
      </div>
      {audit.length > 12 && <div className="center mt"><button className="pill" onClick={() => setAllAudit(!allAudit)}>{allAudit ? 'Show less' : `Show all ${Math.min(audit.length, 200)}`}</button></div>}
    </div>
  );
}
