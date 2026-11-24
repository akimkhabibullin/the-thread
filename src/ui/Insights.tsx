// Module 5 analytics + competitors + the audit log (who did what: AI or founder).
import {useLink} from '../link';
import {leads, LeadView} from '../../shared/logic';
import {Stage} from '../../shared/types';
import {Sources} from './Leads';

const REACHED: Record<Stage, number> = {matched: 0, contacted: 1, replied: 2, meeting: 3, closed: 4, lost: 1};
function Funnel({title, groups}: {title: string; groups: [string, LeadView[]][]}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <table className="mini">
        <thead><tr><th></th><th>Leads</th><th>Contacted</th><th>Replied</th><th>Meeting</th><th>Won</th></tr></thead>
        <tbody>{groups.map(([k, ls]) => {
          const n = (lvl: number) => ls.filter((l) => REACHED[l.person.stage] >= lvl).length;
          const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
          return <tr key={k}><td>{k}</td><td>{ls.length}</td><td>{n(1)}</td><td>{n(2)} <span className="muted">{pct(n(2), n(1))}</span></td><td>{n(3)}</td><td>{n(4)}</td></tr>;
        })}</tbody>
      </table>
    </div>
  );
}
const group = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]); return [...m.entries()]; };

export function InsightsView() {
  const {db} = useLink();
  const L = leads(db).filter((l) => !l.excluded);
  const variants = (['A', 'B'] as const).map((v) => {
    const ds = db.drafts.filter((d) => d.variant === v);
    const approved = ds.filter((d) => d.status === 'approved');
    const replied = approved.filter((d) => REACHED[db.people.find((p) => p.id === d.personId)?.stage ?? 'matched'] >= 2);
    return {v, drafted: ds.length, approved: approved.length, replied: replied.length, angles: [...new Set(ds.map((d) => d.angle))].slice(0, 3)};
  });
  const kinds = (['intro_request', 'cold'] as const).map((k) => {
    const ap = db.drafts.filter((d) => d.kind === k && d.status === 'approved');
    return {k, approved: ap.length, replied: ap.filter((d) => REACHED[db.people.find((p) => p.id === d.personId)?.stage ?? 'matched'] >= 2).length};
  });
  return (
    <div className="insights">
      <div className="grid2">
        <Funnel title="Conversion by tier" groups={group(L, (l) => `Tier ${l.tier}`).sort()} />
        <Funnel title="Conversion by industry" groups={group(L, (l) => l.company?.industry ?? 'unknown')} />
        <div className="card"><h3>A/B variants</h3>
          <table className="mini"><thead><tr><th></th><th>Drafted</th><th>Approved</th><th>Replied</th><th>Angles</th></tr></thead>
            <tbody>{variants.map((x) => <tr key={x.v}><td>{x.v}</td><td>{x.drafted}</td><td>{x.approved}</td><td>{x.replied}</td><td className="muted small">{x.angles.join(' · ')}</td></tr>)}</tbody></table>
        </div>
        <div className="card"><h3>Warm vs cold</h3>
          <table className="mini"><thead><tr><th></th><th>Queued</th><th>Replied</th><th>Reply rate</th></tr></thead>
            <tbody>{kinds.map((x) => <tr key={x.k}><td>{x.k === 'intro_request' ? 'Intro requests' : 'Cold'}</td><td>{x.approved}</td><td>{x.replied}</td><td>{x.approved ? `${Math.round((x.replied / x.approved) * 100)}%` : '–'}</td></tr>)}</tbody></table>
        </div>
      </div>
      <h3>Competitors</h3>
      <div className="grid3">{db.competitors.map((c) => (
        <div key={c.id} className="card"><div className="row-between"><b>{c.name}</b><Sources s={c.sources} /></div>
          <div className="small">{c.positioning}</div><div className="small muted">Pricing: {c.pricing}</div>
          <ul className="small">{c.differentiators.map((d, i) => <li key={i}>{d}</li>)}</ul></div>))}
        {!db.competitors.length && <div className="muted">None yet.</div>}
      </div>
      <h3>Audit log</h3>
      <div className="audit">{[...db.audit].reverse().slice(0, 200).map((a, i) => (
        <div key={i} className="arow"><span className="t">{new Date(a.at).toLocaleTimeString()}</span><span className={`by ${a.actor}`}>{a.actor === 'ai' ? `AI${a.agent ? ` · ${a.agent}` : ''}` : 'Founder'}</span><span>{a.action}{a.target && <b> {a.target}</b>}{a.detail && <span className="muted"> · {a.detail}</span>}</span></div>))}
      </div>
    </div>
  );
}
