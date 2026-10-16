import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {prisma} from '../src/lib/db';
import {createSession,publicStaff} from '../src/lib/auth';
import {platformHttpHandler} from '../src/lib/platform-intelligence/server/http';
it.skipIf(process.env.AEO_PI_FAILURE_PHASE!=='1')('incomplete migration is unavailable and never becomes an operational PI store',async()=>{
 if(process.env.AEO_STAGE8_ISOLATED!=='1'||!new URL(process.env.DATABASE_URL!).pathname.startsWith('/aeo_restore_test_'))throw Error('Isolated clone required');
 try{const id=randomUUID(),user=await prisma.staffUser.create({data:{id,namespace:process.env.AEO_AUTH_NAMESPACE??'local',username:'failure-'+id,name:'Isolated test',passwordHash:'DISABLED_TEST_HASH',role:'OWNER',projectIds:[],disabled:false}}),token=await createSession(publicStaff(user));
 const r=await platformHttpHandler(new NextRequest('http://127.0.0.1:3100/api/platform-intelligence/catalog',{headers:{cookie:'aeo_session='+token}}),{params:Promise.resolve({segments:['catalog']})});
 expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toMatch(/SELECT|password|postgresql:|PlatformIntelligenceRecord|C:\\/);
 }finally{await prisma.$disconnect();}
});
