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

// Form submission handling
const bookForm = document.querySelector('.book-form');
if (bookForm) {
    bookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your interest! We will contact you shortly to confirm your taster session.');
        bookForm.reset();
    });
}

// Animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.info-card, .schedule-card, .about-text').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

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
