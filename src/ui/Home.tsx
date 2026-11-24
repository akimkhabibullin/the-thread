// The landing page. One image carries it: your real warm path, drawn as a red thread across the dark hero,
// with the working form right under it. Below, the same thread stitches down through how it works.
import {useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import {go, href, STEPS} from '../route';
import {Burger, Logo} from './Chrome';
import {Hops} from './Leads';
import {WithProof} from './Outreach';
import {useStartHref} from './Start';
import {Icon} from './Icon';

/* The thread runs edge to edge through three people and ties a loop after the buyer, like the mark. */
const THREAD = 'M-20 262 C 70 262, 120 236, 190 236 C 380 236, 520 118, 720 118 C 920 118, 1020 236, 1170 236 C 1265 236, 1318 176, 1292 136 C 1268 100, 1214 128, 1226 176 C 1240 232, 1360 256, 1470 252';
const NODES = [{x: 190, y: 236}, {x: 720, y: 118}, {x: 1170, y: 236}];

function ThreadHero({people}: {people: {name: string; note: string}[]}) {
  return (
    <div className="thread-hero" aria-label={`${people[0].name}, then ${people[1].name}, then ${people[2].name}`}>
      <svg className="thread-svg" viewBox="0 0 1440 340" preserveAspectRatio="none" aria-hidden="true">
        <path className="thread-line" d={THREAD} pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
      {people.map((p, i) => (
        <div key={i} className={`th-node th-${i}`} style={{left: `${(NODES[i].x / 1440) * 100}%`, top: `${(NODES[i].y / 340) * 100}%`}}>
          <i />
          <div className="th-label"><span className="th-name">{p.name}</span><span className="th-note">{p.note}</span></div>
        </div>
      ))}
    </div>
  );
}

function Step({title, sub, children, art, cta}: {title: string; sub: string; children: React.ReactNode; art: React.ReactNode; cta: {label: string; to: (typeof STEPS)[number]['id']}}) {
  return (
    <section className="hw-step">
      <span className="hw-knot" aria-hidden="true" />
      <h2>{title}</h2>
      <div className="hw-body">
        <h3>{sub}</h3>
        <p>{children}</p>
        <a className="textlink" href={href(cta.to)}>{cta.label}<Icon name="arrow-right" size={16} /></a>
      </div>
      <div className="hw-art">{art}</div>
    </section>
  );
}

export function Home({onMenu}: {onMenu: () => void}) {
  const {db} = useLink();
  const start = useStartHref();
  const [what, setWhat] = useState('');
  const L = leads(db).filter((l) => !l.excluded);
  const fit = db.companies.filter((c) => !c.negative).length;
  const warm = L.filter((l) => l.paths.length);
  const top = L.slice(0, 3);
  const pathLead = warm.find((l) => l.paths[0].viaContactId) ?? warm[0];
  const via = pathLead && db.founder.network.find((c) => c.id === pathLead.paths[0].viaContactId);
  const people = pathLead ? [
    {name: pathLead.paths[0].hops[0], note: 'you'},
    {name: pathLead.paths[0].hops[1], note: via ? `your connection, ${[via.position, via.company].filter(Boolean).join(' at ')}` : 'you have this in common'},
    {name: pathLead.paths[0].hops[2], note: `${pathLead.person.title}, ${pathLead.company?.name ?? ''}`},
  ] : [{name: 'You', note: 'you'}, {name: 'Omar', note: 'your old colleague'}, {name: 'Scott', note: 'the buyer, Creative Director'}];
  const draft = db.drafts.find((d) => d.claims.length) ?? db.drafts[0];
  const draftBody = draft?.touches[0]?.body ?? '';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = what.trim(); if (!t) return;
    sendWs({type: 'task', text: t, kind: db.icp ? 'chat' : 'intake'});
    go('brief');
  };
  return (
    <div className="home">
      <header className="hero">
        <div className="hero-top"><Logo tone="white" /><Burger onClick={onMenu} light /></div>
        <ThreadHero people={people} />
        <div className="hero-copy">
          <h1>Your next customer is two people away.</h1>
          <p className="hero-sub">The Thread finds the people who would buy what you sell, then the person in your own network who can introduce you. It drafts the ask with a source for every claim. Nothing goes out until you approve it.</p>
          {db.icp ? <div className="hero-actions">
            <a className="btn primary on-dark" href={start.to}>{start.label}<Icon name="arrow-right" size={16} /></a>
            <a className="btn on-dark" href={href('leads')}>See the leads</a>
          </div> : <form className="hero-form" onSubmit={submit}>
            <label htmlFor="what">What do you sell?</label>
            <div className="hf-row">
              <input id="what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="A motion-graphics editor for small SaaS marketing teams, $49 a seat" />
              <button className="btn primary on-dark" disabled={!what.trim()}>Find my buyers<Icon name="arrow-right" size={16} /></button>
            </div>
            <a className="hf-alt" href={start.to}>Or set it up step by step</a>
          </form>}
          {L.length > 0 && <p className="hero-proof">Last run: <b>{fit}</b> companies that fit, <b>{L.length}</b> named buyers, <b>{warm.length}</b> warm {warm.length === 1 ? 'path' : 'paths'}, and <b>0</b> messages sent without your OK.</p>}
        </div>
      </header>

      <div className="how">
        <Step title="Find" sub="Real buyers, not a list." cta={{label: 'See the leads', to: 'leads'}}
          art={<div className="art-leads">{(top.length ? top : null)?.map((l) => (
            <div key={l.person.id} className="al-row"><span className="al-score">{l.score}</span><div><div className="strong">{l.person.name}</div><div className="quiet small">{l.person.title}, {l.company?.name}</div></div></div>
          )) ?? <><div className="al-row"><span className="al-score">84</span><div><div className="strong">Head of Growth</div><div className="quiet small">Series A, hiring</div></div></div></>}</div>}>
          Describe your product in plain words. The agent turns it into a customer profile, says how sure it is about each part, and looks for the companies and people who would actually sign. Each one links to where it was found.
        </Step>
        <Step title="Trace" sub="The thread back to you." cta={{label: 'Add your network', to: 'network'}}
          art={<div className="art-path"><Hops hops={people.map((p) => p.name.split(' ')[0])} big /><p className="quiet small">{pathLead ? pathLead.paths[0].text : 'Omar works with Scott. He can introduce you.'}</p></div>}>
          Add your LinkedIn connections and a few lines about your background. The agent finds who you know at each company, who used to work with the buyer, and where you share a school, an old employer or a community. It stays on your machine.
        </Step>
        <Step title="Write" sub="An ask that is easy to forward." cta={{label: 'Review the drafts', to: 'outreach'}}
          art={<div className="art-draft"><div className="quiet small">Intro request</div><p>{draft && draftBody ? <WithProof text={draftBody.length > 240 ? draftBody.slice(0, draftBody.lastIndexOf(' ', 240)) + '…' : draftBody} claims={draft.claims} /> : <>Hi Omar, would you be up for introducing me to Scott? <span className="claim">His team is hiring two motion designers</span>, and what I built cuts that work in half.</>}</p></div>}>
          Where there is a warm path, it writes a short note to your connection with a blurb they can paste. Every factual line is underlined and linked to its source, and a second reviewer checks them. You approve, edit or reject; rejections teach it.
        </Step>
        <section className="hw-step hw-last">
          <span className="hw-knot" aria-hidden="true" />
          <h2>Grow</h2>
          <div className="hw-body">
            <h3>Every deal grows your network.</h3>
            <dl className="grows-list">
              <div><dt>Referrals</dt><dd>Close a deal and your new customer joins your network. The agent drafts a short ask for one or two intros.</dd></div>
              <div><dt>Job changes</dt><dd>When a connection moves to a company you want, you hear about it, with the source.</dd></div>
              <div><dt>Communities</dt><dd>Accelerators, events, podcasts. A shared one counts as a path, even off LinkedIn.</dd></div>
              <div><dt>People to meet</dt><dd>Each week, a few people who sit next to several of your buyers.</dd></div>
            </dl>
            <a className="textlink" href={href('network')}>See your network<Icon name="arrow-right" size={16} /></a>
          </div>
        </section>
      </div>

      {top.length > 0 && <section className="band">
        <h2>From your last run</h2>
        <div className="cards">{top.map((l) => (
          <a key={l.person.id} className="dcard" href={href('leads')} style={{backgroundImage: `url(https://picsum.photos/seed/${encodeURIComponent((l.company?.name ?? l.person.name).toLowerCase())}/800/1000?grayscale)`}}>
            <span className="tag">Tier {l.tier}</span>
            <div className="dcard-bottom">
              <h3>{l.person.name}, {l.person.title} at {l.company?.name}</h3>
              <div className="date">{l.company?.industry ?? 'Lead'}</div>
              <span className="more">{l.paths[0] ? `Warm via ${l.paths[0].hops[1]}` : 'See why'}</span>
            </div>
          </a>))}
        </div>
        <div className="center"><a className="btn" href={href('leads')}>See all leads</a></div>
      </section>}

      <Footer />
    </div>
  );
}

export function Footer() {
  const {db} = useLink();
  return (
    <footer className="footer">
      <div className="f-mark"><img src="/brand/thread-mark-red.png" alt="The Thread" /></div>
      <div className="f-col"><h4>The work</h4>{STEPS.slice(0, 4).map((s) => <a key={s.id} href={href(s.id)}>{s.title}</a>)}</div>
      <div className="f-col"><h4>And after</h4>{STEPS.slice(4).map((s) => <a key={s.id} href={href(s.id)}>{s.title}</a>)}</div>
      <div className="f-col"><h4>The rules</h4><span>A source for every claim</span><span>Warm before cold</span><span>Nothing sent without you</span></div>
      <div className="f-col"><h4>This run</h4><span className="tnum">{db.usage.credits} credits left</span><span className="tnum">{db.usage.leads_enriched} enriched</span><span className="tnum">{db.usage.graph_queries} graph queries</span></div>
    </footer>
  );
}
