import {test,expect} from './fixtures';
import {request as api} from '@playwright/test';
test('Platform Intelligence HTTP routes require login and remain disabled in the default deployment',async({request})=>{
 const anonymous=await api.newContext({baseURL:'http://127.0.0.1:3100'});try{const r=await anonymous.get('/api/platform-intelligence/catalog');expect(r.status()).toBe(401);expect(await r.json()).toMatchObject({error:{code:'UNAUTHENTICATED'}});}finally{await anonymous.dispose();}
 const r=await request.get('/api/platform-intelligence/catalog');expect(r.status()).toBe(503);expect(await r.json()).toEqual({error:{code:'FEATURE_DISABLED',message:'FEATURE_DISABLED'}});expect(r.headers()['cache-control']).toContain('no-store');
 const store=await (await request.get('/api/workspace')).json(),overview=await request.get('/api/platform-intelligence/projects/'+store.projects[0].id+'/overview');expect(overview.status()).toBe(503);expect(await overview.text()).not.toMatch(/rawText|DATABASE_URL|password|stack|PrismaClient|127\.0\.0\.1:5432/);
});
