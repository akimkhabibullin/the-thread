// The app's side of the bridge: live state from the server, and the founder's input going back.
import {create} from 'zustand';
import {DB, emptyDB} from '../shared/types';

type Link = {db: DB; status: 'offline' | 'listening' | 'working'; connected: boolean};
export const useLink = create<Link>(() => ({db: emptyDB(), status: 'offline', connected: false}));

let ws: WebSocket | null = null;
export const sendWs = (m: object) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

export function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => useLink.setState({connected: true});
  ws.onclose = () => { useLink.setState({connected: false, status: 'offline'}); setTimeout(connect, 1500); };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'db') useLink.setState({db: m.db});
    else if (m.type === 'agent_status') useLink.setState({status: m.status});
  };
}

export const post = (path: string, body?: object) => fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined}).then((r) => r.json());
export const ago = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`; };
