import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {assertManualTarget} from '../scripts/manual-usability-guard.mjs';
const valid={DATABASE_URL:'postgresql://placeholder:placeholder@127.0.0.1/aeo_manual_usability_test',STORAGE_MODE:'postgres',NODE_ENV:'development',PI_MANUAL_USABILITY_TEST:'true'};
it('permits only the exact local synthetic database and refuses production, remote, file, and missing opt-in',()=>{
 expect(assertManualTarget(valid).database).toBe('aeo_manual_usability_test');
 for(const changed of [{NODE_ENV:'production'},{NODE_ENV:'test'},{STORAGE_MODE:'file'},{PI_MANUAL_USABILITY_TEST:'false'},{DATABASE_URL:valid.DATABASE_URL.replace('/aeo_manual_usability_test','/aeo')},{DATABASE_URL:valid.DATABASE_URL.replace('127.0.0.1','db.example.invalid')},{DATABASE_URL:valid.DATABASE_URL+'_copy'},{DATABASE_URL:valid.DATABASE_URL.replace('postgresql:','http:')}])expect(()=>assertManualTarget({...valid,...changed})).toThrow('REFUSE_UNSAFE_TEST_DATABASE');
});
it('denies outbound fetch, DNS, and direct sockets before external network access',()=>{
 const code=`const net=require('node:net'),dns=require('node:dns');(async()=>{let n=0;try{await fetch('https://example.invalid')}catch(e){if(e.message==='MANUAL_TEST_EXTERNAL_NETWORK_DENIED')n++;}try{dns.lookup('example.invalid',()=>{})}catch(e){if(e.message==='MANUAL_TEST_EXTERNAL_NETWORK_DENIED')n++;}try{net.connect({host:'203.0.113.1',port:443})}catch(e){if(e.message==='MANUAL_TEST_EXTERNAL_NETWORK_DENIED')n++;}if(n!==3)process.exit(2);console.log('three outbound transports denied');})();`;
 expect(execFileSync(process.execPath,['--require',path.resolve('scripts/manual-usability-network.cjs'),'-e',code],{encoding:'utf8'})).toContain('three outbound transports denied');
});
