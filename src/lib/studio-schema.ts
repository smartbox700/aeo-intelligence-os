import type {ProjectData} from './types';
import type {PageSnapshot,StudioDraft} from './studio-types';
import {verifiedFacts} from './studio-facts';
import {publicUrl} from './studio-page';
export const stableJson=(value:unknown):string=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function schemaNodes(input:unknown):Record<string,unknown>[] {if(Array.isArray(input))return input.flatMap(schemaNodes);if(!input||typeof input!=='object')return [];const v=input as Record<string,unknown>;return Array.isArray(v['@graph'])?v['@graph'].flatMap(schemaNodes):[v];}
/** Bounded supported subset. No reviews, ratings, inferred stock, qualifications, or invented offers. */
export function generateStudioSchema(p:ProjectData,page:PageSnapshot,draft:Pick<StudioDraft,'type'|'sections'|'h1'|'cta'|'channel'>){
 if(page.channel!=='WEBSITE')return '';
 const visible=draft.sections.map(s=>s.text).join(' '),facts=verifiedFacts(p),get=(key:string)=>facts.find(f=>f.key===key&&visible.includes(f.value))?.value??'',profile=p.operations?.onboarding.profile;
 if(!get('officialName')||!get('officialUrl'))return '';
 const graph:Record<string,unknown>[]=[],base={'@id':get('officialUrl').replace(/\/$/,'')+'/#business',name:get('officialName'),url:get('officialUrl')};
 const type=profile==='MEDICAL'?(/치과/.test(p.client.industry)?'Dentist':'MedicalClinic'):profile==='LEGAL'?'LegalService':/(지역|매장|서비스|미용|음식점)/.test(p.client.industry)?'LocalBusiness':'Organization';
 const org:Record<string,unknown>={'@type':type,...base};
 if(get('address'))org.address={'@type':'PostalAddress',streetAddress:get('address')};if(get('phone'))org.telephone=get('phone');
 if(get('hours')&&/^(?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))? )\d{2}:\d{2}-\d{2}:\d{2}$/.test(get('hours')))org.openingHours=get('hours');
 graph.push(org);
 if(draft.type==='PRODUCT'&&get('product')){const product:Record<string,unknown>={'@type':'Product','@id':page.url+'#product',name:get('product'),url:page.url};if(get('brand'))product.brand={'@type':'Brand',name:get('brand')};if(get('manufacturer'))product.manufacturer={'@type':'Organization',name:get('manufacturer')};if(get('model'))product.model=get('model');if(get('specification'))product.description=get('specification');
  if(get('price')&&/^\d+(?:\.\d{1,2})?$/.test(get('price'))&&['KRW','USD','EUR','JPY','GBP','CNY'].includes(get('currency'))&&get('purchaseUrl'))product.offers={'@type':'Offer',price:get('price'),priceCurrency:get('currency'),url:get('purchaseUrl')};graph.push(product);
 }
 // Breadcrumbs are only derived from visible original navigation, never inferred URL paths.
 const home=page.links.find(l=>l.url===get('officialUrl')&&l.text);if(home&&page.url!==home.url&&page.h1[0])graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:home.text,item:home.url},{'@type':'ListItem',position:2,name:page.h1[0],item:page.url}]});
 if(draft.type==='FAQ'&&draft.sections[0]?.heading&&draft.sections[0]?.text&&!draft.sections[0].text.includes('확인 필요'))graph.push({'@type':'FAQPage',mainEntity:[{'@type':'Question',name:draft.sections[0].heading,acceptedAnswer:{'@type':'Answer',text:draft.sections[0].text}}]});
 return JSON.stringify({'@context':'https://schema.org','@graph':graph},null,2);
}
export function validateStudioSchema(p:ProjectData,page:PageSnapshot,draft:StudioDraft){
 const errors:string[]=[],warnings:string[]=['지원하는 Schema.org 부분집합 검사입니다. 전체 의미·검색엔진 적격성·추천 노출을 보증하지 않습니다.','Google FAQ 리치 결과는 2026년 종료 안내됨. 네이버·쿠팡 검색 표시 지원 여부는 별도 확인.'];
 if(!draft.schema)return {errors,warnings,nodes:[] as Record<string,unknown>[]};
 if(page.channel!=='WEBSITE')return {errors:['마켓플레이스에 임의 JSON-LD를 삽입할 수 없습니다.'],warnings,nodes:[]};
 let parsed:unknown;try{parsed=JSON.parse(draft.schema);}catch{return {errors:['JSON-LD 구문 오류'],warnings,nodes:[]};}
 const nodes=schemaNodes(parsed),expected=generateStudioSchema(p,page,draft);if(!expected||stableJson(parsed)!==stableJson(JSON.parse(expected)))errors.push('검증 사실·현재 페이지 초안으로 생성한 구조와 값이 다릅니다. 사실정보 수정 후 재생성하세요.');
 if(!nodes.length)errors.push('지원하는 구조화 데이터 노드가 없습니다.');
 const visible=[draft.title,draft.description,draft.h1,...draft.sections.flatMap(s=>[s.heading,s.text]),...page.links.map(l=>l.text),page.h1.join(' ')].join(' ');
 const allowedUrls=new Set([page.url,...verifiedFacts(p).filter(f=>f.key.endsWith('Url')).map(f=>f.value)]);
 for(const node of nodes){const type=node['@type'];if(!['Organization','LocalBusiness','Dentist','MedicalClinic','LegalService','Product','BreadcrumbList','FAQPage'].includes(String(type)))errors.push('지원되지 않는 @type');
  if(type!=='BreadcrumbList'&&type!=='FAQPage'&&!node.name)errors.push('name 필드 누락');
  if(['Dentist','MedicalClinic','LegalService','LocalBusiness'].includes(String(type))&&!node.address)errors.push('지역 사업체의 검증 주소가 필요합니다.');
  for(const [k,v] of Object.entries(node)){if(['name','telephone','model','description','openingHours'].includes(k)&&typeof v==='string'&&!visible.includes(v))errors.push(k+' 값이 실제 초안 본문에 없습니다.');if(k==='address'&&typeof v==='object'&&v&&!visible.includes(String((v as Record<string,unknown>).streetAddress)))errors.push('주소가 초안 본문과 불일치합니다.');}
 }
 const walk=(v:unknown)=>{if(Array.isArray(v)){v.forEach(walk);return;}if(!v||typeof v!=='object')return;for(const [key,value] of Object.entries(v)){if(['review','aggregateRating','ratingValue'].includes(key))errors.push('후기·평점 생성은 지원하지 않습니다.');if(['url','item','@id'].includes(key)&&typeof value==='string'){try{publicUrl(value);if(!allowedUrls.has(value.split('#')[0])&&!allowedUrls.has(value))errors.push('URL이 확인된 페이지·공식 출처와 다릅니다.');}catch{errors.push('잘못된 공개 URL');}}walk(value);}};walk(parsed);
 const original=page.jsonLd.flatMap(schemaNodes);for(const node of nodes)if(original.some(n=>n['@id']===node['@id']&&!!node['@id']||n['@type']===node['@type']))errors.push('기존 '+node['@type']+' JSON-LD와 중복 가능. 기존 마크업 정비 후 재분석하거나 이 초안의 JSON-LD를 비우세요.');
 if(nodes.some(n=>n['@type']==='Product'&&!n.offers))warnings.push('검증된 가격·지원 통화·구매 URL이 없어 Offer를 생성하지 않았습니다. Google 상품 노출 요건을 별도로 확인하세요.');
 if(page.jsonLdErrors.length)warnings.push('원본 페이지의 JSON-LD 구문 오류를 먼저 검토하세요.');
 return {errors:[...new Set(errors)],warnings,nodes};
}
