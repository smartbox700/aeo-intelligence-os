import {assertLiveAIEnabled} from './live-ai';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getStore,mutate} from './store';
import {OpenAIWebSearchAdapter,measurementConfig,ProviderFailure} from './openai-provider';
import {extractEntities,mentionsFromAnalysis} from './entity-analysis';
import type {MeasurementBatch,ProjectData,ResponseRecord,Store} from './types';
import type {ProviderAdapter} from './providers';

export const measurementInput=z.object({projectId:z.string(),questionIds:z.array(z.string()).min(1).max(3),provider:z.literal('OpenAI'),region:z.string().trim().min(1).max(200),idempotencyKey:z.uuid(),confirmedBatch:z.boolean().default(false)});
type Input=z.infer<typeof measurementInput>;
type Repository={read:()=>Promise<Store>;mutate:<T>(fn:(s:Store)=>T|Promise<T>)=>Promise<T>};
export const productionRepository:Repository={read:getStore,mutate};
export function ownedProject(s:Store,id:string):ProjectData{const p=s.projects.find(p=>p.id===id&&p.organizationId==='local-org');if(!p)throw new Error('프로젝트를 찾을 수 없습니다.');return p;}
export async function runMeasurement(input:Input,adapter:ProviderAdapter=new OpenAIWebSearchAdapter(),repo:Repository=productionRepository){
 const config=measurementConfig();if(adapter.kind==='API_OBSERVATION')assertLiveAIEnabled();if(adapter.kind==='API_OBSERVATION'&&!config.configured)throw new Error('OPENAI_API_KEY 미설정. 수동 응답 입력을 이용하세요.');
 const ids=[...new Set(input.questionIds)];if(ids.length!==input.questionIds.length)throw new Error('중복 질문을 선택할 수 없습니다.');if(ids.length>config.maxQuestions)throw new Error(`한 번에 최대 ${config.maxQuestions}개 질문만 실행할 수 있습니다.`);if(ids.length>1&&!input.confirmedBatch)throw new Error('여러 질문 실행은 예상 호출 수를 확인하고 승인해야 합니다.');
 const reservation=await repo.mutate(s=>{
  const p=ownedProject(s,input.projectId);const batches=p.batches??=[];
  const existing=batches.find(b=>b.idempotencyKey===input.idempotencyKey);
  if(existing){if(JSON.stringify(existing.questionIds)!==JSON.stringify(ids)||existing.region!==input.region||existing.provider!==input.provider)throw new Error('같은 실행 키에 다른 조건을 사용할 수 없습니다.');return {batch:existing,reused:true};}
  const now=Date.now();const all=s.projects.flatMap(p=>p.batches??[]);
  for(const b of all)if(b.status==='RUNNING'&&now-Date.parse(b.startedAt)>(b.questionIds.length*config.timeoutSeconds+30)*1000){b.status='INTERRUPTED';b.finishedAt=new Date().toISOString();b.error='앱 중단 또는 실행 제한시간 초과. 제공사 실행/과금 여부는 미확인. 자동 재시도하지 않습니다.';}
  if(batches.some(b=>b.status==='RUNNING'))throw new Error('이 프로젝트의 측정이 이미 실행 중입니다.');
  if(all.filter(b=>b.status==='RUNNING').length>=2)throw new Error('동시 실행은 최대 2개입니다.');
  if(all.some(b=>now-Date.parse(b.startedAt)<config.minIntervalSeconds*1000))throw new Error('측정 요청 간 최소 15초 간격이 필요합니다.');
  const daily=all.filter(b=>new Date(b.startedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})===new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})).reduce((n,b)=>n+b.questionIds.length,0);
  if(daily+ids.length>config.dailyLimit)throw new Error(`일일 호출 제한 ${config.dailyLimit}회에 도달했습니다. 실패·중단 요청도 제한에 포함합니다.`);
  const questions=ids.map(id=>{const q=p.questions.find(q=>q.id===id);if(!q)throw new Error('다른 프로젝트의 질문은 측정할 수 없습니다.');return q;});
  const batch:MeasurementBatch={id:randomUUID(),idempotencyKey:input.idempotencyKey,provider:adapter.id,model:config.model,region:input.region,questionIds:ids,questionTexts:questions.map(q=>q.text),repetitions:1,kind:adapter.kind==='API_OBSERVATION'?'API_OBSERVATION':'DEMO',status:'RUNNING',startedAt:new Date().toISOString(),finishedAt:null,responseIds:[],error:null};batches.push(batch);return {batch,reused:false};
 });
 if(reservation.reused)return {batch:reservation.batch,reused:true};
 const batch=reservation.batch;
 for(let i=0;i<ids.length;i++){
  const started=Date.now();let response:ResponseRecord;
  const client=ownedProject(await repo.read(),input.projectId).client;
  try{
   const result=await adapter.collect({question:batch.questionTexts[i],region:input.region,model:batch.model,batchId:batch.id});
   const analysis=extractEntities(result.rawText,client,result.measurement.citedSources);
   response={id:randomUUID(),questionId:ids[i],provider:adapter.id,model:result.model,kind:batch.kind,observedAt:result.observedAt,region:input.region,rawText:result.rawText,citations:result.citations,mentions:mentionsFromAnalysis(analysis),analysisVersion:analysis.version,createdAt:new Date().toISOString(),cost:result.measurement.costEstimate.usd,accuracy:'UNREVIEWED',measurement:result.measurement,entityAnalysis:analysis};
  }catch(e){
   const error=e as Error;response={id:randomUUID(),questionId:ids[i],provider:adapter.id,model:batch.model,kind:batch.kind,observedAt:new Date().toISOString(),region:input.region,rawText:'',citations:[],mentions:[],analysisVersion:'not-analyzed',createdAt:new Date().toISOString(),cost:null,accuracy:'UNREVIEWED',measurement:{batchId:batch.id,questionText:batch.questionTexts[i],status:'FAILED',searchUsed:false,apiResponseId:null,requestId:e instanceof ProviderFailure?e.requestId:null,apiStatus:'failed',usage:null,searchCalls:[],citedSources:[],rawOutput:e instanceof ProviderFailure?e.rawOutput:null,errorCode:e instanceof ProviderFailure?e.code:'PROVIDER_ERROR',errorMessage:error.message,durationMs:Date.now()-started,costEstimate:{usd:null,basis:'실패 요청: 청구 여부 미확인',rates:null}}};
  }
  await repo.mutate(s=>{const p=ownedProject(s,input.projectId);const b=p.batches!.find(b=>b.id===batch.id)!;p.responses.push(response);b.responseIds.push(response.id);});
  // Stop on the first provider failure. Never retry or continue spending blindly.
  if(response.measurement?.status!=='SUCCEEDED')break;
 }
 const final=await repo.mutate(s=>{const p=ownedProject(s,input.projectId);const b=p.batches!.find(b=>b.id===batch.id)!;const rows=p.responses.filter(r=>r.measurement?.batchId===b.id);const succeeded=rows.filter(r=>r.measurement?.status==='SUCCEEDED').length;b.status=succeeded===ids.length?'COMPLETED':succeeded?'PARTIAL':'FAILED';b.finishedAt=new Date().toISOString();b.error=rows.find(r=>r.measurement?.status!=='SUCCEEDED')?.measurement?.errorMessage??null;return b;});
 return {batch:final,reused:false};
}

