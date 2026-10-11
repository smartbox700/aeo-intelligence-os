import {it,expect,vi,afterEach} from 'vitest';
import dns from 'node:dns/promises';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {safeFetch} from '../src/lib/audit';
afterEach(()=>vi.restoreAllMocks());
function mockRequests(responses:{status:number;body:string;location?:string}[]){
 const urls:string[]=[];vi.spyOn(dns,'lookup').mockImplementation((async (host:string)=>[{address:host==='internal.example'?'127.0.0.1':'8.8.8.8',family:4}]) as never);
 vi.spyOn(https,'request').mockImplementation(((url:URL,_options:unknown,callback:(res:unknown)=>void)=>{
  urls.push(url.href);const req=new EventEmitter() as EventEmitter&{end:()=>void;destroy:(e:Error)=>void};req.destroy=e=>{req.emit('error',e);req.emit('close');};req.end=()=>queueMicrotask(()=>{const data=responses.shift();if(!data){req.destroy(new Error('unexpected request'));return;}const res=Object.assign(new EventEmitter(),{statusCode:data.status,headers:{'content-type':'text/html',location:data.location}});callback(res);res.emit('data',Buffer.from(data.body));res.emit('end');req.emit('close');});return req;
 }) as never);return urls;
}
it('robots 차단은 본문 요청 전에 중단',async()=>{const urls=mockRequests([{status:200,body:'User-agent: *\nDisallow: /'}]);await expect(safeFetch('https://public.example/',0,true)).rejects.toThrow('접근 정책');expect(urls).toEqual(['https://public.example/robots.txt']);});
it('robots 정책 미확인 상태에서도 본문을 요청하지 않음',async()=>{const urls=mockRequests([{status:403,body:''}]);await expect(safeFetch('https://public.example/',0,true)).rejects.toThrow('정책 미확인');expect(urls).toHaveLength(1);});
it('리디렉션 목적지의 robots 경로 정책을 다시 검사',async()=>{const urls=mockRequests([{status:404,body:''},{status:302,body:'',location:'/blocked'},{status:200,body:'User-agent: *\nDisallow: /blocked'}]);await expect(safeFetch('https://public.example/',0,true)).rejects.toThrow('접근 정책');expect(urls).not.toContain('https://public.example/blocked');});
it('리디렉션 후 내부 DNS로 해석되는 주소는 요청 전에 차단',async()=>{const urls=mockRequests([{status:302,body:'',location:'https://internal.example/'}]);await expect(safeFetch('https://public.example')).rejects.toThrow('내부/예약 IP');expect(urls).toHaveLength(1);});
