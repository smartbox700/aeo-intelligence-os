import {describe,it,expect} from 'vitest';
import {analyzeMentions,metrics,citationRate,csvCell,exportCsv} from '../src/lib/analysis';
import {seed} from '../src/lib/seed';
describe('재현 가능한 측정',()=>{
 it('가상 사례는 5개 DEMO이며 언급률 3/5',()=>{const p=seed().projects[0];expect(p.responses).toHaveLength(5);expect(metrics(p.responses,'DEMO').mentionRate).toBe(.6);expect(metrics(p.responses,'MANUAL_UI').mentionRate).toBeNull();expect(citationRate(p.responses,p.client.website).rate).toBe(.6);});
 it('중복 언급은 업체·응답 쌍 하나이며 별칭을 인식',()=>{const p=seed().projects[0];const m=analyzeMentions('홍제A치과와 홍제A치과. 홍제 B치과.',p.client);expect(m).toHaveLength(2);expect(m[0].role).toBe('client');});
 it('이름 충돌은 모호함으로 분리',()=>{const p=seed().projects[0];p.client.competitors[0].aliases=['홍제 A치과'];expect(analyzeMentions('홍제 A치과',p.client).every(m=>m.ambiguous)).toBe(true);});
 it('영문 브랜드가 긴 토큰에 포함되어도 오인하지 않음',()=>{const p=seed().projects[0];p.client.aliases=['Acme'];expect(analyzeMentions('AcmeCorp',p.client)).toHaveLength(0);expect(analyzeMentions('ACME clinic',p.client)).toHaveLength(1);});
 it('한국어 업체명 앞부분이 다른 이름에 포함되면 제외',()=>{const p=seed().projects[0];expect(analyzeMentions('신홍제 A치과',p.client)).toHaveLength(0);});
 it('출처 인용은 도메인 일치만 인정',()=>{const p=seed().projects[0];p.responses[0].citations=['https://hongje-a.example.attacker.test'];expect(citationRate([p.responses[0]],p.client.website).rate).toBe(0);});
 it('CSV 수식·따옴표·개행 보호 및 유형 분리',()=>{expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');expect(csvCell('a"b\nc')).toBe('"a""b\nc"');const p=seed().projects[0];expect(exportCsv(p,'MANUAL_UI').split('\r\n')).toHaveLength(1);});
});
