// Hash routing: "#/" is the landing page, "#/leads" etc. are the workspace steps. Back button and deep links work.
import {useEffect, useState} from 'react';

export const STEPS = [
  {id: 'brief', title: 'Brief', blurb: 'Tell it what you sell'},
  {id: 'profile', title: 'Profile', blurb: 'Who buys it'},
  {id: 'leads', title: 'Leads', blurb: 'Real people, with sources'},
  {id: 'network', title: 'Network', blurb: 'Who you already know'},
  {id: 'outreach', title: 'Outreach', blurb: 'Drafts waiting for you'},
  {id: 'pipeline', title: 'Pipeline', blurb: 'Where every lead stands'},
  {id: 'insights', title: 'Insights', blurb: 'What is working'},
] as const;
export type StepId = (typeof STEPS)[number]['id'];
export type Route = 'home' | 'start' | StepId;

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  if (h === 'start') return 'start';
  return (STEPS.find((s) => s.id === h)?.id ?? 'home') as Route;
};
export const href = (r: Route) => (r === 'home' ? '#/' : `#/${r}`);
export const go = (r: Route) => { location.hash = href(r); };
export const pad = (n: number) => String(n).padStart(2, '0');

export function useRoute() {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
