/* ============ DNK RMC Billing — MVP app logic (no build, localStorage) ============ */
const DB_KEY = 'dnk_rmc_v2';
const todayISO = () => new Date().toISOString().slice(0,10);

/* ---- Premium gating: these modules are visible but locked in the demo ----
   Flip DEMO_MODE to false in the full version to unlock everything. */
const DEMO_MODE = true;
const PREMIUM = ['leads','concalc','revenue','users'];
const ROLE_PERMS = {
  Admin:   {dashboard:1,newinvoice:1,invoices:1,payments:1,leads:1,concalc:1,revenue:1,customers:1,sites:1,vehicles:1,grades:1,rates:1,reports:1,users:1,settings:1},
  Manager: {dashboard:1,newinvoice:1,invoices:1,payments:1,leads:0,concalc:0,revenue:0,customers:1,sites:1,vehicles:1,grades:1,rates:1,reports:1,users:0,settings:0}
};
const PRO_META = {
  leads:   {title:'Leads & Follow-up (CRM)',   desc:'Capture every enquiry and never miss a follow-up — full sales pipeline built in.',
            feats:['Save leads with requirement, source & value','Follow-up status pipeline (New → Won/Lost)','Next follow-up reminders','Convert a won lead into a customer']},
  concalc: {title:'Concrete Calculator',       desc:'Tell the site size, get the concrete needed — instantly.',
            feats:['Cubic metres from area × thickness','Auto wastage allowance','Suggested transit-mixer loads','Estimated cost at the customer rate']},
  revenue: {title:'Revenue Calculator',        desc:'Project plant revenue, GST and profit from your dispatch plan.',
            feats:['Daily / monthly / yearly revenue projection','GST collected & net revenue','Cost & profit margin modelling','What-if planning by loads & rate']},
  users:   {title:'Users & Permissions',       desc:'Add staff logins and control exactly what each person can access.',
            feats:['Create unlimited staff users','Role-based access (Admin / Manager / custom)','Per-module permission toggles','Enable / disable accounts anytime']},
};

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
      {id:'g1',name:'M-15',hsn:'38245010',gst:18},
      {id:'g2',name:'M-20',hsn:'38245010',gst:18},
      {id:'g3',name:'M-20S',hsn:'38245010',gst:18},
      {id:'g4',name:'M-25',hsn:'38245010',gst:18},
      {id:'g5',name:'M-30',hsn:'38245010',gst:18},
      {id:'g6',name:'M-35',hsn:'38245010',gst:18},
      {id:'g7',name:'M-40',hsn:'38245010',gst:18},
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
      {id:'u1',name:'Administrator',username:'admin',role:'Admin',active:true,perms:{...ROLE_PERMS.Admin}},
      {id:'u2',name:'Rajesh (Site Manager)',username:'manager',role:'Manager',active:true,perms:{...ROLE_PERMS.Manager}},
    ],
    leads:[
      {id:'l1',name:'Prakash Builders',contact:'Mr. Prakash',phone:'9845012345',source:'Reference',
        requirement:'M-25, approx 200 Cum for apartment slab',value:900000,status:'Contacted',nextFollowup:'2026-07-10',notes:'Wants bulk rate quote.'},
      {id:'l2',name:'Green Valley Villas',contact:'Ms. Latha',phone:'9848098480',source:'Website',
        requirement:'M-30 for villa foundations',value:1500000,status:'Quoted',nextFollowup:'2026-07-09',notes:'Sent quote at ₹5050/Cum.'},
      {id:'l3',name:'Kuppam Highway Toll',contact:'Site Engineer',phone:'9000090000',source:'Tender',
        requirement:'M-20 / M-15 large volume, 6 months',value:5000000,status:'New',nextFollowup:'2026-07-12',notes:''},
    ],
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
  try{ const raw=store.get(DB_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  const s=seed(); store.set(DB_KEY,JSON.stringify(s)); return s;
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
  leads:renderLeads, concalc:renderConcalc, revenue:renderRevenue, users:renderUsers
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
      <p>Billing &amp; Dispatch System<br>V.Kota, Chittoor Dist., Andhra Pradesh</p>
    </div>
    <div class="login-right">
      <h2>Welcome</h2>
      <div class="sub">Enter the billing &amp; dispatch system</div>
      <div class="field"><label>Employee</label><input id="u" value="Administrator" onkeydown="if(event.key==='Enter')doLogin()"></div>
      <div class="field" style="margin-top:12px"><label>Sign in as</label>
        <select id="role" onchange="onRolePick()">
          <option value="Admin">Administrator — full access</option>
          <option value="Manager">Site Manager — limited access</option>
        </select></div>
      <div class="field" style="margin-top:12px"><label>Branch</label>
        <select id="branch"><option>V.Kota Plant (Head Office)</option><option>Palamaner</option><option>Kuppam</option></select></div>
      <button class="btn gold" style="width:100%;justify-content:center;margin-top:20px" onclick="doLogin()">Enter System →</button>
      <div class="hint">Demo access &nbsp;•&nbsp; try both roles to see permission control. Secure staff passwords are enabled in the full version.</div>
    </div>
  </div></div>`;
}
function onRolePick(){
  const r=document.getElementById('role').value;
  document.getElementById('u').value = r==='Manager' ? 'Rajesh (Site Manager)' : 'Administrator';
}
function doLogin(){
  const u=document.getElementById('u').value.trim();
  const role=document.getElementById('role').value;
  if(!u) return toast('Please enter the employee name','err');
  ME={name:u,role,perms:{...ROLE_PERMS[role]}};
  meSet(ME); DB.user={name:u,role}; loggedIn=true; authSet(true); current='dashboard'; renderApp();
}
function logout(){ loggedIn=false; ME=null; authSet(false); meSet(null); renderLogin(); }

/* ---------------- Shell ---------------- */
const NAV=[
  {grp:'Operations',items:[
    {r:'dashboard',ic:'📊',t:'Dashboard'},
    {r:'newinvoice',ic:'➕',t:'New Dispatch / Bill'},
    {r:'invoices',ic:'🧾',t:'Invoices'},
    {r:'payments',ic:'💰',t:'Outstanding'},
  ]},
  {grp:'Sales Tools',items:[
    {r:'leads',ic:'🎯',t:'Leads & Follow-up',pro:1},
    {r:'concalc',ic:'📐',t:'Concrete Calculator',pro:1},
    {r:'revenue',ic:'💹',t:'Revenue Calculator',pro:1},
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
    {r:'users',ic:'👥',t:'Users & Permissions',pro:1},
    {r:'settings',ic:'⚙️',t:'Settings & Backup'},
  ]},
];
function renderApp(){
  if(!loggedIn){ renderLogin(); return; }
  const perms=myPerms();
  const nav = NAV.map(g=>{
    const items=g.items.filter(i=>perms[i.r]);
    if(!items.length) return '';
    return `<div class="grp">${g.grp}</div>`+items.map(i=>
      `<a class="${current===i.r?'active':''}" onclick="go('${i.r}')"><span class="ic">${i.ic}</span><span class="nt">${i.t}</span>${i.pro?'<span class="pro">PRO</span>':''}</a>`).join('');
  }).join('');
  document.getElementById('root').innerHTML=`
  <div class="app">
    <div class="sidebar">
      <div class="brand"><img src="${window.LOGO_DATA}"><div><div class="bt">DNK POWER CONMIX</div><div class="bs">RMC BILLING SYSTEM</div></div></div>
      <div class="nav">${nav}</div>
    </div>
    <div class="main" id="main"></div>
  </div>`;
  if(!perms[current]) current='dashboard';
  (routes[current]||renderDashboard)();
  if(DEMO_MODE && PREMIUM.includes(current)) lockMain(current);
}
/* Show the real module UI, blurred, behind an unlock card (demo premium gate) */
function lockMain(key){
  const main=document.getElementById('main');
  main.classList.add('locked');
  const m=PRO_META[key]||{title:'Premium Feature',desc:'',feats:[]};
  const ov=document.createElement('div'); ov.className='lockcard';
  ov.innerHTML=`<div class="box">
    <div class="prtag">🔒 PREMIUM</div>
    <h3>${m.title}</h3>
    <p>${m.desc}</p>
    <ul class="feats">${m.feats.map(f=>`<li>${f}</li>`).join('')}</ul>
    <a class="btn gold" style="justify-content:center" href="mailto:dnkpowerconmix@gmail.com?subject=DNK%20RMC%20-%20Upgrade%20to%20Full%20Version">Unlock in the Full Version</a>
    <div class="muted" style="font-size:11px;margin-top:10px">Available after sign-up • included in the full package</div>
  </div>`;
  main.appendChild(ov);
}
function topbar(title,sub,actions){
  const u=ME||{name:'Administrator',role:'Admin'};
  return `<div class="topbar"><div><h2>${title}</h2><div class="sub">${sub||''}</div></div>
    <div style="display:flex;gap:14px;align-items:center">
    ${actions||''}
    <div class="userchip">👤 <div><b>${u.name}</b><br><span>${u.role}${u.role==='Manager'?' • limited':''}</span></div>
    <button class="btn ghost sm" onclick="logout()">Logout</button></div></div></div>`;
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const invs=DB.invoices;
  const today=todayISO();
  const thisMonth=today.slice(0,7);
  const monthInvs=invs.filter(i=>i.date.slice(0,7)===thisMonth);
  const todayInvs=invs.filter(i=>i.date===today);
  const monthSales=monthInvs.reduce((s,i)=>s+invTotals(i).grand,0);
  const totalOut=invs.reduce((s,i)=>s+(invTotals(i).grand-(i.paid||0)),0);
  const totalCum=invs.reduce((s,i)=>s+i.qty,0);
  const recent=[...invs].sort((a,b)=>b.no.localeCompare(a.no)).slice(0,6);

  document.getElementById('main').innerHTML=
    topbar('Dashboard','Overview of dispatches, sales and outstanding',
      `<button class="btn gold" onclick="go('newinvoice')">➕ New Dispatch / Bill</button>`)+
    `<div class="grid kpis" style="margin-bottom:18px">
      <div class="kpi accent"><div class="lab">This Month Sales</div><div class="val">₹${inr(monthSales)}</div><div class="sub">${monthInvs.length} invoices</div></div>
      <div class="kpi green"><div class="lab">Today's Dispatch</div><div class="val">${todayInvs.length}</div><div class="sub">${todayInvs.reduce((s,i)=>s+i.qty,0).toFixed(2)} Cum</div></div>
      <div class="kpi blue"><div class="lab">Total Concrete (All)</div><div class="val">${totalCum.toFixed(2)}</div><div class="sub">Cubic metres billed</div></div>
      <div class="kpi red"><div class="lab">Outstanding</div><div class="val">₹${inr(totalOut)}</div><div class="sub">across ${invs.filter(i=>invTotals(i).grand-(i.paid||0)>0.5).length} bills</div></div>
    </div>
    <div class="card"><div class="hd"><h3>Recent Invoices</h3><a onclick="go('invoices')" class="btn ghost sm">View all →</a></div>
    <div class="bd" style="padding:0">${invoiceTable(recent)}</div></div>`;
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
  readForm();
  if(!form.customerId){ return toast('Select a customer','err'); }
  if(!form.gradeId){ return toast('Select a concrete grade','err'); }
  if(!form.qty||form.qty<=0){ return toast('Enter quantity','err'); }
  if(!form.rate||form.rate<=0){ return toast('Enter rate','err'); }
  DB.seq+=1;
  const inv={id:uid('i'),no:'DNK/'+DB.seq,date:form.date,customerId:form.customerId,siteId:form.siteId,
    gradeId:form.gradeId,vehicleId:form.vehicleId,qty:form.qty,rate:form.rate,unit:'Cum',
    terms:form.terms,dispatchThrough:form.dispatchThrough,paid:0,createdAt:todayISO()};
  DB.invoices.push(inv); save();
  toast('Invoice '+inv.no+' generated','ok');
  printInvoice(inv.id);
  go('invoices');
}
function printInvoice(id){ const inv=DB.invoices.find(i=>i.id===id); openPrint(invoiceHTML(hydrate(inv),DB.company)); }
function printChallan(id){ const inv=DB.invoices.find(i=>i.id===id); openPrint(invoiceHTML(hydrate(inv),DB.company,{challan:true})); }

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
          ${due>0.5?`<button class="btn green sm" onclick="payModal('${i.id}')">💰 Pay</button>`:''}
          <button class="btn danger sm" onclick="delInvoice('${i.id}')">✕</button>
        </td></tr>`;}).join('')+`</tbody></table>`
    :`<div class="empty">No matching invoices.</div>`);
}
function delInvoice(id){ const i=DB.invoices.find(x=>x.id===id);
  if(confirm('Delete invoice '+i.no+'? This cannot be undone.')){ DB.invoices=DB.invoices.filter(x=>x.id!==id); save(); drawInvList(); toast('Invoice deleted'); } }

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
    </div></div>`;
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
  const amt=parseFloat(document.getElementById('payAmt').value)||0;
  const i=DB.invoices.find(x=>x.id===id);
  i.paid=(i.paid||0)+amt; if(i.paid<0)i.paid=0;
  DB.payments.push({id:uid('p'),invoiceId:id,amount:amt,date:todayISO()});
  save(); closeModal(); toast('Payment recorded','ok'); renderPayments();
}

/* ---------------- Masters: generic CRUD ---------------- */
function masterPage(title,sub,addLabel,addFn,tableHTML){
  document.getElementById('main').innerHTML=topbar(title,sub,`<button class="btn gold" onclick="${addFn}">➕ ${addLabel}</button>`)+
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
  const o={name:val('c_name'),gstin:val('c_gstin'),state:val('c_state'),stateCode:val('c_scode'),address:val('c_addr'),phone:val('c_phone')};
  if(!o.name)return toast('Name required','err');
  if(id){ Object.assign(customer(id),o); } else { DB.customers.push({id:uid('c'),...o}); }
  save(); closeModal(); toast('Customer saved','ok'); renderCustomers();
}
function delCust(id){ if(DB.invoices.some(i=>i.customerId===id))return toast('Cannot delete — has invoices','err');
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
function saveSite(id){ const o={name:val('s_name'),customerId:val('s_cust'),address:val('s_addr')};
  if(!o.name)return toast('Name required','err');
  if(id){Object.assign(site(id),o);}else{DB.sites.push({id:uid('s'),...o});}
  save();closeModal();toast('Site saved','ok');renderSites(); }
function delSite(id){ if(confirm('Delete site?')){ DB.sites=DB.sites.filter(s=>s.id!==id); save(); renderSites(); } }

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
function saveVeh(id){ const o={number:val('v_num'),driver:val('v_drv'),driverPhone:val('v_ph'),capacity:val('v_cap')};
  if(!o.number)return toast('Vehicle number required','err');
  if(id){Object.assign(vehicle(id),o);}else{DB.vehicles.push({id:uid('v'),...o});}
  save();closeModal();toast('Vehicle saved','ok');renderVehicles(); }
function delVeh(id){ if(confirm('Delete vehicle?')){ DB.vehicles=DB.vehicles.filter(v=>v.id!==id); save(); renderVehicles(); } }

/* Grades */
function renderGrades(){
  const rows=DB.grades.map(g=>`<tr><td><b>${g.name}</b></td><td>${g.hsn}</td><td>${g.gst}%</td>
    <td class="right"><button class="btn ghost sm" onclick="gradeModal('${g.id}')">✎ Edit</button><button class="btn danger sm" onclick="delGrade('${g.id}')">✕</button></td></tr>`).join('');
  masterPage('Concrete Grades','Product master — M15, M20, M20S, M25, M30…','Add Grade','gradeModal()',
    `<table class="table"><thead><tr><th>Grade</th><th>HSN/SAC</th><th>GST Rate</th><th class="right"></th></tr></thead><tbody>${rows}</tbody></table>`);
}
function gradeModal(id){
  const g=id?grade(id):{name:'',hsn:'38245010',gst:18};
  modal((id?'Edit':'Add')+' Grade',
    `<div class="form-grid">
      <div class="field"><label>Grade Name *</label><input id="g_name" value="${g.name||''}" placeholder="M-30"></div>
      <div class="field"><label>HSN/SAC</label><input id="g_hsn" value="${g.hsn||'38245010'}"></div>
      <div class="field"><label>GST Rate (%)</label><input id="g_gst" type="number" value="${g.gst!=null?g.gst:18}"></div>
    </div>`,
    `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveGrade('${id||''}')">Save</button>`);
}
function saveGrade(id){ const o={name:val('g_name'),hsn:val('g_hsn'),gst:parseFloat(val('g_gst'))||18};
  if(!o.name)return toast('Grade name required','err');
  if(id){Object.assign(grade(id),o);}else{DB.grades.push({id:uid('g'),...o});}
  save();closeModal();toast('Grade saved','ok');renderGrades(); }
function delGrade(id){ if(confirm('Delete grade?')){ DB.grades=DB.grades.filter(g=>g.id!==id); save(); renderGrades(); } }

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
function saveRate(id){ const o={customerId:val('rt_cust'),gradeId:val('rt_grade'),rate:parseFloat(val('rt_rate'))||0};
  if(!o.rate)return toast('Rate required','err');
  const dup=DB.rates.find(r=>r.customerId===o.customerId&&r.gradeId===o.gradeId&&r.id!==id);
  if(dup){ dup.rate=o.rate; } else if(id){Object.assign(DB.rates.find(x=>x.id===id),o);}else{DB.rates.push({id:uid('r'),...o});}
  save();closeModal();toast('Rate saved','ok');renderRates(); }
function delRate(id){ if(confirm('Delete rate?')){ DB.rates=DB.rates.filter(r=>r.id!==id); save(); renderRates(); } }

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
    </div>`;
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

/* ================= PREMIUM MODULES (built fully; locked in DEMO_MODE) ================= */

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
const PERM_LABELS={dashboard:'Dashboard',newinvoice:'New Bill',invoices:'Invoices',payments:'Outstanding',leads:'Leads',concalc:'Concrete Calc',revenue:'Revenue Calc',customers:'Customers',sites:'Sites',vehicles:'Vehicles',grades:'Grades',rates:'Rates',reports:'Reports',users:'Users',settings:'Settings'};
function renderUsers(){
  const users=DB.users||[];
  document.getElementById('main').innerHTML=topbar('Users & Permissions','Create staff logins and control what each person can access',
    `<button class="btn gold" onclick="userModal()">➕ Add User</button>`)+
   `<div class="card"><div class="bd" style="padding:0">
    <table class="table"><thead><tr><th>Name</th><th>Login</th><th>Role</th><th>Access</th><th>Status</th><th class="right"></th></tr></thead><tbody>
    ${users.map(u=>{const n=Object.values(u.perms||{}).filter(Boolean).length;
      return `<tr><td><b>${u.name}</b></td><td>${u.username||'-'}</td><td>${u.role}</td>
      <td>${n} of ${Object.keys(PERM_LABELS).length} modules</td>
      <td>${u.active?'<span class="pill paid">Active</span>':'<span class="pill due">Disabled</span>'}</td>
      <td class="right"><button class="btn ghost sm" onclick="userModal('${u.id}')">✎ Edit</button>${u.username==='admin'?'':`<button class="btn danger sm" onclick="delUser('${u.id}')">✕</button>`}</td></tr>`;}).join('')}
    </tbody></table></div></div>`;
}
function userModal(id){
  const u=id?DB.users.find(x=>x.id===id):{name:'',username:'',role:'Manager',active:true,perms:{...ROLE_PERMS.Manager}};
  modal((id?'Edit':'Add')+' User',
   `<div class="form-grid">
      <div class="field"><label>Full Name *</label><input id="us_name" value="${u.name||''}"></div>
      <div class="field"><label>Login Username *</label><input id="us_user" value="${u.username||''}"></div>
      <div class="field"><label>Role (preset)</label><select id="us_role" onchange="usRole()">${['Admin','Manager'].map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select id="us_active"><option value="1" ${u.active?'selected':''}>Active</option><option value="0" ${!u.active?'selected':''}>Disabled</option></select></div>
    </div>
    <label style="display:block;margin:14px 0 6px">Module Permissions</label>
    <div id="us_perms" class="permgrid">${Object.keys(PERM_LABELS).map(k=>`<label class="permchk"><input type="checkbox" data-k="${k}" ${u.perms&&u.perms[k]?'checked':''}> ${PERM_LABELS[k]}</label>`).join('')}</div>`,
   `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveUser('${id||''}')">Save</button>`);
}
function usRole(){ const base=ROLE_PERMS[document.getElementById('us_role').value]||{}; document.querySelectorAll('#us_perms input').forEach(cb=>{cb.checked=!!base[cb.dataset.k];}); }
function saveUser(id){
  const name=val('us_name'),username=val('us_user'),role=val('us_role'),active=val('us_active')==='1';
  if(!name||!username)return toast('Name and username required','err');
  const perms={}; document.querySelectorAll('#us_perms input').forEach(cb=>{perms[cb.dataset.k]=cb.checked?1:0;});
  DB.users=DB.users||[];
  if(id){Object.assign(DB.users.find(x=>x.id===id),{name,username,role,active,perms});}else{DB.users.push({id:uid('u'),name,username,role,active,perms});}
  save();closeModal();toast('User saved','ok');renderUsers();
}
function delUser(id){ if(confirm('Delete user?')){ DB.users=DB.users.filter(u=>u.id!==id); save(); renderUsers(); } }

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
