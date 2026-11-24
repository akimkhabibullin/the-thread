// Step 04: the founder's own network (LinkedIn Connections.csv + background) and the warm paths it opens up.
import {useEffect, useState} from 'react';
import {post, useLink} from '../link';
import {leads} from '../../shared/logic';
import {PageHead} from './Chrome';
import {Hops, Tier} from './Leads';

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
      <PageHead title="Network" lede="The people you already know are the shortest way in. Add your connections and your background; nothing leaves this machine." />

      {warm.length > 0 && <section className="paths">
        <h2 className="center">{warm.length} warm {warm.length === 1 ? 'path' : 'paths'}<span className="quiet"> of {db.people.length} leads</span></h2>
        {warm.map((l) => (
          <div key={l.person.id} className="path-row">
            <Hops hops={l.paths[0].hops} big />
            <div className="path-meta"><span>{l.paths[0].text}</span><span className="quiet">{l.person.title}, {l.company?.name} · <Tier tier={l.tier} score={l.score} /></span></div>
          </div>))}
      </section>}
      {!warm.length && <p className="quiet center">{f.network.length ? 'No overlaps with the current leads yet. More leads, more chances.' : 'Add your network below to find warm paths.'}</p>}

      <section className="net-setup">
        <div className="paper-wrap"><div className="paper-back" />
          <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
            <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
            {f.network.length ? <><span className="drop-num">{f.network.length}<i>.</i></span><span>connections at {companies.size} companies</span>{f.networkFile && <span className="quiet small">{f.networkFile} · drop a new file to replace</span>}</>
              : <><span className="drop-title">Drop Connections.csv</span><span className="quiet small">or click to choose a file</span></>}
          </label>
        </div>
        <div className="net-text">
          <h3>Your connections</h3>
          <p>Nothing to log into. On LinkedIn go to Settings, Data privacy, Get a copy of your data, Connections. Drop the file here.</p>
          <p className="small">No export yet? <a className="u" href="#" onClick={async (e) => { e.preventDefault(); const t = await fetch('/sample-connections.csv').then((r) => r.text()); await upload(new File([t], 'sample-connections.csv')); }}>Use a sample network</a></p>
          <h3 className="mt">Your background</h3>
          <label className="lbl">Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Akim" /></label>
          <label className="lbl">Schools<input value={schools} onChange={(e) => setSchools(e.target.value)} placeholder="Northeastern University" /></label>
          <label className="lbl">Past companies<input value={past} onChange={(e) => setPast(e.target.value)} placeholder="Comma separated" /></label>
          <div className="pills"><button className="pill solid" onClick={saveBg}>Save</button><span className="quiet small">{msg}</span></div>
        </div>
      </section>
    </div>
  );
}
