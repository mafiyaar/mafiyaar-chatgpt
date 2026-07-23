import {defineConfig} from '@playwright/test';
const baseURL=process.env.MAFIYAAR_STAGING_URL;if(!baseURL)throw new Error('MAFIYAAR_STAGING_URL is required.');
export default defineConfig({testDir:'./tests/deployed',timeout:15*60_000,fullyParallel:false,retries:1,reporter:[['line']],use:{baseURL,viewport:{width:390,height:844},trace:'retain-on-failure',video:'off',screenshot:'only-on-failure'},outputDir:'.playwright-results-staging'});
