import {expect,type APIRequestContext,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {seed} from '../../src/lib/seed';
import {pilotFixture,proof} from '../pilot-fixture';
import {removePilotDocument} from '../../src/lib/pilot-documents';
export async function continuePilot(request:APIRequestContext,page:Page,projectId:string){
 const state=async()=>{const r=await request.get('/api/pilot?projectId='+projectId);expect(r.ok(),await r.text()).toBe(true);return r.json();};
 const post=async(action:string,input:unknown,ok=true)=>{const s=await state(),r=await request.post('/api/pilot',{data:{projectId,expectedRevision:s.repository.revision,action,input}});expect(r.ok(),await r.text()).toBe(ok);return r;};
 const op=async(action:string,fields:object)=>{const r=await request.post('/api/operations',{data:{projectId,action,...fields}});expect(r.ok(),await r.text()).toBe(true);return r.json();};
 const show=async(label:string,id?:string)=>{await page.reload();await page.getByLabel('프로젝트 선택').selectOption(projectId);await page.getByRole('button',{name:label,exact:true}).first().click();await expect(page.getByRole('heading',{name:label,exact:true}).first()).toBeVisible();if(id){await page.getByLabel('Pilot 선택').selectOption(id);await expect(page.getByLabel('Pilot 선택')).toHaveValue(id);}};
 const p=(await state()).project,set=p.client.preScanRepository.sets[0],scan=p.client.preScanRepository.scans[0],sales=p.salesReports.find((r:{status:string})=>r.status==='APPROVED');
 const terms={...pilotFixture().terms,questionIds:[scan.slots[0].questionId],websitePages:1};
 await post('activity',{type:'MEETING',at:new Date().toISOString(),scheduledFor:null,nextContactAt:null,memo:'LOCAL MOCK PDF 검토 영업 미팅',receiptConsent:null,proof:proof()});
 await show('Pilot 영업 활동');await expect(page.getByText('LOCAL MOCK PDF 검토 영업 미팅',{exact:false})).toBeVisible();
 await post('agreement',{scanId:scan.id,salesReportId:sales.id,terms});let a=(await state()).repository.agreements[0];
 await show('30일 무료 실증 계약',a.id);await expect(page.getByLabel('협약 새 버전 Pilot 목적',{exact:true})).toHaveValue(terms.purpose);
 const docs:{storageName:string}[]=[];
 try{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6XkAAAAASUVORK5CYII=','base64');
 const s=await state(),upload=await request.post('/api/pilot/documents',{multipart:{projectId,expectedRevision:String(s.repository.revision),kind:'AGREEMENT',sensitiveDataExcluded:'true',file:{name:'LOCAL-MOCK-agreement.png',mimeType:'image/png',buffer:png}}});expect(upload.ok(),await upload.text()).toBe(true);const docId=(await upload.json()).id;docs.push((await state()).repository.documents.find((d:{id:string})=>d.id===docId));expect(await (await request.get('/api/pilot/documents?projectId='+projectId+'&id='+docId)).body()).toEqual(png);
 const documented=()=>({...proof(),documentIds:[docId]});
 for(const status of ['INTERNAL_REVIEW','CLIENT_REVIEW','AGREED'])await post('agreement-status',{id:a.id,expectedVersion:1,status,note:'LOCAL MOCK 연속 리허설 합의',proof:documented()});
 for(const category of ['OFFICIAL_INFO','PUBLIC_PAGE_ANALYSIS','WEBSITE_MODIFICATION'])await post('consent',{id:a.id,category,decision:'GRANTED',scope:'LOCAL MOCK 해당 정보 검토',purpose:'LOCAL MOCK 리허설',from:'2026-10-01',to:'2026-12-31',source:'CLIENT_CONFIDENTIAL',proof:documented()});
 await post('agreement-status',{id:a.id,expectedVersion:1,status:'ACTIVE',actualDate:'2026-10-01',note:'LOCAL MOCK 실제 고객 아님'});
 await show('30일 무료 실증 계약',a.id);await expect(page.getByLabel('Pilot 선택').locator('option:checked')).toContainText('ACTIVE');await expect(page.getByRole('link',{name:'LOCAL-MOCK-agreement.png'})).toBeVisible();
 await post('plan',{id:a.id,screens:[{screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK'}],country:'대한민국',region:p.operations.onboarding.region,baselineAt:'2026-10-01',followupAt:'2026-10-10'});a=(await state()).repository.agreements[0];const plan=a.plans[0];await post('snapshot',{id:a.id,planId:plan.id,phase:'BASELINE',source:'PRESCAN'});
 await show('Pilot 측정 연결',a.id);await expect(page.getByText(/^BASELINE · PRESCAN · 검증 1/)).toBeVisible();
 // Synthetic audit is local fixture data, not an external website inspection.
 const {prisma,loadDb,saveProject}=await import('../../src/lib/db');
 await prisma.$transaction(async tx=>{const current=(await loadDb(tx)).projects.find(p=>p.id===projectId)!;const sample=seed().projects[0],audit={...sample.audits[0],id:randomUUID(),kind:'LIVE' as const},task={...sample.tasks[0],id:randomUUID(),auditId:audit.id};delete task.execution;delete task.studio;current.audits.push(audit);current.tasks.push(task);await saveProject(tx,current);});
 const task=(await state()).project.tasks.at(-1),proposal=await op('proposal',{proposal:{taskId:task.id,draftType:'HOME',type:'CONTENT_AEO',target:'LOCAL MOCK 홈페이지 (외부 게시 없음)'}});
 await op('proposal-edit',{proposal:{id:proposal.proposalId,expectedVersion:1,beforeText:'LOCAL MOCK 기존 정보',proposedText:'LOCAL MOCK 공식 정보 확인 완료. 실제 병원 안내 아님.',instruction:'LOCAL MOCK 가상 변경 절차',needsEvidence:'LOCAL MOCK 내부 합성 증빙'}});
 await post('work',{id:a.id,milestoneId:a.milestones[3].id,taskId:task.id,type:'WEBSITE',title:'LOCAL MOCK 홈페이지 개선',target:'LOCAL MOCK 홈페이지',assignee:terms.owner,plannedMinutes:30,plannedExternalCost:0});const work=(await state()).repository.agreements[0].work[0];
 await show('Pilot 운영센터',a.id);await expect(page.locator('summary').filter({hasText:'LOCAL MOCK 홈페이지 개선'})).toContainText('TODO');
 await post('work-status',{id:a.id,workId:work.id,status:'DONE',assignee:terms.owner,note:'LOCAL MOCK 승인 없는 완료',proof:documented()},false);
 await op('approval',{approval:{id:proposal.proposalId,version:2,status:'APPROVED',customerReviewer:'LOCAL MOCK 고객 승인자',note:'LOCAL MOCK 승인 절차 시험',evidence:'LOCAL MOCK 합성 승인 증빙',legalReviewed:true,legalNote:'LOCAL MOCK 의료 검토 절차 시험'}});
 await post('compliance',{id:a.id,workId:work.id,version:2,externalRequired:false,externalCompleted:false,proof:documented()});
 await op('execution',{task:{taskId:task.id,status:'DONE',assignee:terms.owner,dueDate:'',beforeEvidence:'https://local-mock.example/before',afterEvidence:'https://local-mock.example/after',completionNote:'LOCAL MOCK 로컬 상태 전환만 수행; 외부 게시 없음',remeasurementResult:'LOCAL MOCK 후속 리허설 예정',note:'LOCAL MOCK 가상 적용 완료'}});
 await post('work-status',{id:a.id,workId:work.id,status:'DONE',assignee:terms.owner,note:'LOCAL MOCK 합성 완료 증빙',proof:documented()});
 await show('Pilot 운영센터',a.id);await expect(page.locator('summary').filter({hasText:'LOCAL MOCK 홈페이지 개선'})).toContainText('DONE');
 const q=set.questions.find((q:{id:string})=>q.id===terms.questionIds[0]);const save=await request.post('/api/observations',{data:{projectId,action:'save',observation:{projectId,questionId:q.id,kind:'CONSUMER_UI_MANUAL',screen:'CHATGPT_WEB_SEARCH',model:'LOCAL MOCK',actualQuestion:q.text,questionSubmittedAt:'2026-10-09T00:00:00Z',answerRecordedAt:'2026-10-09T00:01:00Z',country:'대한민국',region:p.operations.onboarding.region,searchUsage:'USED',rawText:'LOCAL MOCK 일반 안내 · 실제 AI 관측 아님',citations:[],consumerScreenConfirmed:true,observer:'LOCAL MOCK 후속 수집자',studyId:plan.studyId,phase:'FOLLOW_UP',repetition:1,evidenceIds:[],inputKey:randomUUID()}}});expect(save.ok(),await save.text()).toBe(true);
 const follow=(await state()).project.responses.find((r:{consumer?:{studyId:string;phase:string}})=>r.consumer?.studyId===plan.studyId&&r.consumer?.phase==='FOLLOW_UP');const verified=await request.post('/api/observations',{data:{projectId,action:'verification',responseId:follow.id,status:'VERIFIED',reviewer:'별도 LOCAL MOCK 검토자',note:'LOCAL MOCK 조건 대조 시험',sourceConfirmed:true}});expect(verified.ok(),await verified.text()).toBe(true);await post('snapshot',{id:a.id,planId:plan.id,phase:'FOLLOW_UP',source:'PILOT'});
 expect((await state()).repository.agreements[0].snapshots[0].data.responseIds).toHaveLength(1);expect((await state()).agreements[0].comparison.platforms[0].matchedN).toBe(1);
 await show('Pilot 측정 연결',a.id);await expect(page.getByText(/^FOLLOW_UP · PILOT · 검증 1/)).toBeVisible();
 for(const m of a.milestones)await post('milestone',{id:a.id,milestoneId:m.id,title:m.title,dayFrom:m.dayFrom,dayTo:m.dayTo,assignee:m.assignee,dueOverride:'',status:'EXCLUDED',note:'LOCAL MOCK 리허설 일정 제외',proof:documented()});
 await post('outcome',{id:a.id,actualEnd:'2026-10-10',remaining:['LOCAL MOCK 실제 관측 미실행'],nextStrategy:'LOCAL MOCK 수동 실측 승인 후 실행'});const outcome=(await state()).reports[0];await post('outcome-approval',{reportId:outcome.id,proof:documented()});await post('agreement-status',{id:a.id,expectedVersion:1,status:'COMPLETED',actualDate:'2026-10-10',note:'LOCAL MOCK 리허설 종료',proof:documented()});
 await post('proposal',{id:a.id,outcomeReportId:outcome.id,terms:{goal:'LOCAL MOCK 90일 수동 관측',monthlyPlans:['LOCAL MOCK 1개월','LOCAL MOCK 2개월','LOCAL MOCK 3개월'],questionIds:terms.questionIds,platforms:terms.platforms,competitorIds:[],websitePages:1,contentCount:0,contentScope:'LOCAL MOCK 콘텐츠 없음',providedScope:'LOCAL MOCK 수동 분석',excludedScope:'외부 자동 게시 제외',reportSchedule:'LOCAL MOCK 매월',monthlyFee:null,plannedStart:'2026-10-10',plannedEnd:'2027-01-08',paymentTerms:'실제 계약 별도 확인',approvalTerms:'담당자 별도 검수',limitations:'추천·상담·예약 증가를 보장하지 않습니다.'}});
 await post('sales-stage',{stage:'WON',note:'LOCAL MOCK 계약 없이 수주 시도'},false);expect((await state()).project.operations.sales.stage).not.toBe('WON');expect((await state()).repository.agreements[0].workLogs).toHaveLength(0);
 await show('90일 유료 제안',a.id);await expect(page.getByRole('link',{name:'유료 제안서 · 인쇄'})).toBeVisible();
 await show('Pilot 영업 활동',a.id);await expect(page.getByLabel('영업 상태 변경 영업 단계')).toHaveValue((await state()).project.operations.sales.stage);
 await page.reload();await page.getByLabel('프로젝트 선택').selectOption(projectId);await page.getByRole('button',{name:'30일 성과 보고서',exact:true}).first().click();await expect(page.getByText('v1 · APPROVED · 근거 일치',{exact:true})).toBeVisible();
 const row=await prisma.project.findUniqueOrThrow({where:{id:projectId}});expect((row.operations as {pilot:unknown}).pilot).toEqual((await state()).repository);await prisma.$disconnect();
 }finally{for(const d of docs)await removePilotDocument(d);}
}
