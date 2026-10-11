import {describe,it,expect} from 'vitest';
import {generateQueries,diagnosisSchema,metrics,type Diagnosis,type Observation} from '../src/lib/cited-diagnosis';
const profile={brand:'테스트 브랜드',region:'서초구',service:'상담',count:10 as const};
const row:Observation={queryId:'recommendation-1',platform:'ChatGPT',status:'observed',mentioned:true,recommended:false,cited:true,rawText:'테스트 브랜드 공식 안내를 확인하세요.',observedAt:'2026-10-11T12:30',model:'미표시 / 검색 ON'};
describe('CITED 수동 진단',()=>{
 it('질문 분류와 10/50개 개수를 유지한다',()=>{expect(generateQueries(profile)).toHaveLength(10);const q=generateQueries({...profile,count:50});expect(q).toHaveLength(50);expect(q.filter(q=>q.type==='recommendation')).toHaveLength(8);expect(new Set(q.map(q=>q.id)).size).toBe(50);});
 it('미측정과 실제 0%, 플랫폼, 추천을 분리한다',()=>{const d:Diagnosis={version:1,profile,observations:[row,{...row,queryId:'brand-1',recommended:true},{...row,queryId:'recommendation-2',status:'unmeasured',recommended:true}]};expect(metrics(d,'ChatGPT')).toMatchObject({observed:2,mentioned:100,cited:100,recommendation:0,recommendationObserved:1});expect(metrics(d,'Gemini')).toMatchObject({observed:0,mentioned:null,recommendation:null,cited:null});});
 it('원문과 관측 조건 없는 확정, 중복 슬롯, 소속 밖 질문을 거부한다',()=>{const parse=(observations:Observation[])=>diagnosisSchema.safeParse({version:1,profile,observations}).success;expect(parse([row])).toBe(true);expect(parse([{...row,rawText:''}])).toBe(false);expect(parse([{...row,observedAt:'잘못된 날짜'}])).toBe(false);expect(parse([{...row,model:''}])).toBe(false);expect(parse([row,row])).toBe(false);expect(parse([{...row,queryId:'other-project'}])).toBe(false);expect(parse([{...row,mentioned:false,cited:true}])).toBe(false);});
});
