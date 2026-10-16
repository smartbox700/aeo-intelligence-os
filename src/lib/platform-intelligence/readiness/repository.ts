import {z} from 'zod';
import {auditCommandSchema,canonicalChecksum,immutable,identifier,timestamp} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {checkStatusSchema,evaluationScopeSchema,scorePolicySchema,EVALUATION_VERSION,CONFIDENCE_VERSION} from './contracts';
import type {ReadinessEvaluation,ReadinessEvidenceRef} from './contracts';

const hash=z.string().regex(/^[a-f0-9]{64}$/),reason=z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const evidenceSchema=z.strictObject({projectId:identifier,kind:z.enum(['PAGE','AUDIT','RESPONSE','OBSERVATION_CONTEXT']),id:identifier,checksum:hash,at:timestamp});
const knowledgeRef=z.strictObject({knowledgeId:identifier,version:z.number().int().positive(),role:z.enum(['CONFIRMED','SUPPORTING','EXPERIMENTAL']),checksum:hash,knowledgeType:z.enum(['FACT','OBSERVATION','HYPOTHESIS']),lastVerifiedAt:timestamp.nullable()});
const itemSchema=z.strictObject({ruleId:identifier,ruleVersion:z.number().int().positive(),ruleChecksum:hash,checkType:z.enum(['ROBOTS_ACCESS','NOINDEX','PAGE_TEXT_PRESENT','STRUCTURED_DATA_PRESENT','CITATION_PRESENT']),weight:z.number().int().positive(),status:checkStatusSchema,reasonCode:reason,evaluatedAt:timestamp,evidenceRefs:z.array(evidenceSchema),knowledgeRefs:z.array(knowledgeRef),verifiedEvidence:z.boolean(),contextComplete:z.boolean(),stale:z.boolean(),actionCandidateRefs:z.array(identifier)});
const resultSchema=z.strictObject({
  evaluationId:z.string().regex(/^readiness-[a-f0-9]{64}$/),evaluationVersion:z.literal(EVALUATION_VERSION),label:z.literal('Internal Readiness'),scope:evaluationScopeSchema,
  environment:z.enum(['PRODUCTION','SYNTHETIC']),allowDemo:z.boolean(),
  ruleSetId:identifier.nullable(),ruleSetVersion:z.number().int().positive().nullable(),ruleSetChecksum:hash.nullable(),sourceRuleSetChecksum:hash.nullable(),evidenceSelectionChecksum:hash.nullable(),scorePolicy:scorePolicySchema.nullable(),confidencePolicyVersion:z.literal(CONFIDENCE_VERSION),
  status:z.enum(['READY','PARTIAL','NOT_CONFIGURED','INVALID','STALE']),reasonCode:reason,score:z.number().min(0).max(100).nullable(),lowerBound:z.number().min(0).max(100).nullable(),upperBound:z.number().min(0).max(100).nullable(),coverage:z.number().min(0).max(1).nullable(),W:z.number().int().nonnegative(),K:z.number().int().nonnegative(),P:z.number().nonnegative(),confidence:z.enum(['HIGH','MEDIUM','LOW','INSUFFICIENT']),
  counts:z.strictObject({pass:z.number().int().nonnegative(),warn:z.number().int().nonnegative(),fail:z.number().int().nonnegative(),unknown:z.number().int().nonnegative(),notApplicable:z.number().int().nonnegative()}),items:z.array(itemSchema).max(1000),checksum:hash,
});
export function assertReadinessEvaluation(raw:ReadinessEvaluation):ReadinessEvaluation {
  const record=resultSchema.parse(raw),{checksum,...content}=record,{evaluationId,...identity}=content;
  if(checksum!==canonicalChecksum(content)||evaluationId!=='readiness-'+canonicalChecksum(identity))throw Error('Readiness evaluation checksum mismatch');
  if(record.items.some(item=>item.evaluatedAt!==record.scope.evidenceAsOf||item.evidenceRefs.some(ref=>ref.projectId!==record.scope.projectId)))throw Error('Evaluation evidence scope mismatch');
  const known=record.items.filter(i=>i.status!=='UNKNOWN'&&i.status!=='NOT_APPLICABLE'),applicable=record.items.filter(i=>i.status!=='NOT_APPLICABLE');
  const W=applicable.reduce((s,i)=>s+i.weight,0),K=known.reduce((s,i)=>s+i.weight,0),P=known.reduce((s,i)=>s+i.weight*(record.scorePolicy?.credits[i.status as 'PASS'|'WARN'|'FAIL']??0),0);
  if(W!==record.W||K!==record.K||Math.abs(P-record.P)>1e-9||record.coverage!==(W?K/W:null))throw Error('Evaluation weight/coverage mismatch');
  for(const [status,key] of [['PASS','pass'],['WARN','warn'],['FAIL','fail'],['UNKNOWN','unknown'],['NOT_APPLICABLE','notApplicable']] as const)if(record.counts[key]!==record.items.filter(i=>i.status===status).length)throw Error('Evaluation counts mismatch');
  const usable=!['INVALID','STALE','NOT_CONFIGURED'].includes(record.status)&&W>0;
  if(record.lowerBound!==(usable?100*P/W:null)||record.upperBound!==(usable?100*(P+W-K)/W:null)||record.score!==(usable&&K===W?100*P/W:null))throw Error('Evaluation score bounds mismatch');
  return immutable(record);
}
export type StoredReadinessEvaluation=Readonly<{revision:number;evaluation:ReadinessEvaluation;audit:AuditCommand;previousChecksum:string|null;checksum:string}>;
export interface PlatformReadinessRepository {
  appendEvaluation(evaluation:ReadinessEvaluation,expectedRevision:number,command:AuditCommand):StoredReadinessEvaluation;
  getEvaluation(projectId:string,evaluationId:string,actorId:string):StoredReadinessEvaluation|undefined;
  getVersion(projectId:string,revision:number,actorId:string):StoredReadinessEvaluation|undefined;
  listByProject(projectId:string,actorId:string):readonly StoredReadinessEvaluation[];
  listByPlatform(projectId:string,platformCode:string,actorId:string):readonly StoredReadinessEvaluation[];
}
export function createInMemoryReadinessRepository(guard:{authorize(actorId:string,projectId:string):boolean;ownsEvidence(projectId:string,ref:ReadinessEvidenceRef):boolean},initial:readonly StoredReadinessEvaluation[]=[]):PlatformReadinessRepository & {snapshot():StoredReadinessEvaluation[]} {
  const ledger=new Map<string,StoredReadinessEvaluation[]>();
  const authorize=(actor:string,project:string)=>{if(!guard.authorize(actor,project))throw Error('Readiness project access denied');};
  for(const record of initial){assertReadinessEvaluation(record.evaluation);const id=record.evaluation.scope.projectId;ledger.set(id,[...(ledger.get(id)??[]),immutable(structuredClone(record))].sort((a,b)=>a.revision-b.revision));}
  return Object.freeze({
    snapshot:()=>[...ledger.values()].flat(),
    appendEvaluation(raw:ReadinessEvaluation,expectedRevision:number,rawCommand:AuditCommand){
      const audit=auditCommandSchema.parse(rawCommand),evaluation=assertReadinessEvaluation(raw),projectId=evaluation.scope.projectId;authorize(audit.actorId,projectId);
      if(evaluation.items.some(i=>i.evidenceRefs.some(ref=>!guard.ownsEvidence(projectId,ref))))throw Error('Readiness evidence ownership denied');
      const history=ledger.get(projectId)??[],previous=history.at(-1);
      if(history.length!==expectedRevision)throw Error('Stale readiness revision');
      if(history.some(v=>v.evaluation.evaluationId===evaluation.evaluationId))throw Error('Immutable evaluation already exists');
      const scopeIdentity=(value:ReadinessEvaluation)=>{const {evidenceAsOf,...scope}=value.scope;void evidenceAsOf;return canonicalChecksum({scope,ruleSetId:value.ruleSetId,ruleSetVersion:value.ruleSetVersion});};
      if(evaluation.ruleSetChecksum&&!['INVALID','NOT_CONFIGURED'].includes(evaluation.status)&&history.some(v=>!['INVALID','NOT_CONFIGURED'].includes(v.evaluation.status)&&scopeIdentity(v.evaluation)===scopeIdentity(evaluation)&&v.evaluation.ruleSetChecksum!==evaluation.ruleSetChecksum))throw Error('RuleSet policy changed: append a new RuleSet version');
      if(Date.parse(audit.createdAt)<Date.parse(evaluation.scope.evidenceAsOf)||previous&&Date.parse(audit.createdAt)<Date.parse(previous.audit.createdAt))throw Error('Readiness audit time invalid');
      const content={revision:history.length+1,evaluation,audit,previousChecksum:previous?.checksum??null},record=immutable({...content,checksum:canonicalChecksum(content)});
      ledger.set(projectId,[...history,record]);return record;
    },
    getEvaluation(projectId:string,evaluationId:string,actorId:string){authorize(actorId,projectId);return ledger.get(projectId)?.find(v=>v.evaluation.evaluationId===evaluationId);},
    getVersion(projectId:string,revision:number,actorId:string){authorize(actorId,projectId);return ledger.get(projectId)?.find(v=>v.revision===revision);},
    listByProject(projectId:string,actorId:string){authorize(actorId,projectId);return Object.freeze([...(ledger.get(projectId)??[])]);},
    listByPlatform(projectId:string,platformCode:string,actorId:string){authorize(actorId,projectId);return Object.freeze((ledger.get(projectId)??[]).filter(v=>v.evaluation.scope.platformCode===platformCode));},
  });
}
