// Step 01: talk to the agent. The conversation, its questions, and the profile changes it proposes after rejections.
import {useEffect, useRef, useState} from 'react';
import {sendWs, useLink} from '../link';
import {PageHead} from './Chrome';

export function BriefView() {
  const {db} = useLink();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    end.current?.scrollIntoView({block: 'end', behavior: 'smooth'});
  }, [db.chat.length, db.questions.length, db.icpChanges.length]);
  const submit = () => { const t = text.trim(); if (!t) return; sendWs({type: 'task', text: t, kind: db.icp ? 'chat' : 'intake'}); setText(''); };
  const openQ = db.questions.filter((q) => !q.answered);
  const openC = db.icpChanges.filter((c) => c.status === 'open');
  return (
    <div className="brief">
      <PageHead title={db.icp ? 'Brief' : 'What are you selling?'}
        lede={db.icp ? 'Your conversation with the agent. Ask for more leads, a different angle, or tell it what it got wrong.' : 'Describe it the way you would to a friend: what it does, who it is for, what it costs. The agent turns that into a customer profile.'} />
      <div className="convo">
        {db.chat.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            <div className="who">{m.from === 'agent' ? 'The Thread' : 'You'}</div>
            <div className="text">{m.text}</div>
          </div>
        ))}
        {openQ.map((q) => (
          <div key={q.qid} className="paper ask">
            <div className="who">{q.agent} asks</div>
            <h3>{q.question}</h3>
            <div className="pills">{q.options.map((o) => <button key={o} className="pill" onClick={() => sendWs({type: 'answer', qid: q.qid, text: o})}>{o}</button>)}</div>
          </div>
        ))}
        {openC.map((c) => (
          <div key={c.id} className="paper learn">
            <div className="who">Learned from your rejections</div>
            <h3>{c.change}</h3>
            <p className="quiet">{c.evidence}</p>
            <div className="pills">
              <button className="pill solid" onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'accepted'})}>Yes, update the profile</button>
              <button className="pill" onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'dismissed'})}>No, keep it</button>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="composer">
        <textarea rows={3} value={text} placeholder={db.icp ? 'Find ten more like the top lead…' : 'I built Director, a motion-graphics editor you direct with your voice…'}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <div className="composer-foot"><span className="quiet small">Enter to send · Shift + Enter for a new line</span><button className="pill solid" onClick={submit} disabled={!text.trim()}>Send</button></div>
      </div>
    </div>
  );
}
