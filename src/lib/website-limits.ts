/** Shared across both website routes in this local single-process deployment. */
const root=globalThis as unknown as {aeoWebsiteLimits?:{running:Set<string>;last:Map<string,number>}};
const limits=root.aeoWebsiteLimits??={running:new Set(),last:new Map()};
export function reserveWebsiteInspection(projectId:string,lastPersistedAt?:string){
 if(limits.running.size)throw new Error('공개 홈페이지 검사가 실행 중입니다. 완료 후 다시 시도하세요.');
 const last=Math.max(limits.last.get(projectId)??0,lastPersistedAt?Date.parse(lastPersistedAt)||0:0);
 if(Date.now()-last<60000)throw new Error('공개 홈페이지 검사는 프로젝트당 1분 간격입니다.');
 limits.running.add(projectId);limits.last.set(projectId,Date.now());return ()=>limits.running.delete(projectId);
}
