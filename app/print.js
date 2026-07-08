/* ============ Invoice / Challan print templates (Tally-style GST invoice) ============ */

function inr(n){ return Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }

/* ---- Number to Indian words with paisa ---- */
function numToWords(num){
  num = Math.round(Number(num)*100)/100;
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
  let words='INR '+inWords(rupees)+' Rupees';
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
  let cgst=0,sgst=0,igst=0;
  if(!noGst){
    if(interState){ igst = round2(taxable*gstRate/100); }
    else { cgst = round2(taxable*(gstRate/2)/100); sgst = round2(taxable*(gstRate/2)/100); }
  }
  const totalTax = round2(cgst+sgst+igst);
  const grand = round2(taxable+totalTax);
  return {taxable,interState,gstRate,cgst,sgst,igst,totalTax,grand,noGst};
}
function round2(n){ return Math.round(Number(n)*100)/100; }

/* ---- Full tax invoice HTML ---- */
function invoiceHTML(inv, company, opts){
  const c = computeInvoice(inv, company);
  const isChallan = opts && opts.challan;
  const taxSummary = c.interState
    ? `<tr><td>${inv.hsn}</td><td class="r">${inr(c.taxable)}</td><td class="c">${c.gstRate}%</td><td class="r">${inr(c.igst)}</td><td class="r">${inr(c.totalTax)}</td></tr>`
    : `<tr><td>${inv.hsn}</td><td class="r">${inr(c.taxable)}</td><td class="c">${c.gstRate/2}%</td><td class="r">${inr(c.cgst)}</td><td class="c">${c.gstRate/2}%</td><td class="r">${inr(c.sgst)}</td><td class="r">${inr(c.totalTax)}</td></tr>`;
  const taxSummaryHead = c.interState
    ? `<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">IGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th></tr>`
    : `<tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Value</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th rowspan="2">Total Tax Amount</th></tr><tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>`;

  const docTitle = isChallan ? 'Delivery Challan' : (c.noGst ? 'Invoice (Bill of Supply)' : 'Tax Invoice');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${docTitle} ${inv.no}</title>
  <style>
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;color:#111;font-size:11px;margin:0}
    .doc{border:1px solid #000}
    .title{text-align:center;font-weight:700;padding:5px;font-size:13px;position:relative}
    .title .copy{position:absolute;right:6px;top:5px;font-size:9px;font-weight:400;color:#555}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #000;padding:3px 5px;vertical-align:top}
    .noborder td{border:none}
    .r{text-align:right}.c{text-align:center}.b{font-weight:700}
    .head td{vertical-align:top}
    .seller b{font-size:12px}
    .small{font-size:10px}
    .items th{background:#f2f2f2;text-align:center;font-size:10px}
    .items .desc{min-height:150px}
    .words{padding:4px 6px;font-weight:700}
    .bank td{border:none;padding:1px 5px}
    .sign{height:70px}
    .logo{width:70px;height:70px;object-fit:contain;float:left;margin-right:8px}
    .qr{width:64px;height:64px}
    .foot{text-align:center;font-style:italic;padding:5px;font-size:10px}
    .stamp{color:#1a3d8f;border:2px solid #1a3d8f;border-radius:50%;width:90px;height:90px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;font-weight:700;transform:rotate(-12deg);opacity:.8;margin:6px auto}
    @media print{.noprint{display:none};body{margin:0}}
    body{padding:14px}
  </style></head><body>
  <div class="doc">
    <div class="title">${isChallan?'DELIVERY CHALLAN':(c.noGst?'INVOICE / BILL OF SUPPLY':'TAX INVOICE')}<span class="copy">${isChallan?'':'(ORIGINAL FOR RECIPIENT)'}</span></div>
    <table class="head">
      <tr>
        <td style="width:55%" rowspan="4" class="seller">
          <img src="${window.LOGO_DATA||''}" class="logo">
          <b>M/S ${company.name}</b><br>
          ${company.addressLines.map(l=>`<span class="small">${l}</span>`).join('<br>')}<br>
          <span class="small">GSTIN/UIN: ${company.gstin}</span><br>
          <span class="small">State Name: ${company.stateName}, Code: ${company.stateCode}</span><br>
          <span class="small">E-Mail: ${company.email}</span>
        </td>
        <td style="width:22%">Invoice No.<br><b>${inv.no}</b></td>
        <td style="width:23%">Dated<br><b>${fmtDate(inv.date)}</b></td>
      </tr>
      <tr><td>Delivery Note<br>${inv.no}</td><td>Mode/Terms of Payment<br>${inv.terms||'Immediate'}</td></tr>
      <tr><td>Dispatched through<br><b>${inv.dispatchThrough||'Transit Mixer'}</b></td><td>Motor Vehicle No.<br><b>${inv.vehicle||''}</b></td></tr>
      <tr><td>Driver<br>${inv.driver||'-'}</td><td>Delivery Note Date<br>${fmtDate(inv.date)}</td></tr>
      <tr>
        <td class="seller">
          <b>Buyer (Bill to):</b><br>
          <b>${inv.buyerName}</b><br>
          <span class="small">${(inv.buyerAddress||'').replace(/\n/g,'<br>')}</span><br>
          <span class="small">GSTIN/UIN: ${inv.buyerGstin||'-'}</span><br>
          <span class="small">State Name: ${inv.buyerState||''}, Code: ${inv.buyerStateCode||''}</span>
        </td>
        <td colspan="2" class="seller">
          <b>Site / Project:</b><br>
          <span class="small">${(inv.siteName||'-')}</span><br>
          <span class="small">${(inv.siteAddress||'').replace(/\n/g,'<br>')}</span>
        </td>
      </tr>
    </table>
    <table class="items">
      <tr><th style="width:26px">Sl</th><th>Description of Goods</th><th style="width:70px">HSN/SAC</th><th style="width:50px">GST Rate</th><th style="width:70px">Quantity</th><th style="width:70px">Rate</th><th style="width:40px">per</th><th style="width:80px">Amount</th></tr>
      <tr>
        <td class="c">1</td>
        <td class="desc"><b>Ready Mix Concrete Grade (GST) ${inv.gradeName}</b>
          <div style="margin-top:8px">${taxTable(c,inv)}</div>
        </td>
        <td class="c">${inv.hsn}</td>
        <td class="c">${c.noGst?'—':c.gstRate+'%'}</td>
        <td class="r">${inv.qty.toFixed(2)} ${inv.unit}</td>
        <td class="r">${inr(inv.rate)}</td>
        <td class="c">${inv.unit}</td>
        <td class="r b">${inr(c.taxable)}</td>
      </tr>
      <tr><td colspan="4" class="r b">Total</td><td class="r b">${inv.qty.toFixed(2)} ${inv.unit}</td><td colspan="2"></td><td class="r b">₹ ${inr(c.grand)}</td></tr>
    </table>
    <div class="words">Amount Chargeable (in words):&nbsp; ${numToWords(c.grand)} <span style="float:right;font-weight:400">E. &amp; O.E</span></div>
    ${c.noGst
      ? `<div class="words small" style="border:1px solid #000;padding:6px">GST: <b>NOT APPLICABLE</b> &mdash; Buyer is Domestic / Unregistered (no GSTIN). Issued as a <b>Bill of Supply</b>. No tax charged on this transaction.</div>`
      : `<table>
      ${taxSummaryHead}
      ${taxSummary}
      <tr class="b"><td class="r">Total</td><td class="r">${inr(c.taxable)}</td>${c.interState?`<td></td><td class="r">${inr(c.igst)}</td>`:`<td></td><td class="r">${inr(c.cgst)}</td><td></td><td class="r">${inr(c.sgst)}</td>`}<td class="r">${inr(c.totalTax)}</td></tr>
    </table>
    <div class="words small">Tax Amount (in words): ${numToWords(c.totalTax)}</div>`}
    <table>
      <tr>
        <td style="width:50%" class="bank">
          <b>Company's Bank Details</b>
          <table style="margin-top:3px"><tbody class="bank">
            <tr><td style="width:70px">Bank Name</td><td>: ${company.bank.bank}</td></tr>
            <tr><td>A/c Holder</td><td>: ${company.bank.name}</td></tr>
            <tr><td>A/c No.</td><td>: ${company.bank.acno}</td></tr>
            <tr><td>Branch</td><td>: ${company.bank.branch}</td></tr>
            <tr><td>IFSC Code</td><td>: ${company.bank.ifsc}</td></tr>
          </tbody></table>
        </td>
        <td style="width:50%">
          <div class="stamp">DNK POWER CONMIX<br>★ ACCOUNTS ★<br>V.KOTA</div>
          <div class="r" style="padding-top:6px">for <b>M/S ${company.name}</b></div>
          <div class="sign r" style="padding-top:36px">Authorised Signatory</div>
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
