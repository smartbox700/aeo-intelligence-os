import {z} from 'zod';
import {createHash} from 'node:crypto';
import type {ProjectData,ResponseRecord} from '../../types';
import {generateQueries,categories} from '../../cited-diagnosis';
import {buildObservationContext} from './context';
import type {ObservationInput,CanonicalObservationContext} from './context';

const supplementsSchema=z.strictObject({
  language:z.string().optional(),modelVersion:z.string().optional(),
  loggedIn:z.enum(['YES','NO','UNKNOWN']).optional(),personalizationState:z.enum(['ENABLED','DISABLED','UNKNOWN']).optional(),freshConversation:z.enum(['TRUE','FALSE','UNKNOWN']).optional(),
});
export type ObservationSupplements=z.infer<typeof supplementsSchema>;
function ownedResponse(project:ProjectData,responseId:string):ResponseRecord {
  const response=project.responses.find(value=>value.id===responseId);
  if(!response||!project.questions.some(q=>q.id===response.questionId))throw Error('Project response/question reference missing');
  return response;
}
function recordedModel(model:string){
  const known=!!model.trim()&&!/^(unknown|미상|미확인|미표시|확인 불가|not shown|unavailable|auto|자동|manual|수동)(?:\b|$|\s)/i.test(model.trim());
  return {modelName:known?model:null,modelDisplay:model.trim()?model:null,modelStatus:known?'KNOWN' as const:'UNKNOWN' as const};
}
function responseInput(project:ProjectData,response:ResponseRecord,raw:ObservationSupplements):ObservationInput {
  const extra=supplementsSchema.parse(raw),c=response.consumer;
  const texts=[c?.actualQuestion,response.measurement?.questionText,response.questionText].filter((v):v is string=>v!==undefined);
  const sourceIssues:NonNullable<ObservationInput['sourceIssues']>=[];
  if(new Set(texts).size>1)sourceIssues.push('QUESTION_TEXT_CONFLICT');
  if(c?.projectId&&c.projectId!==project.id)sourceIssues.push('PROJECT_MISMATCH');
  if(c&&c.method!==response.kind)sourceIssues.push('METHOD_CONFLICT');
  if(c&&c.answerRecordedAt!==response.observedAt)sourceIssues.push('OBSERVED_AT_CONFLICT');
  const evidenceRefs:NonNullable<ObservationInput['evidenceRefs']>=(c?.evidenceIds??[]).map(id=>{
    if(!project.client.evidenceFiles?.some(file=>file.id===id))throw Error('Project evidence reference missing');
    return {projectId:project.id,id,kind:'EVIDENCE'};
  });
  const search=c?(c.searchUsage==='USED'?'TRUE':c.searchUsage==='NOT_USED'?'FALSE':'UNKNOWN'):response.measurement?.status==='SUCCEEDED'?(response.measurement.searchUsed?'TRUE':'FALSE'):'UNKNOWN';
  if(c&&response.measurement&&c.searchUsage!=='UNKNOWN'&&((c.searchUsage==='USED')!==response.measurement.searchUsed))sourceIssues.push('SEARCH_CONFLICT');
  let sourceDomain:ObservationInput['sourceDomain']=c?'CONSUMER':response.measurement?'API':'LEGACY';
  if(c?.studyId){
    const study=project.client.researchStudies?.find(study=>study.id===c.studyId);
    if(!study||study.kind!==response.kind||c.repetition>study.repetitions||c.phase==='UNASSIGNED')sourceIssues.push('STUDY_MISMATCH');
    if(study&&!study.conditions.some(condition=>condition.questionId===response.questionId&&condition.screen===c.screen&&condition.actualQuestion===c.actualQuestion&&condition.model===response.model&&condition.country===c.country&&condition.region===response.region))sourceIssues.push('STUDY_CONDITION_MISMATCH');
    if(study){sourceDomain='RESEARCH';evidenceRefs.push({projectId:project.id,id:study.id,kind:'STUDY'});}
    const scan=project.client.preScanRepository?.scans.find(scan=>scan.studyId===c.studyId);
    if(scan){sourceDomain='PRESCAN';evidenceRefs.push({projectId:project.id,id:scan.id,kind:'PRESCAN'});}
    const plans=project.operations?.pilot?.agreements.flatMap(agreement=>agreement.plans).filter(plan=>plan.studyId===c.studyId)??[];
    if(plans.length){sourceDomain='PILOT';for(const plan of plans)evidenceRefs.push({projectId:project.id,id:plan.id,kind:'PLAN'});}
  }
  // Never copy observer, API request/response IDs, rawOutput, citation URLs or raw response.
  return {
    projectId:project.id,responseId:response.id,queryId:response.questionId,queryText:texts[0]??null,
    provider:response.provider,consumerScreen:c?.screen,observationMethod:response.kind,
    ...recordedModel(response.model),modelVersion:extra.modelVersion??null,
    intent:project.questions.find(q=>q.id===response.questionId)?.intent||null,
    country:c?.country||null,region:response.region||null,language:extra.language??null,
    searchUsed:search,loggedIn:extra.loggedIn,personalizationState:extra.personalizationState,freshConversation:extra.freshConversation,
    studyId:c?.studyId??null,phase:c?.phase??null,runNumber:c?.repetition??null,
    observedAt:response.observedAt||null,evidenceRefs,sourceDomain,sourceIssues,
  };
}
export function buildResponseObservationContext(project:ProjectData,responseId:string,extra:ObservationSupplements={}):CanonicalObservationContext {
  return buildObservationContext(responseInput(project,ownedResponse(project,responseId),extra));
}
export function buildCitedObservationContext(project:ProjectData,snapshotId:string,responseId:string,extra:ObservationSupplements={}):CanonicalObservationContext {
  const response=ownedResponse(project,responseId),snapshot=project.client.citedDiagnoses?.find(s=>s.id===snapshotId);
  if(!snapshot?.responseIds.includes(responseId)||response.kind!=='MANUAL_OBSERVATION')throw Error('Project CITED snapshot/response reference mismatch');
  if(createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex')!==snapshot.digest)throw Error('CITED snapshot digest mismatch');
  const queries=generateQueries(snapshot.data.profile);
  const matches=snapshot.data.observations.filter(o=>{
    const query=queries.find(q=>q.id===o.queryId);
    const date=o.observedAt.length===16?o.observedAt+':00+09:00':o.observedAt;
    return o.status==='observed'&&query?.text===response.questionText&&o.platform===response.provider&&o.model===response.model&&o.rawText===response.rawText&&new Date(date).toISOString()===response.observedAt;
  });
  if(matches.length!==1)throw Error('CITED historical observation link is ambiguous or missing');
  const o=matches[0],query=queries.find(q=>q.id===o.queryId)!;
  const input=responseInput(project,response,extra);
  return buildObservationContext({...input,platformName:o.platform,queryText:query.text,intent:categories[query.type],sourceDomain:'CITED',evidenceRefs:[...(input.evidenceRefs??[]),{projectId:project.id,id:snapshot.id,kind:'SNAPSHOT'}]});
}
