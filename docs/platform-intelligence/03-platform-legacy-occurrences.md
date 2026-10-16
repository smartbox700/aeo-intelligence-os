# Legacy literal 출현 위치

정적 src 조사, generated 제외. literal 지원과 실제 관측은 별개다. 신규 Registry 구현이 아니다.

| 파일 | 행 | 발견 literal |
|---|---|
| `src/app/api/free-gemini/route.ts` | 7 | Gemini |
| `src/app/api/free-gemini/route.ts` | 13 | Gemini |
| `src/app/api/free-gemini/route.ts` | 14 | Gemini |
| `src/app/api/measurements/route.ts` | 11 | 네이버 AI 검색, Gemini, OpenAI |
| `src/app/api/observations/route.ts` | 8 | Gemini |
| `src/app/api/observations/route.ts` | 13 | Gemini |
| `src/components/cited-diagnosis.tsx` | 8 | ChatGPT |
| `src/components/cited-landing.tsx` | 4 | ChatGPT, Gemini |
| `src/components/consumer-lab.tsx` | 15 | CHATGPT_WEB_SEARCH |
| `src/components/consumer-lab.tsx` | 19 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/components/consumer-lab.tsx` | 47 | Gemini |
| `src/components/measurement-lab.tsx` | 19 | 네이버 AI 검색, ChatGPT, Gemini, OpenAI |
| `src/components/optimization-panel.tsx` | 34 | ChatGPT |
| `src/components/optimization-panel.tsx` | 36 | 네이버 AI 검색, ChatGPT, Gemini, OpenAI |
| `src/components/pilot-panel.tsx` | 14 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/components/sales-report-panel.tsx` | 9 | CHATGPT_WEB_SEARCH |
| `src/components/workspace.tsx` | 39 | 네이버 AI 검색, 네이버 AI 브리핑, ChatGPT, Gemini, OpenAI |
| `src/components/workspace.tsx` | 42 | OpenAI |
| `src/components/workspace.tsx` | 52 | Gemini API Grounding, 네이버 AI 검색, 네이버 AI 브리핑, ChatGPT, Gemini, OpenAI |
| `src/components/workspace.tsx` | 59 | 네이버 AI 검색, ChatGPT, Gemini |
| `src/lib/audit.ts` | 15 | OpenAI |
| `src/lib/audit.ts` | 19 | OpenAI |
| `src/lib/audit.ts` | 20 | OpenAI |
| `src/lib/audit.ts` | 22 | OpenAI |
| `src/lib/audit.ts` | 25 | Gemini |
| `src/lib/audit.ts` | 26 | Gemini |
| `src/lib/audit.ts` | 27 | Gemini |
| `src/lib/audit.ts` | 28 | gemini-2.5-flash |
| `src/lib/audit.ts` | 29 | Gemini |
| `src/lib/audit.ts` | 91 | OAI-SearchBot, GPTBot, Googlebot |
| `src/lib/cited-diagnosis.ts` | 3 | Google AI, ChatGPT, Gemini, Claude, Perplexity |
| `src/lib/consumer-config.ts` | 2 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING, 네이버 AI 브리핑, ChatGPT, Gemini |
| `src/lib/consumer-observation.ts` | 10 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/gemini-provider.ts` | 2 | Gemini |
| `src/lib/gemini-provider.ts` | 3 | Gemini |
| `src/lib/gemini-provider.ts` | 7 | Gemini |
| `src/lib/gemini-provider.ts` | 8 | Gemini, gemini-2.5-flash |
| `src/lib/gemini-provider.ts` | 11 | Gemini |
| `src/lib/gemini-provider.ts` | 13 | Gemini |
| `src/lib/gemini-provider.ts` | 15 | Gemini |
| `src/lib/gemini-provider.ts` | 16 | Gemini API Grounding, Gemini |
| `src/lib/gemini-provider.ts` | 17 | Gemini |
| `src/lib/gemini-provider.ts` | 19 | Gemini, gemini-2.5-flash |
| `src/lib/gemini-provider.ts` | 22 | Gemini |
| `src/lib/gemini-provider.ts` | 23 | Gemini |
| `src/lib/measurement-service.ts` | 5 | OpenAI |
| `src/lib/measurement-service.ts` | 10 | OpenAI |
| `src/lib/measurement-service.ts` | 15 | OpenAI |
| `src/lib/openai-provider.ts` | 2 | OpenAI |
| `src/lib/openai-provider.ts` | 7 | gpt-5.6-luna |
| `src/lib/openai-provider.ts` | 14 | OpenAI |
| `src/lib/openai-provider.ts` | 18 | OpenAI |
| `src/lib/openai-provider.ts` | 32 | OpenAI |
| `src/lib/openai-provider.ts` | 33 | OpenAI |
| `src/lib/openai-provider.ts` | 34 | OpenAI |
| `src/lib/openai-provider.ts` | 35 | OpenAI |
| `src/lib/openai-provider.ts` | 44 | OpenAI |
| `src/lib/openai-provider.ts` | 45 | OpenAI |
| `src/lib/operations.ts` | 19 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/operations.ts` | 22 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/pilot-common.ts` | 8 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/prescan.ts` | 52 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/providers.ts` | 5 | 네이버 AI 검색, ChatGPT, Gemini |
| `src/lib/research.ts` | 8 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/sales-report.ts` | 21 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/seed.ts` | 9 | 네이버 AI 검색, ChatGPT, Gemini |
| `src/lib/types.ts` | 4 | Gemini |
| `src/lib/types.ts` | 48 | CHATGPT_WEB_SEARCH, GEMINI_CONSUMER_SEARCH, NAVER_AI_BRIEFING |
| `src/lib/types.ts` | 54 | Gemini |
| `src/lib/validation.ts` | 4 | 네이버 AI 검색, ChatGPT, Gemini |
