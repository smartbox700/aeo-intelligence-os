import {createHash} from 'node:crypto';
import type {Entity,EntityAnalysis,ExtractedEntity,Mention,CitedSource} from './types';

export const ENTITY_ANALYSIS_VERSION='context-evidence-v2';
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s·.,()\-]/g,'');
const generic=/(^(?:임플란트|일반|전문|가까운|근처|주변|해당|각|지역|대학|좋은|어떤|토요일|진료|동네|여러|특정|가능한|모든|예약|다른|선택한|상담|추천)\s*(?:전문\s*)?(?:치과|병원|의원)$|^(?:치과|병원|의원|클리닉)$|치과를|병원을)/;
function evidenceBlock(raw:string,start:number,end:number){
 const lineStart=raw.lastIndexOf('\n',start-1)+1;let lineEnd=raw.indexOf('\n',end);if(lineEnd<0)lineEnd=raw.length;
 // Include the following description lines of a heading/list item, bounded at next item.
 let cursor=lineEnd+1;while(cursor<raw.length&&cursor-lineStart<800){const nextEnd=raw.indexOf('\n',cursor);const finish=nextEnd<0?raw.length:nextEnd;const line=raw.slice(cursor,finish);if(/^\s*(?:\d+[.)]|[-*]\s|#{1,6}\s)/.test(line)||!line.trim())break;lineEnd=finish;cursor=finish+1;}
 return {start:lineStart,end:lineEnd,quote:raw.slice(lineStart,lineEnd)};
}
function isBoundary(raw:string,start:number,name:string){const before=raw[start-1]??'';const after=raw[start+name.length]??'';return !/[\p{L}\p{N}]/u.test(before)&&(!/^[a-z0-9]/i.test(name)||!/[a-z0-9]/i.test(after));}
function distance(a:string,b:string){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const tmp=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp;}}return row[b.length];}

/** Evidence-driven, conservative extraction. No hospital existence or medical facts are inferred. */
export function extractEntities(raw:string,client:Entity,sources:CitedSource[]=[]):EntityAnalysis{
 const registry=[{...client,role:'client' as const},...client.competitors.map(e=>({...e,role:'competitor' as const}))];
 const candidates:{name:string;start:number;end:number;structured:boolean}[]=[];
 const add=(name:string,start:number,structured:boolean)=>{name=name.trim();if(name.length<2||name.length>60||generic.test(name))return;const actual=raw.indexOf(name,start);if(actual<0)return;if(!candidates.some(c=>c.start===actual&&normalized(c.name)===normalized(name)))candidates.push({name,start:actual,end:actual+name.length,structured});};
 // Known names are candidates, then disambiguated by registry and context.
 for(const e of registry)for(const name of [e.name,...e.aliases].filter(Boolean)){let cursor=0;while(cursor<raw.length){const at=raw.toLowerCase().indexOf(name.toLowerCase(),cursor);if(at<0)break;if(isBoundary(raw,at,name))add(raw.slice(at,at+name.length),at,false);cursor=at+name.length;}}
 // Markdown names/list headings, quoted names, and medical/legal business suffixes.
 for(const match of raw.matchAll(/\*\*([^*\n]{2,60})\*\*|[“「]([^”」\n]{2,60})[”」]/g)){const name=match[1]??match[2];if(/(?:치과|의원|병원|클리닉|법무법인|법률사무소)/.test(name))add(name,match.index!,true);}
 for(const match of raw.matchAll(/[가-힣A-Za-z0-9·]{2,30}(?:\s+[A-Za-z0-9]{1,8})?\s*(?:치과(?:의원|병원)?|의원|병원|클리닉|법률사무소)/g)){
  const name=match[0].replace(/^(?:근처|주변|추천|일반|전문|특정|지역)\s+/,'');add(name,match.index!,/^\s*(?:\d+[.)]|[-*]|#{1,6})/.test(raw.slice(raw.lastIndexOf('\n',match.index!-1)+1,match.index!)));
 }
 // Include named brands in numbered Markdown headings even without an industry suffix.
 for(const match of raw.matchAll(/^\s*(?:#{1,6}\s*)?\d+[.)]\s+\*\*([^*\n]{2,60})\*\*/gm))add(match[1],match.index!,true);
 for(const match of raw.matchAll(/^\s*(?:#{1,6}\s*)?\d+[.)]\s+([^:\n—–|]+?)(?=\s*(?:[—–:]|\s-\s|\n|$))/gm)){const name=match[1].replaceAll('**','').trim();if(name.length<=40&&!/(기준|확인|의료진|주의사항|절차|비교|자료|안내|연락처|예약 방법|진료시간|합니다|하세요)/.test(name))add(name,match.index!,true);}
 const entities:ExtractedEntity[]=[];
 for(const c of candidates.sort((a,b)=>a.start-b.start||b.name.length-a.name.length)){
  // A longer heading name takes precedence over its substring.
  if(entities.some(e=>c.start>=e.start&&c.end<=e.end))continue;
  const matches=registry.filter(e=>[e.name,...e.aliases].some(a=>normalized(a)===normalized(c.name)));
  const similar=matches.length?[]:registry.filter(e=>[e.name,...e.aliases].some(a=>normalized(a).length>=4&&distance(normalized(a),normalized(c.name))<=1));
  const block=evidenceBlock(raw,c.start,c.end);const q=block.quote;
  const city=q.match(/(?:서울|부산|대구|인천|광주|대전|울산|세종)/)?.[0];
  const mismatch=matches.some(e=>'address' in e&&!!e.address&&city&&!e.address.includes(city));
  const ambiguous=matches.length>1||similar.length>0||mismatch;
  const sentenceStart=Math.max(raw.lastIndexOf('.',c.start-1),raw.lastIndexOf(';',c.start-1),raw.lastIndexOf('\n',c.start-1))+1;
  const sentenceEnds=['.',';','\n'].map(mark=>raw.indexOf(mark,c.end)).filter(at=>at>=0);const sentence=raw.slice(sentenceStart,sentenceEnds.length?Math.min(...sentenceEnds):raw.length);
  const negated=/(추천하지|추천할 수(?:는)? 없|추천.{0,15}(아닙|않습|어렵)|추천 대상.{0,8}아니|후보.{0,8}(아니|제외)|언급.{0,8}(없|않)|특정.{0,15}추천.{0,8}(않|없))/.test(sentence);
  const leading=raw.slice(block.start,c.start).replace(/#{1,6}/g,'').trim();const number=leading.match(/^(\d+)[.)]\s*(?:\*\*)?$/)?.[1];
  const listed=!!number||/^\s*(?:[-*]\s+|#{1,6}\s+)/.test(raw.slice(block.start,c.start));
  const recommendation=!negated&&(listed||/(추천|후보|상담을 받을|비교할.{0,8}(치과|업체)|선택지)/.test(sentence));
  const confidence=ambiguous?'LOW':matches.length===1?'HIGH':c.structured?'MEDIUM':'LOW';
  const role=ambiguous?'unresolved':matches[0]?.role??'discovered';
  const sourceUrls=sources.filter(s=>(s.start!==null&&s.end!==null&&s.start<block.end&&s.end>block.start)||normalized(s.title).includes(normalized(c.name))).map(s=>s.url);
  entities.push({id:createHash('sha256').update(c.name+':'+c.start).digest('hex').slice(0,20),name:c.name,matchedEntityId:ambiguous?null:matches[0]?.id??null,role,context:negated?'NEGATED':recommendation?'RECOMMENDATION':'BACKGROUND',introductionOrder:recommendation&&number?Number(number):null,confidence,evidenceQuote:block.quote,start:c.start,end:c.end,identityReason:ambiguous?'등록명 충돌·유사명·지역 불일치: 담당자 식별 필요':matches.length?'등록 업체명/별칭과 정확히 일치; 존재·자격은 별도 검증':'응답에서 명칭 추출; 실존·동명 업체 식별은 담당자 검토 필요',sourceUrls:[...new Set(sourceUrls)],review:ambiguous||!matches.length?'PENDING':'ACCEPTED'});
 }
 const unique=entities.filter((e,i)=>!entities.slice(0,i).some(prev=>normalized(prev.name)===normalized(e.name)&&prev.context===e.context));
 return {version:ENTITY_ANALYSIS_VERSION,method:'CONTEXT_RULES',status:unique.some(e=>e.review==='PENDING')?'REVIEW_REQUIRED':'READY',generalGuidance:!unique.some(e=>e.context==='RECOMMENDATION')&&/(기준|확인|일반|선택|비교|특정.{0,10}추천)/.test(raw),entities:unique,reviewHistory:[]};
}
export function mentionsFromAnalysis(analysis:EntityAnalysis):Mention[]{const found=new Map<string,Mention>();for(const e of analysis.entities){if(e.review==='REJECTED')continue;const key=e.matchedEntityId??'discovered:'+normalized(e.name);if(!found.has(key))found.set(key,{entityId:key,name:e.name,role:e.role==='unresolved'?'discovered':e.role,position:e.start+1,ambiguous:e.review==='PENDING'||e.role==='unresolved'});}return [...found.values()];}
