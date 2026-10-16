import {test,expect} from '@playwright/test';
import {randomBytes,scryptSync} from 'node:crypto';
import {prisma} from '../../src/lib/db';
test.skip(process.env.AEO_MANUAL_BROWSER!=='1','Dedicated manual synthetic harness only');
test('real login → six platforms → readiness → work → experiment → Insight, with no external requests',async({page,request,context})=>{
 if(new URL(process.env.DATABASE_URL!).pathname!=='/aeo_manual_usability_test')throw Error('REFUSE_UNSAFE_TEST_DATABASE');
 const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex'),hash=salt+':'+scryptSync(password,salt,64).toString('hex');
 await prisma.staffUser.updateMany({where:{namespace:'manual-usability',username:'manual-owner'},data:{passwordHash:hash}});
 const external:string[]=[];await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost'){external.push(u.origin);return route.abort();}return route.continue();});
 const login=await request.post('/api/auth',{data:{action:'login',username:'manual-owner',password}});expect(login.ok()).toBe(true);await context.addCookies((await request.storageState()).cookies);
 const catalog=await(await request.get('/api/platform-intelligence/catalog')).json();expect(catalog.projectOptions.length).toBeGreaterThan(0);const p=catalog.projectOptions.find((p:{label:string})=>p.label==='[TEST] 새봄치과 수원점');expect(p).toBeTruthy();
 await page.setViewportSize({width:390,height:844});await page.goto('/os?view=platform-intelligence&projectId='+p.projectId);await expect(page.getByText('테스트 환경 · 가상 데이터',{exact:false})).toBeVisible();await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(6);
 const scenario=process.env.AEO_MANUAL_BROWSER_SCENARIO||'all';
 for(const code of ['CHATGPT','GOOGLE_AI','GEMINI','NAVER_AI','CLAUDE','PERPLEXITY']){
  const data=await(await request.get('/api/platform-intelligence/projects/'+p.projectId+'/platforms/'+code)).json();
  if(scenario==='initial'){expect(data.readiness.score).toBeNull();expect(data.readiness.status).toBe(['GEMINI','NAVER_AI'].includes(code)?'NOT_CONFIGURED':'PARTIAL');}
  await page.getByTestId('platform-card-'+code).getByRole('button').click();const root=page.getByTestId('platform-operations');await expect(root.getByText('TEST INSTALLATION OF VERIFIED PACK',{exact:false})).toBeVisible();
  if(['negative','zero','insufficient'].includes(scenario)&&code==='CHATGPT'){const result=data.experiments[0].results[0];if(scenario==='negative'){expect(result.displayDelta).toBe(-10);await expect(root).toContainText('Observed Delta: -10%p');await expect(root).toContainText('Before 값: 20.0% · After 값: 10.0%');}else if(scenario==='zero'){expect(result.displayDelta).toBe(0);await expect(root).toContainText('Observed Delta: 0%p');}else{expect(result.displayDelta).toBeNull();await expect(root).toContainText('비교 불가');}}
  if(scenario==='all'){
   if(code==='CHATGPT'){expect(data.readinessItems[0].status).toBe('FAIL');await expect(root.getByRole('button',{name:'업무 준비',exact:true})).toBeEnabled();const tasks=await prisma.optimizationTask.count();await root.getByRole('button',{name:'업무 준비',exact:true}).click();await expect(root.getByRole('status')).toContainText('Task는 생성되지 않았습니다.');expect(await prisma.optimizationTask.count()).toBe(tasks);expect(data.linkedWork[0].sourceState).toBe('CURRENT');await expect(root).toContainText('Before 값: 10.0% · After 값: 23.3%');await expect(root).toContainText('+13.3%p');}
   if(code==='GOOGLE_AI')expect(data.readinessItems.map((i:{status:string})=>i.status)).toEqual(['PASS','FAIL','PASS']);
   if(code==='CLAUDE')expect(data.readinessItems[0].status).toBe('UNKNOWN');
   if(code==='PERPLEXITY')expect(data.readinessItems[0].status).toBe('PASS');
  }
  if(['GEMINI','NAVER_AI'].includes(code)){expect(data.readiness.status).toBe('NOT_CONFIGURED');expect(data.officialFacts).toHaveLength(2);await expect(root).toContainText('공식 확인 정보는 있으나');}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'전체 플랫폼으로'}).click();await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(6);
 }
 await page.screenshot({path:'../manual-overview-mobile.png',fullPage:true});
 await page.goto('/os?view=platform-insights');if(scenario==='all'){await expect(page.getByRole('heading',{name:'Observed Volume · 관측량'})).toBeVisible();await expect(page.getByText('음수 1',{exact:true})).toBeVisible();await expect(page.getByText('변화 없음 1',{exact:true})).toBeVisible();}else await expect(page.getByText('아직 집계 가능한 운영 실험 데이터가 없습니다.')).toBeVisible();expect(external).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/?view=platform-intelligence&projectId='+p.projectId);await expect(page.getByText('테스트 환경 · 가상 데이터',{exact:false})).toBeVisible();await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(6);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await prisma.$disconnect();
});
