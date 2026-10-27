(function (environment) {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (from, to, progress) => from + (to - from) * progress;

  function capsuleFrame(geometry, scrollY) {
    const { sourceX, sourceY, sourceWidth, heroTop, featuresTop, behindTop, behindBottom, dockX, viewportHeight, dockWidth } = geometry;
    const progress = clamp((scrollY - heroTop) / Math.max(1, featuresTop - heroTop));
    const width = mix(sourceWidth, dockWidth, progress);
    const x = mix(sourceX, dockX, progress);
    // Interpolate in document coordinates, then subtract scroll exactly once.
    // At featuresTop this equals viewportHeight / 2, so both handoffs coincide.
    const flightY = mix(sourceY, featuresTop + viewportHeight / 2, progress) - scrollY;
    const dockY = Math.min(viewportHeight / 2, behindBottom - scrollY - viewportHeight / 2);
    return {
      x, y: scrollY < featuresTop ? flightY : dockY,
      scale: width / sourceWidth,
      visible: scrollY < behindBottom,
      phase: scrollY < featuresTop ? 'hero' : scrollY < behindTop - viewportHeight ? 'features' : scrollY < behindTop ? 'transfer' : 'behind'
    };
  }

  function sequenceFrame(top, height, viewportHeight, scrollY, frameCount) {
    const progress = clamp((scrollY - top) / Math.max(1, height - viewportHeight));
    return Math.min(frameCount - 1, Math.floor(progress * frameCount));
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { capsuleFrame, sequenceFrame };
  if (!environment.document) return;

  const { document } = environment;
  const preference = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = environment.matchMedia('(min-width: 981px)');
  const hero = document.querySelector('.omni-hero');
  const source = document.querySelector('.omni-paddle-img');
  const features = document.querySelector('.omni-features-section');
  const featuresLeft = document.querySelector('.omni-features-left');
  const behind = document.querySelector('.omni-behind-section');
  const gallery = document.querySelector('.omni-image-gallery');
  const sequence = document.getElementById('omni-court-sequence');
  const frames = [...document.querySelectorAll('.care-sequence-frame')];
  const indicators = [...document.querySelectorAll('.sequence-progress span')];
  const flight = source?.cloneNode(false);
  let geometry = null;
  let dirty = true;
  let pendingFrame = 0;
  let activeStep = -1;

  if (flight) {
    flight.removeAttribute('id');
    flight.removeAttribute('fetchpriority');
    flight.className = 'capsule-flight';
    flight.alt = '';
    flight.setAttribute('aria-hidden', 'true');
    flight.hidden = true;
    document.body.appendChild(flight);
  }

  function measure() {
    dirty = false;
    if (!hero || !source || !features || !featuresLeft || !behind || !flight) return;
    const scrollY = environment.scrollY;
    const sourceRect = source.getBoundingClientRect();
    const featureRect = features.getBoundingClientRect();
    const behindRect = behind.getBoundingClientRect();
    geometry = {
      sourceX: sourceRect.left + sourceRect.width / 2,
      sourceY: sourceRect.top + scrollY + sourceRect.height / 2,
      sourceWidth: sourceRect.width,
      sourceHeight: sourceRect.height,
      heroTop: hero.getBoundingClientRect().top + scrollY,
      featuresTop: featureRect.top + scrollY,
      behindTop: behindRect.top + scrollY,
      behindBottom: behindRect.bottom + scrollY,
      dockX: featuresLeft.getBoundingClientRect().right,
      dockWidth: 150,
      viewportHeight: environment.innerHeight,
      sequenceTop: sequence ? sequence.getBoundingClientRect().top + scrollY : 0,
      sequenceHeight: sequence?.offsetHeight || 0
    };
    flight.style.width = `${geometry.sourceWidth}px`;
    flight.style.height = `${geometry.sourceHeight}px`;
  }

  function render() {
    pendingFrame = 0;
    if (dirty) measure();
    const moving = desktop.matches && !preference.matches && geometry?.sourceWidth > 0;
    document.body.classList.toggle('capsule-motion-active', Boolean(moving));
    document.body.classList.toggle('story-motion-active', !preference.matches);
    if (flight) {
      flight.hidden = !moving;
      if (moving) {
        const state = capsuleFrame(geometry, environment.scrollY);
        flight.style.visibility = state.visible ? 'visible' : 'hidden';
        flight.dataset.phase = state.phase;
        flight.style.transform = `translate3d(${state.x - geometry.sourceWidth / 2}px, ${state.y - geometry.sourceHeight / 2}px, 0) scale(${state.scale})`;
      }
    }
    if (gallery) gallery.classList.toggle('gallery-in-view', preference.matches || gallery.getBoundingClientRect().top < environment.innerHeight * .75);
    if (frames.length && geometry) {
      const step = sequenceFrame(geometry.sequenceTop, geometry.sequenceHeight, environment.innerHeight, environment.scrollY, frames.length);
      if (step !== activeStep || dirtyPreference) {
        activeStep = step;
        dirtyPreference = false;
        frames.forEach((frame, index) => {
          const active = index === step;
          frame.classList.toggle('is-active', active);
          frame.setAttribute('aria-hidden', String(!preference.matches && !active));
          indicators[index]?.classList.toggle('is-active', index <= step);
        });
      }
    }
  }

  function schedule() {
    if (!pendingFrame) pendingFrame = environment.requestAnimationFrame(render);
  }
  function refresh() { dirty = true; schedule(); }
  let dirtyPreference = true;
  preference.addEventListener('change', () => { dirtyPreference = true; refresh(); });
  desktop.addEventListener('change', refresh);
  environment.addEventListener('scroll', schedule, { passive: true });
  environment.addEventListener('resize', refresh, { passive: true });
  environment.addEventListener('load', refresh);
  environment.addEventListener('pageshow', refresh);
  environment.addEventListener('healio:intro-complete', refresh);
  document.addEventListener('load', event => { if (event.target.tagName === 'IMG') refresh(); }, true);
  if ('ResizeObserver' in environment) {
    const resize = new environment.ResizeObserver(refresh);
    [hero, features, behind, sequence].filter(Boolean).forEach(element => resize.observe(element));
  }
  document.fonts?.ready.then(refresh);
  schedule();

  const banner = document.querySelector('.omni-banner-scroll');
  const pause = banner?.querySelector('.omni-banner-pause-btn');
  pause?.addEventListener('click', () => {
    const paused = banner.classList.toggle('paused');
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Play scrolling banner' : 'Pause scrolling banner');
    pause.textContent = paused ? '▶' : '❚❚';
  });
  const year = document.getElementById('current-year');
  if (year) year.textContent = new Date().getFullYear();
})(typeof window !== 'undefined' ? window : globalThis);
