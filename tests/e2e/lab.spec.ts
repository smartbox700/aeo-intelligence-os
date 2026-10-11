import {test,expect} from './fixtures';
test('실측 연구소: 키 미설정 안내·질문 세트·DEMO 식별 수정·원문 보존',async({page,request})=>{
 const config=await (await request.get('/api/measurements')).json();
 await page.goto('/');await page.getByRole('button',{name:'AI 실측 연구소',exact:true}).first().click();await expect(page.getByRole('heading',{name:'AI 실측 연구소',exact:true})).toBeVisible();
 await page.getByText('기존 API 관측 · 실측 대기',{exact:true}).click();
 if(!config.config.configured||!config.config.liveEnabled){await expect(page.getByRole('button',{name:'실제 측정 실행',exact:true})).toBeDisabled();await expect(page.getByText(config.config.liveEnabled?'OPENAI_API_KEY가 서버에 없습니다.':'API 실측 대기 · LIVE_AI_ENABLED=false.',{exact:false})).toBeVisible();}
 const original=await (await request.get('/api/workspace')).json();const sample=original.projects.find((p:{client:{name:string}})=>p.client.name==='홍제 A치과');const before=sample.responses.length;
 await request.post('/api/measurements',{data:{action:'test-questions',projectId:sample.id}});
 const current=await (await request.get('/api/workspace')).json();const preserved=current.projects.find((p:{id:string})=>p.id===sample.id);expect(preserved.responses.length).toBe(before);expect(preserved.questions.some((q:{text:string})=>q.text==='홍제역 근처 임플란트 진료 치과 3곳을 비교하고 의료진, 위치, 예약 방법을 알려줘.')).toBe(true);
 await page.getByText('기존 API 관측 · 실측 대기',{exact:true}).click();
 if(!config.config.configured||!config.config.liveEnabled){const denied=await request.post('/api/measurements',{data:{action:'measure',projectId:sample.id,provider:'OpenAI',region:'서울',questionIds:[sample.questions[0].id],idempotencyKey:crypto.randomUUID()}});expect(denied.status()).toBe(400);expect((await denied.json()).error).toContain(config.config.liveEnabled?'OPENAI_API_KEY':'LIVE_AI_ENABLED=false');}
 const made=await request.post('/api/workspace',{data:{action:'create',client:{name:'테스트 고객 치과',aliases:[],website:'https://client.example',industry:'치과',address:'서울',bookingUrl:'',services:'',experts:'',competitors:[{name:'테스트 B치과',aliases:[],website:''}]}}});const {projectId}=await made.json();
 try{
  await request.post('/api/workspace',{data:{action:'question',projectId,question:{text:'임플란트 상담 업체 비교',intent:'비교',importance:3,commercialIntent:3}}});
  const all=await (await request.get('/api/workspace')).json();const p=all.projects.find((p:{id:string})=>p.id===projectId);const raw='1. **가상미소치과** — 확인된 의료 자격은 없습니다.\n2. **테스트 고객 치과** — 위치를 확인하세요.';
  const save=await request.post('/api/workspace',{data:{action:'response',projectId,response:{questionId:p.questions[0].id,provider:'ChatGPT',model:'SAMPLE · 실제 측정 아님',kind:'DEMO',observedAt:new Date().toISOString(),region:'서울',rawText:raw,citations:['https://clinic.example/']}}});expect(save.ok()).toBe(true);
  await page.reload();await page.getByLabel('프로젝트 선택').selectOption(projectId);await page.getByRole('button',{name:'AI 실측 연구소',exact:true}).first().click();await page.getByText('기존 API 관측 · 실측 대기',{exact:true}).click();await page.getByLabel('실측 결과 유형').selectOption('DEMO');
  await expect(page.getByText('가상미소치과',{exact:true})).toBeVisible();await expect(page.getByText('REVIEW_REQUIRED',{exact:true})).toBeVisible();
  await page.getByLabel('업체 식별 매핑').first().selectOption(p.client.competitors[0].id);await page.getByLabel('식별 수정 근거').first().fill('SAMPLE 업체의 테스트 별칭 대조');await page.getByRole('button',{name:'식별 확인',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('저장되었습니다');
  const after=await (await request.get('/api/workspace')).json();const r=after.projects.find((p:{id:string})=>p.id===projectId).responses[0];expect(r.rawText).toBe(raw);expect(r.entityAnalysis.status).toBe('READY');expect(r.entityAnalysis.reviewHistory.length).toBe(1);expect(r.entityAnalysis.entities[0].role).toBe('competitor');
  const csv=await request.get('/api/workspace?export=1&projectId='+projectId+'&kind=DEMO');expect(await csv.text()).toContain('명시적 소개 번호');
 }finally{await request.post('/api/workspace',{data:{action:'delete',projectId}});}
});

