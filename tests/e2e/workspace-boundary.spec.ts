import {test,expect} from './fixtures';
test('CITED와 실행 스튜디오는 PilotPanel을 함께 mount하지 않는다',async({page,request})=>{
 const store=await (await request.get('/api/workspace')).json();const id=store.projects[0].id;let pilotRequests=0;
 page.on('request',r=>{if(new URL(r.url()).pathname==='/api/pilot')pilotRequests++;});
 await page.goto('/os?view=cited&projectId='+encodeURIComponent(id));await expect(page.getByRole('heading',{name:'CITED 고객 진단'})).toBeVisible();await page.waitForLoadState('networkidle');expect(pilotRequests).toBe(0);
 await page.goto('/os?view=execution-studio&projectId='+encodeURIComponent(id));await page.waitForLoadState('networkidle');expect(pilotRequests).toBe(0);
 await page.getByRole('button',{name:'30일 무료 실증 계약',exact:true}).first().click();await expect.poll(()=>pilotRequests).toBeGreaterThan(0);
});
