import {useState} from 'react';
import {post, useLink} from './link';
import {Side} from './ui/Side';
import {IcpView} from './ui/Icp';
import {LeadsView} from './ui/Leads';
import {NetworkView} from './ui/Network';
import {OutreachView} from './ui/Outreach';
import {PipelineView} from './ui/Pipeline';
import {InsightsView} from './ui/Insights';

const TABS = ['ICP', 'Leads', 'Network', 'Outreach', 'Pipeline', 'Insights'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<Tab>('ICP');
  const {db, status, connected} = useLink();
  const pending = db.drafts.filter((d) => d.status === 'pending').length;
  const count: Partial<Record<Tab, number>> = {Leads: db.people.length, Network: db.founder.network.length, Outreach: pending};
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span className="logo">◐</span> Warmpath <span className="tag">your next customer is two people away</span></div>
        <div className="usage">
          <span title="Enrichment credits left (metered with Flexprice)"><b>{db.usage.credits}</b> credits</span>
          <span><b>{db.usage.leads_enriched}</b> enriched</span>
          <span><b>{db.usage.outreach_sent}</b> queued</span>
          <span><b>{db.usage.graph_queries}</b> graph queries</span>
        </div>
        <div className={`status ${connected ? status : 'offline'}`} title="Claude Code agent">
          <i />{!connected ? 'bridge offline' : status === 'offline' ? 'agent offline: run /warmpath in Claude Code' : status === 'listening' ? 'agent listening' : 'agent working'}
        </div>
        <details className="menu"><summary>⋯</summary><div className="menu-list">
          <button onClick={() => post('/api/demo/save')}>Save demo snapshot</button>
          <button onClick={() => post('/api/demo/load')}>Load demo snapshot</button>
          <button onClick={() => confirm('Clear the ICP, leads and drafts? (your network stays)') && post('/api/reset')}>Start over</button>
        </div></details>
      </header>
      <Side />
      <main className="main">
        <nav className="tabs">
          {TABS.map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}{count[t] ? <span className="n">{count[t]}</span> : null}</button>)}
        </nav>
        <div className="view">
          {tab === 'ICP' && <IcpView />}
          {tab === 'Leads' && <LeadsView />}
          {tab === 'Network' && <NetworkView />}
          {tab === 'Outreach' && <OutreachView />}
          {tab === 'Pipeline' && <PipelineView />}
          {tab === 'Insights' && <InsightsView />}
        </div>
      </main>
    </div>
  );
}
