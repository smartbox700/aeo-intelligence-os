import {requireStaff,assertProjectAccess,allowedProjects,safeWorkspaceProject,grantCreatedProject,accessEvent,failure} from '@/lib/auth';
import {NextRequest,NextResponse} from 'next/server';
import {getStore,mutate} from '@/lib/store';
import {measurementConfig} from '@/lib/openai-provider';
import {measurementInput,runMeasurement,ownedProject} from '@/lib/measurement-service';
import {reviewInput,reviewEntity} from '@/lib/review';
import {addMeasurementQuestions} from '@/lib/test-questions';
import {extractEntities,mentionsFromAnalysis} from '@/lib/entity-analysis';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(req:NextRequest){try{await requireStaff(req);return NextResponse.json({config:measurementConfig(),providers:[{id:'OpenAI',available:measurementConfig().configured&&measurementConfig().liveEnabled,sourceType:'API_OBSERVATION'},{id:'Gemini Grounding',available:false,sourceType:'API_OBSERVATION'},{id:'네이버 검색·지역 API',available:false,sourceType:'SEARCH_API'},{id:'네이버 AI 검색 관측',available:false,sourceType:'MANUAL_UI'}]},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{const user=await requireStaff(req);
 const origin=req.headers.get('origin');if(origin&&(new URL(origin).host!==req.headers.get('host')||new URL(origin).protocol!==req.nextUrl.protocol))return NextResponse.json({error:'다른 출처의 요청은 허용되지 않습니다.'},{status:403});
 const text=await req.text();if(Buffer.byteLength(text)>30000)throw new Error('요청 크기 제한 초과');const input=JSON.parse(text);assertProjectAccess(user,String(input.projectId));await accessEvent(user,'자료 접근:measurements:'+String(input.action),input.projectId);
 if(input.action==='measure')return NextResponse.json(await runMeasurement(measurementInput.parse(input)));
 if(input.action==='test-questions'){const added=await mutate(s=>addMeasurementQuestions(ownedProject(s,input.projectId)));return NextResponse.json({added});}
 if(input.action==='analyze'){
  await mutate(s=>{const p=ownedProject(s,input.projectId);const r=p.responses.find(r=>r.id===input.responseId);if(!r)throw new Error('응답을 찾을 수 없습니다.');if(r.entityAnalysis?.reviewHistory.length)throw new Error('담당자 수정 이력이 있어 자동 분석으로 덮어쓸 수 없습니다.');r.entityAnalysis=extractEntities(r.rawText,p.client,r.measurement?.citedSources);r.mentions=mentionsFromAnalysis(r.entityAnalysis);r.analysisVersion=r.entityAnalysis.version;});return NextResponse.json({ok:true});
 }
 if(input.action==='entity-review'){
  const update=reviewInput.parse(input.review);await mutate(s=>{const p=ownedProject(s,input.projectId);const r=p.responses.find(r=>r.id===input.responseId);if(!r)throw new Error('응답을 찾을 수 없습니다.');reviewEntity(p,r,update);});return NextResponse.json({ok:true});
 }
 if(input.action==='add-competitor'){
  const schema=reviewInput.pick({entityId:true});const {entityId}=schema.parse(input);await mutate(s=>{const p=ownedProject(s,input.projectId);const r=p.responses.find(r=>r.id===input.responseId);const e=r?.entityAnalysis?.entities.find(e=>e.id===entityId);if(!e)throw new Error('추출 업체를 찾을 수 없습니다.');if(p.client.competitors.some(c=>c.name===e.name))throw new Error('이미 등록된 경쟁 업체입니다.');p.client.competitors.push({id:crypto.randomUUID(),name:e.name,aliases:[],website:''});});return NextResponse.json({ok:true});
 }
 throw new Error('지원하지 않는 작업');
}catch(e){return failure(e);}}

