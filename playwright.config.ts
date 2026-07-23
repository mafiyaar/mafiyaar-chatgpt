import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:90_000,fullyParallel:false,retries:0,reporter:[['line']],
  use:{baseURL:'http://127.0.0.1:8787',viewport:{width:390,height:844},trace:'retain-on-failure',video:'off',screenshot:'only-on-failure',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{ }},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:8787/health',reuseExistingServer:true,timeout:120_000},
  outputDir:'.playwright-results'
});
