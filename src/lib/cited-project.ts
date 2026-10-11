import {createHash,randomUUID} from 'node:crypto';
import {diagnosisSchema,generateQueries,categories,type Diagnosis} from './cited-diagnosis';
import {extractEntities,mentionsFromAnalysis} from './entity-analysis';
import type {ProjectData} from './types';
export type CitedSnapshot={id:string;at:string;actorId:string;digest:string;data:Diagnosis;responseIds:string[]};
export function attachDiagnosis(p:ProjectData,input:unknown,actorId:string):CitedSnapshot{
 const data=diagnosisSchema.parse(input);
 if(data.profile.brand!==p.client.name)throw new Error('진단 브랜드와 고객사명이 일치해야 합니다.');
 const snapshots=p.client.citedDiagnoses??=[];
 const digest=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 const existing=snapshots.find(s=>s.digest===digest);if(existing)return existing;
 const at=new Date().toISOString();const responseIds:string[]=[];
 for(const q of generateQueries(data.profile)){
  let question=p.questions.find(item=>item.text===q.text);
  if(!question){question={id:randomUUID(),text:q.text,intent:categories[q.type],importance:3,commercialIntent:q.type==='recommendation'?5:2,createdAt:at};p.questions.push(question);}
  for(const o of data.observations.filter(o=>o.queryId===q.id&&o.status==='observed')){
   const observedAt=new Date(o.observedAt.length===16?o.observedAt+':00+09:00':o.observedAt).toISOString();
   const old=p.responses.find(r=>r.kind==='MANUAL_OBSERVATION'&&r.questionId===question!.id&&r.provider===o.platform&&r.rawText===o.rawText&&r.observedAt===observedAt&&r.model===o.model&&r.region===data.profile.region);
   if(old){responseIds.push(old.id);continue;}
   const analysis=extractEntities(o.rawText,p.client);const id=randomUUID();
   p.responses.push({id,questionId:question.id,questionText:q.text,provider:o.platform,model:o.model,kind:'MANUAL_OBSERVATION',observedAt,region:data.profile.region,rawText:o.rawText,citations:[],mentions:mentionsFromAnalysis(analysis),entityAnalysis:analysis,analysisVersion:analysis.version,createdAt:at,cost:null,accuracy:'UNREVIEWED',classification:'CLIENT_CONFIDENTIAL'});
   responseIds.push(id);
  }
 }
 const snapshot={id:randomUUID(),at,actorId,digest,data,responseIds};p.client.citedDiagnoses=[...snapshots,snapshot];return snapshot;
}
