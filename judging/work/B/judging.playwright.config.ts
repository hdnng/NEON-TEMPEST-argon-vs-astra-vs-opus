import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base, workers:1, reporter:[['list'],['json',{outputFile:'../../logs/B/e2e-results.json'}]],use:{...base.use,viewport:{width:1920,height:1080}}});
