/* ==========================================================================
   STVRHUNTER — JavaScript
   ========================================================================== */

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
        const openShowreel = () => {
            // Start the big video where the small one is, so it feels continuous.
            try { fsVideo.currentTime = dockedVideo ? dockedVideo.currentTime : 0; } catch (e) {}
            fsVideo.play().catch(() => {});
            fs.classList.add('is-open');
            fs.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; // lock scroll while open
        };

        const closeShowreel = () => {
            fs.classList.remove('is-open');
            fs.setAttribute('aria-hidden', 'true');
            fsVideo.pause();
            document.body.style.overflow = '';
        };

        showreel.addEventListener('click', openShowreel);
        fs.addEventListener('click', closeShowreel);   // click anywhere closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fs.classList.contains('is-open')) closeShowreel();
        });

        // Make the "click anywhere to close" tip trail the cursor.
        if (fsHint) {
            fs.addEventListener('mousemove', (e) => {
                fsHint.style.left = e.clientX + 'px';
                fsHint.style.top = e.clientY + 'px';
            });
        }
    }

    // --------------------------------------------------------------------------
    // Hero Grid Cursor Focus
    // --------------------------------------------------------------------------
    const heroGrid = document.querySelector('.hero__grid');
    if (heroGrid) {
        let gridFrame = null;
        let pointerEvent = null;

        const setGridActive = (active) => {
            heroGrid.style.setProperty('--grid-hover-opacity', active ? '1' : '0');
        };

        const updateGridFocus = () => {
            if (!pointerEvent) return;

            const rect = heroGrid.getBoundingClientRect();
            const insideGrid =
                pointerEvent.clientX >= rect.left &&
                pointerEvent.clientX <= rect.right &&
                pointerEvent.clientY >= rect.top &&
                pointerEvent.clientY <= rect.bottom;

            if (!insideGrid) {
                setGridActive(false);
                gridFrame = null;
                return;
            }

            const x = ((pointerEvent.clientX - rect.left) / rect.width) * 100;
            const y = ((pointerEvent.clientY - rect.top) / rect.height) * 100;

            heroGrid.style.setProperty('--grid-x', `${x}%`);
            heroGrid.style.setProperty('--grid-y', `${y}%`);
            setGridActive(true);
            gridFrame = null;
        };

        document.addEventListener('pointermove', (event) => {
            pointerEvent = event;

            if (!gridFrame) {
                gridFrame = requestAnimationFrame(updateGridFocus);
            }
        }, { passive: true });

        document.addEventListener('pointerleave', () => {
            setGridActive(false);
            pointerEvent = null;
        });
    }

    // --------------------------------------------------------------------------
    // Smooth Scroll Navigation
    // --------------------------------------------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

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
        const setMenuOpen = (open) => {
            burger.classList.toggle('burger--open', open);
            menu.classList.toggle('menu--open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            menu.setAttribute('aria-hidden', String(!open));
            document.body.classList.toggle('no-scroll', open);
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

        // Show specific step
        function showStep(stepNumber) {
            steps.forEach(step => {
                step.classList.remove('contact__step--active');
                if (parseInt(step.dataset.step) === stepNumber) {
                    step.classList.add('contact__step--active');
                }
            });
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

});
