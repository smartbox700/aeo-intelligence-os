import type {Provider} from './types';

const providers:readonly Provider[] = Object.freeze([
  {code:'OPENAI',displayName:'OpenAI'}, {code:'GOOGLE',displayName:'Google'},
  {code:'NAVER',displayName:'Naver'}, {code:'ANTHROPIC',displayName:'Anthropic'},
  {code:'PERPLEXITY',displayName:'Perplexity'},
].map(value=>Object.freeze(value as Provider)));
export const getProviders = ():readonly Provider[] => providers;
export const getProvider = (code:string):Provider|undefined => providers.find(value=>value.code===code);
