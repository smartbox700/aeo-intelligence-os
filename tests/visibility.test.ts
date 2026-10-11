import {it,expect} from 'vitest';
import {visibilityMetrics} from '../src/lib/visibility';
import {seed} from '../src/lib/seed';
import {extractEntities,mentionsFromAnalysis} from '../src/lib/entity-analysis';
import {parseOpenAIResponse} from '../src/lib/openai-provider';
import {fixture} from './fixtures/openai-response';
import type {ResponseRecord} from '../src/lib/types';
it('유효·추천·인용·경쟁사·질문별 분모와 명시적 소개 번호',()=>{
 const p=seed().projects[0];const validText='1. **홍제 A치과** — 위치 정보 확인.\n2. **홍제 B치과** — 위치 정보 확인.';
 const parsed=parseOpenAIResponse({...fixture,output:[fixture.output[0],{type:'message',content:[{type:'output_text',text:validText,annotations:[{type:'url_citation',url:p.client.website,title:'공식 출처',start_index:4,end_index:10}]}]}]},p.questions[0].text,'batch',null,1);
 const analysis=extractEntities(parsed.rawText,p.client,parsed.measurement.citedSources);const r:ResponseRecord={...p.responses[0],id:'valid',kind:'API_OBSERVATION',provider:'OpenAI',rawText:parsed.rawText,citations:parsed.citations,entityAnalysis:analysis,mentions:mentionsFromAnalysis(analysis),measurement:parsed.measurement};
 const failed={...r,id:'failed',measurement:{...parsed.measurement,status:'FAILED' as const}};const noSearch={...r,id:'no-search',measurement:{...parsed.measurement,searchUsed:false}};const pending={...r,id:'pending',entityAnalysis:{...analysis,status:'REVIEW_REQUIRED' as const}};
 const m=visibilityMetrics([r,failed,noSearch,pending],p);expect(m).toMatchObject({total:4,n:1,excluded:3,clientCount:1,mentionRate:1,recommendations:1,recommendationN:1,recommendationRate:1,citations:1,citationRate:1});expect(m.positions[0].order).toBe(1);expect(m.competitors[0].rate).toBe(1);expect(m.questions[0].n).toBe(1);expect(m.days[0].total).toBe(4);
});
it('일반 안내는 검색 성공일 때 유효 비언급 응답',()=>{const p=seed().projects[0];const text='특정 치과 추천 대신 자격과 위치를 확인하는 기준을 안내합니다.';const a=extractEntities(text,p.client);const parsed=parseOpenAIResponse({...fixture,output:[fixture.output[0],{type:'message',content:[{type:'output_text',text,annotations:[]}]}]},'q','b',null,1);const r={...p.responses[0],kind:'API_OBSERVATION',rawText:text,measurement:parsed.measurement,entityAnalysis:a,mentions:[],citations:[]} as ResponseRecord;const m=visibilityMetrics([r],p);expect(m.n).toBe(1);expect(m.mentionRate).toBe(0);expect(m.recommendationRate).toBe(0);expect(m.positions).toHaveLength(0);});
