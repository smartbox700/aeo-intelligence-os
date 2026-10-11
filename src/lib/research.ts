import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {ProjectData,ResearchStudy,ResponseRecord,ConsumerScreen,Audit} from './types';
import {CONSUMER_SERVICES} from './consumer-config';
export * from './research-metrics';
import {visibilityMetrics,isEligible} from './visibility';
import {priorityScore,optimizationTasks} from './optimization';
export const studyInput=z.object({name:z.string().trim().min(2).max(100),kind:z.enum(['CONSUMER_UI_MANUAL','DEMO']),questionIds:z.array(z.string()).min(1).max(30),screens:z.array(z.object({screen:z.enum(['CHATGPT_WEB_SEARCH','GEMINI_CONSUMER_SEARCH','NAVER_AI_BRIEFING']),model:z.string().trim().min(1).max(200)})).min(1).max(3),country:z.string().trim().min(2).max(100),region:z.string().trim().min(1).max(200),repetitions:z.number().int().min(1).max(5)});
export function createStudy(p:ProjectData,input:unknown){const v=studyInput.parse(input);if(new Set(v.questionIds).size!==v.questionIds.length||new Set(v.screens.map(s=>s.screen)).size!==v.screens.length)throw new Error('질문·플랫폼을 중복 선택할 수 없습니다.');const conditions=v.questionIds.flatMap(id=>{const q=p.questions.find(q=>q.id===id);if(!q)throw new Error('이 프로젝트의 질문만 계획할 수 있습니다.');return v.screens.map(s=>({questionId:id,actualQuestion:q.text,screen:s.screen,model:s.model,country:v.country,region:v.region,searchUsage:'USED' as const}));});const study:ResearchStudy={id:randomUUID(),name:v.name,kind:v.kind,at:new Date().toISOString(),repetitions:v.repetitions,conditions};(p.client.researchStudies??=[]).push(study);return study;}
/** Observations create testable tasks; missing observations never create invented success. */
export function observationStrategy(p:ProjectData,kind:'CONSUMER_UI_MANUAL'|'DEMO'){
 const rows=p.responses.filter(r=>r.kind===kind&&r.consumer&&isEligible(r));if(!rows.length)throw new Error('해당 유형의 유효 관측이 없습니다. 식별·검색 상태를 먼저 확인하세요.');
 const id=randomUUID(),at=new Date().toISOString();const weights=p.client.priorityWeights??{accuracy:30,relevance:25,technical:20,citation:15,conversion:10};
 const audit:Audit={id,at,origin:'OBSERVATION_STRATEGY',kind:kind==='DEMO'?'DEMO':'LIVE',url:p.client.website||'공식 URL 미등록',findings:[],optimization:{version:'observation-strategy-v1',profile:p.client.analysisProfile??'LOCAL_SERVICE',weights,pages:[],citedSources:rows.flatMap(r=>r.citations.map(url=>({url,responseId:r.id,kind:r.kind,entityId:null}))),gaps:[]}};
 for(const q of p.questions){const sample=rows.filter(r=>r.questionId===q.id);if(!sample.length)continue;const m=visibilityMetrics(sample,p);if(m.clientCount===sample.length&&m.recommendations===m.recommendationN&&m.citations===sample.length)continue;
  const score=priorityScore({accuracy:.5,relevance:1,technical:.25,citation:sample.some(r=>r.citations.length)?1:0,conversion:/(예약|구매)/.test(q.text)?1:0},weights);const competitors=m.competitors.filter(c=>c.count);const evidence=sample.flatMap(r=>r.citations);const fact=`${q.text} · 유효 관측 ${sample.length}건: 고객 언급 ${m.clientCount}/${m.n}, 추천 후보 ${m.recommendations}/${m.recommendationN}, 공식 인용 ${m.citations}/${m.n}; 언급 경쟁사 ${competitors.map(c=>c.name).join(', ')||'없음'}`;
  audit.optimization!.gaps.push({id:randomUUID(),key:'observation-'+q.id,responseIds:sample.map(r=>r.id),label:q.intent+' 질문 대응 정보 보완',clientStatus:'관측 표본에서 노출·인용 격차',competitorStates:competitors.map(c=>({id:c.id,name:c.name,status:'언급 '+c.count+'/'+c.n,evidence:'수동 관측 원문 참조',url:p.client.competitors.find(x=>x.id===c.id)?.website??''})),questionIds:[q.id],evidenceUrls:[...new Set(evidence)],observedFact:fact+' · 원문 응답 ID '+sample.map(r=>r.id).join(', '),necessity:'실제 관측 질문과 공식 홈페이지 정보의 대응을 담당자가 검토',action:`공식 홈페이지의 ${/(예약|구매)/.test(q.text)?'예약·구매 절차':/(의료진|전문|진료)/.test(q.text)?'사실 확인된 전문가·서비스 소개':'지역·서비스 안내와 FAQ'}를 해당 질문에 답하도록 보완. 제공하지 않는 서비스나 확인되지 않은 자격·성과는 작성하지 않음.`,reviewRequired:true,regulatoryReview:/(병원|치과|의료|변호|법무)/.test(p.client.industry),remeasurement:'같은 질문 원문·화면·모델 표시·국가·지역·검색 사용·반복 번호의 Follow-up을 수동 관측하여 Baseline과 비교. 작은 표본의 개선 효과를 확정하지 않음.',score:score.score,scoreParts:score.parts});
 }
 p.audits.push(audit);const tasks=optimizationTasks(audit);p.tasks.push(...tasks);return {auditId:id,tasks:tasks.length};
}

