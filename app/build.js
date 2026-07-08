/* Bundle the multi-file app into single self-contained HTML files. */
const fs = require('fs');
const css = fs.readFileSync('styles.css','utf8');
const assets = fs.readFileSync('assets.js','utf8');
const print = fs.readFileSync('print.js','utf8');
const app = fs.readFileSync('app.js','utf8');

// guard: template strings must not contain a literal </script>
[assets,print,app].forEach((s,i)=>{ if(/<\/script>/i.test(s)) throw new Error('literal </script> in file '+i); });

const body = `<style>
${css}
</style>
<div id="root"></div>
<script>
${assets}
${print}
${app}
</script>`;

// 1) Artifact body (no doctype/html/head/body — the host wraps it)
fs.writeFileSync('dist-artifact.html', body);

// 2) Standalone (double-click / host anywhere)
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DNK Power Conmix — RMC Billing System</title>
</head>
<body>
${body}
</body>
</html>`;
fs.writeFileSync('dnk-rmc.html', standalone);

console.log('built dist-artifact.html', fs.statSync('dist-artifact.html').size, 'bytes');
console.log('built dnk-rmc.html', fs.statSync('dnk-rmc.html').size, 'bytes');
