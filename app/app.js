/* ============ DNK RMC Billing — MVP app logic (no build, localStorage) ============ */
const DB_KEY = 'dnk_rmc_v4';
/* Default concrete mix design per Cum (kg unless noted) — used for batching slips */
const DEFAULT_MIX = {cement:400,sand:650,agg20:720,agg12:480,water:170,admix:3.5};
/* local calendar date (not UTC), and timezone-safe date arithmetic on YYYY-MM-DD */
const todayISO = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
function addDaysISO(iso,n){ const [y,m,d]=iso.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d)); dt.setUTCDate(dt.getUTCDate()+n); return dt.toISOString().slice(0,10); }
function diffDaysISO(a,b){ const A=a.split('-').map(Number),B=b.split('-').map(Number); return (Date.UTC(A[0],A[1]-1,A[2])-Date.UTC(B[0],B[1]-1,B[2]))/86400000; }

/* Client-side password obfuscation (cyrb64). NOTE: this is not strong crypto —
   localStorage data is readable on the device regardless; it just avoids storing
   plain-text passwords. Real account security needs Firebase Auth (server-side). */
function hashStr(s){
  s='dnk$'+String(s==null?'':s);
  let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<s.length;i++){ const ch=s.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507); h1^=Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507); h2^=Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0');
}
function normKey(s){ return String(s==null?'':s).trim().toLowerCase(); }

/* Feature toggles — Admin can enable/disable modules from Settings without a rebuild.
   Core modules (dashboard, settings, users) are always on so admin can't lock out. */
const CORE_FEATURES = {dashboard:1,settings:1,users:1};
function featureOn(r){ if(CORE_FEATURES[r]) return true; return !DB.features || DB.features[r]!==false; }

/* Role presets — Admin (full), Accountant (operations, no users/settings/audit),
   Auditor (read-only: can view records & audit log, cannot create/edit/delete). */
const ROLE_PERMS = {
  Admin:      {dashboard:1,newinvoice:1,invoices:1,payments:1,inventory:1,staff:1,payroll:1,vendors:1,leads:1,concalc:1,revenue:1,customers:1,sites:1,vehicles:1,grades:1,rates:1,reports:1,activity:1,users:1,settings:1},
  Accountant: {dashboard:1,newinvoice:1,invoices:1,payments:1,inventory:1,staff:1,payroll:1,vendors:1,leads:1,concalc:1,revenue:1,customers:1,sites:1,vehicles:1,grades:1,rates:1,reports:1,activity:0,users:0,settings:0},
  Auditor:    {dashboard:1,newinvoice:0,invoices:1,payments:1,inventory:1,staff:1,payroll:1,vendors:1,leads:0,concalc:0,revenue:0,customers:1,sites:1,vehicles:1,grades:1,rates:1,reports:1,activity:1,users:0,settings:0}
};
/* Auditor is read-only — this gate blocks every create/edit/delete action. */
function canEdit(){ return !(ME && ME.role==='Auditor'); }
function guardEdit(){ if(!canEdit()){ toast('Auditor access is read-only','err'); return false; } return true; }
function nowStamp(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19).replace('T',' '); }
/* Activity / audit trail — records who did what, timestamped */
function logAct(action,detail){
  try{
    DB.activity=DB.activity||[];
    DB.activity.push({id:uid('ac'),at:nowStamp(),user:(ME&&ME.name)||'System',role:(ME&&ME.role)||'',action,detail:detail||''});
    if(DB.activity.length>2000) DB.activity=DB.activity.slice(-2000);
  }catch(e){}
}

/* ---------------- Seed data (from the sample invoice) ---------------- */
function seed(){
  return {
    company:{
      name:"DNK POWER CONMIX",
      addressLines:["#252/2A, Gandaramakulapalli,","Kuppam Main Road, Near Shell Petrol Bunk,","Atrapalli Road, V.KOTA - 517 424,","Chittoor Dist., Andhra Pradesh"],
      gstin:"37ATRPK7789E1ZU", stateName:"Andhra Pradesh", stateCode:"37",
      email:"dnkpowerconmix@gmail.com", phone:"9731443207",
      bank:{name:"DNK POWER CONMIX",bank:"STATE BANK OF INDIA",acno:"44420047909",branch:"ACB PALAMANER",ifsc:"SBIN0000266"}
    },
    grades:[
      {id:'g1',name:'M-15',hsn:'38245010',gst:18,mix:{cement:250,sand:700,agg20:700,agg12:460,water:180,admix:2.0}},
      {id:'g2',name:'M-20',hsn:'38245010',gst:18,mix:{cement:320,sand:690,agg20:720,agg12:480,water:180,admix:2.6}},
      {id:'g3',name:'M-20S',hsn:'38245010',gst:18,mix:{cement:330,sand:680,agg20:720,agg12:480,water:180,admix:2.8}},
      {id:'g4',name:'M-25',hsn:'38245010',gst:18,mix:{cement:360,sand:670,agg20:720,agg12:480,water:175,admix:3.0}},
      {id:'g5',name:'M-30',hsn:'38245010',gst:18,mix:{cement:400,sand:650,agg20:720,agg12:480,water:170,admix:3.6}},
      {id:'g6',name:'M-35',hsn:'38245010',gst:18,mix:{cement:430,sand:640,agg20:720,agg12:480,water:165,admix:4.0}},
      {id:'g7',name:'M-40',hsn:'38245010',gst:18,mix:{cement:460,sand:630,agg20:720,agg12:480,water:160,admix:4.6}},
    ],
    customers:[
      {id:'c1',name:'S & A INFRA',gstin:'24AEBFS2259C1ZE',state:'Gujarat',stateCode:'24',
        address:'Shop no. 7, Padma Shopping Centre,\nBhula Nagar Chanod, Vapi, Valsad,\nGujarat - 396191',phone:''},
      {id:'c2',name:'Sri Balaji Constructions',gstin:'37ABCDS1234E1Z5',state:'Andhra Pradesh',stateCode:'37',
        address:'Kuppam Road, Palamaner,\nChittoor Dist., Andhra Pradesh - 517408',phone:'9876543210'},
      {id:'c3',name:'Ravi Kumar (Individual)',gstin:'',state:'Andhra Pradesh',stateCode:'37',
        address:'H.No 4-521, Bypass Road,\nV.Kota, Chittoor Dist., A.P. - 517424',phone:'9700011223'},
    ],
    sites:[
      {id:'s1',customerId:'c1',name:'Ultra Tech Constructions',
        address:'Hindalco Industries Ltd, Kuppam,\nChittoor, Andhra Pradesh - 517424'},
      {id:'s2',customerId:'c2',name:'Balaji Township Phase-1',
        address:'Palamaner Bypass Road, Chittoor, A.P.'},
    ],
    vehicles:[
      {id:'v1',number:'AP39WQ0715',driver:'Ramesh K',driverPhone:'9012345678',capacity:'6.5'},
      {id:'v2',number:'AP03TM4420',driver:'Suresh M',driverPhone:'9034567890',capacity:'7.0'},
    ],
    rates:[
      {id:'r1',customerId:'c1',gradeId:'g5',rate:5050},   // S&A INFRA + M-30
      {id:'r2',customerId:'c1',gradeId:'g4',rate:4800},
      {id:'r3',customerId:'c2',gradeId:'g4',rate:4650},
      {id:'r4',customerId:'c2',gradeId:'g2',rate:4200},
      {id:'r5',customerId:'c3',gradeId:'g2',rate:4200},   // domestic buyer M-20
    ],
    invoices:[
      {id:'i1',no:'DNK/1401',date:'2026-07-04',customerId:'c1',siteId:'s1',gradeId:'g5',
        vehicleId:'v1',qty:6.5,rate:5050,unit:'Cum',terms:'Immediate',dispatchThrough:'Transit Mixer',
        paid:0, createdAt:'2026-07-04'},
      {id:'i2',no:'DNK/1402',date:'2026-07-06',customerId:'c3',siteId:'',gradeId:'g2',
        vehicleId:'v2',qty:4,rate:4200,unit:'Cum',terms:'Cash',dispatchThrough:'Transit Mixer',
        paid:0, createdAt:'2026-07-06'},   // domestic — no GST
    ],
    payments:[],
    users:[
      {id:'u1',name:'Administrator',username:'admin',role:'Admin',active:true,perms:{...ROLE_PERMS.Admin},pwd:hashStr('admin@123'),secQ:'In which town is the plant located?',secA:hashStr('vkota')},
      {id:'u2',name:'Priya (Accountant)',username:'accountant',role:'Accountant',active:true,perms:{...ROLE_PERMS.Accountant},pwd:hashStr('accountant@123'),secQ:'In which town is the plant located?',secA:hashStr('vkota')},
      {id:'u3',name:'Auditor',username:'auditor',role:'Auditor',active:true,perms:{...ROLE_PERMS.Auditor},pwd:hashStr('auditor@123'),secQ:'In which town is the plant located?',secA:hashStr('vkota')},
    ],
    features:{},
    leads:[
      {id:'l1',name:'Prakash Builders',contact:'Mr. Prakash',phone:'9845012345',source:'Reference',
        requirement:'M-25, approx 200 Cum for apartment slab',value:900000,status:'Contacted',nextFollowup:'2026-07-10',notes:'Wants bulk rate quote.'},
      {id:'l2',name:'Green Valley Villas',contact:'Ms. Latha',phone:'9848098480',source:'Website',
        requirement:'M-30 for villa foundations',value:1500000,status:'Quoted',nextFollowup:'2026-07-09',notes:'Sent quote at ₹5050/Cum.'},
      {id:'l3',name:'Kuppam Highway Toll',contact:'Site Engineer',phone:'9000090000',source:'Tender',
        requirement:'M-20 / M-15 large volume, 6 months',value:5000000,status:'New',nextFollowup:'2026-07-12',notes:''},
    ],
    products:[
      {id:'p1',name:'Cement (OPC 53 Grade)',category:'Cement',unit:'Bags',stock:420,reorder:100,rate:380},
      {id:'p2',name:'Coarse Aggregate 20mm',category:'Aggregate',unit:'MT',stock:85,reorder:30,rate:950},
      {id:'p3',name:'Coarse Aggregate 12mm',category:'Aggregate',unit:'MT',stock:26,reorder:25,rate:980},
      {id:'p4',name:'River / M-Sand',category:'Aggregate',unit:'MT',stock:40,reorder:20,rate:1100},
      {id:'p5',name:'Admixture (Superplasticizer)',category:'Admixture',unit:'Litre',stock:180,reorder:50,rate:85},
      {id:'p6',name:'Fly Ash',category:'Other',unit:'MT',stock:22,reorder:10,rate:2500},
    ],
    stockmoves:[
      {id:'sm1',productId:'p1',type:'in',qty:500,date:'2026-07-03',note:'Purchase (UltraTech)'},
      {id:'sm2',productId:'p1',type:'out',qty:80,date:'2026-07-04',note:'Batching — M-30 (DNK/1401)'},
      {id:'sm3',productId:'p2',type:'in',qty:100,date:'2026-07-02',note:'Purchase'},
      {id:'sm4',productId:'p5',type:'out',qty:12,date:'2026-07-04',note:'Batching — M-30'},
    ],
    staff:[
      {id:'st1',name:'Ramesh K',role:'Driver',phone:'9012345678',wage:650,monthlySalary:16900,joinDate:'2025-06-01',leaveAllowed:2,active:true},
      {id:'st2',name:'Suresh M',role:'Driver',phone:'9034567890',wage:650,monthlySalary:16900,joinDate:'2025-08-15',leaveAllowed:2,active:true},
      {id:'st3',name:'Anjaneyulu',role:'Batching Operator',phone:'9701122334',wage:800,monthlySalary:21000,joinDate:'2024-11-10',leaveAllowed:2,active:true},
      {id:'st4',name:'Lakshmi',role:'Office / Accounts',phone:'9885566778',wage:700,monthlySalary:18500,joinDate:'2025-01-05',leaveAllowed:3,active:true},
      {id:'st5',name:'Venkatesh',role:'Loader',phone:'9012000123',wage:550,monthlySalary:14500,joinDate:'2025-09-01',leaveAllowed:2,active:true},
    ],
    attendance:[],
    advances:[
      {id:'ad1',staffId:'st1',date:'2026-07-07',amount:2000,note:'Weekly advance'},
      {id:'ad2',staffId:'st1',date:'2026-07-14',amount:1500,note:'Weekly advance'},
      {id:'ad3',staffId:'st3',date:'2026-07-10',amount:3000,note:'Advance'},
    ],
    salaryRecords:[],
    vendors:[
      {id:'vn1',name:'UltraTech Cement Depot',gstin:'37AAACL1234M1Z5',phone:'9700000001',material:'Cement',address:'Palamaner, Chittoor Dist., A.P.'},
      {id:'vn2',name:'Sri Venkateswara Aggregates',gstin:'',phone:'9700000002',material:'Aggregate / Sand',address:'V.Kota, Chittoor Dist., A.P.'},
      {id:'vn3',name:'BASF Admixtures (Dealer)',gstin:'29AAACB1234N1Z2',phone:'9700000003',material:'Admixture',address:'Bengaluru, Karnataka'},
    ],
    purchases:[
      {id:'pu1',vendorId:'vn1',productId:'p1',qty:500,rate:360,amount:180000,date:'2026-07-03',billNo:'UT/5567',paid:180000,at:'2026-07-03 10:15:00'},
      {id:'pu2',vendorId:'vn2',productId:'p2',qty:100,rate:900,amount:90000,date:'2026-07-02',billNo:'SVA/221',paid:50000,at:'2026-07-02 09:30:00'},
    ],
    activity:[],
    seq:1402,
    user:{name:'Administrator',role:'Admin'}
  };
}

/* Storage layer — uses localStorage, falls back to in-memory if unavailable (sandboxed host) */
const store = (()=>{
  try{ const k='__t';localStorage.setItem(k,'1');localStorage.removeItem(k);
    return {get:k=>localStorage.getItem(k),set:(k,v)=>localStorage.setItem(k,v)}; }
  catch(e){ const m={}; return {get:k=>m[k]??null,set:(k,v)=>{m[k]=v;}}; }
})();
let DB = load();
function load(){
  try{ const raw=store.get(DB_KEY); if(raw) return migrate(JSON.parse(raw)); }catch(e){}
  const s=seed(); store.set(DB_KEY,JSON.stringify(s)); return s;
}
function migrate(d){
  const s=seed();
  ['grades','customers','sites','vehicles','rates','invoices','payments','users','leads','products','stockmoves','staff','attendance','advances','salaryRecords','vendors','purchases','activity'].forEach(k=>{ if(!Array.isArray(d[k])) d[k]=s[k]; });
  if(!d.company) d.company=s.company;
  if(d.seq==null) d.seq=s.seq;
  // backfill grade mix designs
  d.grades.forEach(g=>{ if(!g.mix){ const sg=s.grades.find(x=>x.name===g.name); g.mix = sg?sg.mix:{...DEFAULT_MIX}; } });
  // backfill staff HR fields
  d.staff.forEach(st=>{ if(st.monthlySalary==null) st.monthlySalary=(st.wage||0)*26; if(st.leaveAllowed==null) st.leaveAllowed=2; if(st.joinDate==null) st.joinDate=''; });
  // feature toggles + user credentials
  if(!d.features||typeof d.features!=='object') d.features={};
  d.users.forEach(u=>{ if(!u.pwd) u.pwd=hashStr((u.username||'user')+'@123'); if(!u.secQ){ u.secQ='In which town is the plant located?'; u.secA=hashStr('vkota'); } });
  return d;
}
function save(){ store.set(DB_KEY,JSON.stringify(DB)); }
function uid(p){ return p+Math.random().toString(36).slice(2,8); }

/* ---------------- Helpers to hydrate an invoice ---------------- */
function grade(id){ return DB.grades.find(g=>g.id===id)||{}; }
function customer(id){ return DB.customers.find(c=>c.id===id)||{}; }
function site(id){ return DB.sites.find(s=>s.id===id)||{}; }
function vehicle(id){ return DB.vehicles.find(v=>v.id===id)||{}; }
function rateFor(customerId,gradeId){ const r=DB.rates.find(r=>r.customerId===customerId&&r.gradeId===gradeId); return r?r.rate:0; }

function hydrate(inv){
  const c=customer(inv.customerId), s=site(inv.siteId), g=grade(inv.gradeId), v=vehicle(inv.vehicleId);
  return {
    ...inv,
    buyerName:c.name, buyerAddress:c.address, buyerGstin:c.gstin, buyerState:c.state, buyerStateCode:c.stateCode,
    siteName:s.name, siteAddress:s.address,
    gradeName:g.name, hsn:g.hsn, gstRate:g.gst,
    vehicle:v.number, driver:v.driver, unit:inv.unit||'Cum'
  };
}
function invTotals(inv){ return computeInvoice(hydrate(inv), DB.company); }

/* ---------------- Router ---------------- */
const routes = {
  dashboard:renderDashboard, newinvoice:renderNewInvoice, invoices:renderInvoices,
  payments:renderPayments, customers:renderCustomers, sites:renderSites,
  vehicles:renderVehicles, grades:renderGrades, rates:renderRates,
  reports:renderReports, settings:renderSettings,
  leads:renderLeads, concalc:renderConcalc, revenue:renderRevenue, users:renderUsers,
  inventory:renderInventory, staff:renderStaff, payroll:renderPayroll,
  vendors:renderVendors, activity:renderActivity
};
let current='dashboard';
function go(route){ current=route; renderApp(); }

/* ---------------- Auth & session user ---------------- */
const authGet=()=>{try{return sessionStorage.getItem('dnk_auth')==='1';}catch(e){return false;}};
const authSet=v=>{try{v?sessionStorage.setItem('dnk_auth','1'):sessionStorage.removeItem('dnk_auth');}catch(e){}};
const meGet=()=>{try{return JSON.parse(sessionStorage.getItem('dnk_user')||'null');}catch(e){return null;}};
const meSet=u=>{try{u?sessionStorage.setItem('dnk_user',JSON.stringify(u)):sessionStorage.removeItem('dnk_user');}catch(e){}};
let ME = meGet();
let loggedIn = authGet();
function myPerms(){ return (ME&&ME.perms) || (ME&&ROLE_PERMS[ME.role]) || ROLE_PERMS.Admin; }
function can(route){ return !!myPerms()[route]; }
function renderLogin(){
  document.getElementById('root').innerHTML = `
  <div class="login-wrap"><div class="login-split">
    <div class="login-left">
      <img src="${window.LOGO_DATA}" alt="DNK Power Conmix">
      <h1>DNK POWER CONMIX</h1>
      <div class="tag">RMC Concrete</div>
      <p>Billing &amp; Plant Management System<br>V.Kota, Chittoor Dist., Andhra Pradesh</p>
    </div>
    <div class="login-right">
      <h2>Sign in</h2>
      <div class="sub">Access the billing &amp; plant management system</div>
      <div class="field"><label>Username or Email</label><input id="u" autocomplete="username" placeholder="Enter your username or email" onkeydown="if(event.key==='Enter')doLogin()"></div>
      <div class="field" style="margin-top:14px"><label>Password</label>
        <div class="pwd-wrap"><input id="p" type="password" autocomplete="current-password" placeholder="Enter your password" onkeydown="if(event.key==='Enter')doLogin()">
        <button type="button" class="pwd-eye" onclick="togglePwd('p',this)" tabindex="-1">👁</button></div></div>
      <div class="login-row"><a class="link" onclick="forgotModal()">Forgot password?</a></div>
      <button class="btn primary block" onclick="doLogin()">Sign in →</button>
    </div>
  </div></div>`;
}
function togglePwd(id,btn){ const e=document.getElementById(id); if(!e)return; e.type=e.type==='password'?'text':'password'; if(btn) btn.classList.toggle('on',e.type==='text'); }
function findUserByLogin(id){ id=normKey(id); return (DB.users||[]).find(x=>normKey(x.username)===id || (x.email&&normKey(x.email)===id)); }
function localPwdOk(user,pwd){ return !user.pwd || user.pwd===hashStr(pwd); }
function doLogin(){
  const idRaw=val('u'); const pwd=document.getElementById('p')?document.getElementById('p').value:'';
  if(!idRaw) return toast('Enter your username or email','err');
  const user=findUserByLogin(idRaw);
  if(!user) return toast('No account found for that username / email','err');
  if(user.active===false) return toast('This account is disabled — contact the administrator','err');
  // Email accounts authenticate against Firebase Auth (cloud) when online.
  if(user.email && window.fbAuth){
    toast('Signing in…');
    window.fbAuth.signInWithEmailAndPassword(user.email, pwd).then(()=>{
      user.pwd=hashStr(pwd); save(); finishLogin(user);        // mirror pwd locally for offline
    }).catch(err=>{
      const code=(err&&err.code)||'';
      if(code==='auth/network-request-failed'){                // offline → local fallback
        if(localPwdOk(user,pwd)) finishLogin(user); else toast('Offline — use your last synced password','err');
      } else if(code==='auth/wrong-password'||code==='auth/invalid-credential'||code==='auth/invalid-login-credentials'){
        if(user.pwd && user.pwd===hashStr(pwd)) finishLogin(user); else toast('Incorrect email or password','err');
      } else if(code==='auth/user-not-found'){
        if(localPwdOk(user,pwd)) finishLogin(user); else toast('Incorrect password','err');
      } else if(code==='auth/too-many-requests'){
        toast('Too many attempts — try again shortly','err');
      } else {
        if(localPwdOk(user,pwd)) finishLogin(user); else toast((err&&err.message)||'Sign-in failed','err');
      }
    });
    return;
  }
  // Local (username) accounts / offline
  if(!localPwdOk(user,pwd)) return toast('Incorrect password','err');
  finishLogin(user);
}
function finishLogin(user){
  ME={id:user.id,name:user.name,username:user.username,email:user.email||'',role:user.role,perms:{...(user.perms||ROLE_PERMS[user.role]||ROLE_PERMS.Admin)}};
  meSet(ME); DB.user={name:user.name,role:user.role}; loggedIn=true; authSet(true); current='dashboard';
  logAct('Login','Signed in ('+user.role+')'); save(); renderApp();
}
function logout(){ if(ME) logAct('Logout',''); save(); loggedIn=false; ME=null; authSet(false); meSet(null);
  try{ if(window.fbAuth&&window.fbAuth.currentUser) window.fbAuth.signOut(); }catch(e){}
  renderApp(); }
/* Create a Firebase Auth account without disturbing the current session (secondary app). */
function fbCreateAccount(email,password){
  return new Promise(resolve=>{
    if(!window.firebase||!window.fbApp||!email||!password){ resolve({skipped:true}); return; }
    let sec;
    try{ sec=window.firebase.initializeApp(window.fbApp.options,'sec_'+Math.floor(new Date().getTime())); }
    catch(e){ resolve({skipped:true}); return; }
    sec.auth().createUserWithEmailAndPassword(email,password)
      .then(()=>{ try{sec.auth().signOut();}catch(e){} try{sec.delete();}catch(e){} resolve({created:true}); })
      .catch(err=>{ try{sec.delete();}catch(e){} const c=(err&&err.code)||'';
        if(c==='auth/email-already-in-use') resolve({exists:true});
        else resolve({error:(err&&err.message)||'Firebase account not created'}); });
  });
}
/* ---- Forgot password (client-side self-service via security question) ---- */
function forgotModal(){
  modal('Forgot Password',
    `<div class="field"><label>Your Username or Email</label><input id="fg_user" placeholder="e.g. admin or you@email.com"></div>
     <div class="muted" style="font-size:12px;margin-top:10px">If your account has an email on file, we'll email you a secure password-reset link.
     Otherwise we'll verify your security question so you can set a new password.</div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="forgotNext()">Continue →</button>`);
}
function forgotNext(){
  const idv=normKey(val('fg_user'));
  if(!idv) return toast('Enter your username or email','err');
  const u=findUserByLogin(idv);
  if(!u) return toast('No account found','err');
  // Real reset email via Firebase when the account has an email
  if(u.email && window.fbAuth){
    toast('Sending reset link…');
    window.fbAuth.sendPasswordResetEmail(u.email).then(()=>{
      logAct('Password reset email','Sent to '+u.email); save();
      closeModal(); toast('Reset link sent to '+u.email,'ok');
    }).catch(err=>{
      const c=(err&&err.code)||'';
      if(c==='auth/user-not-found'){ toast('No email account on file — using security question','err'); forgotSecurity(u); }
      else if(c==='auth/network-request-failed'){ toast('Offline — using security question','err'); forgotSecurity(u); }
      else toast((err&&err.message)||'Could not send reset email','err');
    });
    return;
  }
  forgotSecurity(u);
}
function forgotSecurity(u){
  if(!u.secQ||!u.secA) return toast('No security question set — ask your admin to reset it','err');
  closeModal();
  modal('Reset Password — '+u.name,
    `<div class="field"><label>Security Question</label><div class="static-field">${u.secQ}</div></div>
     <div class="field" style="margin-top:12px"><label>Your Answer *</label><input id="fg_ans" placeholder="Your answer"></div>
     <div class="field" style="margin-top:12px"><label>New Password *</label>
       <div class="pwd-wrap"><input id="fg_new" type="password" placeholder="At least 4 characters"><button type="button" class="pwd-eye" onclick="togglePwd('fg_new',this)" tabindex="-1">👁</button></div></div>
     <div class="field" style="margin-top:12px"><label>Confirm New Password *</label><input id="fg_new2" type="password"></div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn green" onclick="forgotReset('${u.id}')">Reset Password</button>`);
}
function forgotReset(id){
  const u=(DB.users||[]).find(x=>x.id===id); if(!u) return;
  const ans=val('fg_ans'), np=document.getElementById('fg_new').value, np2=document.getElementById('fg_new2').value;
  if(hashStr(normKey(ans))!==u.secA) return toast('Security answer is incorrect','err');
  if(!np||np.length<4) return toast('New password must be at least 4 characters','err');
  if(np!==np2) return toast('Passwords do not match','err');
  u.pwd=hashStr(np); logAct('Password reset','Self-service reset — '+u.username); save(); closeModal();
  toast('Password updated — please sign in with your new password','ok');
}

/* ---------------- Shell ---------------- */
const NAV=[
  {grp:'Operations',items:[
    {r:'dashboard',ic:'📊',t:'Dashboard'},
    {r:'newinvoice',ic:'➕',t:'New Dispatch / Bill'},
    {r:'invoices',ic:'🧾',t:'Invoices'},
    {r:'payments',ic:'💰',t:'Outstanding'},
  ]},
  {grp:'Plant & Staff',items:[
    {r:'inventory',ic:'📦',t:'Product Inventory'},
    {r:'vendors',ic:'🚛',t:'Vendors & Purchases'},
    {r:'staff',ic:'🧑‍🏭',t:'Staff Attendance'},
    {r:'payroll',ic:'🧾',t:'Salary / Payroll'},
  ]},
  {grp:'Sales Tools',items:[
    {r:'leads',ic:'🎯',t:'Leads & Follow-up'},
    {r:'concalc',ic:'📐',t:'Concrete Calculator'},
    {r:'revenue',ic:'💹',t:'Revenue Calculator'},
  ]},
  {grp:'Masters',items:[
    {r:'customers',ic:'🏢',t:'Customers'},
    {r:'sites',ic:'📍',t:'Sites / Projects'},
    {r:'vehicles',ic:'🚚',t:'Vehicles & Drivers'},
    {r:'grades',ic:'🧱',t:'Concrete Grades'},
    {r:'rates',ic:'🏷️',t:'Rate Master'},
  ]},
  {grp:'Insights',items:[
    {r:'reports',ic:'📈',t:'Reports & Export'},
    {r:'activity',ic:'🕒',t:'Activity Log'},
    {r:'users',ic:'👥',t:'Users & Permissions'},
    {r:'settings',ic:'⚙️',t:'Settings & Backup'},
  ]},
];
function renderApp(){
  if(!loggedIn){ renderLogin(); return; }
  const perms=myPerms();
  const nav = NAV.map(g=>{
    const items=g.items.filter(i=>perms[i.r] && featureOn(i.r));
    if(!items.length) return '';
    return `<div class="grp">${g.grp}</div>`+items.map(i=>
      `<a class="${current===i.r?'active':''}" onclick="go('${i.r}')"><span class="ic">${i.ic}</span><span class="nt">${i.t}</span></a>`).join('');
  }).join('');
  document.getElementById('root').innerHTML=`
  <div class="app">
    <div class="sidebar">
      <div class="brand"><img src="${window.LOGO_DATA}"><div><div class="bt">DNK POWER CONMIX</div><div class="bs">RMC BILLING SYSTEM</div></div></div>
      <div class="nav">${nav}</div>
    </div>
    <div class="main" id="main"></div>
  </div>`;
  if(!perms[current] || !featureOn(current)) current='dashboard';
  (routes[current]||renderDashboard)();
}
function topbar(title,sub,actions){
  const u=ME||{name:'Administrator',role:'Admin'};
  return `<div class="topbar"><div><h2>${title}</h2><div class="sub">${sub||''}</div></div>
    <div style="display:flex;gap:14px;align-items:center">
    ${actions||''}
    <div class="userchip">👤 <div><b>${u.name}</b><br><span>${u.role}${u.role==='Auditor'?' • read-only':''}</span></div>
    <button class="btn ghost sm" onclick="logout()">Logout</button></div></div></div>`;
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const invs=DB.invoices;
  const today=todayISO();
  const thisMonth=today.slice(0,7);
  const monthInvs=invs.filter(i=>i.date.slice(0,7)===thisMonth);
  const todayInvs=invs.filter(i=>i.date===today);
  const todayCum=todayInvs.reduce((s,i)=>s+i.qty,0);
  const monthSales=monthInvs.reduce((s,i)=>s+invTotals(i).grand,0);
  const dueList=invs.filter(i=>invTotals(i).grand-(i.paid||0)>0.5);
  const totalOut=dueList.reduce((s,i)=>s+(invTotals(i).grand-(i.paid||0)),0);
  const dueCusts=new Set(dueList.map(i=>i.customerId)).size;
  const activeStaff=(DB.staff||[]).filter(s=>s.active!==false).length;
  const recent=[...invs].sort((a,b)=>(b.date+b.no).localeCompare(a.date+a.no)).slice(0,10);

  const dispatchRows = recent.length ? recent.map(i=>
     `<div class="dashrow"><div class="r-l">${fmtDate(i.date)} <span class="r-sub">${i.no}</span></div>
        <div class="r-r"><span class="r-q">${i.qty} m³</span>₹${inr(invTotals(i).grand)}</div></div>`).join('')
     : `<div class="empty">No dispatches yet.</div>`;
  const invoiceRows = recent.length ? recent.map(i=>
     `<div class="dashrow"><a class="r-l" onclick="printInvoice('${i.id}')">${i.no} <span class="r-sub">${fmtDate(i.date)}</span></a>
        <div class="r-r">₹${inr(invTotals(i).grand)}</div></div>`).join('')
     : `<div class="empty">No invoices yet.</div>`;

  document.getElementById('main').innerHTML=
    topbar('Dashboard','Live snapshot of plant operations',
      canEdit()?`<button class="btn gold" onclick="go('newinvoice')">➕ New Dispatch / Bill</button>`:'')+
    `<div class="dashkpis">
      <div class="dashkpi"><span class="k-ic">🚚</span><div class="k-lab">Today's Dispatch</div><div class="k-val">${todayCum.toFixed(2)} m³</div><div class="k-sub">${todayInvs.length} trip${todayInvs.length===1?'':'s'}</div></div>
      <div class="dashkpi"><span class="k-ic">📄</span><div class="k-lab">This Month Sales</div><div class="k-val">₹${inr(monthSales)}</div><div class="k-sub">Invoiced incl. GST</div></div>
      <div class="dashkpi"><span class="k-ic">🧾</span><div class="k-lab">Outstanding</div><div class="k-val">₹${inr(totalOut)}</div><div class="k-sub">${dueCusts} customer${dueCusts===1?'':'s'}</div></div>
      <div class="dashkpi"><span class="k-ic">👷</span><div class="k-lab">Active Staff</div><div class="k-val">${activeStaff}</div><div class="k-sub">On payroll</div></div>
    </div>
    <div class="dashcols">
      <div class="card"><div class="hd"><h3>Recent Dispatches</h3><a onclick="go('invoices')" class="btn ghost sm">View all →</a></div>
        <div class="bd" style="padding:0">${dispatchRows}</div></div>
      <div class="card"><div class="hd"><h3>Recent Invoices</h3><a onclick="go('invoices')" class="btn ghost sm">View all →</a></div>
        <div class="bd" style="padding:0">${invoiceRows}</div></div>
    </div>`;
}

function taxPill(t){
  if(t.noGst) return '<span class="pill nogst">No GST</span>';
  return t.interState?'<span class="pill igst">IGST 18%</span>':'<span class="pill gst">CGST+SGST</span>';
}
function invoiceTable(list){
  if(!list.length) return `<div class="empty">No invoices yet. Create your first dispatch bill.</div>`;
  return `<table class="table"><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Grade</th><th class="num">Qty</th><th class="num">Amount</th><th>Tax</th><th>Status</th><th></th></tr></thead><tbody>`+
    list.map(i=>{const t=invTotals(i);const due=t.grand-(i.paid||0);
      const st=due<=0.5?'<span class="pill paid">Paid</span>':(i.paid>0?'<span class="pill part">Partial</span>':'<span class="pill due">Due</span>');
      return `<tr>
        <td><b>${i.no}</b></td><td>${fmtDate(i.date)}</td><td>${customer(i.customerId).name||''}</td>
        <td>${grade(i.gradeId).name||''}</td><td class="num">${i.qty.toFixed(2)}</td>
        <td class="num"><b>₹${inr(t.grand)}</b></td>
        <td>${taxPill(t)}</td>
        <td>${st}</td>
        <td class="right"><button class="btn ghost sm" onclick="printInvoice('${i.id}')">🖨 PDF</button></td>
      </tr>`;}).join('')+`</tbody></table>`;
}

/* ---------------- New Invoice / Dispatch ---------------- */
let form={customerId:'',siteId:'',gradeId:'',vehicleId:'',qty:'',rate:'',date:todayISO(),unit:'Cum',terms:'Immediate',dispatchThrough:'Transit Mixer'};
function renderNewInvoice(){
  form={customerId:'',siteId:'',gradeId:'',vehicleId:'',qty:'',rate:'',date:todayISO(),unit:'Cum',terms:'Immediate',dispatchThrough:'Transit Mixer'};
  const nextNo='DNK/'+(DB.seq+1);
  document.getElementById('main').innerHTML=
    topbar('New Dispatch / Bill','Select masters — GST is calculated automatically. Invoice: <b>'+nextNo+'</b>')+
    `<div class="grid" style="grid-template-columns:1.4fr 1fr;align-items:start">
      <div class="card"><div class="hd"><h3>Dispatch Details</h3></div><div class="bd">
        <div class="form-grid">
          <div class="field"><label>Customer *</label>
            <select id="f_cust" onchange="onCust(this.value)"><option value="">— Select Customer —</option>
            ${DB.customers.map(c=>`<option value="${c.id}">${c.name} (${c.state})</option>`).join('')}</select></div>
          <div class="field"><label>Site / Project</label>
            <select id="f_site"><option value="">— Select Site —</option></select></div>
          <div class="field"><label>Concrete Grade *</label>
            <select id="f_grade" onchange="onGrade()"><option value="">— Select Grade —</option>
            ${DB.grades.map(g=>`<option value="${g.id}">${g.name}</option>`).join('')}</select></div>
          <div class="field"><label>Vehicle &amp; Driver</label>
            <select id="f_veh"><option value="">— Select Vehicle —</option>
            ${DB.vehicles.map(v=>`<option value="${v.id}">${v.number} — ${v.driver}</option>`).join('')}</select></div>
          <div class="field"><label>Quantity (Cum) *</label>
            <input id="f_qty" type="number" step="0.01" placeholder="e.g. 6.50" oninput="onCalc()"></div>
          <div class="field"><label>Rate per Cum (₹)</label>
            <input id="f_rate" type="number" step="0.01" placeholder="auto from Rate Master" oninput="onCalc()"></div>
          <div class="field"><label>Invoice Date</label><input id="f_date" type="date" value="${todayISO()}"></div>
          <div class="field"><label>Dispatched Through</label>
            <select id="f_dispatch"><option>Transit Mixer</option><option>Tipper</option><option>Pump</option></select></div>
        </div>
      </div></div>
      <div class="card"><div class="hd"><h3>Invoice Summary</h3></div><div class="bd">
        <div class="calc" id="calcBox">${calcBox()}</div>
        <button class="btn gold" style="width:100%;justify-content:center;margin-top:14px" onclick="saveInvoice()">✔ Generate Invoice &amp; PDF</button>
        <div class="muted small" style="margin-top:8px;font-size:11px;text-align:center">GST auto-set: <b>IGST 18%</b> for other states, <b>CGST 9% + SGST 9%</b> within Andhra Pradesh.</div>
      </div></div>
    </div>`;
}
function onCust(cid){
  form.customerId=cid;
  const opts=DB.sites.filter(s=>s.customerId===cid).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('f_site').innerHTML=`<option value="">— Select Site —</option>`+opts;
  autoRate(); onCalc();
}
function onGrade(){ autoRate(); onCalc(); }
function autoRate(){
  const cid=document.getElementById('f_cust').value, gid=document.getElementById('f_grade').value;
  if(cid&&gid){ const r=rateFor(cid,gid); if(r){ document.getElementById('f_rate').value=r; } }
}
function readForm(){
  form.customerId=document.getElementById('f_cust').value;
  form.siteId=document.getElementById('f_site').value;
  form.gradeId=document.getElementById('f_grade').value;
  form.vehicleId=document.getElementById('f_veh').value;
  form.qty=parseFloat(document.getElementById('f_qty').value)||0;
  form.rate=parseFloat(document.getElementById('f_rate').value)||0;
  form.date=document.getElementById('f_date').value;
  form.dispatchThrough=document.getElementById('f_dispatch').value;
}
function onCalc(){ readForm(); document.getElementById('calcBox').innerHTML=calcBox(); }
function calcBox(){
  const c=customer(form.customerId);
  const noGst = form.customerId && !(c.gstin && c.gstin.trim());
  const inter = c.stateCode && c.stateCode!==DB.company.stateCode;
  const g=grade(form.gradeId);
  const rate = noGst ? 0 : (g.gst!=null?g.gst:18);
  const taxable=round2((form.qty||0)*(form.rate||0));
  const tax=round2(taxable*rate/100);
  const grand=round2(taxable+tax);
  const half=rate/2;
  let gstRows;
  if(!form.customerId) gstRows=`<div class="row muted"><span>GST</span><span>select customer</span></div>`;
  else if(noGst) gstRows=`<div class="row" style="color:var(--green)"><span>GST</span><span><b>Not Applicable</b> (Domestic)</span></div>`;
  else if(inter) gstRows=`<div class="row"><span>IGST @ ${rate}%</span><span>₹ ${inr(tax)}</span></div>`;
  else gstRows=`<div class="row"><span>CGST @ ${half}%</span><span>₹ ${inr(round2(taxable*half/100))}</span></div>
         <div class="row"><span>SGST @ ${half}%</span><span>₹ ${inr(round2(taxable*half/100))}</span></div>`;
  return `
    <div class="row"><span>Taxable Value</span><span>₹ ${inr(taxable)}</span></div>
    ${gstRows}
    <div class="row total"><span>Grand Total</span><span>₹ ${inr(grand)}</span></div>
    ${noGst?`<div class="muted" style="font-size:11px;margin-top:4px">No GSTIN on this customer → billed without GST (Bill of Supply).</div>`:''}
    <div class="words">${taxable>0?numToWords(grand):'—'}</div>`;
}
function saveInvoice(){
  if(!guardEdit())return;
  readForm();
  if(!form.customerId){ return toast('Select a customer','err'); }
  if(!form.gradeId){ return toast('Select a concrete grade','err'); }
  if(!form.qty||form.qty<=0){ return toast('Enter quantity','err'); }
  if(!form.rate||form.rate<=0){ return toast('Enter rate','err'); }
  DB.seq+=1;
  const inv={id:uid('i'),no:'DNK/'+DB.seq,date:form.date,customerId:form.customerId,siteId:form.siteId,
    gradeId:form.gradeId,vehicleId:form.vehicleId,qty:form.qty,rate:form.rate,unit:'Cum',
    terms:form.terms,dispatchThrough:form.dispatchThrough,paid:0,createdAt:todayISO(),at:nowStamp()};
  DB.invoices.push(inv);
  logAct('Invoice created',inv.no+' — '+(customer(inv.customerId).name||'')+', '+(grade(inv.gradeId).name||'')+' '+inv.qty+' Cum, ₹'+inr(invTotals(inv).grand));
  save();
  toast('Invoice '+inv.no+' generated','ok');
  printInvoice(inv.id);
  go('invoices');
}
function printInvoice(id){ const inv=DB.invoices.find(i=>i.id===id); openPrint(invoiceHTML(hydrate(inv),DB.company)); }
function printChallan(id){ const inv=DB.invoices.find(i=>i.id===id); openPrint(invoiceHTML(hydrate(inv),DB.company,{challan:true})); }
function printBatch(id){ const inv=DB.invoices.find(i=>i.id===id); const g=grade(inv.gradeId); openPrint(batchSlipHTML(hydrate(inv),DB.company,g.mix||DEFAULT_MIX)); }

/* ---------------- Invoices list ---------------- */
let invSearch='', invCust='';
function renderInvoices(){
  document.getElementById('main').innerHTML=
    topbar('Invoices','Search, filter by customer, print & download',
      `<button class="btn gold" onclick="go('newinvoice')">➕ New Bill</button>`)+
    `<div class="toolbar">
      <input class="search" id="invSearch" placeholder="🔍 Search invoice no, customer, grade, vehicle…" value="${invSearch}" oninput="invSearch=this.value;drawInvList()">
      <select id="invCust" onchange="invCust=this.value;drawInvList()" style="max-width:230px">
        <option value="">All customers</option>
        ${DB.customers.map(c=>`<option value="${c.id}" ${invCust===c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
      <button class="btn ghost" onclick="exportInvoicesCSV(invCust)">⬇ Invoices CSV</button>
      <button class="btn ghost" onclick="zipModal()">🗜 Bulk ZIP</button>
      ${invCust?`<button class="btn ghost" onclick="exportTollCSV('${invCust}')">⬇ Toll Register</button>
        <button class="btn ghost" onclick="printStatement('${invCust}')">🖨 Statement PDF</button>`:''}
    </div>
    <div class="card"><div class="bd" style="padding:0" id="invList"></div></div>`;
  drawInvList();
}
function drawInvList(){
  const q=invSearch.toLowerCase();
  const list=DB.invoices.filter(i=>{
    if(invCust && i.customerId!==invCust) return false;
    const c=customer(i.customerId),g=grade(i.gradeId),v=vehicle(i.vehicleId);
    return !q || [i.no,c.name,g.name,v.number,i.date].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>b.no.localeCompare(a.no));
  document.getElementById('invList').innerHTML=
    (list.length?`<table class="table"><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Grade</th><th class="num">Qty</th><th class="num">Total</th><th class="num">Due</th><th>Status</th><th class="right">Actions</th></tr></thead><tbody>`+
    list.map(i=>{const t=invTotals(i);const due=t.grand-(i.paid||0);
      const st=due<=0.5?'<span class="pill paid">Paid</span>':(i.paid>0?'<span class="pill part">Partial</span>':'<span class="pill due">Due</span>');
      return `<tr>
        <td><b>${i.no}</b></td><td>${fmtDate(i.date)}</td><td>${customer(i.customerId).name}</td>
        <td>${grade(i.gradeId).name}</td><td class="num">${i.qty.toFixed(2)}</td>
        <td class="num"><b>₹${inr(t.grand)}</b></td><td class="num">${due>0.5?'₹'+inr(due):'—'}</td><td>${st}</td>
        <td class="right">
          <button class="btn ghost sm" onclick="printInvoice('${i.id}')">🧾 Invoice</button>
          <button class="btn ghost sm" onclick="printChallan('${i.id}')">📄 Challan</button>
          <button class="btn ghost sm" onclick="printBatch('${i.id}')">🧪 Batch Slip</button>
          ${due>0.5?`<button class="btn green sm" onclick="payModal('${i.id}')">💰 Pay</button>`:''}
          <button class="btn danger sm" onclick="delInvoice('${i.id}')">✕</button>
        </td></tr>`;}).join('')+`</tbody></table>`
    :`<div class="empty">No matching invoices.</div>`);
}
function delInvoice(id){ if(!guardEdit())return; const i=DB.invoices.find(x=>x.id===id);
  if(confirm('Delete invoice '+i.no+'? This cannot be undone.')){ DB.invoices=DB.invoices.filter(x=>x.id!==id); logAct('Invoice deleted',i.no); save(); drawInvList(); toast('Invoice deleted'); } }

/* ---------------- Payments / Outstanding ---------------- */
function renderPayments(){
  const due=DB.invoices.map(i=>({i,t:invTotals(i)})).filter(x=>x.t.grand-(x.i.paid||0)>0.5)
    .sort((a,b)=>a.i.date.localeCompare(b.i.date));
  const total=due.reduce((s,x)=>s+(x.t.grand-(x.i.paid||0)),0);
  document.getElementById('main').innerHTML=
    topbar('Outstanding Payments','Customers with pending dues')+
    `<div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
      <div class="kpi red"><div class="lab">Total Outstanding</div><div class="val">₹${inr(total)}</div><div class="sub">${due.length} pending bills</div></div>
      <div class="kpi green"><div class="lab">Collected (All)</div><div class="val">₹${inr(DB.invoices.reduce((s,i)=>s+(i.paid||0),0))}</div></div>
      <div class="kpi blue"><div class="lab">Total Billed</div><div class="val">₹${inr(DB.invoices.reduce((s,i)=>s+invTotals(i).grand,0))}</div></div>
    </div>
    <div class="card"><div class="hd"><h3>Pending Bills</h3></div><div class="bd" style="padding:0">
    ${due.length?`<table class="table"><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Due</th><th class="right"></th></tr></thead><tbody>`+
      due.map(({i,t})=>`<tr><td><b>${i.no}</b></td><td>${fmtDate(i.date)}</td><td>${customer(i.customerId).name}</td>
        <td class="num">₹${inr(t.grand)}</td><td class="num">₹${inr(i.paid||0)}</td><td class="num"><b>₹${inr(t.grand-(i.paid||0))}</b></td>
        <td class="right"><button class="btn green sm" onclick="payModal('${i.id}')">💰 Record Payment</button></td></tr>`).join('')+
      `</tbody></table>`:`<div class="empty">🎉 No outstanding payments. All bills cleared.</div>`}
    </div></div>
    ${paymentsLedger()}`;
}
/* Timestamped payment entries — recent receipts with date & time */
function paymentsLedger(){
  const pays=[...(DB.payments||[])].sort((a,b)=>String(b.at||b.date).localeCompare(String(a.at||a.date))).slice(0,25);
  if(!pays.length) return '';
  return `<div class="card" style="margin-top:16px"><div class="hd"><h3>Recent Payments (timestamped)</h3></div><div class="bd" style="padding:0">
    <table class="table"><thead><tr><th>Date / Time</th><th>Invoice</th><th>Customer</th><th class="num">Amount</th><th>Received by</th></tr></thead><tbody>`+
    pays.map(p=>{const i=DB.invoices.find(x=>x.id===p.invoiceId)||{};
      return `<tr><td style="white-space:nowrap">${p.at||fmtDate(p.date)}</td><td><b>${i.no||'-'}</b></td>
      <td>${customer(i.customerId).name||'-'}</td><td class="num">₹${inr(p.amount)}</td><td>${p.by||'-'}</td></tr>`;}).join('')+
    `</tbody></table></div></div>`;
}
function payModal(id){
  const i=DB.invoices.find(x=>x.id===id); const t=invTotals(i); const due=t.grand-(i.paid||0);
  modal('Record Payment — '+i.no,
    `<div class="calc"><div class="row"><span>Invoice Total</span><span>₹ ${inr(t.grand)}</span></div>
     <div class="row"><span>Already Paid</span><span>₹ ${inr(i.paid||0)}</span></div>
     <div class="row total"><span>Due</span><span>₹ ${inr(due)}</span></div></div>
     <div class="field" style="margin-top:14px"><label>Amount received (₹)</label><input id="payAmt" type="number" step="0.01" value="${due.toFixed(2)}"></div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button>
     <button class="btn green" onclick="doPay('${id}')">Save Payment</button>`);
}
function doPay(id){
  if(!guardEdit())return;
  const amt=parseFloat(document.getElementById('payAmt').value)||0;
  const i=DB.invoices.find(x=>x.id===id);
  i.paid=(i.paid||0)+amt; if(i.paid<0)i.paid=0;
  DB.payments.push({id:uid('p'),invoiceId:id,amount:amt,date:todayISO(),at:nowStamp(),by:(ME&&ME.name)||''});
  logAct('Payment received','₹'+inr(amt)+' on '+i.no+' ('+(customer(i.customerId).name||'')+')');
  save(); closeModal(); toast('Payment recorded','ok'); renderPayments();
}

/* ---------------- Masters: generic CRUD ---------------- */
function masterPage(title,sub,addLabel,addFn,tableHTML){
  const add = canEdit()?`<button class="btn gold" onclick="${addFn}">➕ ${addLabel}</button>`:'';
  document.getElementById('main').innerHTML=topbar(title,sub,add)+
    `<div class="card"><div class="bd" style="padding:0">${tableHTML}</div></div>`;
}

/* Customers */
function renderCustomers(){
  const rows=DB.customers.map(c=>{
    const noGst=!(c.gstin&&c.gstin.trim());
    const inter=c.stateCode!==DB.company.stateCode;
    const taxTag = noGst?'<span class="pill nogst">No GST (Domestic)</span>':(inter?'<span class="pill igst">IGST</span>':'<span class="pill gst">CGST/SGST</span>');
    const cnt=DB.invoices.filter(i=>i.customerId===c.id).length;
    return `<tr><td><b>${c.name}</b></td><td>${c.gstin||'—'}</td><td>${c.state} ${taxTag}</td>
      <td class="num">${cnt}</td>
      <td class="right">
        <button class="btn ghost sm" onclick="exportInvoicesCSV('${c.id}')" title="Download this customer's invoices">⬇ Invoices</button>
        <button class="btn ghost sm" onclick="exportTollCSV('${c.id}')" title="Download running toll register">⬇ Toll</button>
        <button class="btn ghost sm" onclick="printStatement('${c.id}')" title="Printable account statement">🖨 Statement</button>
        <button class="btn ghost sm" onclick="custModal('${c.id}')">✎</button>
        <button class="btn danger sm" onclick="delCust('${c.id}')">✕</button></td></tr>`;}).join('');
  masterPage('Customers','Bill-to parties — download invoices &amp; toll register per customer','Add Customer','custModal()',
    `<table class="table"><thead><tr><th>Name</th><th>GSTIN</th><th>State / Tax</th><th class="num">Bills</th><th class="right">Downloads &amp; actions</th></tr></thead><tbody>${rows||''}</tbody></table>${DB.customers.length?'':'<div class="empty">No customers</div>'}`);
}
function custModal(id){
  const c=id?customer(id):{name:'',gstin:'',state:'',stateCode:'',address:'',phone:''};
  modal((id?'Edit':'Add')+' Customer',
    `<div class="form-grid">
      <div class="field full"><label>Customer Name *</label><input id="c_name" value="${c.name||''}"></div>
      <div class="field"><label>GSTIN/UIN</label><input id="c_gstin" value="${c.gstin||''}" oninput="c_autostate()" placeholder="e.g. 24AEBFS2259C1ZE"></div>
      <div class="field"><label>Phone</label><input id="c_phone" value="${c.phone||''}"></div>
      <div class="field"><label>State</label><input id="c_state" value="${c.state||''}"></div>
      <div class="field"><label>State Code</label><input id="c_scode" value="${c.stateCode||''}" placeholder="from GSTIN (first 2 digits)"></div>
      <div class="field full"><label>Address</label><textarea id="c_addr" rows="3">${c.address||''}</textarea></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveCust('${id||''}')">Save</button>`);
}
function c_autostate(){ const g=document.getElementById('c_gstin').value; if(g.length>=2 && /^\d{2}/.test(g)){ document.getElementById('c_scode').value=g.slice(0,2);} }
function saveCust(id){
  if(!guardEdit())return;
  const o={name:val('c_name'),gstin:val('c_gstin'),state:val('c_state'),stateCode:val('c_scode'),address:val('c_addr'),phone:val('c_phone')};
  if(!o.name)return toast('Name required','err');
  if(id){ Object.assign(customer(id),o); } else { DB.customers.push({id:uid('c'),...o}); }
  save(); closeModal(); toast('Customer saved','ok'); renderCustomers();
}
function delCust(id){ if(!guardEdit())return; if(DB.invoices.some(i=>i.customerId===id))return toast('Cannot delete — has invoices','err');
  if(confirm('Delete customer?')){ DB.customers=DB.customers.filter(c=>c.id!==id); DB.sites=DB.sites.filter(s=>s.customerId!==id); DB.rates=DB.rates.filter(r=>r.customerId!==id); save(); renderCustomers(); } }

/* Sites */
function renderSites(){
  const rows=DB.sites.map(s=>`<tr><td><b>${s.name}</b></td><td>${customer(s.customerId).name||'-'}</td>
    <td>${(s.address||'').replace(/\n/g,', ')}</td>
    <td class="right"><button class="btn ghost sm" onclick="siteModal('${s.id}')">✎ Edit</button><button class="btn danger sm" onclick="delSite('${s.id}')">✕</button></td></tr>`).join('');
  masterPage('Sites / Projects','Delivery locations linked to each customer','Add Site','siteModal()',
    `<table class="table"><thead><tr><th>Site / Project</th><th>Customer</th><th>Address</th><th class="right"></th></tr></thead><tbody>${rows}</tbody></table>${DB.sites.length?'':'<div class="empty">No sites</div>'}`);
}
function siteModal(id){
  const s=id?site(id):{name:'',customerId:'',address:''};
  modal((id?'Edit':'Add')+' Site',
    `<div class="form-grid">
      <div class="field full"><label>Customer *</label><select id="s_cust">${DB.customers.map(c=>`<option value="${c.id}" ${c.id===s.customerId?'selected':''}>${c.name}</option>`).join('')}</select></div>
      <div class="field full"><label>Site / Project Name *</label><input id="s_name" value="${s.name||''}"></div>
      <div class="field full"><label>Address</label><textarea id="s_addr" rows="3">${s.address||''}</textarea></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveSite('${id||''}')">Save</button>`);
}
function saveSite(id){ if(!guardEdit())return; const o={name:val('s_name'),customerId:val('s_cust'),address:val('s_addr')};
  if(!o.name)return toast('Name required','err');
  if(id){Object.assign(site(id),o);}else{DB.sites.push({id:uid('s'),...o});}
  save();closeModal();toast('Site saved','ok');renderSites(); }
function delSite(id){ if(!guardEdit())return; if(confirm('Delete site?')){ DB.sites=DB.sites.filter(s=>s.id!==id); save(); renderSites(); } }

/* Vehicles */
function renderVehicles(){
  const rows=DB.vehicles.map(v=>`<tr><td><b>${v.number}</b></td><td>${v.driver||'-'}</td><td>${v.driverPhone||'-'}</td><td>${v.capacity||'-'} Cum</td>
    <td class="right"><button class="btn ghost sm" onclick="vehModal('${v.id}')">✎ Edit</button><button class="btn danger sm" onclick="delVeh('${v.id}')">✕</button></td></tr>`).join('');
  masterPage('Vehicles & Drivers','Transit mixers and assigned drivers','Add Vehicle','vehModal()',
    `<table class="table"><thead><tr><th>Vehicle No.</th><th>Driver</th><th>Driver Phone</th><th>Capacity</th><th class="right"></th></tr></thead><tbody>${rows}</tbody></table>${DB.vehicles.length?'':'<div class="empty">No vehicles</div>'}`);
}
function vehModal(id){
  const v=id?vehicle(id):{number:'',driver:'',driverPhone:'',capacity:''};
  modal((id?'Edit':'Add')+' Vehicle',
    `<div class="form-grid">
      <div class="field"><label>Vehicle Number *</label><input id="v_num" value="${v.number||''}" placeholder="AP39WQ0715"></div>
      <div class="field"><label>Capacity (Cum)</label><input id="v_cap" value="${v.capacity||''}"></div>
      <div class="field"><label>Driver Name</label><input id="v_drv" value="${v.driver||''}"></div>
      <div class="field"><label>Driver Phone</label><input id="v_ph" value="${v.driverPhone||''}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveVeh('${id||''}')">Save</button>`);
}
function saveVeh(id){ if(!guardEdit())return; const o={number:val('v_num'),driver:val('v_drv'),driverPhone:val('v_ph'),capacity:val('v_cap')};
  if(!o.number)return toast('Vehicle number required','err');
  if(id){Object.assign(vehicle(id),o);}else{DB.vehicles.push({id:uid('v'),...o});}
  save();closeModal();toast('Vehicle saved','ok');renderVehicles(); }
function delVeh(id){ if(!guardEdit())return; if(confirm('Delete vehicle?')){ DB.vehicles=DB.vehicles.filter(v=>v.id!==id); save(); renderVehicles(); } }

/* Grades */
function renderGrades(){
  const rows=DB.grades.map(g=>`<tr><td><b>${g.name}</b></td><td>${g.hsn}</td><td>${g.gst}%</td>
    <td class="right"><button class="btn ghost sm" onclick="gradeModal('${g.id}')">✎ Edit</button><button class="btn danger sm" onclick="delGrade('${g.id}')">✕</button></td></tr>`).join('');
  masterPage('Concrete Grades','Product master — M15, M20, M20S, M25, M30…','Add Grade','gradeModal()',
    `<table class="table"><thead><tr><th>Grade</th><th>HSN/SAC</th><th>GST Rate</th><th class="right"></th></tr></thead><tbody>${rows}</tbody></table>`);
}
function gradeModal(id){
  const g=id?grade(id):{name:'',hsn:'38245010',gst:18,mix:{...DEFAULT_MIX}};
  const m=g.mix||{...DEFAULT_MIX};
  modal((id?'Edit':'Add')+' Grade',
    `<div class="form-grid">
      <div class="field"><label>Grade Name *</label><input id="g_name" value="${g.name||''}" placeholder="M-30"></div>
      <div class="field"><label>HSN/SAC</label><input id="g_hsn" value="${g.hsn||'38245010'}"></div>
      <div class="field"><label>GST Rate (%)</label><input id="g_gst" type="number" value="${g.gst!=null?g.gst:18}"></div>
    </div>
    <label style="display:block;margin:14px 0 6px">Mix Design — per Cubic Metre (used on batching slips)</label>
    <div class="form-grid">
      <div class="field"><label>Cement (kg)</label><input id="g_cement" type="number" step="0.1" value="${m.cement!=null?m.cement:''}"></div>
      <div class="field"><label>Sand (kg)</label><input id="g_sand" type="number" step="0.1" value="${m.sand!=null?m.sand:''}"></div>
      <div class="field"><label>Aggregate 20mm (kg)</label><input id="g_agg20" type="number" step="0.1" value="${m.agg20!=null?m.agg20:''}"></div>
      <div class="field"><label>Aggregate 12mm (kg)</label><input id="g_agg12" type="number" step="0.1" value="${m.agg12!=null?m.agg12:''}"></div>
      <div class="field"><label>Water (ltr)</label><input id="g_water" type="number" step="0.1" value="${m.water!=null?m.water:''}"></div>
      <div class="field"><label>Admixture (ltr)</label><input id="g_admix" type="number" step="0.01" value="${m.admix!=null?m.admix:''}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveGrade('${id||''}')">Save</button>`);
}
function saveGrade(id){ if(!guardEdit())return;
  const o={name:val('g_name'),hsn:val('g_hsn'),gst:parseFloat(val('g_gst'))||18,
    mix:{cement:Number(val('g_cement'))||0,sand:Number(val('g_sand'))||0,agg20:Number(val('g_agg20'))||0,agg12:Number(val('g_agg12'))||0,water:Number(val('g_water'))||0,admix:Number(val('g_admix'))||0}};
  if(!o.name)return toast('Grade name required','err');
  if(id){Object.assign(grade(id),o);}else{DB.grades.push({id:uid('g'),...o});}
  save();closeModal();toast('Grade saved','ok');renderGrades(); }
function delGrade(id){ if(!guardEdit())return; if(confirm('Delete grade?')){ DB.grades=DB.grades.filter(g=>g.id!==id); save(); renderGrades(); } }

/* Rates */
function renderRates(){
  const rows=DB.rates.map(r=>`<tr><td><b>${customer(r.customerId).name||'-'}</b></td><td>${grade(r.gradeId).name||'-'}</td>
    <td class="num">₹${inr(r.rate)} / Cum</td>
    <td class="right"><button class="btn ghost sm" onclick="rateModal('${r.id}')">✎ Edit</button><button class="btn danger sm" onclick="delRate('${r.id}')">✕</button></td></tr>`).join('');
  masterPage('Rate Master','Customer-wise &amp; grade-wise rates — auto-filled on billing','Add Rate','rateModal()',
    `<table class="table"><thead><tr><th>Customer</th><th>Grade</th><th class="num">Rate</th><th class="right"></th></tr></thead><tbody>${rows}</tbody></table>${DB.rates.length?'':'<div class="empty">No rates</div>'}`);
}
function rateModal(id){
  const r=id?DB.rates.find(x=>x.id===id):{customerId:'',gradeId:'',rate:''};
  modal((id?'Edit':'Add')+' Rate',
    `<div class="form-grid">
      <div class="field"><label>Customer *</label><select id="rt_cust">${DB.customers.map(c=>`<option value="${c.id}" ${c.id===r.customerId?'selected':''}>${c.name}</option>`).join('')}</select></div>
      <div class="field"><label>Grade *</label><select id="rt_grade">${DB.grades.map(g=>`<option value="${g.id}" ${g.id===r.gradeId?'selected':''}>${g.name}</option>`).join('')}</select></div>
      <div class="field full"><label>Rate per Cum (₹) *</label><input id="rt_rate" type="number" step="0.01" value="${r.rate||''}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveRate('${id||''}')">Save</button>`);
}
function saveRate(id){ if(!guardEdit())return; const o={customerId:val('rt_cust'),gradeId:val('rt_grade'),rate:parseFloat(val('rt_rate'))||0};
  if(!o.rate)return toast('Rate required','err');
  const dup=DB.rates.find(r=>r.customerId===o.customerId&&r.gradeId===o.gradeId&&r.id!==id);
  if(dup){ dup.rate=o.rate; } else if(id){Object.assign(DB.rates.find(x=>x.id===id),o);}else{DB.rates.push({id:uid('r'),...o});}
  save();closeModal();toast('Rate saved','ok');renderRates(); }
function delRate(id){ if(!guardEdit())return; if(confirm('Delete rate?')){ DB.rates=DB.rates.filter(r=>r.id!==id); save(); renderRates(); } }

/* ---------------- Reports ---------------- */
function renderReports(){
  const byMonth={};
  DB.invoices.forEach(i=>{const m=i.date.slice(0,7);const t=invTotals(i);
    byMonth[m]=byMonth[m]||{count:0,cum:0,taxable:0,tax:0,grand:0};
    byMonth[m].count++;byMonth[m].cum+=i.qty;byMonth[m].taxable+=t.taxable;byMonth[m].tax+=t.totalTax;byMonth[m].grand+=t.grand;});
  const months=Object.keys(byMonth).sort().reverse();
  const monthRows=months.map(m=>{const d=byMonth[m];
    return `<tr><td><b>${monthName(m)}</b></td><td class="num">${d.count}</td><td class="num">${d.cum.toFixed(2)}</td>
    <td class="num">₹${inr(d.taxable)}</td><td class="num">₹${inr(d.tax)}</td><td class="num"><b>₹${inr(d.grand)}</b></td></tr>`;}).join('');

  const byCust={};
  DB.invoices.forEach(i=>{const t=invTotals(i);const k=i.customerId;
    byCust[k]=byCust[k]||{count:0,grand:0,due:0};byCust[k].count++;byCust[k].grand+=t.grand;byCust[k].due+=t.grand-(i.paid||0);});
  const custRows=Object.keys(byCust).map(k=>{const d=byCust[k];
    return `<tr><td><b>${customer(k).name}</b></td><td class="num">${d.count}</td><td class="num">₹${inr(d.grand)}</td><td class="num">₹${inr(d.due)}</td></tr>`;}).join('');

  document.getElementById('main').innerHTML=topbar('Reports &amp; Export','Sales summaries + customer-wise invoice &amp; toll downloads')+
    `<div class="toolbar">
      <button class="btn ghost" onclick="exportInvoicesCSV()">⬇ All Invoices (Excel/CSV)</button>
      <button class="btn ghost" onclick="exportMonthlyCSV()">⬇ Monthly Summary (CSV)</button>
      <button class="btn ghost" onclick="zipModal()">🗜 Bulk Invoice ZIP</button>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Customer Statement &amp; Toll Register</h3></div><div class="bd">
      <div class="toolbar" style="margin:0">
        <select id="repCust" onchange="drawTollPreview()" style="max-width:280px">
          <option value="">— Select customer —</option>
          ${DB.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <button class="btn ghost" onclick="exportTollCSV(repCustVal())">⬇ Toll Register (CSV)</button>
        <button class="btn ghost" onclick="exportInvoicesCSV(repCustVal())">⬇ Invoices (CSV)</button>
        <button class="btn gold" onclick="printStatement(repCustVal())">🖨 Statement PDF</button>
      </div>
      <div id="tollPreview" style="margin-top:12px"></div>
    </div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="hd"><h3>Monthly Sales</h3></div><div class="bd" style="padding:0">
        <table class="table"><thead><tr><th>Month</th><th class="num">Bills</th><th class="num">Cum</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Total</th></tr></thead>
        <tbody>${monthRows||'<tr><td colspan=6 class="empty">No data</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="hd"><h3>Customer-wise Sales</h3></div><div class="bd" style="padding:0">
        <table class="table"><thead><tr><th>Customer</th><th class="num">Bills</th><th class="num">Billed</th><th class="num">Outstanding</th></tr></thead>
        <tbody>${custRows||'<tr><td colspan=4 class="empty">No data</td></tr>'}</tbody></table></div></div>
    </div>`;
}
function repCustVal(){ const e=document.getElementById('repCust'); return e?e.value:''; }
function drawTollPreview(){
  const id=repCustVal(); const box=document.getElementById('tollPreview');
  if(!id){ box.innerHTML='<div class="muted" style="font-size:12px">Select a customer to preview their running toll register.</div>'; return; }
  const rows=tollRows(id);
  if(!rows.length){ box.innerHTML='<div class="muted" style="font-size:12px">No dispatches for this customer yet.</div>'; return; }
  box.innerHTML=`<div style="overflow-x:auto"><table class="table"><thead><tr><th>Date</th><th>Grade</th><th class="num">Load</th><th class="num">Rate</th><th class="num">Basic</th><th class="num">GST</th><th class="num">Final</th><th class="num">Running Total</th><th>Vehicle</th><th>Invoice</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${r.grade}</td><td class="num">${r.load.toFixed(2)}</td><td class="num">${inr(r.rate)}</td><td class="num">${inr(r.basic)}</td><td class="num">${inr(r.gst)}</td><td class="num">${inr(r.final)}</td><td class="num"><b>${inr(r.running)}</b></td><td>${r.vehicle}</td><td>${r.invoice}</td></tr>`).join('')+`</tbody></table></div>`;
}
function monthName(m){ const[y,mo]=m.split('-');const n=['January','February','March','April','May','June','July','August','September','October','November','December'];return n[+mo-1]+' '+y; }

/* CSV export (opens in Excel) */
function downloadCSV(name,rows){
  const csv=rows.map(r=>r.map(c=>{c=(c==null?'':String(c));return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  toast('Exported '+name,'ok');
}
function exportInvoicesCSV(customerId){
  const rows=[['Invoice No','Date','Customer','GSTIN','State','Site','Grade','HSN','Vehicle','Qty(Cum)','Rate','Taxable','GST Type','GST Amt','Grand Total','Paid','Due']];
  DB.invoices.filter(i=>!customerId||i.customerId===customerId).slice().sort((a,b)=>a.no.localeCompare(b.no)).forEach(i=>{const h=hydrate(i);const t=invTotals(i);
    rows.push([i.no,i.date,h.buyerName,h.buyerGstin||'',h.buyerState,h.siteName||'',h.gradeName,h.hsn,h.vehicle,i.qty,i.rate,
      t.taxable,t.noGst?'No GST':(t.interState?'IGST':'CGST+SGST'),t.totalTax,t.grand,i.paid||0,round2(t.grand-(i.paid||0))]);});
  if(rows.length===1) return toast('No invoices for this customer','err');
  const nm = customerId ? 'DNK_Invoices_'+(customer(customerId).name||'').replace(/[^A-Za-z0-9]+/g,'_') : 'DNK_Invoices_All';
  downloadCSV(nm+'_'+todayISO()+'.csv',rows);
}
/* Customer-wise TOLL REGISTER — running dispatch ledger (matches the toll-project format) */
function tollRows(customerId){
  const invs=DB.invoices.filter(i=>i.customerId===customerId).slice().sort((a,b)=>(a.date+a.no).localeCompare(b.date+b.no));
  let running=0;
  return invs.map(i=>{const h=hydrate(i);const t=invTotals(i);running=round2(running+t.grand);
    return {date:i.date,name:h.buyerName,grade:h.gradeName,load:i.qty,rate:i.rate,basic:t.taxable,gst:t.totalTax,final:t.grand,running,vehicle:h.vehicle||'',invoice:i.no};});
}
function exportTollCSV(customerId){
  const rows=[['Date','Customer','Grade','This Load (Cum)','Rate','Basic Amount','GST','Final Amount','Running Total','Vehicle No','Invoice No']];
  tollRows(customerId).forEach(r=>rows.push([r.date,r.name,r.grade,r.load,r.rate,r.basic,r.gst,r.final,r.running,r.vehicle,r.invoice]));
  if(rows.length===1) return toast('No dispatches for this customer','err');
  downloadCSV('DNK_TollRegister_'+(customer(customerId).name||'').replace(/[^A-Za-z0-9]+/g,'_')+'_'+todayISO()+'.csv',rows);
}
/* Printable account statement for one customer (all invoices + running total) */
function printStatement(customerId){
  const c=customer(customerId); const rows=tollRows(customerId);
  if(!rows.length) return toast('No invoices for this customer','err');
  const totBasic=rows.reduce((s,r)=>s+r.basic,0), totGst=rows.reduce((s,r)=>s+r.gst,0), totFinal=rows.reduce((s,r)=>s+r.final,0);
  const paid=DB.invoices.filter(i=>i.customerId===customerId).reduce((s,i)=>s+(i.paid||0),0);
  const co=DB.company;
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Statement — ${c.name}</title>
    <style>body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:12px;padding:16px}
    h2{margin:0}.muted{color:#666}table{border-collapse:collapse;width:100%;margin-top:10px}
    td,th{border:1px solid #999;padding:4px 6px}.r{text-align:right}th{background:#f0f0f0}
    .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #14508c;padding-bottom:8px}
    .tot td{font-weight:700;background:#fafafa}</style></head><body>
    <div class="head"><div><h2>${co.name}</h2><div class="muted">${co.addressLines.join(', ')}<br>GSTIN: ${co.gstin}</div></div>
      <img src="${window.LOGO_DATA}" style="width:70px;height:70px;object-fit:contain"></div>
    <h3 style="margin:12px 0 0">Customer Account Statement / Toll Register</h3>
    <div class="muted">Customer: <b>${c.name}</b> ${c.gstin?('• GSTIN '+c.gstin):'• Domestic (No GST)'} • As on ${fmtDate(todayISO())}</div>
    <table><thead><tr><th>Date</th><th>Grade</th><th class="r">Load (Cum)</th><th class="r">Rate</th><th class="r">Basic</th><th class="r">GST</th><th class="r">Final</th><th class="r">Running Total</th><th>Vehicle</th><th>Invoice</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${r.grade}</td><td class="r">${r.load.toFixed(2)}</td><td class="r">${inr(r.rate)}</td><td class="r">${inr(r.basic)}</td><td class="r">${inr(r.gst)}</td><td class="r">${inr(r.final)}</td><td class="r">${inr(r.running)}</td><td>${r.vehicle}</td><td>${r.invoice}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4" class="r">Total</td><td class="r">${inr(totBasic)}</td><td class="r">${inr(totGst)}</td><td class="r">${inr(totFinal)}</td><td colspan="3"></td></tr></tbody></table>
    <div style="margin-top:12px"><b>Grand Total:</b> ₹${inr(totFinal)} &nbsp;•&nbsp; <b>Received:</b> ₹${inr(paid)} &nbsp;•&nbsp; <b>Balance Due:</b> ₹${inr(round2(totFinal-paid))}</div>
    <div class="muted" style="margin-top:6px">${numToWords(round2(totFinal-paid))} outstanding</div>
    </body></html>`;
  openPrint(html);
}
function exportMonthlyCSV(){
  const byMonth={};
  DB.invoices.forEach(i=>{const m=i.date.slice(0,7);const t=invTotals(i);
    byMonth[m]=byMonth[m]||{count:0,cum:0,taxable:0,tax:0,grand:0};
    byMonth[m].count++;byMonth[m].cum+=i.qty;byMonth[m].taxable+=t.taxable;byMonth[m].tax+=t.totalTax;byMonth[m].grand+=t.grand;});
  const rows=[['Month','Bills','Total Cum','Taxable','GST','Grand Total']];
  Object.keys(byMonth).sort().forEach(m=>{const d=byMonth[m];rows.push([monthName(m),d.count,d.cum.toFixed(2),d.taxable,d.tax,d.grand]);});
  downloadCSV('DNK_Monthly_'+todayISO()+'.csv',rows);
}

/* ---------------- Settings & Backup ---------------- */
function renderSettings(){
  const co=DB.company;
  document.getElementById('main').innerHTML=topbar('Settings &amp; Backup','Company details, data backup and restore')+
    `<div class="grid" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <div class="card"><div class="hd"><h3>Company Details (appears on invoice)</h3></div><div class="bd">
        <div class="form-grid">
          <div class="field full"><label>Company Name</label><input id="co_name" value="${co.name}"></div>
          <div class="field"><label>GSTIN/UIN</label><input id="co_gstin" value="${co.gstin}"></div>
          <div class="field"><label>State (Code)</label><input id="co_state" value="${co.stateName}"><input type="hidden" id="co_scode" value="${co.stateCode}"></div>
          <div class="field"><label>Email</label><input id="co_email" value="${co.email}"></div>
          <div class="field"><label>Phone</label><input id="co_phone" value="${co.phone}"></div>
          <div class="field full"><label>Address (one line each)</label><textarea id="co_addr" rows="4">${co.addressLines.join('\n')}</textarea></div>
          <div class="field"><label>Bank</label><input id="co_bank" value="${co.bank.bank}"></div>
          <div class="field"><label>A/c No.</label><input id="co_acno" value="${co.bank.acno}"></div>
          <div class="field"><label>Branch</label><input id="co_branch" value="${co.bank.branch}"></div>
          <div class="field"><label>IFSC</label><input id="co_ifsc" value="${co.bank.ifsc}"></div>
        </div>
        <button class="btn" style="margin-top:14px" onclick="saveCompany()">Save Company</button>
      </div></div>
      <div class="card"><div class="hd"><h3>Data Backup</h3></div><div class="bd">
        <p class="muted" style="margin-top:0">Back up all masters, invoices and payments to a single file. Restore anytime on any computer.</p>
        <button class="btn green" style="width:100%;justify-content:center" onclick="backup()">⬇ Download Backup (.json)</button>
        <div class="field" style="margin-top:16px"><label>Restore from backup</label><input type="file" id="restoreFile" accept=".json"></div>
        <button class="btn ghost" style="width:100%;justify-content:center;margin-top:10px" onclick="restore()">⬆ Restore Backup</button>
        <hr style="margin:18px 0;border:none;border-top:1px solid var(--line)">
        <button class="btn danger" style="width:100%;justify-content:center" onclick="resetDemo()">↺ Reset to Demo Data</button>
      </div></div>
    </div>`+featureManageHTML();
}
function featureManageHTML(){
  const items=Object.keys(PERM_LABELS).filter(k=>!CORE_FEATURES[k]);
  return `<div class="card" style="margin-top:16px"><div class="hd"><h3>Feature Management</h3><span class="muted" style="font-size:12px">Turn modules on / off for everyone — no redevelopment needed</span></div>
    <div class="bd"><div class="feature-grid">
    ${items.map(k=>{const on=featureOn(k);
      return `<label class="feature-row"><span>${PERM_LABELS[k]}</span>
        <input type="checkbox" class="switch" ${on?'checked':''} onchange="toggleFeature('${k}',this.checked)"></label>`;}).join('')}
    </div>
    <div class="muted" style="font-size:11px;margin-top:12px">Core modules (Dashboard, Users, Settings) are always available. A disabled module disappears from every user's menu instantly.</div>
    </div></div>`;
}
function toggleFeature(k,on){
  if(!guardEdit())return;
  DB.features=DB.features||{};
  if(on) delete DB.features[k]; else DB.features[k]=false;
  logAct('Feature '+(on?'enabled':'disabled'),PERM_LABELS[k]||k);
  save(); toast((PERM_LABELS[k]||k)+' '+(on?'enabled':'disabled'),'ok'); renderApp();
}
function saveCompany(){
  const co=DB.company;
  co.name=val('co_name');co.gstin=val('co_gstin');co.stateName=val('co_state');co.stateCode=val('co_scode');
  co.email=val('co_email');co.phone=val('co_phone');co.addressLines=val('co_addr').split('\n').filter(Boolean);
  co.bank.bank=val('co_bank');co.bank.acno=val('co_acno');co.bank.branch=val('co_branch');co.bank.ifsc=val('co_ifsc');co.bank.name=co.name;
  if(co.gstin.length>=2)co.stateCode=co.gstin.slice(0,2);
  save();toast('Company details saved','ok');
}
function backup(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='DNK_Backup_'+todayISO()+'.json';a.click();
  toast('Backup downloaded','ok');
}
function restore(){
  const f=document.getElementById('restoreFile').files[0];
  if(!f)return toast('Choose a backup file','err');
  const r=new FileReader();r.onload=e=>{try{DB=JSON.parse(e.target.result);save();toast('Backup restored','ok');go('dashboard');}catch(err){toast('Invalid backup file','err');}};
  r.readAsText(f);
}
function resetDemo(){ if(confirm('Reset all data to demo? Current data will be lost.')){ DB=seed(); save(); go('dashboard'); toast('Reset to demo data'); } }

/* ================= SALES TOOLS (Leads, Calculators — all fully unlocked) ================= */

/* ---- Concrete Calculator (site measurement → cubic metres) ---- */
function renderConcalc(){
  document.getElementById('main').innerHTML=topbar('Concrete Calculator','Enter the site size — get the concrete needed instantly')+
  `<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
    <div class="card"><div class="hd"><h3>Site Measurement</h3></div><div class="bd"><div class="form-grid">
      <div class="field"><label>Length (ft)</label><input id="cc_l" type="number" placeholder="optional" oninput="ccArea()"></div>
      <div class="field"><label>Width (ft)</label><input id="cc_w" type="number" placeholder="optional" oninput="ccArea()"></div>
      <div class="field full"><label>Area (sq ft)</label><input id="cc_area" type="number" value="1200" oninput="ccCalc()"></div>
      <div class="field"><label>Slab thickness (inches)</label><input id="cc_th" type="number" value="5" oninput="ccCalc()"></div>
      <div class="field"><label>Wastage (%)</label><input id="cc_waste" type="number" value="5" oninput="ccCalc()"></div>
      <div class="field"><label>Mixer capacity (Cum)</label><input id="cc_cap" type="number" value="6.5" oninput="ccCalc()"></div>
      <div class="field full"><label>Rate per Cum (₹) — for cost estimate</label><input id="cc_rate" type="number" value="5050" oninput="ccCalc()"></div>
    </div></div></div>
    <div class="card"><div class="hd"><h3>Concrete Required</h3></div><div class="bd">
      <div class="calc" id="cc_out"></div>
      <div class="muted" style="font-size:11px;margin-top:10px">Area × thickness → cubic feet → cubic metres (÷ 35.315), plus wastage allowance.<br>Example: 1200 sq ft × 5″ slab ≈ 14.16 Cum.</div>
    </div></div>
  </div>`;
  ccCalc();
}
function ccArea(){ const l=+val('cc_l'),w=+val('cc_w'); if(l&&w){document.getElementById('cc_area').value=(l*w).toFixed(2);} ccCalc(); }
function ccCalc(){
  const area=+val('cc_area')||0, th=+val('cc_th')||0, waste=+val('cc_waste')||0, cap=+val('cc_cap')||6.5, rate=+val('cc_rate')||0;
  const cum=(area*(th/12))/35.3147;
  const withWaste=cum*(1+waste/100);
  const loads=cap>0?Math.ceil(withWaste/cap):0;
  document.getElementById('cc_out').innerHTML=`
    <div class="row"><span>Volume (no wastage)</span><span>${cum.toFixed(2)} Cum</span></div>
    <div class="row"><span>+ Wastage ${waste}%</span><span>${(withWaste-cum).toFixed(2)} Cum</span></div>
    <div class="row total"><span>Concrete Required</span><span>${withWaste.toFixed(2)} Cum</span></div>
    <div class="row"><span>Transit-mixer loads (${cap} Cum each)</span><span>${loads} load(s)</span></div>
    <div class="row"><span>Estimated cost @ ₹${inr(rate)}</span><span>₹ ${inr(round2(withWaste*rate))}</span></div>`;
}

/* ---- Revenue Calculator ---- */
function renderRevenue(){
  document.getElementById('main').innerHTML=topbar('Revenue Calculator','Project plant revenue, GST and profit from your dispatch plan')+
  `<div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
    <div class="card"><div class="hd"><h3>Assumptions</h3></div><div class="bd"><div class="form-grid">
      <div class="field"><label>Loads per day</label><input id="rv_loads" type="number" value="8" oninput="rvCalc()"></div>
      <div class="field"><label>Avg Cum / load</label><input id="rv_cum" type="number" value="6.5" oninput="rvCalc()"></div>
      <div class="field"><label>Avg rate / Cum (₹)</label><input id="rv_rate" type="number" value="4700" oninput="rvCalc()"></div>
      <div class="field"><label>Working days / month</label><input id="rv_days" type="number" value="26" oninput="rvCalc()"></div>
      <div class="field"><label>Production cost / Cum (₹)</label><input id="rv_cost" type="number" value="3400" oninput="rvCalc()"></div>
      <div class="field"><label>GST %</label><input id="rv_gst" type="number" value="18" oninput="rvCalc()"></div>
    </div></div></div>
    <div class="card"><div class="hd"><h3>Projection</h3></div><div class="bd"><div class="calc" id="rv_out"></div></div></div>
  </div>`;
  rvCalc();
}
function rvCalc(){
  const loads=+val('rv_loads')||0,cum=+val('rv_cum')||0,rate=+val('rv_rate')||0,days=+val('rv_days')||0,cost=+val('rv_cost')||0,gst=+val('rv_gst')||0;
  const cumDay=loads*cum, cumMonth=cumDay*days, revMonth=cumMonth*rate;
  document.getElementById('rv_out').innerHTML=`
    <div class="row"><span>Concrete / day</span><span>${cumDay.toFixed(1)} Cum</span></div>
    <div class="row"><span>Revenue / day</span><span>₹ ${inr(round2(cumDay*rate))}</span></div>
    <div class="row"><span>Revenue / month</span><span>₹ ${inr(round2(revMonth))}</span></div>
    <div class="row"><span>GST collected / month</span><span>₹ ${inr(round2(revMonth*gst/100))}</span></div>
    <div class="row total"><span>Revenue / year</span><span>₹ ${inr(round2(revMonth*12))}</span></div>
    <div class="row"><span>Est. profit / month</span><span style="color:var(--green)">₹ ${inr(round2(cumMonth*(rate-cost)))}</span></div>
    <div class="row"><span>Est. profit / year</span><span style="color:var(--green)">₹ ${inr(round2(cumMonth*(rate-cost)*12))}</span></div>`;
}

/* ---- Leads & Follow-up (CRM) ---- */
const LEAD_STATUS=['New','Contacted','Quoted','Won','Lost'];
function statusPill(s){ const map={New:'due',Contacted:'part',Quoted:'igst',Won:'paid',Lost:'nogst'}; return `<span class="pill ${map[s]||'due'}">${s}</span>`; }
function renderLeads(){
  const leads=DB.leads||[];
  const open=leads.filter(l=>!['Won','Lost'].includes(l.status));
  const pipe=open.reduce((s,l)=>s+(+l.value||0),0);
  document.getElementById('main').innerHTML=topbar('Leads & Follow-up','Track enquiries and never miss a follow-up',
    `<button class="btn gold" onclick="leadModal()">➕ Add Lead</button>`)+
   `<div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi blue"><div class="lab">Open Leads</div><div class="val">${open.length}</div></div>
      <div class="kpi accent"><div class="lab">Pipeline Value</div><div class="val">₹${inr(pipe)}</div></div>
      <div class="kpi green"><div class="lab">Won</div><div class="val">${leads.filter(l=>l.status==='Won').length}</div></div>
      <div class="kpi red"><div class="lab">Follow-up Due</div><div class="val">${open.filter(l=>l.nextFollowup&&l.nextFollowup<=todayISO()).length}</div></div>
   </div>
   <div class="card"><div class="bd" style="padding:0">
     <table class="table"><thead><tr><th>Lead</th><th>Contact</th><th>Requirement</th><th class="num">Value</th><th>Status</th><th>Next Follow-up</th><th class="right"></th></tr></thead><tbody>
     ${leads.map(l=>`<tr><td><b>${l.name}</b><br><span class="muted" style="font-size:11px">${l.source||''}</span></td>
       <td>${l.contact||''}<br><span class="muted" style="font-size:11px">${l.phone||''}</span></td>
       <td style="max-width:230px">${l.requirement||''}</td><td class="num">₹${inr(l.value||0)}</td>
       <td>${statusPill(l.status)}</td><td>${l.nextFollowup?fmtDate(l.nextFollowup):'-'}</td>
       <td class="right"><button class="btn ghost sm" onclick="leadModal('${l.id}')">✎</button><button class="btn danger sm" onclick="delLead('${l.id}')">✕</button></td></tr>`).join('')}
     </tbody></table>${leads.length?'':'<div class="empty">No leads yet.</div>'}
   </div></div>`;
}
function leadModal(id){
  const l=id?DB.leads.find(x=>x.id===id):{name:'',contact:'',phone:'',source:'',requirement:'',value:'',status:'New',nextFollowup:todayISO(),notes:''};
  modal((id?'Edit':'Add')+' Lead',
   `<div class="form-grid">
      <div class="field"><label>Lead / Company *</label><input id="ld_name" value="${l.name||''}"></div>
      <div class="field"><label>Contact Person</label><input id="ld_contact" value="${l.contact||''}"></div>
      <div class="field"><label>Phone</label><input id="ld_phone" value="${l.phone||''}"></div>
      <div class="field"><label>Source</label><input id="ld_source" value="${l.source||''}" placeholder="Reference / Website / Tender"></div>
      <div class="field full"><label>Requirement</label><input id="ld_req" value="${l.requirement||''}"></div>
      <div class="field"><label>Est. Value (₹)</label><input id="ld_value" type="number" value="${l.value||''}"></div>
      <div class="field"><label>Status</label><select id="ld_status">${LEAD_STATUS.map(s=>`<option ${s===l.status?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Next Follow-up</label><input id="ld_follow" type="date" value="${l.nextFollowup||''}"></div>
      <div class="field full"><label>Notes</label><textarea id="ld_notes" rows="2">${l.notes||''}</textarea></div>
   </div>`,
   `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveLead('${id||''}')">Save</button>`);
}
function saveLead(id){
  const o={name:val('ld_name'),contact:val('ld_contact'),phone:val('ld_phone'),source:val('ld_source'),requirement:val('ld_req'),value:+val('ld_value')||0,status:val('ld_status'),nextFollowup:val('ld_follow'),notes:val('ld_notes')};
  if(!o.name)return toast('Lead name required','err');
  DB.leads=DB.leads||[];
  if(id){Object.assign(DB.leads.find(x=>x.id===id),o);}else{DB.leads.push({id:uid('l'),...o});}
  save();closeModal();toast('Lead saved','ok');renderLeads();
}
function delLead(id){ if(confirm('Delete lead?')){ DB.leads=DB.leads.filter(l=>l.id!==id); save(); renderLeads(); } }

/* ---- Users & Permissions ---- */
const PERM_LABELS={dashboard:'Dashboard',newinvoice:'New Bill',invoices:'Invoices',payments:'Outstanding',inventory:'Product Inventory',vendors:'Vendors & Purchases',staff:'Staff Attendance',payroll:'Salary / Payroll',leads:'Leads',concalc:'Concrete Calc',revenue:'Revenue Calc',customers:'Customers',sites:'Sites',vehicles:'Vehicles',grades:'Grades',rates:'Rates',reports:'Reports',activity:'Activity Log',users:'Users',settings:'Settings'};
function renderUsers(){
  const users=DB.users||[];
  document.getElementById('main').innerHTML=topbar('Users & Permissions','Create staff logins and control what each person can access',
    `<button class="btn gold" onclick="userModal()">➕ Add User</button>`)+
   `<div class="card"><div class="bd" style="padding:0">
    <table class="table"><thead><tr><th>Name</th><th>Login</th><th>Email</th><th>Role</th><th>Access</th><th>Status</th><th class="right"></th></tr></thead><tbody>
    ${users.map(u=>{const n=Object.values(u.perms||{}).filter(Boolean).length;
      return `<tr><td><b>${u.name}</b></td><td>${u.username||'-'}</td>
      <td>${u.email?(u.email+' <span class="pill nogst">Cloud</span>'):'<span class="muted">—</span>'}</td><td>${u.role}</td>
      <td>${n} of ${Object.keys(PERM_LABELS).length} modules</td>
      <td>${u.active?'<span class="pill paid">Active</span>':'<span class="pill due">Disabled</span>'}</td>
      <td class="right"><button class="btn ghost sm" onclick="userModal('${u.id}')">✎ Edit</button>${u.username==='admin'?'':`<button class="btn danger sm" onclick="delUser('${u.id}')">✕</button>`}</td></tr>`;}).join('')}
    </tbody></table></div></div>`;
}
function userModal(id){
  const u=id?DB.users.find(x=>x.id===id):{name:'',username:'',role:'Accountant',active:true,perms:{...ROLE_PERMS.Accountant},secQ:'In which town is the plant located?'};
  modal((id?'Edit':'Add')+' User',
   `<div class="form-grid">
      <div class="field"><label>Full Name *</label><input id="us_name" value="${u.name||''}"></div>
      <div class="field"><label>Login Username *</label><input id="us_user" value="${u.username||''}"></div>
      <div class="field full"><label>Email (enables email login &amp; reset-link)</label><input id="us_email" type="email" value="${u.email||''}" placeholder="staff@email.com — optional"></div>
      <div class="field"><label>Role (preset)</label><select id="us_role" onchange="usRole()">${['Admin','Accountant','Auditor'].map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select id="us_active"><option value="1" ${u.active!==false?'selected':''}>Active</option><option value="0" ${u.active===false?'selected':''}>Disabled</option></select></div>
      <div class="field"><label>${id?'Reset Password (blank = keep)':'Password *'}</label><input id="us_pwd" type="password" placeholder="${id?'blank = keep current':'set a login password'}"></div>
      <div class="field"><label>Security Question</label><input id="us_secq" value="${u.secQ||''}" placeholder="e.g. Your first vehicle number?"></div>
      <div class="field full"><label>Security Answer ${id?'(blank = keep)':'*'}</label><input id="us_seca" placeholder="${id?'blank = keep current':'used for password recovery'}"></div>
    </div>
    <div class="muted" style="font-size:11px;margin-top:8px">Add an email <b>and</b> a password to create a cloud account — that user can then sign in with their email and use the "Forgot password" reset-link.</div>
    <label style="display:block;margin:14px 0 6px">Module Permissions</label>
    <div id="us_perms" class="permgrid">${Object.keys(PERM_LABELS).map(k=>`<label class="permchk"><input type="checkbox" data-k="${k}" ${u.perms&&u.perms[k]?'checked':''}> ${PERM_LABELS[k]}</label>`).join('')}</div>`,
   `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveUser('${id||''}')">Save</button>`);
}
function usRole(){ const base=ROLE_PERMS[document.getElementById('us_role').value]||{}; document.querySelectorAll('#us_perms input').forEach(cb=>{cb.checked=!!base[cb.dataset.k];}); }
function saveUser(id){
  if(!guardEdit())return;
  const name=val('us_name'),username=val('us_user'),role=val('us_role'),active=val('us_active')==='1';
  const email=normKey(val('us_email'));
  const pwd=document.getElementById('us_pwd')?document.getElementById('us_pwd').value:'';
  const secQ=val('us_secq'), secA=val('us_seca');
  if(!name||!username)return toast('Name and username required','err');
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid email address','err');
  if((DB.users||[]).some(u=>normKey(u.username)===normKey(username)&&u.id!==id)) return toast('That username is already taken','err');
  if(email && (DB.users||[]).some(u=>u.email&&normKey(u.email)===email&&u.id!==id)) return toast('That email is already used by another user','err');
  const perms={}; document.querySelectorAll('#us_perms input').forEach(cb=>{perms[cb.dataset.k]=cb.checked?1:0;});
  DB.users=DB.users||[];
  if(id){
    const u=DB.users.find(x=>x.id===id); Object.assign(u,{name,username,role,active,email});
    u.perms=perms;
    if(pwd) u.pwd=hashStr(pwd);
    if(secQ) u.secQ=secQ;
    if(secA) u.secA=hashStr(normKey(secA));
  } else {
    if(!pwd) return toast('Set a password for the new user','err');
    DB.users.push({id:uid('u'),name,username,email,role,active,perms,pwd:hashStr(pwd),secQ:secQ||'In which town is the plant located?',secA:hashStr(normKey(secA||'vkota'))});
  }
  logAct(id?'User updated':'User created',username+(email?(' <'+email+'>'):'')+' ('+role+')');
  save();closeModal();toast('User saved','ok');renderUsers();
  // Provision a cloud (Firebase) account in the background when email + password are given
  if(email && pwd && window.fbApp){
    fbCreateAccount(email,pwd).then(res=>{
      if(res.created) toast('Cloud account created for '+email,'ok');
      else if(res.exists) toast('Email already has a cloud account — linked','ok');
      else if(res.error) toast('Saved locally. Cloud account: '+res.error,'err');
    });
  }
}
function delUser(id){ if(!guardEdit())return; if(confirm('Delete user?')){ DB.users=DB.users.filter(u=>u.id!==id); save(); renderUsers(); } }

/* ================= PRODUCT INVENTORY ================= */
function product(id){ return (DB.products||[]).find(p=>p.id===id)||{}; }
function lowStock(p){ return p.reorder>0 && p.stock<=p.reorder; }
function renderInventory(){
  const prods=DB.products||[];
  const low=prods.filter(lowStock);
  const value=prods.reduce((s,p)=>s+(p.stock*(p.rate||0)),0);
  document.getElementById('main').innerHTML=
    topbar('Product Inventory','Raw materials &amp; stock &mdash; cement, aggregate, admixtures and more',
      canEdit()?`<button class="btn gold" onclick="prodModal()">➕ Add Product</button>`:'')+
    `<div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="kpi blue"><div class="lab">Products</div><div class="val">${prods.length}</div><div class="sub">stock items tracked</div></div>
      <div class="kpi red"><div class="lab">Low Stock</div><div class="val">${low.length}</div><div class="sub">at / below reorder level</div></div>
      <div class="kpi green"><div class="lab">Stock Value</div><div class="val">₹${inr(value)}</div><div class="sub">at current rates</div></div>
    </div>
    <div class="toolbar"><button class="btn ghost" onclick="exportInventoryCSV()">⬇ Inventory CSV</button></div>
    <div class="card" style="margin-bottom:16px"><div class="bd" style="padding:0" id="invTbl"></div></div>
    <div class="card"><div class="hd"><h3>Recent Stock Movements</h3></div><div class="bd" style="padding:0">${stockMoveTable()}</div></div>`;
  drawInvTbl();
}
function drawInvTbl(){
  const prods=DB.products||[];
  document.getElementById('invTbl').innerHTML = prods.length?
    `<table class="table"><thead><tr><th>Product</th><th>Category</th><th class="num">Current Stock</th><th class="num">Reorder</th><th class="num">Rate</th><th class="num">Value</th><th class="right">Actions</th></tr></thead><tbody>`+
    prods.map(p=>`<tr>
      <td><b>${p.name}</b></td><td>${p.category||'-'}</td>
      <td class="num"><b class="${lowStock(p)?'stock-low':''}">${p.stock} ${p.unit}</b> ${lowStock(p)?'<span class="pill low">LOW</span>':''}</td>
      <td class="num">${p.reorder||0}</td><td class="num">₹${inr(p.rate||0)}</td><td class="num">₹${inr(p.stock*(p.rate||0))}</td>
      <td class="right">
        <button class="btn green sm" onclick="moveModal('in','${p.id}')">⬆ In</button>
        <button class="btn ghost sm" onclick="moveModal('out','${p.id}')">⬇ Out</button>
        <button class="btn ghost sm" onclick="prodModal('${p.id}')">✎</button>
        <button class="btn danger sm" onclick="delProd('${p.id}')">✕</button>
      </td></tr>`).join('')+`</tbody></table>`
    : `<div class="empty">No products yet. Add cement, aggregate, admixtures…</div>`;
}
function stockMoveTable(){
  const moves=[...(DB.stockmoves||[])].sort((a,b)=>(b.date+b.id).localeCompare(a.date+a.id)).slice(0,10);
  if(!moves.length) return `<div class="empty">No stock movements yet.</div>`;
  return `<table class="table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th class="num">Qty</th><th>Note</th></tr></thead><tbody>`+
    moves.map(m=>{const p=product(m.productId);
      return `<tr><td>${fmtDate(m.date)}</td><td>${p.name||'-'}</td>
      <td>${m.type==='in'?'<span class="pill ok2">Stock In</span>':'<span class="pill low">Stock Out</span>'}</td>
      <td class="num">${m.qty} ${p.unit||''}</td><td>${m.note||''}</td></tr>`;}).join('')+`</tbody></table>`;
}
function prodModal(id){
  const p=id?product(id):{name:'',category:'Cement',unit:'Bags',stock:'',reorder:'',rate:''};
  const cats=['Cement','Aggregate','Admixture','Fuel','Steel','Other'];
  const units=['Bags','MT','Kg','Cft','Litre','Nos'];
  const isCustom = !!p.category && !cats.includes(p.category);      // saved custom category
  const selCat = isCustom ? 'Other' : (p.category||'Cement');
  modal((id?'Edit':'Add')+' Product',
    `<div class="form-grid">
      <div class="field full"><label>Product Name *</label><input id="pr_name" value="${p.name||''}" placeholder="e.g. Cement (OPC 53 Grade)"></div>
      <div class="field"><label>Category</label><select id="pr_cat" onchange="prCatToggle()">${cats.map(c=>`<option ${c===selCat?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Unit</label><select id="pr_unit">${units.map(u=>`<option ${u===p.unit?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="field full" id="pr_catother_wrap" style="display:${selCat==='Other'?'block':'none'}"><label>Specify Category *</label><input id="pr_catother" value="${isCustom?p.category:''}" placeholder="e.g. Diesel, GGBS, Water"></div>
      <div class="field"><label>${id?'Current':'Opening'} Stock</label><input id="pr_stock" type="number" step="0.01" value="${p.stock!==''?p.stock:''}"></div>
      <div class="field"><label>Reorder Level</label><input id="pr_reorder" type="number" step="0.01" value="${p.reorder!==''?p.reorder:''}"></div>
      <div class="field full"><label>Rate per Unit (₹)</label><input id="pr_rate" type="number" step="0.01" value="${p.rate!==''?p.rate:''}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveProd('${id||''}')">Save</button>`);
}
function prCatToggle(){
  const w=document.getElementById('pr_catother_wrap');
  if(w) w.style.display = (document.getElementById('pr_cat').value==='Other') ? 'block' : 'none';
}
function saveProd(id){
  if(!guardEdit())return;
  let category=val('pr_cat');
  if(category==='Other'){ const other=val('pr_catother'); if(!other) return toast('Please specify the category','err'); category=other; }
  const o={name:val('pr_name'),category,unit:val('pr_unit'),
    stock:Number(val('pr_stock'))||0,reorder:Number(val('pr_reorder'))||0,rate:Number(val('pr_rate'))||0};
  if(!o.name)return toast('Product name required','err');
  if(id){ Object.assign(product(id),o); } else { DB.products.push({id:uid('p'),...o}); }
  save(); closeModal(); toast('Product saved','ok'); renderInventory();
}
function delProd(id){ if(!guardEdit())return; if(confirm('Delete this product?')){ DB.products=DB.products.filter(p=>p.id!==id); save(); renderInventory(); } }
function moveModal(type,id){
  const p=product(id);
  modal((type==='in'?'Stock In — ':'Stock Out — ')+p.name,
    `<div class="calc"><div class="row"><span>Current Stock</span><span><b>${p.stock} ${p.unit}</b></span></div></div>
     <div class="form-grid" style="margin-top:12px">
      <div class="field"><label>Quantity (${p.unit}) *</label><input id="mv_qty" type="number" step="0.01" placeholder="0"></div>
      <div class="field"><label>Date</label><input id="mv_date" type="date" value="${todayISO()}"></div>
      <div class="field full"><label>Note</label><input id="mv_note" placeholder="${type==='in'?'Purchase / vendor / bill no.':'Batching / grade / invoice'}"></div>
     </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button>
     <button class="btn ${type==='in'?'green':''}" onclick="saveMove('${type}','${id}')">${type==='in'?'Add to Stock':'Remove from Stock'}</button>`);
}
function saveMove(type,id){
  if(!guardEdit())return;
  const p=product(id); const qty=Number(val('mv_qty'))||0;
  if(qty<=0)return toast('Enter a valid quantity','err');
  if(type==='out' && qty>p.stock && !confirm('Quantity exceeds current stock — record anyway (stock will go negative)?')) return;
  p.stock = round2(type==='in' ? p.stock+qty : p.stock-qty);
  DB.stockmoves.push({id:uid('sm'),productId:id,type,qty,date:val('mv_date')||todayISO(),note:val('mv_note'),at:nowStamp(),by:(ME&&ME.name)||''});
  logAct('Stock '+(type==='in'?'in':'out'),p.name+' — '+qty+' '+(p.unit||''));
  save(); closeModal(); toast('Stock '+(type==='in'?'added':'removed'),'ok'); renderInventory();
}
function exportInventoryCSV(){
  const rows=[['Product','Category','Unit','Current Stock','Reorder Level','Rate','Stock Value','Status']];
  (DB.products||[]).forEach(p=>rows.push([p.name,p.category,p.unit,p.stock,p.reorder,p.rate,round2(p.stock*(p.rate||0)),lowStock(p)?'LOW':'OK']));
  downloadCSV('DNK_Inventory_'+todayISO()+'.csv',rows);
}

/* ================= STAFF ATTENDANCE ================= */
let staffDate=todayISO();
const ATT=[['P','Present'],['A','Absent'],['H','Half-day'],['L','Leave']];
function staffById(id){ return (DB.staff||[]).find(s=>s.id===id)||{}; }
function attFor(staffId,date){ return (DB.attendance||[]).find(a=>a.staffId===staffId&&a.date===date); }
function attCount(staffId,ym,status){ return (DB.attendance||[]).filter(a=>a.staffId===staffId&&a.date.slice(0,7)===ym&&a.status===status).length; }
function renderStaff(){
  staffDate=staffDate||todayISO();
  document.getElementById('main').innerHTML=
    topbar('Staff Attendance','Mark daily attendance and view the monthly summary',
      canEdit()?`<button class="btn gold" onclick="staffModal()">➕ Add Staff</button>`:'')+
    `<div class="toolbar">
      <label style="font-size:12px;color:var(--muted)">Date</label>
      <input type="date" id="staffDate" value="${staffDate}" onchange="staffDate=this.value;renderStaff()" style="max-width:170px">
      <button class="btn ghost" onclick="markAllPresent()">✔ Mark all Present</button>
      <button class="btn ghost" onclick="exportAttendanceCSV()">⬇ Attendance CSV</button>
    </div>
    <div class="grid kpis" id="attKpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px"></div>
    <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Attendance — ${fmtDate(staffDate)}</h3></div><div class="bd" style="padding:0" id="staffTbl"></div></div>
    <div class="card"><div class="hd"><h3>Monthly Summary — ${monthName(staffDate.slice(0,7))}</h3></div><div class="bd" style="padding:0" id="staffMonth"></div></div>`;
  drawStaff();
}
function drawStaff(){
  const staff=(DB.staff||[]).filter(s=>s.active!==false);
  const ym=staffDate.slice(0,7);
  const cnt={P:0,A:0,H:0,L:0};
  staff.forEach(s=>{const a=attFor(s.id,staffDate); if(a&&cnt[a.status]!=null) cnt[a.status]++;});
  document.getElementById('attKpis').innerHTML=
    `<div class="kpi green"><div class="lab">Present</div><div class="val">${cnt.P}</div></div>
     <div class="kpi red"><div class="lab">Absent</div><div class="val">${cnt.A}</div></div>
     <div class="kpi accent"><div class="lab">Half-day</div><div class="val">${cnt.H}</div></div>
     <div class="kpi blue"><div class="lab">Leave</div><div class="val">${cnt.L}</div></div>`;
  document.getElementById('staffTbl').innerHTML = staff.length?
    `<table class="table"><thead><tr><th>Staff</th><th>Role</th><th class="num">Wage/day</th><th>Attendance</th><th class="right"></th></tr></thead><tbody>`+
    staff.map(s=>{const a=attFor(s.id,staffDate);const cur=a?a.status:'';
      return `<tr><td><b>${s.name}</b><br><span class="muted" style="font-size:11px">${s.phone||''}</span></td>
      <td>${s.role||'-'}</td><td class="num">₹${inr(s.wage||0)}</td>
      <td><span class="att-btns">${ATT.map(([k,lab])=>`<button class="att-btn ${k} ${cur===k?'on':''}" title="${lab}" onclick="markAtt('${s.id}','${k}')">${k}</button>`).join('')}</span></td>
      <td class="right"><button class="btn ghost sm" onclick="staffModal('${s.id}')">✎</button><button class="btn danger sm" onclick="delStaff('${s.id}')">✕</button></td></tr>`;}).join('')+`</tbody></table>`
    : `<div class="empty">No staff added yet.</div>`;
  document.getElementById('staffMonth').innerHTML = staff.length?
    `<table class="table"><thead><tr><th>Staff</th><th class="num">Present</th><th class="num">Absent</th><th class="num">Half-day</th><th class="num">Leave</th><th class="num">Payable Days</th></tr></thead><tbody>`+
    staff.map(s=>{const P=attCount(s.id,ym,'P'),A=attCount(s.id,ym,'A'),H=attCount(s.id,ym,'H'),L=attCount(s.id,ym,'L');
      return `<tr><td><b>${s.name}</b></td><td class="num">${P}</td><td class="num">${A}</td><td class="num">${H}</td><td class="num">${L}</td><td class="num"><b>${(P+H*0.5).toFixed(1)}</b></td></tr>`;}).join('')+`</tbody></table>`
    : '';
}
function markAtt(staffId,status){
  if(!guardEdit())return;
  const a=attFor(staffId,staffDate);
  if(a){ a.status = a.status===status ? '' : status; if(!a.status){ DB.attendance=DB.attendance.filter(x=>x!==a); } }
  else { DB.attendance.push({id:uid('at'),staffId,date:staffDate,status}); }
  save(); drawStaff();
}
function markAllPresent(){
  if(!guardEdit())return;
  (DB.staff||[]).filter(s=>s.active!==false).forEach(s=>{ if(!attFor(s.id,staffDate)) DB.attendance.push({id:uid('at'),staffId:s.id,date:staffDate,status:'P'}); else attFor(s.id,staffDate).status='P'; });
  save(); toast('All marked present','ok'); drawStaff();
}
function staffModal(id){
  const s=id?staffById(id):{name:'',role:'',phone:'',wage:'',monthlySalary:'',joinDate:'',leaveAllowed:2,active:true};
  modal((id?'Edit':'Add')+' Staff',
    `<div class="form-grid">
      <div class="field"><label>Name *</label><input id="sf_name" value="${s.name||''}"></div>
      <div class="field"><label>Designation</label><input id="sf_role" value="${s.role||''}" placeholder="Driver / Operator / Loader"></div>
      <div class="field"><label>Phone</label><input id="sf_phone" value="${s.phone||''}"></div>
      <div class="field"><label>Joining Date</label><input id="sf_join" type="date" value="${s.joinDate||''}"></div>
      <div class="field"><label>Monthly Salary (₹)</label><input id="sf_msal" type="number" value="${s.monthlySalary!==''&&s.monthlySalary!=null?s.monthlySalary:''}"></div>
      <div class="field"><label>Wage per day (₹)</label><input id="sf_wage" type="number" value="${s.wage!==''&&s.wage!=null?s.wage:''}"></div>
      <div class="field"><label>Paid Leave / month (days)</label><input id="sf_leave" type="number" step="0.5" value="${s.leaveAllowed!=null?s.leaveAllowed:2}"></div>
      <div class="field"><label>Status</label><select id="sf_active"><option value="1" ${s.active!==false?'selected':''}>Active</option><option value="0" ${s.active===false?'selected':''}>Inactive</option></select></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveStaff('${id||''}')">Save</button>`);
}
function saveStaff(id){
  if(!guardEdit())return;
  const o={name:val('sf_name'),role:val('sf_role'),phone:val('sf_phone'),wage:Number(val('sf_wage'))||0,
    monthlySalary:Number(val('sf_msal'))||0,joinDate:val('sf_join'),leaveAllowed:Number(val('sf_leave'))||0,active:val('sf_active')==='1'};
  if(!o.name)return toast('Name required','err');
  if(id){ Object.assign(staffById(id),o); } else { DB.staff.push({id:uid('st'),...o}); }
  save(); closeModal(); toast('Staff saved','ok'); renderStaff();
}
function delStaff(id){ if(!guardEdit())return; if(confirm('Delete this staff member?')){ DB.staff=DB.staff.filter(s=>s.id!==id); save(); renderStaff(); } }
function exportAttendanceCSV(){
  const ym=staffDate.slice(0,7);
  const rows=[['Staff','Role','Month','Present','Absent','Half-day','Leave','Payable Days']];
  (DB.staff||[]).forEach(s=>{const P=attCount(s.id,ym,'P'),A=attCount(s.id,ym,'A'),H=attCount(s.id,ym,'H'),L=attCount(s.id,ym,'L');
    rows.push([s.name,s.role,monthName(ym),P,A,H,L,(P+H*0.5).toFixed(1)]);});
  downloadCSV('DNK_Attendance_'+ym+'.csv',rows);
}

/* ================= SALARY / PAYROLL ================= */
let payMonth=todayISO().slice(0,7);
function advTotal(staffId,ym){ return (DB.advances||[]).filter(a=>a.staffId===staffId&&a.date.slice(0,7)===ym).reduce((s,a)=>s+(+a.amount||0),0); }
function salaryRecord(staffId,ym){ return (DB.salaryRecords||[]).find(r=>r.staffId===staffId&&r.month===ym); }
function computePay(s,ym){
  const P=attCount(s.id,ym,'P'),A=attCount(s.id,ym,'A'),H=attCount(s.id,ym,'H'),L=attCount(s.id,ym,'L');
  const gross=+s.monthlySalary||0;
  const allowed=+s.leaveAllowed||0;
  const lopDays=round2(Math.max(0,(A+L)-allowed)+H*0.5);   // unpaid days beyond eligible leave (+ half-days)
  const perDay=round2(gross/30);                            // 30-day salary basis
  const lop=round2(perDay*lopDays);
  const adv=advTotal(s.id,ym);
  const net=round2(gross-lop-adv);
  return {P,A,H,L,gross,allowed,lopDays,perDay,lop,adv,net};
}
function renderPayroll(){
  payMonth=payMonth||todayISO().slice(0,7);
  const staff=(DB.staff||[]).filter(s=>s.active!==false);
  const ym=payMonth;
  let totGross=0,totLop=0,totAdv=0,totNet=0;
  staff.forEach(s=>{const c=computePay(s,ym);totGross+=c.gross;totLop+=c.lop;totAdv+=c.adv;totNet+=c.net;});
  document.getElementById('main').innerHTML=
    topbar('Salary / Payroll','Monthly salary — auto LOP for excess leave, less advances = net payable')+
    `<div class="toolbar">
      <label style="font-size:12px;color:var(--muted)">Month</label>
      <input type="month" id="payMonth" value="${ym}" onchange="payMonth=this.value;renderPayroll()" style="max-width:180px">
      <button class="btn ghost" onclick="exportPayrollCSV()">⬇ Payroll CSV</button>
    </div>
    <div class="grid kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi blue"><div class="lab">Gross (Month)</div><div class="val">₹${inr(totGross)}</div><div class="sub">${staff.length} staff</div></div>
      <div class="kpi red"><div class="lab">LOP Deduction</div><div class="val">₹${inr(totLop)}</div></div>
      <div class="kpi accent"><div class="lab">Advances Paid</div><div class="val">₹${inr(totAdv)}</div></div>
      <div class="kpi green"><div class="lab">Net Payable</div><div class="val">₹${inr(totNet)}</div></div>
    </div>
    <div class="card"><div class="hd"><h3>Salary Sheet — ${monthName(ym)}</h3></div><div class="bd" style="padding:0" id="payTbl"></div></div>`;
  drawPayroll();
}
function drawPayroll(){
  const staff=(DB.staff||[]).filter(s=>s.active!==false);
  const ym=payMonth;
  document.getElementById('payTbl').innerHTML = staff.length?
    `<table class="table"><thead><tr><th>Staff</th><th class="num">Gross</th><th class="num" title="Present">P</th><th class="num" title="Absent">A</th><th class="num" title="Half-day">H</th><th class="num" title="Leave">L</th><th class="num">LOP Days</th><th class="num">LOP ₹</th><th class="num">Advances</th><th class="num">Net Payable</th><th class="right">Actions</th></tr></thead><tbody>`+
    staff.map(s=>{const c=computePay(s,ym);const done=salaryRecord(s.id,ym);
      return `<tr><td><b>${s.name}</b><br><span class="muted" style="font-size:11px">${s.role||''}</span></td>
        <td class="num">₹${inr(c.gross)}</td>
        <td class="num">${c.P}</td><td class="num">${c.A}</td><td class="num">${c.H}</td><td class="num">${c.L}</td>
        <td class="num">${c.lopDays.toFixed(1)}</td><td class="num">₹${inr(c.lop)}</td>
        <td class="num">₹${inr(c.adv)}</td><td class="num"><b>₹${inr(c.net)}</b> ${done?'<span class="pill paid">Processed</span>':''}</td>
        <td class="right">
          ${canEdit()?`<button class="btn ghost sm" onclick="advanceModal('${s.id}')">➕ Advance</button>`:''}
          <button class="btn ghost sm" onclick="printPayslip('${s.id}')">🧾 Payslip</button>
          ${canEdit()?`<button class="btn green sm" onclick="processSalary('${s.id}')">✔ Process</button>`:''}
        </td></tr>`;}).join('')+`</tbody></table>`
    : `<div class="empty">No active staff. Add staff in the Staff Attendance screen.</div>`;
}
function advanceModal(id){
  const s=staffById(id);
  modal('Salary Advance — '+s.name,
    `<div class="muted" style="margin-bottom:10px;font-size:12px">Advances this month (${monthName(payMonth)}): <b>₹${inr(advTotal(id,payMonth))}</b></div>
     <div class="form-grid">
      <div class="field"><label>Amount (₹) *</label><input id="av_amt" type="number" step="0.01" placeholder="e.g. 2000"></div>
      <div class="field"><label>Date</label><input id="av_date" type="date" value="${todayISO()}"></div>
      <div class="field full"><label>Note</label><input id="av_note" placeholder="Weekly advance / reason"></div>
     </div>
     <div id="av_list" style="margin-top:12px">${advListHTML(id)}</div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn green" onclick="saveAdvance('${id}')">Add Advance</button>`);
}
function advListHTML(id){
  const list=(DB.advances||[]).filter(a=>a.staffId===id&&a.date.slice(0,7)===payMonth).sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length) return '<div class="muted" style="font-size:12px">No advances recorded this month.</div>';
  return `<table class="table"><thead><tr><th>Date</th><th>Note</th><th class="num">Amount</th><th class="right"></th></tr></thead><tbody>`+
    list.map(a=>`<tr><td>${fmtDate(a.date)}</td><td>${a.note||''}</td><td class="num">₹${inr(a.amount)}</td>
      <td class="right">${canEdit()?`<button class="btn danger sm" onclick="delAdvance('${a.id}')">✕</button>`:''}</td></tr>`).join('')+`</tbody></table>`;
}
function saveAdvance(id){
  if(!guardEdit())return;
  const amt=Number(val('av_amt'))||0;
  if(amt<=0)return toast('Enter a valid amount','err');
  DB.advances=DB.advances||[];
  DB.advances.push({id:uid('ad'),staffId:id,date:val('av_date')||todayISO(),amount:amt,note:val('av_note'),at:nowStamp()});
  logAct('Salary advance',(staffById(id).name||'')+' — ₹'+inr(amt));
  save(); toast('Advance recorded','ok');
  document.getElementById('av_list').innerHTML=advListHTML(id);
  const d=document.getElementById('av_amt'); if(d){d.value='';}
}
function delAdvance(id){
  if(!guardEdit())return;
  const a=(DB.advances||[]).find(x=>x.id===id); if(!a)return;
  DB.advances=DB.advances.filter(x=>x.id!==id); save();
  const box=document.getElementById('av_list'); if(box) box.innerHTML=advListHTML(a.staffId);
  drawPayroll();
}
function processSalary(id){
  if(!guardEdit())return;
  const s=staffById(id); const ym=payMonth; const c=computePay(s,ym);
  const existing=salaryRecord(id,ym);
  const rec={id:existing?existing.id:uid('sr'),staffId:id,staffName:s.name,month:ym,gross:c.gross,
    present:c.P,absent:c.A,halfday:c.H,leave:c.L,lopDays:c.lopDays,lop:c.lop,advances:c.adv,net:c.net,savedAt:nowStamp(),by:(ME&&ME.name)||''};
  DB.salaryRecords=DB.salaryRecords||[];
  if(existing){ Object.assign(existing,rec); } else { DB.salaryRecords.push(rec); }
  logAct('Salary processed',(s.name||'')+' — '+monthName(ym)+' net ₹'+inr(c.net));
  save(); toast('Salary processed for '+monthName(ym),'ok'); drawPayroll();
}
function printPayslip(id){
  const s=staffById(id); const ym=payMonth; const c=computePay(s,ym); const co=DB.company;
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${s.name} ${ym}</title>
    <style>body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:12px;padding:18px}
    h2{margin:0}.muted{color:#666}table{border-collapse:collapse;width:100%;margin-top:10px}
    td,th{border:1px solid #999;padding:5px 8px}.r{text-align:right}th{background:#f0f0f0;text-align:left}
    .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #14508c;padding-bottom:8px}
    .net{background:#099330;color:#fff;font-weight:700}</style></head><body>
    <div class="head"><div><h2>${co.name}</h2><div class="muted">${co.addressLines.join(', ')}</div></div>
      <img src="${window.LOGO_DATA}" style="width:66px;height:66px;object-fit:contain"></div>
    <h3 style="margin:12px 0 0">Salary Slip — ${monthName(ym)}</h3>
    <div class="muted">Employee: <b>${s.name}</b> • ${s.role||''} ${s.joinDate?('• Joined '+fmtDate(s.joinDate)):''}</div>
    <table><tbody>
      <tr><th>Gross Salary (monthly)</th><td class="r">₹ ${inr(c.gross)}</td></tr>
      <tr><td>Attendance — P:${c.P} A:${c.A} H:${c.H} L:${c.L} &nbsp; (Paid leave allowed: ${c.allowed})</td><td class="r muted">—</td></tr>
      <tr><td>Loss of Pay — ${c.lopDays.toFixed(1)} day(s) @ ₹${inr(c.perDay)}/day</td><td class="r">− ₹ ${inr(c.lop)}</td></tr>
      <tr><td>Advances paid this month</td><td class="r">− ₹ ${inr(c.adv)}</td></tr>
      <tr class="net"><td>NET PAYABLE</td><td class="r">₹ ${inr(c.net)}</td></tr>
    </tbody></table>
    <div class="muted" style="margin-top:8px">${numToWords(c.net)}</div>
    <div style="margin-top:34px;display:flex;justify-content:space-between"><div>Employee Signature</div><div>For ${co.name}</div></div>
    <div class="muted" style="margin-top:16px;text-align:center">Computer-generated salary slip • 30-day salary basis.</div>
    </body></html>`;
  openPrint(html);
}
function exportPayrollCSV(){
  const ym=payMonth;
  const rows=[['Staff','Designation','Month','Gross','Present','Absent','Half-day','Leave','LOP Days','LOP Amount','Advances','Net Payable','Status']];
  (DB.staff||[]).filter(s=>s.active!==false).forEach(s=>{const c=computePay(s,ym);
    rows.push([s.name,s.role,monthName(ym),c.gross,c.P,c.A,c.H,c.L,c.lopDays,c.lop,c.adv,c.net,salaryRecord(s.id,ym)?'Processed':'Draft']);});
  downloadCSV('DNK_Payroll_'+ym+'.csv',rows);
}

/* ================= VENDORS & PURCHASES ================= */
function vendor(id){ return (DB.vendors||[]).find(v=>v.id===id)||{}; }
function purchasesFor(vid){ return (DB.purchases||[]).filter(p=>p.vendorId===vid); }
function renderVendors(){
  const vends=DB.vendors||[]; const purch=DB.purchases||[];
  const totVal=purch.reduce((s,p)=>s+(+p.amount||0),0);
  const totDue=purch.reduce((s,p)=>s+((+p.amount||0)-(+p.paid||0)),0);
  const actions=canEdit()?`<button class="btn gold" onclick="purchaseModal()">➕ Record Purchase</button>
     <button class="btn" onclick="vendorModal()">＋ Add Vendor</button>`:'';
  document.getElementById('main').innerHTML=
    topbar('Vendors & Purchases','Suppliers of cement, aggregate, sand, admixture — record purchases &amp; dues',actions)+
    `<div class="grid kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      <div class="kpi blue"><div class="lab">Vendors</div><div class="val">${vends.length}</div></div>
      <div class="kpi accent"><div class="lab">Total Purchases</div><div class="val">₹${inr(totVal)}</div><div class="sub">${purch.length} entries</div></div>
      <div class="kpi red"><div class="lab">Payable to Vendors</div><div class="val">₹${inr(totDue)}</div></div>
    </div>
    <div class="toolbar"><button class="btn ghost" onclick="exportVendorsCSV()">⬇ Vendors CSV</button>
      <button class="btn ghost" onclick="exportPurchasesCSV()">⬇ Purchases CSV</button></div>
    <div class="card" style="margin-bottom:16px"><div class="hd"><h3>Vendors</h3></div><div class="bd" style="padding:0">
      ${vends.length?`<table class="table"><thead><tr><th>Vendor</th><th>Material</th><th>GSTIN</th><th>Phone</th><th class="num">Purchases</th><th class="num">Value</th><th class="right"></th></tr></thead><tbody>`+
      vends.map(v=>{const ps=purchasesFor(v.id);const val=ps.reduce((s,p)=>s+(+p.amount||0),0);
        return `<tr><td><b>${v.name}</b></td><td>${v.material||'-'}</td><td>${v.gstin||'—'}</td><td>${v.phone||'-'}</td>
        <td class="num">${ps.length}</td><td class="num">₹${inr(val)}</td>
        <td class="right">${canEdit()?`<button class="btn ghost sm" onclick="vendorModal('${v.id}')">✎</button><button class="btn danger sm" onclick="delVendor('${v.id}')">✕</button>`:''}</td></tr>`;}).join('')+`</tbody></table>`
      :'<div class="empty">No vendors yet.</div>'}
    </div></div>
    <div class="card"><div class="hd"><h3>Purchase Records</h3></div><div class="bd" style="padding:0" id="purchTbl"></div></div>`;
  drawPurchases();
}
function drawPurchases(){
  const purch=[...(DB.purchases||[])].sort((a,b)=>(b.date+(b.at||'')).localeCompare(a.date+(a.at||'')));
  document.getElementById('purchTbl').innerHTML = purch.length?
    `<table class="table"><thead><tr><th>Date / Time</th><th>Vendor</th><th>Material</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th class="num">Paid</th><th class="num">Due</th><th>Bill No</th><th class="right">Actions</th></tr></thead><tbody>`+
    purch.map(p=>{const v=vendor(p.vendorId);const pr=product(p.productId);const due=round2((+p.amount||0)-(+p.paid||0));
      return `<tr><td>${fmtDate(p.date)}<br><span class="muted" style="font-size:10px">${p.at||''}</span></td>
        <td>${v.name||'-'}</td><td>${pr.name||p.material||'-'}</td>
        <td class="num">${p.qty}</td><td class="num">₹${inr(p.rate)}</td><td class="num"><b>₹${inr(p.amount)}</b></td>
        <td class="num">₹${inr(p.paid||0)}</td><td class="num">${due>0.5?'₹'+inr(due):'—'}</td><td>${p.billNo||'-'}</td>
        <td class="right">${canEdit()&&due>0.5?`<button class="btn green sm" onclick="payPurchaseModal('${p.id}')">💰 Pay</button>`:''}${canEdit()?`<button class="btn danger sm" onclick="delPurchase('${p.id}')">✕</button>`:''}</td></tr>`;}).join('')+`</tbody></table>`
    : `<div class="empty">No purchases recorded yet.</div>`;
}
function vendorModal(id){
  const v=id?vendor(id):{name:'',gstin:'',phone:'',material:'',address:''};
  modal((id?'Edit':'Add')+' Vendor',
    `<div class="form-grid">
      <div class="field full"><label>Vendor Name *</label><input id="vn_name" value="${v.name||''}"></div>
      <div class="field"><label>Material Supplied</label><input id="vn_mat" value="${v.material||''}" placeholder="Cement / Aggregate / Sand"></div>
      <div class="field"><label>GSTIN</label><input id="vn_gstin" value="${v.gstin||''}"></div>
      <div class="field"><label>Phone</label><input id="vn_phone" value="${v.phone||''}"></div>
      <div class="field full"><label>Address</label><textarea id="vn_addr" rows="2">${v.address||''}</textarea></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveVendor('${id||''}')">Save</button>`);
}
function saveVendor(id){
  if(!guardEdit())return;
  const o={name:val('vn_name'),material:val('vn_mat'),gstin:val('vn_gstin'),phone:val('vn_phone'),address:val('vn_addr')};
  if(!o.name)return toast('Vendor name required','err');
  DB.vendors=DB.vendors||[];
  if(id){Object.assign(vendor(id),o);}else{DB.vendors.push({id:uid('vn'),...o});}
  logAct(id?'Vendor updated':'Vendor added',o.name);
  save();closeModal();toast('Vendor saved','ok');renderVendors();
}
function delVendor(id){
  if(!guardEdit())return;
  if(purchasesFor(id).length)return toast('Cannot delete — vendor has purchase records','err');
  if(confirm('Delete vendor?')){ DB.vendors=DB.vendors.filter(v=>v.id!==id); save(); renderVendors(); }
}
function purchaseModal(id){
  const p=id?(DB.purchases||[]).find(x=>x.id===id):{vendorId:'',productId:'',qty:'',rate:'',date:todayISO(),billNo:'',paid:''};
  const vopts=(DB.vendors||[]).map(v=>`<option value="${v.id}" ${v.id===p.vendorId?'selected':''}>${v.name}</option>`).join('');
  const popts=(DB.products||[]).map(pr=>`<option value="${pr.id}" ${pr.id===p.productId?'selected':''}>${pr.name} (${pr.unit})</option>`).join('');
  modal((id?'Edit':'Record')+' Purchase',
    `<div class="form-grid">
      <div class="field"><label>Vendor *</label><select id="pu_vendor"><option value="">— Select Vendor —</option>${vopts}</select></div>
      <div class="field"><label>Product (adds to stock)</label><select id="pu_product"><option value="">— None / other —</option>${popts}</select></div>
      <div class="field"><label>Quantity *</label><input id="pu_qty" type="number" step="0.01" oninput="puCalc()" value="${p.qty!==''&&p.qty!=null?p.qty:''}"></div>
      <div class="field"><label>Rate (₹) *</label><input id="pu_rate" type="number" step="0.01" oninput="puCalc()" value="${p.rate!==''&&p.rate!=null?p.rate:''}"></div>
      <div class="field"><label>Amount (₹)</label><input id="pu_amount" type="number" step="0.01" value="${p.amount!=null?p.amount:''}" readonly></div>
      <div class="field"><label>Amount Paid (₹)</label><input id="pu_paid" type="number" step="0.01" value="${p.paid!==''&&p.paid!=null?p.paid:''}"></div>
      <div class="field"><label>Bill / Invoice No</label><input id="pu_bill" value="${p.billNo||''}"></div>
      <div class="field"><label>Date</label><input id="pu_date" type="date" value="${p.date||todayISO()}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn green" onclick="savePurchase('${id||''}')">Save Purchase</button>`);
  puCalc();
}
function puCalc(){ const q=Number(val('pu_qty'))||0,r=Number(val('pu_rate'))||0; const a=document.getElementById('pu_amount'); if(a)a.value=round2(q*r); }
function savePurchase(id){
  if(!guardEdit())return;
  const vendorId=val('pu_vendor'), productId=val('pu_product');
  const qty=Number(val('pu_qty'))||0, rate=Number(val('pu_rate'))||0, amount=round2(qty*rate), paid=Number(val('pu_paid'))||0;
  if(!vendorId)return toast('Select a vendor','err');
  if(qty<=0||rate<=0)return toast('Enter quantity and rate','err');
  const o={vendorId,productId,qty,rate,amount,paid,billNo:val('pu_bill'),date:val('pu_date')||todayISO()};
  DB.purchases=DB.purchases||[];
  if(id){ Object.assign((DB.purchases).find(x=>x.id===id),o); }
  else{
    o.id=uid('pu'); o.at=nowStamp();
    DB.purchases.push(o);
    if(productId){ const pr=product(productId); if(pr&&pr.id){ pr.stock=round2((pr.stock||0)+qty);
      DB.stockmoves.push({id:uid('sm'),productId,type:'in',qty,date:o.date,note:'Purchase — '+(vendor(vendorId).name||''),at:nowStamp(),by:(ME&&ME.name)||''}); } }
  }
  logAct('Purchase recorded',(vendor(vendorId).name||'')+' — ₹'+inr(amount)+(productId?(' ('+(product(productId).name||'')+')'):''));
  save();closeModal();toast('Purchase recorded','ok');renderVendors();
}
function delPurchase(id){
  if(!guardEdit())return;
  if(confirm('Delete this purchase record?')){ DB.purchases=DB.purchases.filter(p=>p.id!==id); save(); renderVendors(); }
}
function payPurchaseModal(id){
  const p=(DB.purchases||[]).find(x=>x.id===id); const due=round2((+p.amount||0)-(+p.paid||0));
  modal('Pay Vendor — '+(vendor(p.vendorId).name||''),
    `<div class="calc"><div class="row"><span>Purchase Amount</span><span>₹ ${inr(p.amount)}</span></div>
     <div class="row"><span>Already Paid</span><span>₹ ${inr(p.paid||0)}</span></div>
     <div class="row total"><span>Due</span><span>₹ ${inr(due)}</span></div></div>
     <div class="field" style="margin-top:14px"><label>Amount paying now (₹)</label><input id="pp_amt" type="number" step="0.01" value="${due.toFixed(2)}"></div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn green" onclick="doPayPurchase('${id}')">Save Payment</button>`);
}
function doPayPurchase(id){
  if(!guardEdit())return;
  const amt=Number(val('pp_amt'))||0; const p=(DB.purchases||[]).find(x=>x.id===id);
  p.paid=round2((+p.paid||0)+amt); if(p.paid<0)p.paid=0;
  logAct('Vendor payment',(vendor(p.vendorId).name||'')+' — ₹'+inr(amt));
  save();closeModal();toast('Vendor payment recorded','ok');renderVendors();
}
function exportVendorsCSV(){
  const rows=[['Vendor','Material','GSTIN','Phone','Address','Purchases','Total Value','Total Paid','Balance Due']];
  (DB.vendors||[]).forEach(v=>{const ps=purchasesFor(v.id);const val=ps.reduce((s,p)=>s+(+p.amount||0),0);const paid=ps.reduce((s,p)=>s+(+p.paid||0),0);
    rows.push([v.name,v.material,v.gstin,v.phone,(v.address||'').replace(/\n/g,', '),ps.length,val,paid,round2(val-paid)]);});
  downloadCSV('DNK_Vendors_'+todayISO()+'.csv',rows);
}
function exportPurchasesCSV(){
  const rows=[['Date','Time','Vendor','Material/Product','Qty','Rate','Amount','Paid','Due','Bill No']];
  [...(DB.purchases||[])].sort((a,b)=>a.date.localeCompare(b.date)).forEach(p=>{const v=vendor(p.vendorId);const pr=product(p.productId);
    rows.push([p.date,p.at||'',v.name||'',pr.name||p.material||'',p.qty,p.rate,p.amount,p.paid||0,round2((+p.amount||0)-(+p.paid||0)),p.billNo||'']);});
  downloadCSV('DNK_Purchases_'+todayISO()+'.csv',rows);
}

/* ================= ACTIVITY LOG (audit trail) ================= */
let actSearch='';
function renderActivity(){
  document.getElementById('main').innerHTML=
    topbar('Activity Log','Audit trail — who did what, timestamped',
      canEdit()?`<button class="btn ghost" onclick="clearActivity()">Clear log</button>`:'')+
    `<div class="toolbar">
      <input class="search" id="actSearch" placeholder="🔍 Search user, action or detail…" value="${actSearch}" oninput="actSearch=this.value;drawActivity()">
      <button class="btn ghost" onclick="exportActivityCSV()">⬇ Activity CSV</button>
    </div>
    <div class="card"><div class="bd" style="padding:0" id="actTbl"></div></div>`;
  drawActivity();
}
function drawActivity(){
  const q=actSearch.toLowerCase();
  const list=[...(DB.activity||[])].reverse()
    .filter(a=>!q||[a.user,a.role,a.action,a.detail].join(' ').toLowerCase().includes(q))
    .slice(0,400);
  document.getElementById('actTbl').innerHTML = list.length?
    `<table class="table"><thead><tr><th>Date / Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead><tbody>`+
    list.map(a=>`<tr><td style="white-space:nowrap">${a.at||''}</td><td><b>${a.user||''}</b></td><td>${a.role||''}</td>
      <td>${a.action||''}</td><td>${a.detail||''}</td></tr>`).join('')+`</tbody></table>`
    : `<div class="empty">No activity recorded yet.</div>`;
}
function clearActivity(){
  if(!guardEdit())return;
  if(confirm('Clear the entire activity log? This cannot be undone.')){ DB.activity=[]; logAct('Activity log cleared',''); save(); renderActivity(); }
}
function exportActivityCSV(){
  const rows=[['Date/Time','User','Role','Action','Details']];
  [...(DB.activity||[])].forEach(a=>rows.push([a.at,a.user,a.role,a.action,a.detail]));
  downloadCSV('DNK_ActivityLog_'+todayISO()+'.csv',rows);
}

/* ================= BULK INVOICE DOWNLOAD (ZIP) ================= */
const _crcTable=(()=>{ let c,t=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32bytes(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=_crcTable[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function _u16(n){ return [n&0xFF,(n>>>8)&0xFF]; }
function _u32(n){ return [n&0xFF,(n>>>8)&0xFF,(n>>>16)&0xFF,(n>>>24)&0xFF]; }
function makeZip(files){   // files: [{name, data}] — store method (no compression)
  const enc=new TextEncoder(); const fileParts=[], central=[]; let offset=0;
  files.forEach(f=>{
    const nameB=enc.encode(f.name), dataB=enc.encode(f.data), crc=crc32bytes(dataB);
    const local=[].concat(_u32(0x04034b50),_u16(20),_u16(0),_u16(0),_u16(0),_u16(0),_u32(crc),_u32(dataB.length),_u32(dataB.length),_u16(nameB.length),_u16(0));
    fileParts.push(Uint8Array.from(local),nameB,dataB);
    const cen=[].concat(_u32(0x02014b50),_u16(20),_u16(20),_u16(0),_u16(0),_u16(0),_u16(0),_u32(crc),_u32(dataB.length),_u32(dataB.length),_u16(nameB.length),_u16(0),_u16(0),_u16(0),_u16(0),_u32(0),_u32(offset));
    central.push(Uint8Array.from(cen),nameB);
    offset+=local.length+nameB.length+dataB.length;
  });
  let centralLen=0; central.forEach(p=>centralLen+=p.length);
  const end=Uint8Array.from([].concat(_u32(0x06054b50),_u16(0),_u16(0),_u16(files.length),_u16(files.length),_u32(centralLen),_u32(offset),_u16(0)));
  const parts=[...fileParts,...central,end]; let total=0; parts.forEach(p=>total+=p.length);
  const out=new Uint8Array(total); let pos=0; parts.forEach(p=>{ out.set(p,pos); pos+=p.length; });
  return out;
}
function safeName(s){ return String(s||'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }
function zipModal(){
  modal('Bulk Invoice Download (ZIP)',
    `<div class="form-grid">
      <div class="field full"><label>Customer</label><select id="zp_cust"><option value="">All customers</option>${DB.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
      <div class="field"><label>From date</label><input id="zp_from" type="date"></div>
      <div class="field"><label>To date</label><input id="zp_to" type="date"></div>
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px">Leave dates empty for all-time. Each invoice is saved as a printable HTML file inside one ZIP.</div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn gold" onclick="doExportZip()">⬇ Download ZIP</button>`);
}
function doExportZip(){
  const cid=val('zp_cust'), from=val('zp_from'), to=val('zp_to');
  const list=DB.invoices.filter(i=>{
    if(cid&&i.customerId!==cid)return false;
    if(from&&i.date<from)return false;
    if(to&&i.date>to)return false;
    return true;
  }).sort((a,b)=>a.no.localeCompare(b.no));
  if(!list.length)return toast('No invoices match the selection','err');
  const files=list.map(i=>({name:safeName(i.no)+'_'+safeName(customer(i.customerId).name)+'.html',data:invoiceHTML(hydrate(i),DB.company)}));
  const bytes=makeZip(files);
  const blob=new Blob([bytes],{type:'application/zip'});
  const nm='DNK_Invoices_'+(cid?safeName(customer(cid).name):'All')+'_'+todayISO()+'.zip';
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nm;a.click();
  logAct('Bulk invoice ZIP',list.length+' invoice(s)'+(cid?(' — '+(customer(cid).name||'')):''));
  save(); closeModal(); toast('Downloaded '+list.length+' invoices as ZIP','ok');
}

/* ---------------- UI utils ---------------- */
function val(id){ const e=document.getElementById(id); return e?e.value.trim():''; }
function modal(title,body,footer){
  const el=document.createElement('div');el.className='modal-bg';el.id='modalBg';
  el.innerHTML=`<div class="modal"><div class="mhd"><h3>${title}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mbd">${body}</div><div class="mft">${footer}</div></div>`;
  el.onclick=e=>{if(e.target===el)closeModal();};
  document.body.appendChild(el);
}
function closeModal(){ const m=document.getElementById('modalBg'); if(m)m.remove(); }
let toastTimer;
function toast(msg,type){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
  t.textContent=msg;t.className='toast '+(type||'')+' show';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast '+(type||''),2500);
}

/* ---------------- Boot ---------------- */
renderApp();
