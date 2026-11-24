// Step 06: the board. Drag cards or pick a stage; each card says who moved it (the agent or you) and when.
import {ago, sendWs, useLink} from '../link';
import {leads} from '../../shared/logic';
import {STAGES, Stage} from '../../shared/types';
import {PageHead} from './Chrome';
import {href} from '../route';

const LABEL: Record<Stage, string> = {matched: 'Matched', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting', closed: 'Closed', lost: 'Lost'};

function Referral({personId}: {personId: string}) {
  const {db} = useLink();
  const d = [...db.drafts].reverse().find((x) => x.kind === 'referral_ask' && x.personId === personId);
  return (
    <div className="referral">
      <div className="ref-title">Ask for intros</div>
      {d ? <a className="u small" href={href('outreach')}>{d.status === 'pending' ? 'Draft ready for you' : d.status === 'approved' ? 'Approved, queued' : 'Rejected'} · Outreach →</a>
        : <span className="small quiet">The agent is writing an intro ask…</span>}
    </div>
  );
}

export function PipelineView() {
  const {db} = useLink();
  const L = leads(db).filter((l) => !l.excluded);
  return (
    <div className="pipeline">
      <PageHead title="Pipeline" lede={<>Where every lead stands. Drag a card to move it, or pick a stage.<br />Closing a deal adds them to your network and asks them for intros.</>} />
      <div className="board">
        {STAGES.map((st) => {
          const col = L.filter((l) => l.person.stage === st);
          return (
            <div key={st} className={`col col-${st}`} onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={(e) => e.currentTarget.classList.remove('over')}
              onDrop={(e) => { e.currentTarget.classList.remove('over'); sendWs({type: 'stage', personId: e.dataTransfer.getData('text/plain'), stage: st}); }}>
              <div className="col-head"><span>{LABEL[st]}</span><span className="quiet">{col.length}</span></div>
              {col.map((l) => (
                <div key={l.person.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.person.id)}>
                  <div className="k-top"><span className="strong">{l.person.name}</span><span className="k-score">{l.score}<i>.</i></span></div>
                  <div className="quiet small">{l.person.title}, {l.company?.name}</div>
                  {l.paths[0] && <div className="small warm">via {l.paths[0].hops[1]}</div>}
                  {st === 'closed' && <Referral personId={l.person.id} />}
                  <div className="k-foot">
                    <span className="by">{l.person.stageBy === 'founder' ? 'You' : 'Agent'}{l.person.stageAt ? ` · ${ago(l.person.stageAt)} ago` : ''}</span>
                    <select value={st} onChange={(e) => sendWs({type: 'stage', personId: l.person.id, stage: e.target.value})} aria-label="Stage">{STAGES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
