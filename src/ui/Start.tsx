// Guided setup at #/start/1..4: about you, your network, connect the agent, what you sell. One calm step per screen.
import {useEffect, useState} from 'react';
import {post, sendWs, useLink} from '../link';
import {go, href} from '../route';
import {Burger, Logo} from './Chrome';

const SETUP = ['About you', 'Your network', 'Connect the agent', 'What you sell'] as const;
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const stepFromHash = () => { const n = Number(location.hash.split('/')[2]); return n >= 1 && n <= 4 ? n : 0; };

/** Which setup steps are already done, from the live db. */
export function useSetup() {
  const {db, status, connected} = useLink();
  const done = [!!db.founder.name.trim(), db.founder.network.length > 0, connected && status !== 'offline', !!db.icp];
  const next = done.findIndex((d) => !d) + 1; // 0 when everything is done
  return {done, next};
}
/** Where "Get started" should take you. */
export function useStartHref() {
  const {db} = useLink();
  const {next} = useSetup();
  return {to: next ? `#/start/${next}` : href('brief'), label: db.icp ? 'Continue where you left off' : 'Get started'};
}

function Copy({cmd}: {cmd: string}) {
  const [ok, setOk] = useState(false);
  return (
    <div className="cmd"><code>{cmd}</code>
      <button className="link" onClick={() => { void navigator.clipboard?.writeText(cmd); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

export function Start({onMenu}: {onMenu: () => void}) {
  const {db, status, connected} = useLink();
  const {done, next} = useSetup();
  const [step, setStep] = useState(() => stepFromHash() || next || 1);
  useEffect(() => {
    if (!stepFromHash()) history.replaceState(null, '', `#/start/${step}`);
    const on = () => { const n = stepFromHash(); if (n) setStep(n); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const to = (n: number) => { location.hash = `#/start/${n}`; };

  const f = db.founder;
  const [name, setName] = useState(f.name), [schools, setSchools] = useState(f.schools.join(', ')), [past, setPast] = useState(f.pastCompanies.join(', ')), [comms, setComms] = useState((f.communities ?? []).join(', '));
  useEffect(() => { setName(f.name); setSchools(f.schools.join(', ')); setPast(f.pastCompanies.join(', ')); setComms((f.communities ?? []).join(', ')); }, [f.name, f.schools.join(), f.pastCompanies.join(), (f.communities ?? []).join()]);
  const [msg, setMsg] = useState('');
  const [product, setProduct] = useState('');
  const agentOn = connected && status !== 'offline';

  const upload = async (file: File) => {
    setMsg('Reading…');
    const r = await post('/api/network', {csv: await file.text(), fileName: file.name});
    setMsg(r.error ?? `Imported ${r.added} connections.`);
  };
  const withCo = f.network.filter((c) => c.company?.trim()).length;
  const companies = new Set(f.network.filter((c) => c.company?.trim()).map((c) => c.company)).size;

  const cont = async () => {
    if (step === 1) { await post('/api/network', {name: name.trim(), schools: list(schools), pastCompanies: list(past), communities: list(comms)}); to(2); }
    else if (step === 2 || step === 3) to(step + 1);
    else {
      const t = product.trim();
      if (t) sendWs({type: 'task', text: t, kind: db.icp ? 'chat' : 'intake'});
      go('brief');
    }
  };
  const canContinue = step === 1 ? !!name.trim() : step === 4 ? !!product.trim() || done[3] : true;

  return (
    <div className="start">
      <header className="topbar">
        <div className="tb-left"><Logo /><span className="where"><span className="n">{step} / 4</span>{SETUP[step - 1]}</span></div>
        <div className="tb-right"><a className="link" href={href('home')}>Back to home</a><Burger onClick={onMenu} /></div>
      </header>
      <div className="progress"><i style={{width: `${(step / 4) * 100}%`}} /></div>

      <main className="start-page">
        <ol className="setup-steps">
          {SETUP.map((s, i) => (
            <li key={s}><a href={`#/start/${i + 1}`} className={`${step === i + 1 ? 'on' : ''} ${done[i] ? 'done' : ''}`}>
              <span className="n">{done[i] ? '✓' : i + 1}</span>{s}</a></li>
          ))}
        </ol>

        {step === 1 && <section className="setup">
          <h1>About you<span className="red">.</span></h1>
          <p className="lede">Where you studied and worked is how the agent finds people you have something in common with. A shared school, an old employer or a community you're both in is often the warmest way in.</p>
          {done[0] && <p className="done-note">Done. Change anything you like.</p>}
          <div className="setup-form">
            <label className="lbl">Your name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Akim Khabibullin" /></label>
            <label className="lbl">Schools<input value={schools} onChange={(e) => setSchools(e.target.value)} placeholder="Northeastern University, Lycée 1" /></label>
            <label className="lbl">Past companies<input value={past} onChange={(e) => setPast(e.target.value)} placeholder="Comma separated, e.g. Intercom, Figma" /></label>
            <label className="lbl">Communities, accelerators, events, podcasts<input value={comms} onChange={(e) => setComms(e.target.value)} placeholder="e.g. YC W24, Lenny's community, a podcast you were on" /></label>
          </div>
        </section>}

        {step === 2 && <section className="setup">
          <h1>Your network<span className="red">.</span></h1>
          <p className="lede">Your LinkedIn connections are the map. The agent looks for people you know at each company it finds. The file stays on this machine.</p>
          <div className="setup-two">
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(file); }}>
              <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
              {f.network.length ? <><span className="drop-num">{f.network.length}<i>.</i></span><span>connections at {companies} companies</span><span className="small">{withCo} with a company · {f.network.length - withCo} without</span><span className="quiet small">Drop a new file to replace</span></>
                : <><span className="drop-title">Drop Connections.csv</span><span className="quiet small">or click to choose a file</span></>}
            </label>
            <div>
              <h3>How to get the file</h3>
              <ol className="howto">
                <li>On LinkedIn, click <b>Me</b>, then <b>Settings &amp; Privacy</b>.</li>
                <li>Open <b>Data privacy</b>, then <b>Download your data</b> (<a className="u" href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noreferrer">direct link</a>).</li>
                <li>Choose <b>Download larger data archive</b>. The smaller "select files" list doesn't include connections.</li>
                <li>Click <b>Request archive</b>. It arrives by email; unzip it and drop <code>Connections.csv</code> here.</li>
              </ol>
              <p className="small quiet">From December 2026 LinkedIn's export only has names, profile links and dates, without current companies or titles. If your file has no companies, that's fine: The Thread's agent looks up where your connections work now from their public profiles, and you can fill in the ones you know.</p>
              <p className="small">Waiting for the email? <a className="u" href="#" onClick={async (e) => { e.preventDefault(); const t = await fetch('/sample-connections.csv').then((r) => r.text()); await upload(new File([t], 'sample-connections.csv')); }}>Use a sample network</a> for now.</p>
              {f.network.length > 0 && <p className="small">{withCo} of {f.network.length} have a company{f.network.length - withCo > 0 ? <>; <b>{f.network.length - withCo}</b> still need one. The agent can look them up later, from the <a className="u" href={href('network')}>Network</a> page.</> : '.'}</p>}
              {msg && <p className="quiet small">{msg}</p>}
            </div>
          </div>
        </section>}

        {step === 3 && <section className="setup">
          <h1>Connect the agent<span className="red">.</span></h1>
          <p className="lede">The Thread uses Claude Code as its brain: it does the research, writes the drafts and checks the sources. It runs on your own Claude account, so there is nothing to pay for here.</p>
          <div className="setup-two setup-agent">
            <div>
              <h3>In a terminal</h3>
              <Copy cmd="cd /path/to/the-thread" />
              <Copy cmd="claude" />
              <p className="small">Then, inside Claude Code, type:</p>
              <Copy cmd="/warmpath" />
              <h3 className="mt">Or from any other project</h3>
              <p className="small">Add The Thread as an MCP server, then ask Claude to start it.</p>
              <Copy cmd="claude mcp add --transport http warmpath http://127.0.0.1:5299/mcp" />
            </div>
            <div className="agent-status">
              {agentOn ? <><div className="connected">Connected<i>.</i></div><p>The agent is {status === 'working' ? 'working' : 'listening'}. You can continue.</p></>
                : <><div className="waiting">Waiting for Claude Code<span className="dots">…</span></div>
                  <p className="quiet small">{connected ? 'This page notices the moment it starts listening.' : 'The local bridge is not reachable. Is the dev server running?'} You can continue anyway; your brief will wait until the agent is running.</p></>}
            </div>
          </div>
        </section>}

        {step === 4 && <section className="setup">
          <h1>What are you selling<span className="red">?</span></h1>
          <p className="lede">Two or three sentences, the way you would tell a friend: what it does, who it is for, what it costs.</p>
          {done[3] && <p className="done-note">Done: the agent has a profile for <b>{db.icp?.product}</b>. Write here to tell it something new, or just continue.</p>}
          <div className="composer">
            <textarea rows={5} value={product} onChange={(e) => setProduct(e.target.value)} autoFocus
              placeholder="I built Director, a motion-graphics editor you direct with your voice while an agent does the keyframing. It's for small marketing and brand teams at SaaS companies who need product videos without hiring a motion designer. $49 a seat per month." />
          </div>
          <p className="quiet small">Next you will watch the agent work in the brief. The profile and the first leads fill in as it goes.</p>
        </section>}

        <nav className="setup-nav">
          {step > 1 ? <button className="pill" onClick={() => to(step - 1)}>Back</button> : <a className="pill" href={href('home')}>Back</a>}
          <div className="pills">
            {(step === 2 || step === 3) && !done[step - 1] && <button className="link" onClick={() => to(step + 1)}>Skip for now</button>}
            <button className="pill solid" disabled={!canContinue} onClick={() => void cont()}>{step === 4 ? (product.trim() ? 'Send to the agent' : 'Go to the brief') : 'Continue'}</button>
          </div>
        </nav>
      </main>
    </div>
  );
}
