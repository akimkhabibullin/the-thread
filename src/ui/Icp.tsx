// Module 1: the ideal customer profile with per-field confidence, and expansion suggestions to accept / adjust / dismiss.
import {sendWs, useLink} from '../link';
import type {Conf} from '../../shared/types';

const Confidence = ({c}: {c: number}) => <span className={`conf ${c >= 0.75 ? 'hi' : c >= 0.5 ? 'mid' : 'lo'}`} title="How sure the agent is">{Math.round(c * 100)}%</span>;
function Field<T>({label, f, render}: {label: string; f: Conf<T>; render: (v: T) => React.ReactNode}) {
  return <div className="field"><div className="label">{label} <Confidence c={f.confidence} /></div><div className="value">{render(f.value)}</div>{f.why && <div className="why">{f.why}</div>}</div>;
}
const chips = (xs: string[]) => <div className="chips">{xs.map((x) => <span key={x} className="chip">{x}</span>)}</div>;

export function IcpView() {
  const {db} = useLink();
  const icp = db.icp;
  if (!icp) return <div className="empty"><h2>Start by describing your product</h2><p>Type it in the panel on the left, like you'd explain it to a friend. The agent turns it into an ideal customer profile, with how sure it is about each part.</p></div>;
  const open = db.expansions.filter((e) => e.status === 'open');
  return (
    <div className="icp">
      <div className="icp-head"><div className="muted">Ideal customer profile for</div><h2>{icp.product}</h2><p>{icp.summary}</p></div>
      <div className="grid2">
        <Field label="Industries" f={icp.industries} render={(v) => chips(v.map((i) => (i.naics ? `${i.name} · NAICS ${i.naics}` : i.name)))} />
        <Field label="Company size" f={icp.companySize} render={(v) => `${v.min.toLocaleString()}–${v.max.toLocaleString()} employees`} />
        <Field label="Buyers" f={icp.personas} render={(v) => chips(v.map((p) => [p.title, p.seniority].filter(Boolean).join(' · ')))} />
        <Field label="Buying triggers" f={icp.triggers} render={chips} />
        <Field label="Regions" f={icp.geos} render={chips} />
        <Field label="Not a fit" f={icp.negatives} render={chips} />
      </div>
      {open.length > 0 && <>
        <h3>Ways to widen it</h3>
        <div className="expansions">{open.map((e) => (
          <div key={e.id} className="card exp">
            <div className="who">{e.field}</div><div><b>{e.suggestion}</b></div><div className="muted">{e.why}</div>
            <div className="opts">
              <button className="primary" onClick={() => sendWs({type: 'expansion', id: e.id, action: 'accepted'})}>Accept</button>
              <button onClick={() => { const note = prompt('How should it be adjusted?'); if (note) sendWs({type: 'expansion', id: e.id, action: 'adjusted', note}); }}>Adjust…</button>
              <button onClick={() => sendWs({type: 'expansion', id: e.id, action: 'dismissed'})}>Dismiss</button>
            </div>
          </div>))}
        </div>
      </>}
      {db.expansions.some((e) => e.status !== 'open') && <div className="muted small">Decided: {db.expansions.filter((e) => e.status !== 'open').map((e) => `${e.suggestion} (${e.status})`).join(' · ')}</div>}
    </div>
  );
}
