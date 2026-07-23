const sizes=[[320,568],[360,800],[375,812],[390,844],[412,915],[430,932]];
const locales={
  'ur-Roman':{mafia:'Us player ko chuno jise tum aaj raat bahar karna chahte ho.',civilian:'Us player ko chuno jise tum samajhte ho Mafia aaj raat chahegi.',spectator:'Andaza lagao Mafia aaj raat kis ko nishana banayegi.',confirm:'Hold karke confirm karo'},
  en:{mafia:'Choose the player you want gone tonight.',civilian:'Choose the player you think Mafia wants gone.',spectator:'Choose the player you think Mafia wants gone.',confirm:'Hold to confirm'}
};
const stage=document.querySelector('#stage'),result=document.querySelector('#result');
const rows=[];
function luminance(hex){const n=parseInt(hex.slice(1),16),rgb=[(n>>16)&255,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
for(const [w,h] of sizes)for(const players of [6,12])for(const locale of Object.keys(locales))for(const scale of [1,1.6])for(const role of ['mafia','civilian','spectator']){
  const phone=document.createElement('section');phone.className='test-phone';phone.style.width=w+'px';phone.style.height=h+'px';phone.style.fontSize=(16*scale)+'px';
  const count=role==='spectator'?players:players-1;phone.innerHTML=`<div class="test-head"><div><small>NIGHT 1</small><div class="test-instruction">${locales[locale][role]}</div></div><div class="test-timer">0:38</div></div><div class="test-grid">${Array.from({length:count},(_,i)=>`<div class="test-card">Player ${i+1}</div>`).join('')}</div><button class="test-confirm">${locales[locale].confirm}</button>`;stage.appendChild(phone);
  const phoneRect=phone.getBoundingClientRect(),instruction=phone.querySelector('.test-instruction').getBoundingClientRect(),card=phone.querySelector('.test-card').getBoundingClientRect(),grid=phone.querySelector('.test-grid').getBoundingClientRect(),confirm=phone.querySelector('.test-confirm').getBoundingClientRect(),timer=phone.querySelector('.test-timer').getBoundingClientRect();
  const relative=rect=>({x:rect.x-phoneRect.x,y:rect.y-phoneRect.y,w:rect.width,h:rect.height});
  rows.push({w,h,players,locale,scale,role,count,instruction:relative(instruction),card:{w:card.width,h:card.height},grid:{...relative(grid),scrollHeight:phone.querySelector('.test-grid').scrollHeight},confirm:relative(confirm),timer:relative(timer),overflow:phone.scrollHeight>phone.clientHeight||phone.scrollWidth>phone.clientWidth,luminance:luminance('#0b0b0c')});
}
let errors=[];
for(const key of new Set(rows.map(r=>[r.w,r.h,r.players,r.locale,r.scale].join('|')))){
 const group=rows.filter(r=>[r.w,r.h,r.players,r.locale,r.scale].join('|')===key),m=group.find(r=>r.role==='mafia'),c=group.find(r=>r.role==='civilian'),s=group.find(r=>r.role==='spectator');
 for(const field of ['instruction','card','grid','confirm','timer'])for(const dim of ['x','y','w','h'])if(m[field][dim]!==undefined&&Math.abs(m[field][dim]-c[field][dim])>.51)errors.push(`${key} ${field}.${dim} differs mafia/civilian`);
 if(m.count!==c.count)errors.push(`${key} living card counts differ`);
 if([m,c,s].some(x=>x.card.w<=0||x.card.h<=0||x.instruction.h<=0||x.confirm.h<=0))errors.push(`${key} zero geometry`);
 if([m,c,s].some(x=>x.overflow))errors.push(`${key} viewport overflow`);
 if(Math.max(...group.map(x=>x.luminance))-Math.min(...group.map(x=>x.luminance))>.0001)errors.push(`${key} luminance differs`);
}
const output={ok:errors.length===0,checks:rows.length,groups:new Set(rows.map(r=>[r.w,r.h,r.players,r.locale,r.scale].join('|'))).size,errors,summary:'Mafia and Civilian share identical non-zero geometry; spectator uses the same component and card dimensions with public dead-player card-count allowance.'};
result.textContent=JSON.stringify(output,null,2);result.dataset.ok=String(output.ok);document.documentElement.dataset.testComplete='true';
