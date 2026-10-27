/* A short, skippable opening and lightweight atmosphere. No dependencies. */
(function (environment) {
  'use strict';
  const document = environment.document;
  if (!document) return;
  const intro = document.getElementById('healio-intro');
  const skip = document.getElementById('intro-skip');
  const replayButtons = document.querySelectorAll('[data-intro-replay], #intro-replay');
  const hero = document.querySelector('.omni-hero');
  const heading = document.querySelector('.omni-title-group');
  const fill = document.getElementById('reading-progress-fill');
  const preference = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = environment.matchMedia('(hover: hover) and (pointer: fine)');
  const sessionKey = 'healio-opening-v3';
  const lockedElements = new Map();
  let automaticEnd = 0;
  let exitEnd = 0;
  let failsafe = 0;
  let open = false;
  let leaving = false;
  let heroVisible = true;
  let progressFrame = 0;
  let pointerFrame = 0;
  let pointerPosition = null;
  let scrollRange = 1;

  function markEntered() {
    document.body.classList.add('experience-entered');
  }

  function complete() {
    if (!open) return;
    environment.clearTimeout(automaticEnd);
    environment.clearTimeout(exitEnd);
    environment.clearTimeout(failsafe);
    open = false;
    leaving = false;
    intro.hidden = true;
    intro.classList.remove('is-playing', 'is-leaving');
    document.body.classList.remove('intro-playing', 'intro-leaving');
    lockedElements.forEach((wasInert, element) => { element.inert = wasInert; });
    lockedElements.clear();
    markEntered();
    const entryHeading = environment.matchMedia('(max-width: 800px)').matches ? (document.getElementById('mobile-home-title') || heading) : heading;
    if (entryHeading) {
      entryHeading.tabIndex = -1;
      entryHeading.focus({ preventScroll: true });
    }
    environment.dispatchEvent(new environment.Event('healio:intro-complete'));
  }

  function leave(immediate = false) {
    if (!open) return;
    if (immediate || preference.matches) { complete(); return; }
    if (leaving) return;
    leaving = true;
    environment.clearTimeout(automaticEnd);
    document.body.classList.add('intro-leaving');
    markEntered();
    intro.classList.add('is-leaving');
    exitEnd = environment.setTimeout(complete, 720);
  }

  function play(isReplay = false) {
    if (!intro || open) return;
    if (isReplay) environment.scrollTo({ top: 0, behavior: 'instant' });
    open = true;
    leaving = false;
    // Arm the escape route before changing page state. Asset downloads never gate exit.
    failsafe = environment.setTimeout(() => leave(true), 4300);
    automaticEnd = environment.setTimeout(() => leave(), preference.matches ? 1400 : 3000);
    try { environment.sessionStorage.setItem(sessionKey, 'seen'); } catch (_) { /* Private/file browsing can disable storage. */ }
    document.body.classList.remove('experience-entered');
    document.body.classList.add('intro-playing');
    [...document.body.children].forEach(element => {
      if (element === intro || ['SCRIPT', 'LINK', 'STYLE'].includes(element.tagName)) return;
      lockedElements.set(element, element.inert);
      element.inert = true;
    });
    intro.hidden = false;
    intro.classList.remove('is-leaving');
    intro.classList.add('is-playing');
    skip?.focus({ preventScroll: true });
  }

  skip?.addEventListener('click', () => leave(true));
  replayButtons.forEach(button => button.addEventListener('click', () => play(true)));
  intro?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); leave(true); }
    if (event.key === 'Tab') { event.preventDefault(); skip?.focus({ preventScroll: true }); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && open) leave(true);
    updateAtmosphere();
  });
  preference.addEventListener('change', () => {
    if (preference.matches && open) leave(true);
    updateAtmosphere();
    scheduleProgress();
  });
  environment.addEventListener('pagehide', () => { if (open) complete(); });

  function updateAtmosphere() {
    document.body.classList.toggle('hero-effects-visible', heroVisible && !document.hidden && !preference.matches);
  }
  if (hero && 'IntersectionObserver' in environment) {
    const observer = new environment.IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      updateAtmosphere();
    });
    observer.observe(hero);
  }
  updateAtmosphere();

  function paintPointer() {
    pointerFrame = 0;
    if (!hero || !pointerPosition || preference.matches || !heroVisible) return;
    const rect = hero.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, (pointerPosition.x - rect.left) / Math.max(1, rect.width) * 100));
    const y = Math.max(0, Math.min(100, (pointerPosition.y - rect.top) / Math.max(1, rect.height) * 100));
    hero.style.setProperty('--mesh-x', `${((x - 50) * .2).toFixed(1)}px`);
    hero.style.setProperty('--mesh-y', `${((y - 50) * .2).toFixed(1)}px`);
  }
  hero?.addEventListener('pointermove', event => {
    if (!pointer.matches || preference.matches || document.hidden) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (!pointerFrame) pointerFrame = environment.requestAnimationFrame(paintPointer);
  }, { passive: true });
  hero?.addEventListener('pointerleave', () => {
    pointerPosition = null;
    hero.style.removeProperty('--mesh-x');
    hero.style.removeProperty('--mesh-y');
  });

  function paintProgress() {
    progressFrame = 0;
    if (!fill || preference.matches) return;
    const progress = Math.max(0, Math.min(1, environment.scrollY / scrollRange));
    fill.style.transform = `scaleX(${progress})`;
  }
  function scheduleProgress() {
    if (!progressFrame && !preference.matches) progressFrame = environment.requestAnimationFrame(paintProgress);
  }
  function measureProgress() {
    scrollRange = Math.max(1, document.documentElement.scrollHeight - environment.innerHeight);
    scheduleProgress();
  }
  environment.addEventListener('scroll', scheduleProgress, { passive: true });
  environment.addEventListener('resize', measureProgress, { passive: true });
  environment.addEventListener('load', measureProgress);
  environment.addEventListener('pageshow', measureProgress);
  if ('ResizeObserver' in environment) new environment.ResizeObserver(measureProgress).observe(document.body);
  measureProgress();

  let seen = false;
  try { seen = environment.sessionStorage.getItem(sessionKey) === 'seen'; } catch (_) { /* Continue without persistence. */ }
  document.body.classList.add('experience-ready');
  if (intro && !seen && !preference.matches && !environment.location.hash && environment.scrollY < 100) play();
  else markEntered();
})(typeof window !== 'undefined' ? window : globalThis);
