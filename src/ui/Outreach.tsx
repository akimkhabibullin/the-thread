// Step 05: a mail reader. Drafts on the left; the selected sequence reads like real email, with footnoted sources and a clear action bar.
import {useEffect, useState} from 'react';
import {sendWs, useLink} from '../link';
import {leads, safeHref} from '../../shared/logic';
import type {Claim, Draft, Touch} from '../../shared/types';
import {Empty, PageHead} from './Chrome';
import {Tier} from './Leads';

/** Underline every claim in the text and link it to its source; with `notes`, add a superscript footnote number. */
export function WithProof({text, claims, notes}: {text: string; claims: Claim[]; notes?: Map<string, number>}) {
  const parts: React.ReactNode[] = [];
  let rest = text, k = 0;
  while (rest) {
    let best: {i: number; c: Claim} | null = null;
    for (const c of claims) { const i = c.text ? rest.indexOf(c.text) : -1; if (i >= 0 && (!best || i < best.i)) best = {i, c}; }
    if (!best) { parts.push(rest); break; }
    parts.push(rest.slice(0, best.i));
    const n = notes?.get(best.c.url);
    parts.push(<a key={k++} className="claim" href={safeHref(best.c.url)} target="_blank" rel="noreferrer" title={best.c.url}>{best.c.text}{n && <sup>{n}</sup>}</a>);
    rest = rest.slice(best.i + best.c.text.length);
  }
  return <>{parts}</>;
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

function Reader({d}: {d: Draft}) {
  const {db} = useLink();
  const lead = leads(db).find((l) => l.person.id === d.personId);
  const via = db.founder.network.find((c) => c.id === d.viaContactId);
  const [edit, setEdit] = useState<Touch[] | null>(null);
  useEffect(() => setEdit(null), [d.id]);
  const r = d.review;
  const notes = new Map<string, number>();
  for (const c of d.claims) if (!notes.has(c.url)) notes.set(c.url, notes.size + 1);
  const from = db.founder.name || 'You';
  const toName = (t: Touch) => t.to ?? (d.kind === 'intro_request' ? via?.name : lead?.person.name) ?? 'Recipient';
  return (
    <article className={`reader ${d.status}`}>
      <header className="reader-head">
        <h2>{lead?.person.name}</h2>
        <div className="reader-kind">{d.kind === 'referral_ask' && <span className="badge-ref">Referral ask</span>}{d.kind === 'intro_request' ? `Intro request via ${via?.name ?? 'a connection'}` : d.kind === 'referral_ask' ? 'To your customer, asking for intros' : 'Cold sequence'} · variant {d.variant}</div>
        <div className="quiet">{lead?.person.title}, {lead?.company?.name}{lead && <> · <Tier tier={lead.tier} score={lead.score} /></>}</div>
        <div className="quiet small">Angle: {d.angle}</div>
      </header>

      <div className="reader-body">
        <ol className="timeline">
          {(edit ?? d.touches).map((t, i) => (
            <li key={i} className="tl-step">
              <div className="tl-label">Day {t.day} · {t.channel === 'email' ? (i === 0 ? 'Email' : 'Follow-up') : 'LinkedIn'}</div>
              <div className="mail">
                <div className="mail-meta">
                  <div><span>From</span>{from}</div>
                  <div><span>To</span>{toName(t)}{t.channel === 'linkedin' && <em> · LinkedIn message</em>}</div>
                  {(t.subject || (edit && t.channel === 'email')) && <div><span>Subject</span>{edit && t.channel === 'email'
                    ? <input value={t.subject ?? ''} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, subject: e.target.value} : x)))} />
                    : <b>{t.subject}</b>}</div>}
                </div>
                {edit ? <textarea rows={9} value={t.body} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? {...x, body: e.target.value} : x)))} />
                  : <div className="mail-text"><WithProof text={t.body} claims={d.claims} notes={notes} /></div>}
              </div>
            </li>
          ))}
        </ol>
        {notes.size > 0 && <ol className="footnotes">
          {[...notes.entries()].map(([url, n]) => <li key={url} value={n}><a className="u" href={safeHref(url)} target="_blank" rel="noreferrer">{d.claims.find((c) => c.url === url)?.text}</a> <span className="quiet">· {host(url)}</span></li>)}
        </ol>}
        <aside className="margin-note">
          {r ? <>
            <div className="proof-num">{r.proofScore}<span>%</span></div>
            <div className="small">proof score</div>
            <p className="small">{r.by} {r.verdict === 'pass' ? 'checked every claim against its source.' : 'flagged this draft.'}{r.note && ` ${r.note}`}</p>
            {r.unsupported.map((u, i) => <p key={i} className="small red-deep">Unsupported: “{u}”</p>)}
          </> : <p className="small quiet">Waiting for the reviewer.</p>}
        </aside>
      </div>

      <div className="action-bar">
        {d.status === 'pending' ? (edit ? <>
          <button className="pill solid" onClick={() => { sendWs({type: 'draft', id: d.id, action: 'edit', touches: edit}); setEdit(null); }}>Save edits</button>
          <button className="pill" onClick={() => setEdit(null)}>Cancel</button>
        </> : <>
          <button className="pill solid" onClick={() => sendWs({type: 'draft', id: d.id, action: 'approve'})}>Approve and queue</button>
          <button className="pill" onClick={() => setEdit(d.touches.map((t) => ({...t})))}>Edit</button>
          <button className="link red" onClick={() => { const reason = prompt('Why reject it? (helps the agent learn; optional)'); if (reason !== null) sendWs({type: 'draft', id: d.id, action: 'reject', reason}); }}>Reject</button>
          <span className="quiet small">Nothing is sent until you approve.</span>
        </>) : <span className="quiet small">{d.status === 'approved' ? `Approved${d.editedByFounder ? ' after your edits' : ''}, queued. Not actually sent in this prototype.` : `Rejected${d.rejectReason ? `: ${d.rejectReason}` : ''}`}</span>}
      </div>
    </article>
  );
}

export function OutreachView() {
  const {db} = useLink();
  const order = [...db.drafts.filter((d) => d.status === 'pending'), ...db.drafts.filter((d) => d.status !== 'pending')];
  const [sel, setSel] = useState<string | null>(null);
  const cur = order.find((d) => d.id === sel) ?? order[0];
  if (!db.drafts.length) return <><PageHead title="Outreach" /><Empty title="Nothing to approve yet">Drafts land here first. Nothing is queued or sent until you approve it.</Empty></>;
  const pending = order.filter((d) => d.status === 'pending').length;
  return (
    <div className="outreach">
      <aside className="inbox">
        <h1>Outreach</h1>
        <p className="quiet small">{pending ? `${pending} waiting for you` : 'All caught up'}</p>
        <ul>{order.map((d) => {
          const p = db.people.find((x) => x.id === d.personId);
          return (
            <li key={d.id}><button className={`${cur?.id === d.id ? 'on' : ''} ${d.status}`} onClick={() => setSel(d.id)}>
              <span className="ib-name">{p?.name ?? 'Unknown'}</span>
              <span className="ib-meta">{d.kind === 'intro_request' ? 'Intro request' : d.kind === 'referral_ask' ? <b className="ref">Referral ask</b> : 'Cold'} · {d.status === 'pending' ? (d.review ? `proof ${d.review.proofScore}` : 'in review') : d.status}</span>
              {d.review?.verdict === 'fix' && d.status === 'pending' && <span className="ib-flag">flagged</span>}
            </button></li>
          );
        })}</ul>
      </aside>
      {cur && <Reader d={cur} />}
    </div>
  );
}
