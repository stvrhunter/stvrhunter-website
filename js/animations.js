/* ==========================================================================
   STVRHUNTER — GSAP animations
   --------------------------------------------------------------------------
   GSAP core + plugins are loaded as classic <script> tags in index.html, so
   they are available on the global scope here (`gsap`, `ScrollTrigger`, …).

   GSAP is 100% free as of 2025 (incl. all former "Club" plugins like SplitText
   and MorphSVG). To add another plugin, drop its CDN <script> tag next to the
   ScrollTrigger one in index.html, then gsap.registerPlugin(ThePlugin).

   This file loads at the end of <body>, so the DOM is already parsed when it
   runs. That matters: the initial "hidden" states below are set synchronously,
   before the first paint, so nothing flashes in and then animates.

   Docs: https://gsap.com/docs/v3/
   ========================================================================== */

(function () {
  'use strict';

  if (typeof gsap === 'undefined') {
    console.warn('[animations] GSAP not loaded — check the CDN <script> tags.');
    return;
  }

  // Register whichever plugins made it onto the page.
  const plugins = [];
  if (typeof ScrollTrigger !== 'undefined') plugins.push(ScrollTrigger);
  if (typeof ScrollSmoother !== 'undefined') plugins.push(ScrollSmoother);
  if (typeof ScrollToPlugin !== 'undefined') plugins.push(ScrollToPlugin);
  if (typeof SplitText !== 'undefined') plugins.push(SplitText);
  if (typeof Flip !== 'undefined') plugins.push(Flip);
  if (typeof DrawSVGPlugin !== 'undefined') plugins.push(DrawSVGPlugin);
  if (plugins.length) gsap.registerPlugin.apply(gsap, plugins);

  const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
  const hasSplitText = typeof SplitText !== 'undefined';
  const hasDrawSVG = typeof DrawSVGPlugin !== 'undefined';

  /* ========================================================================
     REVEAL MODE — flip this one line to switch every animation below the hero
     ========================================================================
       'scrub' : progress is tied to scroll position. Scroll up and the
                 animation runs backwards. Nothing ever finishes and latches.
       'once'  : each animation plays through at its own pace the first time
                 it comes into view, then stays done.

     Everything else adapts automatically — see revealTrigger() and playEase()
     below. The hero entrance is unaffected either way; it always plays once,
     on load.
     ======================================================================== */

  const REVEAL_MODE = 'scrub'; // <-- 'scrub' or 'once'

  const isScrub = REVEAL_MODE === 'scrub';

  if (hasScrollTrigger) {
    // Mobile browsers fire resize when the address bar hides/shows; refreshing
    // on that causes jumps. Ignore it.
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ------------------------------------------------------------------------
     Hero entrance
     ------------------------------------------------------------------------
     Two separate reveals on purpose:

     1. The chrome (brand, nav, showreel, intro copy) comes in as soon as the
        webfonts are measured — a few hundred ms, usually zero on a repeat
        visit. It must not wait on the 5MB GLB.
     2. The 3D portrait fades in on its own, whenever the model actually
        lands.

     Elements that carry a CSS transform (e.g. .hero__reel-label is centred
     with translateX(-50%)) are faded only — never moved — because GSAP
     rewrites the whole transform to pixels and would break the centring on
     resize. Everything else is free to move.
     ---------------------------------------------------------------------- */

  const hero = {
    brand:    document.querySelector('.header__brand'),
    navLinks: gsap.utils.toArray('.nav__link'),
    burger:   document.querySelector('.burger'),
    canvas:   document.querySelector('#hero-3d'), // inner canvas; wrapper owns the centring transform
    reel:     document.querySelector('.hero__reel'),
    label:    document.querySelector('.hero__reel-label'), // fade only (translateX)
    intro:    document.querySelector('.hero__intro'),
  };

  // Everything the intro touches, for the reduced-motion reset.
  const heroAll = [
    hero.brand, hero.burger, hero.canvas, hero.reel, hero.label, hero.intro,
  ].concat(hero.navLinks).filter(Boolean);

  // Hidden starting states — synchronous, so they land before the first paint.
  function setIntroStart() {
    if (hero.brand) gsap.set(hero.brand, { autoAlpha: 0, y: -18 });
    if (hero.navLinks.length) gsap.set(hero.navLinks, { autoAlpha: 0, y: -14 });
    if (hero.burger) gsap.set(hero.burger, { autoAlpha: 0, y: -14 });
    if (hero.canvas) gsap.set(hero.canvas, { autoAlpha: 0, scale: 0.94 });
    if (hero.reel) gsap.set(hero.reel, { autoAlpha: 0, y: 28 });
    if (hero.label) gsap.set(hero.label, { autoAlpha: 0 });
    if (hero.intro) gsap.set(hero.intro, { autoAlpha: 0, y: 18 });
  }

  // The portrait leads; the chrome follows a beat later. Each block gets its own
  // ease so the entrance doesn't read as one uniform slide: the model settles
  // (power2), the chrome snaps (power3), the showreel overshoots slightly
  // (back), and the monospace lines type themselves out.
  function playIntro() {
    const master = gsap.timeline();

    if (hero.canvas) {
      master.to(hero.canvas, {
        autoAlpha: 1,
        scale: 1,
        duration: 1.2,
        ease: 'power2.out',
      }, 0);
    }

    const chrome = gsap.timeline({ defaults: { duration: 0.7, ease: 'power3.out' } });
    if (hero.brand) chrome.to(hero.brand, { autoAlpha: 1, y: 0 });
    if (hero.navLinks.length) chrome.to(hero.navLinks, { autoAlpha: 1, y: 0, stagger: 0.06 }, '-=0.5');
    if (hero.burger) chrome.to(hero.burger, { autoAlpha: 1, y: 0 }, '<');
    if (hero.reel) {
      chrome.to(hero.reel, {
        autoAlpha: 1,
        y: 0,
        duration: 0.9,
        ease: 'back.out(1.4)',
      }, '-=0.45');
    }

    // Containers appear instantly — their characters do the visible work.
    if (hero.intro) chrome.set(hero.intro, { autoAlpha: 1, y: 0 }, '-=0.3');
    if (hero.label) chrome.set(hero.label, { autoAlpha: 1 }, '<');
    // Still one line at a time, but the scroll cue now starts before the bio
    // has quite finished ('>' is the end of the previous tween, so '>-=0.35'
    // overlaps by 0.35s). Enough overlap to kill the dead air, not enough to
    // read as both typing at once.
    chrome.add(typeLine(hero.intro && hero.intro.querySelector('.hero__intro-body'), 0.012), '>');
    chrome.add(typeLine(hero.label, 0.015), '>-=0.35');

    // 0.35s after the model starts resolving, so the portrait clearly leads.
    master.add(chrome, 0.35);

    return master;
  }

  /* ------------------------------------------------------------------------
     Typewriter
     ------------------------------------------------------------------------
     SplitText chars revealed one at a time, rather than GSAP's TextPlugin,
     because these lines contain markup (a <br> in the intro) that a
     text-rewriting tween would flatten. No caret — the characters landing is
     the whole effect.
     ---------------------------------------------------------------------- */

  function typeLine(el, charDuration) {
    if (!el || !hasSplitText) return gsap.timeline(); // no-op placeholder

    const split = SplitText.create(el, { type: 'chars', aria: 'auto' });
    gsap.set(split.chars, { autoAlpha: 0 });

    return gsap.timeline().to(split.chars, {
      autoAlpha: 1,
      duration: 0.01,
      ease: 'none',
      stagger: charDuration,
    });
  }

  /* ------------------------------------------------------------------------
     Ready gates — each capped, so a slow or failed asset can never strand an
     element in its hidden state.
     ---------------------------------------------------------------------- */

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
  }

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  // The GLB. Fires on load success and on load failure alike (see
  // js/three-scene.js).
  const modelReady = new Promise((resolve) => {
    const el = hero.canvas;
    if (!el) return resolve();
    if (el.getAttribute('data-loaded') === 'true') return resolve();
    window.addEventListener('hero:model-ready', resolve, { once: true });
  });

  // The model leads the entrance, so the whole hero waits on it — but only up
  // to a point. Past the cap the intro runs anyway and the portrait fades in
  // whenever it arrives, rather than leaving the page blank on a slow link.
  const introReady = withTimeout(Promise.all([fontsReady, modelReady]), 2500);

  /* ------------------------------------------------------------------------
     Reveal plumbing — the two modes
     ------------------------------------------------------------------------
     In 'scrub' mode, `scrub: 1` gives the timeline a 1s catch-up rather than
     welding it to the scrollbar; without it, character-level text looks
     twitchy. `invalidateOnRefresh` re-measures the from-values on resize,
     since these tweens read layout that reflows.

     In 'once' mode the end position is irrelevant — the animation is triggered
     at `start` and then plays on its own clock.
     ---------------------------------------------------------------------- */

  function revealTrigger(trigger, start, end) {
    if (!isScrub) {
      return { trigger: trigger, start: start, once: true };
    }
    return {
      trigger: trigger,
      start: start,
      end: end,
      scrub: 1,
      invalidateOnRefresh: true,
    };
  }

  // Scrubbing supplies its own pacing, so an eased sub-tween fights the scroll
  // and the linear version reads better. Playing once, the ease is the whole
  // character of the movement. This picks per mode.
  function playEase(name) {
    return isScrub ? 'none' : name;
  }

  /* ------------------------------------------------------------------------
     About — line-by-line reveal
     ------------------------------------------------------------------------
     Split to lines, not characters: the paragraph has inline <img> elements
     (portrait, cat, wavy rule) that ride along inside whichever line they land
     on. No `mask` either — .about__text runs at line-height 0.9, tighter than
     the glyph box, so an overflow-hidden line wrapper would clip descenders
     and the raised inline images.

     `autoSplit` re-splits on webfont load and on resize; `onSplit` rebuilds
     the tween each time so the reveal survives a re-flow.
     ---------------------------------------------------------------------- */

  function initAbout() {
    const el = document.querySelector('.about__text');
    if (!el) return;

    if (!hasSplitText || !hasScrollTrigger) {
      // No SplitText: fall back to revealing the paragraph as one block.
      gsap.from(el, {
        autoAlpha: 0,
        y: 40,
        duration: 0.9,
        ease: playEase('power3.out'),
        scrollTrigger: hasScrollTrigger
          ? revealTrigger('.about', 'top 85%', 'center 55%')
          : undefined,
      });
      return;
    }

    // Drives both the character cadence and, through it, when each piece of
    // inline media arrives — raise it and the whole paragraph slows together.
    const CHAR_STAGGER = 0.024;

    // Split to chars, but through words and lines as well — chars alone become
    // inline-block and the browser would then break words mid-word. Splitting
    // words too keeps the wrapping identical to the unsplit paragraph.
    SplitText.create(el, {
      type: 'lines,words,chars',
      charsClass: 'about-char', // so the media can be ordered against the chars
      aria: 'auto',             // keeps the original sentence readable to screen readers
      autoSplit: true,
      onSplit(self) {
        // Typewriter cadence, soft edges: characters arrive in sequence like
        // typing, but each one takes 0.5s to fade up instead of snapping on, so
        // the whole paragraph washes in left to right. No movement at all —
        // pure opacity, which is what keeps it smooth.
        const tl = gsap.timeline({
          scrollTrigger: revealTrigger(el, 'top 85%', 'bottom 45%'),
        });

        // Characters and inline media are walked in document order (which is
        // what querySelectorAll returns) against a single moving time cursor.
        // Each character advances the cursor by one stagger step; the media get
        // placed at whatever the cursor reads when the walk reaches them, so
        // they land exactly where they sit in the sentence.
        //
        // Placing each character individually rather than with one staggered
        // tween is what makes the gradient rule possible: the wavy line
        // advances the cursor by its own full duration, so the typing genuinely
        // waits for it, and "and people" only starts once the line is 100%
        // drawn. A single stagger can't hold a gap like that.
        const ordered = el.querySelectorAll(
          '.about-char, .about__portrait, .about__cat, .about__wave'
        );

        const WAVE_DURATION = 0.9;
        let at = 0;

        ordered.forEach((node) => {
          if (node.classList.contains('about-char')) {
            tl.from(node, {
              autoAlpha: 0,
              duration: 0.8,
              ease: 'power1.out',
            }, at);
            at += CHAR_STAGGER;
            return;
          }

          if (node.classList.contains('about__wave')) {
            const path = node.querySelector('.about__wave-path');
            if (path && hasDrawSVG) {
              // The path's `d` starts at its right end, so drawing from 0%
              // strokes right-to-left. Growing from '100% 100%' instead — the
              // path's end point, which is its left end — draws left to right,
              // matching the reading direction.
              tl.from(path, {
                drawSVG: '100% 100%',
                duration: WAVE_DURATION,
                ease: 'power2.inOut',
              }, at);
              at += WAVE_DURATION; // typing resumes only once the line is complete
            }
            return;
          }

          // Portrait and cat pop in. These only nudge the cursor, so the
          // sentence keeps typing around them.
          tl.from(node, {
            scale: 0,
            autoAlpha: 0,
            duration: 0.7,
            ease: 'back.out(2.2)',
          }, at);
          at += 0.12;
        });

        return tl;
      },
    });
  }

  // The portrait, cat video and wavy rule are animated inside initAbout()'s
  // timeline, at the moment the typing reaches each of them — see above. The
  // wave is an inline <svg> in the markup (it used to be an <img>) purely so
  // DrawSVGPlugin can reach the path.

  /* ------------------------------------------------------------------------
     Work — reveal on entry, then pin and scrub (desktop only)
     ---------------------------------------------------------------------- */

  function initWorkReveal() {
    const panel = document.querySelector('.work__panel');
    if (!panel || !hasScrollTrigger) return;

    const heading = document.querySelector('.work__heading');
    const rest = gsap.utils.toArray('.work__desc, .work__more');
    const media = document.querySelector('.work__media');

    const tl = gsap.timeline({
      defaults: { ease: playEase('power3.out') },
      scrollTrigger: revealTrigger(panel, 'top 85%', 'center 45%'),
    });

    if (heading && hasSplitText) {
      // Crisp word-by-word rise. Short duration, tight stagger — the opposite
      // pace to the About paragraph's slow fade, which is what keeps the two
      // sections feeling distinct. (An earlier 3D rotationX tumble read as
      // goofy against this typeface.)
      const split = SplitText.create(heading, { type: 'words', aria: 'auto' });
      tl.from(split.words, {
        autoAlpha: 0,
        y: 18,
        duration: 0.55,
        stagger: 0.04,
      }, 0);
    } else if (heading) {
      tl.from(heading, { autoAlpha: 0, y: 34, duration: 0.8 }, 0);
    }

    if (rest.length) tl.from(rest, { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.1 }, 0.25);

    // The video rises and fades in exactly like the heading words — same
    // fade + lift, same ease, so the whole panel moves as one gesture. The
    // travel is larger only because the element is: 18px on a 700px block
    // wouldn't read as movement at all.
    if (media) {
      tl.from(media, {
        autoAlpha: 0,
        y: 26,
        duration: 0.8,
      }, 0.1);
    }
  }

  // The video breathes very slightly as the section passes — no pinning, no
  // dimming of the copy. An earlier version pinned the panel and slid the text
  // out sideways while fading it; it read as a glitch rather than an effect,
  // because nothing about the layout suggested the text should leave.
  function initWorkMediaScrub() {
    const media = document.querySelector('.work__media');
    if (!media || !hasScrollTrigger) return;

    gsap.fromTo(
      media,
      { scale: 1 },
      {
        scale: 1.07,
        ease: 'none',
        scrollTrigger: {
          trigger: '.work',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      }
    );
  }

  /* ------------------------------------------------------------------------
     ScrollSmoother
     ------------------------------------------------------------------------
     Eases the whole page rather than each element — this is what gives the
     site that weighted, glide-to-a-stop scroll feel. `effects: true` turns on
     the data-speed / data-lag attributes in index.html.

     Only elements NOT carrying a CSS transform get data-speed: the plugin
     writes a pixel transform every frame, which would clobber, say, the
     translate(-50%,-50%) that centres .hero__portrait.
     ---------------------------------------------------------------------- */

  function initSmoother() {
    if (typeof ScrollSmoother === 'undefined') return null;
    if (!document.getElementById('smooth-wrapper')) return null; // project pages
    if (ScrollSmoother.get()) return ScrollSmoother.get();

    return ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.1,          // seconds for the page to catch up to the scrollbar
      effects: true,        // enable data-speed / data-lag
      smoothTouch: false,   // native inertia on touch feels better than faked
      normalizeScroll: true // steadies iOS/Android address-bar scroll jitter
    });
  }

  /* ------------------------------------------------------------------------
     Hero portrait, scrubbed to the hero's own scroll
     ------------------------------------------------------------------------
     js/three-scene.js exposes window.heroPortrait.setScroll(0..1); the model's
     yaw/pitch and the camera distance are derived from it inside the render
     loop, so this stays one number crossing the boundary.
     ---------------------------------------------------------------------- */

  function initPortraitScrub() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection || !hasScrollTrigger) return;

    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate(self) {
        if (window.heroPortrait) window.heroPortrait.setScroll(self.progress);
      },
    });
  }

  /* ------------------------------------------------------------------------
     Clouds react to scroll speed
     ------------------------------------------------------------------------
     A flick of the wheel rushes the fly-through; js/clouds.js decays the boost
     back to idle on its own, so nothing needs resetting here.
     ---------------------------------------------------------------------- */

  function initCloudVelocity() {
    const heroSection = document.querySelector('.hero');
    if (!heroSection || !hasScrollTrigger) return;

    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate(self) {
        if (!window.heroClouds) return;
        // getVelocity() is px/sec and signed; only the magnitude matters.
        const speed = Math.abs(self.getVelocity());
        window.heroClouds.setBoost(1 + speed / 400);
      },
    });
  }

  /* ------------------------------------------------------------------------
     Nav — underline the section you are actually in
     ---------------------------------------------------------------------- */

  function initNavActive() {
    if (!hasScrollTrigger) return;

    gsap.utils.toArray('.nav__link').forEach((link) => {
      const id = link.getAttribute('href');
      if (!id || id.length < 2) return;

      const section = document.querySelector(id);
      if (!section) return;

      ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onToggle(self) {
          link.classList.toggle('nav__link--active', self.isActive);
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     Magnetic "Read more"
     ------------------------------------------------------------------------
     quickTo keeps a single cached tween per property, so this is cheap enough
     to drive straight off pointermove.
     ---------------------------------------------------------------------- */

  function initMagnetic() {
    const link = document.querySelector('.work__more');
    if (!link) return;

    const PULL = 0.35;  // fraction of the cursor's offset the link travels
    const RADIUS = 160; // px from the link's centre where the pull begins

    const toX = gsap.quickTo(link, 'x', { duration: 0.45, ease: 'power3' });
    const toY = gsap.quickTo(link, 'y', { duration: 0.45, ease: 'power3' });

    // The link's centre is cached and only re-measured on scroll/resize, so
    // pointermove itself does no layout reads. Measuring per-move would force a
    // reflow on every mouse event, which is exactly what smooth scrolling
    // cannot afford.
    let cx = 0, cy = 0;
    let queued = false;

    const measure = () => {
      const r = link.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      queued = false;
    };

    const queueMeasure = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', queueMeasure, { passive: true });
    window.addEventListener('resize', queueMeasure);
    if (hasScrollTrigger) ScrollTrigger.addEventListener('refresh', measure);

    window.addEventListener('pointermove', (e) => {
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      if (Math.hypot(dx, dy) > RADIUS) {
        toX(0);
        toY(0);
        return;
      }
      toX(dx * PULL);
      toY(dy * PULL);
    }, { passive: true });
  }

  // The footer signature is deliberately not animated — it just sits there.

  /* ------------------------------------------------------------------------
     Showcase — card reveal
     ------------------------------------------------------------------------
     Each card develops into place: it arrives undersized, blurred and clipped
     in from its edges, then resolves square. No hover, no rotation.
     ---------------------------------------------------------------------- */

  function initShowcase() {
    const cards = gsap.utils.toArray('.showcase__card');
    if (!cards.length || !hasScrollTrigger) return;

    cards.forEach((card) => {
      const frame = card.querySelector('.showcase__frame');
      if (!frame) return;

      gsap.fromTo(
        frame,
        {
          autoAlpha: 0,
          y: 72,
          scale: 0.9,
          filter: 'blur(14px)',
          clipPath: 'inset(14% 14% 14% 14%)',
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.3,
          ease: playEase('power3.out'),
          scrollTrigger: revealTrigger(card, 'top 92%', 'top 48%'),
        }
      );
    });
  }

  /* ------------------------------------------------------------------------
     Contact + footer
     ------------------------------------------------------------------------
     Two more distinct flavours: the form's labels and fields shear in from the
     left, and the footer links spring up individually.
     ---------------------------------------------------------------------- */

  function initContactReveal() {
    const fields = gsap.utils.toArray('.contact__step--active .contact__field');
    if (!fields.length || !hasScrollTrigger) return;

    gsap.from(fields, {
      autoAlpha: 0,
      x: -40,
      skewX: 6,
      duration: 0.8,
      ease: playEase('power3.out'),
      stagger: 0.12,
      scrollTrigger: revealTrigger('.contact', 'top 80%', 'center 55%'),
    });
  }

  function initFooterReveal() {
    const links = gsap.utils.toArray('.footer__link');
    if (!links.length || !hasScrollTrigger) return;

    // The footer is the last thing on the page, so the range is measured
    // against the footer's own height — 'bottom bottom' is guaranteed to be
    // reachable, whereas anything expressed against the viewport centre would
    // leave the typing permanently half-finished.
    const trigger = revealTrigger('.footer', 'top bottom', 'bottom bottom');

    if (!hasSplitText) {
      gsap.from(links, {
        autoAlpha: 0,
        y: 18,
        duration: 0.6,
        ease: playEase('back.out(2.5)'),
        stagger: 0.06,
        scrollTrigger: trigger,
      });
      return;
    }

    // Typed on, same as the hero lines — one handle after another rather than
    // all at once. Each link is short, so the per-character stagger can be
    // slower than the hero's without dragging.
    const tl = gsap.timeline({ scrollTrigger: trigger });
    links.forEach((link) => {
      tl.add(typeLine(link, 0.045), '>');
    });
  }

  /* ------------------------------------------------------------------------
     Smooth in-page navigation
     ------------------------------------------------------------------------
     Replaces CSS `scroll-behavior: smooth` + scrollIntoView(), both of which
     fight ScrollTrigger's scroll math. `autoKill` lets a user's own scroll
     interrupt the tween instead of wrestling it.
     ---------------------------------------------------------------------- */

  function initSmoothNav(duration) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href.length < 2) return; // bare "#"

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const smoother =
          typeof ScrollSmoother !== 'undefined' ? ScrollSmoother.get() : null;

        if (smoother) {
          // Let the smoother own the scroll — it knows about its own effects
          // and pinned sections, so its offsets stay correct.
          smoother.scrollTo(target, !!duration);
        } else if (typeof ScrollToPlugin !== 'undefined') {
          gsap.to(window, {
            duration: duration,
            ease: 'power2.inOut',
            scrollTo: { y: target, autoKill: true },
          });
        } else {
          target.scrollIntoView({ behavior: duration ? 'smooth' : 'auto', block: 'start' });
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  const reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hide first, decide second — but only when we intend to animate.
  if (!reduceMotion) setIntroStart();

  let started = false;
  const mm = gsap.matchMedia();

  // Reduced motion: no entrance, no smoothing, no pinning — everything simply
  // present. The nav underline still tracks the current section, since that's
  // a state indicator rather than motion.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    if (heroAll.length) gsap.set(heroAll, { clearProps: 'all' });
    started = true;
    initNavActive();
  });

  // Full motion, any width: smooth scroll, hero entrance, scroll reveals.
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    if (started) return;
    started = true;

    // Create the smoother first — every ScrollTrigger below measures against
    // the scroll it sets up.
    initSmoother();

    introReady.then(() => {
      playIntro();
      if (hasScrollTrigger) ScrollTrigger.refresh();
    });

    // If the model lands after the cap, fade it in on its own.
    modelReady.then(() => {
      if (hero.canvas) {
        gsap.to(hero.canvas, {
          autoAlpha: 1,
          scale: 1,
          duration: 1.1,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    });

    initPortraitScrub();
    initCloudVelocity();
    initAbout();
    initShowcase();
    initWorkReveal();
    initWorkMediaScrub();
    initMagnetic();
    initContactReveal();
    initFooterReveal();
    initNavActive();
  });


  initSmoothNav(reduceMotion ? 0 : 1.1);

  // Videos and the 700KB signature change page height after triggers are
  // measured; re-measure once everything has landed.
  window.addEventListener('load', () => {
    if (hasScrollTrigger) ScrollTrigger.refresh();
  });

  console.info('[animations] GSAP', gsap.version, 'ready.');
})();
