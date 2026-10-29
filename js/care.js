/* Healio commerce: native browser UI, local cart, and the existing private Rx API. */
'use strict';
(() => {
  const { products, byId, normaliseCart, totals } = window.HealioCatalog;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const money = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(n);
  const storageKey = 'healio-care-cart-v1';
  let cart = [];
  try { cart = normaliseCart(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { cart = []; }
  let audience = 'all', category = '', lastFocus, previewURL, toastTimer, rxItems = [], prescriptionBusy = false;
  let rxController = null, rxVersion = 0;
  let catalogueState = { audience:'all', category:'', query:'', sort:'featured' };
  let catalogueScroll = 0, returnToCatalogue = false;
  const chatMessages = [];
  let chatBusy = false, chatError = '', chatController = null;
  const dialog = $('#care-dialog'), content = $('#care-dialog-content');
  const toast = message => { clearTimeout(toastTimer); $('#care-toast').textContent = message; $('#care-toast').classList.add('is-visible'); toastTimer = setTimeout(() => $('#care-toast').classList.remove('is-visible'), 3200); };
  const primary = (text, action, extra = '') => `<button type="button" class="care-primary" data-care-action="${action}" ${extra}>${text} <span aria-hidden="true">↗</span></button>`;
  const heading = (eyebrow, title, copy = '') => `<p class="care-eyebrow">${eyebrow}</p><h2 id="care-dialog-title">${title}</h2>${copy ? `<p class="care-dialog-intro">${copy}</p>` : ''}`;
  function saveCart() {
    cart = normaliseCart(cart);
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { /* An in-memory cart still works when storage is unavailable. */ }
    const count = totals(cart).count;
    refreshPurchaseControls();
    $$('[data-catalogue-cart-count]').forEach(node => { node.textContent = count; });
    $$('[data-cart-label]').forEach(button => { const label = $('.button-alt__text', button); if (label) label.textContent = `Your cart · ${count}`; button.setAttribute('aria-label', `Your cart, ${count} items`); });
  }
  function add(id, quantity = 1, announce = true) {
    if (!byId[id] || !Number.isInteger(quantity) || quantity < 1) return;
    const item = cart.find(item => item.id === id);
    if (item) item.quantity = Math.min(20, item.quantity + quantity); else cart.push({ id, quantity: Math.min(20, quantity) });
    saveCart();
    if (announce) toast(`${byId[id].name} added to your care cart.`);
  }
  function cancelPrescription() {
    if (prescriptionBusy) { rxVersion++; rxController?.abort(); rxController = null; prescriptionBusy = false; }
  }
  function closeDialog() { cancelPrescription(); dialog.close(); }
  function show(html, kind) {
    if (prescriptionBusy) { toast('Please wait for the prescription result.'); return; }
    if (!dialog.open) lastFocus = document.activeElement;
    if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
    content.innerHTML = html;
    dialog.dataset.kind = kind;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $('#care-dialog-title')?.setAttribute('tabindex', '-1');
    $('#care-dialog-title')?.focus({ preventScroll: true });
  }
  dialog.addEventListener('close', () => { cancelPrescription(); if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null; lastFocus?.focus({ preventScroll: true }); });
  dialog.addEventListener('cancel', cancelPrescription);
  $('[data-care-close]').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });

  function filterShelf() {
    const query = $('#care-search').value.trim().toLowerCase();
    const matches = products.filter(product => {
      const haystack = `${product.name} ${product.category} ${product.composition}`.toLowerCase();
      return (audience === 'all' || product.audience === audience) && (!category || product.category === category) && query.split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
    });
    const curated = ['h01','h04','h09','p01','p10','p13'];
    const preview = !query && audience === 'all' && !category ? curated : matches.slice(0,6).map(p => p.id);
    $$('[data-product-card]').forEach(card => { card.hidden = !preview.includes(card.dataset.productCard); });
    $$('.care-audience button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.audience === audience)));
    $('#care-filter-count').textContent = matches.length ? `A little preview · ${Math.min(6,matches.length)} of ${matches.length} essentials${category ? ` · ${category}` : ''}` : 'No essentials found. Try another search.';
    $('#care-no-results').hidden = matches.length > 0;
    const track = $('.books [data-books-slider-wrapper]');
    track.scrollLeft = 0;
    dispatchEvent(new Event('resize'));
  }
  function shop(who = 'all') {
    audience = who; category = ''; $('#care-search').value = ''; filterShelf();
    if (dialog.open) closeDialog();
    $('#catalogue').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  }
  $('#care-search').addEventListener('input', () => { category = ''; filterShelf(); });
  $$('.care-audience button').forEach(button => button.addEventListener('click', () => { audience = button.dataset.audience; category = ''; filterShelf(); }));
  $$('[data-care-category]').forEach(item => {
    const choose = () => {
      const name = item.dataset.careCategory;
      audience = name === 'Little paws' || name === 'Pet supplements' || name === 'Vet medicines' || name === 'Grooming' ? 'pet' : 'all';
      category = name === 'Pet supplements' ? 'Supplements' : name === 'Little paws' || name === 'and more!' ? '' : name;
      $('#care-search').value = ''; filterShelf(); $('#catalogue').scrollIntoView({ behavior: 'smooth' });
    };
    item.addEventListener('click', choose);
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
  });
  function purchaseControl(id, variant = '') {
    const product = byId[id], quantity = cart.find(item => item.id === id)?.quantity || 0;
    if (!quantity) return `<button type="button" class="${variant === 'primary' ? 'care-primary' : 'care-add'}" data-care-action="add" data-product="${id}">${variant === 'primary' ? 'Add to your cart +' : 'Add +'}</button>`;
    return `<div class="care-inline-stepper" role="group" aria-label="Quantity for ${escape(product.name)}"><button type="button" data-care-adjust="${id}" data-delta="-1" aria-label="Remove one ${escape(product.name)}">−</button><output class="care-current-quantity" aria-label="Quantity" aria-live="polite">${quantity}</output><button type="button" data-care-adjust="${id}" data-delta="1" aria-label="Add one ${escape(product.name)}" ${quantity >= 20 ? 'disabled' : ''}>+</button></div>`;
  }
  function refreshPurchaseControls() {
    $$('[data-buy-product]').forEach(wrapper => {
      const quantity = cart.find(item => item.id === wrapper.dataset.buyProduct)?.quantity || 0;
      if (quantity && $('.care-inline-stepper', wrapper)) {
        $('.care-current-quantity', wrapper).textContent = quantity;
        $('[data-delta="1"]', wrapper).disabled = quantity >= 20;
      } else {
        const focused = wrapper.contains(document.activeElement);
        wrapper.innerHTML = purchaseControl(wrapper.dataset.buyProduct, wrapper.dataset.buyVariant || '');
        if (focused) (quantity ? $('[data-delta="1"]', wrapper) : $('button', wrapper))?.focus({ preventScroll:true });
      }
    });
  }
  function catalogueView(fromShelf = false) {
    if (fromShelf) {
      catalogueState = { audience, category, query:$('#care-search').value, sort:'featured' };
      catalogueScroll = 0;
    }
    const colors = ['#c2b4eb','#8ef1fd','#faed8f','#feb6fa','#c0d43e','#ffd24a'];
    show(heading('ALL YOUR LITTLE ESSENTIALS', 'A little more choice.', 'One proper care shelf. Find what you need for your people and your paws.') + `<div class="care-catalogue-header"><label class="care-full-search"><span class="care-sr">Search the full catalogue</span><input id="care-catalogue-search" type="search" placeholder="Search medicines, pet care, vitamins…" autocomplete="off" value="${escape(catalogueState.query)}"><span aria-hidden="true">⌕</span></label><button type="button" class="care-outline" data-care-action="chat">Ask Healio ↗</button><button type="button" class="care-primary" data-care-action="cart">Your cart · <span data-catalogue-cart-count>${totals(cart).count}</span> ↗</button></div><div class="care-catalogue-layout"><aside class="care-catalogue-sidebar" aria-label="Catalogue filters"><div class="care-catalogue-audience" role="group" aria-label="Care for"><button type="button" data-catalogue-audience="all">Everyone</button><button type="button" data-catalogue-audience="human">Humans</button><button type="button" data-catalogue-audience="pet">Little paws</button></div><h3>A little more specific?</h3><div id="care-catalogue-categories"></div><label class="care-sort-label">Sort your shelf<select id="care-catalogue-sort"><option value="featured">Our care shelf</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A–Z</option></select></label><p class="care-small-note">Illustrative product images and sample prices. Exact packs matter. Prescription products need professional review.</p></aside><div><p id="care-catalogue-result-count" class="care-catalogue-result-count" aria-live="polite"></p><div class="care-catalogue-grid" id="care-catalogue-grid">${products.map((p,i)=>`<article class="care-full-card" data-full-product="${p.id}" style="--product-color:${colors[i%colors.length]}"><button type="button" class="care-full-image" data-care-action="product" data-product="${p.id}" aria-label="View ${escape(p.name)}"><img src="${p.image}" alt="${escape(p.name)}" loading="lazy"></button><span class="care-mini-tag">${p.audience==='human'?'Human care':'Pet care'}${p.review?' · Rx review':''}</span><h3>${escape(p.name)}</h3><p>${escape(p.pack)}</p><div class="care-full-price"><strong>${money(p.price)}</strong><s>${money(p.mrp)}</s></div><div class="care-full-actions"><div class="care-buy-control" data-buy-product="${p.id}">${purchaseControl(p.id)}</div><button type="button" class="care-compare" data-care-action="compare" data-product="${p.id}">Compare ↗</button></div></article>`).join('')}</div><div class="care-full-empty" id="care-catalogue-empty" hidden><h3>A little too specific?</h3><p>No matches on this shelf. Try another name or clear your filters.</p><button type="button" class="care-outline" data-catalogue-reset>Show all essentials ↗</button></div></div></div>`, 'catalogue');
    $('#care-catalogue-sort').value = catalogueState.sort;
    $('#care-catalogue-search').addEventListener('input', event => { catalogueState.query = event.target.value; filterCatalogue(); });
    $('#care-catalogue-sort').addEventListener('change', event => { catalogueState.sort = event.target.value; filterCatalogue(); });
    filterCatalogue();
    dialog.scrollTop = catalogueScroll;
  }
  function filterCatalogue() {
    const focusedCategory = document.activeElement?.getAttribute('data-catalogue-category');
    const availableCategories = [...new Set(products.filter(p => catalogueState.audience === 'all' || p.audience === catalogueState.audience).map(p => p.category))];
    if (catalogueState.category && !availableCategories.includes(catalogueState.category)) catalogueState.category = '';
    $('#care-catalogue-categories').innerHTML = ['',...availableCategories].map(name => `<button type="button" data-catalogue-category="${escape(name)}" aria-pressed="${catalogueState.category === name}">${escape(name || 'All essentials')}</button>`).join('');
    $$('[data-catalogue-audience]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogueAudience === catalogueState.audience)));
    const query = catalogueState.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const sorted = [...products];
    if (catalogueState.sort === 'price-low') sorted.sort((a,b)=>a.price-b.price);
    if (catalogueState.sort === 'price-high') sorted.sort((a,b)=>b.price-a.price);
    if (catalogueState.sort === 'name') sorted.sort((a,b)=>a.name.localeCompare(b.name));
    let count = 0;
    sorted.forEach((product,index) => {
      const card = $(`[data-full-product="${product.id}"]`);
      const visible = (catalogueState.audience === 'all' || product.audience === catalogueState.audience) && (!catalogueState.category || product.category === catalogueState.category) && query.every(word => `${product.name} ${product.category} ${product.composition}`.toLowerCase().includes(word));
      card.hidden = !visible; $('#care-catalogue-grid').append(card);
      if (visible) count++;
    });
    $('#care-catalogue-result-count').textContent = `${count} ${count === 1 ? 'essential' : 'essentials'} · ${catalogueState.audience === 'pet' ? 'For little paws' : catalogueState.audience === 'human' ? 'For humans' : 'For your whole family'}`;
    $('#care-catalogue-empty').hidden = count > 0;
    if (focusedCategory !== null) $$('[data-catalogue-category]').find(button => button.dataset.catalogueCategory === focusedCategory)?.focus({preventScroll:true});
  }
  function renderChatMessages() {
    const log = $('#care-chat-messages'); if (!log) return;
    log.replaceChildren();
    const messages = [{ role:'assistant', text:'Hi, I’m Healio. A little help finding human and pet care, comparing your options, or figuring out tree rewards. What are you looking for?' }, ...chatMessages];
    for (const message of messages) {
      const bubble = document.createElement('p'); bubble.className = `care-chat-bubble is-${message.role}`;
      if (message.role === 'assistant') {
        for (const part of message.text.replace(/^\* /gm, '• ').split(/(\*\*[^*\n]+\*\*)/g)) {
          if (part.startsWith('**') && part.endsWith('**')) { const strong=document.createElement('strong'); strong.textContent=part.slice(2,-2); bubble.append(strong); }
          else bubble.append(document.createTextNode(part));
        }
      } else bubble.textContent = message.text;
      log.append(bubble);
    }
    if (chatBusy) { const pending = document.createElement('p'); pending.className='care-chat-bubble is-assistant is-pending'; pending.textContent='A little help is on the way…'; log.append(pending); }
    $('#care-chat-error').textContent = chatError;
    $('#care-chat-send').disabled = chatBusy;
    $$('[data-chat-prompt]').forEach(button => { button.disabled = chatBusy; });
    $('#care-chat-stop').hidden = !chatBusy;
    log.scrollTop = log.scrollHeight;
  }
  function chatView() {
    show(heading('A LITTLE HELP, RIGHT HERE', 'Ask Healio.', 'Your care-shelf companion. Shopping questions, human and pet essentials, and a little greener living.') + `<div class="care-chat-suggestions"><button type="button" data-chat-prompt="What human care essentials are on this shelf?">Human essentials ↗</button><button type="button" data-chat-prompt="What pet-care categories can I shop?">Little paws ↗</button><button type="button" data-chat-prompt="How do Healio’s tree rewards and points work?">Tree rewards ↗</button></div><div id="care-chat-messages" class="care-chat-messages" role="log" aria-live="polite" aria-label="Conversation with Healio"></div><p id="care-chat-error" class="care-chat-error" role="alert"></p><form id="care-chat-form"><label for="care-chat-question" class="care-sr">Your question for Healio</label><div class="care-chat-compose"><input id="care-chat-question" maxlength="1500" required autocomplete="off" placeholder="Ask a little question…"><button type="submit" id="care-chat-send" aria-label="Send message">↗</button></div><button type="button" id="care-chat-stop" class="care-text-link" hidden>Stop reply</button></form><div class="care-chat-footer"><p>AI shopping help, not diagnosis or dosing. Messages are sent to Google Gemini.</p><button type="button" class="care-text-link" data-care-action="catalogue-back">Browse all essentials ↗</button></div>`, 'chat');
    renderChatMessages();
    $('#care-chat-form').addEventListener('submit', event => { event.preventDefault(); const input=$('#care-chat-question'); const question=input.value.trim(); if(question&&!chatBusy) { input.value=''; sendChat(question); } });
    $('#care-chat-stop').addEventListener('click', () => chatController?.abort());
  }
  async function sendChat(question) {
    if (chatBusy || !question.trim()) return;
    const history = chatMessages.slice(-8).map(message=>({ role:message.role, text:message.text }));
    chatMessages.push({ role:'user', text:question.slice(0,1500) }); chatBusy=true; chatError='';
    const controller=new AbortController(); chatController=controller; renderChatMessages();
    try {
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:question.slice(0,1500),history}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])});
      const result=await response.json();
      if(!response.ok)throw new Error(response.status===429?'A little busy right now. Please wait a moment and try again.':result.error||'The care assistant is unavailable. Please try again.');
      if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('No reply came through. Please try again.');
      chatMessages.push({role:'assistant',text:result.reply});
    } catch(error) { chatError=controller.signal.aborted?'Reply stopped. You can ask another question.':error.name==='TimeoutError'?'That took a little too long. Please try again.':error.message; }
    finally { chatBusy=false; chatController=null; renderChatMessages(); }
  }
  function cartView() {
    const t = totals(cart), points = Math.floor(t.total / 100) * 5;
    const items = cart.map(item => {
      const p = byId[item.id];
      return `<article class="care-cart-item"><img src="${p.image}" alt="${escape(p.name)}"><div><span class="care-mini-tag">${p.audience === 'human' ? 'Human care' : 'Pet care'}${p.review ? ' · Rx review' : ''}</span><h3>${escape(p.name)}</h3><p>${escape(p.pack)} · ${money(p.price)} each</p><button type="button" class="care-text-link" data-remove="${p.id}">Remove</button></div><div class="care-quantity" role="group" aria-label="Quantity for ${escape(p.name)}"><button type="button" data-quantity="${p.id}" data-step="-1" aria-label="Remove one ${escape(p.name)}">−</button><output>${item.quantity}</output><button type="button" data-quantity="${p.id}" data-step="1" aria-label="Add one ${escape(p.name)}" ${item.quantity >= 20 ? 'disabled' : ''}>+</button></div></article>`;
    }).join('');
    show(heading('A LITTLE CLOSER TO CARE', 'Your care cart.', cart.length ? 'All your little essentials, together.' : 'A little empty. Let’s find what you need.') + (cart.length ? `<div class="care-cart-list">${items}</div><div class="care-cart-summary"><p><span>Essentials subtotal</span><strong>${money(t.subtotal)}</strong></p><p><span>Delivery${t.delivery ? '' : ' · a little treat'}</span><strong>${t.delivery ? money(t.delivery) : 'Free'}</strong></p><p class="care-total"><span>Total</span><strong>${money(t.total)}</strong></p></div><div class="care-reward-note"><img src="assets/healio/tree.svg" alt=""><p>This cart could earn <strong>${points} points</strong> after completion. Every 10 completed orders plants a tree.</p></div>${t.review ? '<p class="care-small-note">Your cart includes prescription items. Professional review is required before dispensing.</p>' : ''}<div class="care-dialog-actions">${primary('Review your order','review')}<button type="button" class="care-text-link" data-care-action="catalogue-back">A little more shopping ↗</button></div><p class="care-small-note">Sample catalogue prices. No payment will be taken in this preview.</p>` : `<img class="care-empty-art" src="assets/healio/bag.svg" alt="Your Healio care bag">${primary('Explore the care shelf','shop')}`), 'cart');
  }
  const retailerURLs = { 'Apollo Pharmacy':'https://www.apollopharmacy.in/', 'Tata 1mg':'https://www.1mg.com/', 'Netmeds':'https://www.netmeds.com/', 'Supertails':'https://supertails.com/', 'HUFT':'https://headsupfortails.com/', 'Amazon Pets':'https://www.amazon.in/' };
  function productView(id, comparison = false) {
    const p = byId[id]; if (!p) return;
    const table = `<div class="care-comparison"><h3>A little price check.</h3><p class="care-small-note">Sample prices, not live quotes. Check the exact pack, current price, stock and delivery with each retailer.</p><table><caption class="care-sr">Illustrative price comparison for ${escape(p.name)}, ${escape(p.pack)}</caption><thead><tr><th scope="col">Where</th><th scope="col">Sample price</th><th scope="col">Have a look</th></tr></thead><tbody><tr class="care-best-price"><th scope="row">Healio</th><td>${money(p.price)}</td><td>Your care cart</td></tr>${p.comparisons.map(x=>`<tr><th scope="row">${escape(x.store)}</th><td>${money(x.price)}</td><td><a href="${retailerURLs[x.store]}" target="_blank" rel="noopener noreferrer" aria-label="Check ${escape(x.store)}">Check retailer ↗</a></td></tr>`).join('')}</tbody></table></div>`;
    show((returnToCatalogue ? '<button type="button" class="care-back-catalogue" data-care-action="catalogue-back">← Back to all essentials</button>' : '') + heading(p.audience === 'human' ? 'A LITTLE HUMAN CARE' : 'FOR YOUR LITTLE PAWS', escape(p.name), escape(p.pack)) + `<div class="care-product-detail"><div class="care-detail-art"><img src="${p.image}" alt="${escape(p.name)}"></div><div><span class="care-mini-tag">${escape(p.category)}</span><p>${escape(p.description)}</p><p class="care-detail-price">${money(p.price)} <s>${money(p.mrp)}</s></p><p class="care-small-note">${escape(p.caution)}</p><div class="care-buy-control is-detail" data-buy-product="${p.id}" data-buy-variant="primary">${purchaseControl(p.id,'primary')}</div></div></div>${table}`, comparison ? 'compare' : 'product');
  }
  function rewardsView() {
    show(heading('A LITTLE CARE. A LITTLE GREENER.', 'Good things take root.', 'Every 10 completed orders, we plant a tree for you. Earn 5 points per ₹100 spent. Redeem 50 points for an additional tree.') + `<div class="care-rewards-rules"><article><strong>10</strong><span>completed orders<br>one tree on us</span></article><article><strong>5</strong><span>points for every<br>₹100 spent</span></article><article><strong>50</strong><span>points plants<br>another tree</span></article></div><div class="care-impact-calculator"><div><h3>See your little impact.</h3><label for="care-spend">How much would you spend?</label><div class="care-money-input"><span aria-hidden="true">₹</span><input type="number" id="care-spend" min="0" max="10000000" step="1" value="1000" inputmode="numeric"></div><p class="care-small-note">A spending estimate, not an earned balance.</p></div><img src="assets/healio/tree.svg" alt="A little tree growing from your care"><div class="care-impact-output" aria-live="polite"><p><strong id="care-earned-points">50</strong> points</p><p>Enough to plant <strong id="care-redeem-trees">1</strong> extra <span id="care-tree-word">tree</span>.</p><p id="care-leftover-points">0 points left over.</p></div></div><div class="care-balance"><h3>Your little grove.</h3><p><strong>0</strong> completed orders · <strong>0</strong> earned points</p><progress max="10" value="0" aria-label="Completed orders toward your next tree"></progress><p>10 completed orders to your first tree.</p><button type="button" class="care-primary" disabled>Redeem 50 points for a tree</button><p class="care-small-note">Points are credited after confirmed orders. This preview has no completed purchases or planting confirmations.</p></div>`, 'rewards');
    $('#care-spend').addEventListener('input', () => {
      const raw = Number($('#care-spend').value), amount = Number.isFinite(raw) ? Math.max(0, Math.min(10000000, raw)) : 0;
      const points = Math.floor(amount / 100) * 5, trees = Math.floor(points / 50);
      $('#care-earned-points').textContent = points; $('#care-redeem-trees').textContent = trees; $('#care-tree-word').textContent = trees === 1 ? 'tree' : 'trees'; $('#care-leftover-points').textContent = `${points % 50} points left over.`;
    });
  }
  function doctorView() {
    show(heading('A LITTLE EXPERT GUIDANCE', 'A doctor. Less waiting.', 'Human doctor or veterinarian? Tell us who needs care. Our goal is to connect you in 10 minutes, subject to availability.') + `<div class="care-doctor-layout"><img src="assets/healio/doctor.svg" alt="A doctor ready to listen"><form id="care-doctor-form" class="care-form"><label>Who needs a little care?<select name="audience" required><option value="Human doctor">A person · human doctor</option><option value="Veterinarian">A pet · veterinarian</option></select></label><label>Your name<input name="name" autocomplete="name" required maxlength="80" placeholder="A name to call you by"></label><label>Mobile number<input name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[+0-9 ()-]{10,18}" required maxlength="18" placeholder="Your contact number"></label><label>Your PIN code<input name="pincode" inputmode="numeric" autocomplete="postal-code" pattern="[1-9][0-9]{5}" maxlength="6" required placeholder="6-digit PIN code"></label><label>A little about what’s happening<textarea name="concern" rows="3" required maxlength="1000" placeholder="Your question, or your pet’s species and concern"></textarea></label><button type="submit" class="care-primary">Prepare appointment request ↗</button><p class="care-small-note">Request preview only. No clinician is contacted and no appointment is confirmed here.</p></form></div>`, 'doctor');
    $('#care-doctor-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      show(heading('A LITTLE CLEARER ALREADY', 'Your request is ready.', 'No appointment has been booked. This is a preview of the request to share with the care team.') + `<div class="care-request-summary"><p><strong>Care for</strong><span>${escape(data.audience)}</span></p><p><strong>Your name</strong><span>${escape(data.name)}</span></p><p><strong>Contact</strong><span>${escape(data.phone)}</span></p><p><strong>Area</strong><span>${escape(data.pincode)}</span></p><p><strong>Your concern</strong><span>${escape(data.concern)}</span></p></div>${primary('Back to your care shelf','shop')}`, 'doctor-preview');
    });
  }
  function prescriptionView() {
    rxItems = [];
    show(heading('LESS TYPING. MORE CARE.', 'Your prescription. Sorted.', 'Upload a clear photo or PDF. We’ll look for exact catalogue matches. Review the names and quantities, then add them to your cart.') + `<form id="care-rx-form" class="care-form"><label>Prescription for<select name="audience" id="care-rx-audience"><option value="human">A person · human care</option><option value="pet">A pet · veterinary care</option></select></label><label class="care-upload"><input type="file" name="file" id="care-rx-file" accept="image/jpeg,image/png,application/pdf"><span class="care-upload-icon" aria-hidden="true">Rx</span><strong>Drop a little paperwork here.</strong><span>Choose a JPG, PNG or PDF · up to 3 MB</span><small id="care-rx-filename">No prescription selected yet</small></label><div id="care-rx-preview" class="care-rx-preview" hidden></div><button type="submit" class="care-primary" id="care-rx-read">Read my prescription ↗</button><p id="care-rx-status" class="care-small-note" role="status"></p><p class="care-small-note">Choosing “Read my prescription” sends the file to Healio’s Google Gemini reading service. The file isn’t saved in your cart or browser storage.</p></form><details class="care-manual"><summary>Or type the medicine names from your prescription</summary><p>Use the exact catalogue name, one per line. Add “| 2” for two packs. You’ll still review everything before adding.</p><label class="care-sr" for="care-rx-text">Medicine names and optional pack quantities</label><textarea id="care-rx-text" rows="4" placeholder="Paracetamol 650 mg | 1&#10;Cetirizine 10 mg | 2"></textarea><button type="button" class="care-outline" id="care-rx-match">Find exact matches ↗</button></details><div id="care-rx-results" class="care-rx-results" hidden></div>`, 'prescription');
    const fileInput = $('#care-rx-file');
    fileInput.addEventListener('change', () => {
      if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null;
      const file = fileInput.files[0]; $('#care-rx-results').hidden = true; $('#care-rx-status').textContent = '';
      $('#care-rx-filename').textContent = file ? file.name : 'No prescription selected yet';
      const preview = $('#care-rx-preview'); preview.replaceChildren(); preview.hidden = true;
      if (file && file.type.startsWith('image/') && validFile(file)) { previewURL = URL.createObjectURL(file); const image = document.createElement('img'); image.src = previewURL; image.alt = 'Your selected prescription preview'; preview.append(image); preview.hidden = false; }
    });
    $('#care-rx-audience').addEventListener('change', () => { rxItems = []; $('#care-rx-results').hidden = true; });
    $('#care-rx-match').addEventListener('click', () => {
      const who = $('#care-rx-audience').value;
      const lines = $('#care-rx-text').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,40);
      if (!lines.length) { toast('Type at least one exact medicine name.'); return; }
      const normalize = text => text.toLowerCase().replace(/\s+/g,' ').trim();
      const matches = lines.map(line => {
        const [name, writtenQuantity] = line.split('|').map(x=>x.trim());
        const product = products.find(p=>p.audience === who && normalize(p.name) === normalize(name));
        const count = Number(writtenQuantity);
        return { id: product?.id || null, name, pack: product?.pack, packs: writtenQuantity && Number.isInteger(count) && count > 0 && count <= 20 ? count : null, status: product ? 'Exact catalogue match · check before adding' : 'No exact match in this care category' };
      });
      renderPrescription(matches, 'Matched the names you typed. No file was read.');
    });
    $('#care-rx-form').addEventListener('submit', async event => {
      event.preventDefault(); if (prescriptionBusy) return;
      const file = fileInput.files[0], status = $('#care-rx-status');
      if (!validFile(file)) { status.textContent = 'Choose a nonempty JPG, PNG or PDF up to 3 MB.'; return; }
      prescriptionBusy = true; const requestVersion = ++rxVersion; const controller = new AbortController(); rxController = controller; const form = event.currentTarget; const manualButton = $('#care-rx-match'); const button = $('#care-rx-read'); [...event.currentTarget.elements].forEach(element => element.disabled = true); $('#care-rx-match').disabled = true; button.textContent = 'Reading your prescription…'; status.textContent = 'Looking for the written medicine names. Please keep this window open.';
      $('#care-rx-results').hidden = true;
      const who = $('#care-rx-audience').value;
      try {
        const data = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('The selected file could not be read.'));reader.readAsDataURL(file);});
        if (requestVersion !== rxVersion) return;
        const response = await fetch('/api/prescription', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ audience:who, mimeType:file.type, data }), signal:AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]) });
        let result; try { result = await response.json(); } catch { throw new Error('Prescription reading needs the Healio server. Run node server.js inside aardvark-reconstruction, or type the exact names below.'); }
        if (!response.ok) throw new Error(result.error || 'Prescription reading is unavailable. You can type the names below.');
        if (requestVersion !== rxVersion) return;
        const safeItems = (Array.isArray(result.items) ? result.items : []).map(item => byId[item.id]?.audience === who ? item : { ...item, id:null, status:'No exact match in the selected care category' });
        renderPrescription(safeItems, (result.notes || []).join(' ')); status.textContent = 'A little less paperwork. Check your matches below.';
      } catch (error) { if (requestVersion !== rxVersion) return; status.textContent = error.name === 'TimeoutError' ? 'Reading took too long. Try again or type the medicine names below.' : error.message; }
      finally { if (requestVersion === rxVersion) { prescriptionBusy = false; rxController = null; [...form.elements].forEach(element => element.disabled = false); manualButton.disabled = false; button.textContent = 'Read my prescription ↗'; } }
    });
  }
  function validFile(file) { return file && file.size > 0 && file.size <= 3 * 1024 * 1024 && ['image/png','image/jpeg','application/pdf'].includes(file.type); }
  function renderPrescription(items, notes) {
    rxItems = items;
    const results = $('#care-rx-results'); results.hidden = false;
    results.innerHTML = `<h3>A little check before the cart.</h3>${items.length ? items.map((item,index)=>`<article class="care-rx-item ${item.id ? '' : 'is-unmatched'}"><div><strong>${escape(item.name)} ${escape(item.strength || '')}</strong><p>${escape(item.status || '')}</p>${item.evidence ? `<small>Written: ${escape(item.evidence)}</small>` : ''}</div>${item.id ? `<label class="care-rx-select"><input type="checkbox" data-rx-select="${index}" checked> Select</label><label class="care-rx-quantity">Packs · ${escape(byId[item.id].pack)}<input type="number" min="1" max="20" step="1" value="${item.packs || ''}" placeholder="Confirm packs" data-rx-quantity="${index}"></label>` : '<span class="care-mini-tag">Ask a pharmacist</span>'}</article>`).join('') : '<p>No exact readable items found. Try a clearer file or type the medicine names.</p>'}${notes ? `<p class="care-small-note">${escape(notes)}</p>` : ''}${items.some(item=>item.id) ? '<label class="care-review-check"><input type="checkbox" id="care-rx-reviewed"> I checked the names, strengths, human/pet category and pack quantities.</label>'+primary('Add reviewed items to cart','rx-add') : ''}<p id="care-rx-add-status" role="status"></p>`;
  }
  function addPrescription() {
    const status = $('#care-rx-add-status');
    if (!$('#care-rx-reviewed')?.checked) { status.textContent = 'Check the prescription and quantities, then tick the review box.'; return; }
    const chosen = $$('[data-rx-select]:checked');
    if (!chosen.length) { status.textContent = 'Select at least one exact match.'; return; }
    const items = chosen.map(el=>{const index=Number(el.dataset.rxSelect);return {id:rxItems[index].id,quantity:Number($(`[data-rx-quantity="${index}"]`).value)};});
    if (items.some(item=>!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20)) { status.textContent = 'Confirm a whole number of packs from 1 to 20 for every selected item.'; return; }
    items.forEach(item=>add(item.id,item.quantity,false));
    status.textContent = `${items.reduce((sum,item)=>sum+item.quantity,0)} reviewed packs added to your care cart.`;
    chosen.forEach(el=>el.checked=false); $('#care-rx-reviewed').checked=false; toast('Your reviewed prescription items are in the cart.');
  }
  function reviewOrder() {
    const t = totals(cart);
    if (!t.count) { cartView(); return; }
    show(heading('YOUR LITTLE ORDER PREVIEW', 'A little closer to care.', 'Your cart is ready to review. No order has been placed, no payment taken, and no delivery dispatched.') + `<div class="care-order-preview">${cart.map(item=>`<p><span>${escape(byId[item.id].name)} × ${item.quantity}</span><strong>${money(byId[item.id].price*item.quantity)}</strong></p>`).join('')}<p class="care-total"><span>Including delivery</span><strong>${money(t.total)}</strong></p></div><div class="care-reward-note"><img src="assets/healio/tree.svg" alt=""><p>After a completed order, this order would earn <strong>${Math.floor(t.total/100)*5} points</strong>. Every 10 completed orders, a tree on us.</p></div>${primary('Back to your cart','cart')}`, 'order-preview');
  }
  document.addEventListener('click', event => {
    const adjust = event.target.closest('[data-care-adjust]');
    if (adjust) { const item=cart.find(item=>item.id===adjust.dataset.careAdjust); if(item)item.quantity=Math.max(0,Math.min(20,item.quantity+Number(adjust.dataset.delta))); saveCart(); return; }
    const fullAudience=event.target.closest('[data-catalogue-audience]');
    if(fullAudience){catalogueState.audience=fullAudience.dataset.catalogueAudience;catalogueState.category='';filterCatalogue();return;}
    const fullCategory=event.target.closest('[data-catalogue-category]');
    if(fullCategory){catalogueState.category=fullCategory.dataset.catalogueCategory;filterCatalogue();return;}
    if(event.target.closest('[data-catalogue-reset]')){catalogueState={audience:'all',category:'',query:'',sort:'featured'};$('#care-catalogue-search').value='';$('#care-catalogue-sort').value='featured';filterCatalogue();return;}
    const chatPrompt=event.target.closest('[data-chat-prompt]');
    if(chatPrompt){sendChat(chatPrompt.dataset.chatPrompt);return;}
    const remove = event.target.closest('[data-remove]');
    if (remove) { cart = cart.filter(item=>item.id !== remove.dataset.remove); saveCart(); cartView(); return; }
    const quantity = event.target.closest('[data-quantity]');
    if (quantity) { const item=cart.find(item=>item.id===quantity.dataset.quantity); if(item)item.quantity+=Number(quantity.dataset.step); saveCart();cartView();return; }
    const trigger = event.target.closest('[data-care-action]');
    if (!trigger) { if (event.target.closest('.menu a[href^="#"]') && $('.menu').classList.contains('is--active')) $('[data-menu-close]').click(); return; }
    event.preventDefault();
    if ($('.menu').classList.contains('is--active')) $('[data-menu-close]').click();
    const action = trigger.dataset.careAction, id=trigger.dataset.product;
    if (action === 'product' || action === 'compare') { returnToCatalogue = dialog.open && dialog.dataset.kind === 'catalogue'; if(returnToCatalogue)catalogueScroll=dialog.scrollTop; }
    ({ catalogue:()=>catalogueView(true), 'catalogue-back':()=>catalogueView(false), chat:chatView, shop:()=>shop(), human:()=>shop('human'), pet:()=>shop('pet'), cart:cartView, product:()=>productView(id), compare:()=>productView(id,true), add:()=>add(id), rewards:rewardsView, doctor:doctorView, prescription:prescriptionView, 'rx-add':addPrescription, review:reviewOrder }[action] || (()=>{}))();
  });
  $('#care-newsletter').addEventListener('submit', event => {
    event.preventDefault(); const form=event.currentTarget;if(!form.reportValidity())return;
    try { localStorage.setItem('healio-care-interest', $('#EMAIL').value); $('.care-newsletter-status',form).textContent='Your interest is saved on this device. You have not been subscribed to a mailing list.'; } catch { $('.care-newsletter-status',form).textContent='Your browser could not save this. Please try again with local storage enabled.'; }
  });
  $$('.care-add[data-product]').forEach(button => { const wrapper=document.createElement('div'); wrapper.className='care-buy-control';wrapper.dataset.buyProduct=button.dataset.product;button.replaceWith(wrapper); });
  saveCart();
  filterShelf();
  // Expose read-only arithmetic for meaningful QA without creating purchase events.
  window.HealioRewards = Object.freeze({ pointsForSpend: amount => Math.floor(Math.max(0,Number(amount)||0)/100)*5, treesForPoints: points=>Math.floor(Math.max(0,Number(points)||0)/50), treesForOrders: orders=>Math.floor(Math.max(0,Number(orders)||0)/10) });
})();
