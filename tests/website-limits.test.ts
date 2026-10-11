import {it,expect} from 'vitest';
import {reserveWebsiteInspection} from '../src/lib/website-limits';
it('진단·경쟁사 분석이 공유하는 동시 실행 제한과 재시작 후 영속 진단 간격',()=>{
 const id=crypto.randomUUID();const release=reserveWebsiteInspection(id);try{expect(()=>reserveWebsiteInspection(crypto.randomUUID())).toThrow('실행 중');}finally{release();}
 expect(()=>reserveWebsiteInspection(id)).toThrow('1분');expect(()=>reserveWebsiteInspection(crypto.randomUUID(),new Date().toISOString())).toThrow('1분');const next=reserveWebsiteInspection(crypto.randomUUID(),new Date(Date.now()-61000).toISOString());next();
});
