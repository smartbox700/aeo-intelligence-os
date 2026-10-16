import type {DataKind} from '../types';

export type PlatformCode = 'CHATGPT' | 'GOOGLE_AI' | 'GEMINI' | 'NAVER_AI' | 'CLAUDE' | 'PERPLEXITY';
export type ProviderCode = 'OPENAI' | 'GOOGLE' | 'NAVER' | 'ANTHROPIC' | 'PERPLEXITY';
export type PlatformChannelCode = 'CHATGPT_WEB_SEARCH' | 'GOOGLE_AI_SEARCH' | 'GEMINI_CONSUMER_SEARCH' | 'GEMINI_API_GROUNDING' | 'NAVER_AI_BRIEFING' | 'CLAUDE_WEB_SEARCH' | 'PERPLEXITY_SEARCH';
export type RegistryStatus = 'ACTIVE' | 'LIMITED' | 'PLANNED' | 'UNKNOWN' | 'RETIRED';
export type ResolutionConfidence = 'EXACT' | 'HIGH' | 'LOW' | 'UNRESOLVED';
export type ResolutionSource = 'CHANNEL' | 'CONSUMER_SCREEN' | 'PLATFORM_NAME' | 'LEGACY_PROVIDER' | 'LEGACY_ALIAS' | 'NONE' | 'CONFLICT';
export type Platform = Readonly<{code:PlatformCode;displayName:string;vendor:string;status:RegistryStatus;description:string;registryVersion:string;providerCode:ProviderCode}>;
export type PlatformChannel = Readonly<{code:PlatformChannelCode;platformCode:PlatformCode;displayName:string;mode:'CONSUMER' | 'API';status:RegistryStatus;manualSupported:boolean;apiAdapterImplemented:boolean;apiEnabled:boolean;verifiedAt:string|null;notes:string}>;
export type Provider = Readonly<{code:ProviderCode;displayName:string}>;
export type CanonicalPlatformContext = Readonly<{
  platformCode:PlatformCode|null;channelCode:PlatformChannelCode|null;providerCode:ProviderCode|null;
  observationMethod:DataKind|null;resolutionConfidence:ResolutionConfidence;resolutionSource:ResolutionSource;
  registryVersion:string;issues:readonly string[];
}>;
export type IdentityInput = Readonly<{provider?:string|null;consumerScreen?:string|null;platformName?:string|null;channel?:string|null;method?:DataKind|null}>;
