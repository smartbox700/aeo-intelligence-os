import type {PrismaClient,Prisma} from '../../../generated/prisma';
import {z} from 'zod';
import {prisma,loadDb} from '../../db';
import type {Staff} from '../../auth';
import {publicStaff} from '../../auth';
import {canonicalChecksum,immutable,auditCommandSchema,timestamp} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {PLATFORM_REGISTRY_VERSION} from '../registry';
import {createPlatformSession} from './session';
import type {PlatformSession,SessionRecord,RepositoryAuditState} from './session';
import {validateEnvelope,validatePayload,assertPrivacy,DOMAINS} from './contracts';
import type {PersistenceEnvelope,Environment} from './contracts';
import {validatePersistentReferences} from './references';

export type PersistenceConfig={storageMode?:string;enabled?:string;persistenceEnabled?:string};
export function platformPersistenceStatus(config:PersistenceConfig={storageMode:process.env.STORAGE_MODE,enabled:process.env.PLATFORM_INTELLIGENCE_ENABLED,persistenceEnabled:process.env.PLATFORM_INTELLIGENCE_PERSISTENCE_ENABLED}){
 return config.storageMode!=='postgres'?'PERSISTENCE_UNAVAILABLE':config.enabled!=='true'||config.persistenceEnabled!=='true'?'PERSISTENCE_DISABLED':'PERSISTENCE_AVAILABLE';
}
const commandAuditSchema=z.strictObject({operation:z.string().regex(/^[A-Z_]+$/).max(80),targetDomain:z.enum(DOMAINS),stableId:z.string().min(1).max(160).optional(),version:z.number().int().positive().optional()});
export type MutationAuditContext=z.infer<typeof commandAuditSchema>;
type Event={id:string;environment:Environment;revision:number;createdBy:string;createdAt:string;reason:string;details:{changes:{id:string;before:string|null;after:string;domain?:string;stableId?:string;version?:number;recordRevision?:number}[];repositoryAudits:RepositoryAuditState;command?:MutationAuditContext};previousChecksum:string|null;checksum:string};
const key=(r:Pick<SessionRecord,'domain'|'stableId'|'version'>)=>JSON.stringify([r.domain,r.stableId,r.version]);
function normalize(row:Record<string,unknown>){return {...row,createdAt:(row.createdAt as Date).toISOString()};}
export class PostgresPlatformIntelligenceRepository {
 constructor(private readonly database:PrismaClient=prisma,private readonly config?:PersistenceConfig){}
 status(){return platformPersistenceStatus(this.config);}
 async read<T>(actor:Pick<Staff,'id'>,environment:Environment,work:(session:PlatformSession,revision:number)=>T|Promise<T>):Promise<T>{return this.transaction(actor,environment,null,work);}
 async write<T>(actor:Pick<Staff,'id'>,environment:Environment,expectedRevision:number,audit:AuditCommand,work:(session:PlatformSession,revision:number)=>T|Promise<T>,command?:MutationAuditContext):Promise<T>{return this.transaction(actor,environment,{expectedRevision,audit,command},work);}
 private async transaction<T>(identity:Pick<Staff,'id'>,environment:Environment,write:{expectedRevision:number;audit:AuditCommand;command?:MutationAuditContext}|null,work:(session:PlatformSession,revision:number)=>T|Promise<T>):Promise<T>{
  if(this.status()!=='PERSISTENCE_AVAILABLE')throw Error(this.status());if(!['PRODUCTION','SYNTHETIC'].includes(environment))throw Error('Explicit Platform environment required');
  return this.database.$transaction(async tx=>{
   // Same lock as legacy writers and integrated backup; source revalidation and sidecar/audit commit are atomic.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(742910)`;
   const schema=await tx.$queryRawUnsafe<{available:boolean}[]>('SELECT to_regclass(\'public."PlatformIntelligenceRecord"\') IS NOT NULL AND to_regclass(\'public."PlatformIntelligenceAuditEvent"\') IS NOT NULL AS available');if(!schema[0].available)throw Error('PERSISTENCE_SCHEMA_UNAVAILABLE');
   const user=await tx.staffUser.findUnique({where:{id:identity.id}});if(!user||user.disabled||user.namespace!==(process.env.AEO_AUTH_NAMESPACE??'local')||user.role==='VIEWER')throw Error('Platform authenticated staff access denied');const actor=immutable(publicStaff(user));
   const audit=write?auditCommandSchema.parse(write.audit):null;if(audit&&audit.actorId!==actor.id)throw Error('Platform transaction audit actor mismatch');
   const eventRows=await tx.$queryRawUnsafe<Record<string,unknown>[]>('SELECT * FROM "PlatformIntelligenceAuditEvent" WHERE environment=$1 ORDER BY revision',environment);
   const events:Event[]=eventRows.map(row=>normalize(row) as unknown as Event);let previous:string|null=null;
   for(const [i,event] of events.entries()){const {checksum,...body}=event;if(event.revision!==i+1||event.previousChecksum!==previous||canonicalChecksum(body)!==checksum)throw Error('Platform audit chain integrity mismatch');assertPrivacy(event.details);previous=checksum;}
   const revision=events.length;if(write&&write.expectedRevision!==revision)throw Error('Stale Platform transaction revision');if(audit&&events.at(-1)&&Date.parse(audit.createdAt)<Date.parse(events.at(-1)!.createdAt))throw Error('Platform audit time reversed');
   const allProjects=(await loadDb(tx)).projects,projects=allProjects.filter(p=>actor.role==='OWNER'||actor.projectIds.includes(p.id));
   const rows=await tx.$queryRawUnsafe<Record<string,unknown>[]>('SELECT * FROM "PlatformIntelligenceRecord" WHERE environment=$1 ORDER BY domain,"stableId",version',environment);
   // Validate all envelopes before any query; non-OWNER sessions never hydrate another project's data or cross-client runs.
   const allEnvelopes=rows.map(row=>validateEnvelope(normalize(row)));
   const heads=new Map<string,string>();for(const event of events)for(const change of event.details.changes){if((heads.get(change.id)??null)!==change.before)throw Error('Platform audit record predecessor mismatch');heads.set(change.id,change.after);}
   if(heads.size!==allEnvelopes.length||allEnvelopes.some(e=>heads.get(e.id)!==e.envelopeChecksum))throw Error('Platform audit record head mismatch');
   const envelopes=allEnvelopes.filter(e=>(!e.projectId||actor.projectIds.includes(e.projectId)||actor.role==='OWNER')&&(actor.role==='OWNER'||!['INSIGHT','INSIGHT_POLICY'].includes(e.domain)));
   const knownKnowledge=new Set(envelopes.filter(e=>e.domain==='KNOWLEDGE').map(e=>e.stableId));
   const repositoryAudits:RepositoryAuditState={knowledge:events.flatMap(e=>e.details.repositoryAudits.knowledge).filter(e=>knownKnowledge.has(e.knowledgeId)),action:events.flatMap(e=>e.details.repositoryAudits.action)};
   const session=createPlatformSession(actor,environment,projects,envelopes,repositoryAudits),before=session.snapshot(),beforeMap=new Map(before.records.map(r=>[key(r),r]));
   const value=await work(session,revision),after=session.snapshot();
   const changes=after.records.filter(r=>!beforeMap.has(key(r))||canonicalChecksum(beforeMap.get(key(r))!.payload)!==canonicalChecksum(r.payload));
   if(!write){if(changes.length||canonicalChecksum(before.audit)!==canonicalChecksum(after.audit))throw Error('Read-only Platform session attempted mutation');return value;}
   const changedEnvelopes:PersistenceEnvelope[]=[];
   for(const r of changes){
    if(['KNOWLEDGE','RULE','RULESET','READINESS_POLICY','ACTION','INSIGHT_POLICY','INSIGHT'].includes(r.domain)&&actor.role!=='OWNER')throw Error('OWNER global Platform governance required');
    if(['EXECUTION','EXPERIMENT','EXPERIMENT_RESULT'].includes(r.domain)&&!['OWNER','MANAGER'].includes(actor.role))throw Error('Platform execution role denied');
    if(r.writeActor&&r.writeActor!==actor.id)throw Error('Platform payload audit actor mismatch');
    const old=envelopes.find(e=>key(e)===key(r));if(old&&(!['KNOWLEDGE','ACTION'].includes(r.domain)||['APPROVED','RETIRED'].includes((old.payload as {reviewStatus:string}).reviewStatus)))throw Error('Approved/immutable Platform version cannot be overwritten');
    validatePayload(r.domain,r.payload);validatePersistentReferences(r,after.records,session);
    const embedded=r.payload as {environment?:string;result?:{environment:string};run?:{environment:string};ref?:{kind:string}};
    const declared=embedded.environment??embedded.result?.environment??embedded.run?.environment??embedded.ref?.kind;if(declared&&declared!==environment)throw Error('Cross-environment Platform payload denied');
    const body={id:canonicalChecksum([environment,r.domain,r.stableId,r.version]),environment,domain:r.domain,stableId:r.stableId,version:r.version,recordRevision:(old?.recordRevision??0)+1,projectId:r.projectId,responseId:r.responseId,taskId:r.taskId,payload:r.payload,checksum:canonicalChecksum(r.payload),contractVersion:r.contractVersion,registryVersion:PLATFORM_REGISTRY_VERSION,createdBy:actor.id,createdAt:new Date(audit!.createdAt).toISOString(),reason:audit!.reason,previousChecksum:old?.envelopeChecksum??null};
    changedEnvelopes.push(validateEnvelope({...body,envelopeChecksum:canonicalChecksum(body)}));
   }
   if(!changes.length){if(canonicalChecksum(before.audit)!==canonicalChecksum(after.audit))throw Error('Audit-only Platform mutation denied');if(!write.command)return value;}
   const deltas={knowledge:after.audit.knowledge.slice(before.audit.knowledge.length),action:after.audit.action.slice(before.audit.action.length)};
   const details={changes:changedEnvelopes.map(e=>({id:e.id,domain:e.domain,stableId:e.stableId,version:e.version,recordRevision:e.recordRevision,before:envelopes.find(old=>old.id===e.id)?.envelopeChecksum??null,after:e.envelopeChecksum})),repositoryAudits:deltas,...(write.command?{command:commandAuditSchema.parse(write.command)}:{})};assertPrivacy(details);
   const eventBody={id:canonicalChecksum([environment,revision+1]),environment,revision:revision+1,createdBy:actor.id,createdAt:new Date(audit!.createdAt).toISOString(),reason:audit!.reason,details,previousChecksum:previous};const event={...eventBody,checksum:canonicalChecksum(eventBody)};
   for(const e of changedEnvelopes)await this.save(tx,e,envelopes.find(old=>old.id===e.id));
   await tx.$executeRawUnsafe('INSERT INTO "PlatformIntelligenceAuditEvent" (id,environment,revision,"createdBy","createdAt",reason,details,"previousChecksum",checksum) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7::jsonb,$8,$9)',event.id,event.environment,event.revision,event.createdBy,event.createdAt,event.reason,JSON.stringify(event.details),event.previousChecksum,event.checksum);
   return value;
  },{isolationLevel:'Serializable',timeout:120000,maxWait:30000});
 }
 private async save(tx:Prisma.TransactionClient,e:PersistenceEnvelope,old?:PersistenceEnvelope){
  const args=[e.id,e.environment,e.domain,e.stableId,e.version,e.recordRevision,e.projectId,e.responseId,e.taskId,JSON.stringify(e.payload),e.checksum,e.envelopeChecksum,e.contractVersion,e.registryVersion,e.createdBy,e.createdAt,e.reason,e.previousChecksum];
  if(!old){await tx.$executeRawUnsafe('INSERT INTO "PlatformIntelligenceRecord" (id,environment,domain,"stableId",version,"recordRevision","projectId","responseId","taskId",payload,checksum,"envelopeChecksum","contractVersion","registryVersion","createdBy","createdAt",reason,"previousChecksum") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16::timestamptz,$17,$18)',...args);}
  else{const n=await tx.$executeRawUnsafe('UPDATE "PlatformIntelligenceRecord" SET "recordRevision"=$6,payload=$10::jsonb,checksum=$11,"envelopeChecksum"=$12,"createdBy"=$15,"createdAt"=$16::timestamptz,reason=$17,"previousChecksum"=$18 WHERE id=$1 AND environment=$2 AND domain=$3 AND "stableId"=$4 AND version=$5 AND "projectId" IS NOT DISTINCT FROM $7::text AND "responseId" IS NOT DISTINCT FROM $8::text AND "taskId" IS NOT DISTINCT FROM $9::text AND "contractVersion"=$13 AND "registryVersion"=$14 AND "envelopeChecksum"=$19',...args,old.envelopeChecksum);if(n!==1)throw Error('Platform draft optimistic concurrency conflict');}
 }
}
