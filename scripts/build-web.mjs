import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),tmp=path.join(root,'.build-web'),dist=path.join(root,'apps/web/dist');
fs.rmSync(tmp,{recursive:true,force:true});fs.rmSync(dist,{recursive:true,force:true});
const t=spawnSync('tsc',['-p','tsconfig.web.json'],{stdio:'inherit',shell:process.platform==='win32'});if(t.status!==0)process.exit(t.status||1);
fs.cpSync(path.join(root,'apps/web/public'),dist,{recursive:true});fs.mkdirSync(path.join(dist,'assets/client'),{recursive:true});fs.mkdirSync(path.join(dist,'assets/shared'),{recursive:true});
for(const name of ['app','api','realtime']){let text=fs.readFileSync(path.join(tmp,'apps/web/src',`${name}.js`),'utf8');text=text.replaceAll("../../../packages/contracts/index.js","../shared/contracts.js").replaceAll("../../../packages/copy/index.js","../shared/copy.js");fs.writeFileSync(path.join(dist,'assets/client',`${name}.js`),text);const map=path.join(tmp,'apps/web/src',`${name}.js.map`);if(fs.existsSync(map))fs.copyFileSync(map,path.join(dist,'assets/client',`${name}.js.map`));}
for(const [src,dest] of [['contracts','contracts'],['copy','copy']]){let text=fs.readFileSync(path.join(tmp,'packages',src,'index.js'),'utf8');text=text.replaceAll("../contracts/index.js","./contracts.js");fs.writeFileSync(path.join(dist,'assets/shared',`${dest}.js`),text);}
fs.rmSync(tmp,{recursive:true,force:true});console.log(`Built web assets: ${fs.readdirSync(dist,{recursive:true}).length} entries`);
