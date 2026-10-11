import {test,expect} from './fixtures';
test('원문 보존, SSRF 차단과 출처 보호',async({request})=>{
 const make=await request.post('/api/workspace',{data:{action:'create',client:{name:'보안 흐름 SAMPLE',aliases:[],website:'http://127.0.0.1',industry:'일반 기업',address:'',bookingUrl:'',services:'',experts:'',competitors:[]}}});expect(make.ok()).toBe(true);const {projectId}=await make.json();
 try{
  const blocked=await request.post('/api/workspace',{data:{action:'audit',projectId}});expect(blocked.status()).toBe(400);expect((await blocked.json()).error).toContain('차단');
  const origin=await request.post('/api/workspace',{headers:{origin:'https://attacker.example'},data:{action:'delete',projectId}});expect(origin.status()).toBe(403);
  await request.post('/api/workspace',{data:{action:'question',projectId,question:{text:'회사 정보를 확인해줘.',intent:'정보',importance:3,commercialIntent:2}}});
  const data=await (await request.get('/api/workspace')).json();const q=data.projects.find((p:{id:string})=>p.id===projectId).questions[0];const raw='  보안 흐름 SAMPLE\n원문 공백을 보존합니다.  ';
  const saved=await request.post('/api/workspace',{data:{action:'response',projectId,response:{questionId:q.id,provider:'ChatGPT',kind:'MANUAL_UI',model:'미표시',observedAt:new Date().toISOString(),region:'미설정',rawText:raw,citations:[]}}});expect(saved.ok()).toBe(true);
  await request.post('/api/workspace',{data:{action:'reanalyze',projectId}});
  const again=await (await request.get('/api/workspace')).json();expect(again.projects.find((p:{id:string})=>p.id===projectId).responses[0].rawText).toBe(raw);
 }finally{await request.post('/api/workspace',{data:{action:'delete',projectId}});}
});
