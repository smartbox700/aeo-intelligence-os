/** Fail closed: a key alone never enables paid AI. */
export function liveAIEnabled(){return process.env.LIVE_AI_ENABLED?.trim().toLowerCase()==='true';}
export function assertLiveAIEnabled(){if(!liveAIEnabled())throw new Error('API 실측 대기: LIVE_AI_ENABLED=false. 유료 AI 호출이 차단되었습니다.');}
