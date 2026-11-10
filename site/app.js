(function(){
"use strict";
const SWOOSH="/swoosh.png";

/* ---------- reference data from the progress sheet ---------- */
const KEYS=[["C"],["C♯","D♭"],["D"],["D♯","E♭"],["E"],["F"],["F♯","G♭"],["G"],["G♯","A♭"],["A"],["A♯","B♭"],["B"]];
const KEYNAME=KEYS.map(k=>k.join("/"));
const GROUPS=[
 {name:"Major modes",rows:["Ionian (major)","Dorian","Phrygian","Lydian","Mixolydian","Aeolian (natural minor)","Locrian"]},
 {name:"Melodic minor modes",rows:["Melodic minor","Dorian ♭2","Lydian augmented","Lydian dominant","Mixolydian ♭6","Locrian ♯2","Altered (super Locrian)"]},
 {name:"Harmonic minor modes",rows:["Harmonic minor","Locrian ♮6","Ionian ♯5","Dorian ♯4","Phrygian dominant","Lydian ♯2","Super Locrian (altered diminished)"]},
 {name:"Symmetric",rows:["Diminished","Whole tone"]},
 {name:"Scale tests",rows:["Ionian / Dorian test","Lydian test","Mixolydian / Aeolian test","Locrian test"],test:true}
];
GROUPS.forEach((g,gi)=>g.ids=g.rows.map((r,ri)=>"g"+gi+"r"+ri));
const ROWNAME={};GROUPS.forEach(g=>g.ids.forEach((id,i)=>ROWNAME[id]=g.rows[i]));
const SCALE_IDS=GROUPS.filter(g=>!g.test).flatMap(g=>g.ids);
const REP_STATUS=["Assigned","Working on it","Ready to play","Done"];
const METHODS={zelle:"Zelle",paypal:"PayPal",cash:"Cash",check:"Check"};
const LENGTHS=[30,60];

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const TODAY=iso(new Date());
const addDays=(s,n)=>{const d=new Date(s+"T12:00");d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>Math.round((new Date(b+"T12:00")-new Date(a+"T12:00"))/864e5);
const fmt=s=>{if(!s)return"";const[y,m,d]=s.split("-");return(+m)+"/"+(+d)+"/"+y.slice(2)};
const fmtShort=s=>{if(!s)return"";const[,m,d]=s.split("-");return(+m)+"/"+(+d)};
const fmtLong=s=>new Date(s+"T12:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const money=n=>"$"+(Math.round(n*100)/100).toLocaleString("en-US",{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DOW_LONG=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const dowOf=d=>(new Date(d+"T12:00").getDay()+6)%7;
const weekStart=d=>addDays(d,-dowOf(d));
const WS=weekStart(TODAY);
const hm=t=>{const[h,m]=String(t||"0:0").split(":").map(Number);return h*60+(m||0)};
const toHM=m=>pad(Math.floor(m/60))+":"+pad(m%60);
const fmtTime=m=>{let h=Math.floor(m/60);const mm=m%60,ap=h>=12?"PM":"AM";h=h%12||12;return h+(mm?":"+pad(mm):"")+" "+ap};
const rangeText=(a,b)=>a===b?fmtLong(a):fmtLong(a)+" to "+fmtLong(b);
const nowMin=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
const nid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------- the clock (stopped at 1:00, second hand ticks) ---------- */
function clockSVG(cls,mini){
  let t="";for(let i=0;i<60;i++){const big=i%5===0;if(mini&&!big)continue;const a=i*6*Math.PI/180,r1=big?72:80,r2=86;
    t+=`<line x1="${(Math.sin(a)*r1).toFixed(1)}" y1="${(-Math.cos(a)*r1).toFixed(1)}" x2="${(Math.sin(a)*r2).toFixed(1)}" y2="${(-Math.cos(a)*r2).toFixed(1)}" stroke="currentColor" stroke-width="${big?(mini?7:3):1}"/>`}
  return `<svg class="${cls}" viewBox="-100 -100 200 200" aria-hidden="true"><circle r="96" fill="none" stroke="currentColor" stroke-width="${mini?8:1.5}"/>${mini?"":'<circle r="88" fill="none" stroke="currentColor" stroke-width=".6" opacity=".6"/>'}${t}
  <line x1="0" y1="8" x2="0" y2="-62" stroke="currentColor" stroke-width="${mini?10:4}" stroke-linecap="round"/>
  <line x1="0" y1="6" x2="0" y2="-40" stroke="currentColor" stroke-width="${mini?12:6}" stroke-linecap="round" transform="rotate(30)"/>
  <g class="sec"><line x1="0" y1="14" x2="0" y2="-80" stroke="#E3261F" stroke-width="${mini?6:1.6}"/></g><circle r="${mini?9:4}" fill="#E3261F"/></svg>`;
}

/* ---------- instructor bios ---------- */
const SARAH_IMG="/sarah.jpg";
const MITCH_IMG="/mitch.jpg";
const SARAH_BIO=["Sarah Griego is an American composer, orchestrator, performer, conductor, and educator. Sarah has taught students ranging from beginning to advanced levels in jazz and classical saxophone, as well as music theory, composition, and arranging. As both an educator and musician, she showcases versatility in performance, writing, and listening while encouraging students to approach music with an open mind.",
 "As a performer, Sarah has appeared with a variety of artists both nationally and internationally. Her musical specialties include jazz composition and performance, Latin music, contemporary music, and classical performance.",
 "Sarah remains active as a composer and arranger, writing for concert hall ensembles, chamber groups, big band and vocal jazz ensembles, orchestra, marching band, mariachi, and a wide range of contemporary settings. Her music has been performed by numerous artists and ensembles including Lorenzo Antonio, Dionne Warwick, the American Pops Orchestra, Vincent Herring, Daymé Arocena, RaiNao, Gerry Lopez, Baptiste Herbin, Joan Osborne, Benny Benack III, Matt Wilson’s Good Trouble, and the seven-time Grammy-nominated One O’Clock Lab Band.",
 "As a bandleader and conductor, Sarah has directed several ensembles including The Eddie Brewer Big Band, Parker’s Lab Band, the Fun O’Clock Lab Band, and The University of New Mexico Marching Band. Her diverse musical background and experience across multiple styles continue to make her an in-demand composer, performer, educator, and clinician.",
 "Sarah holds a Bachelor of Music degree in Jazz Studies from the University of New Mexico and a Master of Music degree in Jazz Composition from the University of North Texas."];
const MITCH_BIO=["Mitchell Weber was born and raised in Clovis, New Mexico, and left for college in 2017. None of his immediate family were musicians, but music was a frequent topic of discussion at home, and all kinds of it filled the car on road trips.",
 "Mitch began playing trumpet at age 10, drawn to the discipline and self-improvement it demands. He practiced several hours a day through high school, and his applied teacher, Keith Sacane, pushed him into competitions and conferences where he met and studied with world-class musicians. Mitchell was a semi-finalist for the 2017 National Trumpet Competition in Denver, Colorado.",
 "With a bachelor’s degree from the University of New Mexico, Mitch has performed in the orchestral, big band, combo, Latin, and rock musical settings. He has shared the stage, both domestically and internationally, with artists such as War, Tower of Power, Benny Benack III, Baptiste Herbin, Gerry Lopez, and Al Hurricane Jr.",
 "Mitch thoroughly enjoys teaching his trumpet studio, laying the foundation for strong pedagogical footing, and has developed many techniques addressing every developmental issue in the book. He’s known for his “Toolbox” of exercises which include strong groundings in aural skills and the psychological connection between musician and instrument.",
 "Most notably, Mitchell is married to the amazing Sarah Griego, who has grown her following and career to incredible heights. This is his favorite fact about himself."];

/* ---------- data (filled from the server) ---------- */
const PROFILE={sarah:{photo:SARAH_IMG,photoCredit:"Photo: Quinn and Anna Cameron",teaches:["Saxophone (jazz and classical)","Music theory","Composition & arranging"],bio:SARAH_BIO},mitchell:{photo:MITCH_IMG,photoCredit:"",teaches:["Trumpet"],bio:MITCH_BIO}};
const teachers={};
const students=[];
let ME=null,STORE_CODE="";
const CLASSROOM_URL="https://classroom.google.com/";
const ATT={pdf:"PDF",doc:"Doc",video:"Video",link:"Link",form:"Form"};
const classroom={connected:false,account:"",synced:0,error:"",classes:[],roster:{},items:[]};
const sameEmail=(a,b)=>!!a&&!!b&&a.trim().toLowerCase()===b.trim().toLowerCase();
const studentClasses=s=>classroom.classes.filter(c=>(classroom.roster[c.id]||[]).some(r=>sameEmail(r.email,s.email)));
const itemsFor=s=>{const ids=studentClasses(s).map(c=>c.id);return classroom.items.filter(i=>ids.includes(i.cls))};
const ago=ms=>{const m=Math.round((Date.now()-ms)/60000);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" hr ago":Math.round(m/1440)+" days ago"};
const store={name:"Rhapsody Music",code:"",trialMins:30,email:""};
const trials=[];
const requests=[];
const S={as:null,viewAs:null,restore:null,storeT:"sarah",book:null,screen:"students",filter:"all",sid:null,tab:"scales",markDate:TODAY,form:null,pay:null,dialog:null,
  week:WS,calT:"sarah",sel:null,req:null,dismissed:new Set(),topic:"All",mq:"",syncing:false,period:"y",
  sessions:{}};
const viewer=()=>{const id=S.viewAs||S.as;return id==="store"?{kind:"store"}:teachers[id]?{kind:"teacher",t:teachers[id]}:{kind:"student",s:students.find(x=>x.id===id)}};
const mine=()=>{const v=viewer();return students.filter(s=>!s.anon&&!s.archived&&(v.t.owner||s.teacher===v.t.id))};
const visible=()=>{const v=viewer();return mine().filter(s=>!v.t.owner||S.filter==="all"||s.teacher===S.filter)};
const owedOf=s=>s.lessons.filter(l=>l.status!=="paid").reduce((a,l)=>a+l.amount,0);
const passedOf=s=>SCALE_IDS.reduce((a,id)=>a+Object.values(s.grid[id]||{}).filter(c=>c.s==="p").length,0);
const openRep=s=>s.rep.filter(r=>r.status!=="Done");
const nextDue=s=>openRep(s).sort((a,b)=>a.due.localeCompare(b.due))[0];
const cur=()=>students.find(x=>x.id===S.sid);
const v0student=()=>{const v=viewer();return v.kind==='student'?v.s:cur()};
const findLesson=id=>{for(const s of students){const l=s.lessons.find(x=>x.id===id);if(l)return{s,l}}};
const first=n=>n.split(" ")[0];
const TOTAL=SCALE_IDS.length*12;

let toastT;function toast(msg){document.querySelectorAll(".toast").forEach(t=>t.remove());const el=document.createElement("div");el.className="toast";el.textContent=msg;document.body.appendChild(el);clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),2600)}

/* ---------- preview select ---------- */
function fillAs(){}

/* ---------- nav ---------- */
function renderNav(){
  const v=viewer();let items,cur;
  if(v.kind==="teacher"){const pend=mine().reduce((a,s)=>a+s.lessons.filter(l=>l.status==="reported").length,0);
    const rq=requests.filter(r=>r.status==="pending"&&(v.t.owner||r.teacher===v.t.id)).length+trials.filter(x=>x.status==="pending"&&(v.t.owner||x.teacher===v.t.id)).length;
    items=[["students",v.t.owner?"Studio":"My students"],["schedule","Schedule",rq],["payments","Payments",pend],["review","Year in review"],["settings","Settings"]];cur=S.screen}
  else if(v.kind==="store"){items=[["book","Book a session"],["bios","Meet the instructors"],["booked","Booked sessions",trials.filter(x=>x.status==="pending").length]];cur=S.tab}
  else{items=[["dash","Dashboard",noticesFor(v.s).length],["scales","Scales"],["calendar","Calendar"],["assignments","Assignments"],["materials","Materials"],["lessons","Lessons & pay"],["year","My year"]];cur=S.tab}
  const curL=(items.find(([k])=>k===cur)||items[0])[1],total=items.reduce((a,[,,c])=>a+(c||0),0);
  const em=S.viewAs?"Viewing as":v.kind==="store"?store.name:v.kind==="teacher"?`${v.t.short}'s studio`:`${first(v.s.name)}'s lessons`,bl=(v.kind==="teacher"&&S.screen==="students"&&S.sid&&students.find(x=>x.id===S.sid))?students.find(x=>x.id===S.sid).name:curL;
  $("#whereEm").textContent=em;const wb=$("#whereB");if(wb.textContent!==bl){wb.textContent=bl;wb.classList.remove("anim");void wb.offsetWidth;wb.classList.add("anim")}
  $("#nav").innerHTML=`<button class="menu-btn" data-menu aria-haspopup="true" aria-expanded="${!!S.menu}" aria-controls="menuPanel"><span class="burger" aria-hidden="true"><i></i><i></i></span><span class="menu-word">${S.menu?"Close":"Menu"}</span>${total&&!S.menu?`<span class="count">${total}</span>`:""}</button>
  ${S.menu?`<div class="menu-panel" id="menuPanel" role="menu"><div class="mh">${v.kind==="teacher"?esc(v.t.short)+"'s studio":"Your lessons"}</div>${items.map(([k,l,c],i)=>`<button role="menuitem" data-nav="${k}" aria-current="${cur===k}" style="--i:${i}"><span>${l}</span>${c?`<span class="count">${c}</span>`:""}</button>`).join("")}${S.viewAs||(ME&&ME.role==="store")?"":`<button role="menuitem" data-signout style="--i:${items.length};color:var(--mute)"><span>Sign out</span></button>`}</div>`:""}`;
}

/* ---------- ticker ---------- */
function tickerItems(){
  const v=viewer(),out=[];
  const recentPasses=list=>list.flatMap(s=>Object.entries(s.grid).flatMap(([id,row])=>Object.entries(row).filter(([,c])=>c.s==="p").map(([ki,c])=>({s,id,ki,d:c.d})))).sort((a,b)=>b.d.localeCompare(a.d));
  if(v.kind==="store"){Object.values(teachers).forEach(tt=>{for(let i=0;i<14&&out.length<6;i++){const d=addDays(TODAY,i),f=freeFor(tt.id,d);if(f.length){out.push(["Open",`${tt.short}, ${fmtLong(d)} at ${fmtTime(f[0][0])}`]);break}}});out.push(["Get to Know sessions","Free, "+store.trialMins+" minutes"]);return out}
  if(v.kind==="teacher"){
    const list=mine();
    list.forEach(s=>s.lessons.filter(l=>l.status==="reported").forEach(l=>out.push(["To confirm",`${s.name} sent ${money(l.amount)} by ${METHODS[l.method]}`])));
    list.flatMap(s=>openRep(s).map(r=>({s,r}))).sort((a,b)=>a.r.due.localeCompare(b.r.due)).slice(0,3).forEach(({s,r})=>out.push([r.due<TODAY?"Past due":"Due "+fmtShort(r.due),`${first(s.name)}: ${r.title}`]));
    recentPasses(list).slice(0,3).forEach(p=>out.push(["Passed",`${first(p.s.name)}, ${ROWNAME[p.id]} in ${KEYNAME[p.ki]}`]));
    Object.entries(S.sessions).forEach(([k,ses])=>{if(ses.by!=="student")return;const[sid,date]=k.split("|"),st=students.find(x=>x.id===sid);if(!st||date<TODAY||!list.includes(st))return;
      out.unshift([ses.mode==="cancelled"?"Cancelled":"Switched to remote",`${first(st.name)}, ${fmtLong(date)}`])});
    trials.filter(x=>x.status==="pending"&&(v.t.owner||x.teacher===v.t.id)).forEach(x=>out.unshift(["Get to Know",`${x.name} at ${fmtLong(x.date)}, ${fmtTime(x.start)} with ${teachers[x.teacher].short}`]));
    requests.filter(r=>r.status==="pending"&&list.some(s=>s.id===r.studentId)).forEach(r=>out.unshift(["Request",`${first(students.find(s=>s.id===r.studentId).name)} wants ${fmtLong(r.date)}, ${fmtTime(r.start)}`]));
    Object.values(teachers).filter(t=>v.t.owner||t.id===v.t.id).forEach(t=>t.away.filter(a=>a.to>=TODAY).forEach(a=>out.push(["Away",`${t.short}, ${rangeText(a.from,a.to)}`])));
    const un=list.reduce((a,s)=>a+s.lessons.filter(l=>l.status==="unpaid").reduce((x,l)=>x+l.amount,0),0);
    if(un)out.push(["Unpaid",money(un)+" across the studio"]);
  } else {
    const s=v.s;
    noticesFor(s).forEach(n=>out.push([NLABEL[n.kind],n.title]));
    if(classroom.connected)itemsFor(s).filter(i=>daysBetween(i.posted,TODAY)<=7).forEach(i=>out.push(["New in Classroom",i.title]));
    openRep(s).sort((a,b)=>a.due.localeCompare(b.due)).forEach(r=>out.push([r.due<TODAY?"Past due":"Due "+fmtShort(r.due),r.title]));
    recentPasses([s]).slice(0,3).forEach(p=>out.push(["Passed",`${ROWNAME[p.id]} in ${KEYNAME[p.ki]}`]));
    out.push(["Lessons",slotText(s)]);
    const o=owedOf(s);out.push(["Balance",o?money(o):"All paid up"]);
  }
  if(!out.length)out.push(["Studio","Nothing new yet"]);
  return out;
}
function renderTicker(){
  const once=tickerItems().map(([k,t])=>`<span class="ti"><em>${esc(k)}</em>${esc(t)}<i>♪</i></span>`).join("");
  $("#tick").innerHTML=once+once+once;
}

/* ---------- hero ---------- */
function spotHTML(count,label,kind,title,meta){
  return `<div class="spot">${count!=null?`<div class="spot-count"><b data-count="${count}">${count}</b><span>${label}</span></div>`:""}<div class="spot-body"><div class="spot-kind">${kind}</div><div class="spot-title">${title}</div>${meta?`<div class="spot-meta">${meta}</div>`:""}</div></div>`;
}
function dueSpot(list,prefixName){
  const all=list.flatMap(s=>openRep(s).map(r=>({s,r}))).sort((a,b)=>a.r.due.localeCompare(b.r.due));
  const n=all[0];
  if(!n)return spotHTML(null,"","Next due","Nothing assigned",prefixName?"Assign repertoire from a student's page and it counts down here.":"When your teacher assigns a piece, it counts down here.");
  const d=daysBetween(TODAY,n.r.due);
  const label=d<0?(d===-1?"day late":"days late"):d===0?"today":d===1?"day":"days";
  return spotHTML(d===0?"0":Math.abs(d),label,d<0?"Past due":"Next due",esc(n.r.title),`${prefixName?esc(n.s.name)+" · ":""}${n.r.section?esc(n.r.section)+" · ":""}${fmtLong(n.r.due)}`);
}
function heroHTML(){
  const v=viewer();let eyebrow,title,tag,sub="",spot="",swoosh=false;
  if(v.kind==="store"){eyebrow=`${esc(store.name)} × Sarah Griego Music`;
    if(S.tab==="bios"){title="Meet the Instructors";tag="in good hands"}
    else if(S.tab==="booked"){title="Booked Sessions";tag="see you soon"}
    else{title="Book a Get to Know Session";tag="the first one's on us";swoosh=true;
      const n=[...Array(14)].reduce((a,_,i)=>a+Object.keys(teachers).reduce((b,tt)=>b+freeFor(tt,addDays(TODAY,i)).length,0),0);
      spot=spotHTML(n,"open times","Next two weeks","With Sarah and Mitchell","Free, "+store.trialMins+" minutes")}
  } else if(v.kind==="teacher"){
    eyebrow=v.t.owner?"Sarah Griego Music · Lesson studio":"Lesson studio · Mitchell's room";
    if(S.screen==="students"&&S.sid){const s=cur();
      eyebrow=`Student · ${esc(s.instrument)}`;title=esc(s.name);tag="time to shed";
      sub=`<div class="facts">${v.t.owner?`<span>Teacher <b>${esc(teachers[s.teacher].short)}</b></span>`:""}<span>Lessons <b>${esc(slotText(s))}</b></span><span>Rate <b class="num">${money(s.rate)}</b>${isCustom(s)?" custom":""}</span><span>${owedOf(s)?`Owes <b class="num" style="color:var(--red-text)">${money(owedOf(s))}</b>`:"<b>Paid up</b>"}</span></div>`;
      spot=spotHTML(passedOf(s),"keys passed","Next due",nextDue(s)?esc(nextDue(s).title):"Nothing assigned",nextDue(s)?fmtLong(nextDue(s).due):"Add something under Repertoire.");
    } else if(S.screen==="students"){title=v.t.owner?"The Studio":"My Students";tag="who's on stage";spot=dueSpot(visible(),true)}
    else if(S.screen==="schedule"){title="Schedule";tag="on the books";
      const tid=v.t.owner?S.calT:v.t.id,nx=nextLesson(students.filter(s=>s.teacher===tid),tid),pend=requests.filter(r=>r.teacher===tid&&r.status==="pending").length;
      eyebrow=tid===v.t.id?eyebrow:"Lesson studio · Mitchell's schedule";
      spot=spotHTML(pend,pend===1?"request":"requests","Next lesson",nx?esc(nx.who)+(nx.remote?" · remote":""):"Nothing booked",nx?`${fmtLong(nx.date)} · ${fmtTime(nx.start)}`:"")}
    else if(S.screen==="review"){title="Year in Review";tag="look how far you've come";const R=periodRange(),rows=visible().map(x=>({x,r:reviewOf(x,R)})),tot=rows.reduce((a,b)=>a+b.r.keys.length,0),top=rows.slice().sort((a,b)=>b.r.keys.length-a.r.keys.length)[0];
      spot=spotHTML(tot,"keys passed","Biggest leap",top&&top.r.keys.length?esc(top.x.name):"Nothing yet",top&&top.r.keys.length?`${top.r.keys.length} new keys in ${R.label}`:"")}
    else if(S.screen==="payments"){title="Payments";tag="cha-ching";
      const rep=mine().flatMap(s=>s.lessons.filter(l=>l.status==="reported"));
      const un=mine().flatMap(s=>s.lessons.filter(l=>l.status==="unpaid"));
      spot=spotHTML(rep.length,"to confirm","Still unpaid",money(un.reduce((a,l)=>a+l.amount,0)),`${un.length} lesson${un.length===1?"":"s"} across ${new Set(mine().filter(s=>s.lessons.some(l=>l.status==="unpaid")).map(s=>s.id)).size} students`)}
    else {title="Settings";tag="make it yours";sub=`<p class="hero-sub">How students see you and pay you.</p>`}
  } else {
    const s=v.s;eyebrow="Lesson studio · Student portal";title=`Right on, ${esc(first(s.name))}!`;tag="keep shedding";swoosh=true;
    sub=`<div class="facts"><span>Teacher <b>${esc(teachers[s.teacher].name)}</b></span><span>Lessons <b>${esc(slotText(s))}</b></span><span>Scales passed <b class="num">${passedOf(s)} of ${TOTAL}</b></span></div>`;
    if(S.tab==="calendar"||S.tab==="dash"){const nx=nextLesson([s],s.teacher);
      spot=nx?spotHTML(daysBetween(TODAY,nx.date),daysBetween(TODAY,nx.date)===1?"day":daysBetween(TODAY,nx.date)===0?"today":"days",nx.extra?"Next up · extra lesson":"Next lesson"+(nx.remote?" · remote":""),fmtLong(nx.date),`${fmtTime(nx.start)} with ${esc(teachers[s.teacher].short)}`):spotHTML(null,"","Next lesson","Nothing scheduled","")}
    else if(S.tab==="year"){const R=periodRange(),r=reviewOf(s,R);spot=spotHTML(r.keys.length,"new keys","Your year",`${r.pieces.length} piece${r.pieces.length===1?"":"s"} finished`,`${r.lessons.length} lesson${r.lessons.length===1?"":"s"} with ${esc(teachers[s.teacher].short)}`)}
    else spot=dueSpot([s],false);
  }
  return `<div class="wrap">${clockSVG("clock",false)}<div class="hero-in">
    <div class="eyebrow"><i></i>${eyebrow}</div>
    <h1>${title}</h1>${swoosh?`<img class="swoosh" src="${SWOOSH}" alt="">`:""}
    <div><span class="tag">${tag}</span></div>${sub}${spot}</div></div>`;
}

/* ---------- scale grid ---------- */
function gridHTML(s,editable){
  const head=`<thead><tr><th class="rname" scope="col">Scale</th>${KEYS.map(k=>`<th scope="col">${k[0]}${k[1]?`<em>${k[1]}</em>`:""}</th>`).join("")}<th scope="col">Keys</th></tr></thead>`;
  const bodies=GROUPS.map((g,gi)=>{
    const done=g.ids.reduce((a,id)=>a+Object.values(s.grid[id]||{}).filter(c=>c.s==="p").length,0),tot=g.ids.length*12;
    const grp=`<tr class="grp"><th class="rname" scope="rowgroup">${g.name}</th><td colspan="12"><div class="gbar"><i style="width:${(done/tot*100).toFixed(1)}%"></i></div></td><td class="cnt num">${done}/${tot}</td></tr>`;
    const rows=g.ids.map((id,ri)=>{const row=s.grid[id]||{};let p=0;
      const cells=KEYS.map((_,ki)=>{const c=row[ki];if(c&&c.s==="p")p++;
        const cls=c?c.s:"",label=c&&c.s==="p"?fmtShort(c.d):"";
        const tip=`${g.rows[ri]} in ${KEYNAME[ki]}: ${c?(c.s==="p"?"passed "+fmt(c.d):"working since "+fmt(c.d)):"not started"}`;
        return editable?`<td><button class="cell ${cls}" data-cell="${id}|${ki}" title="${esc(tip)}" aria-label="${esc(tip)}"><span class="num">${label}</span></button></td>`
                       :`<td><div class="cell ${cls}" title="${esc(tip)}" role="img" aria-label="${esc(tip)}"><span class="num">${label}</span></div></td>`}).join("");
      return `<tr data-row="${id}" class="${p===12?"full":""}"><th class="rname" scope="row">${g.rows[ri]}${p===12?'<span class="ok">✓</span>':""}</th>${cells}<td class="cnt num">${p}/12</td></tr>`}).join("");
    return `<tbody class="g${gi}">${grp}${rows}</tbody>`}).join("");
  return `<p class="swipe-hint">Swipe the sheet sideways for all 12 keys →</p><div class="gridwrap"><table class="grid">${head}${bodies}</table></div>`;
}
const legend=`<div class="legend"><span><i class="sw"></i>Not started</span><span><i class="sw w"></i>Working</span><span><i class="sw p"></i>Passed, with the date</span></div>`;

/* ---------- teacher: roster ---------- */
function rosterHTML(){
  const v=viewer(),list=visible(),all=mine(),month=TODAY.slice(0,7);
  const unpaid=all.reduce((a,s)=>a+s.lessons.filter(l=>l.status==="unpaid").reduce((x,l)=>x+l.amount,0),0);
  const rep=all.reduce((a,s)=>a+s.lessons.filter(l=>l.status==="reported").length,0);
  const got=all.reduce((a,s)=>a+s.lessons.filter(l=>l.status==="paid"&&l.date.slice(0,7)===month).reduce((x,l)=>x+l.amount,0),0);
  const lm=all.reduce((a,s)=>a+s.lessons.filter(l=>l.date.slice(0,7)===month).length,0);
  const count=t=>all.filter(s=>t==="all"||s.teacher===t).length;
  const filters=v.t.owner?`<div class="stabs">${[["all","Everyone"],["sarah","Mine"],["mitchell","Mitchell's"]].map(([k,l])=>`<button class="stab" data-filter="${k}" aria-pressed="${S.filter===k}">${l}<small>${count(k)}</small></button>`).join("")}</div>`:"";
  const rows=list.length?list.map((s,j)=>{const o=owedOf(s),pend=s.lessons.some(l=>l.status==="reported"),nd=nextDue(s),pc=passedOf(s);
    return `<button class="srow" data-open="${s.id}" style="--j:${j}">
      <div><div class="name">${esc(s.name)} ${v.t.owner?`<span class="chip" style="--c:${s.teacher==="sarah"?"var(--acc)":"var(--acc2)"}">${esc(teachers[s.teacher].short)}</span>`:""}</div><div class="meta">${esc(s.instrument)}${s.regular?` · ${esc(slotText(s))}`:""}</div></div>
      <div class="hide-sm"><div class="meta num">Scales ${pc} of ${TOTAL} keys</div><div class="track-bar"><i style="width:${(pc/TOTAL*100).toFixed(1)}%"></i></div></div>
      <div class="hide-sm meta">${nd?`<span ${nd.due<TODAY?'class="late"':""}>Due ${fmtShort(nd.due)}</span> · ${esc(nd.title)}`:"No open assignments"}</div>
      <div class="owe">${o?`<b>${money(o)}</b>${pend?`<span class="pill reported">Check payment</span>`:`<span class="pill unpaid">Owed</span>`}`:`<span class="pill paid">Paid up</span>`}</div>
    </button>`}).join(""):`<div class="empty">No students here yet.</div>`;
  return `<div class="stack">
    <div class="scoreboard reveal" style="--i:0">
      <div class="score"><div class="k">Students</div><div class="v" data-count="${all.length}">${all.length}</div></div>
      <div class="score"><div class="k">Lessons this month</div><div class="v" data-count="${lm}">${lm}</div></div>
      <div class="score" style="--c:var(--red-text)"><div class="k">Unpaid</div><div class="v" data-count="${unpaid}" data-money>${money(unpaid)}</div></div>
      <div class="score" style="--c:var(--acc2)"><div class="k">To confirm</div><div class="v" data-count="${rep}">${rep}</div></div>
      <div class="score" style="--c:var(--good)"><div class="k">Received this month</div><div class="v" data-count="${got}" data-money>${money(got)}</div></div>
    </div>
    <div class="sheet reveal" style="--i:1">
      <div class="spread"><h3>Roster</h3><button class="btn primary" data-act="addStudent">Add student</button></div>
      ${filters}${importBox()}
      <div class="roster">${rows}</div>
    </div></div>`;
}

/* ---------- teacher: student page ---------- */
function studentHTML(){
  const s=cur();
  const tabs=[["scales","Scales",passedOf(s)],["rep","Repertoire",openRep(s).length],["lessons","Lessons & pay",s.lessons.length],["gc","Classroom",studentClasses(s).length?itemsFor(s).length:null],["yr","Year in review"],["info","Details"]];
  let inner="";
  if(S.tab==="scales")inner=`<div class="spread">${legend}<label class="markdate" for="markDate">Marking as of <input type="date" id="markDate" value="${S.markDate}"></label></div>
    <p class="small muted" style="margin:0">Tap a key to move it along: working, then passed. Another tap clears it.</p>${gridHTML(s,true)}`;
  if(S.tab==="rep")inner=repHTML(s,true);
  if(S.tab==="lessons")inner=lessonsHTML(s);
  if(S.tab==="info")inner=infoHTML(s);
  if(S.tab==="gc")inner=materialsHTML(s,false);
  return `<div class="stack">
    <div class="spread reveal" style="--i:0"><button class="back" data-act="back">← All students</button><button class="btn sm" data-viewas="${s.id}">See ${esc(first(s.name))}'s portal</button></div>
    <div class="stabs reveal" style="--i:0">${tabs.map(([k,l,c])=>`<button class="stab" data-tab="${k}" aria-current="${S.tab===k}">${l}${c!=null?`<small>${c}</small>`:""}</button>`).join("")}</div>
    ${S.tab==="yr"?reviewHTML(s,false):`<div class="sheet reveal" style="--i:1">${inner}</div>`}</div>`;
}
function repHTML(s,editable){
  const sorted=[...s.rep].sort((a,b)=>(a.status==="Done")-(b.status==="Done")||a.due.localeCompare(b.due));
  const form=editable&&S.form==="rep"?`<form class="form" data-form="rep">
      <div class="field full"><label for="rt">Repertoire</label><input id="rt" name="title" required placeholder="Tune, etude, or exercise"></div>
      <div class="field"><label for="rs">Section</label><input id="rs" name="section" placeholder="e.g. Measures 1-24"></div>
      <div class="field"><label for="ra">Assigned</label><input id="ra" type="date" name="assigned" value="${TODAY}"></div>
      <div class="field"><label for="rd">Due</label><input id="rd" type="date" name="due" value="${addDays(TODAY,7)}"></div>
      <div class="field full"><label for="rn">Notes</label><textarea id="rn" name="notes"></textarea></div>
      <div class="row full"><button class="btn primary" type="submit">Assign</button><button class="btn ghost" type="button" data-act="closeForm">Cancel</button></div></form>`:"";
  const items=sorted.length?sorted.map((r,j)=>{const late=r.status!=="Done"&&r.due<TODAY;
    return `<div class="item" style="--j:${j}"><div><div class="t">${esc(r.title)}</div>
      <div class="d">${r.section?esc(r.section)+" · ":""}Assigned ${fmt(r.assigned)} · <span class="${late?"late":""}">Due ${fmt(r.due)}${late?", past due":""}</span></div>
      ${r.notes?`<div class="n">${esc(r.notes)}</div>`:""}</div>
      <div class="side">${editable?`<select class="mini" data-repstatus="${r.id}" aria-label="Status for ${esc(r.title)}">${REP_STATUS.map(x=>`<option ${x===r.status?"selected":""}>${x}</option>`).join("")}</select>
        <button class="btn ghost sm" data-delrep="${r.id}">Remove</button>`:`<span class="pill ${r.status==="Done"?"paid":r.status==="Assigned"?"plain":"reported"}">${r.status}</span>`}</div></div>`}).join("")
    :`<div class="empty">${editable?"Nothing assigned yet.":"Nothing assigned right now."}</div>`;
  return `<div class="spread"><h3>Assigned repertoire</h3>${editable&&S.form!=="rep"?`<button class="btn sm" data-act="openRep">Assign repertoire</button>`:""}</div>${form}<div class="list">${items}</div>`;
}
function lessonsHTML(s){
  const form=S.form==="lesson"?`<form class="form" data-form="lesson">
      <div class="field"><label for="ld">Lesson date</label><input id="ld" type="date" name="date" value="${TODAY}"></div>
      <div class="field"><label for="la">Amount</label><input id="la" type="number" min="0" step="1" name="amount" value="${isFirstFree(s)?0:s.rate}"></div>${isFirstFree(s)?`<p class="small full" style="margin:0;color:var(--acc2)">First lesson for ${esc(first(s.name))}, so it's free (new student promo).</p>`:""}
      <div class="field full"><label for="ln">Notes</label><textarea id="ln" name="notes" placeholder="What you covered"></textarea></div>
      <div class="row full"><button class="btn primary" type="submit">Log lesson</button><button class="btn ghost" type="button" data-act="closeForm">Cancel</button></div></form>`:"";
  const items=[...s.lessons].sort((a,b)=>b.date.localeCompare(a.date)).map((l,j)=>`<div class="item" style="--j:${j}">
      <div><div class="t">${fmtLong(l.date)}</div>${l.notes?`<div class="n">${esc(l.notes)}</div>`:""}</div>
      <div class="side"><span class="amt">${money(l.amount)}</span>${statusPill(l)}${lessonActions(l)}</div></div>`).join("")||`<div class="empty">No lessons logged yet.</div>`;
  return `<div class="spread"><h3>Lessons</h3>${S.form==="lesson"?"":`<button class="btn sm" data-act="openLesson">Log a lesson</button>`}</div>${form}<div class="list">${items}</div>`;
}
function statusPill(l){
  if(l.status==="paid"&&l.method==="free")return `<span class="pill" style="--c:var(--acc2)">Free first lesson</span>`;
  if(l.status==="paid")return `<span class="pill paid">Paid · ${METHODS[l.method]||""}</span>`;
  if(l.status==="reported")return `<span class="pill reported">Sent by ${METHODS[l.method]}, not confirmed</span>`;
  return `<span class="pill unpaid">Unpaid</span>`;
}
function lessonActions(l){
  if(l.status==="reported")return `<div class="row"><button class="btn sm primary" data-confirm="${l.id}">Confirm received</button><button class="btn ghost sm" data-unpay="${l.id}">Not received</button></div>`;
  if(l.status==="unpaid")return `<select class="mini" data-markpaid="${l.id}" aria-label="Mark paid"><option value="">Mark paid…</option>${Object.entries(METHODS).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select>`;
  return l.method==="free"?"":`<button class="btn ghost sm" data-unpay="${l.id}">Undo</button>`;
}
function infoHTML(s){
  const v=viewer();
  return `<h3>Student details</h3><form class="form plain" data-form="info">
    <div class="field"><label for="iname">Student name</label><input id="iname" name="name" value="${esc(s.name)}"></div>
    <div class="field"><label for="iins">Instrument or focus</label><input id="iins" name="instrument" value="${esc(s.instrument)}"></div>
    <div class="field"><label for="iday">Lesson day</label><select id="iday" name="day"><option value="">Not set</option>${DOW_LONG.map((d,i)=>`<option value="${i}" ${s.regular&&s.regular.dow===i?"selected":""}>${d}s</option>`).join("")}</select></div>
    <div class="field"><label for="itime">Lesson time</label><input id="itime" type="time" name="time" value="${s.regular?toHM(s.regular.start):"16:00"}"></div>
    <div class="field"><label for="imins">Length</label><select id="imins" name="mins">${LENGTHS.map(m=>`<option value="${m}" ${lenOf(s)===m?"selected":""}>${m} min</option>`).join("")}</select></div>
    <div class="field"><label for="irate">Rate per lesson</label><input id="irate" type="number" min="0" name="rate" value="${s.rate}"></div>
    <div class="field"><label for="ig">Parent or guardian</label><input id="ig" name="guardian" value="${esc(s.guardian)}" placeholder="If under 18"></div>
    <div class="field"><label for="ie">Student's Google email</label><input id="ie" type="email" name="email" value="${esc(s.email)}" placeholder="Used to sign in and to match Classroom"></div>
    <div class="field"><label for="ige">Parent's Google email (optional)</label><input id="ige" type="email" name="guardianEmail" value="${esc(s.guardianEmail||"")}" placeholder="Can sign in and gets the emails too"></div>
    ${v.t.owner?`<div class="field"><label for="it">Teacher</label><select id="it" name="teacher">${Object.values(teachers).map(t=>`<option value="${t.id}" ${t.id===s.teacher?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>`:""}
    <div class="row full"><button class="btn primary" type="submit">Save details</button><button class="btn ghost" type="button" data-archive="${s.id}">${S.archiveArm===s.id?"Tap again to remove "+esc(first(s.name)):"Remove from roster"}</button></div></form>
    <p class="small muted" style="margin:0">Removing a student hides them and ends their sign-in. Their history stays in your backups.</p>`;
}

/* ---------- teacher: payments ---------- */
function paymentsHTML(){
  const v=viewer(),list=mine();
  const rows=st=>list.flatMap(s=>s.lessons.filter(l=>l.status===st).map(l=>({s,l}))).sort((a,b)=>a.l.date.localeCompare(b.l.date));
  const block=(arr,empty)=>arr.length?arr.map(({s,l},j)=>`<div class="item" style="--j:${j}">
      <div><div class="t">${esc(s.name)} ${v.t.owner?`<span class="chip" style="--c:${s.teacher==="sarah"?"var(--acc)":"var(--acc2)"}">${esc(teachers[s.teacher].short)}</span>`:""}</div><div class="d">Lesson ${fmtLong(l.date)} · ${daysBetween(l.date,TODAY)} days ago</div></div>
      <div class="side"><span class="amt">${money(l.amount)}</span>${statusPill(l)}${lessonActions(l)}</div></div>`).join(""):`<div class="empty">${empty}</div>`;
  const rep=rows("reported"),un=rows("unpaid");
  return `<div class="stack">
    <div class="sheet reveal" style="--i:0;--acc:#F2B544">
      <div class="spread"><h3>Sent by students, to confirm</h3><span class="muted small num">${money(rep.reduce((a,x)=>a+x.l.amount,0))}</span></div>
      <p class="small muted" style="margin:0">When a student taps “I've sent it”, the lesson waits here until you see the money in PayPal or Zelle.</p>
      <div class="list">${block(rep,"Nothing waiting on you.")}</div></div>
    <div class="sheet reveal" style="--i:1">
      <div class="spread"><h3>Unpaid lessons</h3><span class="muted small num">${money(un.reduce((a,x)=>a+x.l.amount,0))}</span></div>
      <div class="list">${block(un,"Everyone is paid up.")}</div></div></div>`;
}

/* ---------- teacher: settings ---------- */
function settingsHTML(){
  const v=viewer(),tid=v.t.owner?S.calT:v.t.id,t=teachers[tid],list=students.filter(x=>x.teacher===tid);
  const nCustom=list.filter(isCustom).length;
  return `<div class="stack">
    ${v.t.owner?`<div class="stabs reveal" style="--i:0">${[["sarah","My settings"],["mitchell","Mitchell's"]].map(([id,l])=>`<button class="stab" data-calt="${id}" aria-pressed="${tid===id}">${l}</button>`).join("")}</div>`:""}
    <div class="sheet reveal" style="--i:0"><h3>Standard rates</h3>
      <p class="small muted" style="margin:0">What a lesson costs by length. New students start here, and so does anyone without a custom rate.</p>
      <label class="item" for="ffree" style="border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div><div class="t">First lesson free for new students</div><div class="d">A new student's first lesson is logged at $0</div></div><div class="side"><span class="toggle"><input type="checkbox" id="ffree" data-firstfree ${t.firstFree?"checked":""}><i></i></span></div></label>
      <form class="form plain" data-form="rates"><div class="rate-grid full">${LENGTHS.map(m=>`<div class="field"><label for="rt${m}">${m===60?"1 hour":m+" min"} lesson</label><span class="money-in"><i>$</i><input id="rt${m}" type="number" min="0" step="1" name="r${m}" value="${t.rates[m]}"></span></div>`).join("")}</div>
      <div class="row full"><button class="btn primary" type="submit">Save standard rates</button></div></form></div>
    <div class="sheet reveal" style="--i:1"><div class="spread"><h3>Student rates</h3><span class="small muted">${nCustom} custom</span></div>
      <p class="small muted" style="margin:0">Change a rate here for a student who pays something different. New lessons use it; lessons already logged keep their amount.</p>
      <div class="list">${list.length?list.map((x,j)=>{const st=stdRate(x),c=x.rate!==st,m=lenOf(x);
        return `<div class="item" style="--j:${j}"><div><div class="t">${esc(x.name)}</div><div class="d">${esc(x.instrument)} · ${m} min lessons</div></div>
        <div class="side rate-side">${c?`<span class="pill reported">Custom · standard is ${money(st)}</span><button class="btn ghost sm" data-stdrate="${x.id}">Use standard</button>`:`<span class="pill plain">Standard</span>`}
          <span class="money-in"><i>$</i><input type="number" min="0" step="1" data-srate="${x.id}" value="${x.rate}" aria-label="Rate per lesson for ${esc(x.name)}"></span></div></div>`}).join(""):`<div class="empty">No students yet.</div>`}</div></div>
    ${classroomSheet(2)}
    ${storeSheet(2)}
    ${emailSheet()}
    ${backupSheet()}
    <div class="sheet reveal" style="--i:3"><h3>Payment details</h3>
      <p class="small muted" style="margin:0">Students see these when they pay.</p>
      <form class="form plain" data-form="settings">
        <div class="field"><label for="sn">Name students see</label><input id="sn" name="name" value="${esc(t.name)}"></div>
        <div class="field"><label for="sp">PayPal merchant ID or PayPal.me name</label><input id="sp" name="paypal" value="${esc(t.paypal)}"></div>
        <div class="field"><label for="sz">Zelle email or phone</label><input id="sz" name="zelle" value="${esc(t.zelle)}"></div>
        <div class="field"><label for="sne">Your email for notices</label><input id="sne" type="email" name="notify" value="${esc(t.notifyEmail||"")}" placeholder="Where requests and payments go"></div>
        <div class="row full"><button class="btn primary" type="submit">Save payment details</button></div></form></div></div>`;
}

/* ---------- student portal ---------- */
function portalHTML(){
  const s=viewer().s,t=teachers[s.teacher];
  const unpaid=s.lessons.filter(l=>l.status==="unpaid"),pend=s.lessons.filter(l=>l.status==="reported");
  const unTot=unpaid.reduce((a,l)=>a+l.amount,0);
  let bal;
  if(unpaid.length)bal=`<div class="balance due"><div><h3>You owe ${esc(t.short)}</h3><div class="amt num" data-count="${unTot}" data-money>${money(unTot)}</div><div class="small muted">${unpaid.length} lesson${unpaid.length>1?"s":""}${pend.length?` · ${pend.length} more waiting for ${esc(t.short)} to confirm`:""}</div></div>${S.pay?"":`<button class="btn primary" data-act="openPay">Pay now</button>`}</div>`;
  else if(pend.length)bal=`<div class="balance"><div><h3>Payment sent</h3><div class="amt num">${money(owedOf(s))}</div><div class="small muted">Waiting for ${esc(t.short)} to confirm it arrived.</div></div><span class="pill reported">Sent</span></div>`;
  else bal=`<div class="balance"><div><h3>Balance</h3><div class="amt num">$0</div><div class="small muted">You're all paid up. Thank you!</div></div><span class="pill paid">Paid up</span></div>`;
  let inner="";
  if(S.tab==="scales")inner=`<h3>Your scales</h3>${legend}${gridHTML(s,false)}`;
  if(S.tab==="assignments")inner=repHTML(s,false);
  if(S.tab==="materials")inner=materialsHTML(s,true);
  if(S.tab==="calendar")inner=`<div class="spread"><h3>${esc(t.short)}'s week</h3>${weekNav()}</div>${cancelPolicy(t)}${calLegend(true)}${calHTML(s.teacher,s.id)}<div class="detail">${detailHTML(s.teacher,true)}</div>`;
  const LCAP=8,allL=[...s.lessons].sort((a,b)=>b.date.localeCompare(a.date)),showL=S.allLessons?allL:allL.slice(0,LCAP);
  if(S.tab==="lessons")inner=`<h3>Lessons</h3><div class="list">${showL.map((l,j)=>`<div class="item" style="--j:${j}"><div><div class="t">${fmtLong(l.date)}</div>${l.notes?`<div class="n">${esc(l.notes)}</div>`:""}</div><div class="side"><span class="amt">${money(l.amount)}</span>${statusPill(l)}</div></div>`).join("")||`<div class="empty">No lessons yet.</div>`}</div>${allL.length>LCAP&&!S.allLessons?`<button class="btn" data-act="allLessons">Show all ${allL.length} lessons</button>`:""}`;
  const balSheet=`<div class="sheet reveal" style="--i:1">${bal}${S.pay?payHTML(s,t):""}</div>`;
  if(S.tab==="dash")return `<div class="stack">${noticesHTML(s)}${balSheet}${dashHTML(s)}</div>`;
  return `<div class="stack">${S.tab==="calendar"?noticesHTML(s):""}${S.tab==="lessons"?balSheet:""}
    ${S.tab==="year"?reviewHTML(s,true):`<div class="sheet reveal" style="--i:2">${inner}</div>`}${S.tab==="calendar"?subscribeSheet(3,tokenOf(s),"Lessons with "+t.short,"your lessons"):""}</div>`;
}
function payHTML(s,t){
  const unpaid=s.lessons.filter(l=>l.status==="unpaid");
  const sel=unpaid.filter(l=>S.pay.ids.includes(l.id)),total=sel.reduce((a,l)=>a+l.amount,0);
  const memo=`${s.name} lessons ${sel.map(l=>fmtShort(l.date)).join(", ")}`;
  const m=S.pay.method;let how="";
  if(m==="paypal")how=`<div class="stack" style="gap:10px"><div><a class="btn" href="${esc(payPalLink(t,total,memo))}" target="_blank" rel="noopener">Open PayPal for ${money(total)}</a></div>
      <div class="small muted">Opens PayPal with the amount and the note <b style="color:var(--paper)">${esc(memo)}</b> filled in. Pay with a card or your PayPal balance.</div></div>`;
  if(m==="zelle")how=`<div class="stack" style="gap:8px"><div class="small muted">In your bank's app, send with Zelle to:</div>
      <div class="copyline"><code>${esc(t.zelle)}</code><button class="btn sm" type="button" data-copy="${esc(t.zelle)}">Copy</button></div>
      <div class="small muted">Amount <b class="num" style="color:var(--paper)">${money(total)}</b> · Memo <b style="color:var(--paper)">${esc(memo)}</b></div></div>`;
  return `<div class="form" style="display:flex;flex-direction:column;gap:16px">
    <div class="spread"><h3>Pay for lessons</h3><button class="btn ghost sm" data-act="closePay">Close</button></div>
    <div class="checklist">${unpaid.map(l=>`<label><input type="checkbox" data-paypick="${l.id}" ${S.pay.ids.includes(l.id)?"checked":""}><span>${fmtLong(l.date)}</span><span class="muted num" style="margin-left:auto">${money(l.amount)}</span></label>`).join("")}</div>
    <div class="methods">
      <button class="method" data-method="paypal" aria-pressed="${m==="paypal"}"><b>PayPal</b><small>Card or PayPal balance</small></button>
      <button class="method" data-method="zelle" aria-pressed="${m==="zelle"}"><b>Zelle</b><small>From your bank's app, no fees</small></button>
    </div>${how}
    ${m&&total?`<div class="spread" style="border-top:1px solid var(--line);padding-top:14px"><span class="small muted">Once it's sent, let ${esc(t.short)} know.</span><button class="btn primary" data-act="reportPaid">I've sent ${money(total)}</button></div>`:""}
  </div>`;
}

/* ---------- schedule ---------- */
function slotText(s){const r=s.regular;if(!r)return"Not scheduled";return(r.every===2?"Every other "+DOW_LONG[r.dow]:DOW_LONG[r.dow]+"s")+" "+fmtTime(r.start)}
function buildRegular(d,prev){if(d.day===""||d.day==null)return null;const dow=+d.day,r={dow,start:hm(d.time||"16:00"),mins:+d.mins||60};
  if(prev&&prev.every===2&&prev.dow===dow){r.every=2;r.anchor=prev.anchor}return r}
function occurs(s,date){const r=s.regular;if(!r||dowOf(date)!==r.dow)return false;if(r.every===2){const w=Math.round(daysBetween(r.anchor,date)/7);return((w%2)+2)%2===0}return true}
const awayOn=(tid,date)=>teachers[tid].away.find(a=>date>=a.from&&date<=a.to);
const lenOf=s=>(s.regular&&s.regular.mins)||s.len||60;
const stdRate=s=>teachers[s.teacher].rates[lenOf(s)]||0;
const isCustom=s=>s.rate!==stdRate(s);
const payPalLink=(t,total,memo)=>/^[A-Z0-9]{10,16}$/.test(t.paypal)
  ?`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(t.paypal)}&amount=${total}&currency_code=USD&no_shipping=1&item_name=${encodeURIComponent(memo)}`
  :`https://paypal.me/${encodeURIComponent(t.paypal)}/${total}`;
const mailOn=(tid,k)=>!!(teachers[tid].email&&teachers[tid].email[k]);
const isFirstFree=s=>!!teachers[s.teacher].firstFree&&s.lessons.length===0;
const lessonStart=(date,min)=>new Date(date+"T"+toHM(min)+":00");
const hoursUntil=(date,min)=>(lessonStart(date,min)-Date.now())/36e5;
const gStamp=(date,min)=>date.replace(/-/g,"")+"T"+toHM(min).replace(":","")+"00";
function gcalLink(title,date,start,mins,details){return "https://calendar.google.com/calendar/render?"+new URLSearchParams({action:"TEMPLATE",text:title,dates:gStamp(date,start)+"/"+gStamp(date,start+mins),ctz:"America/New_York",details:details||""})}
const FEED_HOST=location.host;
const tokenOf=x=>(x&&x.calToken)||"";
function feedLinks(token,label){const https=`https://${FEED_HOST}/api/calendar/${token}.ics`,webcal=https.replace("https://","webcal://");
  return{https,apple:webcal,google:"https://calendar.google.com/calendar/render?cid="+encodeURIComponent(webcal),outlook:"https://outlook.live.com/calendar/0/addfromweb?url="+encodeURIComponent(https)+"&name="+encodeURIComponent(label)}}
function subscribeSheet(i,token,label,what){if(!token)return"";const f=feedLinks(token,label);
  return `<div class="sheet reveal" style="--i:${i};--acc:#7FB8E6"><h3>Add to your calendar</h3>
    <p class="small muted" style="margin:0">Subscribe once and ${what} stay up to date on your phone. Extra lessons, remote switches, cancellations and days off all update on their own.</p>
    <div class="calapps"><a class="btn sm" href="${esc(f.google)}" target="_blank" rel="noopener">Google Calendar</a><a class="btn sm" href="${esc(f.apple)}">Apple Calendar</a><a class="btn sm" href="${esc(f.outlook)}" target="_blank" rel="noopener">Outlook</a></div>
    <div class="copyline"><code>${esc(f.https)}</code><button class="btn sm" type="button" data-copy="${esc(f.https)}">Copy link</button></div>
    <p class="small muted" style="margin:0">Keep this link to yourself: anyone who has it can see the lesson times.</p></div>`}
const extraPrice=(s,mins)=>Math.round(s.rate*mins/((s.regular&&s.regular.mins)||60));
const TLIVE=["pending","accepted","enrolled"];
const LIVE=["pending","accepted","logged"];
function busyFor(tid,date){const out=[];
  students.filter(s=>s.teacher===tid&&occurs(s,date)&&!((S.sessions[s.id+"|"+date]||{}).mode==="cancelled")).forEach(s=>out.push([s.regular.start,s.regular.start+s.regular.mins]));
  requests.filter(r=>r.teacher===tid&&r.date===date&&LIVE.includes(r.status)).forEach(r=>out.push([r.start,r.start+r.mins]));
  trials.filter(x=>x.teacher===tid&&x.date===date&&TLIVE.includes(x.status)).forEach(x=>out.push([x.start,x.start+x.mins]));
  if(date===TODAY)out.push([0,Math.ceil((nowMin()+30)/30)*30]);
  return out}
function freeFor(tid,date){
  if(date<TODAY||awayOn(tid,date))return[];
  let blocks=teachers[tid].open.filter(b=>b.dow===dowOf(date)).map(b=>[b.start,b.end]);
  busyFor(tid,date).forEach(([bs,be])=>{blocks=blocks.flatMap(([a,b])=>be<=a||bs>=b?[[a,b]]:[[a,Math.min(bs,b)],[Math.max(be,a),b]].filter(([x,y])=>y>x))});
  return blocks.filter(([a,b])=>b-a>=30)}
function dayEvents(tid,date,sid){const ev=[],away=awayOn(tid,date);
  students.filter(s=>s.teacher===tid&&occurs(s,date)&&(!sid||s.id===sid)).forEach(s=>{const key=s.id+"|"+date,ses=S.sessions[key];
    ev.push({kind:away?"off":ses&&ses.mode==="cancelled"?"cancelled":(ses&&ses.mode==="remote"?"remote":"lesson"),start:s.regular.start,end:s.regular.start+s.regular.mins,s,key,date})});
  requests.filter(r=>r.teacher===tid&&r.date===date&&LIVE.includes(r.status)&&(!sid||r.studentId===sid)).forEach(r=>
    ev.push({kind:r.status==="pending"?"pending":"extra",start:r.start,end:r.start+r.mins,s:students.find(x=>x.id===r.studentId),key:r.id,date,r}));
  if(!sid||sid==="store")trials.filter(x=>x.teacher===tid&&x.date===date&&TLIVE.includes(x.status)).forEach(x=>
    ev.push({kind:x.status==="pending"?"trialp":"trial",start:x.start,end:x.start+x.mins,s:{name:x.name},key:x.id,date,t:x}));
  freeFor(tid,date).forEach(([a,b])=>ev.push({kind:"free",start:a,end:b,key:"free|"+date+"|"+a,date}));
  return ev.sort((a,b)=>a.start-b.start)}
const findEvent=(tid,date,key,sid)=>dayEvents(tid,date,sid).find(e=>e.key===key);
function nextLesson(list,tid){
  for(let i=0;i<60;i++){const d=addDays(TODAY,i);if(awayOn(tid,d))continue;
    const c=[];list.forEach(s=>{if(occurs(s,d)){const ses=S.sessions[s.id+"|"+d];if(ses&&ses.mode==="cancelled")return;c.push({date:d,start:s.regular.start,end:s.regular.start+s.regular.mins,who:s.name,remote:!!(ses&&ses.mode==="remote"),key:s.id+"|"+d,s})}});
    requests.filter(r=>r.teacher===tid&&r.date===d&&(r.status==="accepted"||r.status==="logged")&&list.some(s=>s.id===r.studentId)).forEach(r=>c.push({date:d,start:r.start,end:r.start+r.mins,who:students.find(s=>s.id===r.studentId).name,extra:true,remote:r.mode==="remote",key:r.id,r}));
    const ok=c.filter(x=>i>0||x.end>nowMin()).sort((a,b)=>a.start-b.start);if(ok.length)return ok[0]}
  return null}
const EVLABEL={trial:"Get to Know",trialp:"Get to Know, to confirm",lesson:"Lesson",remote:"Remote lesson",cancelled:"Cancelled",off:"Off, away",extra:"Extra lesson",pending:"Requested",free:"Open"};
function evText(e,sv){if(e.kind==="extra"&&e.r&&e.r.mode==="remote"&&S.as!=="store")return(sv?"":first(e.s.name)+" · ")+"Extra lesson, remote";if(e.kind==="free")return S.as==="store"?"Open · tap to book":sv?"Open · tap to request":"Open for extras";if(S.as==="store")return first(e.s.name)+" · "+(e.kind==="trial"?"Confirmed":"Booked");return(sv?"":first(e.s.name)+" · ")+EVLABEL[e.kind]}
function weekNav(){const end=addDays(S.week,6),f=d=>new Date(d+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  return `<div class="weeknav"><button class="btn sm" data-week="-7" aria-label="Previous week">‹</button><b>${f(S.week)} to ${f(end)}</b><button class="btn sm" data-week="7" aria-label="Next week">›</button>${S.week!==WS?`<button class="btn ghost sm" data-week="0">This week</button>`:""}</div>`}
function calLegend(sv){if(S.as==="store")return `<div class="legend">${[["free","Open"],["trialp","Booked, to confirm"],["trial","Confirmed"],["away","Away"]].map(([k,l])=>`<span><i class="sw ev-${k}"></i>${l}</span>`).join("")}</div>`;const it=[["lesson",sv?"Your lesson":"Lesson"],["remote","Remote"],["extra","Extra lesson"],["pending","Requested"],["cancelled","Cancelled"],...(sv?[]:[["trialp","Get to Know, to confirm"],["trial","Get to Know"]]),["free","Open for extras"],["away","Away"]];
  return `<div class="legend">${it.map(([k,l])=>`<span><i class="sw ev-${k}"></i>${l}</span>`).join("")}</div>`}
function calHTML(tid,sid){
  const sv=!!sid,days=[...Array(7)].map((_,i)=>addDays(S.week,i)),all=days.map(d=>dayEvents(tid,d,sid));
  let lo=9*60,hi=19*60;all.flat().forEach(e=>{lo=Math.min(lo,Math.floor(e.start/60)*60);hi=Math.max(hi,Math.ceil(e.end/60)*60)});
  const H=44,px=m=>(m-lo)/60*H,height=px(hi),hours=[];for(let m=lo;m<=hi;m+=60)hours.push(m);
  const selk=S.sel&&S.sel.key;let j=0;
  const head=`<div></div>`+days.map(d=>`<div class="cal-dh ${d===TODAY?"today":""}"><span>${DOW[dowOf(d)]}</span><b>${+d.slice(8)}</b>${awayOn(tid,d)?"<em>Away</em>":""}</div>`).join("");
  const col=(d,evs)=>{const a=awayOn(tid,d);let now="";
    if(d===TODAY){const m=nowMin();if(m>=lo&&m<=hi)now=`<i class="cal-now" style="top:${px(m)}px"></i>`}
    return `<div class="cal-col ${d===TODAY?"today":""} ${d<TODAY?"past":""}" style="height:${height}px">${a?`<div class="cal-away"><span>${esc(teachers[tid].short)} away${a.note?`<br><small>${esc(a.note)}</small>`:""}</span></div>`:""}${evs.map(e=>`<button class="ev ev-${e.kind} ${selk===e.key?"sel":""}" style="top:${px(e.start)+1}px;height:${Math.max(22,px(e.end)-px(e.start)-2)}px;--j:${j++}" data-ev="${esc(e.key)}" data-date="${d}" title="${esc(fmtTime(e.start)+" to "+fmtTime(e.end)+", "+evText(e,sv))}"><b>${fmtTime(e.start)}</b><span>${esc(evText(e,sv))}</span></button>`).join("")}${now}</div>`};
  const grid=`<div class="cal-scroll"><div class="cal" style="--hh:${H}px"><div class="cal-headrow">${head}</div>
    <div class="cal-bodyrow"><div class="cal-hours" style="height:${height}px">${hours.map(m=>`<span style="top:${px(m)}px">${fmtTime(m)}</span>`).join("")}</div>${days.map((d,i)=>col(d,all[i])).join("")}</div></div></div>`;
  j=0;
  const agenda=`<div class="agenda">${days.map((d,i)=>{const a=awayOn(tid,d),evs=all[i];
    return `<div class="ag-day"><div class="ag-date"><b>${fmtLong(d)}</b>${d===TODAY?'<span class="chip">Today</span>':""}</div>
      ${a?`<div class="ag-away">${esc(teachers[tid].short)} is away${a.note?": "+esc(a.note):""}</div>`:""}
      ${evs.length?evs.map(e=>`<button class="ag-ev ev-${e.kind} ${selk===e.key?"sel":""}" style="--j:${j++}" data-ev="${esc(e.key)}" data-date="${d}"><b>${fmtTime(e.start)} to ${fmtTime(e.end)}</b><span>${esc(evText(e,sv))}</span></button>`).join(""):(a?"":`<div class="ag-none">Nothing scheduled</div>`)}</div>`}).join("")}</div>`;
  return grid+agenda}
function requestRow(r,showAct){const s=students.find(x=>x.id===r.studentId);
  return `<div class="item" data-rq="${r.id}"><div><div class="t">${esc(s.name)}</div><div class="d">${fmtLong(r.date)} · ${fmtTime(r.start)} to ${fmtTime(r.start+r.mins)} · ${r.mins} min · about ${money(extraPrice(s,r.mins))}</div>${r.note?`<div class="n">“${esc(r.note)}”</div>`:""}
    ${showAct?`<div class="field" style="margin-top:8px"><label for="rp-${r.id}">Reply (optional)</label><input id="rp-${r.id}" data-reply placeholder="See you then!"></div>`:""}</div>
    <div class="side">${showAct?`<button class="btn sm primary" data-accept="${r.id}">Accept</button><button class="btn ghost sm" data-decline="${r.id}">Decline</button>`:""}</div></div>`}
function detailHTML(tid,sv){
  const t=teachers[tid];
  if(!S.sel)return `<p class="small muted" style="margin:0">${sv?`Tap an open time to ask ${esc(t.short)} for an extra lesson.`:"Tap a lesson to switch it between remote and in person. Tap a request to answer it."}</p>`;
  const e=findEvent(tid,S.sel.date,S.sel.key,sv?viewer().s.id:null);
  if(!e){S.sel=null;S.req=null;return detailHTML(tid,sv)}
  const when=`${fmtLong(e.date)} · ${fmtTime(e.start)} to ${fmtTime(e.end)}`,close=`<button class="btn ghost sm" data-clearsel>Close</button>`;
  if(e.kind==="free"){
    if(!sv)return `<div class="spread"><div><div class="dt">Open for extra lessons</div><div class="small muted">${when}. Students can request any part of this.</div></div>${close}</div>`;
    const s=viewer().s,r=S.req,starts=[];for(let m=e.start;m+30<=e.end;m+=15)starts.push(m);
    const lens=LENGTHS.filter(l=>r.start+l<=e.end);
    return `<form class="form" data-form="request" style="display:grid">
      <div class="spread full"><div><div class="dt">Request an extra lesson</div><div class="small muted">${fmtLong(e.date)} with ${esc(t.name)}</div></div>${close}</div>
      <div class="field"><label for="rqs">Start</label><select id="rqs" data-reqstart>${starts.map(m=>`<option value="${m}" ${m===r.start?"selected":""}>${fmtTime(m)}</option>`).join("")}</select></div>
      <div class="field"><label for="rqm">Length</label><select id="rqm" data-reqmins>${lens.map(l=>`<option value="${l}" ${l===r.mins?"selected":""}>${l} min</option>`).join("")}</select></div>
      <div class="field full"><label for="rqn">What do you want to work on?</label><textarea id="rqn" data-reqnote placeholder="Optional">${esc(r.note||"")}</textarea></div>
      <div class="spread full"><span class="small muted">${fmtTime(r.start)} to ${fmtTime(r.start+r.mins)} · ${isFirstFree(s)?`<b style="color:var(--acc2)">free, it's your first lesson</b>`:`billed like a regular lesson, about <b style="color:var(--paper)">${money(extraPrice(s,r.mins))}</b>`}</span><button class="btn primary" type="submit">Send request</button></div></form>`}
  if(e.kind==="trial"||e.kind==="trialp"){const x=e.t;
    return `<div class="spread"><div class="dt">Get to Know · ${esc(x.name)}</div>${close}</div>${trialRow(x,x.status==="pending")}
      ${x.status==="accepted"?`<div class="row"><button class="btn sm primary" data-tenroll="${x.id}">Add ${esc(first(x.name))} to the roster</button><button class="btn ghost sm" data-tcancel="${x.id}">Cancel it</button></div>`:x.status==="enrolled"?`<span class="pill paid">On the roster</span>`:""}`}
  if(e.kind==="off")return `<div class="spread"><div><div class="dt">${sv?"No lesson":esc(e.s.name)+", off"}</div><div class="small muted">${when}. ${esc(t.short)} is away${awayOn(tid,e.date).note?" ("+esc(awayOn(tid,e.date).note)+")":""}.</div></div>${close}</div>`;
  if(e.kind==="cancelled"){const ses=S.sessions[e.key];
    if(sv)return `<div class="spread"><div><div class="dt">Lesson cancelled</div><div class="small muted">${when}</div></div>${close}</div>${studentLessonActions(viewer().s,{date:e.date,start:e.start,end:e.end,key:e.key})}`;
    return `<div class="spread"><div><div class="dt">${esc(e.s.name)} cancelled</div><div class="small muted">${when} · cancelled ${ses.at?ago(ses.at):""}${ses.reason?` · “${esc(ses.reason)}”`:""}</div></div>${close}</div>
      <div class="row"><button class="btn sm" data-mode="inperson">Put the lesson back</button></div>`}
  if(e.kind==="lesson"||e.kind==="remote"){const ses=S.sessions[e.key],remote=e.kind==="remote";
    if(sv){const s0=viewer().s;return `<div class="spread"><div><div class="dt">Your ${remote?"remote ":""}lesson</div><div class="small muted">${when} with ${esc(t.name)}</div>${remote?`<div class="small" style="margin-top:6px">${ses.link?`Join: <a href="${esc(ses.link)}" target="_blank" rel="noopener">${esc(ses.link)}</a>`:`${esc(t.short)} will send the link.`}</div>`:""}</div>${close}</div>${studentLessonActions(s0,{date:e.date,start:e.start,end:e.end,key:e.key,remote})}`}
    return `<div class="spread"><div><div class="dt">${esc(e.s.name)}</div><div class="small muted">${when}</div></div>${close}</div>
      <div class="row"><div class="seg" role="group" aria-label="Lesson format"><button data-mode="inperson" aria-pressed="${!remote}">In person</button><button data-mode="remote" aria-pressed="${remote}">Remote</button></div></div>
      ${remote?`<div class="field"><label for="lnk">Video link</label><input id="lnk" data-link value="${esc(ses.link||"")}" placeholder="Paste a Zoom or Meet link"></div>`:""}
      <p class="small muted" style="margin:0">${ses&&ses.by==="student"?`${esc(first(e.s.name))} switched this to remote. Add the link so they get it.`:`${esc(first(e.s.name))} sees a heads-up in their portal when a lesson is remote.`}</p>`}
  if(e.kind==="pending"){
    if(sv)return `<div class="spread"><div><div class="dt">Request sent</div><div class="small muted">${when}. Waiting for ${esc(t.short)} to confirm.</div></div><div class="row"><button class="btn ghost sm" data-cancelreq="${e.r.id}">Cancel request</button>${close}</div></div>`;
    return `<div class="spread"><div class="dt">Extra lesson request</div>${close}</div><div class="list">${requestRow(e.r,true)}</div>`}
  if(e.kind==="extra"){
    if(sv){const s0=viewer().s;return `<div class="spread"><div><div class="dt">Extra lesson confirmed${e.r.mode==="remote"?", remote":""}</div><div class="small muted">${when} with ${esc(t.name)}</div>${e.r.reply?`<div class="n small" style="margin-top:6px">“${esc(e.r.reply)}”</div>`:""}</div>${close}</div>${studentLessonActions(s0,{date:e.date,start:e.start,end:e.end,key:e.r.id,remote:e.r.mode==="remote",extra:true,r:e.r})}`}
    return `<div class="spread"><div><div class="dt">Extra lesson · ${esc(e.s.name)}</div><div class="small muted">${when} · about ${money(extraPrice(e.s,e.r.mins))}</div></div>${close}</div>
      <div class="row">${e.r.status==="logged"?`<span class="pill paid">Logged on Lessons & pay</span>`:`<button class="btn sm primary" data-logextra="${e.r.id}">Log as lesson</button>`}<button class="btn ghost sm" data-cancelextra="${e.r.id}">Cancel it</button></div>`}
  return ""}
function awayHTML(tid){const t=teachers[tid],list=[...t.away].sort((a,b)=>a.from.localeCompare(b.from));
  const hit=a=>{let n=0;for(let d=a.from;d<=a.to;d=addDays(d,1))n+=students.filter(s=>s.teacher===tid&&occurs(s,d)).length;return n};
  return `<h3>Away dates</h3><p class="small muted" style="margin:0">Students with a lesson in these dates get a heads-up, and their open times disappear.</p>
    <div class="list">${list.length?list.map(a=>`<div class="item"><div><div class="t">${rangeText(a.from,a.to)}</div><div class="d">${a.note?esc(a.note)+" · ":""}${hit(a)} lesson${hit(a)===1?"":"s"} off</div></div><div class="side"><button class="btn ghost sm" data-delaway="${tid}|${a.id}">Remove</button></div></div>`).join(""):`<div class="empty">No time away planned.</div>`}</div>
    <form class="form" data-form="away"><div class="field"><label for="af">From</label><input id="af" type="date" name="from" required value="${TODAY}"></div><div class="field"><label for="at">To</label><input id="at" type="date" name="to" required value="${TODAY}"></div>
    <div class="field full"><label for="an">Note for students</label><input id="an" name="note" placeholder="e.g. Clinic travel"></div><div class="full"><button class="btn primary" type="submit">Add away dates</button></div></form>`}
function openHTML(tid){const t=teachers[tid],list=t.open.map((b,i)=>({...b,i})).sort((a,b)=>a.dow-b.dow||a.start-b.start);
  return `<h3>Open for extra lessons</h3><p class="small muted" style="margin:0">Students see these times, minus anything already booked.</p>
    <div class="list">${list.length?list.map(b=>`<div class="item"><div><div class="t">${DOW_LONG[b.dow]}s</div><div class="d">${fmtTime(b.start)} to ${fmtTime(b.end)}</div></div><div class="side"><button class="btn ghost sm" data-delopen="${tid}|${b.i}">Remove</button></div></div>`).join(""):`<div class="empty">No open times yet.</div>`}</div>
    <form class="form" data-form="open"><div class="field"><label for="od">Day</label><select id="od" name="day">${DOW_LONG.map((d,i)=>`<option value="${i}">${d}s</option>`).join("")}</select></div>
    <div class="field"><label for="os">From</label><input id="os" type="time" name="start" value="10:00" required></div><div class="field"><label for="oe">To</label><input id="oe" type="time" name="end" value="12:00" required></div>
    <div class="full"><button class="btn primary" type="submit">Add open time</button></div></form>`}
function scheduleHTML(){const v=viewer(),tid=v.t.owner?S.calT:v.t.id,pend=requests.filter(r=>r.teacher===tid&&r.status==="pending").sort((a,b)=>a.date.localeCompare(b.date));
  const pc=id=>requests.filter(r=>r.teacher===id&&r.status==="pending").length;
  return `<div class="stack">
    ${v.t.owner?`<div class="stabs reveal" style="--i:0">${[["sarah","My schedule"],["mitchell","Mitchell's"]].map(([id,l])=>`<button class="stab" data-calt="${id}" aria-pressed="${tid===id}">${l}${pc(id)?`<small>${pc(id)} new</small>`:""}</button>`).join("")}</div>`:""}
    ${trials.filter(x=>x.teacher===tid&&x.status==="pending").length?`<div class="sheet reveal" style="--i:0;--acc:#E9DDB0"><div class="spread"><h3>Get to Know sessions from ${esc(store.name)}</h3><span class="muted small">${trials.filter(x=>x.teacher===tid&&x.status==="pending").length} to confirm</span></div><div class="list">${trials.filter(x=>x.teacher===tid&&x.status==="pending").map(x=>trialRow(x,true)).join("")}</div></div>`:""}
    ${pend.length?`<div class="sheet reveal" style="--i:0;--acc:#F2B544"><div class="spread"><h3>Extra lesson requests</h3><span class="muted small">${pend.length} waiting</span></div><div class="list">${pend.map(r=>requestRow(r,true)).join("")}</div></div>`:""}
    <div class="sheet reveal" style="--i:1"><div class="spread"><h3>The week</h3>${weekNav()}</div>${calLegend(false)}${calHTML(tid,null)}<div class="detail">${detailHTML(tid,false)}</div></div>
    <div class="two reveal" style="--i:2"><div class="sheet" style="--acc:#9A948A">${awayHTML(tid)}</div><div class="sheet" style="--acc:#6FCF8E">${openHTML(tid)}</div></div>${subscribeSheet(3,tokenOf(teachers[tid]),teachers[tid].short+"'s teaching",tid===v.t.id?"your lessons, Get to Know sessions and days off":teachers[tid].short+"'s lessons")}</div>`}

/* ---------- student: cancel, switch to remote, add to calendar ---------- */
// x: {date,start,end,key,remote,extra,r}
function studentLessonActions(s,x){
  const t=teachers[s.teacher],h=hoursUntil(x.date,x.start),cancelled=!x.extra&&(S.sessions[x.key]||{}).mode==="cancelled";
  const reach=`<div class="reach">Sick, or something came up? Reach out to ${esc(t.short)} directly: <code>${esc(t.phone||t.zelle)}</code><button class="btn ghost sm" type="button" data-copy="${esc(t.phone||t.zelle)}">Copy</button></div>`;
  if(h<0)return "";
  if(cancelled)return `<p class="small" style="margin:0;color:var(--red-text)">You cancelled this lesson.</p>${h>=24?`<div class="row"><button class="btn sm" data-sundo="${x.key}">Keep the lesson after all</button></div>`:""}`;
  const title=x.extra?`Extra lesson with ${t.name}`:`Lesson with ${t.name}`,mins=x.end-x.start;
  const link=x.extra?"":((S.sessions[x.key]||{}).link||"");
  return `<div class="row">
      <a class="btn sm" href="${esc(gcalLink(title,x.date,x.start,mins,x.remote?(link?"Remote lesson: "+link:"Remote lesson. Link to come."):"Sarah Griego Lesson Studio"))}" target="_blank" rel="noopener">Add to Google Calendar</a>
      ${x.remote?"":`<button class="btn sm" data-sremote="${x.key}">Switch to remote</button>`}
      ${h>=24?`<button class="btn ghost sm" data-scancel="${x.key}" style="${S.cancelArm===x.key?"color:var(--red-text)":""}">${S.cancelArm===x.key?"Tap again to cancel":"Cancel this lesson"}</button>`:""}</div>
    ${h<24?`<p class="small muted" style="margin:0">It's less than 24 hours away, so it can't be cancelled here. You can still switch to remote.</p>`:""}
    ${reach}`}
function cancelPolicy(t){return `<p class="policy"><b>Need to cancel?</b> You can cancel up to 24 hours before a lesson. After that, you can switch to remote instead. Sick or an emergency? Reach out to ${esc(t.short)} directly.</p>`}

/* ---------- music store portal ---------- */
function trialRow(x,act){
  return `<div class="item" data-rq="${x.id}"><div><div class="t">${esc(x.name)}${x.age?` <span class="small muted">· age ${esc(x.age)}</span>`:""}</div>
    <div class="d">${fmtLong(x.date)} · ${fmtTime(x.start)} to ${fmtTime(x.start+x.mins)} · ${esc(x.instrument)} · booked by ${esc(x.bookedBy||store.name)} at ${esc(store.name)}</div>
    <div class="d">${x.guardian?esc(x.guardian)+" · ":""}${esc(x.email)}${x.phone?" · "+esc(x.phone):""}</div>${x.note?`<div class="n">“${esc(x.note)}”</div>`:""}
    ${act?`<div class="field" style="margin-top:8px"><label for="rp-${x.id}">Note to the family (optional)</label><input id="rp-${x.id}" data-reply placeholder="Looking forward to meeting you!"></div>`:""}</div>
    <div class="side">${act?`<button class="btn sm primary" data-taccept="${x.id}">Confirm</button><button class="btn ghost sm" data-tdecline="${x.id}">Can't make it</button>`:`<span class="pill ${x.status==="declined"||x.status==="cancelled"?"unpaid":x.status==="pending"?"reported":"paid"}">${TSTATUS[x.status]}</span>`}</div></div>`}
const TSTATUS={pending:"Waiting to confirm",accepted:"Confirmed",enrolled:"Now a student",declined:"Declined",cancelled:"Cancelled"};
function storeHTML(){const tid=S.storeT,t=teachers[tid];
  if(S.tab==="bios")return `<div class="stack">${Object.values(teachers).map((x,i)=>`<div class="sheet reveal" style="--i:${i}"><div class="bio"><figure><img src="${x.photo}" alt="${esc(x.name)}">${x.photoCredit?`<figcaption>${esc(x.photoCredit)}</figcaption>`:""}</figure>
    <div><h2>${esc(x.name)}</h2><div class="teaches">${x.teaches.map(esc).join(" · ")}</div>${x.bio.map(pp=>`<p>${esc(pp)}</p>`).join("")}
    <div class="row" style="margin-top:6px"><button class="btn primary" data-storet="${x.id}">Book a Get to Know with ${esc(x.short)}</button></div></div></div></div>`).join("")}</div>`;
  if(S.tab==="booked"){const list=[...trials].sort((a,b)=>b.createdAt-a.createdAt);
    return `<div class="sheet reveal" style="--i:0"><div class="spread"><h3>Get to Know sessions booked through ${esc(store.name)}</h3><span class="small muted">${list.length}</span></div>
      <div class="list">${list.length?list.map(x=>trialRow(x,false).replace('<div class="t">',`<div class="t"><span class="chip" style="--c:${x.teacher==="sarah"?"var(--acc)":"var(--acc2)"}">${esc(teachers[x.teacher].short)}</span> `)).join(""):`<div class="empty">Nothing booked yet.</div>`}</div></div>`}
  return `<div class="stack">
    <div class="pickers reveal" style="--i:0">${Object.values(teachers).map(x=>`<button class="picker" data-storet="${x.id}" aria-pressed="${tid===x.id}"><img src="${x.photo}" alt=""><span><b>${esc(x.name)}</b><small>${x.teaches.map(esc).join(" · ")}</small></span></button>`).join("")}</div>
    <div class="sheet reveal" style="--i:1"><div class="spread"><h3>${esc(t.short)}'s open times</h3>${weekNav()}</div>
      <p class="small muted" style="margin:0">Get to Know sessions are ${store.trialMins} minutes and free. Tap a green open time, then add the student's details. ${esc(t.short)} confirms with the family by email.</p>
      ${calLegend(true)}${calHTML(tid,"store")}<div class="detail">${storeDetail(tid)}</div>
      <p class="small muted" style="margin:0"><button class="linkish" data-goto="bios">Read ${esc(t.short)}'s bio</button></p></div></div>`}
function storeDetail(tid){const t=teachers[tid];
  if(!S.sel)return `<p class="small muted" style="margin:0">Tap an open time to book a Get to Know session with ${esc(t.short)}.</p>`;
  const e=findEvent(tid,S.sel.date,S.sel.key,"store");
  if(!e){S.sel=null;S.book=null;return storeDetail(tid)}
  const close=`<button class="btn ghost sm" data-clearsel>Close</button>`;
  if(e.kind==="trial"||e.kind==="trialp")return `<div class="spread"><div class="dt">Get to Know: ${esc(e.t.name)}</div>${close}</div><div class="list">${trialRow(e.t,false)}</div>${e.t.status==="pending"?`<div class="row"><button class="btn ghost sm" data-tcancel="${e.t.id}">Cancel this booking</button></div>`:""}`;
  if(e.kind!=="free")return "";
  const b=S.book,starts=[];for(let m=e.start;m+store.trialMins<=e.end;m+=15)starts.push(m);
  return `<form class="form" data-form="trial" style="display:grid">
    <div class="spread full"><div><div class="dt">Book a Get to Know with ${esc(t.name)}</div><div class="small muted">${fmtLong(e.date)} · ${store.trialMins} minutes · free</div></div>${close}</div>
    <div class="field"><label for="ts">Start</label><select id="ts" name="start">${starts.map(m=>`<option value="${m}" ${m===b.start?"selected":""}>${fmtTime(m)}</option>`).join("")}</select></div>
    <div class="field"><label for="ti">Instrument or subject</label><select id="ti" name="instrument">${t.teaches.map(x=>`<option>${esc(x)}</option>`).join("")}</select></div>
    <div class="field"><label for="tn">Student's name</label><input id="tn" name="name" required></div>
    <div class="field"><label for="ta">Age or grade</label><input id="ta" name="age" placeholder="e.g. 11, or 6th grade"></div>
    <div class="field"><label for="tg">Parent or guardian</label><input id="tg" name="guardian" placeholder="If under 18"></div>
    <div class="field"><label for="te">Email for the confirmation</label><input id="te" type="email" name="email" required></div>
    <div class="field"><label for="tp">Phone (optional)</label><input id="tp" type="tel" name="phone"></div>
    <div class="field"><label for="tb">Booked by</label><input id="tb" name="bookedBy" placeholder="Your name"></div>
    <div class="field full"><label for="tno">Anything ${esc(t.short)} should know?</label><textarea id="tno" name="note" placeholder="Experience, goals, renting an instrument from the store…"></textarea></div>
    <div class="spread full"><span class="small muted">The family gets an email once ${esc(t.short)} confirms.</span><button class="btn primary" type="submit">Book it</button></div></form>`}
function storeSheet(i){const v=viewer();if(!v.t.owner)return"";const link=`${location.origin}/store/${store.code}`;
  return `<div class="sheet reveal" style="--i:${i};--acc:#E9DDB0"><h3>Music store portal</h3>
    <p class="small muted" style="margin:0">A private link for the store: your bios, your open times, and a form to book free Get to Know sessions. The store never sees your students or lessons.</p>
    <form class="form plain" data-form="store">
      <div class="field"><label for="stn">Store name</label><input id="stn" name="name" value="${esc(store.name)}"></div>
      <div class="field"><label for="ste">Store email for confirmations (optional)</label><input id="ste" type="email" name="email" value="${esc(store.email)}"></div>
      <div class="field"><label for="stm">Session length</label><select id="stm" name="mins">${LENGTHS.map(m=>`<option value="${m}" ${store.trialMins===m?"selected":""}>${m} min</option>`).join("")}</select></div>
      <div class="row full"><button class="btn primary" type="submit">Save</button></div></form>
    <div class="copyline"><code>${esc(link)}</code><button class="btn sm" type="button" data-copy="${esc(link)}">Copy link</button><button class="btn ghost sm" type="button" data-storecode>Make a new link</button></div>
    <p class="small muted" style="margin:0">Making a new link turns the old one off.</p></div>`}

/* ---------- student dashboard ---------- */
function dashHTML(s){
  const due=openRep(s).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3),pc=passedOf(s);
  const cells=st=>SCALE_IDS.flatMap(id=>Object.entries(s.grid[id]||{}).filter(([,c])=>c.s===st).map(([ki,c])=>({id,ki:+ki,d:c.d})));
  const passes=cells("p").sort((a,b)=>b.d.localeCompare(a.d)).slice(0,4),working=cells("w").slice(0,4);
  const news=classroom.connected?itemsFor(s).slice().sort((a,b)=>b.posted.localeCompare(a.posted)).slice(0,3):[];
  const more=(tab,l)=>`<button class="linkish small" data-goto="${tab}">${l}</button>`;
  const nx=nextLesson([s],s.teacher),tt=teachers[s.teacher];
  const nextSheet=`<div class="sheet reveal" style="--i:2"><h3>Your next lesson</h3>${nx?`<div class="next"><div><div class="when">${fmtLong(nx.date)} · ${fmtTime(nx.start)}</div><div class="small muted">${nx.extra?"Extra lesson":"Lesson"} with ${esc(tt.name)}${nx.remote?" · remote":""}</div></div></div>${studentLessonActions(s,nx)}`:`<div class="empty">Nothing scheduled yet.</div>`}</div>`;
  return nextSheet+`<div class="yr-two reveal" style="--i:2">
    <div class="sheet"><div class="spread"><h3>Due next</h3>${more("assignments","All assignments")}</div>
      ${due.length?`<div class="list">${due.map(r=>{const late=r.due<TODAY;return `<div class="item"><div><div class="t">${esc(r.title)}</div><div class="d">${r.section?esc(r.section)+" · ":""}<span class="${late?"late":""}">Due ${fmtLong(r.due)}${late?", past due":""}</span></div></div><div class="side"><span class="pill ${r.status==="Assigned"?"plain":"reported"}">${r.status}</span></div></div>`}).join("")}</div>`:`<div class="empty">Nothing due right now.</div>`}</div>
    <div class="sheet"><div class="spread"><h3>Scale sheet</h3>${more("scales","Open")}</div>
      <div><div class="small muted num">${pc} of ${TOTAL} keys passed</div><div class="track-bar"><i style="width:${(pc/TOTAL*100).toFixed(1)}%"></i></div></div>
      ${working.length?`<div class="small"><span class="muted">Working on:</span> ${working.map(w=>`${ROWNAME[w.id]} in ${KEYNAME[w.ki]}`).join(", ")}</div>`:""}
      ${passes.length?`<div class="list">${passes.map(p=>`<div class="item"><div><div class="t">${ROWNAME[p.id]} in ${KEYNAME[p.ki]}</div></div><div class="side"><span class="pill paid">Passed ${fmtShort(p.d)}</span></div></div>`).join("")}</div>`:`<div class="empty">Keys you pass show up here.</div>`}</div></div>
    ${news.length?`<div class="sheet reveal" style="--i:3;--acc:#6FCF8E"><div class="spread"><h3>New in Classroom</h3>${more("materials","All materials")}</div>
      <div class="list">${news.map(i=>`<div class="item mat"><div><div class="t"><a href="${esc(i.link||CLASSROOM_URL)}" target="_blank" rel="noopener">${esc(i.title)}</a></div><div class="d">${i.kind==="assignment"?"Assignment":"Material"} · ${esc(i.topic)} · posted ${fmtLong(i.posted)}</div></div><div class="side"><a class="btn sm" href="${esc(i.link||CLASSROOM_URL)}" target="_blank" rel="noopener">Open ↗</a></div></div>`).join("")}</div></div>`:""}`}

/* ---------- year in review ---------- */
function periodRange(){const y=TODAY.slice(0,4);
  if(S.period==="r12")return{key:"r12",from:addDays(TODAY,-364),to:TODAY,label:"the last 12 months",own:"last 12 months"};
  if(S.period==="sy"){const m=+TODAY.slice(5,7),sy=m>=8?+y:+y-1;return{key:"sy",from:`${sy}-08-01`,to:TODAY,label:`the ${sy}–${String(sy+1).slice(2)} school year`,own:`${sy}–${String(sy+1).slice(2)} school year`}}
  return{key:"y",from:`${y}-01-01`,to:TODAY,label:y,own:y}}
const noteKey=R=>R.key+R.from;
function reviewOf(s,R){
  const inR=d=>!!d&&d>=R.from&&d<=R.to,lessons=s.lessons.filter(l=>inR(l.date)),keys=[],tests=[];
  GROUPS.forEach(g=>g.ids.forEach((id,ri)=>Object.entries(s.grid[id]||{}).forEach(([ki,c])=>{if(c.s==="p"&&inR(c.d))(g.test?tests:keys).push({id,ki:+ki,d:c.d,name:g.rows[ri]})})));
  const completed=[];SCALE_IDS.forEach(id=>{const ps=Object.values(s.grid[id]||{}).filter(c=>c.s==="p");if(ps.length===12){const last=ps.map(c=>c.d).sort().pop();if(inR(last))completed.push({name:ROWNAME[id],d:last})}});
  const pieces=s.rep.filter(r=>r.status==="Done"&&inR(r.done||r.due)).map(r=>({...r,d:r.done||r.due})).sort((a,b)=>a.d.localeCompare(b.d));
  const step=7*((s.regular&&s.regular.every)||1),wk=[...new Set(lessons.map(l=>weekStart(l.date)))].sort();let best=0,run=0,prev=null;
  wk.forEach(w=>{run=prev&&daysBetween(prev,w)<=step?run+1:1;best=Math.max(best,run);prev=w});
  const months=[];let m=R.from.slice(0,7);while(m<=R.to.slice(0,7)){months.push(m);const[yy,mm]=m.split("-").map(Number);m=mm===12?`${yy+1}-01`:`${yy}-${pad(mm+1)}`}
  const byMonth=months.map(mo=>({mo,keys:keys.filter(k=>k.d.slice(0,7)===mo).length,lessons:lessons.filter(l=>l.date.slice(0,7)===mo).length}));
  const fams=GROUPS.filter(g=>!g.test).map(g=>{let before=0,gained=0;g.ids.forEach(id=>Object.values(s.grid[id]||{}).forEach(c=>{if(c.s!=="p")return;if(c.d<R.from)before++;else if(c.d<=R.to)gained++}));return{name:g.name,before,gained,total:g.ids.length*12}});
  const hl=[];
  completed.forEach(c=>hl.push({d:c.d,c:"var(--acc)",t:`Played ${c.name} in all 12 keys`}));
  tests.forEach(x=>hl.push({d:x.d,c:"var(--acc2)",t:`Passed the ${x.name.replace(" test","")} scale test in ${KEYNAME[x.ki]}`}));
  pieces.forEach(p=>hl.push({d:p.d,c:"var(--good)",t:`Finished ${p.title}`,sub:p.section}));
  const allPass=SCALE_IDS.flatMap(id=>Object.values(s.grid[id]||{}).filter(c=>c.s==="p").map(c=>c.d)).sort();
  [25,50,100,150,200,250].forEach(n=>{if(allPass[n-1]&&inR(allPass[n-1]))hl.push({d:allPass[n-1],c:"var(--paper)",t:`Passed key number ${n}`})});
  lessons.filter(l=>/^Extra lesson/.test(l.notes)).forEach(l=>hl.push({d:l.date,c:"var(--remote)",t:"Took an extra lesson"}));
  hl.sort((a,b)=>a.d.localeCompare(b.d));
  return{lessons,keys,tests,completed,pieces,streak:best,hours:Math.round(lessons.length*lenOf(s)/60),byMonth,fams,hl}}
function monthChart(by,label){
  const max=Math.max(1,...by.map(b=>b.keys)),peak=by.reduce((a,b)=>b.keys>a.keys?b:a,by[0]),mn=mo=>new Date(mo+"-15T12:00").toLocaleDateString("en-US",{month:"short"});
  return `<div class="mchart"><div class="mbars" style="--n:${by.length}" aria-hidden="true">${by.map((b,k)=>`<div class="mcol" tabindex="0" style="--k:${k}">
      <div class="mbar-wrap">${b.keys?`<i class="mbar" style="height:${(b.keys/max*100).toFixed(1)}%">${b===peak?`<em>${b.keys}</em>`:""}</i>`:""}</div>
      <div class="mlab">${mn(b.mo)}</div><div class="mles">${b.lessons||"·"}</div>
      <span class="mtip">${mn(b.mo)}: ${b.keys} key${b.keys===1?"":"s"} passed · ${b.lessons} lesson${b.lessons===1?"":"s"}</span></div>`).join("")}</div>
    <div class="mfoot"><span><i></i>Keys passed</span><span>Number under each month: lessons</span></div>
    <table class="sr-only"><caption>${esc(label)}</caption><tr><th>Month</th><th>Keys passed</th><th>Lessons</th></tr>${by.map(b=>`<tr><td>${mn(b.mo)}</td><td>${b.keys}</td><td>${b.lessons}</td></tr>`).join("")}</table></div>`}
function reviewHTML(s,sv){
  const R=periodRange(),r=reviewOf(s,R),t=teachers[s.teacher],fn=esc(first(s.name)),note=(s.yrNotes||{})[noteKey(R)]||"";
  const chips=`<div class="stabs">${[["y",TODAY.slice(0,4)],["sy","School year"],["r12","Last 12 months"]].map(([k,l])=>`<button class="stab" data-period="${k}" aria-pressed="${R.key===k}">${l}</button>`).join("")}</div>`;
  const stat=(k,v,c)=>`<div class="score"${c?` style="--c:${c}"`:""}><div class="k">${k}</div><div class="v" data-count="${v}">${v}</div></div>`;
  const sum=r.lessons.length?`${r.lessons.length} lesson${r.lessons.length===1?"":"s"} with ${esc(t.short)}, ${r.keys.length} new key${r.keys.length===1?"":"s"} on the scale sheet, and ${r.pieces.length} piece${r.pieces.length===1?"":"s"} finished.`:`No lessons logged in ${esc(R.label)} yet.`;
  const byM={};r.hl.forEach(h=>{const k=h.d.slice(0,7);(byM[k]=byM[k]||[]).push(h)});
  const tl=r.hl.length?`<div class="tl">${Object.entries(byM).map(([mo,hs])=>`<div class="tl-m">${new Date(mo+"-15T12:00").toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>${hs.map(h=>`<div class="tl-i" style="--c:${h.c}"><span>${esc(h.t)}</span>${h.sub?`<small>${esc(h.sub)}</small>`:""}<small>${fmtShort(h.d)}</small></div>`).join("")}`).join("")}</div>`:`<div class="empty">Highlights show up here as scales get passed and pieces get finished.</div>`;
  const fams=`<div class="flegend"><span><i style="background:#5A5650"></i>Before ${esc(R.label)}</span><span><i style="background:var(--acc)"></i>New in ${esc(R.label)}</span></div>
    <div class="fams">${r.fams.map(f=>`<div class="fam"><span>${f.name}</span><div class="fam-track" role="img" aria-label="${f.name}: ${f.before} before, ${f.gained} new, of ${f.total}">${f.before?`<i class="fam-b" style="width:${f.before/f.total*100}%"></i>`:""}${f.gained?`<i class="fam-g" style="width:${f.gained/f.total*100}%"></i>`:""}</div><span class="n">${f.gained?`<b>+${f.gained}</b> · `:""}${f.before+f.gained}/${f.total}</span></div>`).join("")}</div>`;
  const pieces=r.pieces.length?`<div class="list">${r.pieces.map(p=>`<div class="item"><div><div class="t">${esc(p.title)}</div><div class="d">${esc(p.section||"")}</div></div><div class="side"><span class="small muted">${fmtLong(p.d)}</span></div></div>`).join("")}</div>`:`<div class="empty">No pieces marked done in ${esc(R.label)}.</div>`;
  const noteBlock=sv?(note?`<div class="sheet reveal" style="--i:5;--acc:#E9DDB0"><h3>A note from ${esc(t.short)}</h3><p class="yr-note">${esc(note)}</p><div class="yr-sig">${esc(t.short)}</div></div>`:"")
    :`<div class="sheet reveal" style="--i:5;--acc:#E9DDB0"><div class="spread"><h3>Your note to ${fn}</h3><span class="small muted">${note?`${fn} sees this on their review`:"Not written yet"}</span></div>
      <div class="field"><label for="yrn">A few words about ${fn}'s ${esc(R.own)}</label><textarea id="yrn" data-yrnote style="min-height:120px" placeholder="What they should be proud of, and what's next">${esc(note)}</textarea></div>
      <p class="small muted" style="margin:0">Saves when you click away.</p></div>`;
  return `<div class="sheet reveal" style="--i:1"><div class="spread"><div class="eyebrow"><i></i>Year in review</div>${chips}</div>
      <h2 class="yr-title">${sv?"Your":fn+"'s"} ${esc(R.own)}</h2><p class="yr-sum">${sum}</p>
      <div class="yr-stats">${stat("Lessons",r.lessons.length)}${stat("Hours of lessons",r.hours)}${stat("Keys passed",r.keys.length)}${stat("Scales in all 12 keys",r.completed.length,"var(--acc2)")}${stat("Scale tests passed",r.tests.length,"var(--acc2)")}${stat("Pieces finished",r.pieces.length,"var(--good)")}${stat("Longest streak, weeks",r.streak,"var(--remote)")}</div></div>
    <div class="sheet reveal" style="--i:2"><h3>Keys passed, month by month</h3>${monthChart(r.byMonth,`${s.name}, keys passed and lessons by month`)}</div>
    <div class="yr-two reveal" style="--i:3"><div class="sheet"><h3>Scale sheet progress</h3>${fams}</div><div class="sheet" style="--acc:#8CC56A"><h3>Pieces finished</h3>${pieces}</div></div>
    <div class="sheet reveal" style="--i:4"><h3>Highlights</h3>${tl}</div>
    ${noteBlock}`}
function studioReviewHTML(){
  const v=viewer(),R=periodRange(),rows=visible().map(x=>({x,r:reviewOf(x,R)}));
  const sum=f=>rows.reduce((a,b)=>a+f(b.r),0);
  const chips=`<div class="stabs">${[["y",TODAY.slice(0,4)],["sy","School year"],["r12","Last 12 months"]].map(([k,l])=>`<button class="stab" data-period="${k}" aria-pressed="${R.key===k}">${l}</button>`).join("")}</div>`;
  const filt=v.t.owner?`<div class="stabs">${[["all","Everyone"],["sarah","Mine"],["mitchell","Mitchell's"]].map(([k,l])=>`<button class="stab" data-filter="${k}" aria-pressed="${S.filter===k}">${l}</button>`).join("")}</div>`:"";
  const noted=rows.filter(o=>(o.x.yrNotes||{})[noteKey(R)]).length;
  return `<div class="stack">
    <div class="spread reveal" style="--i:0">${chips}${filt}</div>
    <div class="scoreboard reveal" style="--i:0">
      <div class="score"><div class="k">Lessons taught</div><div class="v" data-count="${sum(r=>r.lessons.length)}">${sum(r=>r.lessons.length)}</div></div>
      <div class="score"><div class="k">Hours</div><div class="v" data-count="${sum(r=>r.hours)}">${sum(r=>r.hours)}</div></div>
      <div class="score"><div class="k">Keys passed</div><div class="v" data-count="${sum(r=>r.keys.length)}">${sum(r=>r.keys.length)}</div></div>
      <div class="score" style="--c:var(--acc2)"><div class="k">Scales in all 12 keys</div><div class="v" data-count="${sum(r=>r.completed.length)}">${sum(r=>r.completed.length)}</div></div>
      <div class="score" style="--c:var(--good)"><div class="k">Pieces finished</div><div class="v" data-count="${sum(r=>r.pieces.length)}">${sum(r=>r.pieces.length)}</div></div>
    </div>
    <div class="sheet reveal" style="--i:1"><div class="spread"><h3>Each student's ${esc(R.own)}</h3><span class="small muted">${noted} of ${rows.length} notes written</span></div>
      <div class="roster">${rows.map(({x,r},j)=>{const mx=Math.max(1,...r.byMonth.map(b=>b.keys)),nt=(x.yrNotes||{})[noteKey(R)];
        return `<button class="srow" data-open="${x.id}" data-opentab="yr" style="--j:${j}">
          <div><div class="name">${esc(x.name)} ${v.t.owner?`<span class="chip" style="--c:${x.teacher==="sarah"?"var(--acc)":"var(--acc2)"}">${esc(teachers[x.teacher].short)}</span>`:""}</div><div class="meta">${r.lessons.length} lesson${r.lessons.length===1?"":"s"} · ${r.keys.length} key${r.keys.length===1?"":"s"} · ${r.pieces.length} piece${r.pieces.length===1?"":"s"}</div></div>
          <div class="hide-sm"><div class="spark" aria-hidden="true">${r.byMonth.map((b,k)=>`<i style="height:${Math.max(4,b.keys/mx*100)}%;--k:${k};${b.keys?"":"opacity:.25"}"></i>`).join("")}</div></div>
          <div class="hide-sm meta">${r.completed.length?`${r.completed.length} scale${r.completed.length===1?"":"s"} in all 12 keys`:"Building toward all 12 keys"}</div>
          <div class="owe">${nt?`<span class="pill paid">Note written</span>`:`<span class="pill plain">Add a note</span>`}</div></button>`}).join("")}</div></div></div>`}

/* ---------- email notices ---------- */
function emailSheet(){const v=viewer(),tid=v.t.owner?S.calT:v.t.id,e=teachers[tid].email;
  const rows=[["cancel","Cancellations and remote switches","you, when a student cancels or switches a lesson to remote"],["away","Away dates","students who have a lesson during your time away"],["remote","Remote lessons","the student, with the video link"],["answer","Extra lesson answers","the student, when you accept or decline"],["request","New extra lesson requests","you"],["paid","Payments sent","you, when a student taps “I've sent it”"]];
  return `<div class="sheet reveal" style="--i:3;--acc:#7FB8E6"><h3>Email notices</h3>
    <p class="small muted" style="margin:0">Sent from the studio Gmail, the same way the Green Room sends its emails. Student emails go to the address in their details.</p>
    <div class="list">${rows.map(([k,l,who])=>`<label class="item" for="em-${k}"><div><div class="t">${l}</div><div class="d">Emails ${who}</div></div><div class="side"><span class="toggle"><input type="checkbox" id="em-${k}" data-emailpref="${k}" ${e[k]?"checked":""}><i></i></span></div></label>`).join("")}</div></div>`}

/* ---------- backups (Sarah) ---------- */
function backupSheet(){const v=viewer();if(!v.t.owner)return"";const r=S.restore;
  return `<div class="sheet reveal" style="--i:5;--acc:#9A948A"><h3>Backup & restore</h3>
    <p class="small muted" style="margin:0">A copy of the whole studio is saved automatically every day and kept for 30 days. You can also download your own copy.</p>
    <div class="row"><button class="btn sm" data-backup>Download a backup</button><label class="btn sm" for="restoreFile">Restore from a file</label><input type="file" id="restoreFile" accept="application/json,.json" hidden></div>
    ${r?`<div class="form" style="display:flex;flex-direction:column;gap:10px;--acc:#F2B544"><b style="color:var(--paper)">Restore ${esc(r.name)}?</b>
      <span class="small muted">Saved ${esc(r.when)} · ${r.students} students · ${r.lessons} lessons. This replaces everything in the studio now. A copy of the current studio is saved first.</span>
      <div class="row"><button class="btn sm primary" data-restoreok>Restore it</button><button class="btn ghost sm" data-restorecancel>Cancel</button></div></div>`:""}</div>`}

/* ---------- google classroom (read only) ---------- */
function materialsHTML(s,sv){
  const head=`<h3>Class materials</h3>`;
  if(!classroom.connected)return head+`<div class="empty">${sv?"Your class materials will show here once the studio's Google Classroom is connected.":"Google Classroom isn't connected. Connect it under Settings."}<div style="margin-top:12px"><a class="btn sm" href="${CLASSROOM_URL}" target="_blank" rel="noopener">Open Google Classroom ↗</a></div></div>`;
  const cls=studentClasses(s);
  if(!cls.length)return head+`<div class="empty">${sv?`Your portal isn't linked to Google Classroom yet. Ask ${esc(teachers[s.teacher].short)} to link it.`:`${esc(first(s.name))} isn't linked to a Classroom class. The email in their details has to match the one they use in Classroom.`}${sv?"":`<div style="margin-top:12px"><button class="btn sm" data-tab="info">Add their Classroom email</button></div>`}</div>`;
  const items=itemsFor(s),topics=[...new Set(items.map(i=>i.topic))],tp=topics.includes(S.topic)?S.topic:"All";
  return `<div class="spread"><h3>${cls.map(c=>esc(c.name)).join(" · ")}</h3><span class="gc-src"><b>●</b> From Google Classroom · synced ${ago(classroom.synced)}</span></div>
    <div class="gc-tools"><span class="money-in gc-search"><i>⌕</i><input id="mq" type="search" data-mq placeholder="Search handouts, tunes, recordings" value="${esc(S.mq)}" aria-label="Search materials"></span>
    <div class="stabs">${["All",...topics].map(t=>`<button class="stab" data-topic="${esc(t)}" aria-pressed="${tp===t}">${esc(t)}<small>${t==="All"?items.length:items.filter(i=>i.topic===t).length}</small></button>`).join("")}</div></div>
    <div id="mlist">${matList(s)}</div>
    <p class="small muted" style="margin:0">${sv?"Open anything to view it, turn it in, or download it in Classroom.":"Read only. Post and edit materials in Classroom as usual; they show up here on the next sync."}</p>`}
function matList(s){
  const q=(S.mq||"").trim().toLowerCase(),items0=itemsFor(s),topics=new Set(items0.map(i=>i.topic)),tp=topics.has(S.topic)?S.topic:"All";
  const items=items0.filter(i=>(tp==="All"||i.topic===tp)&&(!q||(i.title+" "+i.topic+" "+i.att.map(a=>a.label).join(" ")).toLowerCase().includes(q))).sort((a,b)=>b.posted.localeCompare(a.posted));
  if(!items.length)return `<div class="empty">Nothing matches${q?` “${esc(S.mq)}”`:""}.</div>`;
  return `<div class="list">${items.map((i,j)=>{const late=i.due&&i.due<TODAY;
    return `<div class="item mat" style="--j:${j}"><div><div class="t"><a href="${esc(i.link||CLASSROOM_URL)}" target="_blank" rel="noopener">${esc(i.title)}</a> ${i.posted&&daysBetween(i.posted,TODAY)<=7?'<span class="pill paid">New</span>':""}</div>
    <div class="d">${i.kind==="assignment"?`Assignment${i.due?` · <span class="${late?"late":""}">due ${fmtLong(i.due)}</span>`:""}`:"Material"} · ${esc(i.topic)} · posted ${fmtLong(i.posted)}</div>
    <div class="atts">${i.att.map(a=>a.href?`<a class="att att-${a.type}" href="${esc(a.href)}" target="_blank" rel="noopener"><b>${ATT[a.type]}</b>${esc(a.label)}</a>`:`<span class="att att-${a.type}"><b>${ATT[a.type]}</b>${esc(a.label)}</span>`).join("")}</div></div>
    <div class="side"><a class="btn sm" href="${esc(i.link||CLASSROOM_URL)}" target="_blank" rel="noopener">Open ↗</a></div></div>`}).join("")}</div>`}
function importBox(){const v=viewer(),c=classroom;if(!c.connected)return"";
  const pending=c.classes.filter(cl=>v.t.owner?(S.filter==="all"||cl.teacher===S.filter):cl.teacher===v.t.id)
    .flatMap(cl=>c.roster[cl.id].filter(r=>!students.some(x=>sameEmail(x.email,r.email))).map(r=>({...r,cl})));
  if(!pending.length)return"";
  return `<div class="form" style="display:flex;flex-direction:column;gap:10px;--acc:#6FCF8E">
    <div class="spread"><b style="color:var(--paper);font-weight:600">${pending.length} in Google Classroom, not in the studio yet</b><span class="gc-src">synced ${ago(c.synced)}</span></div>
    ${pending.map(r=>`<div class="spread"><span>${esc(r.name)} <span class="small muted">· ${esc(r.cl.name)}</span></span><button class="btn sm" data-gcadd="${esc(r.cl.id)}|${esc(r.email)}">Add to ${esc(teachers[r.cl.teacher].short)}'s roster</button></div>`).join("")}</div>`}
function classroomSheet(i){const v=viewer(),own=v.t.owner,c=classroom;
  if(!c.connected)return `<div class="sheet reveal" style="--i:${i};--acc:#6FCF8E"><div class="spread"><h3>Google Classroom</h3><span class="pill plain">Not connected</span></div>
    <div class="gc-status"><i class="gc-dot off"></i><div class="small muted">${c.error?`<span style="color:var(--acc2)">${esc(c.error)}</span><br>`:""}Connect the shared Google Classroom account to pull in rosters and class materials. The studio asks for read-only access, so it can't change anything in Classroom.</div></div>
    ${own?`<div class="row"><button class="btn sm primary" data-gcconn="on">Connect Google Classroom</button></div><p class="small muted" style="margin:0">Google will ask which account: pick the one you and Mitchell share for Classroom. It may warn that the app isn't verified yet; choose Advanced, then continue.</p>`:`<p class="small muted" style="margin:0">Ask Sarah to connect it.</p>`}</div>`;
  const unl=mine().filter(x=>!studentClasses(x).length);
  return `<div class="sheet reveal" style="--i:${i};--acc:#6FCF8E"><div class="spread"><h3>Google Classroom</h3><span class="pill paid">Read only</span></div>
    <div class="gc-status"><i class="gc-dot"></i><div><b>Connected</b> <span class="small muted">· ${esc(c.account||"Google Classroom")}</span><div class="small muted">Synced ${c.synced?ago(c.synced):"not yet"}${c.error?` · <span style="color:var(--acc2)">${esc(c.error)}</span>`:""}</div></div></div>
    <p class="small muted" style="margin:0">The studio can only read your classes. It can't post, edit, or delete anything in Classroom. It syncs on its own once a day; tap Sync now after you post something new.</p>
    <div class="row"><button class="btn sm primary" data-gcsync ${S.syncing?"disabled":""}>${S.syncing?'<span class="spin">↻</span> Syncing':"Sync now"}</button>${own?`<button class="btn sm" data-gcconn="renew">Reconnect</button><button class="btn ghost sm" data-gcconn="off">Disconnect</button>`:""}</div>
    <h3>Classes</h3>
    <div class="list">${c.classes.length?c.classes.map(cl=>`<div class="item"><div><div class="t">${cl.link?`<a class="linkish" href="${esc(cl.link)}" target="_blank" rel="noopener">${esc(cl.name)}</a>`:esc(cl.name)}</div><div class="d">${(c.roster[cl.id]||[]).length} students · ${c.items.filter(x=>x.cls===cl.id).length} posts</div></div>
      <div class="side">${own?`<select class="mini" data-gcmap="${cl.id}" aria-label="Whose students are in ${esc(cl.name)}">${Object.values(teachers).map(t=>`<option value="${t.id}" ${t.id===cl.teacher?"selected":""}>${esc(t.short)}'s students</option>`).join("")}</select>`:`<span class="pill plain">${esc((teachers[cl.teacher]||{}).short||"")}'s students</span>`}</div></div>`).join(""):`<div class="empty">No active classes found on that account.</div>`}</div>
    ${unl.length?`<p class="small" style="margin:0"><span class="pill reported">Not linked</span> ${unl.map(x=>`<button class="linkish" data-open="${x.id}" data-opentab="info">${esc(x.name)}</button>`).join(", ")}: no email matching Classroom, so their materials won't show. Tap a name to add it.</p>`:""}</div>`}

/* ---------- student notices ---------- */
const NLABEL={away:"Away",remote:"Remote",confirmed:"Confirmed",declined:"Declined",cancelled:"Cancelled"};
const NCOL={away:"var(--acc2)",remote:"var(--remote)",confirmed:"var(--good)",declined:"var(--red-text)",cancelled:"var(--red-text)"};
function noticesFor(s){const t=teachers[s.teacher],out=[];
  t.away.filter(a=>a.to>=TODAY&&a.from<=addDays(TODAY,42)).forEach(a=>{const miss=[];for(let d=a.from;d<=a.to;d=addDays(d,1))if(occurs(s,d))miss.push(d);
    out.push({id:"away|"+a.id,kind:"away",date:a.from,title:`${t.short} is away ${rangeText(a.from,a.to)}`,body:esc(miss.length?`No lesson on ${miss.map(fmtLong).join(", ")}.`:"Your regular lessons aren't affected.")+(a.note?` <span class="muted">(${esc(a.note)})</span>`:"")})});
  Object.entries(S.sessions).forEach(([k,v])=>{const[sid,date]=k.split("|");if(sid===s.id&&v.mode==="remote"&&date>=TODAY&&occurs(s,date)&&!awayOn(s.teacher,date))
    out.push({id:"remote|"+k,kind:"remote",date,title:`Your lesson on ${fmtLong(date)} is remote`,body:v.link?`Join at ${fmtTime(s.regular.start)}: <a href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.link)}</a>`:esc(`${t.short} will send the link before ${fmtTime(s.regular.start)}.`)})});
  requests.filter(r=>r.studentId===s.id&&r.date>=TODAY&&["accepted","logged","declined","cancelled"].includes(r.status)).forEach(r=>{
    const k=r.status==="logged"?"accepted":r.status,kind=k==="accepted"?"confirmed":k,when=`${fmtLong(r.date)} at ${fmtTime(r.start)}`;
    const title=kind==="confirmed"?`Extra lesson confirmed: ${when}`:kind==="declined"?`${t.short} can't do ${when}`:`Extra lesson on ${when} was cancelled`;
    out.push({id:"rq|"+r.id+"|"+k,kind,date:r.date,title,body:esc(r.reply?`“${r.reply}”`:kind==="confirmed"?"See you then.":"Pick another open time on the calendar.")})});
  return out.filter(n=>!S.dismissed.has(n.id)).sort((a,b)=>a.date.localeCompare(b.date))}
function noticesHTML(s){const ns=noticesFor(s);if(!ns.length)return"";
  return `<div class="sheet reveal" style="--i:0;--acc:#7FB8E6"><div class="spread"><h3>Heads up</h3><span class="muted small">${ns.length}</span></div><div class="notices">${ns.map(n=>`<div class="notice"><span class="pill" style="--c:${NCOL[n.kind]}">${NLABEL[n.kind]}</span><div class="nb"><b>${esc(n.title)}</b><div class="small muted">${n.body}</div></div><button class="btn ghost sm" data-dismiss="${esc(n.id)}">Got it</button></div>`).join("")}</div></div>`}

/* ---------- dialog ---------- */
function dialogHTML(){
  if(S.dialog!=="addStudent")return"";
  const v=viewer();
  return `<div class="overlay" data-act="closeDialog"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlgT" data-stop>
    <h2 class="dlg-title" id="dlgT">New student</h2>
    <form class="form plain" data-form="newStudent">
      <div class="field full"><label for="nn">Student name</label><input id="nn" name="name" required></div>
      <div class="field"><label for="ni">Instrument or focus</label><input id="ni" name="instrument"></div>
      <div class="field"><label for="nday">Lesson day</label><select id="nday" name="day"><option value="">Not set</option>${DOW_LONG.map((d,i)=>`<option value="${i}" ${null&&null.dow===i?"selected":""}>${d}s</option>`).join("")}</select></div>
    <div class="field"><label for="ntime">Lesson time</label><input id="ntime" type="time" name="time" value="${null?toHM(null.start):"16:00"}"></div>
    <div class="field"><label for="nmins">Length</label><select id="nmins" name="mins">${LENGTHS.map(m=>`<option value="${m}" ${(null?null.mins:60)===m?"selected":""}>${m} min</option>`).join("")}</select></div>
      <div class="field"><label for="nr">Rate per lesson</label><input id="nr" type="number" min="0" name="rate" placeholder="Standard for the length"></div>
      ${v.t.rates&&teachers[v.t.id].firstFree?`<p class="small full" style="margin:0;color:var(--acc2)">Their first lesson is free.</p>`:""}
      <div class="field"><label for="ng">Parent or guardian</label><input id="ng" name="guardian" placeholder="If under 18"></div>
      <div class="field full"><label for="ne">Student's Google email</label><input id="ne" type="email" name="email" placeholder="The one they use for Google Classroom"></div>
      <div class="field full"><label for="nge">Parent's Google email (optional)</label><input id="nge" type="email" name="guardianEmail"></div>
      ${v.t.owner?`<div class="field full"><label for="nt">Teacher</label><select id="nt" name="teacher">${Object.values(teachers).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>`:""}
      <div class="row full"><button class="btn primary" type="submit">Add student</button><button class="btn ghost" type="button" data-act="closeDialog">Cancel</button></div>
    </form></div></div>`;
}

/* ---------- render ---------- */
function countUp(){
  if(reduce)return;
  document.querySelectorAll("#view [data-count]").forEach(el=>{
    const end=+el.dataset.count,isM=el.hasAttribute("data-money");if(!end)return;
    const t0=performance.now(),dur=900;
    (function step(now){const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3),v=end*e;
      el.textContent=isM?money(p<1?Math.round(v):end):String(p<1?Math.round(v):end);if(p<1)requestAnimationFrame(step)})(t0);
  });
}
function render(enter){
  renderNav();const v=viewer();let h;
  if(v.kind==="teacher"){
    if(S.screen==="students")h=S.sid?studentHTML():rosterHTML();
    else if(S.screen==="schedule")h=scheduleHTML();
    else if(S.screen==="review")h=studioReviewHTML();
    else if(S.screen==="payments")h=paymentsHTML();
    else h=settingsHTML();
  } else if(v.kind==="store")h=storeHTML();
  else h=portalHTML();
  const home=v.kind==="teacher"?(S.screen==="students"&&!S.sid):v.kind==="store"?S.tab==="book":S.tab==="dash";
  $("#hero").className="hero"+(home?"":" compact");
  const vb=$("#viewas");if(vb){vb.hidden=!S.viewAs;if(S.viewAs){const vs=students.find(x=>x.id===S.viewAs);vb.querySelector("b").textContent=vs?vs.name+"'s":"a student's"}}
  $("#hero").innerHTML=heroHTML();$("#app").innerHTML=h;$("#layer").innerHTML=dialogHTML();
  const view=$("#view");
  if(enter){view.classList.remove("enter");void view.offsetWidth;view.classList.add("enter");renderTicker();countUp()}
  else view.classList.remove("enter");
  if(S.dialog){const f=$("#nn");f&&f.focus()}
}
function go(fn){fn();render(true);window.scrollTo(0,0)}

/* ---------- events ---------- */

document.addEventListener("click",e=>{
  if(S.menu&&!e.target.closest("#nav")){S.menu=false;renderNav()}
  const t=e.target.closest("[data-menu],[data-home],[data-nav],[data-filter],[data-open],[data-tab],[data-cell],[data-act],[data-delrep],[data-confirm],[data-unpay],[data-method],[data-copy],[data-ev],[data-week],[data-calt],[data-mode],[data-accept],[data-decline],[data-dismiss],[data-delaway],[data-delopen],[data-cancelreq],[data-logextra],[data-cancelextra],[data-clearsel],[data-stdrate],[data-gcsync],[data-gcconn],[data-gcadd],[data-topic],[data-period],[data-goto],[data-viewas],[data-viewexit],[data-signout],[data-backup],[data-restoreok],[data-restorecancel],[data-archive],[data-scancel],[data-sremote],[data-sundo],[data-storet],[data-taccept],[data-tdecline],[data-tcancel],[data-tenroll],[data-storecode]");
  if(!t)return;
  if(t.classList.contains("overlay")&&e.target.closest("[data-stop]"))return;
  const d=t.dataset;
  if("menu" in d){S.menu=!S.menu;renderNav();if(S.menu){const f=document.querySelector('.menu-panel [aria-current="true"]')||document.querySelector(".menu-panel button");f&&f.focus({preventScroll:true})}return}
  if("home" in d){S.menu=false;go(()=>{if(viewer().kind==="teacher"){S.screen="students";S.sid=null}else S.tab=viewer().kind==="store"?"book":"dash";S.form=null});return}
  if(d.nav){go(()=>{S.menu=false;S.sel=null;S.req=null;if(viewer().kind==="teacher"){S.screen=d.nav;S.sid=null;S.form=null}else{S.tab=d.nav;S.pay=null;S.allLessons=false}});return}
  const v=viewer(),tid=v.kind==="store"?S.storeT:v.kind==="teacher"?(v.t.owner?S.calT:v.t.id):v.s.teacher;
  if(d.ev&&v.kind==="store"){S.sel={key:d.ev,date:d.date};const e=findEvent(tid,d.date,d.ev,"store");S.book=e&&e.kind==="free"?{start:e.start}:null;
    render(false);const dt=document.querySelector(".detail");dt&&dt.scrollIntoView({block:matchMedia("(max-width:720px)").matches?"start":"nearest",behavior:reduce?"auto":"smooth"});return}
  if(d.scancel||d.sremote||d.sundo){const s0=viewer().s,tt=teachers[s0.teacher],key=d.scancel||d.sremote||d.sundo,r=requests.find(x=>x.id===key);
    const date=r?r.date:key.split("|")[1],start=r?r.start:s0.regular.start;
    if(d.scancel){if(hoursUntil(date,start)<24){toast("It's less than 24 hours away now. Switch to remote, or reach out to "+tt.short+".");render(false);return}
      if(S.cancelArm!==key){S.cancelArm=key;render(false);return}
      S.cancelArm=null;if(r){r.status="cancelled";r.cancelledBy="student"}else S.sessions[key]={mode:"cancelled",by:"student",at:Date.now()};
      toast(`Cancelled. ${tt.short}${mailOn(tt.id,"cancel")?" gets an email":" will see it"}.`)}
    else if(d.sremote){if(r)r.mode="remote";else S.sessions[key]={mode:"remote",link:"",by:"student",at:Date.now()};toast(`Switched to remote. ${tt.short} will send the link.`)}
    else{delete S.sessions[key];toast("Your lesson is back on.")}
    render(false);renderTicker();return}
  if(d.storet){S.storeT=d.storet;S.sel=null;S.book=null;if(S.tab!=="book"){go(()=>{S.tab="book"})}else render(false);return}
  if(d.taccept||d.tdecline){const x=trials.find(y=>y.id===(d.taccept||d.tdecline)),box=t.closest("[data-rq]"),rp=box&&box.querySelector("[data-reply]");
    x.status=d.taccept?"accepted":"declined";x.reply=rp?rp.value.trim():"";toast(d.taccept?`Confirmed. Emailed ${x.guardian?first(x.guardian):first(x.name)}${store.email?" and the store":""}.`:`Declined. ${x.guardian?first(x.guardian):first(x.name)} gets an email${store.email?", and so does the store":""}.`);render(false);renderTicker();return}
  if(d.tcancel){const x=trials.find(y=>y.id===d.tcancel);x.status="cancelled";S.sel=null;toast("Get to Know session cancelled. The family gets an email.");render(false);renderTicker();return}
  if(d.tenroll){const x=trials.find(y=>y.id===d.tenroll),tch=teachers[x.teacher];
    const ns={id:nid("s"),name:x.name,teacher:x.teacher,instrument:x.instrument,guardian:x.guardian||"",email:x.guardian?"":x.email,guardianEmail:x.guardian?x.email:"",regular:null,len:60,rate:tch.rates[60],grid:{},rep:[],
      lessons:[{id:nid("l"),date:x.date,amount:0,notes:"Get to Know session",status:"paid",method:"free"}]};
    students.push(ns);x.status="enrolled";fillAs();toast(`${x.name} is on the roster. Their Get to Know session counts as the free first lesson.`);go(()=>{S.screen="students";S.sid=ns.id;S.tab="info"});return}
  if("storecode" in d){store.code=Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);toast("New store link made. The old one no longer works.");render(false);return}
  if(d.ev){S.sel={key:d.ev,date:d.date};S.req=null;
    const e=findEvent(tid,d.date,d.ev,v.kind==="student"?v.s.id:null);
    if(e&&e.kind==="free"&&v.kind==="student"){const want=(v.s.regular&&v.s.regular.mins)||60,lens=LENGTHS.filter(l=>l<=e.end-e.start);S.req={start:e.start,mins:lens.filter(l=>l<=want).pop()||30,note:""}}
    render(false);const dt=document.querySelector(".detail");dt&&dt.scrollIntoView({block:matchMedia("(max-width:720px)").matches?"start":"nearest",behavior:reduce?"auto":"smooth"});return}
  if(d.week){S.week=d.week==="0"?WS:addDays(S.week,+d.week);S.sel=null;S.req=null;render(false);return}
  if(d.calt){S.calT=d.calt;S.sel=null;render(true);return}
  if(d.mode){const k=S.sel.key,prev=S.sessions[k];if(d.mode==="remote"){S.sessions[k]={mode:"remote",link:(prev&&prev.link)||""};{const st=students.find(x=>x.id===k.split("|")[0]);toast(mailOn(tid,"remote")?`Switched to remote. Emailed ${first(st.name)}${S.sessions[k].link?" the link":""}.`:"Switched to remote. The student gets a heads-up.")}}else{delete S.sessions[k];toast("Back to in person")}render(false);renderTicker();return}
  if(d.accept||d.decline){const r=requests.find(x=>x.id===(d.accept||d.decline)),box=t.closest("[data-rq]"),rp=box&&box.querySelector("[data-reply]");
    r.status=d.accept?"accepted":"declined";r.reply=rp?rp.value.trim():"";const nm=first(students.find(s=>s.id===r.studentId).name);
    toast((d.accept?`Booked. ${nm} sees it confirmed.`:`Declined. ${nm} gets a heads-up.`)+(mailOn(r.teacher,"answer")?" Emailed too.":""));render(false);renderTicker();return}
  if(d.dismiss){S.dismissed.add(d.dismiss);saveDismissed();render(false);return}
  if(d.delaway){const[id,aid]=d.delaway.split("|");teachers[id].away=teachers[id].away.filter(a=>a.id!==aid);S.sel=null;toast("Away dates removed");render(false);renderTicker();return}
  if(d.delopen){const[id,i]=d.delopen.split("|");teachers[id].open.splice(+i,1);S.sel=null;toast("Open time removed");render(false);return}
  if(d.cancelreq){const i=requests.findIndex(r=>r.id===d.cancelreq);requests.splice(i,1);S.sel=null;toast("Request cancelled");render(false);return}
  if(d.logextra){const r=requests.find(x=>x.id===d.logextra),s=students.find(x=>x.id===r.studentId);
    s.lessons.push(isFirstFree(s)?{id:nid("l"),date:r.date,amount:0,notes:"Extra lesson (first lesson, free)",status:"paid",method:"free"}:{id:nid("l"),date:r.date,amount:extraPrice(s,r.mins),notes:"Extra lesson"+(r.note?": "+r.note:""),status:"unpaid"});r.status="logged";toast(`Logged on ${first(s.name)}'s Lessons & pay`);render(false);return}
  if(d.cancelextra){const r=requests.find(x=>x.id===d.cancelextra);r.status="cancelled";S.sel=null;toast("Cancelled. The student gets a heads-up.");render(false);renderTicker();return}
  if(d.stdrate){const x=students.find(y=>y.id===d.stdrate);x.rate=stdRate(x);toast(`${first(x.name)} is back on the standard rate, ${money(x.rate)}`);render(false);return}
  if(d.viewas){S.viewAs=d.viewas;S.menu=false;S.tab="dash";S.pay=null;S.sel=null;render(true);window.scrollTo(0,0);return}
  if("viewexit" in d){S.viewAs=null;S.tab="scales";S.pay=null;S.sel=null;load().then(()=>render(true)).catch(e=>toast(e.message));return}
  if("signout" in d){API("/api/auth",{method:"DELETE"}).finally(()=>location.replace("/"));return}
  if("backup" in d){API("/api/data?backup=1").then(db=>{const b=new Blob([JSON.stringify(db,null,1)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`Lesson Studio Backup ${TODAY}.json`;document.body.appendChild(a);a.click();a.remove();toast("Backup downloaded")}).catch(e=>toast(e.message));return}
  if("restorecancel" in d){S.restore=null;render(false);return}
  if("restoreok" in d){const data=S.restore.data;S.restore=null;API("/api/data",{method:"POST",body:JSON.stringify({restore:data})}).then(()=>load()).then(()=>{toast("Restored. The old version was saved first.");render(true)}).catch(e=>toast(e.message));return}
  if(d.archive){if(S.archiveArm!==d.archive){S.archiveArm=d.archive;render(false);return}
    const x=students.find(y=>y.id===d.archive);x.archived=true;S.archiveArm=null;toast(`${x.name} removed from the roster`);go(()=>{S.sid=null;S.tab="scales"});return}
  if(d.goto){go(()=>{S.tab=d.goto;S.pay=null});return}
  if(d.period){S.period=d.period;render(false);return}
  if(d.topic){S.topic=d.topic;render(false);return}
  if("gcsync" in d){if(S.syncing)return;S.syncing=true;render(false);
    API("/api/classroom/sync",{method:"POST",body:"{}"}).then(r=>{setClassroom(r.classroom);toast(`Synced ${classroom.classes.length} classes and ${classroom.items.length} posts. Nothing in Classroom changed.`)}).catch(e=>toast("Couldn't sync: "+e.message)).finally(()=>{S.syncing=false;render(false)});return}
  if(d.gcconn){if(d.gcconn==="off"){API("/api/classroom/disconnect",{method:"POST",body:"{}"}).then(r=>{setClassroom(r.classroom);toast("Disconnected. Nothing in Classroom was changed.");render(false)}).catch(e=>toast(e.message))}
    else location.href="/api/classroom/connect";return}
  if(d.gcadd){const[cid,em]=d.gcadd.split("|"),cl=classroom.classes.find(x=>x.id===cid),r=classroom.roster[cid].find(x=>sameEmail(x.email,em)),tch=teachers[cl.teacher];
    const ns={id:nid("s"),name:r.name,teacher:cl.teacher,instrument:"",guardian:"",email:r.email,regular:null,len:60,rate:tch.rates[60],grid:{},rep:[],lessons:[]};
    students.push(ns);fillAs();toast(`Added ${r.name}. Set their lesson day and rate here.`);go(()=>{S.screen="students";S.sid=ns.id;S.tab="info"});return}
  if("clearsel" in d){S.sel=null;S.req=null;render(false);return}
  if(d.filter){S.filter=d.filter;render(false);return}
  if(d.open){go(()=>{S.screen="students";S.sid=d.open;S.tab=d.opentab||"scales";S.form=null});return}
  if(d.tab){S.tab=d.tab;S.form=null;render(false);return}
  if(d.cell){const[id,ki]=d.cell.split("|");const s=cur();const row=s.grid[id]=s.grid[id]||{};const c=row[ki];
    const before=Object.values(row).filter(x=>x.s==="p").length;
    if(!c)row[ki]={s:"w",d:S.markDate};else if(c.s==="w")row[ki]={s:"p",d:S.markDate};else delete row[ki];
    const after=Object.values(row).filter(x=>x.s==="p").length;
    render(false);
    const b=document.querySelector(`[data-cell="${d.cell}"]`);if(b){b.classList.add("pop");b.focus({preventScroll:true})}
    if(after===12&&before<12){const tr=document.querySelector(`tr[data-row="${id}"]`);tr&&tr.classList.add("flash");toast(`All 12 keys of ${ROWNAME[id]}. Right on!`)}
    return}
  if(d.delrep){const s=cur();s.rep=s.rep.filter(r=>r.id!==d.delrep);toast("Removed");render(false);return}
  if(d.confirm){const x=findLesson(d.confirm);x.l.status="paid";toast(`Confirmed ${money(x.l.amount)} from ${first(x.s.name)}`);render(false);renderTicker();return}
  if(d.unpay){const x=findLesson(d.unpay);x.l.status="unpaid";delete x.l.method;toast("Marked unpaid");render(false);return}
  if(d.method){S.pay.method=d.method;render(false);return}
  if(d.copy){const val=d.copy;try{navigator.clipboard.writeText(val).then(()=>toast("Copied"),()=>sel(t))}catch(_){sel(t)}return}
  switch(d.act){
    case"back":go(()=>{S.sid=null;S.form=null});break;
    case"addStudent":S.dialog="addStudent";render(false);break;
    case"closeDialog":S.dialog=null;render(false);break;
    case"openRep":S.form="rep";render(false);$("#rt").focus();break;
    case"openLesson":S.form="lesson";render(false);$("#ld").focus();break;
    case"closeForm":S.form=null;render(false);break;
    case"allLessons":S.allLessons=true;render(false);break;
    case"openPay":{const s=viewer().s;S.pay={ids:s.lessons.filter(l=>l.status==="unpaid").map(l=>l.id),method:null};render(false);const pf=document.querySelector(".balance");pf&&pf.scrollIntoView({block:"start",behavior:reduce?"auto":"smooth"});break}
    case"closePay":S.pay=null;render(false);break;
    case"reportPaid":{const s=viewer().s;let tot=0;s.lessons.forEach(l=>{if(S.pay.ids.includes(l.id)&&l.status==="unpaid"){l.status="reported";l.method=S.pay.method;tot+=l.amount}});
      toast(mailOn(s.teacher,"paid")?`Thanks! ${teachers[s.teacher].short} just got an email and will confirm ${money(tot)}.`:`Thanks! ${teachers[s.teacher].short} will confirm ${money(tot)}.`);S.pay=null;render(false);renderTicker();break}
  }
});
function sel(btn){const code=btn.parentElement.querySelector("code");if(!code)return;const r=document.createRange();r.selectNodeContents(code);const s=getSelection();s.removeAllRanges();s.addRange(r);toast("Selected. Copy it from here.")}

document.addEventListener("change",e=>{
  const t=e.target,d=t.dataset;
  if(d.srate){const x=students.find(y=>y.id===d.srate),n=+t.value;if(t.value===""||n<0){t.value=x.rate;return}
    x.rate=n;toast(isCustom(x)?`${first(x.name)}: ${money(n)} per lesson (custom)`:`${first(x.name)} matches the standard rate`);render(false);return}
  if("yrnote" in d){const x=v0student();if(!x)return;x.yrNotes=x.yrNotes||{};const k=noteKey(periodRange()),val=t.value.trim();if(val)x.yrNotes[k]=val;else delete x.yrNotes[k];toast(val?`Note saved. ${first(x.name)} sees it on their review.`:"Note removed");return}
  if("firstfree" in d){const v=viewer(),tid=v.t.owner?S.calT:v.t.id;teachers[tid].firstFree=t.checked;toast(t.checked?"First lessons are free for new students":"First lessons are charged");return}
  if(d.emailpref){const v=viewer(),tid=v.t.owner?S.calT:v.t.id;teachers[tid].email[d.emailpref]=t.checked;toast(t.checked?"Email on":"Email off. The portal notice still shows.");return}
  if(d.gcmap){const cl=classroom.classes.find(x=>x.id===d.gcmap);cl.teacher=t.value;toast(`${cl.name} students go to ${teachers[t.value].short}`);render(false);return}
  if(t.id==="restoreFile"&&t.files[0]){const f=t.files[0];f.text().then(txt=>{let db;try{db=JSON.parse(txt)}catch(e){toast("That file isn't a backup.");return}
      if(!db||db.app!=="sg-lessons"||!Array.isArray(db.students)){toast("That file isn't a Lesson Studio backup.");return}
      S.restore={data:db,name:f.name,when:db.exportedAt?new Date(db.exportedAt).toLocaleString():"unknown",students:db.students.filter(s=>!s.archived).length,lessons:db.students.reduce((a,s)=>a+(s.lessons||[]).length,0)};render(false)});t.value="";return}
  if(t.id==="markDate"){S.markDate=t.value||TODAY;return}
  if("link" in d){if(S.sel&&S.sessions[S.sel.key]){S.sessions[S.sel.key].link=t.value.trim();toast("Link saved. The student can see it.")}return}
  if("reqstart" in d){S.req.start=+t.value;const e=findEvent(viewer().s.teacher,S.sel.date,S.sel.key,viewer().s.id);while(S.req.mins>30&&S.req.start+S.req.mins>e.end)S.req.mins-=30;render(false);return}
  if("reqmins" in d){S.req.mins=+t.value;render(false);return}
  if(d.repstatus){const r=cur().rep.find(x=>x.id===d.repstatus);r.status=t.value;r.done=t.value==="Done"?(r.done||TODAY):undefined;toast(`${r.title}: ${t.value}`);render(false);return}
  if(d.markpaid&&t.value){const x=findLesson(d.markpaid);x.l.status="paid";x.l.method=t.value;toast(`Paid by ${METHODS[t.value]}. Cha-ching!`);render(false);renderTicker();return}
  if(d.paypick){const id=d.paypick;S.pay.ids=t.checked?[...S.pay.ids,id]:S.pay.ids.filter(x=>x!==id);render(false);return}
});

document.addEventListener("submit",e=>{
  e.preventDefault();const f=e.target,k=f.dataset.form,data=Object.fromEntries(new FormData(f));
  if(k==="rep"){if(!data.title.trim())return;cur().rep.push({id:nid("r"),title:data.title.trim(),section:data.section.trim(),assigned:data.assigned||TODAY,due:data.due||TODAY,status:"Assigned",notes:data.notes.trim()});S.form=null;toast("Assigned");render(false);renderTicker()}
  if(k==="lesson"){const ff=isFirstFree(cur())&&!(+data.amount);cur().lessons.push(ff?{id:nid("l"),date:data.date||TODAY,amount:0,notes:data.notes.trim()||"First lesson",status:"paid",method:"free"}:{id:nid("l"),date:data.date||TODAY,amount:+data.amount||0,notes:data.notes.trim(),status:"unpaid"});S.form=null;toast(ff?"Free first lesson logged":"Lesson logged");render(false)}
  if(k==="info"){const s=cur();Object.assign(s,{name:data.name.trim()||s.name,instrument:data.instrument,regular:buildRegular(data,s.regular),len:+data.mins||60,rate:+data.rate||0,guardian:data.guardian,email:data.email.trim(),guardianEmail:(data.guardianEmail||"").trim()});if(data.teacher)s.teacher=data.teacher;fillAs();toast("Saved");render(false)}
  if(k==="away"){const v=viewer(),tid=v.t.owner?S.calT:v.t.id;if(data.to<data.from){toast("The end date is before the start date.");return}
    teachers[tid].away.push({id:nid("a"),from:data.from,to:data.to,note:data.note.trim()});const hitN=students.filter(x=>{if(x.teacher!==tid)return false;for(let dd=data.from;dd<=data.to;dd=addDays(dd,1))if(occurs(x,dd))return true;return false}).length;
    toast(mailOn(tid,"away")&&hitN?`Away dates added. Emailed ${hitN} student${hitN===1?"":"s"} with lessons then.`:"Away dates added. Affected students get a heads-up.");render(false);renderTicker();return}
  if(k==="open"){const v=viewer(),tid=v.t.owner?S.calT:v.t.id,a=hm(data.start),b=hm(data.end);if(b-a<30){toast("Make the open time at least 30 minutes.");return}
    teachers[tid].open.push({dow:+data.day,start:a,end:b});toast(`Open ${DOW_LONG[+data.day]}s, ${fmtTime(a)} to ${fmtTime(b)}`);render(false);return}
  if(k==="request"){const s=viewer().s,t=teachers[s.teacher];
    requests.push({id:nid("q"),studentId:s.id,teacher:s.teacher,date:S.sel.date,start:S.req.start,mins:S.req.mins,note:(S.req.note||"").trim(),status:"pending"});
    S.sel=null;S.req=null;toast(`Request sent to ${t.short}${mailOn(s.teacher,"request")?" by email too":""}`);render(false);renderTicker();return}
  if(k==="trial"){const tid=S.storeT;if(!data.name.trim()||!data.email.trim()){toast("Add the student's name and an email.");return}
    trials.push({id:nid("t"),teacher:tid,date:S.sel.date,start:+data.start,mins:store.trialMins,name:data.name.trim(),age:data.age.trim(),instrument:data.instrument,guardian:data.guardian.trim(),email:data.email.trim(),phone:data.phone.trim(),note:data.note.trim(),bookedBy:data.bookedBy.trim(),status:"pending",createdAt:Date.now()});
    S.sel=null;S.book=null;toast(`Booked! ${teachers[tid].short} got an email and will confirm with the family.`);render(false);renderTicker();return}
  if(k==="store"){Object.assign(store,{name:data.name.trim()||store.name,email:data.email.trim(),trialMins:+data.mins||30});toast("Store portal saved");render(false);return}
  if(k==="settings"){const v=viewer(),t=teachers[v.t.owner?S.calT:v.t.id];Object.assign(t,{name:data.name,paypal:data.paypal.trim(),zelle:data.zelle.trim(),notifyEmail:(data.notify||"").trim()});toast("Payment details saved");render(false)}
  if(k==="rates"){const v=viewer(),t=teachers[v.t.owner?S.calT:v.t.id];
    const before={...t.rates},follow=students.filter(x=>x.teacher===t.id&&!isCustom(x));
    LENGTHS.forEach(m=>{const n=+data["r"+m];if(n>=0)t.rates[m]=n});
    follow.forEach(x=>x.rate=stdRate(x));toast(`Standard rates saved${follow.length?`. ${follow.length} student${follow.length===1?"":"s"} on standard updated`:""}`);render(false)}
  if(k==="newStudent"){const v=viewer();const s={id:nid("s"),name:data.name.trim(),teacher:data.teacher||v.t.id,instrument:data.instrument,guardian:data.guardian,email:data.email.trim(),guardianEmail:(data.guardianEmail||"").trim(),regular:buildRegular(data,null),len:+data.mins||60,rate:data.rate!==""?+data.rate:teachers[data.teacher||v.t.id].rates[+data.mins||60],grid:{},rep:[],lessons:[]};
    students.push(s);S.dialog=null;fillAs();toast(`Added ${s.name}`);go(()=>{S.sid=s.id;S.tab="scales"})}
});
document.addEventListener("input",e=>{const t=e.target;if("reqnote" in t.dataset&&S.req)S.req.note=t.value;
  if("mq" in t.dataset){S.mq=t.value;const v=viewer(),s=v.kind==="student"?v.s:cur(),box=$("#mlist");if(s&&box)box.innerHTML=matList(s)}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.menu){S.menu=false;renderNav();const b=document.querySelector("[data-menu]");b&&b.focus();return}
  if(S.menu&&(e.key==="ArrowDown"||e.key==="ArrowUp")){const bs=[...document.querySelectorAll(".menu-panel button")],i=bs.indexOf(document.activeElement);e.preventDefault();bs[(i+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length].focus();return}
  if(e.key==="Escape"&&S.dialog){S.dialog=null;render(false)}});

/* ---------- talking to the server ---------- */
async function API(path,opts={}){
  const r=await fetch(path,{credentials:"same-origin",headers:{"content-type":"application/json"},...opts});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(j.error||("The studio couldn't be reached ("+r.status+")."));e.status=r.status;e.body=j;throw e}
  return j}
const synced={teacher:{},student:{},request:{},trial:{},session:{},classMap:{},store:""};
let syncing=false,again=false,syncTimer=0,retryTimer=0;
function setSave(st,msg){const el=$("#save");if(!el)return;el.className="save save-"+st;el.textContent=st==="saving"?"Saving…":st==="saved"?"Saved":st==="error"?(msg||"Not saved"):""}
function snap(){
  synced.teacher={};Object.values(teachers).forEach(t=>synced.teacher[t.id]=JSON.stringify(t));
  synced.student={};students.forEach(s=>{if(!s.anon)synced.student[s.id]=JSON.stringify(s)});
  synced.request={};requests.forEach(r=>{if(!r.anon)synced.request[r.id]=JSON.stringify(r)});
  synced.trial={};trials.forEach(x=>{if(!x.anon)synced.trial[x.id]=JSON.stringify(x)});
  synced.store=JSON.stringify(store);
  synced.session={};Object.entries(S.sessions).forEach(([k,v])=>synced.session[k]=JSON.stringify(v));
  synced.classMap={};classroom.classes.forEach(c=>synced.classMap[c.id]=c.teacher)}
function setClassroom(c){for(const k of Object.keys(classroom))delete classroom[k];Object.assign(classroom,{connected:false,account:"",synced:0,error:"",classes:[],roster:{},items:[]},c||{});
  synced.classMap={};classroom.classes.forEach(x=>synced.classMap[x.id]=x.teacher)}
function hydrate(d){
  for(const k of Object.keys(teachers))delete teachers[k];Object.assign(teachers,d.teachers||{});
  Object.values(teachers).forEach(t=>Object.assign(t,PROFILE[t.id]||{photo:"/icon-192.png",photoCredit:"",teaches:[],bio:[]}));
  trials.splice(0,trials.length,...(d.trials||[]));
  for(const k of Object.keys(store))delete store[k];Object.assign(store,{name:"Rhapsody Music",code:"",trialMins:30,email:""},d.store||{});
  students.splice(0,students.length,...(d.students||[]));
  requests.splice(0,requests.length,...(d.requests||[]));
  S.sessions=d.sessions||{};setClassroom(d.classroom);ME=d.me&&d.me.role!=="store"?d.me:(STORE_CODE?{role:"store"}:d.me);S.mailOn=!!d.mail;snap()}
async function load(){hydrate(await API(STORE_CODE?"/api/store?code="+encodeURIComponent(STORE_CODE):"/api/data"))}
function collect(){
  const puts=[],isT=ME&&ME.role==="teacher",isStore=ME&&ME.role==="store";
  trials.forEach(x=>{if(x.anon)return;const j=JSON.stringify(x);if(synced.trial[x.id]!==j)puts.push({type:"trial",id:x.id,value:x,j})});
  if(isStore)return puts;
  if(isT&&ME.owner){const j=JSON.stringify(store);if(synced.store!==j)puts.push({type:"store",id:"store",value:store,j})}
  if(isT)Object.values(teachers).forEach(t=>{const j=JSON.stringify(t);if(synced.teacher[t.id]!==j)puts.push({type:"teacher",id:t.id,value:t,j})});
  students.forEach(s=>{if(s.anon)return;const j=JSON.stringify(s);if(synced.student[s.id]!==j)puts.push({type:"student",id:s.id,value:s,j})});
  requests.forEach(r=>{if(r.anon)return;const j=JSON.stringify(r);if(synced.request[r.id]!==j)puts.push({type:"request",id:r.id,value:r,j})});
  Object.keys(synced.request).forEach(id=>{if(!requests.some(r=>r.id===id))puts.push({type:"delRequest",id})});
  new Set([...Object.keys(S.sessions),...Object.keys(synced.session)]).forEach(k=>{const j=S.sessions[k]?JSON.stringify(S.sessions[k]):undefined;if(synced.session[k]!==j)puts.push({type:"session",key:k,value:S.sessions[k]||null,j})});
  if(isT){
    if(ME.owner)classroom.classes.forEach(c=>{if(synced.classMap[c.id]!==c.teacher)puts.push({type:"classMap",courseId:c.id,teacher:c.teacher})})}
  return puts}
function queueSync(){if(!ME||S.viewAs)return;clearTimeout(syncTimer);syncTimer=setTimeout(runSync,350)}
const withRev=(j,rev)=>{const o=JSON.parse(j);o.rev=rev;return JSON.stringify(o)};
function replaceIn(arr,id,val){const i=arr.findIndex(x=>x.id===id);if(i>=0){if(val)arr[i]=val;else arr.splice(i,1)}else if(val)arr.push(val)}
async function runSync(){
  if(syncing){again=true;return}
  const puts=collect();if(!puts.length)return;
  syncing=true;setSave("saving");clearTimeout(retryTimer);
  try{
    const body={puts:puts.map(({j,id,...p})=>p.type==="delRequest"?{type:p.type,id}:p)};if(STORE_CODE)body.code=STORE_CODE;
    const res=await API(STORE_CODE?"/api/store":"/api/data",{method:"POST",body:JSON.stringify(body)});
    let conflicts=0,refused="",redraw=false;
    res.results.forEach((r,i)=>{const p=puts[i];if(!p)return;
      if(p.type==="teacher"){if(r.ok){teachers[p.id].rev=r.value.rev;synced.teacher[p.id]=withRev(p.j,r.value.rev)}else if(r.value){teachers[p.id]=r.value;synced.teacher[p.id]=JSON.stringify(r.value);conflicts++;redraw=true}else refused=r.error}
      else if(p.type==="student"){if(r.ok){if(ME.role==="student"){replaceIn(students,p.id,r.value);synced.student[p.id]=JSON.stringify(r.value)}else{const s=students.find(x=>x.id===p.id);if(s)s.rev=r.value.rev;synced.student[p.id]=withRev(p.j,r.value.rev)}}
        else if(r.value){replaceIn(students,p.id,r.value);synced.student[p.id]=JSON.stringify(r.value);conflicts++;redraw=true}else refused=r.error}
      else if(p.type==="trial"){if(r.ok){if(ME.role==="store"){replaceIn(trials,p.id,r.value);synced.trial[p.id]=JSON.stringify(r.value)}else{const x=trials.find(y=>y.id===p.id);if(x)x.rev=r.value.rev;synced.trial[p.id]=withRev(p.j,r.value.rev)}}
        else if(r.value){replaceIn(trials,p.id,r.value);synced.trial[p.id]=JSON.stringify(r.value);conflicts++;redraw=true}else{replaceIn(trials,p.id,null);delete synced.trial[p.id];refused=r.error;redraw=true}}
      else if(p.type==="store"){if(r.ok){store.rev=r.value.rev;synced.store=withRev(p.j,r.value.rev)}else if(r.value){Object.assign(store,r.value);synced.store=JSON.stringify(store);conflicts++;redraw=true}else refused=r.error}
      else if(p.type==="request"&&ME.role==="student"){if(r.ok){replaceIn(requests,p.id,r.value);synced.request[p.id]=JSON.stringify(r.value)}else{if(r.value){replaceIn(requests,p.id,r.value);synced.request[p.id]=JSON.stringify(r.value)}else{replaceIn(requests,p.id,null);delete synced.request[p.id]}refused=r.error;redraw=true}}
      else if(p.type==="request"){if(r.ok){const q=requests.find(x=>x.id===p.id);if(q)q.rev=r.value.rev;synced.request[p.id]=withRev(p.j,r.value.rev)}
        else if(r.value){replaceIn(requests,p.id,r.value);synced.request[p.id]=JSON.stringify(r.value);conflicts++;redraw=true}else{replaceIn(requests,p.id,null);delete synced.request[p.id];refused=r.error;redraw=true}}
      else if(p.type==="delRequest"){if(r.ok)delete synced.request[p.id];else if(r.value){requests.push(r.value);synced.request[p.id]=JSON.stringify(r.value);refused=r.error;redraw=true}}
      else if(p.type==="session"){const sv=r.value||null;if(sv)S.sessions[p.key]=sv;else delete S.sessions[p.key];if(sv)synced.session[p.key]=JSON.stringify(sv);else delete synced.session[p.key];if(!r.ok){refused=r.error;redraw=true}}
      else if(p.type==="classMap"){if(r.ok)synced.classMap[p.courseId]=p.teacher;else refused=r.error}});
    if(conflicts)toast("Someone else changed this at the same moment, so you're seeing their version. Make your change again if it's still needed.");
    else if(refused)toast("Not saved: "+refused);
    else if(res.mail&&res.mail.failed)toast("Saved, but an email didn't send"+(res.mail.errors&&res.mail.errors[0]?": "+res.mail.errors[0]:"."));
    setSave(refused?"error":"saved",refused?"Not saved":"");
    if(redraw)render(false);
  }catch(e){
    if(e.status===401||e.status===403||(STORE_CODE&&e.status===404)){location.reload();return}
    setSave("error","Not saved, retrying");retryTimer=setTimeout(runSync,5000);
  }finally{syncing=false;if(again){again=false;runSync()}}
}
["click","change","submit"].forEach(ev=>document.addEventListener(ev,queueSync));
window.addEventListener("beforeunload",e=>{if(ME&&!S.viewAs&&(syncing||collect().length)){runSync();e.preventDefault();e.returnValue=""}});
let lastLoad=Date.now();
window.addEventListener("focus",()=>{if(!ME||S.viewAs||syncing||Date.now()-lastLoad<60000||collect().length||S.form||S.dialog||S.pay||S.req||S.restore)return;
  lastLoad=Date.now();load().then(()=>render(false)).catch(()=>{})});
function saveDismissed(){try{localStorage.setItem("sgls-dismissed-"+(ME&&ME.email),JSON.stringify([...S.dismissed]))}catch(e){}}
function loadDismissed(){try{S.dismissed=new Set(JSON.parse(localStorage.getItem("sgls-dismissed-"+(ME&&ME.email))||"[]"))}catch(e){S.dismissed=new Set()}}

/* ---------- sign in ---------- */
function showGate(msg,clientId){
  $("#appRoot").hidden=true;$("#gate").hidden=false;$("#gateMsg").textContent=msg||"";
  if(!clientId)return;
  const init=()=>{if(!(window.google&&google.accounts&&google.accounts.id))return setTimeout(init,150);
    google.accounts.id.initialize({client_id:clientId,callback:onCredential,ux_mode:"popup",auto_select:false});
    google.accounts.id.renderButton($("#gbtn"),{theme:"filled_black",size:"large",shape:"pill",text:"signin_with",width:280})};
  init()}
const rosterMsg=email=>`${email} isn't on the studio roster yet. Ask Sarah or Mitchell to add that email to your details, then sign in again.`;
async function onCredential(resp){
  $("#gateMsg").textContent="Signing in…";
  try{await API("/api/auth",{method:"POST",body:JSON.stringify({credential:resp.credential})});location.replace("/")}
  catch(e){$("#gateMsg").textContent=e.body&&e.body.error==="not_on_roster"?rosterMsg(e.body.email):e.message}}
const GC_MSG={connected:"Google Classroom connected, read only.",cancelled:"Classroom connection cancelled.",expired:"That took too long. Try connecting again.",owner:"Only Sarah can connect Classroom.",notsetup:"Classroom isn't set up on the server yet.",error:"Google Classroom didn't connect. Try again."};
async function boot(){
  const sm=location.pathname.match(/^\/store\/([A-Za-z0-9]+)/);
  if(sm){STORE_CODE=sm[1];document.title="Book a Get to Know Session · Sarah Griego Music";
    try{await load()}catch(e){$(".gate-sub").textContent="";return showGate(e.message)}
    ME={role:"store"};S.as="store";S.tab="book";S.storeT="sarah";S.dismissed=new Set();
    $("#gate").hidden=true;$("#appRoot").hidden=false;render(true);return}
  const q=new URLSearchParams(location.search),gc=q.get("gc");if(location.search)history.replaceState(null,"",location.pathname);
  let a;try{a=await API("/api/auth")}catch(e){return showGate(e.message)}
  if(!a.signedIn)return showGate(a.notOnRoster?rosterMsg(a.notOnRoster):"",a.clientId);
  try{await load()}catch(e){return showGate(e.message)}
  S.as=ME.id;loadDismissed();
  if(ME.role==="student")S.tab="dash";
  if(gc&&ME.role==="teacher")S.screen="settings";
  $("#gate").hidden=true;$("#appRoot").hidden=false;
  render(true);
  if(gc)toast(GC_MSG[gc]||"");
}
boot();
})();
