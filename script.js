// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

hamburger.addEventListener('click', () => {
    const isActive = navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
    // Lock body scroll when menu is open
    document.body.style.overflow = isActive ? 'hidden' : '';
});

// Close menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Smooth scrolling for anchor links
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

// Navbar background change on scroll
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.08)';
    }
});

// Form submission handling - supports booking and sponsorship forms
document.querySelectorAll('.book-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        // Support both inline .form-status and external message div
        let formStatus = form.querySelector('.form-status') || document.getElementById('sponsorFormMessage');
        const originalBtnText = submitBtn.textContent;

        // Determine form type
        const isSponsorship = form.id === 'sponsorshipForm';
        const isCorporate = form.id === 'corporateForm';
        const isContact = form.id === 'contactForm';

        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // Collect form data based on form type
        let formData;
        let endpoint;
        if (isSponsorship) {
            formData = {
                name: form.querySelector('[name="name"]').value,
                company: form.querySelector('[name="company"]')?.value || '',
                email: form.querySelector('[name="email"]').value,
                level: form.querySelector('[name="level"]')?.value || '',
                message: form.querySelector('[name="message"]')?.value || '',
                source: 'website-sponsorship'
            };
            endpoint = '/.netlify/functions/submit-sponsorship';
        } else if (isCorporate) {
            formData = {
                name: form.querySelector('[name="name"]').value,
                company: form.querySelector('[name="company"]')?.value || '',
                email: form.querySelector('[name="email"]').value,
                phone: form.querySelector('[name="phone"]')?.value || '',
                package: form.querySelector('[name="package"]')?.value || '',
                team_size: form.querySelector('[name="team_size"]')?.value || '',
                message: form.querySelector('[name="message"]')?.value || '',
                source: 'website-corporate'
            };
            endpoint = '/.netlify/functions/submit-corporate';
        } else if (isContact) {
            formData = {
                name: form.querySelector('[name="name"]').value,
                email: form.querySelector('[name="email"]').value,
                message: form.querySelector('[name="message"]')?.value || '',
                source: 'website-contact'
            };
            endpoint = '/.netlify/functions/submit-form';
        } else {
            formData = {
                name: form.querySelector('[name="name"]').value,
                email: form.querySelector('[name="email"]').value,
                phone: form.querySelector('[name="phone"]')?.value || '',
                session: form.querySelector('[name="session"]')?.value || '',
                message: form.querySelector('[name="message"]')?.value || '',
                source: 'website-booking'
            };
            endpoint = '/.netlify/functions/submit-form';
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                formStatus.style.display = 'block';
                formStatus.className = 'form-status success';
                formStatus.textContent = isSponsorship
                    ? 'Thank you for your interest! We will contact you shortly to discuss sponsorship opportunities.'
                    : isCorporate
                    ? 'Thank you! We will be in touch shortly to discuss your corporate event.'
                    : form.id === 'contactForm'
                    ? 'Thank you for your message! Please fill out the form in the next page before your taster session.'
                    : 'Thank you! We will contact you shortly to confirm your taster session.';
                form.reset();
                if (form.id === 'contactForm') {
                    console.log('Redirecting...');
                    setTimeout(() => {
                        console.log('Redirect firing now');
                        window.location.assign('http://bit.ly/40RdL92');
                    }, 2000);
                }
            } else {
                throw new Error(result.error || 'Failed to submit form');
            }
        } catch (error) {
            console.error('Form submission error:', error);

            // Create mailto fallback
            let subject, body;
            if (isSponsorship) {
                const company = form.querySelector('[name="company"]')?.value || '';
                const level = form.querySelector('[name="level"]')?.value || '';
                subject = encodeURIComponent(`Sponsorship Enquiry - ${level}`);
                body = encodeURIComponent(
                    `Name: ${formData.name}\n` +
                    `Company: ${company}\n` +
                    `Email: ${formData.email}\n` +
                    `Sponsorship Level: ${level}\n` +
                    `Message: ${formData.message || 'N/A'}`
                );
            } else if (isCorporate) {
                subject = encodeURIComponent(`Corporate Event Enquiry - ${formData.package}`);
                body = encodeURIComponent(
                    `Name: ${formData.name}\n` +
                    `Company: ${formData.company}\n` +
                    `Email: ${formData.email}\n` +
                    `Phone: ${formData.phone}\n` +
                    `Package: ${formData.package}\n` +
                    `Team Size: ${formData.team_size || 'N/A'}\n` +
                    `Message: ${formData.message || 'N/A'}`
                );
            } else {
                subject = encodeURIComponent(`Taster Session Booking - ${formData.session}`);
                body = encodeURIComponent(
                    `Name: ${formData.name}\n` +
                    `Email: ${formData.email}\n` +
                    `Phone: ${formData.phone}\n` +
                    `Preferred Session: ${formData.session}\n` +
                    `Message: ${formData.message || 'N/A'}`
                );
            }
            const mailtoLink = `mailto:info@shadwelldragons.co.uk?subject=${subject}&body=${body}`;

            formStatus.style.display = 'block';
            formStatus.className = 'form-status error';
            formStatus.innerHTML = `Form submission unavailable. <a href="${mailtoLink}" style="color: #fca5a5; text-decoration: underline;">Click here to email us directly</a> with your details.`;
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;

            // Hide status message after 10 seconds (longer for error with link)
            setTimeout(() => {
                formStatus.style.display = 'none';
            }, 10000);
        }
    });
});

// Animation on scroll
const isMobile = window.innerWidth <= 768;
const observerOptions = {
    threshold: isMobile ? 0.05 : 0.1,
    rootMargin: isMobile ? '0px 0px -20px 0px' : '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
        }
    });
}, observerOptions);

// Elements to animate on all pages
const animateElements = [
    // Home page elements
    '.info-card',
    '.schedule-card',
    '.about-text',
    // Content sections
    '.content-main h3',
    '.content-main h4',
    '.content-main p',
    '.sidebar-card',
    // Timeline elements
    '.timeline-item',
    // Cards
    '.pricing-card',
    '.special-card',
    '.benefit-card',
    '.feature-card',
    '.package-card',
    '.profile-card-new',
    '.story-card',
    // Section titles
    '.section-title',
    // CTA sections
    '.cta-section h3',
    '.cta-section p',
    '.cta-section .btn',
    // Gallery items
    '.gallery-item-new',
    '.inline-gallery-item',
    // Other elements
    '.included-section',
    '.alternating-content',
    '.corporate-inline-media'
];

// Initialize animations
function initAnimations() {
    let delay = 0;

    animateElements.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
            // Skip if already has animation class
            if (el.classList.contains('animate-ready')) return;

            el.classList.add('animate-ready');

            // Add staggered delay for grouped elements
            const staggerDelay = index * 0.1;
            el.style.transitionDelay = `${staggerDelay}s`;

            observer.observe(el);
        });
    });
}

// Run animations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
} else {
    initAnimations();
}

// Carousel functionality
class Carousel {
    constructor(carouselName, autoRotate = true) {
        this.carouselName = carouselName;
        this.track = document.querySelector(`.carousel-track[data-carousel="${carouselName}"]`);
        this.prevBtn = document.querySelector(`.carousel-prev[data-carousel="${carouselName}"]`);
        this.nextBtn = document.querySelector(`.carousel-next[data-carousel="${carouselName}"]`);

        if (!this.track || !this.prevBtn || !this.nextBtn) {
            console.log(`Carousel "${carouselName}" not found`);
            return;
        }

        this.cards = Array.from(this.track.children);
        this.currentIndex = 0;
        this.autoRotate = autoRotate;
        this.autoRotateInterval = null;
        this.autoRotateDelay = 4000; // 4 seconds
        this.isHovered = false;

        this.init();
    }

    init() {
        // Set initial position
        this.updateCarousel();

        // Add button event listeners
        this.prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.prev();
            this.resetAutoRotate();
        });

        this.nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.next();
            this.resetAutoRotate();
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateCarousel();
            }, 250);
        });

        // Touch/swipe support
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.track.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.pauseAutoRotate();
        }, { passive: true });

        this.track.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
            this.resetAutoRotate();
        }, { passive: true });

        // Mouse drag support for desktop
        let isDragging = false;
        let startPos = 0;
        let currentTranslate = 0;
        let prevTranslate = 0;

        this.track.addEventListener('mousedown', (e) => {
            isDragging = true;
            startPos = e.clientX;
            this.track.style.cursor = 'grabbing';
            this.pauseAutoRotate();
        });

        this.track.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const currentPosition = e.clientX;
            currentTranslate = prevTranslate + currentPosition - startPos;
        });

        this.track.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            this.track.style.cursor = 'grab';
            const movedBy = e.clientX - startPos;

            if (movedBy < -50 && this.currentIndex < this.getMaxIndex()) {
                this.next();
            }
            if (movedBy > 50 && this.currentIndex > 0) {
                this.prev();
            }

            prevTranslate = currentTranslate;
            this.resetAutoRotate();
        });

        this.track.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                this.track.style.cursor = 'grab';
            }
        });

        // Pause auto-rotate on hover
        const container = this.track.closest('.carousel-container');
        if (container) {
            container.addEventListener('mouseenter', () => {
                this.isHovered = true;
                this.pauseAutoRotate();
            });

            container.addEventListener('mouseleave', () => {
                this.isHovered = false;
                this.startAutoRotate();
            });
        }

        // Set cursor style
        this.track.style.cursor = 'grab';

        // Start auto-rotation
        if (this.autoRotate) {
            this.startAutoRotate();
        }
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swiped left - go to next
                this.next();
            } else {
                // Swiped right - go to previous
                this.prev();
            }
        }
    }

    getCardsToShow() {
        const width = window.innerWidth;
        if (width <= 768) return 1;
        if (width <= 968) return 2;
        return 3;
    }

    getMaxIndex() {
        const cardsToShow = this.getCardsToShow();
        return Math.max(0, this.cards.length - cardsToShow);
    }

    updateCarousel() {
        if (!this.cards.length) return;

        const cardsToShow = this.getCardsToShow();
        const cardWidth = this.cards[0].offsetWidth;
        const gap = 32; // 2rem gap
        const offset = this.currentIndex * (cardWidth + gap);

        this.track.style.transform = `translateX(-${offset}px)`;

        // Update button states
        this.prevBtn.disabled = this.currentIndex === 0;
        this.nextBtn.disabled = this.currentIndex >= this.getMaxIndex();
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateCarousel();
        }
    }

    next() {
        const maxIndex = this.getMaxIndex();
        if (this.currentIndex < maxIndex) {
            this.currentIndex++;
            this.updateCarousel();
        } else {
            // Loop back to start for auto-rotate
            this.currentIndex = 0;
            this.updateCarousel();
        }
    }

    startAutoRotate() {
        if (!this.autoRotate || this.isHovered) return;

        this.pauseAutoRotate(); // Clear any existing interval

        this.autoRotateInterval = setInterval(() => {
            this.next();
        }, this.autoRotateDelay);
    }

    pauseAutoRotate() {
        if (this.autoRotateInterval) {
            clearInterval(this.autoRotateInterval);
            this.autoRotateInterval = null;
        }
    }

    resetAutoRotate() {
        this.pauseAutoRotate();
        if (this.autoRotate && !this.isHovered) {
            this.startAutoRotate();
        }
    }
}

// Initialize carousels when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
} else {
    initCarousels();
}

function initCarousels() {
    // Initialize pricing carousel with auto-rotate
    const pricingCarousel = new Carousel('pricing', true);
    // Initialize special memberships carousel with auto-rotate
    const specialCarousel = new Carousel('special', true);
    // Initialize gallery carousel
    initGalleryCarousel();
}

// Gallery Carousel - Auto-rotating revolving door style
function initGalleryCarousel() {
    const track = document.querySelector('.gallery-carousel-track');
    const dotsContainer = document.querySelector('.gallery-carousel-dots');

    if (!track || !dotsContainer) return;

    const cards = Array.from(track.children);
    if (cards.length === 0) return;

    let currentIndex = 0;
    let autoRotateInterval = null;
    const autoRotateDelay = 5000; // 5 seconds
    let isHovered = false;

    // Create dots
    cards.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.classList.add('gallery-carousel-dot');
        dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
            goToSlide(index);
            resetAutoRotate();
        });
        dotsContainer.appendChild(dot);
    });

    const dots = Array.from(dotsContainer.children);

    function updateCarousel() {
        // Move track
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        // Update dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function goToSlide(index) {
        currentIndex = index;
        updateCarousel();
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % cards.length;
        updateCarousel();
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        updateCarousel();
    }

    function startAutoRotate() {
        if (isHovered) return;
        autoRotateInterval = setInterval(nextSlide, autoRotateDelay);
    }

    function stopAutoRotate() {
        if (autoRotateInterval) {
            clearInterval(autoRotateInterval);
            autoRotateInterval = null;
        }
    }

    function resetAutoRotate() {
        stopAutoRotate();
        if (!isHovered) {
            startAutoRotate();
        }
    }

    // Pause on hover
    const container = track.closest('.gallery-carousel');
    if (container) {
        container.addEventListener('mouseenter', () => {
            isHovered = true;
            stopAutoRotate();
        });

        container.addEventListener('mouseleave', () => {
            isHovered = false;
            startAutoRotate();
        });
    }

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoRotate();
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        resetAutoRotate();
    }, { passive: true });

    // Keyboard navigation
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            prevSlide();
            resetAutoRotate();
        } else if (e.key === 'ArrowRight') {
            nextSlide();
            resetAutoRotate();
        }
    });

    // Start auto-rotation
    startAutoRotate();
}

// Floating CTA for mobile
function initFloatingCTA() {
    // Only show on mobile (968px and below)
    if (window.innerWidth > 968) return;

    // Check if already dismissed in this session
    if (sessionStorage.getItem('ctaDismissed')) return;

    // Get the book link - use index.html#book for non-index pages, #book for index
    const isIndexPage = window.location.pathname.endsWith('index.html') ||
                        window.location.pathname.endsWith('/') ||
                        window.location.pathname === '';
    const bookLink = isIndexPage ? '#book' : 'index.html#book';

    // Create floating CTA container
    const floatingCTA = document.createElement('div');
    floatingCTA.className = 'floating-cta';
    floatingCTA.innerHTML = `
        <a href="${bookLink}" class="cta-link">Book Taster Session</a>
        <button class="cta-close" aria-label="Close">×</button>
    `;

    document.body.appendChild(floatingCTA);

    // Handle close button
    const closeBtn = floatingCTA.querySelector('.cta-close');
    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        floatingCTA.classList.add('dismissed');
        sessionStorage.setItem('ctaDismissed', 'true');
    });

    // Handle CTA link click - close the floating CTA
    const ctaLink = floatingCTA.querySelector('.cta-link');
    ctaLink.addEventListener('click', () => {
        floatingCTA.classList.add('dismissed');
    });
}

// Initialize floating CTA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingCTA);
} else {
    initFloatingCTA();
}

// =============================================
// INDEX CONTACT TOGGLE
// =============================================
const contactToggleBtn = document.getElementById('contactToggleBtn');
const indexContactFormWrap = document.getElementById('indexContactFormWrap');
if (contactToggleBtn && indexContactFormWrap) {
    contactToggleBtn.addEventListener('click', () => {
        const isOpen = indexContactFormWrap.classList.toggle('open');
        contactToggleBtn.textContent = isOpen ? 'Close' : 'Contact Us';
        if (isOpen) {
            indexContactFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

// =============================================
// LEGACY PAGE
// =============================================
if (document.body.classList.contains('legacy-page')) {

    // Hero bg zoom
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) heroBg.classList.add('loaded');

    // Section fade-in
    const storySections = document.querySelectorAll('.story-section');
    const leaderCards   = document.querySelectorAll('.leader-card');
    const finalSection  = document.querySelector('.legacy-final');

    const sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.18 });
    storySections.forEach(s => sectionObserver.observe(s));

    const cardObserver = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.2 });
    leaderCards.forEach(c => cardObserver.observe(c));

    const leadershipSection = document.querySelector('.leadership-section');
    const leadershipObserver = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.15 });
    if (leadershipSection) leadershipObserver.observe(leadershipSection);

    const finalObserver = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.15 });
    if (finalSection) finalObserver.observe(finalSection);

    // Decorative SVG path — Catmull-Rom through text panel centres
    function catmullRomPath(pts) {
        if (pts.length < 2) return '';
        let d = `M ${pts[0][0]},${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(pts.length - 1, i + 2)];
            const tension = 0.4;
            const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
            const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
            const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
            const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
            d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
        }
        return d;
    }

    function buildStoryPath() {
        const wrapper  = document.getElementById('legacy-story');
        const svgEl    = document.getElementById('story-svg');
        const pathEl   = document.getElementById('story-line');
        const circleEl = document.getElementById('story-circle');
        if (!wrapper || !svgEl || !pathEl || !circleEl) return;

        const W = wrapper.offsetWidth;
        const H = wrapper.offsetHeight;

        svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svgEl.setAttribute('width',  W);
        svgEl.setAttribute('height', H);

        // Anchor points through text panel centres
        const anchors = [[W * 0.5, 0]];
        wrapper.querySelectorAll('.story-section').forEach(section => {
            const textPanel = section.querySelector('.story-text-panel');
            if (!textPanel) return;
            let el = textPanel, ox = 0, oy = 0;
            while (el && el !== wrapper) { ox += el.offsetLeft; oy += el.offsetTop; el = el.offsetParent; }
            anchors.push([ox + textPanel.offsetWidth * 0.5, oy + textPanel.offsetHeight * 0.5]);
        });
        anchors.push([W * 0.5, H]);

        pathEl.setAttribute('d', catmullRomPath(anchors));

        // Clip path: full area minus image panels (hides line/circle behind photos)
        const clipEl    = document.getElementById('path-clip');
        const clipGroup = document.getElementById('story-clip-group');
        let clipD = `M0,0 H${W} V${H} H0 Z`;
        wrapper.querySelectorAll('.story-image-panel').forEach(panel => {
            let el = panel, ox = 0, oy = 0;
            while (el && el !== wrapper) { ox += el.offsetLeft; oy += el.offsetTop; el = el.offsetParent; }
            clipD += ` M${ox},${oy} H${ox + panel.offsetWidth} V${oy + panel.offsetHeight} H${ox} Z`;
        });
        clipEl.innerHTML = '';
        const cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        cp.setAttribute('d', clipD);
        cp.setAttribute('fill-rule', 'evenodd');
        cp.setAttribute('clip-rule', 'evenodd');
        clipEl.appendChild(cp);
        clipGroup.setAttribute('clip-path', 'url(#path-clip)');

        // Scroll-driven circle
        const totalLength = pathEl.getTotalLength();
        pathEl.style.strokeDasharray  = '';
        pathEl.style.strokeDashoffset = '';

        function update() {
            const wrapperOffsetTop = wrapper.getBoundingClientRect().top + window.scrollY;
            const viewportCentre   = window.scrollY + window.innerHeight * 0.5;
            const progress = Math.max(0, Math.min(1, (viewportCentre - wrapperOffsetTop) / H));
            const pt = pathEl.getPointAtLength(progress * totalLength);
            circleEl.setAttribute('cx', pt.x.toFixed(1));
            circleEl.setAttribute('cy', pt.y.toFixed(1));
        }

        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    if (document.readyState === 'complete') {
        buildStoryPath();
    } else {
        window.addEventListener('load', buildStoryPath);
    }

    // Scroll parallax on story image panels via object-position shift
    function updateImageParallax() {
        if (window.innerWidth <= 900) return;
        document.querySelectorAll('.story-image-panel').forEach(panel => {
            const rect = panel.getBoundingClientRect();
            const centreOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
            const shift = Math.round(50 + centreOffset * 14);
            const img = panel.querySelector('img');
            if (img) img.style.objectPosition = `center ${shift}%`;
        });
    }
    window.addEventListener('scroll', updateImageParallax, { passive: true });
    updateImageParallax();

    let legacyResizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(legacyResizeTimer);
        legacyResizeTimer = setTimeout(buildStoryPath, 200);
    });
}
