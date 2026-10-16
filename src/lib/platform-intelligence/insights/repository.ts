import type {Staff} from '../../auth';
import {auditCommandSchema,canonicalChecksum,immutable,timestamp} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {assertInsightOwner} from './contracts';
import type {InsightCohort,AggregationPolicy} from './contracts';
import {aggregateInsightCohort} from './engine';
import type {InsightAggregationRun} from './engine';
import type {InsightSourceReader} from './sources';
import {projectInsightRun} from './projection';
import type {InsightRunState,InsightProjection} from './projection';

export type InsightRunInput={cohort:InsightCohort;policy:AggregationPolicy;cutoffAt:string;checkedAt:string};
export type InsightRunView=Readonly<{aggregationId:string;revision:number;checksum:string;sourceState:InsightRunState;projection:InsightProjection}>;
export interface InsightAggregationRepository {
  appendRun(input:InsightRunInput,expectedRevision:number,actor:Staff,purpose:'INTERNAL_RESEARCH',audit:AuditCommand):InsightRunView;
  getRun(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):InsightRunView|undefined;
  listRuns(actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):readonly InsightRunView[];
  listByAction(actionId:string,actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):readonly InsightRunView[];
  listByPlatform(platform:string,actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):readonly InsightRunView[];
  listByIndustry(industry:string,actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):readonly InsightRunView[];
  getLineage(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):InsightAggregationRun['lineage'];
}
export type InsightStoredRun={revision:number;run:InsightAggregationRun;audit:AuditCommand;previousChecksum:string|null;checksum:string;policy:AggregationPolicy};
export function createInMemoryInsightAggregationRepository(reader:InsightSourceReader,initial:readonly InsightStoredRun[]=[]):InsightAggregationRepository & {snapshot():InsightStoredRun[]} {
  const ledger:InsightStoredRun[]=initial.map(v=>immutable(structuredClone(v)));
  function view(record:typeof ledger[number],actor:Staff,purpose:'INTERNAL_RESEARCH',checkedAt:string):InsightRunView {
    assertInsightOwner(actor,purpose);timestamp.parse(checkedAt);if(Date.parse(checkedAt)<Date.parse(record.run.checkedAt))throw Error('Insight current check time reversed');
    let state:InsightRunState='CURRENT';try{const current=aggregateInsightCohort({cohort:record.run.cohortSpec,policy:record.policy,cutoffAt:record.run.cutoffAt,checkedAt,actor,purpose,reader});
      const currentCandidates=new Map(current.lineage.map(l=>[l.candidateId,l]));
      if(record.run.lineage.some(old=>currentCandidates.has(old.candidateId)&&currentCandidates.get(old.candidateId)!.consentStateHash!==old.consentStateHash))state='STALE_BY_CONSENT_CHANGE';else if(current.sourceHash!==record.run.sourceHash)state='STALE_BY_SOURCE_CHANGE';
    }catch{state='STALE_BY_SOURCE_CHANGE';}
    return immutable({aggregationId:record.run.aggregationId,revision:record.revision,checksum:record.checksum,sourceState:state,projection:projectInsightRun(record.run,actor,purpose,state)});
  }
  const list=(actor:Staff,purpose:'INTERNAL_RESEARCH',at:string,filter:(r:InsightAggregationRun)=>boolean=()=>true)=>{assertInsightOwner(actor,purpose);return Object.freeze(ledger.filter(v=>filter(v.run)).map(v=>view(v,actor,purpose,at)));};
  return Object.freeze({
    snapshot:()=>[...ledger],
    appendRun(input:InsightRunInput,expectedRevision:number,actor:Staff,purpose:'INTERNAL_RESEARCH',rawAudit:AuditCommand){assertInsightOwner(actor,purpose);const audit=auditCommandSchema.parse(rawAudit);
      if(audit.actorId!==actor.id||audit.createdAt!==input.checkedAt||expectedRevision!==ledger.length||ledger.at(-1)&&Date.parse(audit.createdAt)<Date.parse(ledger.at(-1)!.audit.createdAt))throw Error('Insight revision/audit mismatch');
      const run=aggregateInsightCohort({...input,actor,purpose,reader});if(ledger.some(v=>v.run.aggregationId===run.aggregationId))throw Error('Immutable aggregation run already exists');
      const body={revision:ledger.length+1,run,audit,previousChecksum:ledger.at(-1)?.checksum??null},record=immutable({...body,checksum:canonicalChecksum(body),policy:structuredClone(input.policy)});ledger.push(record);
      return immutable({aggregationId:run.aggregationId,revision:record.revision,checksum:record.checksum,sourceState:'CURRENT' as const,projection:projectInsightRun(run,actor,purpose)});
    },
    getRun(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',at:string){assertInsightOwner(actor,purpose);const r=ledger.find(v=>v.run.aggregationId===id);return r?view(r,actor,purpose,at):undefined;},
    listRuns:(actor:Staff,purpose:'INTERNAL_RESEARCH',at:string)=>list(actor,purpose,at),
    listByAction:(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',at:string)=>list(actor,purpose,at,r=>r.action.id===id),
    listByPlatform:(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',at:string)=>list(actor,purpose,at,r=>r.platformCode===id),
    listByIndustry:(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',at:string)=>list(actor,purpose,at,r=>r.cohortSpec.industry===id),
    getLineage(id:string,actor:Staff,purpose:'INTERNAL_RESEARCH',at:string){assertInsightOwner(actor,purpose);const r=ledger.find(v=>v.run.aggregationId===id);if(!r||view(r,actor,purpose,at).sourceState!=='CURRENT')throw Error('Current sources and consent required for OWNER lineage');return r.run.lineage;},
  });
}
