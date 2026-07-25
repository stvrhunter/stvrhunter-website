/* ==========================================================================
   STVRHUNTER — GSAP animations
   --------------------------------------------------------------------------
   GSAP core + ScrollTrigger are loaded as classic <script> tags in index.html,
   so they are available on the global scope here as `gsap` and `ScrollTrigger`.

   GSAP is 100% free as of 2025 (incl. all former "Club" plugins like SplitText
   and MorphSVG). To add another plugin, drop its CDN <script> tag next to the
   ScrollTrigger one in index.html, then gsap.registerPlugin(ThePlugin).

   Docs: https://gsap.com/docs/v3/
   ========================================================================== */

(function () {
  'use strict';

  if (typeof gsap === 'undefined') {
    console.warn('[animations] GSAP not loaded — check the CDN <script> tags.');
    return;
  }

  // Register plugins once, up front.
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Respect users who prefer reduced motion.
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    console.info('[animations] GSAP', gsap.version, 'ready.');

    if (prefersReducedMotion) return;

    // ----------------------------------------------------------------------
    // Starter examples — commented out so the current design is untouched.
    // Uncomment / adapt when you are ready to animate.
    // ----------------------------------------------------------------------

    // Fade + rise the About text as it scrolls into view:
    //
    // gsap.from('.about__text', {
    //   scrollTrigger: { trigger: '.about', start: 'top 75%' },
    //   y: 40,
    //   autoAlpha: 0,
    //   duration: 0.8,
    //   ease: 'power3.out',
    // });

    // Simple hero entrance:
    //
    // gsap.from('.hero__portrait', {
    //   y: 30,
    //   autoAlpha: 0,
    //   duration: 1,
    //   ease: 'power2.out',
    // });
  });
})();
