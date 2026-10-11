import {assertLiveAIEnabled} from './live-ai';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';
import {load} from 'cheerio';
import {randomUUID} from 'node:crypto';
import type {Audit,Entity,Finding,Task,CompetitorComparison} from './types';
import {robotAccess} from './robots';
export function isPublicIp(address:string){try{let a=ipaddr.parse(address);if(a.kind()==='ipv6'&&(a as ipaddr.IPv6).isIPv4MappedAddress())a=(a as ipaddr.IPv6).toIPv4Address();return a.range()==='unicast';}catch{return false;}}
export function validateUrl(raw:string){const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||(u.port&&!['80','443'].includes(u.port)))throw new Error('HTTP(S) 공개 URL과 기본 포트만 지원합니다.');if(u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))throw new Error('내부 네트워크 주소는 차단됩니다.');return u;}
export type SafePage={url:string;status:number;body:string;contentType:string;redirects:number;xRobotsTag:string};
async function publicAddresses(hostname:string){let timer:ReturnType<typeof setTimeout>|undefined;try{const ips=await Promise.race([dns.lookup(hostname,{all:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS 타임아웃')),4000);})]);if(!ips.length||ips.some(i=>!isPublicIp(i.address)))throw new Error('내부/예약 IP로 연결되는 URL은 차단됩니다.');return ips;}finally{if(timer)clearTimeout(timer);}}
/** Fixed official endpoint only. TLS and validated IP pinning; no redirects/retries. */
export async function postOpenAI(body:Record<string,unknown>,apiKey:string):Promise<{status:number;requestId:string|null;body:unknown}>{
 assertLiveAIEnabled();const u=new URL('https://api.openai.com/v1/responses');const [ip]=await publicAddresses(u.hostname);const payload=JSON.stringify(body);
 return new Promise((resolve,reject)=>{
  const request=https.request(u,{method:'POST',family:ip.family,lookup:(_h,_o,cb)=>cb(null,ip.address,ip.family),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{
   const chunks:Buffer[]=[];let length=0;res.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>4_000_000){request.destroy(new Error('OpenAI 응답 4MB 제한 초과'));return;}chunks.push(chunk);});
   res.on('end',()=>{try{resolve({status:res.statusCode??0,requestId:String(res.headers['x-request-id']??'')||null,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{reject(new Error('OpenAI 응답 JSON 형식 오류'));}});res.on('error',reject);
  });
  const timer=setTimeout(()=>request.destroy(new Error('OpenAI 요청 타임아웃 (90초). 과금 여부는 제공사에서 확인하세요.')),90000);request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end(payload);
 });
}
/** Fixed free-Gemini endpoint, guarded independently of paid-provider enablement. */
export async function postFreeGemini(body:Record<string,unknown>,apiKey:string,authorization:{approved:boolean;freeTierVerified:boolean}):Promise<{status:number;body:unknown}>{
 if(process.env.FREE_GEMINI_ENABLED!=='true'||!authorization.approved||!authorization.freeTierVerified)throw new Error('무료 Gemini 설정·실행 승인·무료 등급 검증 없이는 전송하지 않습니다.');
 const u=new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');const [ip]=await publicAddresses(u.hostname);const payload=JSON.stringify(body);
 return new Promise((resolve,reject)=>{const request=https.request(u,{method:'POST',family:ip.family,lookup:(_h,_o,cb)=>cb(null,ip.address,ip.family),headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{const chunks:Buffer[]=[];let length=0;res.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>4000000){request.destroy(new Error('Gemini 응답 4MB 제한 초과'));return;}chunks.push(chunk);});res.on('end',()=>{try{resolve({status:res.statusCode??0,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{reject(new Error('Gemini JSON 형식 오류'));}});res.on('error',reject);});const timer=setTimeout(()=>request.destroy(new Error('Gemini 요청 60초 제한 초과')),60000);request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end(payload);});
}
export async function safeFetch(raw:string,redirects=0,respectPolicy=false,budget?:{deadline:number;requests:number}):Promise<SafePage>{
 if(budget&&(Date.now()>=budget.deadline||--budget.requests<0))throw new Error('페이지 검사 전체 시간·요청 횟수 제한 초과');
 if(redirects>3)throw new Error('리디렉션 제한 초과');
 const u=validateUrl(raw);const hostname=u.hostname.replace(/^\[|\]$/g,'');
 if(respectPolicy){const robots=await safeFetch(new URL('/robots.txt',u).href,0,false,budget);if(robots.status!==404){if(robots.status!==200)throw new Error(`접근 정책 미확인: robots.txt HTTP ${robots.status}. 검사 중단`);const access=robotAccess(robots.body,'AEOIntelligenceOS',u.pathname);if(access.allowed!==true)throw new Error('robots.txt 접근 정책으로 검사 중단: '+access.evidence);}}
 const ips=await publicAddresses(hostname);
 const ip=ips[0];
 const result=await new Promise<{status:number;body:string;location?:string;contentType:string;xRobotsTag:string}>((resolve,reject)=>{
  const request=(u.protocol==='https:'?https:http).request(u,{method:'GET',family:ip.family,headers:{'User-Agent':'AEOIntelligenceOS/0.1 (+manual-website-audit)','Accept':'text/html,text/plain,application/xml'},lookup:(_h,_o,cb)=>cb(null,ip.address,ip.family)},res=>{
   let size=0;const chunks:Buffer[]=[];
   res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1_000_000){request.destroy(new Error('응답 1MB 제한 초과'));return;}chunks.push(chunk);});
   res.on('end',()=>resolve({status:res.statusCode??0,body:Buffer.concat(chunks).toString('utf8'),location:res.headers.location,contentType:res.headers['content-type']??'',xRobotsTag:String(res.headers['x-robots-tag']??'')}));res.on('error',reject);
  });
  const timer=setTimeout(()=>request.destroy(new Error('요청 타임아웃 (최대 8초)')),Math.max(1,Math.min(8000,budget?budget.deadline-Date.now():8000)));request.on('close',()=>clearTimeout(timer));request.on('error',reject);request.end();
 });
 if([301,302,303,307,308].includes(result.status)&&result.location)return safeFetch(new URL(result.location,u).href,redirects+1,respectPolicy,budget);
 return {...result,url:u.href,redirects};
}
export function inspectHtml(html:string,url:string,client:Entity):Finding[]{
 const $=load(html);const findings:Finding[]=[];
 const add=(key:string,label:string,ok:boolean,evidence:string,recommendation:string)=>findings.push({key,label,status:ok?'pass':'warn',evidence,recommendation});
 add('title','페이지 제목',Boolean($('title').text().trim()),$('title').text().slice(0,200)||'title 없음','지역·업체명·페이지의 목적을 설명하는 제목 작성');
 add('meta','메타 설명',Boolean($('meta[name="description"]').attr('content')),$('meta[name="description"]').attr('content')||'설명 없음','페이지 내용을 정확하게 요약');
 add('headings','주요 제목 구조',$('h1').length===1,`H1 ${$('h1').length}개 / H2 ${$('h2').length}개`,'명확한 H1 및 내용별 H2 구성');
 const robots=$('meta[name="robots"],meta[name="googlebot"]').map((_,e)=>`${$(e).attr('name')}: ${$(e).attr('content')??''}`).get().join(' | ');
 add('indexing','HTML 색인 설정',!/(noindex|none)/i.test(robots),robots||'robots meta 없음: 명시적인 noindex는 관찰되지 않음','의도하지 않은 noindex/none 제거. 실제 색인 여부는 검색 도구에서 별도 확인');
 const canonical=$('link[rel="canonical"]').attr('href');let canonicalOk=false;try{canonicalOk=!!canonical&&['http:','https:'].includes(new URL(canonical!,url).protocol);}catch{}
 add('canonical','정규 URL',canonicalOk,canonical||'canonical 없음','대표 URL을 정확한 canonical로 지정');
 const links=$('a[href]').map((_,e)=>$(e).attr('href')!).get();
 const internal=links.filter(l=>{try{return new URL(l,url).origin===new URL(url).origin;}catch{return false;}});
 add('links','주요 내부 링크',internal.length>0,`내부 링크 ${internal.length}개`,'진료·의료진·위치·예약 안내에 일반 HTML 링크 제공');
 const scripts=$('script[type="application/ld+json"]').map((_,e)=>$(e).text()).get();let valid=0;const errors:string[]=[];
 for(const s of scripts)try{const j=JSON.parse(s);const nodes=Array.isArray(j)?j:j['@graph']??[j];if(!Array.isArray(nodes)||!nodes.length||!nodes.every((n:Record<string,unknown>)=>n&&typeof n==='object'&&n['@type']))throw new Error('@type 누락');if(!Array.isArray(j)&&!j['@context'])throw new Error('@context 누락');valid++;}catch(e){errors.push((e as Error).message);}
 add('schema','JSON-LD 기본 유효성',scripts.length>0&&valid===scripts.length,`블록 ${scripts.length}개, 기본 구조 통과 ${valid}개. ${errors.join('; ')}`,'사실로 검증된 정보만 JSON-LD로 표현; 전체 Schema.org 의미 검증은 별도 도구 필요');
 $('script,style,noscript,nav,footer').remove();const body=$('body').text().replace(/\s+/g,' ').trim();
 add('body','HTML 핵심 본문',body.length>=100,`본문 ${body.length}자 · ${body.slice(0,240)}`,'스크립트 실행 없이 읽을 수 있는 주요 정보 제공');
 add('entity','업체 정보 누락 검사',body.includes(client.name)&&!!client.address&&body.includes(client.address),`업체명 포함 ${body.includes(client.name)} / 등록 주소 포함 ${!!client.address&&body.includes(client.address)}`,'공식 업체명·주소·연락처의 일관성을 담당자가 확인');
 const snippet=(pattern:RegExp)=>{const match=body.match(pattern);return match?body.slice(Math.max(0,(match.index??0)-35),(match.index??0)+140):'해당 정보 단서가 HTML 본문에서 발견되지 않음';};
 add('contact','연락처 정보',/(?:0\d{1,2}[-\s)]?\d{3,4}[-\s]?\d{4}|연락처|전화번호)/.test(body),snippet(/(?:0\d{1,2}[-\s)]?\d{3,4}[-\s]?\d{4}|연락처|전화번호)/),'검증된 대표 전화·문의 채널을 공식 본문에 표시');
 add('location','위치·주소 안내',/(?:서울|부산|시\s|구\s|도로명|주소|오시는\s?길|위치)/.test(body),snippet(/(?:주소|오시는\s?길|위치|서울|부산)/),'정확한 도로명 주소와 접근 방법을 공개. 실제 주소 일치 여부는 등록 정보와 대조');
 add('services','서비스·진료 정보',/(서비스|진료|임플란트|상담|상품)/.test(body),snippet(/(서비스|진료|임플란트|상담|상품)/),'검증된 서비스·진료 항목과 범위를 설명. 치료 효과·전문성은 추정하지 않음');
 add('experts','의료진·전문가 소개',/(의료진|대표원장|원장|전문가|변호사|법무사|담당자)/.test(body),snippet(/(의료진|대표원장|원장|전문가|변호사|법무사|담당자)/),'사실 확인된 이름·자격·역할을 공식 프로필에 명시. 자격의 진위는 담당자 검증');
 add('identity-name','공식 명칭 표기',body.includes(client.name),`등록 명칭 '${client.name}' 본문 포함 ${body.includes(client.name)}; 별칭 ${client.aliases.join(', ')||'미등록'}`,'대표 명칭과 별칭을 일관되게 표시하고 오인 가능한 동명 업체와 구별');
 add('faq','FAQ·질문형 정보 구조',/(FAQ|자주\s?묻|질문|Q\s*&\s*A|어떻게|무엇인가)/i.test(body),snippet(/(FAQ|자주\s?묻|질문|Q\s*&\s*A|어떻게|무엇인가)/i),'실제 질문에 답하는 FAQ를 HTML 제목과 본문으로 작성. 미확인 효과나 비교 우월 표현 금지');
 add('expert-evidence','전문성 확인 경로 단서',/(자격|면허|등록번호|공식\s?프로필|자격증)/.test(body),snippet(/(자격|면허|등록번호|공식\s?프로필|자격증)/),'실제 확인된 자격·역할의 공식 확인 경로를 제공. 단어 존재는 자격 진위 검증이 아님');
 for(const [key,label,pattern,action] of [
  ['product-name','상품명',/(상품명|제품명)/,'정확한 상품명 표시'],['manufacturer','제조사·브랜드',/(제조사|제조원|브랜드)/,'확인된 제조사와 브랜드 표시'],['model','모델 식별',/(모델명|모델번호|모델)/,'정확한 모델명·제품 식별자 표시'],['specification','규격·사양',/(규격|사양|크기|중량|용량)/,'공식 규격과 사양을 항목별 표시'],['price','가격 정보',/(가격|판매가|원\s*\d|\d[\d,]*\s*원)/,'실제 판매 가격·적용 기간·추가 비용 명시'],['delivery','배송 정보',/(배송|출고|배송비)/,'실제 배송 범위·비용·일정 조건 표시'],['purchase-terms','구매·교환 조건',/(교환|환불|반품|구매\s?조건)/,'실제 구매·교환·반품 조건 표시']
 ] as [string,string,RegExp,string][]){add(key,label,pattern.test(body),snippet(pattern),action+'; HTML 단서만 검사하므로 담당자 사실 확인 필요');}
 add('product-schema','Product 구조화 데이터 단서',scripts.some(s=>/"@type"\s*:\s*"Product"/.test(s))&&valid===scripts.length,`Product 단서 ${scripts.some(s=>/"@type"\s*:\s*"Product"/.test(s))} / 기본 구조 통과 ${valid}/${scripts.length}`,'실제 상품명·브랜드·규격·가격·Offer 조건으로 Product JSON-LD 작성. 전체 의미 검증은 별도 필요');
 add('answer','질문에 답하는 정보 단서',/(예약|상담|진료|가격|비용|구매|서비스)/.test(body),'키워드 기반 휴리스틱 검사 · 내용의 정확성은 미검증','고객 질문에 직접 답하는 검증된 안내 추가');
 const booking=!!client.bookingUrl&&links.some(l=>{try{return new URL(l,url).href===new URL(client.bookingUrl).href;}catch{return false;}});
 findings.push({key:'booking',label:'예약·구매 링크',status:booking?'pass':client.bookingUrl?'warn':'unknown',evidence:booking?'등록 URL과 일치하는 링크 존재; 목적지 접근성·예약 가능 여부는 미검증':client.bookingUrl?'등록된 예약·구매 URL과 일치하는 링크 없음':'공식 예약·구매 URL 미등록: 일치 여부 미확인',recommendation:'공식 예약·구매 링크와 절차를 제공하고 목적지를 담당자가 확인'});
 return findings;
}
export async function auditWebsite(client:Entity,includePages=false):Promise<Audit>{
 const page=await safeFetch(client.website,0,true);const findings:Finding[]=[{key:'http',label:'HTTP 상태',status:page.status===200?'pass':'fail',evidence:`HTTP ${page.status} · 최종 URL ${page.url}`,recommendation:'홈페이지가 정상적인 200 응답을 제공하도록 수정'},{key:'redirect',label:'리디렉션',status:page.redirects<=1?'pass':'warn',evidence:`${page.redirects}회`,recommendation:'불필요한 리디렉션 체인 축소'},{key:'https',label:'HTTPS',status:page.url.startsWith('https:')?'pass':'warn',evidence:page.url,recommendation:'유효한 HTTPS 제공'},{key:'x-robots',label:'HTTP 색인 설정',status:/(noindex|none)/i.test(page.xRobotsTag)?'warn':'pass',evidence:page.xRobotsTag||'X-Robots-Tag 없음',recommendation:'의도하지 않은 HTTP noindex 설정을 검토'},{key:'official-source',label:'등록 공식 URL과 응답 호스트',status:new URL(client.website).hostname===new URL(page.url).hostname?'pass':'warn',evidence:`등록 ${client.website} → 최종 ${page.url}; 소유권·사실 정확성은 미검증`,recommendation:'등록한 공식 도메인과 최종 연결 도메인의 소유권을 담당자가 확인'}];
 if(page.status===200&&page.contentType.includes('text/html'))findings.push(...inspectHtml(page.body,page.url,client));
 else findings.push({key:'html',label:'HTML 진단',status:'unknown',evidence:'정상 HTML 응답이 아니므로 콘텐츠 진단 생략',recommendation:'정상 HTML 응답 확인 후 다시 진단'});
 // Sequential requests, bounded to 3 resources total (plus checked redirects).
 for(const resource of ['robots.txt','sitemap.xml'])try{const r=await safeFetch(new URL('/'+resource,page.url).href,0,resource==='sitemap.xml');const ok=r.status===200&&(resource==='robots.txt'?/user-agent\s*:/i.test(r.body):/<(urlset|sitemapindex)[\s>]/i.test(r.body));findings.push({key:resource,label:resource,status:ok?'pass':'warn',evidence:`HTTP ${r.status} · ${r.body.slice(0,300)}`,recommendation:resource==='robots.txt'?'수집 정책을 검토. 홈페이지 경로에 대한 봇별 해석은 아래 검사 참고':'유효한 사이트맵 제공 및 주요 URL 확인'});
  if(resource==='robots.txt')for(const agent of ['*','OAI-SearchBot','GPTBot','Googlebot']){const decision=r.status===404?{allowed:true,evidence:'robots.txt HTTP 404: 명시적 제한 없음'}:r.status===200?robotAccess(r.body,agent,new URL(page.url).pathname):{allowed:null,evidence:`robots.txt HTTP ${r.status}: 접근 정책 미확인`};findings.push({key:'robots-'+agent,label:agent+' 홈페이지 접근',status:decision.allowed===null?'unknown':decision.allowed?'pass':'fail',evidence:decision.evidence,recommendation:'의도한 봇 정책인지 담당자 확인. GPTBot 학습 정책과 검색용 OAI-SearchBot 정책은 별도로 판단'});}
 }catch(e){findings.push({key:resource,label:resource,status:'unknown',evidence:(e as Error).message,recommendation:'접근 상태를 수동 확인'});}
 const at=new Date().toISOString();const pages:NonNullable<Audit['pages']>=[];
 const snapshot=(p:SafePage)=>{const $=load(p.body);$('script,style,noscript').remove();return {entityId:client.id,url:p.url,status:p.status,at:new Date().toISOString(),title:$('title').text().slice(0,200),headings:$('h1,h2').map((_,e)=>$(e).text().slice(0,200)).get().slice(0,20),excerpt:$('body').text().replace(/\s+/g,' ').slice(0,800)};};
 pages.push(snapshot(page));
 if(includePages&&page.status===200&&page.contentType.includes('text/html')){
  const $=load(page.body);const links=$('a[href]').map((_,e)=>({href:$(e).attr('href')!,text:$(e).text()})).get();
  const candidates=[...new Set(links.filter(l=>/(의료진|전문|서비스|진료|FAQ|질문|상품|제품|배송|예약|구매|about|service|product|faq)/i.test(l.text+' '+l.href)).flatMap(l=>{try{const u=new URL(l.href,page.url);return u.origin===new URL(page.url).origin&&!u.search&&u.pathname!==new URL(page.url).pathname?[u.href.split('#')[0]]:[];}catch{return [];}}))].slice(0,2);
  for(const url of candidates)try{const sub=await safeFetch(url,0,true);pages.push(snapshot(sub));if(sub.status!==200||!sub.contentType.includes('text/html'))continue;
   for(const f of inspectHtml(sub.body,sub.url,client)){const existing=findings.find(v=>v.key===f.key);if(existing&&f.status==='pass'&&existing.status!=='pass'&&!['title','headings','meta','canonical','body','indexing'].includes(f.key)){existing.status='pass';existing.evidence=`추가 검사 페이지 ${sub.url}: ${f.evidence}`;}}
  }catch(e){findings.push({key:'page-'+findings.length,label:'주요 페이지 검사',status:'unknown',evidence:url+' · '+(e as Error).message,recommendation:'접근 정책을 유지하고 담당자가 수동 확인'});}
 }
 return {id:randomUUID(),kind:'LIVE',url:page.url,at,findings,pages};
}
export function tasksFromAudit(audit:Audit):Task[]{const tasks:Task[]=audit.findings.filter(f=>f.status!=='pass').map(f=>({id:randomUUID(),auditId:audit.id,title:f.label+' 확인·개선',observedFact:`${f.label}: ${f.status}`,evidence:`${audit.url} · ${audit.at} · ${f.evidence}`,action:f.recommendation,expectedArea:'접근성 / 정보 이해 가능성 (AI 노출 효과 미검증)',remeasurement:'수정 후 같은 URL을 재진단하고 동일 질문·모델·지역·API 유형으로 반복 측정. 검색 실행 및 업체 식별을 검토한 표본끼리 비교.',priority:f.status==='fail'?'P1':'P2',status:'TODO',hypothesis:true}));for(const comparison of audit.competitorComparisons??[])for(const d of comparison.differences)tasks.push({id:randomUUID(),auditId:audit.id,title:comparison.name+' 대비 '+d.key+' 정보 격차 확인',observedFact:'고객 홈페이지에서 미확인, 비교 업체 페이지에서 관련 단서 확인',evidence:`고객 ${audit.url}: ${d.clientEvidence} / 경쟁사 ${comparison.url}: ${d.competitorEvidence}`,action:'실제 제공하는 정보인지 검증 후 누락된 안내를 공식 본문에 보완',expectedArea:d.hypothesis,remeasurement:'두 URL을 같은 검사로 재진단한 후 동일 질문·모델·지역·출처 유형으로 재측정',priority:'P2',status:'TODO',hypothesis:true});return tasks;}
export async function compareCompetitorWebsites(client:Entity,audit:Audit):Promise<CompetitorComparison[]>{const output:CompetitorComparison[]=[];for(const c of client.competitors.filter(c=>c.website).slice(0,2)){
 try{const result=await auditWebsite({...client,...c,address:'',bookingUrl:'',services:'',experts:'',competitors:[]});const keys=['title','meta','schema','contact','location','services','experts','booking','body'];const differences=keys.flatMap(key=>{const a=audit.findings.find(f=>f.key===key),b=result.findings.find(f=>f.key===key);return a&&b&&a.status!=='pass'&&b.status==='pass'?[{key,clientEvidence:a.evidence,competitorEvidence:b.evidence,hypothesis:'공식 정보 단서를 보완하면 확인 가능성과 접근성이 개선될 수 있음. AI 추천의 직접 원인·효과는 미검증.'}]:[];});output.push({entityId:c.id,name:c.name,url:result.url,at:result.at,status:'SUCCEEDED',error:null,findings:result.findings,differences});}
 catch(e){output.push({entityId:c.id,name:c.name,url:c.website,at:new Date().toISOString(),status:'FAILED',error:(e as Error).message,findings:[],differences:[]});}
 }return output;}


