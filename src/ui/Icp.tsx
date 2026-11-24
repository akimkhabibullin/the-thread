// Step 02: the customer profile as an editorial spread: one statement sentence, then a spec sheet with how sure the agent is.
import {sendWs, useLink} from '../link';
import type {Conf} from '../../shared/types';
import {Empty, PageHead} from './Chrome';
import {href} from '../route';

const Sure = ({c}: {c: number}) => <span className={`sure ${c < 0.5 ? 'lo' : ''}`} title="How sure the agent is">{Math.round(c * 100)}% sure</span>;
function Spec<T>({label, f, render}: {label: string; f: Conf<T>; render: (v: T) => React.ReactNode}) {
  return (
    <div className="spec">
      <div className="spec-label"><span>{label}</span><Sure c={f.confidence} /></div>
      <div className="spec-value">{render(f.value)}</div>
      {f.why && <div className="why">{f.why}</div>}
    </div>
  );
}
const list = (xs: string[]) => xs.length ? xs.join(', ') : <span className="quiet">None</span>;
const and = (xs: string[]) => xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function IcpView() {
  const {db} = useLink();
  const icp = db.icp;
  if (!icp) return <><PageHead title="Profile" /><Empty title="Nothing here yet">Start with the <a className="u" href={href('brief')}>brief</a>. Describe your product and the agent builds the profile, with how sure it is about each part.</Empty></>;
  const open = db.expansions.filter((e) => e.status === 'open');
  const decided = db.expansions.filter((e) => e.status !== 'open');
  const personas = icp.personas.value.slice(0, 2).map((p) => p.title.toLowerCase());
  const inds = icp.industries.value.slice(0, 1).map((i) => i.name.split(' / ')[0]);
  const {min, max} = icp.companySize.value;
  return (
    <div className="profile">
      <div className="spread">
        <div className="spread-left">
          <div className="who">Customer profile · {icp.product}</div>
          <h1 className="statement">
            {icp.product} sells to {and(personas)} at {and(inds)} companies of {min.toLocaleString()} to {max.toLocaleString()} people<span className="red">{icp.triggers.value[0] ? `, usually when ${icp.triggers.value[0].charAt(0).toLowerCase()}${icp.triggers.value[0].slice(1)}.` : '.'}</span>
          </h1>
        </div>
        <p className="spread-right">{icp.summary}</p>
      </div>
      <div className="specsheet">
        <Spec label="Industries" f={icp.industries} render={(v) => list(v.map((i) => (i.naics ? `${i.name} (NAICS ${i.naics})` : i.name)))} />
        <Spec label="Company size" f={icp.companySize} render={(v) => `${v.min.toLocaleString()} to ${v.max.toLocaleString()} employees`} />
        <Spec label="Buyers" f={icp.personas} render={(v) => list(v.map((p) => [p.title, p.seniority].filter(Boolean).join(', ')))} />
        <Spec label="Buying triggers" f={icp.triggers} render={list} />
        <Spec label="Regions" f={icp.geos} render={list} />
        <Spec label="Not a fit" f={icp.negatives} render={list} />
      </div>
      {open.length > 0 && <section className="widen">
        <h2>Ways to widen it</h2>
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
