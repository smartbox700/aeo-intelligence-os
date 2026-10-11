import {defineConfig} from '@playwright/test';
import {randomUUID} from 'node:crypto';
export default defineConfig({testDir:'./tests/e2e',testMatch:'**/*.spec.ts',globalTeardown:'./tests/e2e/teardown.ts',workers:1,timeout:90000,use:{baseURL:'http://127.0.0.1:3100',browserName:'chromium',channel:'msedge'},webServer:{command:'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100/login',env:{AEO_AUTH_NAMESPACE:'e2e-'+randomUUID(),LIVE_AI_ENABLED:'false',FREE_GEMINI_ENABLED:'false'},reuseExistingServer:false,timeout:120000}});
