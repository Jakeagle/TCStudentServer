/**
 * UI Enhancement Module
 * Adds dynamic interactions and modern UI behaviors to complement the new design
 */

// Enhanced notification system
export function showNotification(message, type = 'info', duration = 5000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  notification.innerHTML = `
    <div class="notification-content">
      ${message}
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after duration
  setTimeout(() => {
    if (notification && notification.parentElement) {
      notification.style.animation =
        'slideOutNotification 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);

  return notification;
}

// Add loading state to buttons
export function setLoadingState(element, isLoading = true) {
  if (isLoading) {
    element.classList.add('loading-state');
    element.setAttribute('data-original-text', element.textContent);
    element.textContent = 'Loading...';
  } else {
    element.classList.remove('loading-state');
    const originalText = element.getAttribute('data-original-text');
    if (originalText) {
      element.textContent = originalText;
      element.removeAttribute('data-original-text');
    }
  }
}

// Add hover effects to elements
export function initializeHoverEffects() {
  // Add hover lift effect to cards
  const cards = document.querySelectorAll(
    '.balanceBlock, .incomeBlock, .spendingBlock, .billsBlock',
  );
  cards.forEach(card => {
    if (!card.classList.contains('hover-lift')) {
      card.classList.add('hover-lift');
    }
  });

  // Add glow effect to important buttons
  const importantButtons = document.querySelectorAll(
    '.form__btn--transfer, .signInBtn, .signUpBtn',
  );
  importantButtons.forEach(button => {
    if (!button.classList.contains('hover-glow')) {
      button.classList.add('hover-glow');
    }
  });

  // Add pulse effect to lessons
  const lessons = document.querySelectorAll('.lessonDiv');
  lessons.forEach(lesson => {
    if (!lesson.classList.contains('pulse-on-hover')) {
      lesson.classList.add('pulse-on-hover');
    }
  });
}

// Smooth scroll functionality
export function smoothScrollTo(element, duration = 800) {
  const target =
    typeof element === 'string' ? document.querySelector(element) : element;
  if (!target) return;

  const startPosition = window.pageYOffset;
  const targetPosition = target.getBoundingClientRect().top + startPosition;
  const distance = targetPosition - startPosition;
  let startTime = null;

  function animation(currentTime) {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  }

  function ease(t, b, c, d) {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t + b;
    t--;
    return (-c / 2) * (t * (t - 2) - 1) + b;
  }

  requestAnimationFrame(animation);
}

// Enhanced form validation with visual feedback
export function validateInput(input, validationFn, errorMessage) {
  const isValid = validationFn(input.value);

  // Remove existing validation classes
  input.classList.remove('input-valid', 'input-invalid');

  // Remove existing error message
  const existingError = input.parentElement.querySelector('.validation-error');
  if (existingError) {
    existingError.remove();
  }

  if (isValid) {
    input.classList.add('input-valid');
    return true;
  } else {
    input.classList.add('input-invalid');

    // Add error message
    const errorElement = document.createElement('div');
    errorElement.className = 'validation-error';
    errorElement.textContent = errorMessage;
    input.parentElement.appendChild(errorElement);

    return false;
  }
}

// Animate elements on scroll
export function initializeScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);

  // Observe elements that should animate on scroll
  const animateElements = document.querySelectorAll(
    '.balanceBlock, .incomeBlock, .spendingBlock, .billsBlock, .lessonDiv',
  );
  animateElements.forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}

// Modern ripple effect for buttons
export function addRippleEffect(button) {
  button.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
    ripple.style.top = e.clientY - rect.top - size / 2 + 'px';
    ripple.classList.add('ripple');

    this.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
}

// Initialize all UI enhancements
export function initializeUIEnhancements() {
  // Initialize hover effects
  initializeHoverEffects();

  // Initialize scroll animations
  if ('IntersectionObserver' in window) {
    initializeScrollAnimations();
  }

  // Add ripple effects to modern buttons
  const modernButtons = document.querySelectorAll(
    '.btn-modern, .form__btn--transfer',
  );
  modernButtons.forEach(addRippleEffect);

  // Add smooth scrolling to anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        smoothScrollTo(target);
      }
    });
  });

  console.log('🎨 UI Enhancements initialized successfully!');
}

// CSS for additional dynamic effects
const additionalStyles = `
  .input-valid {
    border-color: #43e97b !important;
    box-shadow: 0 0 15px rgba(67, 233, 123, 0.3) !important;
  }
  
  .input-invalid {
    border-color: #ff6b6b !important;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.3) !important;
  }
  
  .validation-error {
    color: #ff6b6b;
    font-size: 0.8rem;
    margin-top: 5px;
    font-weight: 500;
    animation: fadeInUp 0.3s ease-out;
  }
  
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: rippleEffect 0.6s linear;
    pointer-events: none;
  }
  
  @keyframes rippleEffect {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
  
  @keyframes slideOutNotification {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(500px);
      opacity: 0;
    }
  }
  
  .animate-in {
    animation-delay: 0s !important;
  }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUIEnhancements);
} else {
  initializeUIEnhancements();
}
