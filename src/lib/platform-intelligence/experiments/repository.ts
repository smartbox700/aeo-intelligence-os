import type {Staff} from '../../auth';
import {assertActionAccess} from '../actions/candidates';
import {auditCommandSchema,canonicalChecksum,immutable} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {sealExperiment,assertExperiment} from './contracts';
import type {Experiment,ExperimentDraft} from './contracts';
import {evaluateExperiment} from './engine';
import type {ExperimentResult,ExperimentSources} from './engine';

export interface ExperimentRepository {
  createDraft(input:ExperimentDraft,actor:Staff,audit:AuditCommand):Experiment;
  retire(projectId:string,id:string,expectedVersion:number,actor:Staff,audit:AuditCommand):Experiment;
  get(projectId:string,id:string,actor:Staff,version?:number):Experiment|undefined;
  listByProject(projectId:string,actor:Staff):readonly Experiment[];
}
export type StoredExperimentResult=Readonly<{result:ExperimentResult;audit:AuditCommand;previousChecksum:string|null;checksum:string}>;
export type ExperimentResultView=Readonly<{stored:StoredExperimentResult;sourceState:'CURRENT'|'STALE';currentDelta:number|null}>;
export interface ExperimentResultRepository {
  appendResult(projectId:string,id:string,experimentVersion:number,expectedRevision:number,actor:Staff,audit:AuditCommand):StoredExperimentResult;
  getResult(projectId:string,id:string,resultVersion:number,actor:Staff):ExperimentResultView|undefined;
  listResults(projectId:string,id:string,actor:Staff):readonly ExperimentResultView[];
}
/** Trusted local readers must resolve canonical 8-5 views, never accept client-supplied CURRENT flags. */
export function createInMemoryExperimentRepositories(guard:{authorizeProject(projectId:string,actor:Staff):boolean;loadSources(experiment:Experiment,actor:Staff,evidenceAsOf:string):ExperimentSources},initial?:{definitions:readonly Experiment[];results:readonly StoredExperimentResult[]}):{experiments:ExperimentRepository;results:ExperimentResultRepository;snapshot():{definitions:Experiment[];results:StoredExperimentResult[]}}{
  const definitions:Experiment[]=(initial?.definitions??[]).map(v=>immutable(structuredClone(v))),results:StoredExperimentResult[]=(initial?.results??[]).map(v=>immutable(structuredClone(v)));
  function access(id:string,actor:Staff,write=false){assertActionAccess(actor,id,write);if(!guard.authorizeProject(id,actor))throw Error('Experiment project repository access denied');}
  function auditFor(actor:Staff,raw:AuditCommand){const audit=auditCommandSchema.parse(raw);if(audit.actorId!==actor.id)throw Error('Experiment audit actor mismatch');return audit;}
  const versions=(project:string,id:string)=>definitions.filter(e=>e.projectId===project&&e.experimentId===id);
  const resultVersions=(project:string,id:string)=>results.filter(r=>r.result.projectId===project&&r.result.experimentId===id);
  const get=(project:string,id:string,version?:number)=>version===undefined?versions(project,id).at(-1):versions(project,id).find(e=>e.version===version);
  function projectIdOwner(id:string,project:string){if(definitions.some(e=>e.experimentId===id&&e.projectId!==project))throw Error('Experiment ID belongs to another project');}
  function view(stored:StoredExperimentResult,actor:Staff):ExperimentResultView {
    try{const r=stored.result,e=get(r.projectId,r.experimentId,r.experimentVersion);if(!e)throw Error('Experiment definition missing');
      const current=evaluateExperiment(e,guard.loadSources(e,actor,r.evidenceAsOf),actor,r.evidenceAsOf,r.resultVersion),fresh=current.checksum===r.checksum;
      return immutable({stored,sourceState:fresh?'CURRENT' as const:'STALE' as const,currentDelta:fresh?r.delta:null});
    }catch{return immutable({stored,sourceState:'STALE' as const,currentDelta:null});}
  }
  const experiments:ExperimentRepository=Object.freeze({
    createDraft(input:ExperimentDraft,actor:Staff,rawAudit:AuditCommand){access(input.projectId,actor,true);projectIdOwner(input.experimentId,input.projectId);const audit=auditFor(actor,rawAudit),previous=get(input.projectId,input.experimentId);
      if(input.version!==(previous?.version??0)+1||previous&&Date.parse(audit.createdAt)<Date.parse(previous.createdAt))throw Error('Experiment version/time must append');
      const record=sealExperiment(input,actor.id,audit.createdAt,audit.reason);definitions.push(record);return record;
    },
    retire(projectId:string,id:string,expectedVersion:number,actor:Staff,rawAudit:AuditCommand){access(projectId,actor,true);const audit=auditFor(actor,rawAudit),previous=get(projectId,id);if(!previous||previous.version!==expectedVersion||previous.status==='RETIRED'||Date.parse(audit.createdAt)<Date.parse(previous.createdAt))throw Error('Stale Experiment retirement');
      const {status,createdBy,createdAt,reason,contractVersion,checksum,...draft}=assertExperiment(previous);void status;void createdBy;void createdAt;void reason;void contractVersion;void checksum;
      const record=sealExperiment({...draft,version:previous.version+1},actor.id,audit.createdAt,audit.reason,'RETIRED');definitions.push(record);return record;
    },
    get(projectId:string,id:string,actor:Staff,version?:number){access(projectId,actor);return get(projectId,id,version);},
    listByProject(projectId:string,actor:Staff){access(projectId,actor);return Object.freeze(definitions.filter(e=>e.projectId===projectId&&get(projectId,e.experimentId)===e));},
  });
  const resultRepository:ExperimentResultRepository=Object.freeze({
    appendResult(projectId:string,id:string,experimentVersion:number,expectedRevision:number,actor:Staff,rawAudit:AuditCommand){
      access(projectId,actor,true);const audit=auditFor(actor,rawAudit),experiment=get(projectId,id,experimentVersion),latest=get(projectId,id),history=resultVersions(projectId,id),previous=history.at(-1);
      if(!experiment||latest?.status==='RETIRED'||latest?.version!==experimentVersion||history.length!==expectedRevision||previous&&Date.parse(audit.createdAt)<Date.parse(previous.audit.createdAt))throw Error('Stale Experiment/result version or retired definition');
      const result=evaluateExperiment(experiment,guard.loadSources(experiment,actor,audit.createdAt),actor,audit.createdAt,history.length+1);
      const body={result,audit,previousChecksum:previous?.checksum??null},record=immutable({...body,checksum:canonicalChecksum(body)});results.push(record);return record;
    },
    getResult(projectId:string,id:string,resultVersion:number,actor:Staff){access(projectId,actor);const result=resultVersions(projectId,id).find(v=>v.result.resultVersion===resultVersion);return result?view(result,actor):undefined;},
    listResults(projectId:string,id:string,actor:Staff){access(projectId,actor);return Object.freeze(resultVersions(projectId,id).map(r=>view(r,actor)));},
  });return Object.freeze({experiments,results:resultRepository,snapshot:()=>({definitions:[...definitions],results:[...results]})});
}
