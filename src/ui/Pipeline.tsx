// Module 5: the board. Cards say who moved them (AI or you) and when.
import {sendWs, useLink, ago} from '../link';
import {leads} from '../../shared/logic';
import {STAGES, Stage} from '../../shared/types';
import {Tier} from './Leads';

const LABEL: Record<Stage, string> = {matched: 'Matched', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting booked', closed: 'Closed won', lost: 'Lost'};

export function PipelineView() {
  const {db} = useLink();
  const L = leads(db).filter((l) => !l.excluded);
  return (
    <div className="board">
      {STAGES.map((st) => {
        const col = L.filter((l) => l.person.stage === st);
        return (
          <div key={st} className="col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => sendWs({type: 'stage', personId: e.dataTransfer.getData('text/plain'), stage: st})}>
            <h4>{LABEL[st]} <span className="muted">{col.length}</span></h4>
            {col.map((l) => (
              <div key={l.person.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', l.person.id)}>
                <div className="row-between"><b>{l.person.name}</b><Tier tier={l.tier} score={l.score} /></div>
                <div className="muted small">{l.person.title} · {l.company?.name}</div>
                {l.paths[0] && <div className="small path">via {l.paths[0].hops[1]}</div>}
                <div className="row-between small muted">
                  <span className={`by ${l.person.stageBy}`}>{l.person.stageBy === 'founder' ? 'you' : 'AI'}{l.person.stageAt ? ` · ${ago(l.person.stageAt)} ago` : ''}</span>
                  <select value={st} onChange={(e) => sendWs({type: 'stage', personId: l.person.id, stage: e.target.value})}>{STAGES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
