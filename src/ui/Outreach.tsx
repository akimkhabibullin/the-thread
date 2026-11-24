// Module 4's gate: every drafted sequence waits here. Claims link to their proof; the founder approves, edits or rejects.
import {Fragment, useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Claim, Draft, Touch} from '../../shared/types';
import {Tier} from './Leads';

/** Underline every claim in the text and link it to its source. */
function WithProof({text, claims}: {text: string; claims: Claim[]}) {
  const parts: React.ReactNode[] = [];
  let rest = text, k = 0;
  while (rest) {
    let best: {i: number; c: Claim} | null = null;
    for (const c of claims) { const i = rest.indexOf(c.text); if (i >= 0 && (!best || i < best.i)) best = {i, c}; }
    if (!best) { parts.push(rest); break; }
    parts.push(rest.slice(0, best.i));
    parts.push(<a key={k++} className="claim" href={best.c.url} target="_blank" rel="noreferrer" title={best.c.url}>{best.c.text}</a>);
    rest = rest.slice(best.i + best.c.text.length);
  }
  return <>{parts}</>;
}

function DraftCard({d}: {d: Draft}) {
  const {db} = useLink();
  const lead = leads(db).find((l) => l.person.id === d.personId);
  const via = db.founder.network.find((c) => c.id === d.viaContactId);
  const [edit, setEdit] = useState<Touch[] | null>(null);
  const r = d.review;
  return (
    <div className={`card draft ${d.status}`}>
      <div className="row-between">
        <div>
          <span className={`kind ${d.kind}`}>{d.kind === 'intro_request' ? `Intro request via ${via?.name ?? 'connection'}` : 'Cold sequence'}</span>
          <span className="chip">variant {d.variant}</span>
          <b> {lead?.person.name}</b> <span className="muted">{lead?.person.title} · {lead?.company?.name}</span>
        </div>
        {lead && <Tier tier={lead.tier} score={lead.score} />}
      </div>
      <div className="angle">Angle: {d.angle}</div>
      {r ? <div className={`review ${r.verdict}`}>
        <b>Proof {r.proofScore}%</b> · {r.by} {r.verdict === 'pass' ? 'checked every claim' : 'flagged this draft'}{r.note && `: ${r.note}`}
        {r.unsupported.length > 0 && <ul>{r.unsupported.map((u, i) => <li key={i}>Unsupported: “{u}”</li>)}</ul>}
      </div> : <div className="review none">Waiting for the reviewer…</div>}
      {(edit ?? d.touches).map((t, i) => (
        <div key={i} className="touch">
          <div className="muted small">Day {t.day} · {t.channel}{t.to && ` · to ${t.to}`}</div>
          {edit ? <>
            {t.channel === 'email' && <input value={t.subject ?? ''} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, subject: e.target.value} : x)))} />}
            <textarea rows={6} value={t.body} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, body: e.target.value} : x)))} />
          </> : <>
            {t.subject && <div className="subject">{t.subject}</div>}
            <div className="body"><WithProof text={t.body} claims={d.claims} /></div>
          </>}
        </div>
      ))}
      {d.status === 'pending' ? <div className="opts">
        {edit ? <>
          <button className="primary" onClick={() => { sendWs({type: 'draft', id: d.id, action: 'edit', touches: edit}); setEdit(null); }}>Save edits</button>
          <button onClick={() => setEdit(null)}>Cancel</button>
        </> : <>
          <button className="primary" onClick={() => sendWs({type: 'draft', id: d.id, action: 'approve'})}>Approve & queue</button>
          <button onClick={() => setEdit(d.touches.map((t) => ({...t})))}>Edit</button>
          <button className="danger" onClick={() => { const reason = prompt('Why reject it? (helps the agent learn; optional)'); if (reason !== null) sendWs({type: 'draft', id: d.id, action: 'reject', reason}); }}>Reject</button>
        </>}
      </div> : <div className="muted small">{d.status === 'approved' ? `Approved${d.editedByFounder ? ' after your edits' : ''} → queued (not actually sent in this prototype)` : `Rejected${d.rejectReason ? `: ${d.rejectReason}` : ''}`}</div>}
    </div>
  );
}

export function OutreachView() {
  const {db} = useLink();
  const [showDone, setShowDone] = useState(false);
  const pending = db.drafts.filter((d) => d.status === 'pending'), done = db.drafts.filter((d) => d.status !== 'pending');
  if (!db.drafts.length) return <div className="empty"><h2>Nothing to approve yet</h2><p>Drafts land here first. Nothing is queued or sent until you approve it.</p></div>;
  return (
    <div>
      <h2>Waiting for you <span className="muted">({pending.length})</span></h2>
      {pending.map((d) => <DraftCard key={d.id} d={d} />)}
      {!pending.length && <div className="muted">All caught up.</div>}
      {done.length > 0 && <Fragment>
        <h3 className="clickable" onClick={() => setShowDone(!showDone)}>{showDone ? '▾' : '▸'} Decided ({done.length})</h3>
        {showDone && done.map((d) => <DraftCard key={d.id} d={d} />)}
      </Fragment>}
    </div>
  );
}
