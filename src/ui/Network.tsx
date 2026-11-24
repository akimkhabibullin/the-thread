// Step 04: the founder's own network. A dark band with the warm paths, then the file, the background, and contacts that need a company.
import {useEffect, useState} from 'react';
import {Icon} from './Icon';
import {post, sendWs, useLink} from '../link';
import {leads, superConnectors} from '../../shared/logic';
import type {Contact} from '../../shared/types';
import {Hops, Tier} from './Leads';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const MEET = 'Find 3–5 people I should get to know this week who sit next to several of my buyers (community hosts, recruiters, ex-employees, podcast hosts). Use graph_query super_connectors first, then suggest_connectors with sources.';
const OriginTag = ({c}: {c: Contact}) => c.origin === 'customer' ? <span className="otag customer">customer</span> : c.origin === 'met' ? <span className="otag">met</span> : null;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const LOOKUP = 'Look up the current company and title of my connections that have none, starting with the ones most likely to matter for my ICP. Use update_contacts with sources.';

function NeedsRow({c}: {c: Contact}) {
  const [company, setCompany] = useState(''), [position, setPosition] = useState('');
  const save = () => { if (company.trim()) sendWs({type: 'contact', id: c.id, company: company.trim(), ...(position.trim() ? {position: position.trim()} : {})}); };
  return (
    <div className="needs-row">
      <div className="nr-name">{c.url ? <a className="u" href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name}{c.connectedOn && <span className="quiet small"> · since {c.connectedOn}</span>}</div>
      <input value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Company" aria-label={`Company for ${c.name}`} />
      <input value={position} onChange={(e) => setPosition(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Title (optional)" aria-label={`Title for ${c.name}`} />
      <button className="pill sm" disabled={!company.trim()} onClick={save}>Save</button>
    </div>
  );
}

export function NetworkView() {
  const {db, status, connected} = useLink();
  const f = db.founder;
  const [name, setName] = useState(f.name), [schools, setSchools] = useState(f.schools.join(', ')), [past, setPast] = useState(f.pastCompanies.join(', ')), [comms, setComms] = useState((f.communities ?? []).join(', '));
  const [msg, setMsg] = useState(''), [asked, setAsked] = useState(false), [showAll, setShowAll] = useState(false);
  useEffect(() => { setName(f.name); setSchools(f.schools.join(', ')); setPast(f.pastCompanies.join(', ')); setComms((f.communities ?? []).join(', ')); }, [f.name, f.schools.join(), f.pastCompanies.join(), (f.communities ?? []).join()]);
  const [askedMeet, setAskedMeet] = useState(false);
  useEffect(() => { const a = location.hash.split('#')[2]; if (a) setTimeout(() => document.getElementById(a)?.scrollIntoView({behavior: 'smooth', block: 'start'}), 100); }, []);
  const saveBg = () => post('/api/network', {name, schools: list(schools), pastCompanies: list(past), communities: list(comms)}).then(() => setMsg('Saved.'));
  const upload = async (file: File) => {
    const r = await post('/api/network', {csv: await file.text(), fileName: file.name, name, schools: list(schools), pastCompanies: list(past), communities: list(comms)});
    setMsg(r.error ?? `Imported ${r.added} connections.`);
  };
  const warm = leads(db).filter((l) => l.paths.length);
  const withCo = f.network.filter((c) => c.company?.trim());
  const needs = f.network.filter((c) => !c.company?.trim());
  const byAgent = f.network.filter((c) => c.companySource && c.companySource !== 'founder').length;
  const companies = new Set(withCo.map((c) => c.company)).size;
  const agentOn = connected && status !== 'offline';
  const deals = f.network.filter((c) => c.origin === 'customer' || c.origin === 'met');
  const moves = [...(db.moves ?? [])].sort((a, b) => b.at - a.at);
  const supers = superConnectors(db).slice(0, 5);
  const toMeet = (db.connectors ?? []).filter((c) => c.status === 'open');
  const targetName = (id?: string) => db.companies.find((c) => c.id === id)?.name;
  return (
    <div className="network">
      <section className="net-band">
        <div className="net-band-inner">
          <h1>Network</h1>
          <p className="lede">The people you already know are the shortest way in.</p>
          {warm.length > 0 ? <div className="paths">
            <h2 className="paths-h">{warm.length} warm {warm.length === 1 ? 'path' : 'paths'}<span> into {db.people.length} leads</span></h2>
            {warm.map((l) => (
              <div key={l.person.id} className="path-row">
                <Hops hops={l.paths[0].hops} big />
                <div className="path-meta"><span>{l.paths[0].text}</span><span className="dim">{l.person.title}, {l.company?.name} · <Tier tier={l.tier} score={l.score} /></span></div>
              </div>))}
          </div> : <p className="dim center">{f.network.length ? 'No overlaps with the current leads yet. More leads, more chances.' : 'Add your connections below to find warm paths.'}</p>}
          <p className="net-stats"><b>{f.network.length}</b> connections at <b>{companies}</b> companies. <b>{deals.length}</b> from your deals, <b>{needs.length}</b> still {needs.length === 1 ? 'needs' : 'need'} a company.</p>
          {deals.length > 0 && <p className="deal-line">From your deals: {deals.map((c, i) => <span key={c.id}>{i > 0 && ', '}{c.name} <OriginTag c={c} /></span>)}</p>}
        </div>
      </section>

      <section className="meet" id="meet">
        <div className="meet-head">
          <h2>People to meet this week</h2>
          <p className="quiet">Every deal grows your network, and so does one good coffee. These are the people who sit next to several of your buyers.</p>
          <div className="pills"><button className="pill solid" onClick={() => { sendWs({type: 'task', kind: 'chat', text: MEET}); setAskedMeet(true); }}>Find people to meet</button>
            {askedMeet && <span className="quiet small">{agentOn ? 'Asked the agent. Suggestions appear here.' : 'Queued. It starts when the agent is running.'}</span>}</div>
        </div>
        {supers.length > 0 && <div className="supers">
          <h3>Your super-connectors</h3>
          {supers.map(({contact: c, leads: ls}) => (
            <div key={c.id} className="super-row">
              <span className="sr-name">{c.name} <OriginTag c={c} /></span>
              <span className="quiet">{[c.position, c.company].filter(Boolean).join(', ')}</span>
              <span>opens <b>{ls.length}</b> {ls.length === 1 ? 'lead' : 'leads'}: {ls.slice(0, 3).join(', ')}{ls.length > 3 ? '…' : ''}</span>
            </div>))}
        </div>}
        {toMeet.length > 0 && <div className="connectors">{toMeet.map((c) => (
          <div key={c.id} className="connector">
            <h3>{c.name}</h3>
            <div className="quiet small">{c.title}, {c.company}</div>
            <p>{c.why}</p>
            {c.unlocks.length > 0 && <p className="small"><span className="quiet">Could open:</span> {c.unlocks.join(', ')}</p>}
            {c.sources.length > 0 && <p className="small quiet">{c.sources.map((x, i) => <a key={i} className="u" href={x.url} target="_blank" rel="noreferrer">{x.title ?? host(x.url)}</a>).reduce<React.ReactNode[]>((a, el, i) => (i ? [...a, ' · ', el] : [el]), [])}</p>}
            <div className="pills"><button className="pill sm solid" onClick={() => sendWs({type: 'connector', id: c.id, action: 'done'})}>I've met them</button><button className="link" onClick={() => sendWs({type: 'connector', id: c.id, action: 'dismissed'})}>Not now</button></div>
          </div>))}
        </div>}
        {!supers.length && !toMeet.length && <p className="quiet">No suggestions yet. Ask the agent to find some.</p>}
      </section>

      {moves.length > 0 && <section className="moves" id="moves">
        <h2>Moves</h2>
        <p className="quiet">Your connections changing jobs. A move into a company you want is a fresh way in.</p>
        {moves.map((m, i) => (
          <div key={i} className={`move ${m.intoTarget ? 'target' : ''}`}>
            <span className="mv-name">{m.name}</span>
            <span className="mv-to"><Icon name="arrow-right" size={15} /> {m.to}{m.position && `, ${m.position}`}{m.intoTarget && <span className="joined">target company</span>}</span>
            <span className="quiet small">from {m.from || 'unknown'} · {new Date(m.at).toLocaleDateString([], {month: 'short', day: 'numeric'})} · <a className="u" href={m.source} target="_blank" rel="noreferrer">{host(m.source)}</a></span>
          </div>))}
      </section>}

      <section className="net-setup">
        <div className="paper-wrap"><div className="paper-back" />
          <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
            <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
            {f.network.length ? <><span className="drop-num">{f.network.length}</span><span>connections, {withCo.length} with a company</span>{f.networkFile && <span className="quiet small">{f.networkFile} · drop a new file to replace</span>}</>
              : <><span className="drop-title">Drop Connections.csv</span><span className="quiet small">or click to choose a file</span></>}
          </label>
        </div>
        <div className="net-text">
          <h3>Your connections</h3>
          <p>From LinkedIn's <a className="u" href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">Download your data</a> page: choose the larger archive, then drop <code>Connections.csv</code> here. <a className="u" href="#/start/2">Step-by-step</a></p>
          <p className="small">No export yet? <a className="u" href="#" onClick={async (e) => { e.preventDefault(); const t = await fetch('/sample-connections.csv').then((r) => r.text()); await upload(new File([t], 'sample-connections.csv')); }}>Use a sample network</a></p>
          <h3 className="mt">Your background</h3>
          <label className="lbl">Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Akim" /></label>
          <label className="lbl">Schools<input value={schools} onChange={(e) => setSchools(e.target.value)} placeholder="Northeastern University" /></label>
          <label className="lbl">Past companies<input value={past} onChange={(e) => setPast(e.target.value)} placeholder="Comma separated" /></label>
          <label className="lbl">Communities, accelerators, events, podcasts<input value={comms} onChange={(e) => setComms(e.target.value)} placeholder="e.g. YC W24, Lenny's community, Config 2025" /></label>
          <div className="pills"><button className="pill solid" onClick={saveBg}>Save</button><span className="quiet small">{msg}</span></div>
        </div>
      </section>

      {needs.length > 0 && <section className="needs">
        <div className="needs-head">
          <div>
            <h2>Needs a company</h2>
            <p className="quiet">{needs.length ? `${needs.length} of ${f.network.length} connections have no current company, so they can't open a path yet. Fill in the ones you know, or let the agent look them up from public profiles.` : `Every connection has a company${byAgent ? `; the agent found ${byAgent} of them` : ''}.`}</p>
          </div>
          {needs.length > 0 && <div className="pills">
            <button className="pill solid" onClick={() => { sendWs({type: 'task', kind: 'chat', text: LOOKUP}); setAsked(true); }}>Look them up</button>
            <span className="quiet small">{asked ? (agentOn ? 'Asked the agent. Companies fill in as it finds them.' : 'Queued. It starts when the agent is running.') : byAgent ? `${byAgent} found by the agent so far` : ''}</span>
          </div>}
        </div>
        {needs.length > 0 && <div className="needs-list">
          {needs.slice(0, showAll ? 500 : 12).map((c) => <NeedsRow key={c.id} c={c} />)}
          {needs.length > 12 && <div className="center mt"><button className="pill" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${needs.length}`}</button></div>}
        </div>}
      </section>}
    </div>
  );
}
