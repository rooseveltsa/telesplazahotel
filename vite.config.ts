import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({root:'sys-src',base:'/sys/',plugins:[react()],resolve:{alias:{'@':resolve(import.meta.dirname,'sys-src')}},build:{outDir:'../sys',emptyOutDir:true},css:{postcss:resolve(import.meta.dirname,'postcss.config.mjs')}});
