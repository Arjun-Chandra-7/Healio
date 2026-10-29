'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 992px)');
  const clamp = n => Math.max(0, Math.min(1, n));
  // Text effects are optional; browsers without Segmenter still get a working page.
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const graphemes = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);
  const resizeTasks = [];
  const scrollTasks = [];
  let scrollPending = false;
  function updateScroll() {
    document.body.dataset.scrollingStarted = String(scrollY > 50);
    scrollTasks.forEach(task => task());
    scrollPending = false;
  }
  addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  addEventListener('resize', () => {
    document.documentElement.style.setProperty('--vw', `${document.body.clientWidth / 100}px`);
    resizeTasks.forEach(task => task());
    updateScroll();
  });
  document.documentElement.style.setProperty('--vw', `${document.body.clientWidth / 100}px`);

  // The original buttons split characters for their small elastic hover ripple.
  const buttonTextMedia = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
  $$('[data-button],[data-button-alt]').forEach(button => {
    const text = $('[data-button-text],[data-button-alt-text]', button);
    if (!text || button.hasAttribute('data-cart-label')) return;
    const label = text.textContent;
    let animations = [];
    const setup = () => {
      animations.forEach(animation => animation.cancel());
      text.textContent = label;
      if (!buttonTextMedia.matches) return;
      text.setAttribute('aria-label', label);
      text.replaceChildren(...graphemes(label).map(character => {
        if (/\s/.test(character)) return document.createTextNode(character);
        const span = document.createElement('span');
        span.className = 'split-char'; span.textContent = character;
        span.setAttribute('aria-hidden', 'true');
        return span;
      }));
    };
    const play = () => {
      if (!buttonTextMedia.matches) return;
      animations.forEach(animation => animation.cancel());
      const characters = $$('.split-char', text);
      animations = characters.map((span, i) => span.animate([
        { transform:'translateY(0) scaleY(1) rotate(0)', offset:0 },
        { transform:'translateY(55%) scaleY(.3) rotate(17deg)', offset:.2 },
        { transform:'translateY(-4%) scaleY(1.04) rotate(-1deg)', offset:.7 },
        { transform:'translateY(0) scaleY(1) rotate(0)', offset:1 }
      ], {duration:725,delay:225*i/Math.max(1,characters.length-1),easing:'ease-out'}));
    };
    button.addEventListener('pointerenter', play);
    button.addEventListener('focusin', play);
    button.addEventListener('pointerleave', () => animations.forEach(animation => animation.cancel()));
    buttonTextMedia.addEventListener('change', setup);
    setup();
  });

  // Source typography uses individually composited words and handwriting characters.
  $$('[data-hero-title],[data-hero-handwritten-text],[data-handwritten-text-inview],[data-box-sequence-handwritten-text],[data-box-sequence-text-final]').forEach(text => {
    const label = text.textContent;
    const handwritten = !text.hasAttribute('data-hero-title');
    text.setAttribute('aria-label', label);
    text.replaceChildren(...label.split(/(\s+)/).filter(Boolean).map(word => {
      if (/^\s+$/.test(word)) return document.createTextNode(word);
      const span = document.createElement('span');
      span.className = 'split-word'; span.setAttribute('aria-hidden', 'true');
      if (handwritten) span.replaceChildren(...graphemes(word).map(character => {
        const char = document.createElement('span'); char.className = 'split-char'; char.textContent = character; return char;
      })); else span.textContent = word;
      return span;
    }));
  });

  // The drawer uses the original clipping transition, with native focus management.
  const menu = $('[data-menu]');
  const opener = $('[data-menu-toggle]');
  const closer = $('[data-menu-close]');
  menu.id = 'mobile-navigation';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Navigation');
  menu.setAttribute('aria-modal', 'true');
  opener.setAttribute('aria-controls', menu.id);
  opener.setAttribute('aria-expanded', 'false');
  menu.inert = true;
  function setMenu(open) {
    menu.inert = !open;
    menu.classList.toggle('is--active', open);
    document.documentElement.classList.toggle('has--menu-open', open);
    opener.setAttribute('aria-expanded', String(open));
    if (open) closer.focus(); else opener.focus();
  }
  opener.addEventListener('click', () => setMenu(true));
  closer.addEventListener('click', () => setMenu(false));
  $('.menu__backdrop', menu)?.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', event => {
    if (!menu.classList.contains('is--active')) return;
    if (event.key === 'Escape') setMenu(false);
    if (event.key === 'Tab') {
      const controls = $$('a[href],button', menu).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // Independent native disclosures retain the observed 450 ms expand/collapse.
  $$('[data-accordion]').forEach((details, index) => {
    const summary = $('summary', details), content = $('[data-accordion-content]', details);
    content.id = `faq-answer-${index + 1}`;
    summary.setAttribute('aria-controls', content.id);
    summary.setAttribute('aria-expanded', String(details.open));
    let animation;
    summary.addEventListener('click', event => {
      event.preventDefault();
      animation?.cancel();
      const opening = !details.classList.contains('is--active');
      const from = details.offsetHeight;
      details.open = true;
      details.classList.toggle('is--active', opening);
      summary.setAttribute('aria-expanded', String(opening));
      const to = summary.offsetHeight + (opening ? content.offsetHeight : 0);
      details.style.overflow = 'clip';
      animation = details.animate({ height: [`${from}px`, `${to}px`] }, {
        duration: motion.matches ? 0 : 450, easing: 'cubic-bezier(.32,.72,0,1)'
      });
      animation.onfinish = () => { details.open = opening; details.style.overflow = ''; };
    });
  });

  // Native overflow scrolling provides touch, trackpad, arrow, and mouse-drag operation.
  $$('[data-books-slider]').forEach(slider => {
    const track = $('[data-books-slider-wrapper]', slider);
    const previous = $('.is--previous', slider), next = $('.is--next', slider);
    if (!track) return;
    track.tabIndex = 0;
    track.setAttribute('aria-label', slider.classList.contains('choice-slider') ? 'Tree rewards and milestones' : 'Human and pet care essentials');
    const items = $$('[data-books-slider-item]', track);
    const update = () => {
      const bounds = track.getBoundingClientRect();
      items.forEach((item, index) => {
        if (!desktop.matches || motion.matches) { item.style.transform = ''; return; }
        const direction = index % 2 === 0 ? -1 : 1;
        const rect = item.parentElement.getBoundingClientRect();
        const normal = (rect.left + rect.width / 2 - bounds.left - bounds.width / 2) / (bounds.width / 2);
        const strength = Math.sin(Math.max(-2, Math.min(2, normal)) * 1.2);
        item.style.setProperty('--book-slider-item-rotate', `${-2.2 * direction}deg`);
        item.style.transform = `translateY(${strength * 6 * direction}%) rotate(${strength * 2.2 * direction}deg)`;
      });
      if (previous) { previous.disabled = track.scrollLeft < 2; previous.classList.toggle('is--disabled', previous.disabled); }
      if (next) { next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2; next.classList.toggle('is--disabled', next.disabled); }
    };
    const move = direction => track.scrollBy({ left: direction * (track.firstElementChild?.getBoundingClientRect().width || 300), behavior: motion.matches ? 'instant' : 'smooth' });
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    track.addEventListener('scroll', update, { passive: true });
    let drag;
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      drag = { x: event.clientX, left: track.scrollLeft, moved: false };
    });
    addEventListener('pointermove', event => {
      if (!drag) return;
      if (Math.abs(event.clientX - drag.x) > 5) { drag.moved = true; track.classList.add('is-dragging'); }
      if (drag.moved) track.scrollLeft = drag.left + drag.x - event.clientX;
    });
    track.addEventListener('click', event => { if (drag?.moved) { event.preventDefault(); event.stopPropagation(); } }, true);
    addEventListener('pointerup', () => { track.classList.remove('is-dragging'); setTimeout(() => { drag = null; }, 0); });
    track.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
    });
    resizeTasks.push(update);
    update();
  });
  // The live exclusive contains one item; its unused arrows are hidden there too.
  const exclusive = $('.exclusive');
  if ($$('.exclusive-slider__list-item', exclusive).length <= 1) $('[data-books-slider-controls]', exclusive)?.setAttribute('hidden', '');

  $$('[data-pop-up]').forEach(popup => {
    const button = $('[data-pop-up-button]', popup);
    let locked = false;
    const set = open => { popup.classList.toggle('is--open', open); button.setAttribute('aria-expanded', String(open)); };
    button.setAttribute('aria-expanded', 'false');
    popup.addEventListener('pointerenter', () => set(true));
    popup.addEventListener('pointerleave', () => { if (!locked) set(false); });
    button.addEventListener('click', () => { locked = !locked; set(locked); });
    popup.addEventListener('keydown', event => { if (event.key === 'Escape') { locked = false; set(false); } });
    popup.addEventListener('focusin', () => set(true));
    popup.addEventListener('focusout', event => { if (!popup.contains(event.relatedTarget) && !locked) set(false); });
  });
  $$('[data-check-contrast]').forEach(card => {
    const rgb = getComputedStyle($('[data-check-contrast-bg]', card)).backgroundColor.match(/\d+/g).map(Number);
    const light = (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114) > 127.5;
    $$('[data-check-contrast-text]', card).forEach(text => { text.style.color = light ? '#000' : '#fff'; });
  });

  const genre = $('[data-genre-interaction]');
  const genreList = $('[data-genre-interaction-list]', genre);
  const scope = $('[data-genre-interaction-scope]', genre);
  const genres = $$('[data-genre-interaction-item]', genre);
  function activateGenre(item, index) {
    const first = genres[0].getBoundingClientRect(), rect = item.getBoundingClientRect();
    genre.style.setProperty('--start-index', '0');
    genre.style.setProperty('--start-width', first.width);
    scope.style.setProperty('--active-index', index);
    scope.style.setProperty('--active-offset', rect.width - first.width);
    genre.dataset.startSet = 'true';
    $$('[data-genre-interaction-box]', genre).forEach((box, i) => {
      box.style.setProperty('--x', (i % 2 ? 6 : -6));
      box.style.setProperty('--y', (i % 2 ? -5 : 5));
      box.style.setProperty('--r', (i % 2 ? 8 : -8));
      $$('.genre__img', box).forEach((image, n) => { image.classList.toggle('keyboard-active', n === index); });
    });
  }
  genres.forEach((item, index) => {
    item.tabIndex = 0;
    item.addEventListener('pointerenter', () => activateGenre(item, index));
    item.addEventListener('focus', () => activateGenre(item, index));
  });
  genreList.addEventListener('pointermove', event => {
    const rect = genreList.getBoundingClientRect();
    $$('[data-genre-interaction-box]', genre).forEach(box => {
      box.style.setProperty('--px', (event.clientX - rect.left) / rect.width - .75);
      box.style.setProperty('--py', (event.clientY - rect.top) / rect.height - .75);
    });
  });

  // Healio's delivery bag follows the same sticky scroll composition.
  const wrap = $('[data-box-sequence]');
  const bagArt = $('[data-care-sequence-art]');
  function updateCareBag() {
    const rect = wrap.getBoundingClientRect();
    const progress = clamp((innerHeight * .85 - rect.top) / (rect.height + innerHeight * .05));
    bagArt.style.transform = motion.matches ? 'none' : `translateY(${(1 - clamp(progress / .25)) * -20}%) rotate(${(1 - progress) * -16}deg) scale(${.8 + progress * .2})`;
    wrap.classList.toggle('box-middle', progress >= .25 && progress < .65);
    wrap.classList.toggle('box-final', progress >= .72);
  }
  scrollTasks.push(updateCareBag);
  // Curve position follows scroll; font size is converted from CSS pixels to SVG units.
  const gift = $('[data-tagline-curve]');
  const curve = $('[data-tagline-curve-svg]', gift), curveText = $('[data-tagline-curve-text]', gift);
  const textPath = $('textPath', curve), path = $('path', curve);
  const textMeasure = document.createElement('canvas').getContext('2d');
  function updateCurve() {
    const textSize = parseFloat(getComputedStyle($('[data-tagline-curve-reference]', gift)).fontSize);
    curveText.setAttribute('font-size', textSize / (curve.getBoundingClientRect().width / curve.viewBox.baseVal.width));
    const rect = gift.getBoundingClientRect();
    const progress = clamp((innerHeight - rect.top + rect.height * .4) / (innerHeight + rect.height));
    const context = textMeasure;
    context.font = getComputedStyle(textPath).font;
    const end = -(context.measureText(textPath.textContent).width * 1.25 * 100 / path.getTotalLength());
    textPath.setAttribute('startOffset', `${100 + (end - 100) * progress}%`);
  }
  scrollTasks.push(updateCurve); resizeTasks.push(updateCurve);
  const footer = $('footer.footer');
  scrollTasks.push(() => {
    if (!desktop.matches || motion.matches) return;
    const total = document.documentElement.scrollHeight - innerHeight;
    const progress = clamp((scrollY - Math.max(0, footer.offsetTop - innerHeight)) / Math.max(1, total - Math.max(0, footer.offsetTop - innerHeight)));
    $$('[data-footer-parallax-top],[data-footer-parallax-bottom]', footer).forEach(el => { el.style.transform = `translateY(${-12.5 * (1 - progress)}em)`; });
    $('[data-footer-parallax-overlay]', footer).style.opacity = .55 * (1 - progress);
  });

  // Viewport-triggered effects run once, while backgrounds pause off screen.
  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    if (!motion.matches) entry.target.classList.add('native-reveal');
    reveal.unobserve(entry.target);
  }), { threshold: .2 });
  $$('[data-benefits-item],[data-gift-item]').forEach(el => reveal.observe(el));
  $$('[data-background-animation]').forEach(svg => {
    const animations = $$('path', svg).map(path => path.animate({ strokeWidth: [0, svg.hasAttribute('data-background-animation-small') ? 35 : 60, 0] }, { duration: 6000, iterations: Infinity, easing: 'ease-in-out' }));
    animations.forEach(animation => animation.pause());
    new IntersectionObserver(entries => entries.forEach(entry => animations.forEach(animation => entry.isIntersecting && !motion.matches ? animation.play() : animation.pause()))).observe(svg);
  });
  // The reference briefly sends its own party/trophy artwork up through the winners.
  const choice = $('[data-emoji-rain]');
  let celebrating = false;
  new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting || motion.matches || celebrating) return;
    celebrating = true;
    const container = $('[data-emoji-rain-container]', choice);
    for (let i = 0; i < 40; i++) {
      const decoration = document.createElement('div');
      decoration.className = 'choice__single-rain-emoji is--append';
      decoration.setAttribute('aria-hidden', 'true');
      decoration.style.left = `${Math.round(Math.random() * 10) * 10}%`;
      const image = document.createElement('div');
      image.className = `choice__single-rain-emoji-image-${i % 2 ? 'party' : 'trophy'}`;
      decoration.append(image); container.append(decoration);
      const scale = .4 + Math.random() * .7;
      const animation = decoration.animate({transform:[`translate(-50%,${container.offsetHeight}px) scale(${scale}) rotate(-15deg)`,`translate(-50%,-110%) scale(${scale}) rotate(15deg)`]}, {duration:800+Math.random()*1000,delay:Math.random()*1250,easing:'ease-in',fill:'both'});
      animation.onfinish = () => decoration.remove();
    }
    setTimeout(() => { celebrating = false; }, 2800);
  }), {threshold:.05}).observe(choice);

  $$('a[target="_blank"]').forEach(link => { link.rel = 'noopener noreferrer'; });
  // Content is visible in HTML, independent of font loading and animation setup.
  document.documentElement.classList.add('is-ready');
  updateScroll();
  document.fonts?.ready.then(() => {
    resizeTasks.forEach(task => task());
    updateScroll();
  });
})();
