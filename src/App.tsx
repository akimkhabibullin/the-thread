import {useCallback, useState} from 'react';
import {useRoute, StepId} from './route';
import {Feed, Menu, StepLinks, TopBar} from './ui/Chrome';
import {Home} from './ui/Home';
import {Start} from './ui/Start';
import {BriefView} from './ui/Brief';
import {IcpView} from './ui/Icp';
import {LeadsView} from './ui/Leads';
import {NetworkView} from './ui/Network';
import {OutreachView} from './ui/Outreach';
import {PipelineView} from './ui/Pipeline';
import {InsightsView} from './ui/Insights';

const VIEWS: Record<StepId, () => React.ReactNode> = {
  brief: BriefView, profile: IcpView, leads: LeadsView, network: NetworkView, outreach: OutreachView, pipeline: PipelineView, insights: InsightsView,
};

export function App() {
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const [feed, setFeed] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  if (route === 'start') return <><Start onMenu={() => setMenu(true)} /><Menu open={menu} onClose={closeMenu} route={route} /></>;
  if (route === 'home') return <><Home onMenu={() => setMenu(true)} /><Menu open={menu} onClose={closeMenu} route={route} /></>;
  const View = VIEWS[route];
  return (
    <div className={`ws ${feed ? 'feed-open' : ''}`}>
      <TopBar route={route} onMenu={() => setMenu(true)} onFeed={() => setFeed(!feed)} feedOpen={feed} />
      <main className={`page page-${route}`}>
        <View />
        <StepLinks route={route} />
      </main>
      <Feed open={feed} onClose={() => setFeed(false)} />
      <Menu open={menu} onClose={closeMenu} route={route} />
    </div>
  );
}
