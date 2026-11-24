// Step 01: talk to the agent. A clear "what now" up top, then the conversation, its questions and its proposed profile changes.
import {useEffect, useRef, useState} from 'react';
import {Icon} from './Icon';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import {href} from '../route';
import {ActionPills, actionsFor, AgentMark, AgentText, readSeen} from './Agent';

const task = (text: string) => sendWs({type: 'task', text, kind: 'chat'});

function WhatNow({focus}: {focus: () => void}) {
  const {db, status, connected} = useLink();
  const agentOn = connected && status !== 'offline';
  const pending = db.drafts.filter((d) => d.status === 'pending');
  const flagged = pending.find((d) => d.review?.verdict === 'fix');
  const best = leads(db).find((l) => !l.excluded);
  const flaggedName = flagged && db.people.find((p) => p.id === flagged.personId)?.name;
  const offline = !agentOn && <p className="wn-note">The agent isn't running, so nothing will happen yet. <a className="u" href="#/start/3">Connect Claude Code</a>, it takes a minute.</p>;

  if (!db.icp) return (
    <div className="whatnow">
      <h2 className="wn-h"><AgentMark size={30} />Tell it what you sell</h2>
      <p>Two or three sentences below: what it does, who it's for, what it costs. The agent turns that into a customer profile, then starts finding people.</p>
      <div className="pills"><button className="pill solid" onClick={focus}>Write it below</button></div>
      {offline}
    </div>
  );
  if (!agentOn) return (
    <div className="whatnow">
      <h2 className="wn-h"><AgentMark size={30} />Start the agent</h2>
      <p>The Thread uses Claude Code to do the research and writing. It isn't running right now, so messages here will wait.</p>
      <div className="pills"><a className="pill solid" href="#/start/3">How to connect it</a></div>
    </div>
  );
  const intros = pending.filter((d) => d.kind === 'intro_request').length;
  const seen = readSeen();
  const newLeads = seen ? db.people.filter((p) => !seen.has(p.id)).length : 0;
  const needCo = db.founder.network.filter((c) => !c.company?.trim()).length;
  const openQ = db.questions.filter((q) => !q.answered).length;
  const steps: {label: string; sub?: string; to: string}[] = [];
  if (openQ) steps.push({label: `Answer ${openQ === 1 ? 'the agent\'s question' : `${openQ} questions`}`, sub: 'just below', to: '#asks'});
  if (pending.length) steps.push({label: `Review ${pending.length} ${pending.length === 1 ? 'draft' : 'drafts'}`, sub: intros ? `${intros} ${intros === 1 ? 'is a warm intro' : 'are warm intros'}` : undefined, to: href('outreach')});
  if (newLeads) steps.push({label: `See ${newLeads} new ${newLeads === 1 ? 'lead' : 'leads'}`, sub: 'since your last visit', to: href('leads')});
  const referral = pending.find((d) => d.kind === 'referral_ask');
  if (referral) steps.unshift({label: `Ask ${db.people.find((p) => p.id === referral.personId)?.name.split(' ')[0] ?? 'your customer'} for intros`, sub: 'your new customer', to: href('outreach')});
  const dayAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const moves = (db.moves ?? []).filter((m) => m.at > dayAgo);
  if (moves.length) steps.push({label: `${moves.length} of your connections changed jobs`, sub: moves.some((m) => m.intoTarget) ? 'some into companies you want' : 'this week', to: href('network') + '#moves'});
  const toMeet = (db.connectors ?? []).filter((c) => c.status === 'open').length;
  if (toMeet) steps.push({label: `Meet ${toMeet} ${toMeet === 1 ? 'person who opens' : 'people who open'} more buyers`, to: href('network') + '#meet'});
  if (needCo) steps.push({label: `Fill in ${needCo} ${needCo === 1 ? 'connection' : 'connections'}`, sub: 'they need a company to open a path', to: href('network')});
  const ideas = (
    <div className="suggest">
      <button onClick={() => task(best ? `Find 10 more leads like ${best.person.name} at ${best.company?.name} (my best lead so far): similar company, same kind of role.` : 'Find 10 more leads that fit the ICP.')}>Find 10 more leads like my best one</button>
      <button onClick={() => task('Suggest one new industry that fits my product, explain why, and find 5 leads there.')}>Try a new industry</button>
      <button onClick={() => task('Refresh hiring, funding and launch signals for the companies in my list, with sources, and re-check where my connections near the ICP work now (job changes).')}>Refresh hiring and funding signals</button>
      {flagged && <button onClick={() => task(`Rewrite the draft for ${flaggedName ?? 'the lead'} that the reviewer flagged, fixing or cutting the unsupported claims.`)}>Rewrite the flagged draft</button>}
    </div>
  );
  if (steps.length) return (
    <div className="whatnow big">
      <h2 className="wn-h"><AgentMark size={30} />{steps.length === 1 ? 'One thing for you now' : `${['', '', 'Two', 'Three'][Math.min(3, steps.length)]} things for you now`}</h2>
      <div className="nextsteps">{steps.slice(0, 3).map((st, i) => (
        <a key={st.label} className="nextstep" href={st.to} onClick={st.to === '#asks' ? (e) => { e.preventDefault(); document.getElementById('asks')?.scrollIntoView({behavior: 'smooth', block: 'center'}); } : undefined}>
          <span className="ns-label">{st.label}{st.sub && <span className="ns-sub"> · {st.sub}</span>}</span><Icon name="arrow-right" size={26} className="ns-arrow" />
        </a>))}
      </div>
      <details className="wn-more"><summary>Or ask it for more</summary>{ideas}</details>
    </div>
  );
  return (
    <div className="whatnow">
      <h2 className="wn-h"><AgentMark size={30} />Keep it finding people</h2>
      <p>You're all caught up. Pick one, or write your own below.</p>
      {ideas}
    </div>
  );
}

export function BriefView() {
  const {db, status} = useLink();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    end.current?.scrollIntoView({block: 'end', behavior: 'smooth'});
  }, [db.chat.length, db.questions.length, db.icpChanges.length]);
  const grow = (el: HTMLTextAreaElement) => { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 8 * 28 + 20)}px`; };
  const submit = () => { const t = text.trim(); if (!t) return; sendWs({type: 'task', text: t, kind: db.icp ? 'chat' : 'intake'}); setText(''); if (box.current) box.current.style.height = ''; };
  const focus = () => { box.current?.focus(); box.current?.scrollIntoView({block: 'center', behavior: 'smooth'}); };
  const openQ = db.questions.filter((q) => !q.answered);
  const openC = db.icpChanges.filter((c) => c.status === 'open');
  return (
    <div className="brief">
      <h1 className="brief-title">Brief</h1>
      <WhatNow focus={focus} />
      {(openQ.length > 0 || openC.length > 0) && <div className="asks" id="asks">
        {openQ.map((q) => (
          <div key={q.qid} className="paper ask">
            <h2 className="ask-q"><AgentMark size={24} /><span>{q.question}</span></h2>
            <p className="quiet small">A question for you{q.agent && !/warmpath|thread/i.test(q.agent) ? ` from the ${q.agent}` : ''}. Pick one, or answer in your own words below.</p>
            <div className="pills">{q.options.map((o) => <button key={o} className="pill" onClick={() => sendWs({type: 'answer', qid: q.qid, text: o})}>{o}</button>)}</div>
          </div>
        ))}
        {openC.map((c) => (
          <div key={c.id} className="paper learn">
            <h2 className="ask-q">{c.change}</h2>
            <p className="quiet">Learned from your rejections: {c.evidence}</p>
            <div className="pills">
              <button className="pill solid" onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'accepted'})}>Yes, update the profile</button>
              <button className="pill" onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'dismissed'})}>No, keep it</button>
            </div>
          </div>
        ))}
      </div>}
      {db.chat.length > 0 && <h2 className="convo-label">Conversation</h2>}
      <div className="convo">
        {db.chat.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            {m.from === 'agent' ? <AgentMark size={28} /> : <div className="who">You</div>}
            <div className="msg-body">
              {m.from === 'agent' ? <AgentText text={m.text} /> : <div className="text">{m.text}</div>}
              <ActionPills actions={actionsFor(m)} />
            </div>
          </div>
        ))}
        {status === 'working' && <div className="working" role="status"><i />The agent is working…</div>}
        <div ref={end} />
      </div>
      <div className="composer">
        <textarea ref={box} rows={3} value={text}
          placeholder={db.icp ? 'Ask for anything: "find leads in fintech", "skip agencies", "make the emails shorter"…' : 'What do you sell? e.g. "I built Director, a motion-graphics editor you direct with your voice. For small SaaS marketing teams. $49 a seat."'}
          onChange={(e) => { setText(e.target.value); grow(e.currentTarget); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <div className="composer-foot"><span className="quiet small">Enter to send · Shift + Enter for a new line</span><button className="pill solid" onClick={submit} disabled={!text.trim()}>Send</button></div>
      </div>
    </div>
  );
}
