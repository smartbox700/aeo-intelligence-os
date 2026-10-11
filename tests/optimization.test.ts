import {it,expect} from 'vitest';
import {analyzeGaps,demoOptimization,priorityScore,optimizationTasks,collectOptimization} from '../src/lib/optimization';
import {DEFAULT_WEIGHTS} from '../src/lib/optimization-config';
import {inspectHtml} from '../src/lib/audit';
import {seed} from '../src/lib/seed';
import type {Audit} from '../src/lib/types';
const baseAudit=():Audit=>({id:'test',kind:'DEMO',url:'https://client.example',at:new Date().toISOString(),findings:[{key:'faq',label:'FAQ',status:'warn',evidence:'FAQ 단서 없음',recommendation:'확인한 질문 안내 작성'},{key:'price',label:'가격',status:'warn',evidence:'가격 단서 없음',recommendation:'실제 가격 표시'}],competitorComparisons:[]});
it('설정 가중치 30/25/20/15/10, 점수는 0~100·분해 합과 일치',()=>{expect(Object.values(DEFAULT_WEIGHTS).reduce((a,b)=>a+b,0)).toBe(100);const s=priorityScore({accuracy:1,relevance:1,technical:1,citation:1,conversion:1});expect(s.score).toBe(100);expect(s.parts).toEqual(DEFAULT_WEIGHTS);expect(priorityScore({accuracy:2,relevance:-1,technical:0,citation:0,conversion:0}).score).toBe(30);});
it('지역 서비스와 상품 프로필이 서로 다른 격차를 적용',()=>{const p=seed().projects[0];const a=baseAudit();expect(analyzeGaps(p,a).gaps.map(g=>g.key)).toEqual(['faq']);p.client.analysisProfile='PRODUCT';expect(analyzeGaps(p,a).gaps.some(g=>g.key==='price')).toBe(true);});
it('실제 인용과 경쟁사 정보 격차를 연결하되 DEMO를 LIVE 근거에서 제외',()=>{
 const p=seed().projects[0];p.client.competitors[0].website='https://rival.example/';const a=baseAudit();a.kind='LIVE';a.competitorComparisons=[{entityId:p.client.competitors[0].id,name:'DEMO 비교 업체',url:'https://rival.example/',at:a.at,status:'SUCCEEDED',error:null,findings:[{key:'faq',label:'FAQ',status:'pass',evidence:'테스트 FAQ HTML 단서',recommendation:''}],differences:[]}];
 p.responses[0].citations=['https://rival.example/faq'];expect(analyzeGaps(p,a).citedSources).toHaveLength(0);expect(analyzeGaps(p,a).gaps[0].scoreParts.citation).toBe(7.5);
 p.responses[0].kind='MANUAL_OBSERVATION';p.responses[0].entityAnalysis={version:'test',method:'CONTEXT_RULES',status:'READY',generalGuidance:true,entities:[],reviewHistory:[]};const snapshot=analyzeGaps(p,a);expect(snapshot.citedSources).toHaveLength(1);expect(snapshot.gaps.find(g=>g.key==='faq')?.scoreParts.citation).toBe(15);expect(snapshot.gaps.some(g=>g.key==='observed-citations')).toBe(true);
});
it('DEMO 검사 생성·근거 처방·의료 광고 검토·우선순위 정렬',async()=>{
 const p=seed().projects[0];const a=await demoOptimization(p);expect(a.kind).toBe('DEMO');expect(a.optimization?.pages.every(page=>page.excerpt.includes('가상'))).toBe(true);expect(a.optimization?.gaps.length).toBeGreaterThan(0);expect(a.optimization?.gaps.find(g=>g.key==='faq')?.regulatoryReview).toBe(true);const tasks=optimizationTasks(a);expect(tasks.every(t=>t.hypothesis&&t.reviewRequired&&t.remeasurement&&t.score!==undefined)).toBe(true);expect(tasks[0].score!>=tasks.at(-1)!.score!).toBe(true);
});
it('경쟁사 실패는 미확인 상태로 보존하며 정보 없음으로 조작하지 않음',async()=>{const p=seed().projects[0];p.client.competitors.forEach(c=>c.website='https://rival.example');let calls=0;const a=await collectOptimization(p,async()=>{if(calls++)throw new Error('정책 차단');return baseAudit();});expect(a.competitorComparisons?.every(c=>c.status==='FAILED'&&c.findings.length===0)).toBe(true);expect(a.optimization?.gaps.every(g=>g.competitorStates.length===0)).toBe(true);expect(calls).toBeLessThanOrEqual(3);});
it('상품·FAQ·구조화 데이터 단서, 예약 링크는 예약 가능을 보장하지 않음',()=>{
 const c=seed().projects[0].client;c.bookingUrl='https://product.example/buy';const html='<html><head><title>상품 안내</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"DEMO"}</script></head><body><h1>상품명 DEMO</h1><h2>FAQ</h2><p>제조사, 모델, 규격, 가격, 배송, 교환·환불 안내</p><a href="/buy">구매</a></body></html>';const findings=inspectHtml(html,'https://product.example',c);for(const key of ['product-name','manufacturer','model','specification','price','delivery','purchase-terms','product-schema','faq','booking'])expect(findings.find(f=>f.key===key)?.status,key).toBe('pass');expect(findings.find(f=>f.key==='booking')?.evidence).toContain('미검증');
});

