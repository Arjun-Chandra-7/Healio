(function (root) {
  'use strict';
  const catalog = root.HealioCatalog || (typeof require === 'function' ? require('./catalogue.js') : null);
  if (!catalog) return;
  const { products, byId, normaliseCart, totals } = catalog;
  const storageKey = 'healio.care-bag.v2';

  function createCart(storage) {
    let items = [];
    try { items = normaliseCart(JSON.parse(storage?.getItem(storageKey) || '[]')); } catch (_) { /* Recover an invalid or unavailable local store. */ }
    function save() { try { storage?.setItem(storageKey, JSON.stringify(items)); } catch (_) { /* The bag remains usable in memory. */ } }
    return {
      items: () => items.map(item => ({...item})),
      quantity: id => items.find(item => item.id === id)?.quantity || 0,
      add(id, quantity = 1) {
        if (typeof id !== 'string' || !byId[id] || !Number.isInteger(quantity) || quantity < 1) return false;
        const item = items.find(item => item.id === id);
        if (item) item.quantity = Math.min(20,item.quantity + quantity);
        else items.push({id,quantity:Math.min(20,quantity)});
        save(); return true;
      },
      setQuantity(id, quantity) {
        if (typeof id !== 'string' || !byId[id] || !Number.isInteger(quantity) || quantity < 0 || !items.some(item => item.id === id)) return false;
        if (quantity === 0) items = items.filter(item => item.id !== id);
        else items.find(item => item.id === id).quantity = Math.min(20,quantity);
        save(); return true;
      },
      clear() { items = []; save(); },
      totals: () => totals(items)
    };
  }
  const clean = value => typeof value === 'string' ? value.trim() : '';
  const consented = value => value === true || value === 'on';
  const phoneOK = value => /^[0-9]{10}$/.test(clean(value));
  const pincodeOK = value => /^[1-9][0-9]{5}$/.test(clean(value));
  function validateDoctorRequest(data) {
    const errors = [];
    if (!['human','pet'].includes(data.care)) errors.push('Choose who needs care.');
    if (clean(data.patient).length < 2 || clean(data.patient).length > 60) errors.push('Enter a patient or pet name of 2–60 characters.');
    if (clean(String(data.age ?? '')) === '' || !Number.isFinite(Number(data.age)) || Number(data.age) < 0 || Number(data.age) > 120) errors.push('Enter an age between 0 and 120 years.');
    if (!phoneOK(data.phone)) errors.push('Enter a 10-digit mobile number.');
    if (!pincodeOK(data.pincode)) errors.push('Enter a valid 6-digit pincode.');
    if (data.care === 'pet' && (!['Dog','Cat','Other companion animal'].includes(data.species) || clean(data.owner).length < 2)) errors.push('Add your pet’s species and the pet parent’s name.');
    const specialties = data.care === 'pet' ? ['Veterinarian'] : ['General physician','Family care physician'];
    if (!specialties.includes(data.specialty)) errors.push('Choose a care team for this request.');
    if (clean(data.concern).length < 10 || clean(data.concern).length > 1000) errors.push('Describe the concern in 10–1,000 characters.');
    if (!consented(data.consent)) errors.push('Confirm that you understand this is a demo request.');
    return errors;
  }
  function validateCheckout(data, cart) {
    const errors = [];
    const summary = totals(cart);
    if (!summary.count) errors.push('Your care bag is empty.');
    if (clean(data.name).length < 2 || clean(data.name).length > 60) errors.push('Enter your full name.');
    if (!phoneOK(data.phone)) errors.push('Enter a 10-digit mobile number.');
    if (!pincodeOK(data.pincode)) errors.push('Enter a valid 6-digit pincode.');
    if (clean(data.address).length < 10 || clean(data.address).length > 350) errors.push('Enter a delivery address of 10–350 characters.');
    if (!consented(data.consent)) errors.push('Confirm that you understand this is a demo order.');
    if (summary.review) {
      const file = data.prescription;
      if (!file || !file.size) errors.push('Attach a veterinary prescription for the marked items.');
      else if (file.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','application/pdf'].includes(file.type)) errors.push('Choose a JPEG, PNG or PDF prescription up to 5 MB.');
    }
    return errors;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createCart, validateDoctorRequest, validateCheckout, storageKey };
  if (!root.document) return;

  const document = root.document;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const preference = root.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {audience:'human',query:'',category:'All',sort:'featured',selected:'h01',quantity:1};
  let storage;
  try { storage = root.localStorage; } catch (_) { storage = null; }
  const bag = createCart(storage);
  let toastTimer, closeTimer;
  const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
  const escape = value => String(value).replace(/[&<>"']/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  function message(text) {
    const toast = $('#app-toast');
    root.clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add('is-visible');
    toastTimer = root.setTimeout(() => toast.classList.remove('is-visible'),2800);
  }
  function scrollTo(element) { element?.scrollIntoView({behavior:preference.matches?'instant':'smooth',block:'start'}); }
  function refreshGeometry() { root.dispatchEvent(new root.Event('resize')); }

  function openPanel(id) {
    const panel = document.getElementById(id);
    if (!panel?.matches('dialog')) return;
    root.clearTimeout(closeTimer);
    $$('dialog[open]').forEach(open => { open.close(); open.classList.remove('is-closing'); });
    if (id === 'cart-panel') {
      $('#cart-content').hidden = false; $('#checkout-form').hidden = true; $('#order-confirmation').hidden = true;
      renderBag();
    }
    panel.classList.remove('is-closing');
    panel.showModal();
    document.body.classList.add('panel-open');
  }
  function closePanel(panel, immediately = false) {
    if (!panel?.open) return;
    root.clearTimeout(closeTimer);
    const complete = () => { panel.close(); panel.classList.remove('is-closing'); if (!$('dialog[open]')) document.body.classList.remove('panel-open'); };
    if (immediately || preference.matches) complete();
    else { panel.classList.add('is-closing'); closeTimer = root.setTimeout(complete,200); }
  }
  $$('dialog').forEach(panel => {
    panel.addEventListener('cancel',event => { event.preventDefault(); closePanel(panel); });
    panel.addEventListener('click',event => {
      if (event.target !== panel) return;
      const rect = panel.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel(panel);
    });
    panel.addEventListener('close',() => { if (!$('dialog[open]')) document.body.classList.remove('panel-open'); });
  });

  function renderCategories() {
    const categories = ['All',...new Set(products.filter(product => product.audience === state.audience).map(product=>product.category))];
    $('#category-filters').innerHTML = categories.map(category=>`<button type="button" data-category="${escape(category)}" aria-pressed="${category === state.category}">${escape(category)}</button>`).join('');
  }
  function renderCatalogue() {
    let found = catalog.filterProducts(state.audience,state.query,state.category);
    if (state.sort === 'price-low') found.sort((a,b)=>a.price-b.price);
    if (state.sort === 'price-high') found.sort((a,b)=>b.price-a.price);
    if (state.sort === 'name') found.sort((a,b)=>a.name.localeCompare(b.name));
    $('#catalogue-count').textContent = `${found.length} ${found.length===1?'essential':'essentials'} for ${state.audience === 'human'?'human':'pet'} care`;
    $('#product-grid').innerHTML = found.length ? found.map((product,index)=>`
      <article class="product-card ${product.id===state.selected?'is-selected':''}" style="--card-index:${index}">
        <button class="product-preview" type="button" data-product="${product.id}" aria-controls="product-detail" aria-pressed="${product.id===state.selected}" aria-label="View ${escape(product.name)}">
          <span class="product-kind"><span>${product.audience==='human'?'✚ Human care':'♧ Pet care'}</span>${product.review?'<span class="rx-badge">Vet Rx</span>':''}</span>
          <img src="${product.image}" alt="${escape(product.name)} illustrative packaging" width="400" height="400" loading="lazy" decoding="async">
          <span class="product-category">${escape(product.category)}</span><h3>${escape(product.name)}</h3><p class="product-pack">${escape(product.pack)}</p>
        </button>
        <div class="product-card-footer"><div class="card-price"><strong>${money(product.price)}</strong><del>${money(product.mrp)}</del></div><div class="shelf-stepper" aria-label="${escape(product.name)} quantity"><button type="button" data-shelf-minus="${product.id}" aria-label="Decrease ${escape(product.name)} quantity">−</button><output data-shelf-count="${product.id}">0</output><button class="quick-add" type="button" data-add="${product.id}" aria-label="Add ${escape(product.name)} to bag">+</button></div></div>
      </article>`).join('') : '<div class="empty-results"><h3>A little more specific?</h3><p>We couldn’t find an essential matching these filters.</p><button type="button" class="care-button" data-action="clear-filters">Clear filters ↗</button></div>';
    syncBagButtons();
    $('#catalogue-status').textContent = `${found.length} results in ${state.audience} care.`;
  }
  function switchAudience(audience) {
    if (!['human','pet'].includes(audience)) return;
    state.audience=audience; state.category='All'; state.query='';
    $('#catalogue-search').value='';
    $('#catalogue-search').placeholder=audience==='pet'?'Search pet medicines, grooming, supplements…':'Search medicines, vitamins, first aid…';
    $('.audience-switch').style.setProperty('--audience-index',audience==='pet'?1:0);
    $$('[data-audience]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.audience===audience)));
    if (byId[state.selected].audience !== audience) {
      state.selected=products.find(product=>product.audience===audience).id; state.quantity=1; renderDetail();
    }
    renderCategories(); renderCatalogue();
  }
  function renderDetail() {
    const product=byId[state.selected];
    const saving=Math.round((product.mrp-product.price)/product.mrp*100);
    $('#product-detail').innerHTML=`
      <div class="detail-art"><img src="${product.image}" alt="${escape(product.name)} illustrative packaging" width="400" height="400"><div class="detail-art-caption"><span>${product.audience==='pet'?'♧ Pet care':'✚ Human care'}</span><span>Illustrative packaging</span></div></div>
      <div class="detail-content">
        <p class="detail-breadcrumb">The care shelf / ${product.audience==='pet'?'Pet care':'Human care'} / ${escape(product.category)}</p>
        <div class="detail-topline"><p class="eyebrow">${escape(product.brand)}</p>${product.review?'<span class="rx-badge">Veterinary prescription required</span>':''}</div>
        <h2 id="detail-name" tabindex="-1">${escape(product.name)}</h2><p class="detail-description">${escape(product.description)}</p>
        <div class="detail-prices"><strong>${money(product.price)}</strong><del>${money(product.mrp)}</del><span class="saving">${saving}% off sample MRP</span></div><p class="detail-price-note">Illustrative price for ${escape(product.pack.toLowerCase())}. Delivery calculated in your bag.</p>
        <dl class="product-facts"><div><dt>Pack size</dt><dd>${escape(product.pack)}</dd></div><div><dt>Category</dt><dd>${escape(product.category)}</dd></div><div><dt>Composition / format</dt><dd>${escape(product.composition)}</dd></div><div><dt>Care pathway</dt><dd>${product.audience==='pet'?'For pets · check species on the label':'For people · human use only'}</dd></div></dl>
        <div class="detail-purchase"><div class="quantity-stepper" aria-label="Product quantity"><button type="button" data-action="detail-minus" aria-label="Decrease quantity" disabled>−</button><span id="detail-quantity">1</span><button type="button" data-action="detail-plus" aria-label="Increase quantity">+</button></div><button type="button" class="care-button" data-action="add-detail" id="detail-add">Add to bag — ${money(product.price)}</button></div>
        <p class="detail-care-note">${product.review?'A veterinary prescription must be attached before a demo order can be prepared.':'Our ambition: local medicine delivery in 10 minutes. Live fulfilment is not connected in this prototype.'}</p>
        <details class="product-notes"><summary>Care notes &amp; product information</summary><p>${escape(product.caution)}</p><p>Product names, pack artwork and prices form a presentation catalogue. Confirm the actual manufacturer’s label and professional guidance before using a medicine or supplement.</p></details>
        <div class="compare-prices"><h3>A little price perspective.</h3><p>Illustrative same-pack comparison. These are sample prices, not live retailer quotes.</p><table class="price-table"><caption class="visually-hidden">Sample prices for ${escape(product.name)}, ${escape(product.pack)}</caption><thead><tr><th scope="col">Store</th><th scope="col">${escape(product.pack)}</th></tr></thead><tbody><tr class="our-price"><td>Healio <small>Selected price</small></td><td>${money(product.price)}</td></tr>${product.comparisons.map(offer=>`<tr><td>${escape(offer.store)}</td><td>${money(offer.price)}</td></tr>`).join('')}</tbody></table></div>
        <button class="text-link detail-doctor-link" type="button" data-open="doctor-panel" data-care="${product.audience}">Need guidance? ${product.audience==='pet'?'Ask a vet':'Talk to a doctor'} ↗</button>
      </div>`;
    const detail=$('#product-detail');
    detail.classList.remove('is-changing');
    // Restart the one-shot product entrance after the DOM has its new content.
    root.requestAnimationFrame(()=>detail.classList.add('is-changing'));
    refreshGeometry();
  }
  function selectProduct(id) {
    if (!byId[id]) return;
    state.selected=id; state.quantity=1;
    $$('[data-product]').forEach(button=>{
      const selected=button.dataset.product===id;
      button.setAttribute('aria-pressed',String(selected)); button.closest('.product-card').classList.toggle('is-selected',selected);
    });
    renderDetail(); scrollTo($('#pdp')); $('#detail-name').focus({preventScroll:true});
  }
  function setDetailQuantity(quantity) {
    state.quantity=Math.max(1,Math.min(20,quantity));
    $('#detail-quantity').textContent=state.quantity;
    $('[data-action="detail-minus"]').disabled=state.quantity===1;
    $('[data-action="detail-plus"]').disabled=state.quantity===20;
    $('#detail-add').textContent=`Add to bag — ${money(byId[state.selected].price*state.quantity)}`;
  }
  function syncBagButtons() {
    const summary=bag.totals();
    $$('[data-cart-count]').forEach(element=>element.textContent=summary.count);
    $$('[data-add]').forEach(button=>{
      const quantity=bag.quantity(button.dataset.add);
      button.classList.toggle('has-quantity',quantity>0);
      button.textContent='+'; button.disabled=quantity>=20;
      const counter=document.querySelector(`[data-shelf-count="${button.dataset.add}"]`); if(counter) counter.textContent=quantity;
      const minus=document.querySelector(`[data-shelf-minus="${button.dataset.add}"]`); if(minus) minus.disabled=quantity===0;
    });
  }
  function renderBag(restore) {
    const items=bag.items(), summary=bag.totals();
    syncBagButtons();
    if (!items.length) {
      $('#cart-content').innerHTML='<div class="empty-bag"><span aria-hidden="true">＋</span><h3>Your care shelf starts here.</h3><p>Add a few essentials for yourself<br>or your four-legged family.</p><button type="button" class="care-button" data-action="continue-shopping">Explore the essentials ↗</button></div>';
    } else {
      $('#cart-content').innerHTML=`<div class="shipping-note">${summary.subtotal>=299?'Your demo bag qualifies for free delivery.':`Add ${money(299-summary.subtotal)} for free demo delivery.`}<div class="shipping-meter" aria-hidden="true"><span style="width:${Math.min(100,summary.subtotal/299*100)}%"></span></div></div><div class="cart-items">${items.map(item=>{
        const product=byId[item.id];
        return `<article class="cart-item"><img src="${product.image}" alt="" width="78" height="105"><div><h3>${escape(product.name)}</h3><p>${escape(product.pack)} · ${product.audience==='pet'?'Pet care':'Human care'} ${product.review?'· Vet Rx':''}</p><div class="cart-item-row"><div class="quantity-stepper"><button type="button" data-cart-change="-1" data-id="${item.id}" aria-label="Decrease ${escape(product.name)} quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-change="1" data-id="${item.id}" ${item.quantity>=20?'disabled':''} aria-label="Increase ${escape(product.name)} quantity">+</button></div><strong>${money(product.price*item.quantity)}</strong><button type="button" class="remove-item" data-remove="${item.id}" aria-label="Remove ${escape(product.name)}">Remove</button></div></div></article>`;
      }).join('')}</div><dl class="bag-totals"><div><dt>Subtotal</dt><dd>${money(summary.subtotal)}</dd></div><div><dt>Delivery</dt><dd>${summary.delivery?money(summary.delivery):'Free'}</dd></div><div><dt>Total</dt><dd>${money(summary.total)}</dd></div></dl><p class="bag-savings">${money(summary.savings)} below sample MRP.</p>${summary.review?'<p class="detail-care-note">Your bag includes vet-review items. A veterinary prescription is required in the next step.</p>':''}<div class="cart-actions"><button type="button" class="care-button" data-action="checkout">Review demo order ↗</button><button type="button" class="text-link" data-action="continue-shopping">Continue exploring</button></div><p class="demo-note">Sample catalogue prices. No payment or real pharmacy order is created by this prototype.</p>`;
    }
    if (restore) ($(`[data-cart-change="${restore.change}"][data-id="${restore.id}"]`) || $('[data-action="continue-shopping"]'))?.focus({preventScroll:true});
  }
  function addProduct(id, quantity=1, revealBag=false) {
    if (!byId[id]) return;
    const before=bag.quantity(id);
    bag.add(id,quantity); syncBagButtons();
    $$('[data-cart-count]').forEach(element=>{
      element.classList.remove('is-bumping'); root.requestAnimationFrame(()=>element.classList.add('is-bumping'));
    });
    message(before===20?'This item is limited to 20 per demo bag.':`${byId[id].name} added to your care bag.`);
    if (revealBag) openPanel('cart-panel');
  }

  root.HealioShop={openPanel,message,addItems(items){let count=0;for(const item of catalog.normaliseCart(items)){const before=bag.quantity(item.id);bag.add(item.id,item.quantity);count+=bag.quantity(item.id)-before;}syncBagButtons();return count;}};

  function updateDoctorType() {
    const form=$('#doctor-form'), pet=form.elements.care.value==='pet';
    $('#doctor-pet-fields').hidden=!pet;
    form.elements.species.required=pet; form.elements.owner.required=pet;
    $('#patient-name-label').textContent=pet?'Pet name':'Patient name';
    $('#doctor-specialty').innerHTML=pet?'<option>Veterinarian</option>':'<option>General physician</option><option>Family care physician</option>';
  }
  function reference(prefix) {
    const random=root.crypto?.randomUUID?.().slice(0,6) || Math.random().toString(36).slice(2,8);
    return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${random.toUpperCase()}`;
  }
  function showConfirmation(container, title, introduction, rows, actions) {
    container.replaceChildren();
    const mark=document.createElement('span'); mark.className='confirmation-mark'; mark.setAttribute('aria-hidden','true'); mark.textContent='✓';
    const heading=document.createElement('h3'); heading.textContent=title; heading.tabIndex=-1;
    const paragraph=document.createElement('p'); paragraph.textContent=introduction;
    const list=document.createElement('dl');
    rows.forEach(([label,value])=>{
      const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');
      term.textContent=label; description.textContent=value; row.append(term,description); list.appendChild(row);
    });
    container.append(mark,heading,paragraph,list);
    actions.forEach(([label,action])=>{
      const button=document.createElement('button'); button.type='button'; button.className='care-button'; button.textContent=label; button.dataset.action=action; container.appendChild(button);
    });
    container.hidden=false; heading.focus({preventScroll:true});
  }
  $('#doctor-form').addEventListener('change',event=>{ if(event.target.name==='care') updateDoctorType(); });
  $('#doctor-form').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget,data=Object.fromEntries(new root.FormData(form));
    const errors=validateDoctorRequest(data);
    $('#doctor-error').textContent=errors.join(' ');
    if(errors.length || !form.reportValidity()) return;
    form.hidden=true;
    showConfirmation($('#doctor-confirmation'),'Your request is ready.','This is a demo request summary. No clinician has been contacted or assigned.',[
      ['Reference',reference('CARE')],['Patient',clean(data.patient)],['Care team',data.specialty],...(data.care==='pet'?[['Species',data.species],['Pet parent',clean(data.owner)]]:[]),['Mobile',data.phone],['Pincode',data.pincode],['Assignment goal','10 minutes when live service is available'],['Concern',clean(data.concern)]
    ],[['Prepare another request','restart-doctor'],['Return to the essentials','close-doctor']]);
  });
  $('#checkout-form').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget,data=Object.fromEntries(new root.FormData(form));
    const errors=validateCheckout(data,bag.items());
    $('#checkout-error').textContent=errors.join(' ');
    if(errors.length || !form.reportValidity()) return;
    const summary=bag.totals();
    form.hidden=true;
    showConfirmation($('#order-confirmation'),'Your demo order is ready.','No payment was taken and no real order was placed. Your bag is preserved for this demonstration.',[
      ['Reference',reference('BAG')],['Deliver to',clean(data.name)],['Address',clean(data.address)],['Pincode',data.pincode],['Items',String(summary.count)],['Sample total',money(summary.total)],['Prescription',summary.review?'File selected for demo review; not uploaded or verified':'Not required for this demo bag']
    ],[['Back to your bag','back-to-bag'],['Keep exploring','continue-shopping']]);
    // Clear the selected prescription; no file or form data is persisted or transmitted.
    form.elements.prescription.value='';
  });

  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');
    if(!target) return;
    if(target.dataset.open) {
      if(target.dataset.care) {
        $('#doctor-form').elements.care.value=target.dataset.care;
        $('#doctor-form').hidden=false; $('#doctor-confirmation').hidden=true; updateDoctorType();
      }
      openPanel(target.dataset.open); return;
    }
    if(target.hasAttribute('data-close')) { closePanel(target.closest('dialog'),target.tagName==='A'); return; }
    if(target.dataset.audience) { switchAudience(target.dataset.audience); return; }
    if(target.dataset.category) { state.category=target.dataset.category; renderCategories(); renderCatalogue(); return; }
    if(target.dataset.product) { selectProduct(target.dataset.product); return; }
    if(target.dataset.shelfMinus) { const id=target.dataset.shelfMinus;bag.setQuantity(id,Math.max(0,bag.quantity(id)-1));syncBagButtons();return; }
    if(target.dataset.add) { addProduct(target.dataset.add); return; }
    if(target.dataset.cartChange) {
      const id=target.dataset.id; bag.setQuantity(id,bag.quantity(id)+Number(target.dataset.cartChange)); renderBag({id,change:target.dataset.cartChange}); return;
    }
    if(target.dataset.remove) { bag.setQuantity(target.dataset.remove,0); renderBag({id:target.dataset.remove,change:'-1'}); return; }
    switch(target.dataset.action) {
      case 'search': scrollTo($('#catalogue')); $('#catalogue-search').focus({preventScroll:true}); break;
      case 'clear-filters': state.query='';state.category='All';$('#catalogue-search').value='';renderCategories();renderCatalogue();break;
      case 'detail-minus': setDetailQuantity(state.quantity-1);break;
      case 'detail-plus': setDetailQuantity(state.quantity+1);break;
      case 'add-detail': addProduct(state.selected,state.quantity,true);break;
      case 'continue-shopping': closePanel($('#cart-panel'),true);scrollTo($('#catalogue'));break;
      case 'checkout': {
        if(!bag.totals().count) return;
        $('#cart-content').hidden=true;$('#order-confirmation').hidden=true;$('#checkout-form').hidden=false;
        const review=bag.totals().review;
        $('#checkout-rx-field').hidden=!review;$('#checkout-form').elements.prescription.required=review;
        $('#checkout-form').elements.name.focus();break;
      }
      case 'back-to-bag': $('#checkout-form').hidden=true;$('#order-confirmation').hidden=true;$('#cart-content').hidden=false;renderBag();break;
      case 'restart-doctor': $('#doctor-form').reset();$('#doctor-form').hidden=false;$('#doctor-confirmation').hidden=true;$('#doctor-error').textContent='';updateDoctorType();$('#doctor-form').elements.patient.focus();break;
      case 'close-doctor': closePanel($('#doctor-panel'),true);scrollTo($('#catalogue'));break;
    }
  });
  $('#catalogue-search').addEventListener('input',event=>{state.query=event.target.value;renderCatalogue();});
  $('#catalogue-sort').addEventListener('change',event=>{state.sort=event.target.value;renderCatalogue();});
  renderCategories(); renderCatalogue(); renderDetail(); renderBag(); updateDoctorType();
  if ('IntersectionObserver' in root && !preference.matches) {
    const observer=new root.IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting) {entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}
    }),{threshold:.08,rootMargin:'0px 0px 30px 0px'});
    $$('.reveal').forEach(element=>{element.classList.add('reveal-ready');observer.observe(element);});
  }
})(typeof window !== 'undefined' ? window : globalThis);
