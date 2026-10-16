import {auditCommandSchema,canonicalChecksum,immutable} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {assertObservationContext} from './context';
import type {CanonicalObservationContext} from './context';

export type ObservationContextVersion=Readonly<{projectId:string;responseId:string;revision:number;context:CanonicalObservationContext;contextChecksum:string;previousChecksum:string|null;audit:AuditCommand;checksum:string}>;
export interface ObservationReferenceGuard {
  /** Trusted integration must verify actor access plus response/question/evidence/study membership. */
  authorize(actorId:string,projectId:string):boolean;
  ownsResponse(projectId:string,responseId:string,queryId:string|null):boolean;
  ownsQuery(projectId:string,queryId:string):boolean;
  ownsReference(projectId:string,id:string,kind:CanonicalObservationContext['evidenceRefs'][number]['kind']):boolean;
}
export interface ObservationPlatformContextRepository {
  append(context:CanonicalObservationContext,expectedRevision:number,command:AuditCommand):ObservationContextVersion;
  get(projectId:string,responseId:string,actorId:string):ObservationContextVersion|undefined;
  getVersion(projectId:string,responseId:string,revision:number,actorId:string):ObservationContextVersion|undefined;
  listVersions(projectId:string,responseId:string,actorId:string):readonly ObservationContextVersion[];
}
/** Test persistence adapter: isolated memory only. No app store, DB or filesystem writes. */
export function createInMemoryObservationContextRepository(guard:ObservationReferenceGuard,initial:readonly ObservationContextVersion[]=[]):ObservationPlatformContextRepository & {snapshot():ObservationContextVersion[]} {
  const versions=new Map<string,ObservationContextVersion[]>(),key=(projectId:string,responseId:string)=>JSON.stringify([projectId,responseId]);
  const authorize=(actorId:string,projectId:string)=>{if(!guard.authorize(actorId,projectId))throw Error('Project context access denied');};
  for(const record of initial){assertObservationContext(record.context);const id=key(record.projectId,record.responseId);versions.set(id,[...(versions.get(id)??[]),immutable(structuredClone(record))].sort((a,b)=>a.revision-b.revision));}
  return Object.freeze({
    snapshot:()=>[...versions.values()].flat(),
    append(raw:CanonicalObservationContext,expectedRevision:number,rawCommand:AuditCommand){
      const command=auditCommandSchema.parse(rawCommand),context=assertObservationContext(raw);authorize(command.actorId,context.projectId);
      if(!guard.ownsResponse(context.projectId,context.responseId,context.queryId)||(context.queryId&&!guard.ownsQuery(context.projectId,context.queryId))||context.evidenceRefs.some(ref=>ref.projectId!==context.projectId||!guard.ownsReference(context.projectId,ref.id,ref.kind)))throw Error('Project source reference mismatch');
      const id=key(context.projectId,context.responseId),history=versions.get(id)??[],previous=history.at(-1);
      if(expectedRevision!==history.length)throw Error('Stale context revision');
      if(previous&&Date.parse(command.createdAt)<Date.parse(previous.audit.createdAt))throw Error('Audit time precedes prior context revision');
      const content={projectId:context.projectId,responseId:context.responseId,revision:history.length+1,context,contextChecksum:context.checksum,previousChecksum:previous?.checksum??null,audit:command};
      const version=immutable({...content,checksum:canonicalChecksum(content)});versions.set(id,[...history,version]);return version;
    },
    get(projectId:string,responseId:string,actorId:string){authorize(actorId,projectId);return versions.get(key(projectId,responseId))?.at(-1);},
    getVersion(projectId:string,responseId:string,revision:number,actorId:string){authorize(actorId,projectId);return versions.get(key(projectId,responseId))?.find(v=>v.revision===revision);},
    listVersions(projectId:string,responseId:string,actorId:string){authorize(actorId,projectId);return Object.freeze([...(versions.get(key(projectId,responseId))??[])]);},
  });
}
