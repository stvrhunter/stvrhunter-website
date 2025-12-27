/* ==========================================================================
   STVRHUNTER — JavaScript
   ========================================================================== */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
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
    // Star Rotation on Hover (rotates 180° each time, stays rotated)
    // --------------------------------------------------------------------------
    const star = document.querySelector('.about__star');
    if (star) {
        let rotation = 0;
        star.addEventListener('mouseenter', function() {
            rotation += 180;
            this.style.transform = `rotate(${rotation}deg)`;
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
            console.log('Step 2 validation:', messageValid, 'Button disabled:', submitBtn.disabled);
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
                        console.log('Form submitted successfully!');
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

