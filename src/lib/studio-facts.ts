import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {Staff} from './auth';
import type {ProjectData} from './types';
import type {VerifiedFact} from './studio-types';
import {FACT_FIELDS} from './studio-config';
import {publicUrl} from './studio-page';
export function studioRepo(p:ProjectData){return p.client.studioRepository??={facts:[],pages:[]};}
export function effectiveFactStatus(f:VerifiedFact,now=Date.now()){
 if(f.status!=='VERIFIED')return f.status;
 if(!f.checkedAt||!f.checkedBy||!f.source||(!f.sourceUrl&&!f.evidence))return 'UNVERIFIED';
 if(f.expiresAt&&Date.parse(f.expiresAt)<now||['price','currency'].includes(f.key)&&now-Date.parse(f.checkedAt)>86400000)return 'EXPIRED';
 return 'VERIFIED';
}
export function verifiedFacts(p:ProjectData){const facts=p.client.studioRepository?.facts??[];return facts.filter(f=>effectiveFactStatus(f)==='VERIFIED'&&!facts.some(other=>other.id!==f.id&&other.key===f.key&&other.value!==f.value&&['VERIFIED','CONFLICTING'].includes(effectiveFactStatus(other))));}
export function factFingerprint(p:ProjectData,ids:string[]){return createHash('sha256').update(JSON.stringify(ids.slice().sort().map(id=>{const f=verifiedFacts(p).find(f=>f.id===id);return f?{id:f.id,key:f.key,value:f.value,updatedAt:f.updatedAt}:null;}))).digest('hex');}
export function assertNoSecrets(text:string){if(/(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|(?:api[_ -]?key|secret|password|비밀번호)\s*[:=]\s*\S{5,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+@)/i.test(text))throw new Error('공개 콘텐츠에 키·비밀번호·내부 연결정보를 포함할 수 없습니다.');}
export function saveStudioFact(p:ProjectData,input:unknown,actor:Staff){
 const v=z.object({id:z.string().optional(),key:z.enum(Object.keys(FACT_FIELDS) as [keyof typeof FACT_FIELDS,...(keyof typeof FACT_FIELDS)[]]),value:z.string().trim().max(3000),source:z.string().trim().max(500),sourceUrl:z.string().trim().max(2000),evidence:z.string().trim().max(3000),checkedAt:z.union([z.literal(''),z.iso.datetime()]),status:z.enum(['VERIFIED','UNVERIFIED','CONFLICTING','EXPIRED','NOT_PROVIDED']),expiresAt:z.union([z.literal(''),z.iso.datetime()])}).parse(input);
 if(v.sourceUrl)v.sourceUrl=publicUrl(v.sourceUrl);if(v.key.endsWith('Url')&&v.value)v.value=publicUrl(v.value);assertNoSecrets(v.value);
 if(v.status==='VERIFIED'&&(!v.value||v.source.length<2||(!v.sourceUrl&&v.evidence.length<5)||!v.checkedAt||Date.parse(v.checkedAt)>Date.now()+300000))throw new Error('검증에는 내용·출처·증빙·현재 또는 과거 확인 시각이 필요합니다.');
 if(v.expiresAt&&(!v.checkedAt||Date.parse(v.expiresAt)<=Date.parse(v.checkedAt)))throw new Error('만료 시각은 확인 시각 이후여야 합니다.');
 const repo=studioRepo(p),old=v.id?repo.facts.find(f=>f.id===v.id):repo.facts.find(f=>f.key===v.key);if(v.id&&!old)throw new Error('사실정보 프로젝트 소속 오류');if(old&&old.key!==v.key)throw new Error('사실정보 항목 변경은 새 항목으로 등록하세요.');
 const at=new Date().toISOString();const previous=old?(({history:_,...rest})=>rest)(structuredClone(old)):null;
 const fact:VerifiedFact={...v,id:old?.id??randomUUID(),checkedBy:v.status==='VERIFIED'?actor.name:'',updatedAt:at,history:[...(old?.history??[]),{at,actorId:actor.id,previous}]};if(old)Object.assign(old,fact);else repo.facts.push(fact);
 return fact;
}
