/* ============ Invoice / Challan print templates (Tally-style GST invoice) ============ */

function inr(n){ return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
/* Title-case a unit-of-measure for display, e.g. CUM/cum -> Cum, job -> Job */
function tcase(s){ return String(s||'').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()); }

/* ---- Number to Indian words with paisa ---- */
function numToWords(num){
  num = Math.round(Number(num)*100)/100;
  if(isNaN(num)) num = 0;
  const neg = num < 0;                 // guard negatives (e.g. advance > salary) so the
  num = Math.abs(num);                 // recursion below never gets a negative and breaks
  const rupees = Math.floor(num);
  const paise = Math.round((num-rupees)*100);
  const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function two(n){ return n<20?a[n]:b[Math.floor(n/10)]+(n%10?' '+a[n%10]:''); }
  function three(n){ return (n>=100?a[Math.floor(n/100)]+' Hundred'+(n%100?' ':''):'')+(n%100?two(n%100):''); }
  function inWords(n){
    if(n===0) return 'Zero';
    let str='';
    const crore=Math.floor(n/10000000); n%=10000000;
    const lakh=Math.floor(n/100000); n%=100000;
    const thousand=Math.floor(n/1000); n%=1000;
    const hundred=n;
    if(crore) str+=inWords(crore)+' Crore ';
    if(lakh) str+=two(lakh)+' Lakh ';
    if(thousand) str+=two(thousand)+' Thousand ';
    if(hundred) str+=three(hundred);
    return str.trim();
  }
  let words=(neg?'INR Minus ':'INR ')+inWords(rupees)+' Rupees';
  if(paise>0) words+=' and '+two(paise)+' Paisa';
  return words+' Only';
}

/* ---- Compute GST for an invoice ----
   No GSTIN on buyer  => Domestic / Unregistered => NO GST applicable (Bill of Supply)
   Same state as seller => CGST + SGST ;  Other state => IGST */
function computeInvoice(inv, company){
  const taxable = round2(inv.qty * inv.rate);
  const noGst = !(inv.buyerGstin && String(inv.buyerGstin).trim());
  const interState = (inv.buyerStateCode||'') !== company.stateCode;
  const gstRate = noGst ? 0 : (inv.gstRate!=null ? inv.gstRate : 18);
  // Pump charges — optional; GST applies only when the "Apply GST on pump" flag is on
  // AND the buyer is GST-registered. Otherwise pump is added without tax.
  const pump = round2(+inv.pump||0);
  const pumpGst = !!inv.pumpGst && !noGst;
  const pumpTaxable = pumpGst ? pump : 0;
  const baseTaxable = round2(taxable + pumpTaxable);   // value that attracts GST
  let cgst=0,sgst=0,igst=0;
  if(!noGst){
    if(interState){ igst = round2(baseTaxable*gstRate/100); }
    else { cgst = round2(baseTaxable*(gstRate/2)/100); sgst = round2(baseTaxable*(gstRate/2)/100); }
  }
  const totalTax = round2(cgst+sgst+igst);
  const grand = round2(taxable + pump + totalTax);
  return {taxable,interState,gstRate,cgst,sgst,igst,totalTax,grand,noGst,pump,pumpGst,pumpTaxable,baseTaxable};
}
function round2(n){ return Math.round(Number(n)*100)/100; }

/* ---- Full tax invoice HTML ---- */
function invoiceHTML(inv, company, opts){
  const c = computeInvoice(inv, company);
  const isChallan = opts && opts.challan;
  const taxSummary = c.interState
    ? `<tr><td class="c">${esc(inv.hsn)}</td><td class="r">${inr(c.baseTaxable)}</td><td class="c">${c.gstRate}%</td><td class="r">${inr(c.igst)}</td><td class="r">${inr(c.totalTax)}</td></tr>`
    : `<tr><td class="c">${esc(inv.hsn)}</td><td class="r">${inr(c.baseTaxable)}</td><td class="c">${c.gstRate/2}%</td><td class="r">${inr(c.cgst)}</td><td class="c">${c.gstRate/2}%</td><td class="r">${inr(c.sgst)}</td><td class="r">${inr(c.totalTax)}</td></tr>`;
  const taxSummaryHead = c.interState
    ? `<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">IGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th></tr>`
    : `<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>`;

  const docTitle = isChallan ? 'Delivery Challan' : (c.noGst ? 'Invoice (Bill of Supply)' : 'Tax Invoice');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${docTitle} ${esc(inv.no)}</title>
  <style>
    /* margin:0 removes the browser-added date/URL/page-number header & footer.
       Page breathing room comes from body padding instead. */
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:11px;padding:12mm}
    .doc{border:1px solid #000}
    .title{text-align:center;font-weight:700;padding:5px;font-size:13px;position:relative}
    .title .copy{position:absolute;right:6px;top:5px;font-size:9px;font-weight:400;color:#555}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #000;padding:4px 6px;vertical-align:top}
    .noborder td{border:none}
    /* Fixed column model so the header centre divider lines up exactly with the
       items table's Description|HSN divider (both sit at 100% - 380px). */
    .head,.items{table-layout:fixed}
    /* One even 1px frame: the .doc border is the sole outer edge, so strip the
       inner tables' outer perimeter (left/right) to avoid a doubled 2px line.
       The header's centre divider and all internal grid lines are preserved. */
    .doc>table>tbody>tr>td:last-child,.doc>table>tbody>tr>th:last-child{border-right:0}
    .doc>table:not(.head)>tbody>tr>td:first-child,.doc>table:not(.head)>tbody>tr>th:first-child{border-left:0}
    .head>tbody>tr:first-child>td:first-child,.head>tbody>tr:last-child>td:first-child{border-left:0}
    .r{text-align:right}.c{text-align:center}.b{font-weight:700}
    .head td{vertical-align:top}
    .seller b{font-size:12px}
    .small{font-size:10px}
    .items th{background:#f2f2f2;text-align:center;font-size:10px;vertical-align:middle}
    .items td{vertical-align:middle}
    /* GST charge lines shown as their own rows, entirely bold */
    .items .gst-line td{font-weight:700}
    .items .desc{vertical-align:top}
    .items td{padding-top:8px;padding-bottom:8px}
    .words{padding:4px 6px;font-weight:700}
    .bank td{border:none;padding:1px 5px}
    .sign{height:70px}
    .seller{padding:10px 12px}
    .seller-head{display:flex;gap:14px;align-items:center}
    .seller-info{min-width:0}
    .logo{width:72px;height:72px;object-fit:contain;flex:none;display:block}
    .qr{width:64px;height:64px}
    .foot{text-align:center;font-style:italic;padding:5px;font-size:10px}
    @media print{.noprint{display:none}}
  </style></head><body>
  <div class="doc">
    <div class="title">${isChallan?'DELIVERY CHALLAN':(c.noGst?'INVOICE / BILL OF SUPPLY':'TAX INVOICE')}<span class="copy">${isChallan?'':'(ORIGINAL FOR RECIPIENT)'}</span></div>
    <table class="head">
      <tr>
        <td rowspan="4" class="seller">
          <div class="seller-head">
            <img src="${window.LOGO_DATA||''}" class="logo">
            <div class="seller-info">
              <b>M/S ${esc(company.name)}</b><br>
              ${company.addressLines.map(l=>`<span class="small">${esc(l)}</span>`).join('<br>')}<br>
              <span class="small">GSTIN/UIN: <b>${esc(company.gstin)}</b></span><br>
              <span class="small">State Name: ${esc(company.stateName)}, Code: ${esc(company.stateCode)}</span><br>
              <span class="small">E-Mail: ${esc(company.email)}</span>
            </div>
          </div>
        </td>
        <td style="width:190px">Invoice No.<br><b>${esc(inv.no)}</b></td>
        <td style="width:190px">Dated<br><b>${fmtDate(inv.date)}</b></td>
      </tr>
      <tr><td>Delivery Note<br>${esc(inv.no)}</td><td>Mode/Terms of Payment<br>${esc(inv.terms)||'Immediate'}</td></tr>
      <tr><td>Dispatched through<br><b>${esc(inv.dispatchThrough)||'Transit Mixer'}</b></td><td>Motor Vehicle No.<br><b>${esc(inv.vehicle)}</b></td></tr>
      <tr><td>Driver<br>${esc(inv.driver)||'-'}</td><td>Delivery Note Date<br>${fmtDate(inv.date)}</td></tr>
      <tr>
        <td class="seller">
          <b>Buyer (Bill to):</b><br>
          <b>${esc(inv.buyerName)}</b><br>
          <span class="small">${esc(inv.buyerAddress||'').replace(/\n/g,'<br>')}</span><br>
          <span class="small">GSTIN/UIN: <b>${esc(inv.buyerGstin)||'-'}</b></span><br>
          <span class="small">State Name: ${esc(inv.buyerState)}, Code: ${esc(inv.buyerStateCode)}</span>
        </td>
        <td colspan="2" class="seller">
          <b>Site / Project:</b><br>
          <span class="small">${esc(inv.siteName)||'-'}</span><br>
          <span class="small">${esc(inv.siteAddress||'').replace(/\n/g,'<br>')}</span>
        </td>
      </tr>
    </table>
    <table class="items">
      <tr><th style="width:26px">Sl</th><th>Description of Goods</th><th style="width:70px">HSN/SAC</th><th style="width:50px">GST Rate</th><th style="width:70px">Quantity</th><th style="width:70px">Rate</th><th style="width:40px">per</th><th style="width:80px">Amount</th></tr>
      <tr>
        <td class="c">1</td>
        <td class="desc"><b>Ready Mix Concrete Grade (GST) ${esc(inv.gradeName)}</b></td>
        <td class="c">${esc(inv.hsn)}</td>
        <td class="c">${c.noGst?'—':''}</td>
        <td class="r">${inv.qty.toFixed(2)} ${esc(tcase(inv.unit))}</td>
        <td class="r">${inr(inv.rate)}</td>
        <td class="c">${esc(tcase(inv.unit))}</td>
        <td class="r b">${inr(c.taxable)}</td>
      </tr>
      ${c.pump>0?`<tr>
        <td class="c">2</td>
        <td class="desc" style="min-height:0"><b>Concrete Pumping Charges</b>${c.pumpGst?'':' <span class="small">(GST not applicable)</span>'}</td>
        <td class="c">995469</td>
        <td class="c">—</td>
        <td class="r">—</td>
        <td class="r">${inr(c.pump)}</td>
        <td class="c">Job</td>
        <td class="r b">${inr(c.pump)}</td>
      </tr>`:''}
      ${c.noGst?'':(c.interState
        ? `<tr class="gst-line"><td class="c"></td><td>Output IGST</td><td class="c"></td><td class="c">${c.gstRate}%</td><td class="r"></td><td class="r"></td><td class="c"></td><td class="r">${inr(c.igst)}</td></tr>`
        : `<tr class="gst-line"><td class="c"></td><td>Output CGST</td><td class="c"></td><td class="c">${c.gstRate/2}%</td><td class="r"></td><td class="r"></td><td class="c"></td><td class="r">${inr(c.cgst)}</td></tr>
           <tr class="gst-line"><td class="c"></td><td>Output SGST</td><td class="c"></td><td class="c">${c.gstRate/2}%</td><td class="r"></td><td class="r"></td><td class="c"></td><td class="r">${inr(c.sgst)}</td></tr>`)}
      <tr><td colspan="4" class="r b">Total</td><td class="r b">${inv.qty.toFixed(2)} ${esc(tcase(inv.unit))}</td><td colspan="2"></td><td class="r b">₹ ${inr(c.grand)}</td></tr>
    </table>
    <div class="words">Amount Chargeable (in words):&nbsp; ${numToWords(c.grand)} <span style="float:right;font-weight:400">E. &amp; O.E</span></div>
    ${c.noGst
      ? `<div class="words small" style="border-bottom:1px solid #000;padding:6px">GST: <b>NOT APPLICABLE</b> &mdash; Buyer is Domestic / Unregistered (no GSTIN). Issued as a <b>Bill of Supply</b>. No tax charged on this transaction.</div>`
      : `<table>
      ${taxSummaryHead}
      ${taxSummary}
      <tr class="b"><td class="r">Total</td><td class="r">${inr(c.baseTaxable)}</td>${c.interState?`<td></td><td class="r">${inr(c.igst)}</td>`:`<td></td><td class="r">${inr(c.cgst)}</td><td></td><td class="r">${inr(c.sgst)}</td>`}<td class="r">${inr(c.totalTax)}</td></tr>
    </table>
    <div class="words small">Tax Amount (in words): ${numToWords(c.totalTax)}</div>`}
    <table>
      <tr>
        <td style="width:50%" class="bank">
          <b>Company's Bank Details</b>
          <table style="margin-top:3px"><tbody class="bank">
            <tr><td style="width:70px">Bank Name</td><td>: ${esc(company.bank.bank)}</td></tr>
            <tr><td>A/c Holder</td><td>: ${esc(company.bank.name)}</td></tr>
            <tr><td>A/c No.</td><td>: ${esc(company.bank.acno)}</td></tr>
            <tr><td>Branch</td><td>: ${esc(company.bank.branch)}</td></tr>
            <tr><td>IFSC Code</td><td>: ${esc(company.bank.ifsc)}</td></tr>
          </tbody></table>
        </td>
        <td style="width:50%">
          <div class="r" style="padding-top:6px">for <b>M/S ${esc(company.name)}</b></div>
          <div class="sign r" style="padding-top:56px">Authorised Signatory</div>
        </td>
      </tr>
    </table>
    <div style="padding:4px 6px" class="small">
      <b>Declaration:</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
    </div>
    <div class="foot">This is a Computer Generated Invoice.</div>
  </div>
  </body></html>`;
}

function taxTable(c,inv){
  if(c.noGst) return `<span class="small b">GST: Not Applicable</span> <span class="small">(Domestic / Unregistered buyer)</span>`;
  if(c.interState) return `<span class="small b">Output IGST-${c.gstRate}%</span> &nbsp;&nbsp;<span class="small">${c.gstRate}% &nbsp; ₹ ${inr(c.igst)}</span>`;
  return `<span class="small b">Output CGST-${c.gstRate/2}%</span> ${c.gstRate/2}% ₹${inr(c.cgst)}<br><span class="small b">Output SGST-${c.gstRate/2}%</span> ${c.gstRate/2}% ₹${inr(c.sgst)}`;
}

function fmtDate(d){
  if(!d) return '';
  const dt = new Date(d+'T00:00:00');
  const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(dt.getDate()).padStart(2,'0')}-${m[dt.getMonth()]}-${dt.getFullYear()}`;
}

/* In-page overlay preview + print (robust when pop-ups blocked or hosted in a sandbox) */
function openPrint(html){
  const old = document.getElementById('printOverlay'); if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'printOverlay';
  ov.innerHTML = `
    <div class="po-bar">
      <b>Invoice preview</b>
      <button class="po-print">🖨 Print / Save as PDF</button>
      <button class="po-close">✕ Close</button>
    </div>
    <iframe class="po-frame" title="Invoice"></iframe>`;
  document.body.appendChild(ov);
  const frame = ov.querySelector('.po-frame');
  frame.srcdoc = html;
  ov.querySelector('.po-print').onclick = ()=>{
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch(e){ window.print(); }
  };
  ov.querySelector('.po-close').onclick = ()=> ov.remove();
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
}

/* ---- Batching Slip — mix design for the selected grade, scaled to the dispatch quantity ---- */
function batchSlipHTML(inv, company, mix){
  const co=company; const qty=Number(inv.qty)||0;
  const M=mix||{cement:0,sand:0,agg20:0,agg12:0,water:0,admix:0};
  const rows=[
    ['Cement (OPC 53)', M.cement, 'kg', (M.cement*qty/50)],
    ['River / M-Sand', M.sand, 'kg', null],
    ['Coarse Aggregate 20mm', M.agg20, 'kg', null],
    ['Coarse Aggregate 12mm', M.agg12, 'kg', null],
    ['Water', M.water, 'ltr', null],
    ['Admixture', M.admix, 'ltr', null],
  ];
  const body=rows.map(r=>{
    const per=Number(r[1])||0, tot=per*qty;
    const extra = r[3]!=null ? ` <span class="muted">(${(Number(r[3])||0).toFixed(1)} bags)</span>` : '';
    return `<tr><td>${r[0]}</td><td class="r">${per.toFixed(2)} ${r[2]}/Cum</td><td class="r"><b>${tot.toFixed(2)} ${r[2]}</b>${extra}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Batching Slip — ${esc(inv.no)}</title>
    <style>@page{size:A4;margin:0}body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:12px;padding:12mm;margin:0}
    h2{margin:0}.muted{color:#666}table{border-collapse:collapse;width:100%;margin-top:10px}
    td,th{border:1px solid #999;padding:5px 7px}.r{text-align:right}th{background:#f0f0f0;text-align:left}
    .head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #14508c;padding-bottom:8px}
    .meta{display:flex;flex-wrap:wrap;gap:6px 26px;margin-top:10px}.meta div{font-size:12px}
    .big{background:#14508c;color:#fff;padding:8px 12px;border-radius:6px;display:inline-block;margin-top:10px;font-size:15px;font-weight:700}
    .sign{margin-top:34px;display:flex;justify-content:space-between}</style></head><body>
    <div class="head"><div><h2>${esc(co.name)}</h2><div class="muted">${esc(co.addressLines.join(', '))}<br>GSTIN: ${esc(co.gstin)}</div></div>
      <img src="${window.LOGO_DATA}" style="width:70px;height:70px;object-fit:contain"></div>
    <h3 style="margin:12px 0 0">BATCHING SLIP</h3>
    <div class="meta">
      <div><b>Slip / Ref No:</b> ${esc(inv.no)||'-'}</div>
      <div><b>Date:</b> ${fmtDate(inv.date)}</div>
      <div><b>Customer:</b> ${esc(inv.buyerName)||'-'}</div>
      <div><b>Site:</b> ${esc(inv.siteName)||'-'}</div>
      <div><b>Vehicle:</b> ${esc(inv.vehicle)||'-'}</div>
      <div><b>Dispatched Through:</b> ${esc(inv.dispatchThrough)||'-'}</div>
    </div>
    <div class="big">Grade ${esc(inv.gradeName)||'-'} &nbsp;•&nbsp; ${qty.toFixed(2)} ${esc(inv.unit)||'Cum'}</div>
    <table><thead><tr><th>Material</th><th class="r">Design (per Cum)</th><th class="r">Required for ${qty.toFixed(2)} Cum</th></tr></thead>
    <tbody>${body}</tbody></table>
    <div class="muted" style="margin-top:8px">Indicative mix design — adjust for moisture, workability &amp; site conditions before batching.</div>
    <div class="sign"><div>Batched by: ____________________</div><div>Approved by: ____________________</div></div>
    <div class="muted" style="margin-top:18px;text-align:center">This is a computer-generated batching slip.</div>
    </body></html>`;
}
