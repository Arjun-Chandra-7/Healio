'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../server.js');
const { products } = require('../js/catalogue.js');
const root = path.resolve(__dirname, '..');
async function running(t, options={}) {
  const server=createServer({key:'',...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return `http://127.0.0.1:${server.address().port}`;
}
test('release serves the new storefront and every declared local resource',async t=>{
  const base=await running(t);
  const response=await fetch(base);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/<title>Healio/);assert.match(html,/Browse all 30 essentials/);assert.doesNotMatch(html,/data-transition-wrap/);
  const sources=[...html.matchAll(/(?:src|href)="((?:assets|css|js)\/[^"#]+)"/g)].map(m=>m[1]);
  for(const name of new Set([...sources,...products.map(p=>p.image)]))assert.equal((await fetch(base+'/'+name)).status,200,name);
  for(const file of fs.readdirSync(path.join(root,'css'))){
    const css=fs.readFileSync(path.join(root,'css',file),'utf8');
    for(const match of css.matchAll(/url\(["']?(\.\.\/assets\/[^)"']+)["']?\)/g))assert.ok(fs.existsSync(path.resolve(root,'css',match[1])),match[1]);
  }
});
test('private configuration and backend source cannot be served as static files',async t=>{
  const base=await running(t);
  for(const name of ['/.env','/.env.local','/.git/config','/.vercel/project.json','/lib/ai.js','/server.js'])assert.equal((await fetch(base+name)).status,404,name);
  const status=await(await fetch(base+'/api/status')).json();assert.equal(status.aiConfigured,false);assert.ok(!JSON.stringify(status).includes('API_KEY='));
});
test('chat forwards bounded conversation with the exact storefront reward rules',async t=>{
  let sent;
  const base=await running(t,{key:'unit-test-placeholder',model:'gemini-test',fetch:async(url,init)=>{
    sent=JSON.parse(init.body);
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Five points per ₹100; fifty points per tree.'}]}}]}),{status:200});
  }});
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'How do points work?',history:[]})});
  assert.equal(response.status,200);assert.match((await response.json()).reply,/Five points/);
  const instructions=sent.systemInstruction.parts.map(x=>x.text).join(' ');assert.match(instructions,/5 points per complete ₹100/);assert.match(instructions,/50 points/);assert.match(instructions,/10 completed orders/);assert.match(instructions,/Do not claim to add/);
});
test('prescription API keeps only exact audience-appropriate confident matches',async t=>{
  const base=await running(t,{key:'unit-test-placeholder',model:'gemini-test',fetch:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({items:[{medicineName:'Paracetamol',strength:'650 mg',quantity:30,quantityUnit:'tablets',confidence:'high'},{medicineName:'Dog Multivitamin Chews',strength:'',quantity:1,quantityUnit:'packs',confidence:'high'}],notes:[]})}]}}]}),{status:200})});
  const data=Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  const response=await fetch(base+'/api/prescription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audience:'human',mimeType:'image/png',data})});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.items[0].id,'h01');assert.equal(result.items[0].packs,2);assert.equal(result.items[1].id,null);
});
test('API rejects foreign origins and mismatched prescription file formats',async t=>{
  const base=await running(t,{key:'unit-test-placeholder'});
  const foreign=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.invalid'},body:JSON.stringify({question:'Hi'})});assert.equal(foreign.status,403);
  const file=await fetch(base+'/api/prescription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audience:'human',mimeType:'image/png',data:Buffer.from('not an image').toString('base64')})});assert.equal(file.status,400);
});
