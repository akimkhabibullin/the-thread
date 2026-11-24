// Step 04: the founder's own network. A dark band with the warm paths, then the file, the background, and contacts that need a company.
import {useEffect, useState} from 'react';
import {post, sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Contact} from '../../shared/types';
import {Hops, Tier} from './Leads';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
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
  const [name, setName] = useState(f.name), [schools, setSchools] = useState(f.schools.join(', ')), [past, setPast] = useState(f.pastCompanies.join(', '));
  const [msg, setMsg] = useState(''), [asked, setAsked] = useState(false), [showAll, setShowAll] = useState(false);
  useEffect(() => { setName(f.name); setSchools(f.schools.join(', ')); setPast(f.pastCompanies.join(', ')); }, [f.name, f.schools.join(), f.pastCompanies.join()]);
  const saveBg = () => post('/api/network', {name, schools: list(schools), pastCompanies: list(past)}).then(() => setMsg('Saved.'));
  const upload = async (file: File) => {
    const r = await post('/api/network', {csv: await file.text(), fileName: file.name, name, schools: list(schools), pastCompanies: list(past)});
    setMsg(r.error ?? `Imported ${r.added} connections.`);
  };
  const warm = leads(db).filter((l) => l.paths.length);
  const withCo = f.network.filter((c) => c.company?.trim());
  const needs = f.network.filter((c) => !c.company?.trim());
  const byAgent = f.network.filter((c) => c.companySource && c.companySource !== 'founder').length;
  const companies = new Set(withCo.map((c) => c.company)).size;
  const agentOn = connected && status !== 'offline';
  return (
    <div className="network">
      <section className="net-band">
        <div className="net-band-inner">
          <h1>Network</h1>
          <p className="lede">The people you already know are the shortest way in.</p>
          {warm.length > 0 ? <div className="paths">
            <div className="who">{warm.length} warm {warm.length === 1 ? 'path' : 'paths'} · of {db.people.length} leads</div>
            {warm.map((l) => (
              <div key={l.person.id} className="path-row">
                <Hops hops={l.paths[0].hops} big />
                <div className="path-meta"><span>{l.paths[0].text}</span><span className="dim">{l.person.title}, {l.company?.name} · <Tier tier={l.tier} score={l.score} /></span></div>
              </div>))}
          </div> : <p className="dim center">{f.network.length ? 'No overlaps with the current leads yet. More leads, more chances.' : 'Add your connections below to find warm paths.'}</p>}
          <div className="net-stats">
            <div><span className="big">{f.network.length}<i>.</i></span>connections</div>
            <div><span className="big">{companies}<i>.</i></span>companies</div>
            <div><span className="big">{needs.length}<i>.</i></span>need a company</div>
          </div>
        </div>
      </section>

      <section className="net-setup">
        <div className="paper-wrap"><div className="paper-back" />
          <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
            <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
            {f.network.length ? <><span className="drop-num">{f.network.length}<i>.</i></span><span>connections, {withCo.length} with a company</span>{f.networkFile && <span className="quiet small">{f.networkFile} · drop a new file to replace</span>}</>
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
