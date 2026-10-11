import {it,expect} from 'vitest';
import {isPublicIp,validateUrl,inspectHtml,tasksFromAudit} from '../src/lib/audit';
import {seed} from '../src/lib/seed';
it('SSRF 내부·예약·mapped IP 차단',()=>{for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','172.16.0.1','169.254.169.254','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1','100.64.0.1','192.0.2.1'])expect(isPublicIp(ip),ip).toBe(false);expect(isPublicIp('8.8.8.8')).toBe(true);});
it('URL 프로토콜·자격증명·포트 제한',()=>{for(const url of ['file:///etc/passwd','http://localhost','http://a.local','https://user:password@example.com','http://example.com:8080'])expect(()=>validateUrl(url)).toThrow();});
it('JSON-LD 구문·기본 구조 검증 및 관측 과제 생성',()=>{const p=seed().projects[0];const f=inspectHtml('<html><head><title>홍제 A치과</title><script type="application/ld+json">{bad}</script></head><body><h1>진료 안내</h1><a href="/reservation">예약</a></body></html>',p.client.website,p.client);expect(f.find(x=>x.key==='schema')?.status).toBe('warn');expect(f.find(x=>x.key==='booking')?.status).toBe('pass');expect(tasksFromAudit({id:'a',kind:'LIVE',url:p.client.website,at:new Date().toISOString(),findings:f}).every(t=>t.hypothesis)).toBe(true);});

