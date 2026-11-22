/* ---------- helpers ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const hsh=s=>{let x=7;for(const c of String(s))x=(x*31+c.charCodeAt(0))>>>0;return x};
const toastEl=$('#toast');let tt;
function toast(m){toastEl.textContent=m;toastEl.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>toastEl.classList.remove('on'),3200)}

/* ---------- data ---------- */
const ENR=50, PER_MEAL_COST=16, REBATE=30, WASTE_PER_PLATE=0.33, SAFETY=1.05;
const MEALS=[
  {id:'breakfast',label:'Breakfast',icon:'🥞',start:8},
  {id:'lunch',label:'Lunch',icon:'🍛',start:13},
  {id:'snack',label:'Snacks',icon:'🫖',start:17.5},
  {id:'dinner',label:'Dinner',icon:'🌙',start:20}
];
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const M=(t,d,nv,tags)=>({t,d,nv:!!nv,tags:tags||[]});
const MENU=[
 {breakfast:M('Poha & Jalebi',['Kanda Poha','Jalebi','Masala Chai'],0,['Light']),lunch:M('Rajma Chawal',['Rajma Masala','Jeera Rice','Onion Salad'],0,['Protein']),snack:M('Samosa Time',['Aloo Samosa','Green Chutney','Chai'],0,['Fried']),dinner:M('Lauki Kofta Thali',['Lauki Kofta','Phulka','Dal Fry'],0,['Comfort'])},
 {breakfast:M('South Indian Start',['Idli','Sambar','Coconut Chutney'],0,['Steamed']),lunch:M('Chole Bhature',['Chole','Bhature','Pickled Onion'],0,['Spicy']),snack:M('Maggi Hour',['Masala Maggi','Ketchup','Lemon Tea'],0,['Fun']),dinner:M('Egg Curry Rice',['Egg Curry','Steamed Rice','Cucumber Raita'],1,['Protein','Veg option'])},
 {breakfast:M('Aloo Paratha Morning',['Aloo Paratha','Curd','Mango Pickle'],0,['Hearty']),lunch:M('Kadhi Pakoda',['Kadhi Pakoda','Plain Rice','Papad'],0,['Tangy']),snack:M('Sandwich Break',['Veg Sandwich','Tomato Soup'],0,['Light']),dinner:M('Paneer Butter Masala',['Paneer Butter Masala','Butter Naan','Jeera Rice'],0,['Rich'])},
 {breakfast:M('Upma & Banana',['Rava Upma','Banana','Filter Coffee'],0,['Light']),lunch:M('Dal Tadka Combo',['Dal Tadka','Jeera Rice','Bhindi Fry'],0,['Classic']),snack:M('Bhel Puri',['Bhel Puri','Sev','Nimbu Pani'],0,['Chaat']),dinner:M('Chicken Curry Night',['Chicken Curry','Steamed Rice','Roti'],1,['Protein','Veg option'])},
 {breakfast:M('Masala Dosa',['Masala Dosa','Sambar','Tomato Chutney'],0,['Crispy']),lunch:M('Veg Biryani',['Veg Dum Biryani','Mint Raita','Mirchi Salan'],0,['Festive']),snack:M('Pav Bhaji Bites',['Mini Pav Bhaji','Buttermilk'],0,['Buttery']),dinner:M('Aloo Gobi & Roti',['Aloo Gobi','Tawa Roti','Moong Dal'],0,['Homely'])},
 {breakfast:M('Puri Bhaji',['Puri','Potato Bhaji','Sooji Halwa'],0,['Treat']),lunch:M('Sambar Rice',['Sambar Rice','Beetroot Poriyal','Appalam'],0,['South']),snack:M('Corn Chaat',['Masala Corn','Cold Coffee'],0,['Light']),dinner:M('Fish Fry Thali',['Fish Fry','Lemon Rice','Rasam'],1,['Protein','Veg option'])},
 {breakfast:M('Chole Kulche',['Chole','Amritsari Kulcha','Lassi'],0,['Weekend']),lunch:M('Special Pulao',['Veg Pulao','Boondi Raita','Gulab Jamun'],0,['Sweet end']),snack:M('Pakora & Chai',['Mixed Pakora','Masala Chai'],0,['Rainy mood']),dinner:M('Sunday Feast',['Paneer Tikka Masala','Garlic Naan','Kheer'],0,['Feast','Dessert'])}
];
const HIST_WASTE=[92,88,95,84,80,86,74,70,72,64,58,60,52,47];
const HIST_SKIPS=[22,26,24,31,35,33,40,42,46,45,52,58,55,62];
const NGOS=['Annadaan Food Rescue','Roti Bank Collective'];

/* ---------- state ---------- */
let S={me:{},extra:{},logs:[],ratings:{},cmts:[],voted:null,votes:[31,24,19,12]};
try{Object.assign(S,JSON.parse(localStorage.getItem('messmeter')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('messmeter',JSON.stringify(S))}catch(e){}};

const todayIdx=(new Date().getDay()+6)%7;
const tmrIdx=(todayIdx+1)%7;
let focus={day:tmrIdx,meal:'dinner'}, menuDay=tmrIdx;
const K=(d,m)=>d+'-'+m;

/* ---------- time + fake "server" validation ---------- */
function simNow(){const[h,m]=($('#clock').value||'12:00').split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return d}
function mealWhen(d,mid){
  const meal=MEALS.find(x=>x.id===mid), now=simNow();
  const t=new Date(now);t.setDate(t.getDate()+((d-todayIdx+7)%7));
  t.setHours(Math.floor(meal.start),(meal.start%1)*60,0,0);
  if(t<=now)t.setDate(t.getDate()+7);
  return t;
}
function cutoffInfo(d,mid){
  const t=mealWhen(d,mid), cut=new Date(t.getTime()-6*3600e3), left=cut-simNow();
  return {t,cut,left,open:left>=0};
}
const fmtLeft=ms=>{const m=Math.floor(ms/60000);return Math.floor(m/60)+'h '+m%60+'m'};
const api={
  toggleOptOut(d,mid){
    const c=cutoffInfo(d,mid);
    if(!c.open)return {ok:false,msg:'Cutoff passed. Opt-outs close 6 hours before the meal.'};
    const k=K(d,mid);
    if(S.me[k])delete S.me[k];else S.me[k]=true;
    save();return {ok:true,on:!!S.me[k]};
  }
};
const baseOut=(d,mid)=>(d===tmrIdx&&mid==='dinner')?0:(hsh(K(d,mid))%6)+1;
const optCount=(d,mid)=>baseOut(d,mid)+(S.extra[K(d,mid)]||0)+(S.me[K(d,mid)]?1:0);
const headcount=(d,mid)=>ENR-optCount(d,mid);

/* ---------- selectors synced everywhere ---------- */
function buildSelectors(){
  ['pass','kitchen','waste','rate'].forEach(id=>{
    $('#sel-'+id).innerHTML=`<select data-f="day">${DAYS.map((n,i)=>`<option value="${i}">${n}${i===tmrIdx?' (tomorrow)':i===todayIdx?' (today)':''}</option>`).join('')}</select>
    <select data-f="meal">${MEALS.map(m=>`<option value="${m.id}">${m.icon} ${m.label}</option>`).join('')}</select>`;
  });
  $$('.selrow select').forEach(s=>s.addEventListener('change',()=>{
    const f=s.dataset.f; if(f==='day')focus.day=+s.value; else focus.meal=s.value;
    syncSelectors();renderAll();
  }));
}
function syncSelectors(){$$('.selrow select[data-f=day]').forEach(s=>s.value=focus.day);$$('.selrow select[data-f=meal]').forEach(s=>s.value=focus.meal)}

/* ---------- MENU ---------- */
function renderTabs(){
  $('#dayTabs').innerHTML=DAYS.map((n,i)=>`<button class="tab ${i===menuDay?'on':''} ${i===todayIdx?'today':''}" data-i="${i}">${n.slice(0,3)}</button>`).join('');
  $$('#dayTabs .tab').forEach(b=>b.onclick=()=>{menuDay=+b.dataset.i;renderTabs();renderMenu()});
}
function renderMenu(){
  $('#mealGrid').innerHTML=MEALS.map(m=>{
    const meal=MENU[menuDay][m.id], k=K(menuDay,m.id), c=cutoffInfo(menuDay,m.id), skipped=!!S.me[k];
    const hh=Math.floor(m.start),mm=(m.start%1)*60;
    const time=`${((hh+11)%12)+1}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`;
    return `<div class="card meal ${skipped?'skipped':''}" data-k="${k}">
      <div class="icon">${m.icon}</div><div class="meta">${m.label.toUpperCase()} · ${time}</div>
      <h3>${meal.t}</h3>
      <span class="badge ${meal.nv?'nv':'veg'}">${meal.nv?'🍗 Non-Veg':'🌿 Veg'}</span>${meal.tags.map(t=>`<span class="badge tag">${t}</span>`).join('')}
      <div class="dishes">${meal.d.map(x=>`<span class="dish">${x}</span>`).join('')}</div>
      <div class="cut ${c.open?'ok':'bad'}">${c.open?`⏳ Opt-out closes in ${fmtLeft(c.left)}`:'🔒 Cutoff passed'}</div>
      <button class="btn small ${skipped?'alt':''}" data-d="${menuDay}" data-m="${m.id}" ${c.open?'':'disabled'}>${skipped?'↩ Undo skip':'✋ Skip this meal'}</button>
    </div>`}).join('');
  $$('#mealGrid button').forEach(b=>b.onclick=()=>{
    const r=api.toggleOptOut(+b.dataset.d,b.dataset.m);
    if(!r.ok)return toast('⛔ '+r.msg);
    toast(r.on?`Skipped! You earn a ₹${REBATE} rebate 💰`:'Welcome back to the table 🍽️');
    focus={day:+b.dataset.d,meal:b.dataset.m};syncSelectors();renderAll();
  });
  $('#wallet').textContent='₹'+Object.keys(S.me).length*REBATE;
}

/* ---------- PASS ---------- */
function renderPass(){
  const k=K(focus.day,focus.meal), meal=MENU[focus.day][focus.meal], out=!!S.me[k];
  $('#passMeal').textContent=`${DAYS[focus.day]} · ${meal.t}`;
  $('#qr').innerHTML=Array.from({length:169},(_,i)=>`<i class="${hsh(k+i)%2?'f':''}"></i>`).join('');
  $('#passCard').classList.toggle('out',out);
  $('#passValid').textContent=out?'⛔ Not valid: opted out':'✅ Valid for this meal';
  $('#passValid').style.background=out?'var(--tomato)':'var(--chilli)';
}
const pc=$('#passCard');
pc.parentElement.addEventListener('mousemove',e=>{const r=pc.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;pc.style.transform=`rotateY(${x*28}deg) rotateX(${-y*28}deg)`});
pc.parentElement.addEventListener('mouseleave',()=>pc.style.transform='');

/* ---------- KITCHEN ---------- */
const RAW=[['🍚 Rice',80],['🍲 Dal',40],['🥦 Vegetables',120]];
function tween(el,to){const from=+el.textContent||0,t0=performance.now();(function f(t){const p=Math.min(1,(t-t0)/500);el.textContent=Math.round(from+(to-from)*p);if(p<1)requestAnimationFrame(f)})(t0)}
function renderKitchen(){
  const n=headcount(focus.day,focus.meal), out=ENR-n;
  tween($('#headcount'),n);$('#enrolled').textContent=ENR;
  $('#dots').innerHTML=Array.from({length:ENR},(_,i)=>`<span class="${i<n?'':'off'}">${i<n?'🍽️':'🚫'}</span>`).join('');
  $('#rawBody').innerHTML=RAW.map(([nm,g])=>{
    const cook=n*g*SAFETY/1000, full=ENR*g*SAFETY/1000;
    return `<tr><td>${nm}</td><td>${g} g</td><td><b>${cook.toFixed(1)} kg</b></td><td class="delta">−${(full-cook).toFixed(1)} kg</td></tr>`}).join('');
  $('#saveBox').innerHTML=out?`💸 ${out} students skipped → saving about <b>₹${out*PER_MEAL_COST}</b> and preventing roughly <b>${(out*WASTE_PER_PLATE).toFixed(1)} kg</b> of waste.`:'No opt-outs yet for this meal. Cooking for everyone.';
}
$('#simBtn').onclick=()=>{
  const k=K(focus.day,focus.meal);
  S.extra[k]=Math.max(0,15-baseOut(focus.day,focus.meal)-(S.me[k]?1:0));save();renderAll();toast('15 students opted out 🎉 Headcount dropped!');
};
$('#resetBtn').onclick=()=>{S.extra={};S.me={};save();renderAll();toast('Reset to a fresh mess')};

/* ---------- WASTE LOG ---------- */
function renderWasteForm(){
  const meal=MENU[focus.day][focus.meal];
  $('#wasteForm').innerHTML=meal.d.map((d,i)=>`<div class="row"><label>${d} waste (kg)</label><input type="number" min="0" step="0.5" value="0" data-i="${i}"></div>`).join('');
}
function renderLogs(){
  $('#logList').innerHTML=S.logs.length?S.logs.slice(0,7).map(l=>`<div class="log"><span><b>${l.meal}</b><br><small>${l.items}</small></span><b>${l.total} kg${l.surplus?`<br><small>🚚 ${l.surplus} kg surplus</small>`:''}</b></div>`).join(''):'<p style="color:var(--muted)">No logs yet. Save one on the left.</p>';
}
$('#logBtn').onclick=()=>{
  const meal=MENU[focus.day][focus.meal], ins=$$('#wasteForm input');
  const rows=ins.map((x,i)=>({n:meal.d[i],kg:+x.value||0})).filter(r=>r.kg>0);
  const surplus=+$('#surplus').value||0, total=rows.reduce((a,r)=>a+r.kg,0);
  if(!total&&!surplus)return toast('Enter at least one waste value');
  S.logs.unshift({meal:`${DAYS[focus.day].slice(0,3)} ${MEALS.find(m=>m.id===focus.meal).label}`,items:rows.map(r=>`${r.n}: ${r.kg}kg`).join(', ')||'No waste',total:+total.toFixed(1),surplus});
  save();
  const b=$('#beacon');
  if(surplus>15){const ngo=NGOS[hsh(surplus)%NGOS.length];b.className='beacon on';b.innerHTML=`🚨 NGO Beacon fired! ${surplus} kg surplus → <u>${ngo}</u> notified for pickup.`;toast('NGO alerted for food rescue 🚚')}
  else{b.className='beacon';toast('Waste logged ✅')}
  ins.forEach(x=>x.value=0);$('#surplus').value=0;
  renderLogs();updateCharts();
};

/* ---------- RATINGS ---------- */
const ALLDISHES=[...new Set(MENU.flatMap(d=>Object.values(d).flatMap(m=>m.d)))];
const seedR=d=>({a:Math.min(5,2.3+(hsh(d)%28)/10),c:8+hsh(d)%15});
function avg(d){const s=seedR(d),x=S.ratings[d]||[0,0];return (s.a*s.c+x[0])/(s.c+x[1])}
let pending={};
function renderRate(){
  const meal=MENU[focus.day][focus.meal];
  $('#rateList').innerHTML=`<h3 style="margin-bottom:8px">${meal.t}</h3>`+meal.d.map(d=>`<div class="dishrate"><span>${d}<br><small class="meta">Avg ${avg(d).toFixed(1)} ★</small></span><span class="stars" data-d="${d}">${[1,2,3,4,5].map(n=>`<button data-n="${n}" class="${(pending[d]||0)>=n?'on':''}">★</button>`).join('')}</span></div>`).join('');
  $$('#rateList .stars button').forEach(b=>b.onclick=()=>{pending[b.parentElement.dataset.d]=+b.dataset.n;renderRate()});
  $('#cmtList').innerHTML=S.cmts.length?S.cmts.slice(0,6).map(c=>`<div class="cmt"><b>${c.meal}</b> ${c.stars}<br>${c.text}</div>`).join(''):'<p style="color:var(--muted)">No comments yet. Be the first.</p>';
}
$('#rateBtn').onclick=()=>{
  const ds=Object.keys(pending);if(!ds.length)return toast('Tap some stars first ⭐');
  ds.forEach(d=>{const x=S.ratings[d]||[0,0];S.ratings[d]=[x[0]+pending[d],x[1]+1]});
  const txt=$('#comment').value.trim();
  if(txt)S.cmts.unshift({meal:MENU[focus.day][focus.meal].t,stars:'⭐'.repeat(Math.round(ds.reduce((a,d)=>a+pending[d],0)/ds.length)),text:txt.replace(/[<>]/g,'')});
  pending={};$('#comment').value='';save();renderRate();updateCharts();toast('Thanks! The kitchen will hear it 🍳');
};

/* ---------- POLL ---------- */
const POLL=['Paneer Tikka Masala + Butter Naan','Hyderabadi Veg Dum Biryani','Chole Kulche Chaat Platter','Pav Bhaji Party'];
function renderPoll(){
  const tot=S.votes.reduce((a,b)=>a+b,0);
  $('#pollBox').innerHTML=POLL.map((o,i)=>`<div class="opt ${S.voted===i?'mine':''}" data-i="${i}"><div class="bar" style="width:${S.votes[i]/tot*100}%"></div><span>${['🧈','🍚','🥘','🍞'][i]} ${o}</span><span>${Math.round(S.votes[i]/tot*100)}%</span></div>`).join('')+`<small class="meta">${tot} votes · ${S.voted===null?'Tap to vote':'You voted. Thanks!'}</small>`;
  $$('.opt').forEach(el=>el.onclick=()=>{if(S.voted!==null)return toast('You already voted 🗳️');S.voted=+el.dataset.i;S.votes[S.voted]++;save();renderPoll();toast('Vote counted!')});
}

/* ---------- CHARTS ---------- */
let cW,cM,cR;
const labels=[...Array.from({length:14},(_,i)=>'D-'+(13-i)),'Today'];
function dishLists(){const arr=ALLDISHES.map(d=>[d,avg(d)]).sort((a,b)=>b[1]-a[1]);return [...arr.slice(0,5),...arr.slice(-5)]}
function updateCharts(){
  const logged=S.logs.reduce((a,l)=>a+l.total,0);
  const wData=[...HIST_WASTE,logged||null];
  let tmrSkips=0;MEALS.forEach(m=>tmrSkips+=optCount(tmrIdx,m.id));
  const skips=[...HIST_SKIPS,tmrSkips];
  const first=HIST_WASTE.slice(0,7).reduce((a,b)=>a+b),second=HIST_WASTE.slice(7).reduce((a,b)=>a+b);
  $('#k1').textContent='−'+Math.round((1-second/first)*100)+'%';
  $('#k2').textContent='₹'+(skips.reduce((a,b)=>a+b)*PER_MEAL_COST).toLocaleString('en-IN');
  $('#k3').textContent=skips.reduce((a,b)=>a+b);
  $('#k4').textContent=(ALLDISHES.reduce((a,d)=>a+avg(d),0)/ALLDISHES.length).toFixed(1)+' ★';
  if(typeof Chart==='undefined')return;
  const dl=dishLists();
  if(!cW){
    Chart.defaults.font.family="'DM Sans',sans-serif";Chart.defaults.color='#2A1A10';
    cW=new Chart($('#cWaste'),{type:'line',data:{labels,datasets:[{label:'kg wasted',data:wData,borderColor:'#D4472B',backgroundColor:'#D4472B',borderWidth:4,tension:.3,pointRadius:5,pointBackgroundColor:'#E9A21B',pointBorderColor:'#2A1A10',pointBorderWidth:2,spanGaps:false}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#E5D6B8'}},x:{grid:{display:false}}}}});
    cM=new Chart($('#cMoney'),{type:'bar',data:{labels,datasets:[{data:skips.map(x=>x*PER_MEAL_COST),backgroundColor:skips.map((_,i)=>i===14?'#E9A21B':'#4F7B3B'),borderColor:'#2A1A10',borderWidth:2,borderRadius:6}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#E5D6B8'}},x:{grid:{display:false}}}}});
    cR=new Chart($('#cRate'),{type:'bar',data:{labels:dl.map(x=>x[0]),datasets:[{data:dl.map(x=>+x[1].toFixed(2)),backgroundColor:dl.map((_,i)=>i<5?'#4F7B3B':'#D4472B'),borderColor:'#2A1A10',borderWidth:2,borderRadius:6}]},options:{indexAxis:'y',maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{min:0,max:5,grid:{color:'#E5D6B8'}},y:{grid:{display:false}}}}});
  }else{
    cW.data.datasets[0].data=wData;cW.update();
    cM.data.datasets[0].data=skips.map(x=>x*PER_MEAL_COST);cM.update();
    cR.data.labels=dl.map(x=>x[0]);cR.data.datasets[0].data=dl.map(x=>+x[1].toFixed(2));cR.update();
  }
}

/* ---------- master render ---------- */
function renderAll(){renderMenu();renderPass();renderKitchen();renderWasteForm();renderRate();updateCharts()}

/* ---------- 3D scroll ---------- */
const plate=$('#plate');let mx=0,my=0;
window.addEventListener('mousemove',e=>{mx=(e.clientX/innerWidth-.5)*20;my=(e.clientY/innerHeight-.5)*14});
function onScroll(){
  const y=scrollY, max=document.documentElement.scrollHeight-innerHeight;
  $('#progress').style.width=(y/max*100)+'%';
  const p=Math.min(1,y/(innerHeight*.9));
  plate.style.setProperty('--rx',(58-p*38+my)+'deg');
  plate.style.setProperty('--rz',(-20+p*160+mx)+'deg');
  plate.style.setProperty('--lift',(20+p*90)+'px');
  const vh=innerHeight, calm=matchMedia('(prefers-reduced-motion:reduce)').matches;
  $$('.rev').forEach(el=>{
    if(calm){el.style.transform='none';return}
    const r=el.getBoundingClientRect();
    let q=Math.min(1,Math.max(0,(vh-r.top)/(vh*.55)));q=q*q*(3-2*q);
    if(q>=.995){el.style.transform='none';el.style.opacity=1;return}
    const dir=+(el.dataset.dir||0);
    el.style.transform=`perspective(1000px) rotateX(${(1-q)*32}deg) rotateY(${dir*(1-q)*30}deg) translateY(${(1-q)*60}px) scale(${.9+.1*q})`;
    el.style.opacity=.2+.8*q;
  });
}
let tick=false;
addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(()=>{onScroll();tick=false})}},{passive:true});
addEventListener('resize',onScroll);

/* ---------- boot ---------- */
buildSelectors();syncSelectors();renderTabs();renderLogs();renderPoll();renderAll();
$('#clock').addEventListener('input',renderAll);
onScroll();
