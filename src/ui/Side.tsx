// Left column: talk to the agent (chat, its questions, its ICP-change proposals) and watch it think.
import {useEffect, useRef, useState} from 'react';
import {ago, sendWs, useLink} from '../link';

export function Side() {
  const {db} = useLink();
  const [text, setText] = useState('');
  const [thinkOpen, setThinkOpen] = useState(true);
  const chatEnd = useRef<HTMLDivElement>(null), thinkEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({block: "end"}); }, [db.chat.length, db.questions.length, db.icpChanges.length]);
  useEffect(() => { thinkEnd.current?.scrollIntoView({block: "end"}); }, [db.thoughts.length]);
  const submit = () => { const t = text.trim(); if (!t) return; sendWs({type: 'task', text: t, kind: db.icp ? 'chat' : 'intake'}); setText(''); };
  const openQ = db.questions.filter((q) => !q.answered);
  const openC = db.icpChanges.filter((c) => c.status === 'open');
  return (
    <aside className="side">
      <section className="chat">
        <h3>Talk to Warmpath</h3>
        <div className="msgs">
          {!db.chat.length && <div className="hint">Describe your product in plain words: what it does, who it's for, what it costs. The agent builds your ideal customer profile from that.</div>}
          {db.chat.map((m, i) => <div key={i} className={`msg ${m.from}`}>{m.text}</div>)}
          {openQ.map((q) => (
            <div key={q.qid} className="card ask">
              <div className="who">{q.agent} asks</div>
              <div>{q.question}</div>
              <div className="opts">{q.options.map((o) => <button key={o} onClick={() => sendWs({type: 'answer', qid: q.qid, text: o})}>{o}</button>)}</div>
            </div>
          ))}
          {openC.map((c) => (
            <div key={c.id} className="card learn">
              <div className="who">learned from your rejections</div>
              <div><b>{c.change}</b></div>
              <div className="muted">{c.evidence}</div>
              <div className="opts">
                <button className="primary" onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'accepted'})}>Yes, update the ICP</button>
                <button onClick={() => sendWs({type: 'icp_change', id: c.id, action: 'dismissed'})}>No, keep it</button>
              </div>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <div className="composer">
          <textarea value={text} placeholder={db.icp ? 'Ask for more leads, a different angle, anything…' : 'e.g. "I built Director, an AI motion-graphics editor you direct with voice…"'}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button className="primary" onClick={submit}>Send</button>
        </div>
      </section>
      <section className={`thinking ${thinkOpen ? '' : 'closed'}`}>
        <h3 onClick={() => setThinkOpen(!thinkOpen)}>Agent thinking <span>{thinkOpen ? '▾' : '▸'}</span></h3>
        {thinkOpen && <div className="feed">
          {db.thoughts.slice(-80).map((t, i) => (
            <div key={i} className="thought"><span className={`agent a-${t.agent}`}>{t.agent}</span><span className="step">{t.step}{t.detail && <span className="detail">{t.detail}</span>}</span><span className="t">{ago(t.at)}</span></div>
          ))}
          {!db.thoughts.length && <div className="hint">The agent's steps show up here as it works.</div>}
          <div ref={thinkEnd} />
        </div>}
      </section>
    </aside>
  );
}
