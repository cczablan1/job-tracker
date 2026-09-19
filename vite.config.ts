import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {base:env.BASE_PATH||'/',plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},build:{outDir:'dist'}};
});