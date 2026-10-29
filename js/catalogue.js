/* Presentation catalogue. INR prices and retailer comparisons are illustrative,
   not live offers. Product packaging is a purpose-made SVG illustration. */
(function (root) {
  'use strict';
  const rows = [
    ['h01','human','Paracetamol 650 mg','Pain & fever','15 tablets',30,35,'box','Paracetamol 650 mg','An everyday medicine cabinet essential in a clearly labelled tablet pack.','Read the pack label and consult a pharmacist. Human use only.',false],
    ['h02','human','Cetirizine 10 mg','Allergy care','10 tablets',29,35,'box','Cetirizine 10 mg','A compact allergy-care tablet pack for your household medicine cabinet.','Read the pack label. May cause drowsiness. Human use only.',false],
    ['h03','human','ORS Electrolyte Powder','Hydration','21.8 g sachet',25,29,'pouch','Oral rehydration salts','A single-serve oral rehydration salts sachet, easy to keep at home or carry.','Mix only as directed on the product label. Human use only.',false],
    ['h04','human','Vitamin C 500 mg','Vitamins','20 chewable tablets',159,189,'bottle','Vitamin C 500 mg','Chewable vitamin C in a convenient resealable bottle.','A supplement is not a substitute for a varied diet. Read the label.',false],
    ['h05','human','Vitamin D3 1000 IU','Vitamins','60 capsules',249,299,'bottle','Vitamin D3 1000 IU','A clearly labelled vitamin D3 supplement for an existing wellness routine.','Check suitability with a clinician, especially alongside other supplements.',false],
    ['h06','human','Calcium + D3','Vitamins','60 tablets',219,259,'bottle','Calcium and vitamin D3','A combined mineral and vitamin supplement in a monthly essentials format.','Check the final manufacturer label for composition and suitability.',false],
    ['h07','human','Daily Multivitamin','Vitamins','30 capsules',299,349,'bottle','Multivitamin supplement','A simple addition to a wellness routine when a supplement is appropriate.','Review the label and avoid duplicating vitamins across supplements.',false],
    ['h08','human','Antiseptic Solution','First aid','100 ml bottle',99,120,'bottle','Povidone-iodine solution','A topical antiseptic format for a prepared first-aid cupboard.','External use only. Follow the label and pharmacist advice.',false],
    ['h09','human','Digital Thermometer','Devices','1 device',199,249,'device','Digital temperature device','A digital thermometer with a clear display and a protective storage case.','Use and clean according to the included device instructions.',false],
    ['h10','human','Adhesive Bandages','First aid','25 assorted strips',79,99,'box','Assorted adhesive dressings','Assorted dressing strips for keeping a first-aid kit ready.','Use as directed. Seek professional care for serious or persistent wounds.',false],
    ['h11','human','Saline Nasal Spray','Everyday care','20 ml bottle',129,149,'spray','Sodium chloride 0.65%','A compact saline spray with an easy-to-carry bottle format.','Follow the label. Do not share a nozzle between people.',false],
    ['h12','human','Sterile Gauze Pads','First aid','10 pads',65,90,'box','Sterile gauze dressings','Individually packed gauze pads for a practical first-aid kit.','Check packaging integrity and use according to professional advice.',false],
    ['h13','human','Crepe Support Bandage','First aid','10 cm × 4 m',99,120,'box','Elastic support bandage','A reusable support bandage in a compact everyday first-aid format.','Follow fitting guidance. Do not wrap tightly or restrict circulation.',false],
    ['h14','human','Hand Sanitiser','Everyday care','100 ml bottle',69,85,'pump','Alcohol-based hand sanitiser, 70%','A travel-friendly hand hygiene bottle for your bag or desk.','External use only. Keep away from flames, children and pets.',false],
    ['h15','human','Home First-Aid Kit','First aid','1 essentials kit',499,599,'kit','Assorted first-aid supplies','An organised pouch for keeping basic dressings and care essentials together.','Illustrative contents. Check the final item list before purchase.',false],
    ['p01','pet','Dog Multivitamin Chews','Supplements','60 soft chews',399,499,'bottle','Dog multivitamin supplement','A dog-specific supplement format designed for a vet-approved care routine.','Dogs only. Check age, weight and suitability with your veterinarian.',false],
    ['p02','pet','Cat Multivitamin Chews','Supplements','30 soft chews',349,429,'bottle','Cat multivitamin supplement','A cat-specific supplement with a simple resealable pack.','Cats only. Check suitability with your veterinarian.',false],
    ['p03','pet','Pet Omega-3 Oil','Supplements','150 ml bottle',499,599,'pump','Pet omega-3 supplement','A measured-pump oil format for an existing veterinary wellness plan.','Use only a pet-specific product and follow veterinary guidance.',false],
    ['p04','pet','Dog Calcium Tablets','Supplements','60 tablets',299,349,'bottle','Canine calcium supplement','A clearly labelled dog supplement for a vet-approved dietary routine.','Dogs only. Do not add supplements without reviewing your pet’s diet.',false],
    ['p05','pet','Pet Probiotic Sachets','Digestive care','30 sachets',449,549,'box','Pet probiotic supplement','Convenient individual sachets for a veterinary care routine.','Confirm species, age and suitability with a veterinarian.',false],
    ['p06','pet','Dog Deworming Tablets','Vet medicines','4 tablets',179,219,'box','Formulation selected against a veterinarian’s prescription','A veterinary medicine request with species and weight-band checks before dispensing.','Dogs only. A vet prescription is required for this demo workflow.',true],
    ['p07','pet','Cat Deworming Tablets','Vet medicines','2 tablets',149,189,'box','Formulation selected against a veterinarian’s prescription','A cat-specific veterinary medicine request with a prescription review step.','Cats only. A vet prescription is required for this demo workflow.',true],
    ['p08','pet','Dog Flea & Tick Spot-On','Vet medicines','1 applicator',329,399,'box','Veterinary topical formulation, weight band to be confirmed','A dog-specific topical care request, checked against the prescribed product and weight band.','Dogs only. Do not use on cats. Veterinary review is required.',true],
    ['p09','pet','Cat Flea & Tick Spot-On','Vet medicines','1 applicator',299,379,'box','Feline veterinary topical formulation, weight band to be confirmed','A cat-specific topical care request with species and prescription checks.','Cats only. Never substitute a dog product. Veterinary review is required.',true],
    ['p10','pet','Gentle Pet Shampoo','Grooming','200 ml bottle',249,299,'bottle','Non-medicated pet grooming shampoo','A gentle-format grooming essential for a practical pet-care shelf.','For external pet grooming. Follow the label and avoid eyes.',false],
    ['p11','pet','Pet Ear Care Cleanser','Grooming','100 ml bottle',199,249,'spray','Non-medicated pet ear cleanser','An easy-to-store grooming cleanser for a vet-approved ear-care routine.','Check suitability with a vet. Do not use in painful or injured ears.',false],
    ['p12','pet','Pet Wound Care Spray','Vet medicines','100 ml bottle',249,299,'spray','Veterinary formulation to be confirmed during prescription review','A veterinary wound-care request with professional review before dispensing.','Veterinary review is required. Seek care for injuries instead of self-treating.',true],
    ['p13','pet','Paw Protection Balm','Grooming','50 g tin',179,229,'tin','Pet paw-care balm','A compact paw-care tin for a simple, label-led grooming routine.','External pet use only. Check the label and prevent excessive licking.',false],
    ['p14','pet','Dog Dental Chews','Dental care','7 chews',199,249,'pouch','Dog dental-care chews','A resealable pouch of dog-specific chews for an existing dental-care routine.','Dogs only. Choose a suitable size and supervise chewing.',false],
    ['p15','pet','Digital Pet Thermometer','Devices','1 device',249,299,'device','Pet-designated digital temperature device','A dedicated pet-care thermometer with a protective case.','Ask a veterinarian to demonstrate safe use. Do not share with human devices.',false]
  ];
  const photoById = { h01:'hero-blister-photo.png', h02:'hero-blister-photo.png', h04:'hero-bottle-photo.png', h05:'hero-bottle-photo.png', h06:'hero-bottle-photo.png', h07:'hero-bottle-photo.png' };
  const products = rows.map(([id,audience,name,category,pack,price,mrp,art,composition,description,caution,review],index) => ({
    id,audience,name,category,pack,price,mrp,art,composition,description,caution,review,
    image:`assets/healio/${photoById[id] || `${id}.svg`}`, brand: audience === 'human' ? 'Human care essentials' : 'Pet care essentials',
    comparisons: audience === 'human'
      ? [{store:'Apollo Pharmacy',price:price + 5 + index % 4 * 3},{store:'Tata 1mg',price:price + 3 + index % 5 * 2},{store:'Netmeds',price:price + 7 + index % 3 * 4}]
      : [{store:'Supertails',price:price + 15 + index % 4 * 5},{store:'HUFT',price:price + 20 + index % 3 * 7},{store:'Amazon Pets',price:price + 10 + index % 5 * 4}]
  }));
  const byId = Object.assign(Object.create(null),Object.fromEntries(products.map(product => [product.id,product])));
  function filterProducts(audience, query = '', category = 'All') {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter(product => product.audience === audience && (category === 'All' || product.category === category) && words.every(word => `${product.name} ${product.category} ${product.composition}`.toLowerCase().includes(word)));
  }
  function normaliseCart(input) {
    if (!Array.isArray(input)) return [];
    const counts = new Map();
    input.forEach(item => {
      if (item && typeof item.id === 'string' && byId[item.id] && Number.isInteger(item.quantity) && item.quantity > 0) counts.set(item.id,Math.min(20,(counts.get(item.id)||0)+item.quantity));
    });
    return [...counts].map(([id,quantity]) => ({id,quantity}));
  }
  function totals(cart) {
    const items = normaliseCart(cart);
    const subtotal = items.reduce((sum,item) => sum + byId[item.id].price * item.quantity,0);
    const mrp = items.reduce((sum,item) => sum + byId[item.id].mrp * item.quantity,0);
    const delivery = subtotal === 0 || subtotal >= 299 ? 0 : 39;
    return {subtotal,delivery,total:subtotal+delivery,savings:mrp-subtotal,count:items.reduce((sum,item)=>sum+item.quantity,0),review:items.some(item=>byId[item.id].review)};
  }
  const api = {products,byId,filterProducts,normaliseCart,totals};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HealioCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
