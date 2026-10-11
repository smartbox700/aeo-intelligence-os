import {z} from 'zod';
import type {ProjectData} from './types';
import type {Staff} from './auth';
import type {PilotRepository,PilotAgreement,PilotProof,PilotEvent} from './pilot-types';
export const pilotNow=()=>new Date().toISOString();
export const pilotToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
export const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export const screenSchema=z.enum(['CHATGPT_WEB_SEARCH','GEMINI_CONSUMER_SEARCH','NAVER_AI_BRIEFING']);
export const text=z.string().trim().min(5).max(3000),short=z.string().trim().min(2).max(150),ids=z.array(z.uuid()).max(100);
export const pilotMoney=z.number().int().min(0).max(1000000000000).nullable();
export const proofSchema=z.object({reference:z.string().trim().min(5).max(2000),documentIds:z.array(z.uuid()).max(5).default([]),reviewer:short,checkedAt:z.iso.datetime(),checked:z.literal(true)}).strict();
export function pilotRepo(p:ProjectData):PilotRepository{if(!p.operations)throw new Error('고객사 온보딩이 필요합니다.');return p.operations.pilot??={version:'sales-pilot-v1',revision:0,agreements:[],activities:[],proposals:[],conversions:[],documents:[]};}
export function readPilotRepo(p:ProjectData):PilotRepository{return p.operations?.pilot??{version:'sales-pilot-v1',revision:0,agreements:[],activities:[],proposals:[],conversions:[],documents:[]};}
export function ownPilot(p:ProjectData,id:string):PilotAgreement{const a=readPilotRepo(p).agreements.find(a=>a.id===id);if(!a||a.projectId!==p.id||a.clientId!==p.client.id||a.kind!==p.operations?.kind)throw new Error('이 고객사의 Pilot만 연결하세요.');return a;}
export const pilotTerms=(a:PilotAgreement)=>a.versions.at(-1)!.terms;
export function pilotEvent(actor:Staff,action:string,note:string):PilotEvent{return {at:pilotNow(),actorId:actor.id,action,note};}
export function verifyPilotProof(p:ProjectData,input:unknown):PilotProof{const v=proofSchema.parse(input);if(Date.parse(v.checkedAt)>Date.now()+300000)throw new Error('미래의 확인 사실을 등록할 수 없습니다.');for(const id of v.documentIds){const d=readPilotRepo(p).documents.find(d=>d.id===id&&d.projectId===p.id);if(!d)throw new Error('다른 고객사의 증빙 파일입니다.');}return v;}
export function currentPilotVersion(a:PilotAgreement,expected:number){const v=a.versions.at(-1)!;if(v.version!==expected)throw new Error('협약 버전 충돌 · 최신 자료를 조회하세요.');return v;}
export function assertPilotActive(a:PilotAgreement){if(a.status!=='ACTIVE'||!a.actualStart||!a.versions.at(-1)!.agreement)throw new Error('확인된 합의 후 ACTIVE 상태의 Pilot에서만 수행할 수 있습니다.');}
export function permission(a:PilotAgreement,category:PilotAgreement['consents'][number]['category'],date=pilotToday()){const c=a.consents.filter(c=>c.category===category).at(-1);return !!c&&c.decision==='GRANTED'&&c.from<=date&&c.to>=date;}
export function assertPermission(a:PilotAgreement,category:PilotAgreement['consents'][number]['category'],date=pilotToday()){if(!permission(a,category,date))throw new Error('해당 항목의 유효한 고객 권한·동의가 필요합니다: '+category);}
export function assertManagement(actor:Staff){if(!['OWNER','MANAGER'].includes(actor.role))throw new Error('Pilot 관리 권한이 필요합니다.');}
export function noGuarantees(value:unknown){const strings:string[]=[];const visit=(v:unknown)=>{if(typeof v==='string')strings.push(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(value);if(strings.some(s=>/(?:AI\s*)?추천\s*(?:순위|노출).*보장|(?:상담|예약|매출|효과|승소|치료).*보장|(?:국내|전국)\s*1위|100\s*%.*(?:성공|완치)/i.test(s.replace(/보장\s*(?:하지\s*않습니다|하지\s*않음|없음|할\s*수\s*없습니다)/g,'한계'))))throw new Error('성과·추천·치료 보장 표현을 수정하세요.');}
export function assertRepositorySize(p:ProjectData){const r=readPilotRepo(p);if(Buffer.byteLength(JSON.stringify(r))>4000000)throw new Error('Pilot 운영 payload는 4MB 제한입니다. 문서는 별도 첨부하세요.');if(r.agreements.length>30||r.proposals.length>100||r.activities.length>1000||r.documents.length>300)throw new Error('Pilot 기록 개수 제한');}
