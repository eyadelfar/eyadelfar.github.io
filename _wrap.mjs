import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join } from 'path';
const ROOT='D:/Portfolio/site';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const s=createServer(async(q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const p=join(ROOT,u==='/index.html'?'index.html':u);try{const i=await stat(p);r.writeHead(200,{'Content-Type':T[extname(p)]||'application/octet-stream','Content-Length':i.size});r.end(await readFile(p));}catch{r.writeHead(404);r.end('nf');}});
await new Promise(r=>s.listen(8099,r));
const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH,headless:'new',args:['--no-sandbox']});
for (const w of [390, 360]) {
  const p=await b.newPage();
  await p.setViewport({width:w,height:844,isMobile:true,deviceScaleFactor:2});
  await p.goto('http://localhost:8099/index.html',{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,1500));
  console.log(w+'px button heights (1 line ~44px, 2 lines ~66px):', JSON.stringify(await p.evaluate(()=>
    [...document.querySelectorAll('.btn-primary,.btn-ghost,.agent-ask,.agent-call')]
      .map(e=>e.textContent.trim().slice(0,16)+'='+Math.round(e.getBoundingClientRect().height)))));
  await p.close();
}
await b.close(); s.close();
