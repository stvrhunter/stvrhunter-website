/* ==========================================================================
   STVRHUNTER — JavaScript
   ========================================================================== */

// --------------------------------------------------------------------------
// Scroll lock. With ScrollSmoother running, `body { overflow: hidden }` does
// nothing — the page is transformed inside #smooth-content, not scrolled — so
// the smoother has to be paused instead. Falls back to the overflow trick when
// ScrollSmoother isn't on the page (e.g. the project pages).
// --------------------------------------------------------------------------
function lockScroll(locked) {
    const smoother =
        typeof ScrollSmoother !== 'undefined' ? ScrollSmoother.get() : null;

    if (smoother) {
        smoother.paused(locked);
    } else {
        document.body.style.overflow = locked ? 'hidden' : '';
    }
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {

    // --------------------------------------------------------------------------
    // Header color on scroll
    // --------------------------------------------------------------------------
    const header = document.querySelector('.header');
    if (header) {
        const onScroll = () => header.classList.toggle('header--scrolled', window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // --------------------------------------------------------------------------
    // Showreel — click the docked video to expand it into an in-page overlay.
    // Click anywhere (or Esc) to shrink it back. A tip follows the cursor.
    // --------------------------------------------------------------------------
    const showreel = document.querySelector('.showreel');
    const dockedVideo = document.querySelector('.showreel__video');
    const fs = document.getElementById('showreel-fs');
    const fsVideo = fs && fs.querySelector('.showreel-fs__video');
    const fsHint = fs && fs.querySelector('.showreel-fs__hint');

    if (showreel && fs && fsVideo) {
        // Flip morphs the big video out of the docked one's exact rectangle, so
        // the two reads as one object growing rather than a crossfade between
        // two copies. Needs the docked video hidden during the morph, otherwise
        // both are on screen at once.
        const canFlip = typeof gsap !== 'undefined' && typeof Flip !== 'undefined';
        let morphing = false;

        const openShowreel = () => {
            if (morphing || fs.classList.contains('is-open')) return;

            // Start the big video where the small one is, so it feels continuous.
            try { fsVideo.currentTime = dockedVideo ? dockedVideo.currentTime : 0; } catch (e) {}
            fsVideo.play().catch(() => {});
            fs.classList.add('is-open');
            fs.setAttribute('aria-hidden', 'false');
            lockScroll(true);

            if (!canFlip || !dockedVideo) return;

            morphing = true;
            gsap.set(dockedVideo, { autoAlpha: 0 });

            // Park the fullscreen video over the docked one, record that as the
            // start state, snap back to its natural size, then animate the
            // difference. This is the standard Flip.fit -> getState -> from
            // pattern for morphing between two separate elements.
            Flip.fit(fsVideo, dockedVideo, { scale: true });
            const state = Flip.getState(fsVideo);
            gsap.set(fsVideo, { clearProps: 'transform,width,height' });

            Flip.from(state, {
                duration: 0.7,
                ease: 'power3.inOut',
                scale: true,
                onComplete: () => { morphing = false; },
            });
        };

        const closeShowreel = () => {
            if (morphing || !fs.classList.contains('is-open')) return;

            const finish = () => {
                fs.classList.remove('is-open');
                fs.setAttribute('aria-hidden', 'true');
                fsVideo.pause();
                lockScroll(false);
                if (canFlip) {
                    gsap.set(fsVideo, { clearProps: 'transform,width,height' });
                    if (dockedVideo) gsap.set(dockedVideo, { autoAlpha: 1 });
                }
                morphing = false;
            };

            if (!canFlip || !dockedVideo) return finish();

            // Shrink back into the docked rectangle, then hand over.
            morphing = true;
            Flip.fit(fsVideo, dockedVideo, {
                scale: true,
                duration: 0.5,
                ease: 'power3.inOut',
                onComplete: finish,
            });
        };

        showreel.addEventListener('click', openShowreel);
        fs.addEventListener('click', closeShowreel);   // click anywhere closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fs.classList.contains('is-open')) closeShowreel();
        });

        // Make the "click anywhere to close" tip trail the cursor. GSAP's
        // quickTo writes transforms through a cached setter and eases the
        // follow, so this costs no layout work per mousemove.
        if (fsHint) {
            const OFFSET_X = 48; // clears the 64px gauntlet cursor art
            const OFFSET_Y = 44;

            if (typeof gsap !== 'undefined') {
                const toX = gsap.quickTo(fsHint, 'x', { duration: 0.35, ease: 'power3' });
                const toY = gsap.quickTo(fsHint, 'y', { duration: 0.35, ease: 'power3' });
                fs.addEventListener('mousemove', (e) => {
                    toX(e.clientX + OFFSET_X);
                    toY(e.clientY + OFFSET_Y);
                }, { passive: true });
            } else {
                fs.addEventListener('mousemove', (e) => {
                    fsHint.style.transform =
                        `translate(${e.clientX + OFFSET_X}px, ${e.clientY + OFFSET_Y}px)`;
                }, { passive: true });
            }
        }
    }

    // --------------------------------------------------------------------------
    // Smooth scroll navigation lives in js/animations.js — it uses GSAP's
    // ScrollToPlugin, which plays nicely with ScrollTrigger. CSS
    // `scroll-behavior: smooth` was removed for the same reason.
    // --------------------------------------------------------------------------

    // --------------------------------------------------------------------------
    // Lottie Animation - Blob
    // --------------------------------------------------------------------------
    const lottieContainer = document.getElementById('lottie-blob');
    if (lottieContainer && typeof lottie !== 'undefined') {
        lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: 'assets/blob_3.json'
        });
    }

    // --------------------------------------------------------------------------
    // Mobile Menu (burger)
    // --------------------------------------------------------------------------
    const burger = document.getElementById('burger');
    const menu = document.getElementById('mobile-menu');
    if (burger && menu) {
        const menuLinks = menu.querySelectorAll('.menu__link, .menu__toggle');

        const setMenuOpen = (open) => {
            burger.classList.toggle('burger--open', open);
            menu.classList.toggle('menu--open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            menu.setAttribute('aria-hidden', String(!open));
            document.body.classList.toggle('no-scroll', open);
            lockScroll(open);

            // The panel's fade stays in CSS (it owns visibility); GSAP just
            // cascades the links on top of it.
            if (typeof gsap === 'undefined' || !menuLinks.length) return;

            if (open) {
                gsap.fromTo(
                    menuLinks,
                    { autoAlpha: 0, y: 26 },
                    {
                        autoAlpha: 1,
                        y: 0,
                        duration: 0.5,
                        ease: 'power3.out',
                        stagger: 0.05,
                        delay: 0.08,
                        overwrite: true,
                    }
                );
            } else {
                // Clear the inline styles so a reopen starts clean.
                gsap.set(menuLinks, { clearProps: 'all' });
            }
        };

        burger.addEventListener('click', () => {
            setMenuOpen(!menu.classList.contains('menu--open'));
        });

        // Close the menu when any link inside it is tapped
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => setMenuOpen(false));
        });

        // Expand/collapse the WORK category
        menu.querySelectorAll('.menu__toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const group = toggle.closest('.menu__group');
                const open = group.classList.toggle('menu__group--open');
                toggle.setAttribute('aria-expanded', String(open));
            });
        });
    }

    // --------------------------------------------------------------------------
    // Contact Form - Multi-Step Navigation
    // --------------------------------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const steps = contactForm.querySelectorAll('.contact__step');
        const nameInput = document.getElementById('contact-name');
        const emailInput = document.getElementById('contact-email');
        const messageInput = document.getElementById('contact-message');
        const nextBtn = contactForm.querySelector('.contact__btn--next');
        const submitBtn = contactForm.querySelector('.contact__btn--submit');
        const backBtns = contactForm.querySelectorAll('.contact__btn-back');

        // Show specific step. The class swap still does the display: none /
        // flex work — GSAP animates the incoming step's contents on top of it,
        // and moves focus once the tween is done so the caret doesn't jump
        // mid-animation.
        function showStep(stepNumber) {
            const outgoing = contactForm.querySelector('.contact__step--active');
            let incoming = null;

            steps.forEach(step => {
                step.classList.remove('contact__step--active');
                if (parseInt(step.dataset.step) === stepNumber) {
                    step.classList.add('contact__step--active');
                    incoming = step;
                }
            });

            if (typeof gsap === 'undefined' || !incoming) return;

            const forward = !outgoing || !(parseInt(outgoing.dataset.step) > stepNumber);
            const parts = incoming.querySelectorAll(
                '.contact__field, .contact__buttons, .contact__thankyou > *'
            );

            gsap.killTweensOf(parts);
            gsap.fromTo(
                parts.length ? parts : incoming,
                { autoAlpha: 0, y: forward ? 24 : -24 },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.55,
                    ease: 'power3.out',
                    stagger: 0.07,
                    clearProps: 'transform',
                    onComplete: () => {
                        const field = incoming.querySelector('input, textarea');
                        if (field) field.focus({ preventScroll: true });
                    },
                }
            );
        }

        // Validate Step 1 (Name & Email)
        function validateStep1() {
            const nameValid = nameInput.value.trim().length > 0;
            const emailValid = emailInput.value.trim().length > 0 && 
                               emailInput.value.includes('@') && 
                               emailInput.value.includes('.');
            
            if (nextBtn) {
                nextBtn.disabled = !(nameValid && emailValid);
            }
        }

        // Validate Step 2 (Message)
        function validateStep2() {
            if (!messageInput || !submitBtn) return;
            
            const messageValid = messageInput.value.trim().length > 0;
            submitBtn.disabled = !messageValid;
        }

        // Auto-resize textarea
        function autoResizeTextarea() {
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
        }

        // Event Listeners for validation
        if (nameInput) {
            nameInput.addEventListener('input', validateStep1);
            nameInput.addEventListener('keyup', validateStep1);
            nameInput.addEventListener('change', validateStep1);
        }
        if (emailInput) {
            emailInput.addEventListener('input', validateStep1);
            emailInput.addEventListener('keyup', validateStep1);
            emailInput.addEventListener('change', validateStep1);
        }
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                validateStep2();
                autoResizeTextarea();
            });
            messageInput.addEventListener('keyup', validateStep2);
            messageInput.addEventListener('change', validateStep2);
        }

        // Run validation on page load in case of autofill
        setTimeout(validateStep1, 100);

        // Next button
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const nextStep = parseInt(nextBtn.dataset.next);
                showStep(nextStep);
                // Validate step 2 when we arrive there
                if (nextStep === 2) {
                    validateStep2();
                }
            });
        }

        // Back buttons
        backBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const prevStep = parseInt(btn.dataset.back);
                showStep(prevStep);
            });
        });

        // Submit button click handler
        if (submitBtn) {
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (submitBtn.disabled) return;
                
                // Disable button during submission
                submitBtn.disabled = true;
                submitBtn.textContent = 'SENDING...';
                
                try {
                    // Submit to Formspree
                    const response = await fetch(contactForm.action, {
                        method: 'POST',
                        body: new FormData(contactForm),
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        showStep(3);
                    } else {
                        throw new Error('Form submission failed');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Sorry, there was an error sending your message. Please try again.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'SUBMIT';
                }
            });
        }

        // Form submission (backup for Enter key)
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (submitBtn) {
                submitBtn.click();
            }
        });
    }

    // --------------------------------------------------------------------------
    // Page transitions
    // --------------------------------------------------------------------------
    // The veil is created here rather than in the markup, so every page —
    // index and all the project pages — gets it without an HTML edit. A
    // same-document navigation fades it up, then the browser navigates; on
    // arrival it fades back out.
    //
    // A pageshow listener handles the back button: browsers restore a page from
    // the back/forward cache with the veil still opaque, so it has to be
    // cleared again on restore.
    // --------------------------------------------------------------------------
    if (typeof gsap !== 'undefined') {
        const veil = document.createElement('div');
        veil.className = 'page-veil';
        document.body.appendChild(veil);

        const hideVeil = () => {
            gsap.to(veil, {
                autoAlpha: 0,
                duration: 0.45,
                ease: 'power2.out',
                onStart: () => { veil.style.pointerEvents = 'none'; },
            });
        };

        // Fade in from the veil on arrival.
        gsap.set(veil, { autoAlpha: 1 });
        hideVeil();

        window.addEventListener('pageshow', (e) => {
            if (e.persisted) hideVeil();
        });

        const isInternalNav = (link, event) => {
            if (event.defaultPrevented) return false;
            if (event.button !== 0 || event.metaKey || event.ctrlKey ||
                event.shiftKey || event.altKey) return false;
            if (link.target && link.target !== '_self') return false;
            if (link.hasAttribute('download')) return false;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
                href.startsWith('tel:')) return false;

            // Same origin only — external links leave the site, no point veiling.
            return new URL(link.href, location.href).origin === location.origin;
        };

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link || !isInternalNav(link, e)) return;

            e.preventDefault();
            const url = link.href;

            gsap.to(veil, {
                autoAlpha: 1,
                duration: 0.4,
                ease: 'power2.inOut',
                onComplete: () => { window.location.href = url; },
            });
        });
    }

});
