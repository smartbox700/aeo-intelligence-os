import {it,expect} from 'vitest';
import {responseSchema} from '../src/lib/validation';
import {seed} from '../src/lib/seed';
import {extractEntities,mentionsFromAnalysis} from '../src/lib/entity-analysis';
import {visibilityMetrics} from '../src/lib/visibility';
import {exportCsv} from '../src/lib/analysis';
it('새 수동 유형·예약 확인 근거를 검증하고 API 유형을 수동 생성하지 못함',()=>{
 const input={questionId:'q',provider:'ChatGPT',model:'TEST',kind:'MANUAL_OBSERVATION',observedAt:new Date().toISOString(),region:'서울',rawText:'테스트용 응답',citations:[],manualObservation:{recommendedNames:[],bookingStatus:'CONFIRMED_AVAILABLE',bookingEvidence:'',bookingCheckedAt:null}};
 expect(responseSchema.safeParse(input).success).toBe(false);expect(responseSchema.safeParse({...input,manualObservation:{...input.manualObservation,bookingEvidence:'DEMO 검증용 공식 화면 확인 기록',bookingCheckedAt:input.observedAt}}).success).toBe(true);expect(responseSchema.safeParse({...input,kind:'API_OBSERVATION'}).success).toBe(false);
});
it('수동 업체 불확실성은 제외, 무번호 안내에는 임의 순위를 생성하지 않음',()=>{
 const p=seed().projects[0];const analysis=extractEntities('DEMO 원문: 홍제 A치과의 공식 안내를 확인하세요.',p.client);const r={...p.responses[0],kind:'MANUAL_OBSERVATION' as const,entityAnalysis:analysis,mentions:mentionsFromAnalysis(analysis)};expect(analysis.entities.every(e=>e.introductionOrder===null)).toBe(true);expect(visibilityMetrics([r],p).n).toBe(1);r.entityAnalysis=extractEntities('1. **가상미소치과** — 가상 후보입니다.',p.client);expect(visibilityMetrics([r],p).n).toBe(0);
});
it('예약 상태·관찰 추천이 CSV에 보존',()=>{const p=seed().projects[0];p.responses[0].manualObservation={recommendedNames:['DEMO 고객'],bookingStatus:'UNVERIFIED',bookingEvidence:'',bookingCheckedAt:null};expect(exportCsv(p,'DEMO')).toContain('예약 확인 상태');expect(exportCsv(p,'DEMO')).toContain('UNVERIFIED');});
