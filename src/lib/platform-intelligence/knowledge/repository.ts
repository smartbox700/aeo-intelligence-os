import {auditCommandSchema,knowledgeDraftSchema,assertFactApproval,canonicalChecksum,immutable,validityAt,KNOWLEDGE_REGISTRY_VERSION,timestamp} from './contracts';
import type {AuditCommand,KnowledgeDraft,KnowledgeScope,KnowledgeVersion,ValidityStatus} from './contracts';

export type KnowledgeQuery=Partial<Pick<KnowledgeDraft,'knowledgeType'>&KnowledgeScope>&{reviewStatus?:KnowledgeVersion['reviewStatus'];authorizedProjectIds?:readonly string[]};
export type KnowledgeAccess=Readonly<{authorizedProjectIds:readonly string[]}>;
export type KnowledgeAudit=Readonly<AuditCommand & {knowledgeId:string;version:number;operation:'CREATE_DRAFT'|'SUBMIT'|'APPROVE'|'RETIRE';beforeChecksum:string|null;afterChecksum:string}>;
export interface PlatformKnowledgeRepository {
  list(query?:KnowledgeQuery):readonly KnowledgeVersion[];
  get(id:string,access?:KnowledgeAccess):KnowledgeVersion|undefined;
  getVersion(id:string,version:number,access?:KnowledgeAccess):KnowledgeVersion|undefined;
  listVersions(id:string,access?:KnowledgeAccess):readonly KnowledgeVersion[];
  createDraft(input:KnowledgeDraft,command:AuditCommand):KnowledgeVersion;
  submitForReview(id:string,version:number,command:AuditCommand):KnowledgeVersion;
  approve(id:string,version:number,command:AuditCommand):KnowledgeVersion;
  retire(id:string,version:number,command:AuditCommand):KnowledgeVersion;
  inspect(id:string,version:number,at:string,access?:KnowledgeAccess):Readonly<{record:KnowledgeVersion;validity:ValidityStatus}>|undefined;
}
/** Explicitly ephemeral. Production persistence and authorization must wrap this contract. */
export function createInMemoryKnowledgeRepository(initial?:{records:readonly KnowledgeVersion[];audit:readonly KnowledgeAudit[]}):PlatformKnowledgeRepository & {auditTrail():readonly KnowledgeAudit[];snapshot():{records:KnowledgeVersion[];audit:KnowledgeAudit[]}} {
  const records=new Map<string,Map<number,KnowledgeVersion>>(),audit:KnowledgeAudit[]=[];
  const visible=(v:KnowledgeVersion,access?:KnowledgeAccess)=>!v.scope.projectId||!!access?.authorizedProjectIds.includes(v.scope.projectId);
  const latest=(id:string)=>[...(records.get(id)?.values()??[])].sort((a,b)=>b.version-a.version)[0];
  function save(draft:KnowledgeDraft,status:KnowledgeVersion['reviewStatus'],raw:AuditCommand,operation:KnowledgeAudit['operation'],before?:KnowledgeVersion){
    const command=auditCommandSchema.parse(raw);
    const prior=audit.filter(event=>event.knowledgeId===draft.knowledgeId).at(-1);
    if(prior&&Date.parse(command.createdAt)<Date.parse(prior.createdAt))throw Error('Audit time precedes prior revision');
    const content={...structuredClone(draft),reviewStatus:status,...command,createdAt:before?.version===draft.version?before.createdAt:command.createdAt,registryVersion:KNOWLEDGE_REGISTRY_VERSION};
    const record=immutable({...content,checksum:canonicalChecksum(content)});
    const versions=records.get(record.knowledgeId)??new Map<number,KnowledgeVersion>();versions.set(record.version,record);records.set(record.knowledgeId,versions);
    audit.push(immutable({...command,knowledgeId:record.knowledgeId,version:record.version,operation,beforeChecksum:before?.checksum??null,afterChecksum:record.checksum}));
    return record;
  }
  function pending(id:string,version:number,status:KnowledgeVersion['reviewStatus']){
    const record=records.get(id)?.get(version);
    if(!record||record!==latest(id)||record.reviewStatus!==status)throw Error('Invalid or stale review transition');return record;
  }
  function draftOf(v:KnowledgeVersion):KnowledgeDraft {
    const {checksum,registryVersion,reviewStatus,actorId,createdAt,reason,...draft}=v;void checksum;void registryVersion;void reviewStatus;void actorId;void createdAt;void reason;return draft;
  }
  for(const record of initial?.records??[]){const versions=records.get(record.knowledgeId)??new Map<number,KnowledgeVersion>();versions.set(record.version,immutable(structuredClone(record)));records.set(record.knowledgeId,versions);}audit.push(...(initial?.audit??[]).map(v=>immutable(structuredClone(v))));
  const repository:PlatformKnowledgeRepository & {auditTrail():readonly KnowledgeAudit[];snapshot():{records:KnowledgeVersion[];audit:KnowledgeAudit[]}}={
    list(query={}){
      const {authorizedProjectIds,reviewStatus,knowledgeType,...scope}=query;
      return Object.freeze([...records.keys()].sort().flatMap(id=>{const v=latest(id);return v&&visible(v,{authorizedProjectIds:authorizedProjectIds??[]})&&(!reviewStatus||v.reviewStatus===reviewStatus)&&(!knowledgeType||v.knowledgeType===knowledgeType)&&Object.entries(scope).every(([k,value])=>value===undefined||Reflect.get(v.scope,k)===value)?[v]:[];}));
    },
    get(id,access){const v=latest(id);return v&&visible(v,access)?v:undefined;},
    getVersion(id,version,access){const v=records.get(id)?.get(version);return v&&visible(v,access)?v:undefined;},
    listVersions(id,access){return Object.freeze([...(records.get(id)?.values()??[])].filter(v=>visible(v,access)).sort((a,b)=>a.version-b.version));},
    createDraft(input,raw){
      const draft=knowledgeDraftSchema.parse(input),command=auditCommandSchema.parse(raw),previous=latest(draft.knowledgeId);
      if(draft.provenance.reviewedAt||draft.provenance.reviewedBy)throw Error('Draft cannot self-approve');
      if(draft.version!==(previous?.version??0)+1)throw Error('Version must append; overwrite is forbidden');
      if(previous?draft.supersedes?.knowledgeId!==previous.knowledgeId||draft.supersedes.version!==previous.version:!!draft.supersedes)throw Error('supersedes must identify the prior version');
      // New versions can change type only through a fresh human review and official-source gate.
      return save(draft,'DRAFT',command,'CREATE_DRAFT',previous);
    },
    submitForReview(id,version,command){return save(draftOf(pending(id,version,'DRAFT')),'REVIEW_REQUIRED',command,'SUBMIT',latest(id));},
    approve(id,version,raw){
      const record=pending(id,version,'REVIEW_REQUIRED'),command=auditCommandSchema.parse(raw),draft=draftOf(record);
      assertFactApproval(draft,command);
      if(Date.parse(draft.provenance.capturedAt)>Date.parse(command.createdAt))throw Error('Evidence captured in the future');
      if(validityAt({...record,reviewStatus:'APPROVED'},command.createdAt)!=='CURRENT')throw Error('Cannot approve non-current knowledge');
      draft.provenance={...draft.provenance,reviewedBy:command.actorId,reviewedAt:command.createdAt};
      return save(draft,'APPROVED',command,'APPROVE',record);
    },
    retire(id,version,command){
      const record=pending(id,version,'APPROVED');
      return save({...draftOf(record),version:version+1,supersedes:{knowledgeId:id,version}},'RETIRED',command,'RETIRE',record);
    },
    inspect(id,version,at,access){timestamp.parse(at);const record=repository.getVersion(id,version,access);const retired=[...(records.get(id)?.values()??[])].some(v=>v.reviewStatus==='RETIRED'&&v.version>version&&Date.parse(v.createdAt)<=Date.parse(at));return record?Object.freeze({record,validity:retired?'RETIRED':validityAt(record,at)}):undefined;},
    auditTrail:()=>Object.freeze([...audit]),
    snapshot:()=>({records:[...records.values()].flatMap(v=>[...v.values()]),audit:[...audit]}),
  };
  return Object.freeze(repository);
}

// No production Knowledge seed, including no synthetic examples or platform claims.
export const productionKnowledge:readonly KnowledgeVersion[]=Object.freeze([]);
