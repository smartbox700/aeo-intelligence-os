import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PrismaClient} from '../src/generated/prisma/index.js';
const env=await readFile('.env','utf8');process.env.DATABASE_URL??=env.split(/\r?\n/).find(s=>s.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g,'');
const db=new PrismaClient();
try{
 const before=await db.$queryRawUnsafe('SELECT "id","name" FROM "Project" ORDER BY "id"');
 const raw=await readFile('prisma/migrations/20261008_stage5/migration.sql','utf8');
 await db.$transaction(async tx=>{for(const statement of raw.split(';').filter(s=>s.trim()))await tx.$executeRawUnsafe(statement);});
 const after=await db.$queryRawUnsafe('SELECT "id","name" FROM "Project" ORDER BY "id"');
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('프로젝트 보존 확인 실패');
 await mkdir('data/backups',{recursive:true});await writeFile(path.join('data/backups','stage5-migration-check.json'),JSON.stringify({at:new Date().toISOString(),projectIds:after.map(p=>p.id),preserved:true},null,2));
 console.log('5단계 추가 마이그레이션 완료 · 기존 프로젝트 '+after.length+'개 보존 · 초기화 없음');
}finally{await db.$disconnect();}
