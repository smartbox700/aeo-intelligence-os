import {test,expect} from '@playwright/test';
test('공개 랜딩, 무관측 리포트, 실제 수동 관측과 OS 접근 보호',async({page,request})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'AI의 답변 속에, 우리 브랜드는 어디에 있을까요?'})).toBeVisible();
 expect((await request.get('/api/workspace')).status()).toBe(401);
 await page.goto('/os');await expect(page).toHaveURL(/\/login$/);
 await page.goto('/report');await expect(page.getByText('현재 탭에 저장된 진단이 없습니다.',{exact:false})).toBeVisible();
 await page.goto('/diagnosis');await page.getByLabel('브랜드명',{exact:true}).fill('브라우저 테스트 브랜드');await page.getByLabel('지역',{exact:true}).fill('서초구');await page.getByLabel('서비스·분야',{exact:true}).fill('형사 상담');await page.getByRole('button',{name:'질문 생성',exact:true}).click();
 await page.getByRole('link',{name:'리포트 보기'}).click();await expect(page.getByText('확정된 관측이 없습니다.',{exact:false})).toBeVisible();
 await page.getByRole('link',{name:'관측 이어하기'}).click();await page.getByRole('button',{name:'3 / 추천',exact:false}).click();
 await page.getByRole('button',{name:'이 응답 관측 확정'}).click();await expect(page.getByRole('alert').filter({hasText:'관측에는'})).toContainText('원문');
 await page.getByLabel('모델·모드 및 조건').fill('화면 미표시 / 검색 ON / 서울');await page.getByLabel('관측 시각').fill('2026-10-11T12:30');await page.getByLabel('응답 원문').fill('이 답변에는 브랜드가 등장하지 않습니다.');await page.getByRole('button',{name:'이 응답 관측 확정'}).click();
 await page.reload();await expect(page.getByText('관측 완료 1 / 50',{exact:false})).toBeVisible();await page.getByRole('link',{name:'리포트 보기'}).click();const chat=page.getByRole('row').filter({hasText:'ChatGPT'});await expect(chat).toContainText('1 / 10');await expect(chat).toContainText('0%');await expect(page.getByRole('row').filter({hasText:'Gemini'})).toContainText('미측정');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'JSON 다운로드'}).click();expect((await downloadPromise).suggestedFilename()).toBe('cited-manual-diagnosis.json');
 await page.goto('/blog/aeo-marketing-1');await expect(page.getByRole('heading',{name:'AEO 마케팅, 측정부터 시작하세요.'})).toBeVisible();
});
