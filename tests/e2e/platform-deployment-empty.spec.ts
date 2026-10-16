import {test,expect} from './fixtures';
test.skip(process.env.AEO_PI_UI_SCENARIO!=='EMPTY','Isolated deployment gate only');
test('Pack 0: six null-score cards and details remain usable at 390px',async({page,request})=>{
 const store=await(await request.get('/api/workspace')).json(),id=store.projects[0].id;
 const response=await request.get('/api/platform-intelligence/projects/'+id+'/overview');expect(response.ok()).toBe(true);
 const overview=await response.json();expect(overview.platforms).toHaveLength(6);
 for(const p of overview.platforms)expect(p.readiness).toMatchObject({status:'NOT_CONFIGURED',score:null});
 await page.setViewportSize({width:390,height:844});await page.goto('/os?view=platform-intelligence&projectId='+id);
 await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(6);
 for(const code of ['CHATGPT','GOOGLE_AI','GEMINI','NAVER_AI','CLAUDE','PERPLEXITY']){
  const card=page.getByTestId('platform-card-'+code);await expect(card).toContainText('NOT_CONFIGURED');await expect(card).toContainText('평가 보류');
  await card.getByRole('button').click();const root=page.getByTestId('platform-operations');await expect(root.getByRole('heading',{name:'준비도 점검',exact:true})).toBeVisible();
  expect(await root.innerText()).not.toMatch(/rawText|passwordHash|sessionToken|SYNTHETIC|추천확률|공식점수|0점/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'전체 플랫폼으로'}).click();await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(6);
 }
 await page.screenshot({path:'output/pi812-empty-mobile.png',fullPage:true});
 await page.goto('/os?view=platform-insights&projectId='+id);await expect(page.getByText('아직 집계 가능한 운영 실험 데이터가 없습니다.')).toBeVisible();
});
