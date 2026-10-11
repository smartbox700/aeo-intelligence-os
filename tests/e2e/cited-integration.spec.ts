import {test,expect} from './fixtures';
test('진단을 고객에 저장하고 OS와 재방문 리포트에서 같은 기록을 연다',async({page,request})=>{
 const brand='CITED 연결 테스트 '+Date.now();let id='';
 try{
  await page.goto('/diagnosis');await page.getByLabel('브랜드명',{exact:true}).fill(brand);await page.getByLabel('지역',{exact:true}).fill('서초구');await page.getByLabel('서비스·분야',{exact:true}).fill('상담');await page.getByRole('button',{name:'질문 생성',exact:true}).click();
  await page.getByLabel('모델·모드 및 조건').fill('화면 미표시 / 새 대화');await page.getByLabel('관측 시각').fill('2026-10-11T12:30');await page.getByLabel('응답 원문').fill(brand+' 공식 홈페이지를 확인하세요.');await page.getByLabel('브랜드가 언급됨',{exact:true}).check();await page.getByRole('button',{name:'이 응답 관측 확정'}).click();
  await page.getByRole('button',{name:'새 고객 등록 및 진단 저장'}).click();await expect(page.getByText('고객 프로젝트에 저장했습니다.',{exact:false})).toBeVisible();id=new URL(page.url()).searchParams.get('projectId')!;expect(id).toBeTruthy();
  await page.getByRole('button',{name:'고객 프로젝트에 저장',exact:true}).click();await expect(page.getByText('고객 프로젝트에 저장했습니다.',{exact:false})).toBeVisible();
  const store=await (await request.get('/api/workspace')).json();const p=store.projects.find((p:{id:string})=>p.id===id);expect(p.questions).toHaveLength(10);expect(p.responses).toHaveLength(1);expect(p.client.citedDiagnoses).toHaveLength(1);expect(p.responses[0].kind).toBe('MANUAL_OBSERVATION');
  await page.getByRole('link',{name:'고객 OS에서 계속'}).click();await expect(page.getByRole('heading',{name:'CITED 고객 진단'})).toBeVisible();await expect(page.getByLabel('프로젝트 선택')).toHaveValue(id);
  await page.evaluate(()=>sessionStorage.clear());await page.getByRole('link',{name:'저장된 진단 리포트'}).click();await expect(page.getByRole('heading',{name:brand+' 진단 리포트'})).toBeVisible();await expect(page.getByRole('row').filter({hasText:'ChatGPT'})).toContainText('100%');
  await page.getByRole('link',{name:'관측 이어하기'}).click();await expect(page.getByText('관측 완료 1 / 50',{exact:false})).toBeVisible();
 }finally{if(id)await request.post('/api/workspace',{data:{action:'delete',projectId:id}});}
});
