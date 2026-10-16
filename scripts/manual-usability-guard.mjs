export const MANUAL_DATABASE='aeo_manual_usability_test';
export function assertManualTarget(env){
 let u;try{u=new URL(env.DATABASE_URL);}catch{throw Error('REFUSE_UNSAFE_TEST_DATABASE');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.pathname.slice(1))!==MANUAL_DATABASE||!['127.0.0.1','localhost','::1'].includes(u.hostname)||env.STORAGE_MODE!=='postgres'||env.NODE_ENV!=='development'||env.PI_MANUAL_USABILITY_TEST!=='true')throw Error('REFUSE_UNSAFE_TEST_DATABASE');
 return {database:MANUAL_DATABASE,hostCategory:'LOOPBACK',storageMode:'postgres',nodeEnvironment:'development'};
}
