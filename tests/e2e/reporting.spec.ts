import {test,expect} from './fixtures';
import {randomUUID} from 'node:crypto';
import type {ProjectData} from '../../src/lib/types';
test('7-1: LOCAL MOCK 실제 유형의 검증 게이트·UI 질문 범위·비공개 분리·DB 검증 이력',async({page,request})=>{
 const create=await request.post('/api/operations',{data:{action:'create',client:{name:'LOCAL MOCK · 7-1 격리 검증 (실제 실적 아님)',aliases:[],industry:'치과',address:'로컬 시험',website:'https://local-mock.example/',bookingUrl:'',services:'',experts:'',competitors:[]},onboarding:{kind:'CLIENT',profile:'MEDICAL',brandName:'LOCAL MOCK',contactName:'PRIVATE-CONTACT',contactChannel:'PRIVATE-CHANNEL',region:'서울',businessGoal:'격리 합성 입력 시험',objectives:[],accountOwner:'시험',facts:{}}}});expect(create.ok()).toBe(true);const projectId=(await create.json()).projectId;
 const saved=async():Promise<ProjectData>=>(await (await request.get('/api/operations?projectId='+projectId)).json()).project;
 try{
  await request.post('/api/workspace',{data:{projectId,action:'question',question:{text:'LOCAL MOCK 위치와 예약 방법을 확인해줘.',intent:'예약',importance:3,commercialIntent:3}}});const p=await saved(),question=p.questions[0];
  const observation={projectId,questionId:question.id,kind:'CONSUMER_UI_MANUAL',screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK',actualQuestion:question.text,questionSubmittedAt:'2026-10-01T00:00:00Z',answerRecordedAt:'2026-10-01T00:01:00Z',country:'대한민국',region:'서울',searchUsage:'USED',rawText:'PRIVATE-RAW · LOCAL MOCK 일반 안내. 실제 AI 수집 아님.',citations:[],consumerScreenConfirmed:true,observer:'시험 수집자',studyId:null,phase:'UNASSIGNED',repetition:1,evidenceIds:[],inputKey:randomUUID()};
  expect((await request.post('/api/observations',{data:{projectId,action:'save',observation}})).ok()).toBe(true);
  const r=(await saved()).responses[0];expect(r.verification?.status).toBe('UNVERIFIED');expect(r.classification).toBe('CLIENT_CONFIDENTIAL');
  await page.goto('/');await page.getByLabel('프로젝트 선택').selectOption(projectId);await page.getByRole('button',{name:'고객사 보고서',exact:true}).first().click();
  await page.getByLabel('보고서 시작일').fill('2026-10-01');await page.getByLabel('보고서 종료일').fill('2026-10-31');await page.getByLabel('보고서 질문 '+question.text).check();await page.getByRole('button',{name:'보고서 원본 버전 생성'}).click();
  await expect.poll(async()=>(await saved()).reports?.length).toBe(1);let report=(await saved()).reports![0];expect(report.rowCount).toBe(0);expect(report.html).toContain('검증된 관측 데이터 없음');expect(report.html).not.toContain('PRIVATE-RAW');
  await page.getByRole('button',{name:'AI 실측 연구소',exact:true}).first().click();await page.getByText('ChatGPT · '+question.text+' · CONSUMER_UI_MANUAL · UNVERIFIED',{exact:false}).click();
  await page.getByLabel('검증자',{exact:true}).fill('시험 검토자');await page.getByLabel('검증 근거',{exact:true}).fill('PRIVATE-EVIDENCE · 로컬 모의 원문과 조건 확인');await page.getByLabel('관측 출처 대조 완료').check();await page.getByRole('button',{name:'검증 기록 저장'}).click();
  await expect.poll(async()=>(await saved()).responses[0].verification?.status).toBe('VERIFIED');const after=(await saved()).responses[0];expect(after.rawText).toBe(observation.rawText);expect(after.verification?.sourceConfirmed).toBe(true);expect(after.verification?.history).toHaveLength(1);expect(after.verification?.actorId).toBeTruthy();
  await page.getByRole('button',{name:'고객사 보고서',exact:true}).first().click();await page.getByLabel('보고서 시작일').fill('2026-10-01');await page.getByLabel('보고서 종료일').fill('2026-10-31');await page.getByRole('button',{name:'보고서 원본 버전 생성'}).click();await expect.poll(async()=>(await saved()).reports?.length).toBe(2);
  report=(await saved()).reports!.at(-1)!;expect(report.rowCount).toBe(1);expect(report.reporting?.selectedQuestions).toBe(1);expect(report.html).not.toContain('PRIVATE-');expect(report.html).toContain('Query Coverage');expect(report.reporting?.purpose).toBe('EXTERNAL_CONFIRMED');
  expect((await request.get('/api/client-reports?projectId=wrong&id='+report.id)).status()).toBe(400);
  const api=await request.post('/api/observations',{data:{projectId,action:'verification',responseId:r.id,status:'REJECTED',reviewer:'시험 검토자',note:'추가 로컬 대조 결과 제외',sourceConfirmed:true}});expect(api.ok()).toBe(true);expect((await saved()).responses[0].rawText).toBe(observation.rawText);expect((await saved()).reports!.at(-1)!.sha256).toBe(report.sha256);
 }finally{await request.post('/api/workspace',{data:{action:'delete',projectId}});}
});
