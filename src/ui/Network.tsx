// The founder's own network: LinkedIn Connections.csv + background, and the warm paths it opens up.
import {Fragment, useEffect, useState} from 'react';
import {post, useLink} from '../link';
import {leads} from '../../shared/logic';
import {Tier} from './Leads';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function NetworkView() {
  const {db} = useLink();
  const f = db.founder;
  const [name, setName] = useState(f.name), [schools, setSchools] = useState(f.schools.join(', ')), [past, setPast] = useState(f.pastCompanies.join(', '));
  const [msg, setMsg] = useState('');
  useEffect(() => { setName(f.name); setSchools(f.schools.join(', ')); setPast(f.pastCompanies.join(', ')); }, [f.name, f.schools.join(), f.pastCompanies.join()]);
  const saveBg = () => post('/api/network', {name, schools: list(schools), pastCompanies: list(past)}).then(() => setMsg('Saved.'));
  const upload = async (file: File) => {
    const r = await post('/api/network', {csv: await file.text(), fileName: file.name, name, schools: list(schools), pastCompanies: list(past)});
    setMsg(r.error ?? `Imported ${r.added} connections.`);
  };
  const warm = leads(db).filter((l) => l.paths.length);
  const companies = new Map<string, number>();
  for (const c of f.network) companies.set(c.company, (companies.get(c.company) ?? 0) + 1);
  return (
    <div className="network">
      <div className="grid2">
        <div className="card">
          <h3>Your network</h3>
          <p className="muted small">Nothing to log into. Download your own data from LinkedIn (Settings → Data privacy → Get a copy of your data → Connections) and drop <code>Connections.csv</code> here. It stays on this machine.</p>
          <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
            <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
            {f.network.length ? <><b>{f.network.length}</b> connections at <b>{companies.size}</b> companies{f.networkFile && <div className="muted small">{f.networkFile}</div>}</> : 'Drop Connections.csv or click to choose'}
          </label>
          <div className="muted small">No export yet? <a href="#" onClick={async (e) => { e.preventDefault(); const t = await fetch('/sample-connections.csv').then((r) => r.text()); await upload(new File([t], 'sample-connections.csv')); }}>Use a sample network</a></div>
        </div>
        <div className="card">
          <h3>Your background</h3>
          <label className="lbl">Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Akim" /></label>
          <label className="lbl">Schools<input value={schools} onChange={(e) => setSchools(e.target.value)} placeholder="Northeastern University" /></label>
          <label className="lbl">Past companies<input value={past} onChange={(e) => setPast(e.target.value)} placeholder="comma separated" /></label>
          <button className="primary" onClick={saveBg}>Save</button> <span className="muted small">{msg}</span>
        </div>
      </div>
      <h3>Warm paths <span className="muted">({warm.length} of {db.people.length} leads)</span></h3>
      {warm.length ? <div className="paths">{warm.map((l) => (
        <div key={l.person.id} className="card pathcard">
          <div className="hops big">{l.paths[0].hops.map((h, j) => <Fragment key={j}>{j > 0 && <span className="arrow">→</span>}<span className={`hop ${j === 0 ? 'me' : j === l.paths[0].hops.length - 1 ? 'buyer' : 'via'}`}>{h}</span></Fragment>)}</div>
          <div className="muted small">{l.paths[0].text}</div>
          <div className="row-between small"><span>{l.person.title} · {l.company?.name}</span><Tier tier={l.tier} score={l.score} /></div>
        </div>))}</div>
        : <div className="muted">{f.network.length ? 'No overlaps with the current leads yet. More leads, more chances.' : 'Add your network to find warm paths.'}</div>}
    </div>
  );
}
