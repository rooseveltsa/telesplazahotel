import {mkdir,rm,readdir,copyFile,cp} from 'node:fs/promises';
await rm('public-dist',{recursive:true,force:true});await mkdir('public-dist');
for(const entry of await readdir('.',{withFileTypes:true})){if(entry.isFile()&&(/\.(png|jpe?g|webp|ico|svg)$/i.test(entry.name)||['index.html','site.css','site.js','robots.txt','sitemap.xml'].includes(entry.name)))await copyFile(entry.name,'public-dist/'+entry.name);}
await cp('assets','public-dist/assets',{recursive:true});await cp('sys','public-dist/sys',{recursive:true});
