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
  if (plugins.length) gsap.registerPlugin.apply(gsap, plugins);

  const hasScrollTrigger = typeof ScrollTrigger !== 'undefined';
  const hasSplitText = typeof SplitText !== 'undefined';

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

     A section can opt out by passing its own mode to revealTrigger()/playEase()
     — the About paragraph does, see ABOUT_MODE in initAbout().
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

  function revealTrigger(trigger, start, end, mode) {
    if (!(mode ? mode === 'scrub' : isScrub)) {
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
  function playEase(name, mode) {
    return (mode ? mode === 'scrub' : isScrub) ? 'none' : name;
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

     This section overrides REVEAL_MODE: the paragraph types itself out once,
     on its own clock, instead of running back and forth with the scrollbar.
     Every duration below is therefore in real seconds — under 'scrub' they
     were shares of the section's scroll range, which is why the scrubbed
     values are so much longer.
     ---------------------------------------------------------------------- */

  const ABOUT_MODE = 'once'; // <-- 'once' or 'scrub'; independent of REVEAL_MODE

  function initAbout() {
    const el = document.querySelector('.about__text');
    if (!el) return;

    const aboutScrub = ABOUT_MODE === 'scrub';

    if (!hasSplitText || !hasScrollTrigger) {
      // No SplitText: fall back to revealing the paragraph as one block.
      gsap.from(el, {
        autoAlpha: 0,
        y: 40,
        duration: 0.9,
        ease: playEase('power3.out', ABOUT_MODE),
        scrollTrigger: hasScrollTrigger
          ? revealTrigger('.about', 'top 85%', 'center 55%', ABOUT_MODE)
          : undefined,
      });
      return;
    }

    // Drives both the character cadence and, through it, when each piece of
    // inline media arrives — raise it and the whole paragraph slows together.
    // Playing once, the whole paragraph is ~3s at 0.016; the scrubbed value
    // has to be bigger to spread over the section's scroll range.
    const CHAR_STAGGER = aboutScrub ? 0.024 : 0.016;
    const CHAR_FADE = aboutScrub ? 0.8 : 0.5;

    // Split to chars, but through words and lines as well — chars alone become
    // inline-block and the browser would then break words mid-word. Splitting
    // words too keeps the wrapping identical to the unsplit paragraph.
    SplitText.create(el, {
      type: 'lines,words,chars',
      charsClass: 'about-char', // so the media can be ordered against the chars
      aria: 'auto',             // keeps the original sentence readable to screen readers
      autoSplit: true,
      onSplit(self) {
        // The chars are new elements on every re-split, but the inline media and
        // the wave path survive it — so a tween from the previous split can still
        // be writing to them. Killed first, or two writers fight over the same
        // dash pattern and the wave tears into pieces.
        gsap.killTweensOf(el.querySelectorAll(
          '.about__portrait, .about__cat, .about__wave-path'
        ));

        // Typewriter cadence, soft edges: characters arrive in sequence like
        // typing, but each one takes 0.5s to fade up instead of snapping on, so
        // the whole paragraph washes in left to right. No movement at all —
        // pure opacity, which is what keeps it smooth.
        const tl = gsap.timeline({
          scrollTrigger: revealTrigger(el, 'top 85%', 'bottom 45%', ABOUT_MODE),
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

        const WAVE_DURATION = aboutScrub ? 0.9 : 0.7;
        let at = 0;

        // Hidden states are set here, not inferred by from() tweens. A from()
        // whose scrub progress has already run once and is then reset by a
        // ScrollTrigger.refresh() (webfonts, videos, the 700KB signature — all
        // of which land after these triggers are first measured) leaves every
        // not-yet-started target sitting at its END value, so the tail of the
        // reveal appears already-revealed while the head is still fading. set +
        // to has no inferred values to lose.
        ordered.forEach((node) => {
          if (node.classList.contains('about-char')) {
            gsap.set(node, { autoAlpha: 0 });
            tl.to(node, {
              autoAlpha: 1,
              duration: CHAR_FADE,
              ease: 'power1.out',
            }, at);
            at += CHAR_STAGGER;
            return;
          }

          if (node.classList.contains('about__wave')) {
            const path = node.querySelector('.about__wave-path');
            if (path) {
              // Hand-rolled dash draw instead of DrawSVGPlugin, because the
              // plugin pairs a dash of `d` with a gap of `length - d`: the
              // pattern then repeats exactly one path-length later, so the moment
              // the offset and the dash come from even slightly different states
              // (a re-split, a refresh, a second writer on the same path) the
              // wrapped copy of the dash surfaces at the far end and the line
              // renders as TWO pieces — a growing stroke plus an orphaned blob.
              //
              // A gap of 2 × length makes the pattern repeat every 3 lengths, so
              // no second copy can ever land inside the path, whatever the offset
              // is. One stroke, always.
              //
              // The path's `d` runs right-to-left, so length position 0 is its
              // right end. Keeping the visible run anchored at position `length`
              // and growing it backwards draws left to right, i.e. with the
              // reading direction.
              const L = path.getTotalLength();
              gsap.set(path, {
                strokeDasharray: L + 'px ' + (L * 2) + 'px',
                strokeDashoffset: -L + 'px', // visible run = [L, L] — nothing yet
              });
              tl.to(path, {
                strokeDashoffset: 0,         // visible run = [0, L] — whole line
                duration: WAVE_DURATION,
                ease: 'power2.inOut',
              }, at);
              at += WAVE_DURATION; // typing resumes only once the line is complete
            }
            return;
          }

          // Portrait and cat scale up from nothing — the growth is the effect.
          // Only the overshoot is gone: power3.out settles exactly on full size
          // instead of springing past it like back.out(2.2) did.
          //
          // The scrubbed duration is long on purpose. In 'scrub' mode this
          // whole timeline (~400 characters at CHAR_STAGGER) is squeezed into
          // the section's scroll range, so a 0.7s tween was only ~7% of it —
          // about 70px of scrolling, which snapped 0 to 1 in a frame or two and
          // read as a plain fade. 2.2s gives the growth enough of the range to
          // actually be seen. Playing once, seconds are seconds again and 0.8s
          // is the whole growth.
          gsap.set(node, { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%' });
          tl.to(node, {
            scale: 1,
            autoAlpha: 1,
            duration: aboutScrub ? 2.2 : 0.8,
            ease: 'power3.out',
          }, at);
          at += 0.12;
        });

        return tl;
      },
    });
  }

  // The portrait, cat video and wavy rule are animated inside initAbout()'s
  // timeline, at the moment the typing reaches each of them — see above. The
  // wave is an inline <svg> in the markup (it used to be an <img>) so its path
  // can be stroked on with stroke-dasharray.

  /* ------------------------------------------------------------------------
     Work — reveal on entry, then pin and scrub (desktop only)
     ---------------------------------------------------------------------- */

  // Every .work__panel gets its own timeline against its own trigger — the
  // featured role and each past one below it. Scoping the queries to the panel
  // matters: a page-level querySelector would animate the first panel's
  // heading with every panel's trigger, and toArray('.work__desc') would fire
  // all four descriptions the moment the first one came into view.
  function initWorkReveal() {
    const panels = gsap.utils.toArray('.work__panel');
    if (!panels.length || !hasScrollTrigger) return;

    panels.forEach((panel) => {
      const heading = panel.querySelector('.work__heading');
      const rest = gsap.utils.toArray(panel.querySelectorAll('.work__desc, .work__more'));
      const media = panel.querySelector('.work__media');

      const tl = gsap.timeline({
        defaults: { ease: playEase('power3.out') },
        scrollTrigger: revealTrigger(panel, 'top 85%', 'center 45%'),
      });

      if (heading && hasSplitText) {
        // Crisp word-by-word rise. Short duration, tight stagger — the opposite
        // pace to the About paragraph's slow fade, which is what keeps the two
        // sections feeling distinct. (An earlier 3D rotationX tumble read as
        // goofy against this typeface.)
        //
        // set + to, never from(): these triggers are measured before the videos
        // and webfonts land, so the panel's start line moves and a later
        // ScrollTrigger.refresh() resets a scrub that had already run. A from()
        // tween that gets reset that way strands every word whose stagger step
        // hasn't begun at its END value — the tail of the heading reads as
        // already revealed while the first words are still faint.
        const split = SplitText.create(heading, { type: 'words', aria: 'auto' });
        gsap.set(split.words, { autoAlpha: 0, y: 18 });
        tl.to(split.words, {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.04,
        }, 0);
      } else if (heading) {
        gsap.set(heading, { autoAlpha: 0, y: 34 });
        tl.to(heading, { autoAlpha: 1, y: 0, duration: 0.8 }, 0);
      }

      if (rest.length) {
        gsap.set(rest, { autoAlpha: 0, y: 20 });
        tl.to(rest, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.25);
      }

      // The media rises and fades in exactly like the heading words — same
      // fade + lift, same ease, so the whole panel moves as one gesture. The
      // travel is larger only because the element is: 18px on a 700px block
      // wouldn't read as movement at all.
      if (media) {
        gsap.set(media, { autoAlpha: 0, y: 26 });
        tl.to(media, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
        }, 0.1);
      }
    });
  }

  // The video breathes very slightly as the section passes — no pinning, no
  // dimming of the copy. An earlier version pinned the panel and slid the text
  // out sideways while fading it; it read as a glitch rather than an effect,
  // because nothing about the layout suggested the text should leave.
  /* ------------------------------------------------------------------------
     Work — cards stack up as you scroll
     ------------------------------------------------------------------------
     Each role card sticks under the header, one sliver lower than the card
     before it, so the next card slides up over the last and leaves only its
     top edge — heading's first line — showing. The covered cards pile up as a
     hairline-divided stack while the bottom-most card is fully open, and the
     whole pile releases together once the last card has arrived.

     Pinned via ScrollTrigger rather than `position: sticky`, because sticky is
     resolved against the nearest transformed ancestor and ScrollSmoother
     transforms #smooth-content on every frame — native sticky simply does not
     work inside it. ScrollTrigger knows about the smoother and pins with a
     transform of its own.

     `pinSpacing: false` is what makes them overlap: with spacing on, each pin
     would insert its own height as padding and the cards would queue up one
     after another instead of covering each other.
     ---------------------------------------------------------------------- */

  function initWorkStack() {
    const panels = gsap.utils.toArray('.work__panel');
    if (panels.length < 2 || !hasScrollTrigger) return [];

    const header = document.querySelector('.header');

    // Both read at refresh time, so a resize (or a font landing and changing
    // the header's height) re-measures instead of baking in stale pixels.
    const headerH = () => (header ? header.getBoundingClientRect().height : 0);

    // Measured from the card itself: the cut lands just under the index line, so
    // a stacked card shows that line in full and nothing is sliced through the
    // middle of a glyph. Falls back to the CSS var when there is no index line
    // to measure.
    const sliver = () => {
      const index = panels[0].querySelector('.work__index');
      if (index) {
        const panelTop = panels[0].getBoundingClientRect().top;
        const bottom = index.getBoundingClientRect().bottom - panelTop;
        return Math.round(bottom + 14); // a little breathing room under the line
      }
      const raw = getComputedStyle(document.querySelector('.work'))
        .getPropertyValue('--work-sliver');
      return parseFloat(raw) || 72;
    };

    const last = panels[panels.length - 1];
    const restY = () => headerH() + (panels.length - 1) * sliver();

    // The last card is never pinned: nothing has to cover it, and pinning it
    // would freeze the section on screen after the stack is complete.
    return panels.slice(0, -1).map((panel, i) =>
      ScrollTrigger.create({
        trigger: panel,
        start: () => 'top ' + (headerH() + i * sliver()),
        endTrigger: last,
        end: () => 'top ' + restY(),
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true,
        id: 'work-stack-' + i,
      })
    );
  }

  function initWorkMediaScrub() {
    const panels = gsap.utils.toArray('.work__panel');
    if (!panels.length || !hasScrollTrigger) return;

    // Measured against each panel rather than the whole section: with several
    // entries stacked up, one range spanning all of .work would leave the lower
    // media already fully scaled before they were ever on screen.
    //
    // The scale goes on the media *inside* the frame, not the frame itself. The
    // frame is overflow:hidden, so the growth is clipped to the card instead of
    // bleeding past its edge — which also means .work no longer needs its own
    // overflow:hidden, and that matters because clipping an ancestor breaks the
    // pinned stack above.
    panels.forEach((panel) => {
      const media = panel.querySelector('.work__video, .work__image');
      if (!media) return;

      gsap.fromTo(
        media,
        { scale: 1 },
        {
          scale: 1.07,
          ease: 'none',
          scrollTrigger: {
            trigger: panel,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        }
      );
    });
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
     Running section label
     ------------------------------------------------------------------------
     One fixed line under the brand naming whatever section owns the viewport.
     The words match the nav exactly, so the label confirms the nav rather than
     introducing a second vocabulary for the same places.

     Two independent things are tracked:

       1. WHICH SECTION — 'top center'/'bottom center', the same window
          initNavActive() uses, so the label and the nav underline always agree.
          #showcase has no nav entry of its own; it reads as 03/WORK because
          that is what it is.

       2. WHAT COLOUR — the label is fixed, so it passes over backgrounds the
          section boundaries know nothing about: the sky, then cream, then the
          blue feature panel inside an otherwise cream #work. Tone is therefore
          driven by the dark-background elements themselves, not by section.
     ---------------------------------------------------------------------- */

  /* Which treatment is on. Flip this one line to compare:
       'sticky' : one fixed line under the brand, swapped as you scroll.
       'static' : the name printed at the top of each section, scrolling away
                  with it — the same idiom as Nº001 / REPLIKA.
       'display': the same printed mark, set in big display type as a chapter
                  break rather than an annotation.
     The names are identical either way; only the delivery changes. */
  const SECTION_LABEL_MODE = 'static'; // 'sticky' | 'static' | 'display'

  // Plain words, no numbering: the nav already carries the 01/02/03 system, and
  // repeating it on the page turns every section into a second table of
  // contents. #showcase and #work are named apart because they are different
  // things — loose pieces versus the projects with a story behind them.
  const SECTION_LABELS = [
    ['#sup', 'SUP'],
    ['#about', 'ABOUT'],
    ['#showcase', 'SHOWCASE'],
    ['#work', 'PROJECTS'],
    ['#contact', 'CONTACT'],
  ];

  // Where a printed mark earns its place. The hero is skipped — it has the
  // brand, the nav, the bio and the scroll cue already.
  const STATIC_MARK_SECTIONS = ['#about', '#showcase', '#work', '#contact'];

  // Everything the label crosses that is dark enough to need white type.
  const DARK_BACKDROPS = ['.hero', '.work__feature'];

  // Static mode: the mark is printed into the section itself, so it needs no
  // tracking at all — it scrolls in and out with its own copy. Built here
  // rather than written into index.html so the two modes stay one flag apart.
  function initSectionMarks() {
    const named = new Map(SECTION_LABELS);

    STATIC_MARK_SECTIONS.forEach((selector) => {
      const section = document.querySelector(selector);
      const name = named.get(selector);
      if (!section || !name) return;

      const mark = document.createElement('div');
      mark.className = 'section-mark';
      mark.setAttribute('aria-hidden', 'true'); // the section's own heading is the real one
      mark.textContent = name;
      section.insertBefore(mark, section.firstChild);

      if (hasScrollTrigger && !reduceMotion) revealMark(mark);
    });
  }

  // Under reduced motion nothing is set on the mark at all, so it is simply
  // there — no hidden state to undo.

  // The mark announces the section, so it arrives before the section's own
  // content rather than with it — hence its own trigger, 10% earlier than the
  // 'top 85%' the headings use.
  //
  // `once`, not scrub, even though the sections around it scrub: a label that
  // fades back out when you scroll up is a label you can't trust. It is the
  // one thing on screen whose whole job is to still be there.
  function revealMark(mark) {
    gsap.set(mark, { autoAlpha: 0, y: 12 });
    gsap.to(mark, {
      autoAlpha: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
      scrollTrigger: { trigger: mark, start: 'top 95%', once: true },
    });
  }

  function initSectionLabel() {
    // Both printed modes are the same markup; only the type changes.
    if (SECTION_LABEL_MODE !== 'sticky') {
      document.body.classList.add('labels-' + SECTION_LABEL_MODE);
      initSectionMarks();
      return;
    }

    const label = document.querySelector('.section-label');
    const text = label && label.querySelector('.section-label__text');
    if (!label || !text || !hasScrollTrigger) return;

    let current = '';

    // Crossfade rather than a hard swap: at this size a straight cut reads as a
    // glitch, and the label is peripheral — it should change without asking for
    // attention.
    const setLabel = (next) => {
      if (!next || next === current) return;
      current = next;
      if (reduceMotion) {
        text.textContent = next;
        return;
      }
      gsap.to(text, {
        autoAlpha: 0,
        duration: 0.18,
        ease: 'power2.in',
        onComplete() {
          text.textContent = next;
          gsap.to(text, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' });
        },
      });
    };

    // First paint has nothing to fade from.
    const first = document.querySelector(SECTION_LABELS[0][0]);
    if (first) {
      current = SECTION_LABELS[0][1];
      text.textContent = current;
    }

    SECTION_LABELS.forEach(([selector, name]) => {
      const section = document.querySelector(selector);
      if (!section) return;

      ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onToggle(self) {
          if (self.isActive) setLabel(name);
        },
      });
    });

    // Tone. Each backdrop owns a trigger whose window is "this element is
    // behind the label", i.e. it starts when the element's top passes the
    // label's line and ends when its bottom does — measured from the label
    // itself so it keeps working if the header height changes.
    const labelY = () => label.getBoundingClientRect().top + 8;

    DARK_BACKDROPS.forEach((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;

      ScrollTrigger.create({
        trigger: el,
        start: () => 'top ' + labelY() + 'px',
        end: () => 'bottom ' + labelY() + 'px',
        invalidateOnRefresh: true,
        onToggle(self) {
          label.classList.toggle('section-label--light', self.isActive);
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     "Read more" — no hover effect at all
     ------------------------------------------------------------------------
     There used to be a magnetic pull here: the link chased the cursor within a
     160px radius. It drifted out of alignment with the copy above it and read
     as a bug rather than an effect, so it's gone. The link is a plain,
     permanently underlined link now — see .work__more in styles.css.
     ---------------------------------------------------------------------- */

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

  // Deliberately NOT routed through revealTrigger(): this one always plays on
  // its own clock the first time the section enters view, whatever REVEAL_MODE
  // is set to. The old version was scrubbed and sheared in from the left, which
  // meant it ran backwards on every scroll-up and never settled.
  // Soft-edged mask sweep. Two things made the first attempt chop: the gradient
  // string was rebuilt every frame (re-parse + full repaint), and a 26% feather
  // is narrow enough that the browser's rasterised ramp visibly steps across
  // display type. So: build the gradient ONCE at 250% width with a ramp a full
  // element-width wide, then only slide mask-position. Same reveal, one cheap
  // property, and a fade edge too soft to band.
  const SWEEP_GRADIENT =
    'linear-gradient(90deg, #000 0%, #000 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0) 100%)';

  function armMask(el) {
    el.style.webkitMaskImage = SWEEP_GRADIENT;
    el.style.maskImage = SWEEP_GRADIENT;
    el.style.webkitMaskSize = '250% 100%';
    el.style.maskSize = '250% 100%';
    el.style.webkitMaskRepeat = 'no-repeat';
    el.style.maskRepeat = 'no-repeat';
    el.style.willChange = 'mask-position';
    sweepMask(el, 0);
  }

  // p 0 → 1 walks mask-position 100% → 0%: at 100% the element sits under the
  // gradient's transparent tail, at 0% under its solid head.
  function sweepMask(el, p) {
    const pos = `${(1 - p) * 100}% 0`;
    el.style.webkitMaskPosition = pos;
    el.style.maskPosition = pos;
  }

  function clearMask(el) {
    el.style.webkitMaskImage = '';
    el.style.maskImage = '';
    el.style.webkitMaskSize = '';
    el.style.maskSize = '';
    el.style.webkitMaskRepeat = '';
    el.style.maskRepeat = '';
    el.style.webkitMaskPosition = '';
    el.style.maskPosition = '';
    el.style.willChange = '';
  }

  function initContactReveal() {
    const rows = gsap.utils.toArray('.contact__step--active .contact__field');
    const buttons = document.querySelector('.contact__step--active .contact__buttons');
    if (!rows.length || !hasScrollTrigger) return;

    // Label and input sweep as separate lines rather than one block, so the
    // reveal reads top-to-bottom instead of as a single sliding curtain.
    const lines = [];
    rows.forEach(row => {
      const label = row.querySelector('.contact__label');
      const input = row.querySelector('.contact__input');
      if (label) lines.push(label);
      if (input) lines.push(input);
    });
    if (!lines.length) return;

    // Masked out up front so nothing flashes before the trigger fires — a proxy
    // tween's onUpdate can't be relied on for the time-0 render.
    lines.forEach(armMask);

    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.contact', start: 'top 75%', once: true },
    });

    // Deliberately long and heavily overlapped: at 0.28 apart against a 1.9s
    // sweep, line 4 starts while line 1 is barely half-revealed, so the section
    // reads as one continuous wash instead of four separate events firing.
    const STEP = 0.28;

    lines.forEach((el, i) => {
      const proxy = { p: 0 };
      tl.to(proxy, {
        p: 1,
        duration: 1.9,
        // power1, not power3 — a hard-decelerating ease spends most of the tween
        // creeping, which is exactly when a mask edge looks like it's ratcheting.
        ease: 'power1.inOut',
        onUpdate: () => sweepMask(el, proxy.p),
        // Inline masks left on inputs clip the caret and focus outline.
        onComplete: () => clearMask(el),
      }, i * STEP);

      // 8px of lift, running the full length of the sweep so the two never
      // finish at different times and read as two separate moves.
      tl.fromTo(el,
        { y: 8 },
        { y: 0, duration: 1.9, ease: 'power2.out' },
        i * STEP);
    });

    if (buttons) {
      tl.from(buttons, { autoAlpha: 0, y: 12, duration: 0.9, ease: 'power2.out' },
        (lines.length - 1) * STEP + 0.8);
    }
  }

  function initFooterReveal() {
    const links = gsap.utils.toArray('.footer__link');
    if (!links.length || !hasScrollTrigger) return;

    // Always plays once on its own clock, whatever REVEAL_MODE is — scrubbing
    // character-level typing here meant the handles un-typed themselves every
    // time you scrolled back up off the bottom of the page.
    const trigger = { trigger: '.footer', start: 'top bottom', once: true };

    if (!hasSplitText) {
      gsap.from(links, {
        autoAlpha: 0,
        y: 18,
        duration: 0.6,
        ease: 'back.out(2.5)',
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
    initSectionLabel();
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
    initContactReveal();
    initFooterReveal();
    initNavActive();
    initSectionLabel();
  });

  // The stacking cards are a desktop effect: below 768px the cards are taller
  // than the viewport once they are one-column, so a stack would bury the copy
  // instead of previewing it. matchMedia reverts the pins on its own when the
  // query stops matching, so a resize past the breakpoint restores the plain
  // divided list. Added after the block above so the smoother already exists.
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 769px)', () => {
    initWorkStack();
  });


  initSmoothNav(reduceMotion ? 0 : 1.1);

  // Videos and the 700KB signature change page height after triggers are
  // measured; re-measure once everything has landed.
  window.addEventListener('load', () => {
    if (hasScrollTrigger) ScrollTrigger.refresh();
  });

  console.info('[animations] GSAP', gsap.version, 'ready.');
})();
