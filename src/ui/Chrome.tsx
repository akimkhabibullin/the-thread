// The frame around every page: logo, hamburger menu panel, quiet status line, agent feed, page heads and step links.
import {useEffect, useRef, useState} from 'react';
import {ago, post, useLink} from '../link';
import {href, pad, Route, STEPS, StepId} from '../route';
import {useStartHref} from './Start';

export function Logo({tone = 'red', words = true}: {tone?: 'red' | 'white' | 'black'; words?: boolean}) {
  return (
    <a className={`logo logo-${tone}`} href={href('home')} aria-label="The Thread, home">
      <img src={`/brand/thread-mark-${tone}.png`} alt="" />
      {words && <span className="wordmark">The<br />Thread</span>}
    </a>
  );
}

export const Burger = ({onClick, light}: {onClick: () => void; light?: boolean}) => (
  <button className={`burger ${light ? 'light' : ''}`} onClick={onClick} aria-label="Open menu"><i /><i /><i /></button>
);

export function agentLabel(connected: boolean, status: string) {
  if (!connected) return 'offline';
  if (status === 'offline') return 'not running';
  return status === 'listening' ? 'listening' : 'working';
}

export function Menu({open, onClose, route}: {open: boolean; onClose: () => void; route: Route}) {
  const {db, status, connected} = useLink();
  const start = useStartHref();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  const act = (f: () => unknown) => () => { f(); onClose(); };
  return (
    <div className={`menu-wrap ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="menu-veil" onClick={onClose} />
      <nav className="menu-panel">
        <div className="menu-top"><Logo words={false} /><button className="close" onClick={onClose} aria-label="Close menu">×</button></div>
        <ol className="menu-steps">
          {STEPS.map((s) => (
            <li key={s.id}><a href={href(s.id)} onClick={onClose} className={route === s.id ? 'on' : ''}>{s.title}</a></li>
          ))}
        </ol>
        <a className="pill solid menu-start" href={start.to} onClick={onClose}>{start.label}</a>
        <div className="menu-small">
          <a href={href('home')} onClick={onClose}>Home</a>
          <button onClick={act(() => post('/api/demo/save'))}>Save demo snapshot</button>
          <button onClick={act(() => post('/api/demo/load'))}>Load demo snapshot</button>
          <button onClick={act(() => confirm('Clear the profile, leads and drafts? (your network stays)') && post('/api/reset'))}>Start over</button>
        </div>
        <div className="menu-lines">
          <span>Agent <u>{agentLabel(connected, status)}</u></span>
          <span><u>{db.usage.credits} credits</u> left</span>
          {(!connected || status === 'offline') && <span className="hint">Run <code>/warmpath</code> in Claude Code to start the agent.</span>}
        </div>
      </nav>
    </div>
  );
}

export function Feed({open, onClose}: {open: boolean; onClose: () => void}) {
  const {db, status, connected} = useLink();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) end.current?.scrollIntoView({block: 'end'}); }, [db.thoughts.length, open]);
  return (
    <aside className={`feed ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="feed-top"><span>What the agent is doing <em>· {agentLabel(connected, status)}</em></span><button className="close" onClick={onClose} aria-label="Close">×</button></div>
      <div className="feed-list">
        {db.thoughts.slice(-80).map((t, i) => (
          <div key={i} className="thought">
            <div className="meta">{t.agent} · {ago(t.at)} ago</div>
            <div>{t.step}</div>
            {t.detail && <div className="detail">{t.detail}</div>}
          </div>
        ))}
        {!db.thoughts.length && <p className="quiet">Its steps show up here while it works.</p>}
        <div ref={end} />
      </div>
    </aside>
  );
}

/** One quiet line: logo, where you are, usage, agent toggle, menu. */
export function TopBar({route, onMenu, onFeed, feedOpen}: {route: StepId; onMenu: () => void; onFeed: () => void; feedOpen: boolean}) {
  const {db, status, connected} = useLink();
  const i = STEPS.findIndex((s) => s.id === route);
  const u = db.usage;
  const label = agentLabel(connected, status);
  return (
    <header className="topbar">
      <div className="tb-left">
        <Logo />
        <span className="where"><span className="n">{pad(i + 1)} / {pad(STEPS.length)}</span>{STEPS[i].title}</span>
      </div>
      <div className="tb-right">
        <span className="usage" title="Enrichment credits are metered with Flexprice">{u.credits} credits · {u.leads_enriched} enriched · {u.outreach_sent} queued · {u.graph_queries} graph queries</span>
        <button className={`agent-toggle ${label} ${feedOpen ? 'on' : ''}`} onClick={onFeed}><i />Agent · {label}</button>
        <Burger onClick={onMenu} />
      </div>
    </header>
  );
}

export function PageHead({title, lede, children}: {title: string; lede?: React.ReactNode; children?: React.ReactNode}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </div>
  );
}

export function StepLinks({route}: {route: StepId}) {
  const i = STEPS.findIndex((s) => s.id === route);
  const prev = STEPS[i - 1], next = STEPS[i + 1];
  return (
    <nav className="steplinks">
      {prev ? <a href={href(prev.id)}><span className="n">← {pad(i)}</span>{prev.title}</a> : <a href={href('home')}><span className="n">←</span>Home</a>}
      {next ? <a className="next" href={href(next.id)}><span className="n">{pad(i + 2)} →</span>{next.title}</a> : <a className="next" href={href('brief')}><span className="n">01 →</span>Back to the brief</a>}
    </nav>
  );
}

export function Empty({title, children}: {title: string; children: React.ReactNode}) {
  return <div className="empty"><h2>{title}</h2><p>{children}</p></div>;
}

export function useToggle(init = false) {
  const [v, set] = useState(init);
  return [v, () => set((x) => !x), set] as const;
}
