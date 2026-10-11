import {test as base,expect} from '@playwright/test';
export const test=base.extend<{staffAuth:void}>({staffAuth:[async({request,context},use)=>{
 const credentials={username:'demo-owner',password:'DEMO-owner-password-for-tests',name:'DEMO 테스트 OWNER'};
 const setup=await request.post('/api/auth',{data:{action:'setup',...credentials}});if(!setup.ok()&&setup.status()!==400)throw new Error('테스트 인증 초기화 오류 '+await setup.text());
 const login=await request.post('/api/auth',{data:{action:'login',...credentials}});expect(login.ok()).toBe(true);await context.addCookies((await request.storageState()).cookies);await use();
 },{auto:true}]});
export {expect};
