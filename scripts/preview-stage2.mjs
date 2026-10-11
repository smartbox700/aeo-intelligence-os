import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:3000');await page.getByText('최근 측정 응답',{exact:true}).waitFor();await page.getByRole('button',{name:'AI 실측 연구소',exact:true}).first().click();await page.getByText('웹 검색 기반 측정 실행',{exact:true}).waitFor();
await page.screenshot({path:'test-results/lab-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/lab-mobile.png',fullPage:true});console.log(JSON.stringify({pageErrors:errors}));await browser.close();
