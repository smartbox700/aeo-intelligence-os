import type {Staff} from '../src/lib/auth';
import type {ResponseRecord} from '../src/lib/types';
import type {StudioWork} from '../src/lib/studio-types';
import {readinessFixture} from './platform-readiness.fixture';
import {command,at} from './platform-knowledge.fixture';
import {createReadinessRuleSet} from '../src/lib/platform-intelligence/readiness/contracts';
import {evaluatePlatformReadiness} from '../src/lib/platform-intelligence/readiness/engine';
import {createInMemoryActionDefinitionRepository} from '../src/lib/platform-intelligence/actions/definitions';
import type {ActionDraft} from '../src/lib/platform-intelligence/actions/definitions';
import type {ActionExecutionView} from '../src/lib/platform-intelligence/actions/bridge';
import {canonicalChecksum} from '../src/lib/platform-intelligence/knowledge/contracts';
import {freezeExperimentMeasurement} from '../src/lib/platform-intelligence/experiments/snapshots';
import {sealExperiment} from '../src/lib/platform-intelligence/experiments/contracts';
import type {ExperimentDraft} from '../src/lib/platform-intelligence/experiments/contracts';
export const actor:Staff={id:'SYNTHETIC_REVIEWER',username:'test',name:'SYNTHETIC TEST ONLY',role:'OWNER',projectIds:[],disabled:false};
export const resultAt='2026-10-18T00:00:00Z',appliedAt='2026-10-16T00:00:00Z';
/** All inputs are generated test data. PRODUCTION here exercises contract gates only; no production seeds are registered. */
export function experimentFixture(environment:'PRODUCTION'|'SYNTHETIC'='SYNTHETIC'){
  const f=readinessFixture();f.page.body='';const binding=createReadinessRuleSet({...f.policyInput,environment},f.catalog);
  const readiness=evaluatePlatformReadiness({project:f.project,scope:f.scope,ruleSet:binding,catalog:f.catalog,knowledge:f.knowledge});
  const template=structuredClone(f.response);f.project.responses=[];
  function response(id:string,phase:'BASELINE'|'FOLLOW_UP',run:number,mentioned:boolean):ResponseRecord{
    const r=structuredClone(template);r.id=id;r.observedAt=phase==='BASELINE'?'2026-10-15T12:00:00Z':'2026-10-17T12:00:00Z';r.createdAt=r.observedAt;r.consumer!.answerRecordedAt=r.observedAt;r.consumer!.questionSubmittedAt=r.observedAt;r.consumer!.phase=phase;r.consumer!.repetition=run;r.consumer!.inputKey='SYNTHETIC_'+id;
    r.rawText='SYNTHETIC ONLY '+id;r.verification={status:'VERIFIED',reviewer:actor.id,sourceConfirmed:true,note:'SYNTHETIC verified source fixture',at:r.observedAt,history:[]};
    r.entityAnalysis={version:'context-entity-v1',method:'ADMIN_REVIEW',status:'READY',generalGuidance:false,reviewHistory:[],entities:mentioned?[{id:'ENTITY_'+id,name:f.project.client.name,matchedEntityId:f.project.client.id,role:'client',context:'RECOMMENDATION',introductionOrder:1,confidence:'HIGH',evidenceQuote:'SYNTHETIC',start:0,end:9,identityReason:'SYNTHETIC',sourceUrls:[],review:'ACCEPTED'}]:[]};
    r.citations=mentioned?[f.project.client.website]:[];return r;
  }
  f.project.responses.push(response('B1','BASELINE',1,false),response('B2','BASELINE',2,false),response('A1','FOLLOW_UP',1,true),response('A2','FOLLOW_UP',2,true));
  const definitions=createInMemoryActionDefinitionRepository(),draft:ActionDraft={actionId:'SYNTHETIC_EXPERIMENT_ACTION',version:1,environment,name:'Review approved page',description:'SYNTHETIC ONLY',category:'EVIDENCE',industryScopes:['MEDICAL'],platformScopes:['CHATGPT'],channelScopes:['CHATGPT_WEB_SEARCH'],applicableFindingStatuses:['FAIL'],applicableCheckTypes:['PAGE_TEXT_PRESENT'],executionMode:'MANUAL_VERIFICATION',objective:'Verify approved page record',requiredInputs:[],expectedOutputs:[],approvalRequirements:{clientApproval:true,internalReview:true},complianceRequirements:['MEDICAL_REVIEW'],evidenceRequirements:['PAGE'],estimatedEffortMetadata:{size:'UNKNOWN',minMinutes:null,maxMinutes:null},effectClaimStatus:'NO_EFFECT_CLAIM',knowledgeRefs:[],ruleRefs:[],dependencies:[],effectiveAt:at,retiredAt:null};
  definitions.createDraft(draft,actor,command());definitions.submitForReview(draft.actionId,1,actor,command());const action=definitions.approve(draft.actionId,1,actor,command());
  const task=f.project.tasks[0];
  // Test double for the trusted 8-5 CURRENT projection. Real Studio approval/application is covered by platform-actions.test.ts.
  task.studio={verification:{mode:'MANUAL',page:{kind:'MANUAL'}}} as StudioWork;
  const body={executionId:'SYNTHETIC_EXECUTION',revision:1,projectId:f.project.id,evaluationId:readiness.evaluationId,evaluationChecksum:readiness.checksum,selection:{ruleId:readiness.items[0].ruleId,ruleVersion:1,actionId:action.actionId,actionVersion:1,actionChecksum:action.checksum},environment,
    references:{taskId:task.id,plannedAt:null,actualAppliedAt:appliedAt,proofRefs:[{projectId:f.project.id,kind:'PAGE' as const,id:f.page.id}]},sourceChecksum:canonicalChecksum('SYNTHETIC_SOURCE'),previousChecksum:null,audit:command(appliedAt)};
  const views:ActionExecutionView[]=[{record:{...body,checksum:canonicalChecksum(body)},sourceState:'CURRENT',currentActualAppliedAt:appliedAt,taskStatus:task.status,executionStatus:null,studioState:null,pilotWorkStatus:null}];
  function snapshot(phase:'BASELINE'|'FOLLOW_UP'){
    const before=phase==='BASELINE';return freezeExperimentMeasurement(f.project,{sourceId:before?'SYNTHETIC_BEFORE':'SYNTHETIC_AFTER',environment,questionIds:f.project.questions.map(q=>q.id),studyId:null,phase,from:before?'2026-10-15T01:00:00Z':'2026-10-17T00:00:00Z',to:before?'2026-10-15T23:00:00Z':'2026-10-17T23:00:00Z',frozenAt:before?'2026-10-15T23:00:00Z':'2026-10-17T23:00:00Z'},f.supplements);
  }
  function inputs(){const before=snapshot('BASELINE'),after=snapshot('FOLLOW_UP');const input:ExperimentDraft={experimentId:'SYNTHETIC_EXPERIMENT',version:1,projectId:f.project.id,platformCode:'CHATGPT',channelCode:'CHATGPT_WEB_SEARCH',environment,issueRef:null,readinessEvaluationId:readiness.evaluationId,readinessItemRef:{ruleId:readiness.items[0].ruleId,ruleVersion:1},beforeSnapshotRef:before.ref,afterSnapshotRef:after.ref,actionExecutionRefs:views.map(v=>({executionId:v.record.executionId,revision:v.record.revision,checksum:v.record.checksum,actionId:action.actionId,actionVersion:1,actionChecksum:action.checksum,role:'PRIMARY'})),querySetRef:before.querySetRef,measurementPlanRef:before.measurementPlanRef,metric:{namespace:'confirmedMetrics',metricId:'Brand Mention Rate',metricVersion:'verified-observation-v1'},window:{beforeFrom:before.selection.from,beforeTo:before.selection.to,afterFrom:after.selection.from,afterTo:after.selection.to},confounders:[],consentRefs:[]};
    return {input,experiment:sealExperiment(input,actor.id,resultAt,'SYNTHETIC reviewed scope'),sources:{project:f.project,before,after,definitions,actionViews:views,readiness}};
  }
  return {...f,readiness,definitions,action,views,response,snapshot,inputs};
}
