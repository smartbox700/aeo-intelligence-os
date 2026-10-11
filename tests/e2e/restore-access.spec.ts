import {test,expect} from './fixtures';
import {request as api} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {writeFile,mkdir,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {dataRoot} from '../../src/lib/file-storage';
import {removePilotDocument} from '../../src/lib/pilot-documents';
test('7-5: 암호화 복원 뒤 실제 첨부 다운로드·담당 고객/역할/계약 문서 접근',async({request})=>{
 test.setTimeout(120000);if(!process.env.AEO_FILES_ROOT||!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_'))throw new Error('Restore rehearsal requires an isolated DB and files root');let projectId='';const documents:{storageName:string}[]=[];
 const brandFile=path.join(dataRoot(),'sales-brand.json'),priorBrand=await readFile(brandFile).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 try{
 const made=await request.post('/api/operations',{data:{action:'create',client:{name:'LOCAL MOCK 복원 권한 '+randomUUID().slice(0,8),aliases:[],website:'https://local-mock.example/',industry:'치과',address:'서울 홍제역',bookingUrl:'',services:'',experts:'',competitors:[]},onboarding:{kind:'CLIENT',profile:'MEDICAL',brandName:'LOCAL MOCK 복원 권한',contactName:'',contactChannel:'',region:'서울 홍제역',businessGoal:'LOCAL MOCK 격리 복원',objectives:[],accountOwner:'LOCAL MOCK',facts:{}}}});expect(made.ok(),await made.text()).toBe(true);projectId=(await made.json()).projectId;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6XkAAAAASUVORK5CYII=','base64');const ids:Record<string,string>={};
 for(const kind of ['APPROVAL','CONTRACT']){const s=await (await request.get('/api/pilot?projectId='+projectId)).json();const u=await request.post('/api/pilot/documents',{multipart:{projectId,expectedRevision:String(s.repository.revision),kind,sensitiveDataExcluded:'true',file:{name:'LOCAL-MOCK-'+kind+'.png',mimeType:'image/png',buffer:png}}});expect(u.ok(),await u.text()).toBe(true);ids[kind]=(await u.json()).id;documents.push((await (await request.get('/api/pilot?projectId='+projectId)).json()).repository.documents.find((d:{id:string})=>d.id===ids[kind]));}
 const evidence=await request.post('/api/evidence',{multipart:{projectId,file:{name:'LOCAL-MOCK-observation.png',mimeType:'image/png',buffer:png}}});expect(evidence.ok(),await evidence.text()).toBe(true);const evidenceFile=(await evidence.json()).evidence;
 const names={assigned:'restore-assigned-'+randomUUID().slice(0,8),foreign:'restore-foreign-'+randomUUID().slice(0,8),analyst:'restore-analyst-'+randomUUID().slice(0,8)},password='LOCAL-MOCK-restore-test-password';
 for(const [key,username] of Object.entries(names)){const role=key==='analyst'?'ANALYST':'MANAGER';const u=await request.post('/api/auth',{data:{action:'user',user:{username,name:'LOCAL MOCK 복원 '+key,role,projectIds:key==='foreign'?[]:[projectId],password}}});expect(u.ok(),await u.text()).toBe(true);}
 const brand=await request.post('/api/sales-reports',{data:{projectId,action:'brand',input:{company:'LOCAL MOCK 복원 회사',contact:''}}});expect(brand.ok(),await brand.text()).toBe(true);
 const {prisma}=await import('../../src/lib/db');const owner=await prisma.staffUser.findFirstOrThrow({where:{username:'demo-owner',namespace:{startsWith:'e2e-'}}});
 const {backup:b,restored}=await new Promise<{backup:{file:string};restored:{ok:boolean;database:string;filesRoot:string}}>((resolve,reject)=>{const c=spawn(process.execPath,['scripts/backup-for-test.mjs'],{windowsHide:true,env:process.env});let output='';c.stdout.on('data',chunk=>output+=chunk);c.stderr.on('data',()=>{});c.on('error',reject);c.on('close',code=>{try{if(code!==0)throw new Error('Isolated backup child failed');resolve(JSON.parse(output));}catch(e){reject(e);}});});expect(restored.ok).toBe(true);
 const url=new URL(process.env.DATABASE_URL!);url.pathname='/'+restored.database;
 const listener=createServer();await new Promise<void>(resolve=>listener.listen(0,'127.0.0.1',resolve));const address=listener.address();if(!address||typeof address==='string')throw new Error('Isolated port unavailable');const port=address.port;await new Promise<void>(resolve=>listener.close(()=>resolve()));
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,env:{...process.env,DATABASE_URL:url.href,AEO_FILES_ROOT:restored.filesRoot,AEO_AUTH_NAMESPACE:owner.namespace,LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});const closed=new Promise(resolve=>child.once('exit',resolve));
 const baseURL='http://127.0.0.1:'+port,ownerRequest=await api.newContext({baseURL,storageState:await request.storageState()});
 try{
 await expect.poll(async()=>{try{return (await ownerRequest.get('/login',{timeout:1000})).status();}catch{return 0;}},{timeout:30000}).toBe(200);
 const doc=await ownerRequest.get('/api/pilot/documents?projectId='+projectId+'&id='+ids.APPROVAL);expect(doc.ok(),await doc.text()).toBe(true);expect(await doc.body()).toEqual(png);expect(await (await ownerRequest.get('/api/evidence?projectId='+projectId+'&id='+evidenceFile.id)).body()).toEqual(png);expect((await (await ownerRequest.get('/api/sales-reports?projectId='+projectId)).json()).brand.company).toBe('LOCAL MOCK 복원 회사');
 const anonymous=await api.newContext({baseURL});try{expect((await anonymous.get('/api/pilot/documents?projectId='+projectId+'&id='+ids.APPROVAL)).status()).toBe(401);}finally{await anonymous.dispose();}
 for(const [key,username] of Object.entries(names)){const limited=await api.newContext({baseURL});try{expect((await limited.post('/api/auth',{data:{action:'login',username,password}})).ok()).toBe(true);expect((await limited.get('/api/pilot/documents?projectId='+projectId+'&id='+ids.APPROVAL)).status()).toBe(key==='assigned'?200:403);expect((await limited.get('/api/pilot/documents?projectId='+projectId+'&id='+ids.CONTRACT)).status()).toBe(403);expect((await limited.get('/api/evidence?projectId='+projectId+'&id='+evidenceFile.id)).status()).toBe(key==='foreign'?403:200);}finally{await limited.dispose();}}
 await mkdir('output',{recursive:true});await writeFile('output/restore-access.json',JSON.stringify({kind:'LOCAL MOCK',backupFile:b.file,restored,ownerBytesMatch:true,assignedManagerAllowed:true,unassignedManagerBlocked:true,analystPilotDocumentBlocked:true,managerContractBlocked:true,anonymousBlocked:true,externalAiCalls:0},null,2));
 }finally{await ownerRequest.dispose();child.kill();await closed;}
 const {removeUnattachedEvidence}=await import('../../src/lib/evidence');await removeUnattachedEvidence(evidenceFile);await prisma.$disconnect();
 }finally{if(projectId)await request.post('/api/workspace',{data:{action:'delete',projectId}});for(const d of documents)await removePilotDocument(d);if(priorBrand)await writeFile(brandFile,priorBrand);else await unlink(brandFile).catch(e=>{if(e.code!=='ENOENT')throw e;});}
});
