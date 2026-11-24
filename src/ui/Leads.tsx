// Module 2 + score: real companies and buyers, every row with its sources, a fit & intent score and the best warm path.
import {Fragment, useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Source} from '../../shared/types';

export const Sources = ({s}: {s: Source[]}) => <span className="sources">{s.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" title={x.title ?? x.url}>[{i + 1}]</a>)}</span>;
export const Tier = ({tier, score}: {tier: string; score: number}) => <span className={`tier t${tier}`}>{tier} · {score}</span>;
const PATH_LABEL = {colleague: 'knows someone there', former_colleague: 'knows an ex-colleague', shared_employer: 'same ex-employer', shared_school: 'same school'};

export function LeadsView() {
  const {db} = useLink();
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const L = leads(db).filter((l) => showExcluded || !l.excluded);
  const excluded = db.companies.filter((c) => c.negative);
  if (!db.people.length) return <div className="empty"><h2>No leads yet</h2><p>Once the ICP is set, the agent searches the public web for matching companies and the right people there, each with a source link.</p></div>;
  return (
    <div>
      <div className="row-between"><h2>Leads <span className="muted">({L.length})</span></h2>
        <label className="muted small"><input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} /> show {excluded.length} excluded by negative signals</label></div>
      <table className="leads">
        <thead><tr><th>Score</th><th>Buyer</th><th>Company</th><th>Warm path</th><th>Signals</th><th>Email</th></tr></thead>
        <tbody>{L.map((l) => (
          <Fragment key={l.person.id}>
            <tr className={`${open === l.person.id ? 'open' : ''} ${l.excluded ? 'excluded' : ''}`} onClick={() => setOpen(open === l.person.id ? null : l.person.id)}>
              <td><Tier tier={l.tier} score={l.score} /></td>
              <td><b>{l.person.name}</b><div className="muted">{l.person.title}</div></td>
              <td>{l.company?.name}<div className="muted">{[l.company?.industry, l.company?.employees && `${l.company.employees} ppl`].filter(Boolean).join(' · ')}</div></td>
              <td>{l.paths[0] ? <span className="path">{PATH_LABEL[l.paths[0].kind]}</span> : <span className="muted">cold</span>}</td>
              <td>{l.signals.length || <span className="muted">–</span>}</td>
              <td onClick={(e) => e.stopPropagation()}>{l.person.email ? <span title={l.person.emailStatus}>{l.person.email}</span> : <button className="small" onClick={() => sendWs({type: 'enrich', personId: l.person.id})}>Find email</button>}</td>
            </tr>
            {open === l.person.id && <tr className="detail"><td colSpan={6}>
              <div className="grid3">
                <div><h4>Why this score</h4><ul>{l.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  <div className="muted small">fit {l.fit}/60 · intent {l.intent}/25 · warm {l.warm}/15</div></div>
                <div><h4>Warm paths</h4>{l.paths.length ? l.paths.map((p, i) => <div key={i} className="hops">{p.hops.map((h, j) => <Fragment key={j}>{j > 0 && <span className="arrow">→</span>}<span className="hop">{h}</span></Fragment>)}<div className="muted small">{p.text}</div></div>) : <div className="muted">No path found in your network.</div>}</div>
                <div><h4>Signals & sources</h4>{l.signals.map((s) => <div key={s.id} className="sig"><span className="chip">{s.kind}</span> <a href={s.url} target="_blank" rel="noreferrer">{s.text}</a></div>)}
                  <div className="small">Person <Sources s={l.person.sources} /> · Company <Sources s={l.company?.sources ?? []} /></div>
                  {l.company?.why && <div className="muted small">{l.company.why}</div>}
                  {l.company?.negative && <div className="neg small">Excluded: {l.company.negative.reason} <Sources s={l.company.negative.sources} /></div>}
                </div>
              </div>
            </td></tr>}
          </Fragment>))}
        </tbody>
      </table>
    </div>
  );
}
