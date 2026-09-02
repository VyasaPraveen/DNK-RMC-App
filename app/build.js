/* Bundle the multi-file app into single self-contained HTML files. */
const fs = require('fs');
const css = fs.readFileSync('styles.css','utf8');
const assets = fs.readFileSync('assets.js','utf8');
const print = fs.readFileSync('print.js','utf8');
const app = fs.readFileSync('app.js','utf8');

// guard: template strings must not contain a literal </script>
[assets,print,app].forEach((s,i)=>{ if(/<\/script>/i.test(s)) throw new Error('literal </script> in file '+i); });

// Bundle the App Manual (docs page) as window.MANUAL_HTML for the in-app Manual
// screen. Wrap the docs fragment as a full document and escape every '<' as <
// so the embedded HTML can never break out of the surrounding <script> block.
const manualRaw = fs.readFileSync('../docs/DNK-RMC-Documentation.html','utf8');
const manualDoc = '<!doctype html>\n<html lang="en">\n'+manualRaw+'\n</html>';
const manualJs = 'window.MANUAL_HTML='+JSON.stringify(manualDoc).replace(/</g,'\\u003c')+';';

const body = `<style>
${css}
</style>
<div id="root"></div>
<script>
${assets}
${manualJs}
${print}
${app}
</script>`;

// 1) Artifact body (no doctype/html/head/body — the host wraps it)
fs.writeFileSync('dist-artifact.html', body);

// Firebase Auth (email/password sign-in + real password-reset emails).
// The apiKey is a public client identifier (safe to embed). If the SDK fails to
// load (offline), window.fbAuth stays null and the app falls back to local auth.
const firebaseHead = `
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>
try{
  firebase.initializeApp({
    apiKey:"AIzaSyC4y1CjXwA1v6RUZ1DMZoZNht_YGR_O7ds",
    authDomain:"dnk-rmc.firebaseapp.com",
    projectId:"dnk-rmc",
    storageBucket:"dnk-rmc.firebasestorage.app",
    messagingSenderId:"400220819441",
    appId:"1:400220819441:web:28bbe7887256d8e22e3e50"
  });
  window.fbApp = firebase.app();
  window.fbAuth = firebase.auth();
  try{ window.fbDb = firebase.firestore(); }catch(e){ window.fbDb=null; }
}catch(e){ window.fbApp=null; window.fbAuth=null; window.fbDb=null; }
</script>`;

// 2) Standalone (double-click / host anywhere)
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DNK Power Conmix — RMC Billing System</title>
${firebaseHead}
</head>
<body>
${body}
</body>
</html>`;
fs.writeFileSync('dnk-rmc.html', standalone);

console.log('built dist-artifact.html', fs.statSync('dist-artifact.html').size, 'bytes');
console.log('built dnk-rmc.html', fs.statSync('dnk-rmc.html').size, 'bytes');
