import {z} from 'zod';
import type {Staff} from '../../auth';
import type {ProjectData} from '../../types';
import {assertStudioApproved} from '../../studio-workflow';
import {ownPilot,assertPilotActive,assertPermission} from '../../pilot-common';
import {canonicalChecksum,immutable,identifier,timestamp,auditCommandSchema} from '../knowledge/contracts';
import type {AuditCommand} from '../knowledge/contracts';
import {assertActionAccess,prepareActionWorkRequest} from './candidates';
import type {ActionCandidateInput,ActionSelection} from './candidates';

const proofSchema=z.strictObject({projectId:identifier,kind:z.enum(['PAGE','EVIDENCE','STUDIO_VERSION','APPROVAL','PILOT_DOCUMENT']),id:identifier,version:z.number().int().positive().optional()});
const linkInputSchema=z.strictObject({taskId:identifier,proposalId:identifier.optional(),proposalVersion:z.number().int().positive().optional(),studioVersion:z.number().int().positive().optional(),pilotAgreementId:identifier.optional(),pilotWorkId:identifier.optional(),plannedAt:timestamp.nullable(),actualAppliedAt:timestamp.nullable(),proofRefs:z.array(proofSchema).max(100)});
export type ActionLinkInput=z.infer<typeof linkInputSchema>;
export type ActionExecutionLink=Readonly<{
  executionId:string;revision:number;projectId:string;evaluationId:string;evaluationChecksum:string;selection:ActionSelection;environment:'PRODUCTION'|'SYNTHETIC';
  references:ActionLinkInput;sourceChecksum:string;previousChecksum:string|null;audit:AuditCommand;checksum:string;
}>;
export type ActionExecutionView=Readonly<{record:ActionExecutionLink;sourceState:'CURRENT'|'SOURCE_CHANGED'|'SOURCE_MISSING';currentActualAppliedAt:string|null;taskStatus:ProjectData['tasks'][number]['status']|null;executionStatus:NonNullable<ProjectData['tasks'][number]['execution']>['status']|null;studioState:NonNullable<ProjectData['tasks'][number]['studio']>['state']|null;pilotWorkStatus:'TODO'|'IN_PROGRESS'|'BLOCKED'|'DONE'|'EXCLUDED'|null}>;
export interface ActionExecutionLinkRepository {
  linkExistingTask(input:ActionCandidateInput,selection:ActionSelection,references:ActionLinkInput,expectedRevision:number,audit:AuditCommand):ActionExecutionLink;
  listByProject(projectId:string,actor:Staff):readonly ActionExecutionView[];
  getVersion(projectId:string,executionId:string,revision:number,actor:Staff):ActionExecutionLink|undefined;
}
function source(project:ProjectData,input:ActionLinkInput){
  const task=project.tasks.find(t=>t.id===input.taskId);if(!task)throw Error('Existing project Task required');
  const proposalId=task.studio?.proposalId??task.execution?.proposalId;
  const proposal=proposalId?project.operations?.proposals.find(p=>p.id===proposalId&&p.taskId===task.id):undefined;
  if(input.proposalId!==undefined&&(proposal?.id!==input.proposalId||proposal.versions.at(-1)?.version!==input.proposalVersion))throw Error('Current project Proposal/version required');
  if(input.proposalVersion!==undefined&&!input.proposalId)throw Error('Proposal ID required');
  if(input.studioVersion!==undefined&&task.studio?.versions.at(-1)?.version!==input.studioVersion)throw Error('Current Studio task/version required');
  if(!!input.pilotAgreementId!==!!input.pilotWorkId)throw Error('Pilot agreement and work IDs required together');
  const agreement=input.pilotAgreementId?ownPilot(project,input.pilotAgreementId):undefined;
  const work=agreement?.work.find(w=>w.id===input.pilotWorkId&&w.taskId===task.id);
  if(agreement&&!work)throw Error('Project Pilot work/task mismatch');
  if(work&&work.taskVersion!==null&&work.taskVersion!==proposal?.versions.at(-1)?.version)throw Error('Stale Pilot work version');
  const proofs=input.proofRefs.map(ref=>{
    if(ref.projectId!==project.id)throw Error('Cross-project Action evidence denied');
    let value:unknown;
    if(ref.kind==='PAGE')value=project.client.studioRepository?.pages.find(p=>p.id===ref.id)??(task.studio?.verification?.page.id===ref.id?task.studio.verification.page:undefined);
    if(ref.kind==='EVIDENCE')value=project.client.evidenceFiles?.find(e=>e.id===ref.id);
    if(ref.kind==='STUDIO_VERSION'&&ref.id===task.id)value=task.studio?.versions.find(v=>v.version===ref.version);
    if(ref.kind==='APPROVAL'&&ref.id===proposal?.id&&proposal.approval.version===ref.version&&proposal.approval.status==='APPROVED')value=proposal.approval;
    if(ref.kind==='PILOT_DOCUMENT')value=project.operations?.pilot?.documents.find(d=>d.id===ref.id&&d.projectId===project.id);
    if(!value)throw Error('Owned existing Action proof required');return {ref,checksum:canonicalChecksum(value)};
  });
  return {task,proposal,agreement,work,checksum:canonicalChecksum({task,proposal:proposal??null,agreement:agreement??null,proofs,profile:project.operations?.onboarding.profile??null,studioSources:task.studio?project.client.studioRepository??null:null})};
}
export function createInMemoryActionExecutionRepository(guard:{readProject(projectId:string,actor:Staff):ProjectData},initial:readonly ActionExecutionLink[]=[]):ActionExecutionLinkRepository & {snapshot():ActionExecutionLink[]}{
  const records:ActionExecutionLink[]=initial.map(v=>immutable(structuredClone(v)));
  function projectFor(id:string,actor:Staff,write=false){assertActionAccess(actor,id,write);const p=guard.readProject(id,actor);if(p.id!==id)throw Error('Project repository scope mismatch');return p;}
  function view(record:ActionExecutionLink,project:ProjectData){
    try{const current=source(project,record.references);let changed=current.checksum!==record.sourceChecksum;if(record.references.actualAppliedAt)try{assertStudioApproved(structuredClone(project),record.references.taskId);}catch{changed=true;}return immutable({record,sourceState:changed?'SOURCE_CHANGED' as const:'CURRENT' as const,currentActualAppliedAt:changed?null:record.references.actualAppliedAt,taskStatus:current.task.status,executionStatus:current.task.execution?.status??null,studioState:current.task.studio?.state??null,pilotWorkStatus:current.work?.status??null});}
    catch{return immutable({record,sourceState:'SOURCE_MISSING' as const,currentActualAppliedAt:null,taskStatus:null,executionStatus:null,studioState:null,pilotWorkStatus:null});}
  }
  return Object.freeze({
    snapshot:()=>[...records],
    linkExistingTask(input:ActionCandidateInput,selection:ActionSelection,raw:ActionLinkInput,expectedRevision:number,rawAudit:AuditCommand){
      const audit=auditCommandSchema.parse(rawAudit);if(audit.actorId!==input.actor.id||audit.createdAt!==input.asOf)throw Error('Actor and command time mismatch');
      const project=projectFor(input.project.id,input.actor,true),request=prepareActionWorkRequest({...input,project},selection),refs=linkInputSchema.parse(raw),current=source(project,refs);
      const action=input.definitions.getVersion(selection.actionId,selection.actionVersion)!;
      if(refs.actualAppliedAt){
        const ctx=assertStudioApproved(structuredClone(project),refs.taskId),version=ctx.version.version,work=ctx.work;
        if(refs.studioVersion!==version||refs.proposalId!==ctx.proposal.id||refs.proposalVersion!==version)throw Error('Explicit current application version required');
        if(!work.deployment||work.deployment.version!==version||work.deployment.at!==refs.actualAppliedAt||!work.exports.some(e=>e.version===version)||!work.verification?.passed||work.verification.version!==version)throw Error('Verified current Studio deployment required');
        if(Date.parse(refs.actualAppliedAt)>Date.parse(input.asOf)||Date.parse(work.verification.at)>Date.parse(input.asOf)||Date.parse(work.verification.at)<Date.parse(refs.actualAppliedAt)||!ctx.proposal.approval.at||Date.parse(refs.actualAppliedAt)<Date.parse(ctx.proposal.approval.at))throw Error('Application chronology invalid');
        if(input.evaluation.environment==='PRODUCTION'&&work.verification.mode==='DEMO')throw Error('DEMO application excluded from production');
        if((current.task.reviewRequired||current.task.regulatoryReview)&&current.task.reviewStatus!=='APPROVED')throw Error('Existing task compliance review required');
        const profile=project.operations?.onboarding.profile;
        if((profile==='MEDICAL'||profile==='LEGAL'||action.complianceRequirements.length>0)&&(!ctx.proposal.legalReviewRequired||!ctx.proposal.legalReviewed||ctx.proposal.legalNote.trim().length<5))throw Error('Current compliance review required');
        if(!refs.proofRefs.some(p=>p.kind==='PAGE'&&p.id===work.verification!.page.id))throw Error('Verified application page proof required');
        for(const kind of action.evidenceRequirements)if(!refs.proofRefs.some(p=>p.kind===kind))throw Error('Action required proof missing');
        if(current.agreement){assertPilotActive(current.agreement);if(current.work?.type==='WEBSITE')assertPermission(current.agreement,'WEBSITE_MODIFICATION',input.asOf.slice(0,10));if(current.work?.type==='CONTENT')assertPermission(current.agreement,'CONTENT_PUBLICATION',input.asOf.slice(0,10));
          // Pilot completion carries the existing scope/consent/compliance checks. A planned work item is not application proof.
          if(current.work?.status!=='DONE'||current.work.completion?.version!==version||!current.work.compliance||current.work.compliance.version!==version||(current.work.compliance.externalRequired&&!current.work.compliance.externalCompleted))throw Error('Existing completed Pilot compliance evidence required');}
      }
      const executionId='action-execution-'+canonicalChecksum({projectId:project.id,evaluationId:request.evaluationId,selection,taskId:refs.taskId}),history=records.filter(r=>r.executionId===executionId),previous=history.at(-1);
      if(history.length!==expectedRevision||previous&&Date.parse(audit.createdAt)<Date.parse(previous.audit.createdAt))throw Error('Stale Action execution revision/time');
      const latest=records.filter(r=>!records.some(other=>other.executionId===r.executionId&&other.revision>r.revision));
      for(const existing of latest){if(existing.executionId===executionId||existing.projectId!==project.id||existing.selection.ruleId!==selection.ruleId||existing.selection.ruleVersion!==selection.ruleVersion||existing.selection.actionId!==selection.actionId||existing.selection.actionVersion!==selection.actionVersion)continue;
        const task=project.tasks.find(t=>t.id===existing.references.taskId);if(task&&task.status!=='DONE'&&task.execution?.status!=='DONE')throw Error('Duplicate active finding/Action task link');}
      const content={executionId,revision:history.length+1,projectId:project.id,evaluationId:request.evaluationId,evaluationChecksum:request.evaluationChecksum,selection:structuredClone(selection),environment:input.evaluation.environment,references:refs,sourceChecksum:current.checksum,previousChecksum:previous?.checksum??null,audit};
      const record=immutable({...content,checksum:canonicalChecksum(content)});records.push(record);return record;
    },
    listByProject(projectId:string,actor:Staff){const p=projectFor(projectId,actor);return Object.freeze(records.filter(r=>r.projectId===projectId&&!records.some(v=>v.executionId===r.executionId&&v.revision>r.revision)).map(r=>view(r,p)));},
    getVersion(projectId:string,id:string,revision:number,actor:Staff){projectFor(projectId,actor);return records.find(r=>r.projectId===projectId&&r.executionId===id&&r.revision===revision);},
  });
}
