/* Conservative catalogue matching. Never infer dosage, drug substitutions or treatment duration. */
'use strict';
const {products}=require('../js/catalogue.js');
const normal=value=>String(value||'').toLowerCase().replace(/(\d)\s+(mg|iu|%)/g,'$1$2').replace(/[^a-z0-9%]+/g,' ').trim();
function matchPrescription(document,audience) {
  if(!document || !Array.isArray(document.items)) throw new Error('The prescription could not be read. Try a clearer image.');
  return {items:document.items.slice(0,40).map(value=>{
    const raw=value&&typeof value==='object'?value:{};
    const name=String(raw.medicineName||'Unreadable item').slice(0,120),strength=String(raw.strength||'').slice(0,60);
    const candidates=products.filter(p=>p.audience===audience && (normal(p.name)===normal(`${name} ${strength}`)||(!strength&&normal(p.name)===normal(name))));
    const product=raw.confidence==='high'&&candidates.length===1?candidates[0]:null;
    const quantity=Number.isInteger(raw.quantity)&&raw.quantity>0&&raw.quantity<=10000?raw.quantity:null;
    const unit=normal(raw.quantityUnit), pack=product?.pack||'';
    const size=Number(pack.match(/^\d+/)?.[0])||1;
    let packs=null;
    if(product&&quantity) {
      if(['pack','packs'].includes(unit)||(['bottle','bottles'].includes(unit)&&/bottle/.test(pack))||(['device','devices'].includes(unit)&&/device/.test(pack))||(['kit','kits'].includes(unit)&&/kit/.test(pack))||(['tin','tins'].includes(unit)&&/tin/.test(pack))) packs=quantity;
      else if((unit==='tablets'&&/tablets/.test(pack))||(unit==='capsules'&&/capsules/.test(pack))||(unit==='sachets'&&/sachets/.test(pack))||(unit==='pads'&&/pads/.test(pack))||(unit==='strips'&&/strips/.test(pack))||(unit==='chews'&&/chews/.test(pack))) packs=Math.ceil(quantity/size);
      else if(unit==='sachets'&&/sachet$/.test(pack)) packs=quantity;
    }
    if(packs>20)packs=null;
    return {name,strength,quantity,unit:unit.slice(0,30),evidence:String(raw.evidence||'').slice(0,240),id:product?.id||null,pack:product?.pack||null,packs,status:product?'Catalogue match · review required':'No exact confident match · ask a pharmacist'};
  }),notes:(Array.isArray(document.notes)?document.notes:[]).slice(0,6).map(n=>String(n).slice(0,300))};
}
module.exports={matchPrescription,normal};
