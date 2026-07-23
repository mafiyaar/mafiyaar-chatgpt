import fs from 'node:fs';
const css=fs.readFileSync('apps/web/public/styles.css','utf8');
const app=fs.readFileSync('apps/web/dist/assets/client/app.js','utf8');
const errors=[];
const required=[
 ['three-column grid',/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/],
 ['fixed instruction height',/instruction[^}]*height:44px/],
 ['role-neutral night base',/--night:#0b0b0c/],
 ['320 compact rows',/@media\(max-width:360px\)[\s\S]*grid-auto-rows:64px/],
 ['landscape guard',/html\.landscape \.landscape-guard\{display:grid\}/],
 ['reduced motion',/@media\(prefers-reduced-motion:reduce\)/]
];
for(const [name,re] of required)if(!re.test(css))errors.push(`Missing ${name}`);
for(const forbidden of ['secretEntropyId','nightSubmissions','gridOrders'])if(app.includes(forbidden))errors.push(`Client bundle includes ${forbidden}`);
const sizes=[[320,568],[360,800],[375,812],[390,844],[412,915],[430,932]],rows=[];
for(const [w,h] of sizes)for(const players of [6,12])for(const locale of ['ur-Roman','en'])for(const role of ['mafia','civilian','spectator']){
 const count=role==='spectator'?players:players-1,rowCount=Math.ceil(count/3),rowHeight=w<=360?64:78,gap=w<=360?6:8;
 const gridHeight=rowCount*rowHeight+(rowCount-1)*gap,instructionHeight=44,timerHeight=34,headHeight=Math.max(instructionHeight+22,timerHeight),margins=40,confirm=82,padding=38,spectator=role==='spectator'?40:0,total=headHeight+gridHeight+margins+confirm+padding+spectator;
 rows.push({w,h,players,locale,role,count,rowCount,cardWidth:(w-20-(2*gap))/3,rowHeight,instructionHeight,confirmHeight:56,total,overflow:total>h});
}
for(const r of rows){if(r.cardWidth<=0||r.rowHeight<=0||r.instructionHeight<=0||r.confirmHeight<=0)errors.push(`Zero geometry ${JSON.stringify(r)}`);if(r.overflow)errors.push(`Overflow ${r.w}x${r.h} ${r.players} ${r.role}`);}
for(const key of new Set(rows.map(r=>`${r.w}|${r.h}|${r.players}|${r.locale}`))){const g=rows.filter(r=>`${r.w}|${r.h}|${r.players}|${r.locale}`===key),m=g.find(r=>r.role==='mafia'),c=g.find(r=>r.role==='civilian');for(const field of ['count','rowCount','cardWidth','rowHeight','instructionHeight','confirmHeight','total'])if(Math.abs(m[field]-c[field])>.001)errors.push(`${key} differs in ${field}`);}
const result={ok:!errors.length,mode:'deterministic-layout-contract',checks:rows.length,deviceSizes:sizes.length,errors,note:'Browser-rendered test page also exists at /testing/equal-action.html. This contract rejects zero geometry and overflow.'};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exit(1);
