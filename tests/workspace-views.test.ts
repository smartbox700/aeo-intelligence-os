import {it,expect} from 'vitest';
import {pilotViewForTab} from '../src/lib/workspace-views';
it('기존 Pilot 탭 28~34와 view 0~6의 대응을 유지한다',()=>{for(let tab=28;tab<=34;tab++)expect(pilotViewForTab(tab)).toBe(tab-28);});
it('CITED, 스튜디오, 기존 비Pilot 탭 및 미래 탭은 PilotPanel을 선택하지 않는다',()=>{for(const tab of [...Array.from({length:28},(_,i)=>i),35,36,1000,-1,NaN,Infinity,28.5])expect(pilotViewForTab(tab)).toBeUndefined();});
