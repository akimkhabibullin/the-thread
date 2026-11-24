// Step 02: the customer profile with how sure the agent is about each part, and ways to widen it (accept / adjust / dismiss).
import {sendWs, useLink} from '../link';
import type {Conf} from '../../shared/types';
import {Empty, PageHead} from './Chrome';
import {href} from '../route';

const Sure = ({c}: {c: number}) => <span className={`sure ${c < 0.5 ? 'lo' : ''}`} title="How sure the agent is">{Math.round(c * 100)}% sure</span>;
function Field<T>({label, f, render}: {label: string; f: Conf<T>; render: (v: T) => React.ReactNode}) {
  return (
    <div className="field">
      <div className="f-label">{label}<Sure c={f.confidence} /></div>
      <div className="f-value">{render(f.value)}{f.why && <div className="why">{f.why}</div>}</div>
    </div>
  );
}
const list = (xs: string[]) => xs.length ? xs.join(', ') : <span className="quiet">None</span>;

export function IcpView() {
  const {db} = useLink();
  const icp = db.icp;
  if (!icp) return <><PageHead title="Profile" /><Empty title="Nothing here yet">Start with the <a className="u" href={href('brief')}>brief</a>. Describe your product and the agent builds the profile, with how sure it is about each part.</Empty></>;
  const open = db.expansions.filter((e) => e.status === 'open');
  const decided = db.expansions.filter((e) => e.status !== 'open');
  return (
    <div className="profile">
      <PageHead title="Profile" lede={<>Who buys <b>{icp.product}</b>. {icp.summary}</>} />
      <div className="fields">
        <Field label="Industries" f={icp.industries} render={(v) => list(v.map((i) => (i.naics ? `${i.name} (NAICS ${i.naics})` : i.name)))} />
        <Field label="Company size" f={icp.companySize} render={(v) => `${v.min.toLocaleString()} to ${v.max.toLocaleString()} employees`} />
        <Field label="Buyers" f={icp.personas} render={(v) => list(v.map((p) => [p.title, p.seniority].filter(Boolean).join(', ')))} />
        <Field label="Buying triggers" f={icp.triggers} render={list} />
        <Field label="Regions" f={icp.geos} render={list} />
        <Field label="Not a fit" f={icp.negatives} render={list} />
      </div>
      {open.length > 0 && <section className="block">
        <h2 className="center">Ways to widen it</h2>
        <div className="expansions">{open.map((e) => (
          <div key={e.id} className="exp">
            <div className="who">{e.field}</div>
            <h3>{e.suggestion}</h3>
            <p className="quiet">{e.why}</p>
            <div className="pills">
              <button className="pill solid" onClick={() => sendWs({type: 'expansion', id: e.id, action: 'accepted'})}>Accept</button>
              <button className="pill" onClick={() => { const note = prompt('How should it be adjusted?'); if (note) sendWs({type: 'expansion', id: e.id, action: 'adjusted', note}); }}>Adjust</button>
              <button className="link" onClick={() => sendWs({type: 'expansion', id: e.id, action: 'dismissed'})}>Dismiss</button>
            </div>
          </div>))}
        </div>
      </section>}
      {decided.length > 0 && <p className="quiet small center">Decided: {decided.map((e) => `${e.suggestion} (${e.status})`).join(' · ')}</p>}
    </div>
  );
}
