import {load} from 'cheerio';
import {createHash,randomUUID} from 'node:crypto';
import {safeFetch,validateUrl,isPublicIp} from './audit';
import {isIP} from 'node:net';
import type {PageSnapshot} from './studio-types';
import type {ProjectData} from './types';

export function publicUrl(value:string){const u=validateUrl(value);const host=u.hostname.replace(/^\[|\]$/g,'');if(isIP(host)&&!isPublicIp(host))throw new Error('내부/예약 IP URL은 차단됩니다.');return u.href;}
export function assertTarget(p:ProjectData,url:string,channel:PageSnapshot['channel']){
 const u=new URL(publicUrl(url));if(u.hash)throw new Error('페이지 URL의 #fragment는 제거하세요.');
 if(channel==='WEBSITE'){if(!p.client.website||u.origin!==new URL(p.client.website).origin)throw new Error('등록된 고객사 공식 홈페이지의 페이지만 선택하세요.');}
 else if(channel==='NAVER'&&!['smartstore.naver.com','brand.naver.com','shopping.naver.com'].includes(u.hostname))throw new Error('네이버 상품 URL만 입력하세요.');
 else if(channel==='COUPANG'&&u.hostname!=='www.coupang.com'&&u.hostname!=='coupang.com')throw new Error('쿠팡 상품 URL만 입력하세요.');
 return u.href;
}
/** Parse untrusted HTML as data only. Raw HTML and scripts never reach a preview/export. */
export function parseStudioPage(html:string,url:string,kind:PageSnapshot['kind'],channel:PageSnapshot['channel']='WEBSITE',meta={status:200,xRobotsTag:'',policy:'담당자 제공 HTML · 외부 접근 없음'}):PageSnapshot{
 const $=load(html),text=(selector:string)=>$(selector).map((_,e)=>$(e).text().replace(/\s+/g,' ').trim().slice(0,400)).get().filter(Boolean).slice(0,40);
 const jsonLd:unknown[]=[],jsonLdErrors:string[]=[];
 $('script[type="application/ld+json"]').each((i,e)=>{if(i>=10)return;try{jsonLd.push(JSON.parse($(e).text()));}catch{jsonLdErrors.push('JSON-LD 구문 오류 · 블록 '+(i+1));}});
 const resolve=(value:string)=>{try{const u=new URL(value,url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 const links=$('a[href]').map((_,e)=>({text:$(e).text().trim().slice(0,200),url:resolve($(e).attr('href')??'')})).get().filter(l=>l.url).slice(0,100);
 const title=$('title').text().trim().slice(0,300),description=($('meta[name="description"]').attr('content')??'').slice(0,1000),h1=text('h1'),h2=text('h2'),h3=text('h3');
 const canonical=$('link[rel="canonical"]').attr('href');const technical={status:meta.status,canonical:canonical?resolve(canonical):'',robots:$('meta[name="robots"],meta[name="googlebot"]').map((_,e)=>($(e).attr('name')??'')+': '+($(e).attr('content')??'')).get().join(' | '),xRobotsTag:meta.xRobotsTag,viewport:$('meta[name="viewport"]').attr('content')??'',policy:meta.policy};
 $('script,style,noscript,iframe,object,svg,template').remove();$('br').replaceWith(' ');$('p,h1,h2,h3,section,div,li').append(' ');const body=$('body').text().replace(/\s+/g,' ').trim().slice(0,30000);
 const snippet=(r:RegExp)=>{const m=body.match(r);return m?body.slice(Math.max(0,(m.index??0)-30),(m.index??0)+180):'누락 또는 확인 불가';};
 return {id:randomUUID(),kind,channel,url,at:new Date().toISOString(),sha256:createHash('sha256').update(html).digest('hex'),title,description,h1,h2,h3,body,links,jsonLd,jsonLdErrors,technical,content:{name:snippet(/(치과|병원|법무법인|법무사|브랜드)/),services:snippet(/(진료|임플란트|서비스|상품)/),experts:snippet(/(의료진|원장|변호사|법무사|전문가)/),address:snippet(/(주소|서울|도로명)/),hours:snippet(/(운영시간|진료시간|영업시간)/),booking:snippet(/(예약|상담|구매)/)},auditId:''};
}
export async function inspectStudioPage(p:ProjectData,url:string){const target=assertTarget(p,url,'WEBSITE'),page=await safeFetch(target,0,true,{deadline:Date.now()+40000,requests:12});if(page.status!==200||!page.contentType.includes('text/html'))throw new Error('정상 공개 HTML을 확인하지 못했습니다. HTTP '+page.status);assertTarget(p,page.url,'WEBSITE');return parseStudioPage(page.body,page.url,'LIVE','WEBSITE',{status:page.status,xRobotsTag:page.xRobotsTag,policy:'safeFetch: DNS/IP 고정 · 리디렉션별 robots 정책 검사 · 총 40초/12요청/응답 1MB 제한'});}
export function demoPageHtml(name='홍제 A치과',profile='MEDICAL'){const escaped=name.replace(/[<>&"']/g,'');return '<!doctype html><html lang="ko"><head><title>홈</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>'+escaped+'</h1><p>DEMO 가상 홈페이지. '+(profile==='COMMERCE'?'상품 사양·소재·가격·배송·반품':profile==='LEGAL'?'주요 업무·자격·상담':profile==='MEDICAL'?'임플란트 상담':'공식 브랜드·서비스')+' 정보는 고객사 확인이 필요합니다.</p><h2>문의 안내</h2><p>공식 상세정보·경로·증빙은 미등록입니다.</p></body></html>';}
