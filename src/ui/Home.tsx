// The landing page: what The Thread does, in a few calm screens, with numbers from the current run.
import {useLink} from '../link';
import {leads} from '../../shared/logic';
import {href, STEPS} from '../route';
import {Burger, Logo} from './Chrome';
import {Hops, Num} from './Leads';
import {WithProof} from './Outreach';
import {useStartHref} from './Start';

function Badge() {
  return (
    <a className="badge" href={href('brief')} aria-label="Open the workspace">
      <svg viewBox="0 0 120 120" className="badge-ring" aria-hidden>
        <defs><path id="ring" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
        <text><textPath href="#ring" textLength="286" lengthAdjust="spacing">open the workspace · two people away · </textPath></text>
      </svg>
      <span className="badge-arrow">↓</span>
    </a>
  );
}

function Feature({title, sub, children, art, cta}: {title: string; sub: React.ReactNode; children: React.ReactNode; art: React.ReactNode; cta: {label: string; to: (typeof STEPS)[number]['id']}}) {
  return (
    <section className="feature">
      <h2 className="feature-title">{title}</h2>
      <div className="feature-body">
        <div className="paper-wrap"><div className="paper-back" /><div className="art">{art}</div></div>
        <div className="feature-text">
          <h3>{sub}</h3>
          <p>{children}</p>
          <a className="pill" href={href(cta.to)}>{cta.label}</a>
        </div>
      </div>
    </section>
  );
}

export function Home({onMenu}: {onMenu: () => void}) {
  const {db} = useLink();
  const start = useStartHref();
  const L = leads(db).filter((l) => !l.excluded);
  const fit = db.companies.filter((c) => !c.negative).length;
  const warm = L.filter((l) => l.paths.length);
  const top = L.slice(0, 3);
  const pathLead = warm[0];
  const draft = db.drafts.find((d) => d.claims.length) ?? db.drafts[0];
  const draftBody = draft?.touches[0]?.body ?? '';
  return (
    <div className="home">
      <header className="hero">
        <div className="hero-top"><Logo tone="white" /><Burger onClick={onMenu} light /></div>
        <div className="hero-copy">
          <div>
            <h1>Skip the cold email.<br />Ask someone<br /><span className="red">you know.</span></h1>
            <a className="pill light hero-cta" href={start.to}>{start.label}</a>
          </div>
          <Badge />
        </div>
      </header>

      <section className="intro">
        <p>The Thread is a go-to-market agent for founders. Tell it what you sell. It finds the people most likely to buy, then looks through your own network for someone who can introduce you. It drafts the ask with a source for every claim, and nothing is sent until you say so.</p>
      </section>

      <section className="numbers home-numbers">
        <div className="number-row"><Num n={fit} /><p>{fit === 1 ? 'company that fits' : 'companies that fit'} what you sell, each one found on the public web with a link to where.</p></div>
        <div className="number-row"><Num n={L.length} /><p>{L.length === 1 ? 'buyer' : 'buyers'} named. Real people in the right roles, with the source that says so.</p></div>
        <div className="number-row"><Num n={warm.length} /><p>warm {warm.length === 1 ? 'path' : 'paths'} through people you already know. The shortest way in is usually two people away.</p></div>
        <div className="number-row"><Num n={0} /><p>messages sent without your OK. Every draft waits for you.</p></div>
        <div className="center cta-pair"><a className="pill solid" href={start.to}>{start.label}</a><a className="pill" href={href('brief')}>Open the workspace</a></div>
      </section>

      <Feature title="Find" sub={<>Real buyers,<br />not a list.</>} cta={{label: 'See the leads', to: 'leads'}}
        art={<div className="art-leads">{(top.length ? top : null)?.map((l) => (
          <div key={l.person.id} className="al-row"><Num n={l.score} /><div><div className="strong">{l.person.name}</div><div className="quiet small">{l.person.title}, {l.company?.name}</div></div></div>
        )) ?? <><div className="al-row"><Num n={84} /><div><div className="strong">Head of Growth</div><div className="quiet small">Series A, hiring</div></div></div><div className="al-row"><Num n={71} /><div><div className="strong">VP Marketing</div><div className="quiet small">Just raised</div></div></div></>}</div>}>
        Describe your product in plain words. The agent turns it into a customer profile, says how sure it is about each part, and goes looking for companies and the people there who would actually sign. Every one comes with a link to where it was found.
      </Feature>

      <Feature title="Trace" sub={<>The thread<br />back to you.</>} cta={{label: 'Add your network', to: 'network'}}
        art={<div className="art-path"><Hops hops={pathLead ? pathLead.paths[0].hops.map((h) => h.split(' ')[0]) : ['You', 'Omar', 'Scott']} big /><p className="quiet small">{pathLead ? pathLead.paths[0].text : 'Omar works with Scott. He can introduce you.'}</p></div>}>
        Drop in your LinkedIn connections and a few lines about your background. The agent finds who you know at each company, who used to work with the buyer, and where you share a school or an old employer. It stays on your machine.
      </Feature>

      <Feature title="Write" sub={<>An ask that is<br />easy to forward.</>} cta={{label: 'Review the drafts', to: 'outreach'}}
        art={<div className="art-draft"><div className="quiet small">Intro request</div><p>{draft && draftBody ? <WithProof text={draftBody.length > 240 ? draftBody.slice(0, draftBody.lastIndexOf(' ', 240)) + '…' : draftBody} claims={draft.claims} /> : <>Hi Omar, would you be up for introducing me to Scott? <span className="claim">His team is hiring two motion designers</span>, and what I built cuts that work in half.</>}</p></div>}>
        Where there is a warm path, it writes a short note to your connection with a blurb they can paste. Every factual line is underlined and linked to its source; a second reviewer checks them. You approve, edit or reject. Rejections teach it.
      </Feature>

      {top.length > 0 && <section className="band">
        <h2>From your last run</h2>
        <div className="cards">{top.map((l) => (
          <a key={l.person.id} className="dcard" href={href('leads')} style={{backgroundImage: `url(https://picsum.photos/seed/${encodeURIComponent((l.company?.name ?? l.person.name).toLowerCase())}/800/1000?grayscale)`}}>
            <span className="tag">Tier {l.tier}</span>
            <div className="dcard-bottom">
              <div className="date">{l.company?.industry ?? 'Lead'}</div>
              <h3>{l.person.name}, {l.person.title} at {l.company?.name}</h3>
              <span className="more">{l.paths[0] ? `Warm via ${l.paths[0].hops[1]}` : 'See why'}</span>
            </div>
          </a>))}
        </div>
        <div className="center"><a className="pill" href={href('leads')}>See all leads</a></div>
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
      <div className="f-col"><h4>The work</h4>{STEPS.slice(0, 4).map((s, i) => <a key={s.id} href={href(s.id)}>0{i + 1} {s.title}</a>)}</div>
      <div className="f-col"><h4>&nbsp;</h4>{STEPS.slice(4).map((s, i) => <a key={s.id} href={href(s.id)}>0{i + 5} {s.title}</a>)}</div>
      <div className="f-col"><h4>The rules</h4><span>A source for every claim</span><span>Warm before cold</span><span>Nothing sent without you</span></div>
      <div className="f-col"><h4>This run</h4><span>{db.usage.credits} credits left</span><span>{db.usage.leads_enriched} enriched</span><span>{db.usage.graph_queries} graph queries</span></div>
    </footer>
  );
}
