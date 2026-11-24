// How the agent speaks in the UI: its mark, readable text (paragraphs, numbered lists), links to the pages it mentions, and a toast when it finishes something.
import {useEffect, useState} from 'react';
import {useLink} from '../link';
import {href, Route} from '../route';
import type {ChatAction, ChatMsg} from '../../shared/types';

export const AgentMark = ({size = 28}: {size?: number}) => <img className="agent-mark" src="/brand/thread-mark-red.png" alt="The Thread" style={{width: size}} />;

/* ---------- "seen" bookkeeping in localStorage (wrapped: private windows can throw) ---------- */
const SEEN_KEY = 'thread.seenPeople', TOAST_KEY = 'thread.toastSeenAt';
export const readSeen = (): Set<string> | null => { try { const v = localStorage.getItem(SEEN_KEY); return v ? new Set(JSON.parse(v) as string[]) : null; } catch { return null; } };
export const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* ignore */ } };
const readNum = (k: string) => { try { const v = localStorage.getItem(k); return v == null ? null : Number(v); } catch { return null; } };
const writeNum = (k: string, n: number) => { try { localStorage.setItem(k, String(n)); } catch { /* ignore */ } };

/* ---------- links to the pages a message mentions ---------- */
const PAGES: ChatAction['to'][] = ['outreach', 'leads', 'network', 'profile', 'pipeline', 'insights'];
const LABEL: Record<ChatAction['to'], string> = {brief: 'Brief', profile: 'Open Profile', leads: 'See Leads', network: 'Open Network', outreach: 'Go to Outreach', pipeline: 'Open Pipeline', insights: 'See Insights'};
export function actionsFor(m: ChatMsg): ChatAction[] {
  const out: ChatAction[] = [...(m.actions ?? [])];
  if (m.from === 'agent') {
    const found = PAGES.map((p) => ({p, i: m.text.search(new RegExp(`\\b${p}\\b`, 'i'))})).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
    for (const {p} of found) if (!out.some((a) => a.to === p)) out.push({label: LABEL[p], to: p});
  }
  return out.slice(0, 3);
}
export const ActionPills = ({actions, onClick}: {actions: ChatAction[]; onClick?: () => void}) => actions.length ? (
  <div className="msg-actions">{actions.map((a) => <a key={a.to + a.label} className="pill sm" href={href(a.to as Route)} onClick={onClick}>{a.label} →</a>)}</div>
) : null;

/* ---------- readable agent text ---------- */
type Block = {t: 'p'; text: string} | {t: 'ol' | 'ul'; intro?: string; items: string[]};
/** "(1) a (2) b" or "1. A 2. B" inside one paragraph → intro + items, if they count 1, 2, 3… */
function inlineList(p: string): Block {
  for (const re of [/\((\d{1,2})\)\s*/g, /(?:^|\s)(\d{1,2})[.)]\s+(?=[A-Z"“'])/g]) {
    const ms = [...p.matchAll(re)];
    if (ms.length < 2 || ms.some((m, i) => Number(m[1]) !== i + 1)) continue;
    const items = ms.map((m, i) => p.slice(m.index! + m[0].length, i + 1 < ms.length ? ms[i + 1].index : undefined).trim().replace(/[;,]\s*(and)?$/i, '').trim());
    const intro = p.slice(0, ms[0].index).trim();
    return {t: 'ol', intro: intro || undefined, items};
  }
  return {t: 'p', text: p};
}
export function blocks(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [], list: {t: 'ol' | 'ul'; items: string[]} | null = null;
  const flushP = () => { if (para.length) out.push(inlineList(para.join(' '))); para = []; };
  const flushL = () => { if (list) out.push(list); list = null; };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const ol = line.match(/^(\d{1,2})[.)]\s+(.*)$/), ul = line.match(/^[-•*]\s+(.*)$/);
    if (ol || ul) {
      flushP();
      const t = ol ? 'ol' : 'ul';
      if (!list || list.t !== t) { flushL(); list = {t, items: []}; }
      list.items.push((ol ? ol[2] : ul![1]).trim());
    } else if (!line) { flushP(); flushL(); } else { flushL(); para.push(line); }
  }
  flushP(); flushL();
  return out;
}
export function AgentText({text}: {text: string}) {
  return <div className="agent-text">{blocks(text).map((b, i) => b.t === 'p' ? <p key={i}>{b.text}</p> : <div key={i}>
    {b.intro && <p>{b.intro}</p>}
    {b.t === 'ol' ? <ol>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol> : <ul>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>}
  </div>)}</div>;
}

/* ---------- toast: the agent finished something ---------- */
export function AgentToast({route}: {route: Route}) {
  const {db} = useLink();
  const [seenAt, setSeenAt] = useState<number>(() => readNum(TOAST_KEY) ?? Date.now() - 60 * 60 * 1000);
  const latest = [...db.chat].reverse().find((m) => m.from === 'agent' && actionsFor(m).length);
  useEffect(() => { if (route === 'brief' && latest && latest.at > seenAt) { writeNum(TOAST_KEY, latest.at); setSeenAt(latest.at); } }, [route, latest?.at]);
  if (!latest || latest.at <= seenAt || route === 'brief') return null;
  const dismiss = () => { writeNum(TOAST_KEY, latest.at); setSeenAt(latest.at); };
  const first = blocks(latest.text)[0];
  const line = first ? (first.t === 'p' ? first.text : [first.intro, first.items[0]].filter(Boolean).join(' ')) : '';
  return (
    <div className="toast" role="status">
      <AgentMark size={30} />
      <div className="toast-text"><div className="who">The agent finished something</div><p>{line.length > 160 ? line.slice(0, line.lastIndexOf(' ', 160)) + '…' : line}</p></div>
      <ActionPills actions={actionsFor(latest).filter((a) => a.to !== route)} onClick={dismiss} />
      <a className="link" href={href('brief')} onClick={dismiss}>Read it</a>
      <button className="close" onClick={dismiss} aria-label="Dismiss">×</button>
    </div>
  );
}
