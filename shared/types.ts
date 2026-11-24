// The Thread's data model. Everything the agent finds carries its sources; everything anyone does is in the audit log.

export type Source = {url: string; title?: string};
export type Conf<T> = {value: T; confidence: number; why?: string};

export type ICP = {
  product: string;
  summary: string;
  industries: Conf<{name: string; naics?: string}[]>;
  companySize: Conf<{min: number; max: number}>;
  personas: Conf<{title: string; seniority?: string; department?: string}[]>;
  triggers: Conf<string[]>;
  geos: Conf<string[]>;
  negatives: Conf<string[]>;
  updatedAt: number;
};
export type Expansion = {id: string; field: string; suggestion: string; why: string; status: 'open' | 'accepted' | 'dismissed' | 'adjusted'; note?: string};

export type Company = {
  id: string; name: string; domain?: string; industry?: string; naics?: string; employees?: number; hq?: string;
  why: string; sources: Source[];
  negative?: {reason: string; sources: Source[]};
};
export type Person = {
  id: string; name: string; title: string; seniority?: string; companyId: string;
  linkedin?: string; schools: string[]; pastCompanies: string[]; sources: Source[];
  /** Public, sourced shared contexts beyond LinkedIn: communities, accelerators, events they spoke at, podcasts, open-source projects. */
  communities?: string[];
  email?: string; emailScore?: number; emailStatus?: string; enrichedAt?: number; enrichNote?: string;
  stage: Stage; stageBy?: Actor; stageAt?: number;
};
export type Signal = {id: string; companyId: string; kind: 'hiring' | 'funding' | 'launch' | 'leadership' | 'tech' | 'news' | 'job_change'; text: string; url: string; date?: string};
export type Competitor = {id: string; name: string; domain?: string; positioning: string; pricing: string; differentiators: string[]; sources: Source[]};

/** One row of the founder's LinkedIn Connections.csv (or typed in). */
/** A link the agent attaches to a chat message, e.g. {label: 'Review 4 drafts', to: 'outreach'}. `to` is a workspace page. */
export type ChatAction = {label: string; to: 'brief' | 'profile' | 'leads' | 'network' | 'outreach' | 'pipeline' | 'insights'};
export type ChatMsg = {at: number; from: 'founder' | 'agent'; text: string; actions?: ChatAction[]};
export type Contact = {id: string; name: string; company: string; position: string; url?: string; email?: string; connectedOn?: string; companySource?: string;
  /** linkedin = from the export; customer/met = a lead you closed or met, added automatically; typed = added by hand. */
  origin?: 'linkedin' | 'customer' | 'met' | 'typed'; personId?: string};
export type Founder = {name: string; schools: string[]; pastCompanies: string[]; network: Contact[]; networkFile?: string;
  /** Communities, accelerators, events, podcasts the founder is part of (off-LinkedIn warmth). */
  communities?: string[]};

export type PathKind = 'colleague' | 'former_colleague' | 'shared_employer' | 'shared_school' | 'shared_community';
export type WarmPath = {kind: PathKind; strength: number; viaContactId?: string; hops: string[]; text: string};

export type Stage = 'matched' | 'contacted' | 'replied' | 'meeting' | 'closed' | 'lost';
export const STAGES: Stage[] = ['matched', 'contacted', 'replied', 'meeting', 'closed', 'lost'];
export type Actor = 'ai' | 'founder';

export type Touch = {channel: 'email' | 'linkedin'; day: number; subject?: string; body: string; to?: string};
export type Claim = {text: string; url: string};
export type Draft = {
  id: string; personId: string; kind: 'intro_request' | 'cold' | 'referral_ask'; variant: 'A' | 'B'; viaContactId?: string;
  angle: string; touches: Touch[]; claims: Claim[];
  review?: {verdict: 'pass' | 'fix'; unsupported: string[]; note?: string; proofScore: number; by: string};
  status: 'pending' | 'approved' | 'rejected'; rejectReason?: string; editedByFounder?: boolean;
  createdAt: number; decidedAt?: number;
};

export type Thought = {at: number; agent: string; step: string; detail?: string};
export type AuditEvent = {at: number; actor: Actor; agent?: string; action: string; target?: string; detail?: string};
export type Question = {qid: string; question: string; options: string[]; agent: string; at: number; answered?: string};
export type IcpChange = {id: string; change: string; evidence: string; status: 'open' | 'accepted' | 'dismissed'; at: number};
/** A connection who changed jobs (found by the agent with a source). */
export type Move = {at: number; contactId: string; name: string; from: string; to: string; position?: string; source: string; intoTarget?: string};
/** Someone the founder should meet: not a buyer, but next to several buyers. */
export type Connector = {id: string; name: string; title: string; company: string; why: string; unlocks: string[]; sources: Source[]; status: 'open' | 'done' | 'dismissed'; at: number};
export type Usage = {leads_enriched: number; outreach_sent: number; graph_queries: number; credits: number};

export type DB = {
  icp: ICP | null; expansions: Expansion[];
  companies: Company[]; people: Person[]; signals: Signal[]; competitors: Competitor[];
  founder: Founder; drafts: Draft[];
  thoughts: Thought[]; audit: AuditEvent[]; questions: Question[]; icpChanges: IcpChange[]; chat: ChatMsg[];
  moves: Move[]; connectors: Connector[];
  usage: Usage; enrichCache: Record<string, {email?: string; score?: number; status?: string; at: number}>;
};

export const emptyDB = (credits = 50): DB => ({
  icp: null, expansions: [], companies: [], people: [], signals: [], competitors: [],
  founder: {name: '', schools: [], pastCompanies: [], network: []}, drafts: [],
  thoughts: [], audit: [], questions: [], icpChanges: [], chat: [], moves: [], connectors: [],
  usage: {leads_enriched: 0, outreach_sent: 0, graph_queries: 0, credits}, enrichCache: {},
});

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
