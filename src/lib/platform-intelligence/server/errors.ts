import {ZodError} from 'zod';
import {AuthError} from '../../auth';
export const statuses={UNAUTHENTICATED:401,FORBIDDEN:403,PROJECT_ACCESS_DENIED:403,FEATURE_DISABLED:503,PERSISTENCE_UNAVAILABLE:503,PERSISTENCE_SCHEMA_UNAVAILABLE:503,NOT_FOUND:404,INVALID_INPUT:400,REVISION_CONFLICT:409,SOURCE_CHANGED:409,CONSENT_UNAVAILABLE:409,NOT_CONFIGURED:409,RATE_LIMITED:429,INTERNAL_ERROR:500} as const;
export type ErrorCode=keyof typeof statuses;
export class PlatformServiceError extends Error{constructor(public readonly code:ErrorCode){super(code);}}
export function serviceError(e:unknown):PlatformServiceError{
 if(e instanceof PlatformServiceError)return e;if(e instanceof ZodError)return new PlatformServiceError('INVALID_INPUT');
 if(e instanceof AuthError)return new PlatformServiceError(e.status===401?'UNAUTHENTICATED':'FORBIDDEN');
 const message=e instanceof Error?e.message:'',code=(e as {code?:string})?.code;
 if(message==='PERSISTENCE_DISABLED')return new PlatformServiceError('FEATURE_DISABLED');
 if(message==='PERSISTENCE_UNAVAILABLE'||message==='PERSISTENCE_SCHEMA_UNAVAILABLE')return new PlatformServiceError(message);
 if(/^Platform (?:envelope|audit|payload).*?(?:integrity|head mismatch|predecessor mismatch)/i.test(message))return new PlatformServiceError('INTERNAL_ERROR');
 if(/current sources and consent required/i.test(message))return new PlatformServiceError('CONSENT_UNAVAILABLE');
 if(['P2034','P2002'].includes(code??'')||/Stale|optimistic concurrency|already exists|overwrite|Version must append|versions must append|Invalid or stale review/i.test(message))return new PlatformServiceError('REVISION_CONFLICT');
 if(/authenticated staff access denied|role denied|OWNER .*required|access denied|audit actor mismatch/i.test(message))return new PlatformServiceError('FORBIDDEN');
 if(/STALE_|source.*changed|Current eligible/i.test(message))return new PlatformServiceError('SOURCE_CHANGED');
 // Domain input rejections have a safe code; raw diagnostics never cross HTTP.
 if(/CLIENT_AUTHORITY|mismatch|missing|required|invalid|scope|checksum|reference|not supported|cannot|must|denied|exceeds|precedes|Immutable|positive|future|Forbidden/i.test(message))return new PlatformServiceError('INVALID_INPUT');
 return new PlatformServiceError('INTERNAL_ERROR');
}
