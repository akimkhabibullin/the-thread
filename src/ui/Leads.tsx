// Step 03: real companies and buyers, each with sources, a fit & intent score and the best warm path. Click a row for why.
import {Fragment, useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Source} from '../../shared/types';
import {Empty, PageHead} from './Chrome';

export const Sources = ({s}: {s: Source[]}) => <span className="sources">{s.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noreferrer" title={x.title ?? x.url} onClick={(e) => e.stopPropagation()}>{i + 1}</a>)}</span>;
export const Num = ({n, className = ''}: {n: number | string; className?: string}) => <span className={`num ${className}`}>{n}<i>.</i></span>;
export const Tier = ({tier, score}: {tier: string; score: number}) => <span className="tier" title={`Score ${score}`}>Tier {tier} · {score}</span>;
const PATH_LABEL = {colleague: 'knows someone there', former_colleague: 'knows an ex-colleague', shared_employer: 'same ex-employer', shared_school: 'same school'};

export function LeadsView() {
  const {db} = useLink();
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const L = leads(db).filter((l) => showExcluded || !l.excluded);
  const excluded = db.companies.filter((c) => c.negative);
  if (!db.people.length) return <><PageHead title="Leads" /><Empty title="No leads yet">Once the profile is set, the agent searches the public web for matching companies and the right people there, each with a source link.</Empty></>;
  return (
    <div className="leads-page">
      <PageHead title="Leads" lede={`${L.length} people at companies that fit, scored on fit, intent and how warm the path is. Every number links back to where it came from.`} />
      <div className="table-tools">
        {excluded.length > 0 && <button className="link" onClick={() => setShowExcluded(!showExcluded)}>{showExcluded ? 'Hide' : 'Show'} {excluded.length} excluded {excluded.length === 1 ? 'company' : 'companies'}</button>}
      </div>
      <table className="leads">
        <thead><tr><th>Score</th><th>Person</th><th>Company</th><th>Signal</th><th>Sources</th><th>Warm path</th><th>Email</th></tr></thead>
        <tbody>{L.map((l) => (
          <Fragment key={l.person.id}>
            <tr className={`row ${open === l.person.id ? 'open' : ''} ${l.excluded ? 'excluded' : ''}`} onClick={() => setOpen(open === l.person.id ? null : l.person.id)}>
              <td className="c-score"><Num n={l.score} /><div className="tier-s">Tier {l.tier}</div></td>
              <td><div className="strong">{l.person.name}</div><div className="quiet">{l.person.title}</div></td>
              <td>{l.company?.name}<div className="quiet">{[l.company?.industry, l.company?.employees && `${l.company.employees} people`].filter(Boolean).join(', ')}</div></td>
              <td className="c-signal">{l.signals[0] ? <span>{l.signals[0].text}{l.signals.length > 1 && <span className="quiet"> +{l.signals.length - 1}</span>}</span> : <span className="quiet">None</span>}</td>
              <td><Sources s={[...l.person.sources, ...(l.company?.sources ?? [])]} /></td>
              <td>{l.paths[0] ? <span className="warm">via {l.paths[0].hops[1]}<div className="quiet">{PATH_LABEL[l.paths[0].kind]}</div></span> : <span className="quiet">Cold</span>}</td>
              <td onClick={(e) => e.stopPropagation()}>{l.person.email ? <span className="email" title={l.person.emailStatus}>{l.person.email}</span> : <button className="pill sm" onClick={() => sendWs({type: 'enrich', personId: l.person.id})}>Find email</button>}</td>
            </tr>
            {open === l.person.id && <tr className="detail"><td colSpan={7}>
              <div className="detail-grid">
                <div><h4>Why this score</h4><ul>{l.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  <div className="quiet small">Fit {l.fit} of 60 · intent {l.intent} of 25 · warm {l.warm} of 15</div></div>
                <div><h4>Warm paths</h4>{l.paths.length ? l.paths.map((p, i) => <div key={i} className="mini-path"><Hops hops={p.hops} /><div className="quiet small">{p.text}</div></div>) : <div className="quiet">No path found in your network.</div>}</div>
                <div><h4>Signals</h4>{l.signals.map((s) => <div key={s.id} className="sig"><span className="kind">{s.kind}</span><a className="u" href={s.url} target="_blank" rel="noreferrer">{s.text}</a></div>)}
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
