// Step 05: every draft waits here. Claims link to their proof; the founder approves, edits or rejects.
import {useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import type {Claim, Draft, Touch} from '../../shared/types';
import {Empty, PageHead} from './Chrome';
import {Num, Tier} from './Leads';

/** Underline every claim in the text and link it to its source. */
export function WithProof({text, claims}: {text: string; claims: Claim[]}) {
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
    <article className={`draft ${d.status}`}>
      <aside className="draft-side">
        <div className="who">{d.kind === 'intro_request' ? `Intro via ${via?.name ?? 'a connection'}` : 'Cold sequence'} · variant {d.variant}</div>
        <h3>{lead?.person.name}</h3>
        <div className="quiet">{lead?.person.title}<br />{lead?.company?.name}</div>
        {lead && <div className="small mt-s"><Tier tier={lead.tier} score={lead.score} /></div>}
        <div className="proof">
          {r ? <><Num n={r.proofScore} /><div className="small">proof · {r.by} {r.verdict === 'pass' ? 'checked every claim' : 'flagged this'}</div></> : <div className="quiet small">Waiting for the reviewer</div>}
        </div>
        <div className="quiet small">Angle: {d.angle}</div>
      </aside>
      <div className="draft-main">
        {r && (r.note || r.unsupported.length > 0) && <div className={`review ${r.verdict}`}>
          {r.note && <div>{r.note}</div>}
          {r.unsupported.map((u, i) => <div key={i}>Unsupported: “{u}”</div>)}
        </div>}
        {(edit ?? d.touches).map((t, i) => (
          <div key={i} className="touch">
            <div className="quiet small">Day {t.day} · {t.channel}{t.to && ` · to ${t.to}`}</div>
            {edit ? <>
              {t.channel === 'email' && <input value={t.subject ?? ''} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, subject: e.target.value} : x)))} />}
              <textarea rows={7} value={t.body} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, body: e.target.value} : x)))} />
            </> : <>
              {t.subject && <div className="subject">{t.subject}</div>}
              <div className="body"><WithProof text={t.body} claims={d.claims} /></div>
            </>}
          </div>
        ))}
        {d.status === 'pending' ? <div className="pills">
          {edit ? <>
            <button className="pill solid" onClick={() => { sendWs({type: 'draft', id: d.id, action: 'edit', touches: edit}); setEdit(null); }}>Save edits</button>
            <button className="pill" onClick={() => setEdit(null)}>Cancel</button>
          </> : <>
            <button className="pill solid" onClick={() => sendWs({type: 'draft', id: d.id, action: 'approve'})}>Approve and queue</button>
            <button className="pill" onClick={() => setEdit(d.touches.map((t) => ({...t})))}>Edit</button>
            <button className="link red" onClick={() => { const reason = prompt('Why reject it? (helps the agent learn; optional)'); if (reason !== null) sendWs({type: 'draft', id: d.id, action: 'reject', reason}); }}>Reject</button>
          </>}
        </div> : <div className="quiet small decided">{d.status === 'approved' ? `Approved${d.editedByFounder ? ' after your edits' : ''}, queued. Not actually sent in this prototype.` : `Rejected${d.rejectReason ? `: ${d.rejectReason}` : ''}`}</div>}
      </div>
    </article>
  );
}

export function OutreachView() {
  const {db} = useLink();
  const [showDone, setShowDone] = useState(false);
  const pending = db.drafts.filter((d) => d.status === 'pending'), done = db.drafts.filter((d) => d.status !== 'pending');
  if (!db.drafts.length) return <><PageHead title="Outreach" /><Empty title="Nothing to approve yet">Drafts land here first. Nothing is queued or sent until you approve it.</Empty></>;
  return (
    <div className="outreach">
      <PageHead title="Outreach" lede={pending.length ? <>{pending.length} {pending.length === 1 ? 'draft is' : 'drafts are'} waiting for you. Underlined lines are claims; click one to see its source. Nothing goes out until you approve it.</> : 'All caught up. Nothing goes out until you approve it.'} />
      {pending.map((d) => <DraftCard key={d.id} d={d} />)}
      {done.length > 0 && <div className="center mt">
        <button className="pill" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} decided</button>
      </div>}
      {showDone && done.map((d) => <DraftCard key={d.id} d={d} />)}
    </div>
  );
}
