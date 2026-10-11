import {it,expect} from 'vitest';
import {robotAccess} from '../src/lib/robots';
it('봇 전용 그룹·최장 규칙·동률 Allow를 해석',()=>{const text='User-agent: *\nDisallow: /\nUser-agent: OAI-SearchBot\nDisallow: /private\nAllow: /private/open\nUser-agent: GPTBot\nDisallow: /';expect(robotAccess(text,'OAI-SearchBot','/').allowed).toBe(true);expect(robotAccess(text,'GPTBot','/').allowed).toBe(false);expect(robotAccess(text,'OAI-SearchBot','/private/open').allowed).toBe(true);expect(robotAccess('User-agent: *\nDisallow: /a\nAllow: /a','*','/a').allowed).toBe(true);});
it('wildcard와 끝 앵커·잘못된 파일을 구별',()=>{expect(robotAccess('User-agent: *\nDisallow: /*.pdf$','*','/a.pdf').allowed).toBe(false);expect(robotAccess('<html>error</html>','*','/').allowed).toBeNull();});
