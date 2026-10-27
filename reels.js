/* Scroll-driven vertical reels. Native page scrolling stays in charge; images,
   typography and the chapter wheel follow its position with a short inertial settle. */
(function (environment) {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function reelPosition(top, height, viewportHeight, scrollY, count) {
    const raw = clamp((scrollY - top) / Math.max(1, height - viewportHeight), 0, 1) * (count - 1);
    const chapter = Math.floor(raw);
    if (chapter >= count - 1) return count - 1;
    // Hold each complete chapter briefly, then roll through the next one.
    const phase = clamp((raw - chapter - .16) / .68, 0, 1);
    return chapter + phase * phase * (3 - 2 * phase);
  }

  function followPosition(current, target, deltaMs) {
    if (Math.abs(target - current) < .0008) return target;
    return current + (target - current) * (1 - Math.exp(-clamp(deltaMs, 0, 64) / 90));
  }

  function panelPose(index, position) {
    const distance = index - position;
    return {
      offset: distance * 105,
      turn: clamp(distance, -1, 1) * -14,
      caption: distance * 55,
      visible: Math.abs(distance) < 1.08
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { reelPosition, followPosition, panelPose };
  if (!environment.document) return;
  const document = environment.document;
  const desktop = environment.matchMedia('(min-width: 981px)');
  const preference = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const groups = [
    ['#features', '.omni-feature-item', '.omni-features-left'],
    ['#behind', '.omni-behind-item', '.omni-behind-right']
  ].map(([selector, panelSelector, sideSelector]) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    return {
      element, panels: [...element.querySelectorAll(panelSelector)],
      track: element.querySelector('.chapter-number-track'),
      buttons: [...element.querySelectorAll('[data-reel-shift]')],
      status: element.querySelector('.reel-status'),
      side: element.querySelector(sideSelector),
      top: 0, height: 0, position: 0, current: -1
    };
  }).filter(Boolean);
  if (!groups.length) return;
  let enabled = false;
  let dirty = true;
  let snap = true;
  let pending = 0;
  let previousTime = 0;
  let viewportHeight = environment.innerHeight;

  function measure() {
    viewportHeight = environment.innerHeight;
    groups.forEach(group => {
      group.top = group.element.getBoundingClientRect().top + environment.scrollY;
      group.height = group.element.offsetHeight;
    });
    dirty = false;
  }

  function render(now) {
    pending = 0;
    if (document.hidden) return;
    if (dirty) measure();
    const dt = previousTime ? Math.min(64, now - previousTime) : 16.67;
    previousTime = now;
    let moving = false;
    groups.forEach(group => {
      if (!enabled) {
        if (!preference.matches) group.panels.forEach(panel => {
          const rect = panel.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < viewportHeight) {
            const phase = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);
            panel.style.setProperty('--mobile-caption-y', `${((1 - phase) * 35).toFixed(2)}px`);
          }
        });
        return;
      }
      const target = reelPosition(group.top, group.height, viewportHeight, environment.scrollY, group.panels.length);
      const old = group.position;
      group.position = snap ? target : followPosition(old, target, dt);
      moving ||= group.position !== target;
      const lag = clamp((group.position - old) * -80, -16, 16);
      group.panels.forEach((panel, index) => {
        const pose = panelPose(index, group.position);
        panel.style.setProperty('--panel-offset', `${pose.offset.toFixed(4)}%`);
        panel.style.setProperty('--panel-turn', `${pose.turn.toFixed(3)}deg`);
        panel.style.setProperty('--caption-slip', `${pose.caption.toFixed(3)}px`);
        panel.style.setProperty('--image-lag', `${lag.toFixed(3)}px`);
        panel.classList.toggle('reel-visible', pose.visible);
      });
      if (group.track) group.track.style.transform = `translateY(${-group.position}em)`;
      const chapter = Math.round(group.position);
      if (chapter !== group.current) {
        group.current = chapter;
        group.panels.forEach((panel, index) => panel.setAttribute('aria-hidden', String(index !== chapter)));
        group.buttons.forEach(button => {
          button.disabled = Number(button.dataset.reelShift) < 0 ? chapter === 0 : chapter === group.panels.length - 1;
        });
        if (group.status) {
          const title = group.panels[chapter].querySelector('h3')?.textContent.trim() || '';
          group.status.textContent = `Chapter ${chapter + 1} of ${group.panels.length}: ${title}`;
        }
      }
    });
    snap = false;
    if (moving) schedule();
  }

  function schedule() {
    if (!pending) pending = environment.requestAnimationFrame(render);
  }
  function refresh(instant = false) { dirty = true; snap ||= instant; schedule(); }

  function syncMode() {
    enabled = desktop.matches && !preference.matches;
    document.body.classList.toggle('reel-motion-active', enabled);
    document.body.classList.toggle('story-mobile-motion', !desktop.matches && !preference.matches);
    groups.forEach(group => {
      group.element.style.setProperty('--reel-count', group.panels.length);
      group.current = -1;
      group.panels.forEach(panel => {
        panel.removeAttribute('aria-hidden');
        panel.classList.remove('reel-visible');
        ['--panel-offset', '--panel-turn', '--caption-slip', '--image-lag', '--mobile-caption-y'].forEach(property => panel.style.removeProperty(property));
      });
      if (!enabled && group.track) group.track.style.transform = '';
    });
    refresh(true);
  }

  function goToChapter(group, chapter, smooth = true) {
    if (!enabled) return;
    if (dirty) measure();
    const next = clamp(chapter, 0, group.panels.length - 1);
    const top = group.top + next / Math.max(1, group.panels.length - 1) * (group.height - viewportHeight);
    environment.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
  }
  groups.forEach(group => group.buttons.forEach(button => {
    button.addEventListener('click', () => goToChapter(group, group.current + Number(button.dataset.reelShift)));
  }));

  // An absolutely positioned doctor panel shares its stage's layout top; route its
  // existing hash to the correct chapter, including direct and back/forward visits.
  function resolveDoctorHash(smooth = false) {
    if (environment.location.hash === '#doctors' && enabled) goToChapter(groups[0], 1, smooth);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href="#doctors"]');
    if (!link || !enabled || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (environment.location.hash !== '#doctors') environment.history.pushState(null, '', '#doctors');
    goToChapter(groups[0], 1);
  });
  environment.addEventListener('hashchange', () => resolveDoctorHash());
  environment.addEventListener('popstate', () => resolveDoctorHash());
  environment.addEventListener('scroll', schedule, { passive: true });
  environment.addEventListener('resize', () => refresh(true), { passive: true });
  environment.addEventListener('healio:intro-complete', () => refresh(true));
  environment.addEventListener('load', () => { refresh(true); resolveDoctorHash(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  if ('ResizeObserver' in environment) {
    const observer = new environment.ResizeObserver(() => refresh());
    groups.forEach(group => observer.observe(group.element));
  }
  desktop.addEventListener('change', syncMode);
  preference.addEventListener('change', syncMode);
  document.fonts?.ready.then(() => refresh(true));
  syncMode();
  resolveDoctorHash();
})(typeof window !== 'undefined' ? window : globalThis);
