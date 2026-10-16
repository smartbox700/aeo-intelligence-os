import {test,expect} from './fixtures';
test('기본 flags off에서는 기존 Workspace 메뉴를 유지하고 PI 직접 진입은 안전한 안내만 표시한다',async({page})=>{
 const calls:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/platform-intelligence/'))calls.push(r.url());});
 await page.goto('/os');await expect(page.getByRole('heading',{name:'대시보드',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'AI 플랫폼 진단',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'학습 인사이트',exact:true})).toHaveCount(0);
 await page.goto('/os?view=platform-intelligence');await expect(page.getByTestId('platform-operations').getByRole('alert')).toContainText('기능이 비활성 상태입니다.');await expect(page.locator('[data-testid^="platform-card-"]')).toHaveCount(0);expect(calls).toEqual([]);
});
