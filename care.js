/* AI and care panels. Credentials remain on the Node server. */
(function(){
'use strict';
const $=s=>document.querySelector(s),shop=window.HealioShop,history=[];
let rxItems=[],rxBusy=false;
async function request(endpoint,data){
 if(location.protocol==='file:')throw new Error('Start the site with npm start, then open http://localhost:8080 to use Gemini.');
 let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(120000)});}catch(error){throw new Error(error.name==='TimeoutError'?'Google is taking too long to respond. Please try again.':'Could not reach the care assistant. Check your connection and try again.');}
 if(response.status===404||response.status===405)throw new Error('This page is running on a static server. Run npm start in the project folder and open http://localhost:8080.');
 let result;try{result=await response.json();}catch(_){throw new Error('AI needs the Healio server. Run npm start and open http://localhost:8080.');}
 if(!response.ok)throw new Error(result.error||'Please try again.');return result;
}
function bubble(text,role){const p=document.createElement('p');p.className='chat-bubble '+(role==='user'?'from-user':'');p.textContent=text;$('#chat-messages').append(p);p.scrollIntoView({block:'nearest'});return p;}
$('#chat-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,input=$('#chat-question'),question=input.value.trim();if(!question||form.dataset.busy)return;
 form.dataset.busy='true';form.querySelector('button').disabled=true;input.value='';$('#chat-error').textContent='';bubble(question,'user');const pending=bubble('Looking through the care shelf…','assistant');pending.classList.add('is-thinking');
 const waiting=setTimeout(()=>{pending.textContent='Google is taking a little longer. Your question is still being processed…';},15000);
 try{const result=await request('/api/chat',{question,history});pending.textContent=result.reply;history.push({role:'user',text:question},{role:'assistant',text:result.reply});history.splice(0,Math.max(0,history.length-8));}
 catch(error){pending.remove();$('#chat-error').textContent=error.message;input.value=question;}
 finally{clearTimeout(waiting);pending.classList.remove('is-thinking');delete form.dataset.busy;form.querySelector('button').disabled=false;}
});
function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('This file could not be read. Try selecting it again.'));reader.readAsDataURL(file);});}
const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
function clearRx(){rxItems=[];$('#rx-results').hidden=true;$('#rx-items').replaceChildren();$('#rx-reviewed').checked=false;$('#rx-add-status').textContent='';}
$('#rx-form').addEventListener('change',()=>{if(!rxBusy)clearRx();});
$('#rx-form').addEventListener('submit',async event=>{
 event.preventDefault();if(rxBusy)return;const form=event.currentTarget,file=form.elements.file.files[0];clearRx();$('#rx-error').textContent='';
 if(!file||file.size>3*1024*1024||!['image/png','image/jpeg','application/pdf'].includes(file.type)){$('#rx-error').textContent='Choose a JPEG, PNG or PDF up to 3 MB.';return;}
 if(!form.reportValidity())return;const audience=form.elements.audience.value;
 rxBusy=true;[...form.elements].forEach(el=>el.disabled=true);const submit=form.querySelector('[type=submit]');submit.textContent='Reading your prescription…';
 try{
  const result=await request('/api/prescription',{audience,mimeType:file.type,data:await readFile(file)});rxItems=result.items;$('#rx-results').hidden=false;
  rxItems.forEach((item,index)=>{
   const article=document.createElement('article');article.className='rx-result';article.append(text('h4',`${item.name} ${item.strength}`),text('p',item.status,item.id?'rx-match':'rx-unavailable'));
   if(item.evidence)article.append(text('blockquote',item.evidence));
   article.append(text('p',item.quantity?`Written quantity: ${item.quantity} ${item.unit}`:'Total quantity not clearly written. Check with your pharmacist.'));
   if(item.id){
    const label=document.createElement('label');label.className='check-label';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.rxSelect=index;checkbox.checked=false;label.append(checkbox,text('span',`Select ${window.HealioCatalog.byId[item.id].name} · ${item.pack}`));article.append(label);
    const quantityLabel=document.createElement('label');quantityLabel.textContent='Packs to add (check against the prescription)';const input=document.createElement('input');input.type='number';input.min=1;input.max=20;input.step=1;input.dataset.rxQuantity=index;input.value=item.packs||'';input.placeholder='Confirm pack quantity';quantityLabel.append(input);article.append(quantityLabel);
    if(item.packs)article.append(text('small',`Suggested pack count: ${item.packs} × ${item.pack}. Whole packs may contain more than the written quantity.`));
   }
   $('#rx-items').append(article);
  });
  if(!rxItems.length)$('#rx-items').append(text('p','No readable medicine items were found. Try a clearer, closer photo.'));
  $('#rx-notes').textContent=(result.notes||[]).join(' ');$('#rx-add').disabled=!rxItems.some(i=>i.id);
 }catch(error){$('#rx-error').textContent=error.message;}
 finally{rxBusy=false;[...form.elements].forEach(el=>el.disabled=false);submit.textContent='Read prescription ↗';}
});
$('#rx-add').addEventListener('click',()=>{
 const status=$('#rx-add-status');if(!$('#rx-reviewed').checked){status.textContent='First confirm that you checked the prescription and quantities.';return;}
 const selected=[...document.querySelectorAll('[data-rx-select]:checked')];if(!selected.length){status.textContent='Select at least one exact match.';return;}
 const items=selected.map(el=>({id:rxItems[Number(el.dataset.rxSelect)].id,quantity:Number(document.querySelector(`[data-rx-quantity="${el.dataset.rxSelect}"]`).value)}));
 if(items.some(i=>!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>20)){status.textContent='Confirm a whole pack quantity from 1 to 20 for each selected item.';return;}
 const added=shop.addItems(items);status.textContent=`${added} pack${added===1?'':'s'} added. Your bag has a 20-pack limit per item.`;selected.forEach(el=>el.checked=false);$('#rx-reviewed').checked=false;shop.message('Reviewed prescription items added to your bag.');
});
$('#ambulance-form').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));const result=$('#ambulance-result');result.replaceChildren(text('h3','Your demo request is ready.'),text('p','No ambulance has been contacted or dispatched. For an actual emergency in India, call 112 now.'),text('p',`Patient: ${data.patient}`),text('p',`Contact: ${data.phone}`),text('p',`Pickup: ${data.address}, ${data.pincode}`));result.hidden=false;result.scrollIntoView({block:'nearest',behavior:'smooth'});
});
})();
