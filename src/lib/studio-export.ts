import {createHash} from 'node:crypto';
import type {ProjectData} from './types';
import type {StudioDraft} from './studio-types';
import {assertStudioApproved,draftText} from './studio-workflow';
import {assertNoSecrets,verifiedFacts} from './studio-facts';
import {FACT_FIELDS,STUDIO_GUIDES} from './studio-config';
import {csvCell} from './analysis';
export const htmlEscape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderStudioHtml(d:StudioDraft,demo=false){
 const json=d.schema?JSON.stringify(JSON.parse(d.schema)).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026'):'';
 const e=htmlEscape;
 return '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(d.title)+'</title><meta name="description" content="'+e(d.description)+'">'+(json?'<script type="application/ld+json">'+json+'</script>':'')+'</head><body>'+(demo?'<p>DEMO · 가상 고객 적용 시뮬레이션 · 실제 홈페이지 게시 아님</p>':'')+'<main><h1>'+e(d.h1)+'</h1>'+d.sections.map(s=>'<section><h2>'+e(s.heading)+'</h2><p>'+e(s.text).replace(/\n/g,'<br>')+'</p></section>').join('')+(d.cta?'<p><a href="'+e(d.cta.url)+'" rel="noopener noreferrer">'+e(d.cta.label)+'</a></p>':'')+'</main></body></html>';
}
export function studioDeliveryFiles(p:ProjectData,id:string){
 const {work,page,version,proposal,t}=assertStudioApproved(p,id);if(!['READY_FOR_EXPORT','DEPLOYED','VERIFIED','FOLLOWUP_PENDING','COMPLETED'].includes(work.state))throw new Error('승인 후 납품 준비 상태로 이동하세요.');
 const d=version.draft,q=p.questions.find(q=>q.id===work.questionId)!,demo=p.operations!.kind==='DEMO',label=demo?'DEMO · 가상 고객, 실제 게시·AI 추천 실적 아님':'담당자 검토·고객 승인 결과물';
 const instructions=page.channel!=='WEBSITE'?'# '+page.channel+' 상품 수정 지시서\n'+label+'\n\n대상: '+page.url+'\n승인 v'+version.version+'\n\n상품명: '+d.title+'\n\n브랜드·제조사·규격·소재·용량·구성·배송·반품은 03 콘텐츠에서 확인된 항목만 해당 판매자 필드에 입력하세요. 원본 이미지와 옵션을 사람이 대조하고 편집 가능한 영역만 반영하세요. 제목/메타/H1/JSON-LD를 플랫폼에 삽입하는 기능은 전제하지 않습니다. HTML은 내용 검토용 참고입니다.':'# 홈페이지 수정 지시서\n'+label+'\n\n대상: '+page.url+'\n작업: '+t.id+' · 승인 v'+version.version+'\n\n## 제목\n기존: '+page.title+'\n수정: '+d.title+'\n\n## 메타 설명\n기존: '+page.description+'\n수정: '+d.description+'\n\n## H1\n기존: '+page.h1.join(' / ')+'\n수정: '+d.h1+'\n\n본문은 03 파일의 필요한 구역만 반영하세요. 전체 HTML로 기존 페이지를 덮어쓰지 마세요. 디자인·메뉴·예약 기능·기존 내부 링크는 백업 후 유지하세요.\nJSON-LD는 해당 내용을 표시하는 페이지 head 또는 body에 1회 삽입. 기존 같은 사업체 마크업과 충돌하면 기존 코드를 정비하고 재검토.';
 const files:Record<string,string>={
  '01_고객사_진단요약.md':'# AEO 실행 진단\n'+label+'\n\n공식 명칭: '+(verifiedFacts(p).find(f=>f.key==='officialName')?.value??'')+'\n대상: '+page.url+'\n원본 시각: '+page.at+'\n원본 SHA256: '+page.sha256+'\n관련 질문: '+q.text+'\n의도: '+q.intent+'\n\n'+d.contentDecision+'\n관측 원문·환자·상담 자료·내부 증빙·원가·API 키는 이 패키지에 포함하지 않습니다.\n',
  '02_홈페이지_수정지시서.md':instructions,
  '03_콘텐츠_수정안.md':'# 페이지 콘텐츠 수정안\n'+label+'\n\n'+draftText(d)+'\n\n'+(d.cta?d.cta.label+': '+d.cta.url:'공식 상담·구매 경로는 제공된 자료만 반영'),
  '04_구조화데이터.json':d.schema||'null',
  '05_적용체크리스트.txt':'[ ] 원본 HTML·CMS 설정 백업\n[ ] 승인 버전 '+version.version+'과 고객 확인 대조\n[ ] 제목·설명·H1·본문 필요한 구역만 교체\n[ ] 기존 메뉴·내부 링크·폼·모바일 표시 유지\n[ ] 사실정보·실제 화면·JSON-LD 값 일치\n[ ] '+(page.channel==='WEBSITE'?'중복 JSON-LD 제거·공식 Validator와 Rich Results Test 별도 검토':'마켓플레이스 편집 가능 항목만 반영 · JSON-LD 삽입 없음')+'\n[ ] 광고규정·사전심의 적용 여부 전문 담당자 검토\n[ ] 적용일·증빙 저장 후 공개 페이지 재점검\n',
  '06_검수및재측정계획.md':'# 검수·재측정\n'+label+'\n\n공개 페이지 제목·메타·H1·본문·공식 경로·JSON-LD를 승인 버전과 비교합니다. 제공 HTML 수동 대조와 DEMO 검증은 실제 공개 페이지 자동 확인과 구분합니다.\n\n같은 질문·플랫폼·지역·모델 표시·검색 조건으로 기존 Baseline·Follow-up 계획을 사용하세요. 예약은 앱 내부 예정 기록이며 자동 AI 호출이 없습니다. 미관측 지표는 측정 전입니다. 변경이 AI 추천 변화의 유일한 원인임을 보장하지 않습니다.\n\n공식 검토 자료 (2026-10-09 확인):\n'+STUDIO_GUIDES.map(g=>'- '+g.label+': '+g.url).join('\n')+'\n고객 승인 버전: '+proposal.approval.version+'\n',
  '03_페이지_수정초안.html':renderStudioHtml(d,demo),
  '01_공개_사실정보.csv':'\uFEFF'+['항목,내용,확인시각',...verifiedFacts(p).filter(f=>d.factIds.includes(f.id)).map(f=>[FACT_FIELDS[f.key as keyof typeof FACT_FIELDS],f.value,f.checkedAt].map(csvCell).join(','))].join('\r\n')
 };
 for(const value of Object.values(files))assertNoSecrets(value);return files;
}
const crcTable=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function zipDelivery(files:Record<string,string>){const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,content] of Object.entries(files)){const filename=Buffer.from(name,'utf8'),data=Buffer.from(content,'utf8');let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(0x21,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
  local.push(h,filename,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(0x21,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=h.length+filename.length+data.length;
 }const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
export const deliveryHash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
