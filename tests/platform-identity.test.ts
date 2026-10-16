import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {getPlatforms,getPlatform,getChannels,getPlatformChannels,getProviders,getProvider,resolveLegacyAlias,resolvePlatformIdentity,PLATFORM_REGISTRY_VERSION} from '../src/lib/platform-intelligence';

describe('platform identity registry v1',()=>{
  it('has six unique platforms, valid channel/provider references and immutable metadata',()=>{
    expect(getPlatforms().map(p=>p.code)).toEqual(['CHATGPT','GOOGLE_AI','GEMINI','NAVER_AI','CLAUDE','PERPLEXITY']);
    for(const entries of [getPlatforms(),getChannels(),getProviders()]){
      expect(new Set(entries.map(e=>e.code)).size).toBe(entries.length);
      expect(Object.isFrozen(entries)).toBe(true);
      expect(entries.every(Object.isFrozen)).toBe(true);
    }
    for(const platform of getPlatforms()){
      expect(platform.registryVersion).toBe(PLATFORM_REGISTRY_VERSION);
      expect(getProvider(platform.providerCode)).toBeDefined();
    }
    for(const channel of getChannels()){
      expect(getPlatform(channel.platformCode)).toBeDefined();
      expect(getPlatformChannels(channel.platformCode)).toContain(channel);
      expect(channel.apiEnabled).toBe(false);
      if(['GOOGLE_AI','CLAUDE','PERPLEXITY'].includes(channel.platformCode))expect(channel.status).toBe('PLANNED');
    }
    expect(getPlatformChannels('GEMINI')).toHaveLength(2);
    expect(getChannels().filter(c=>c.manualSupported).map(c=>c.code)).toEqual(['CHATGPT_WEB_SEARCH','GEMINI_CONSUMER_SEARCH','NAVER_AI_BRIEFING']);
    expect(getChannels().find(c=>c.code==='GEMINI_API_GROUNDING')).toMatchObject({apiAdapterImplemented:true,apiEnabled:false,status:'LIMITED',verifiedAt:null});
    expect(getPlatform('__proto__')).toBeUndefined();expect(getProvider('unknown')).toBeUndefined();expect(getPlatformChannels('unknown')).toEqual([]);
  });
  it.each([
    ['CHATGPT_WEB_SEARCH','CHATGPT'],['GEMINI_CONSUMER_SEARCH','GEMINI'],['NAVER_AI_BRIEFING','NAVER_AI'],
  ])('resolves exact consumer screen %s without changing its method', (screen,platform)=>{
    expect(resolveLegacyAlias(screen)).toMatchObject({platformCode:platform,channelCode:screen,resolutionConfidence:'EXACT'});
    expect(resolvePlatformIdentity({consumerScreen:screen,method:'CONSUMER_UI_MANUAL'})).toMatchObject({platformCode:platform,channelCode:screen,resolutionConfidence:'EXACT',resolutionSource:'CONSUMER_SCREEN',observationMethod:'CONSUMER_UI_MANUAL'});
  });
  it.each([
    ['ChatGPT','CHATGPT'],['Gemini','GEMINI'],['네이버 AI 검색','NAVER_AI'],['네이버 AI 브리핑','NAVER_AI'],['Claude','CLAUDE'],['Perplexity','PERPLEXITY'],['Google AI','GOOGLE_AI'],
  ])('does not infer a search channel from %s', (name,platform)=>{
    expect(resolveLegacyAlias(name)).toMatchObject({platformCode:platform,channelCode:null,resolutionConfidence:'HIGH'});
    expect(resolvePlatformIdentity({platformName:name})).toMatchObject({platformCode:platform,channelCode:null});
  });
  it.each(['OpenAI','OPENAI','Google','GOOGLE','Naver','NAVER','Anthropic','ANTHROPIC','Perplexity','PERPLEXITY'])('keeps vendor-only provider input %s separate',provider=>{
    const resolved=resolvePlatformIdentity({provider,method:'API_OBSERVATION'});
    expect(resolved.platformCode).toBeNull();expect(resolved.channelCode).toBeNull();expect(resolved.providerCode).not.toBeNull();
    expect(resolved.observationMethod).toBe('API_OBSERVATION');
  });
  it('distinguishes Google, Google AI, Gemini and Gemini API Grounding',()=>{
    expect(resolveLegacyAlias('Google')).toMatchObject({platformCode:null,channelCode:null,providerCode:'GOOGLE'});
    expect(resolveLegacyAlias('OpenAI')).toMatchObject({platformCode:null,channelCode:null,providerCode:'OPENAI'});
    expect(resolvePlatformIdentity({provider:'Google',platformName:'Google AI'})).toMatchObject({platformCode:'GOOGLE_AI',channelCode:null});
    expect(resolvePlatformIdentity({provider:'Google',platformName:'Gemini'})).toMatchObject({platformCode:'GEMINI',channelCode:null});
    expect(resolvePlatformIdentity({provider:'Gemini API Grounding',method:'API_OBSERVATION'})).toMatchObject({platformCode:'GEMINI',channelCode:'GEMINI_API_GROUNDING',providerCode:'GOOGLE',observationMethod:'API_OBSERVATION'});
    expect(resolvePlatformIdentity({provider:'ChatGPT'})).toMatchObject({platformCode:'CHATGPT',channelCode:null,resolutionSource:'LEGACY_PROVIDER'});
  });
  it.each([
    {},{provider:'MOCK_TEST'},{platformName:'__proto__'},{channel:'ChatGPT'},
    {consumerScreen:'GEMINI_API_GROUNDING'},
    {consumerScreen:'CHATGPT_WEB_SEARCH',provider:'Google'},
    {consumerScreen:'CHATGPT_WEB_SEARCH',platformName:'Gemini'},
    {consumerScreen:'CHATGPT_WEB_SEARCH',channel:'GEMINI_CONSUMER_SEARCH'},
    {consumerScreen:'CHATGPT_WEB_SEARCH',method:'API_OBSERVATION' as const},
    {channel:'GEMINI_API_GROUNDING',method:'CONSUMER_UI_MANUAL' as const},
    {consumerScreen:'unknown',provider:'ChatGPT'},
  ])('fails closed for missing, unknown or contradictory evidence %#',input=>{
    expect(resolvePlatformIdentity(input)).toMatchObject({platformCode:null,channelCode:null,providerCode:null,resolutionConfidence:'UNRESOLVED'});
  });
  it('preserves complete legacy records, raw bytes and snapshot hashes for repeated projections',()=>{
    const data={provider:'ChatGPT',consumer:{screen:'CHATGPT_WEB_SEARCH'},rawText:'원문\r\n 공백 그대로 ',snapshot:{sha256:'original-hash',payload:{provider:'네이버 AI 검색',kind:'DEMO'}}};
    const original=JSON.stringify(data);const hash=()=>createHash('sha256').update(JSON.stringify(data)).digest('hex');const before=hash();
    Object.freeze(data.consumer);Object.freeze(data.snapshot.payload);Object.freeze(data.snapshot);Object.freeze(data);
    const input={provider:data.provider,consumerScreen:data.consumer.screen,method:'DEMO' as const};
    const first=resolvePlatformIdentity(input);
    for(let n=0;n<20;n++)expect(resolvePlatformIdentity(input)).toEqual(first);
    expect(first.observationMethod).toBe('DEMO');expect(first.registryVersion).toBe('platform-registry-v1');
    expect(Object.isFrozen(first)).toBe(true);expect(Object.isFrozen(first.issues)).toBe(true);
    expect(JSON.stringify(data)).toBe(original);expect(hash()).toBe(before);
    expect(resolveLegacyAlias(null).resolutionConfidence).toBe('UNRESOLVED');
    expect(resolveLegacyAlias('chatgpt').resolutionConfidence).toBe('UNRESOLVED');
  });
});
