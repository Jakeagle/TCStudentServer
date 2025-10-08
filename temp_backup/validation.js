'use strict';

/**
 * Utility functions for input validation and user feedback across the Trinity Capital app
 */

/**
 * Show notification to user with different styles based on type
 */
let notificationTimeout;

export function showNotification(message, type = 'info', duration = 4000) {
  // Clear any existing timeout to prevent overlapping notifications
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  // Debug log to confirm function is called
  console.log('[showNotification] Called with:', { message, type, duration });

  // Remove any existing notifications (single notification at a time)
  const existingNotifications = document.querySelectorAll(
    '.trinity-notification',
  );
  if (existingNotifications.length > 0) {
    console.log(
      '[showNotification] Removing previous notifications:',
      existingNotifications.length,
    );
  }
  existingNotifications.forEach(notification => notification.remove());

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `trinity-notification trinity-notification-${type}`;
  notification.setAttribute('role', 'alert'); // Accessibility
  notification.setAttribute('aria-live', 'assertive');
  notification.innerHTML = message;

  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    max-width: 350px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    line-height: 1.4;
    border-left: 4px solid rgba(255, 255, 255, 0.3);
    opacity: 0;
    transform: translateX(100%);
  `;

  // Set color and icon based on type
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#4CAF50';
      notification.innerHTML = `✓ ${message}`;
      break;
    case 'error':
      notification.style.backgroundColor = '#f44336';
      notification.innerHTML = `✗ ${message}`;
      break;
    case 'warning':
      notification.style.backgroundColor = '#ff9800';
      notification.innerHTML = `⚠ ${message}`;
      break;
    default:
      notification.style.backgroundColor = '#2196F3';
      notification.innerHTML = `ℹ ${message}`;
  }

  // Ensure document.body is available before appending
  if (!document.body) {
    console.error(
      '[showNotification] document.body not available! Notification cannot be displayed.',
    );
    return;
  }

  // Append notification to the body
  document.body.appendChild(notification);
  console.log('[showNotification] Notification appended to body.');

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
    console.log('[showNotification] Notification animated in.');
  }, 10);

  // Remove after specified duration
  notificationTimeout = setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
        console.log('[showNotification] Notification removed from DOM.');
      }
    }, 300);
  }, duration);
}

/**
 * Validate monetary amount input
 */
export function validateAmount(amount, options = {}) {
  const {
    min = 0.01,
    max = 1000000,
    allowNegative = false,
    fieldName = 'Amount',
  } = options;

  const errors = [];
  const numAmount = parseFloat(amount);

  if (!amount || amount.toString().trim() === '') {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (isNaN(numAmount)) {
    errors.push(`${fieldName} must be a valid number`);
    return errors;
  }

  if (!allowNegative && numAmount < 0) {
    errors.push(`${fieldName} cannot be negative`);
  }

  if (numAmount < min) {
    errors.push(`${fieldName} must be at least $${min.toFixed(2)}`);
  }

  if (numAmount > max) {
    errors.push(`${fieldName} cannot exceed $${max.toLocaleString()}`);
  }

  // Check for reasonable decimal places (max 2)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push(`${fieldName} cannot have more than 2 decimal places`);
  }

  return errors;
}

/**
 * Validate text input (names, descriptions, etc.)
 */
export function validateText(text, options = {}) {
  const {
    minLength = 1,
    maxLength = 100,
    required = true,
    fieldName = 'Field',
    allowNumbers = true,
    allowSpecialChars = true,
  } = options;

  const errors = [];
  const trimmedText = text ? text.toString().trim() : '';

  if (required && !trimmedText) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (trimmedText.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters long`);
  }

  if (trimmedText.length > maxLength) {
    errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  if (!allowNumbers && /\d/.test(trimmedText)) {
    errors.push(`${fieldName} cannot contain numbers`);
  }

  if (!allowSpecialChars && /[^a-zA-Z\s]/.test(trimmedText)) {
    errors.push(`${fieldName} can only contain letters and spaces`);
  }

  return errors;
}

/**
 * Validate date input
 */
export function validateDate(dateInput, options = {}) {
  const {
    allowPast = true,
    allowFuture = true,
    fieldName = 'Date',
    maxFutureDays = 365,
    maxPastDays = 365,
  } = options;

  const errors = [];

  if (!dateInput) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  const inputDate = new Date(dateInput);
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0); // Reset time for date comparison

  if (isNaN(inputDate.getTime())) {
    errors.push(`${fieldName} must be a valid date`);
    return errors;
  }

  const daysDiff = Math.floor(
    (inputDate - currentDate) / (1000 * 60 * 60 * 24),
  );

  if (!allowFuture && daysDiff > 0) {
    errors.push(`${fieldName} cannot be in the future`);
  }

  if (!allowPast && daysDiff < 0) {
    errors.push(`${fieldName} cannot be in the past`);
  }

  if (allowFuture && daysDiff > maxFutureDays) {
    errors.push(
      `${fieldName} cannot be more than ${maxFutureDays} days in the future`,
    );
  }

  if (allowPast && Math.abs(daysDiff) > maxPastDays) {
    errors.push(
      `${fieldName} cannot be more than ${maxPastDays} days in the past`,
    );
  }

  return errors;
}

/**
 * Validate selection from dropdown
 */
export function validateSelection(value, options = {}) {
  const { fieldName = 'Selection', allowEmpty = false } = options;
  const errors = [];

  if (!allowEmpty && (!value || value === '' || value === 'default')) {
    errors.push(`Please select a ${fieldName.toLowerCase()}`);
  }

  return errors;
}

/**
 * Validate signature format (initials)
 */
export function validateSignature(
  signature,
  expectedSignature,
  fieldName = 'Signature',
) {
  const errors = [];
  const trimmedSignature = signature ? signature.trim().toLowerCase() : '';
  const expectedSig = expectedSignature ? expectedSignature.toLowerCase() : '';

  if (!trimmedSignature) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (trimmedSignature !== expectedSig) {
    errors.push(`${fieldName} must be your initials (${expectedSignature})`);
  }

  return errors;
}

/**
 * Add loading state to button
 */
export function setButtonLoading(button, isLoading, originalText) {
  if (isLoading) {
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'not-allowed';
    button.textContent = 'Processing...';
  } else {
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.textContent = originalText;
  }
}

/**
 * Clear form errors and reset styling
 */
export function clearFormErrors(form) {
  const errorElements = form.querySelectorAll('.error-message');
  errorElements.forEach(el => el.remove());

  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.style.borderColor = '';
    input.style.backgroundColor = '';
  });
}

/**
 * Highlight form field with error
 */
export function highlightFieldError(field) {
  field.style.borderColor = '#f44336';
  field.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
}

/**
 * Remove error highlighting from field
 */
export function clearFieldError(field) {
  field.style.borderColor = '';
  field.style.backgroundColor = '';
}

/**
 * Generic form validation wrapper
 */
export function validateForm(validationRules) {
  const allErrors = [];
  const fieldErrors = {};

  validationRules.forEach(rule => {
    const { field, value, validations, fieldName } = rule;
    const errors = [];

    validations.forEach(validation => {
      const validationErrors = validation(value, { fieldName });
      errors.push(...validationErrors);
    });

    if (errors.length > 0) {
      fieldErrors[fieldName] = errors;
      allErrors.push(...errors);
      if (field) highlightFieldError(field);
    } else {
      if (field) clearFieldError(field);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    fieldErrors,
  };
}
