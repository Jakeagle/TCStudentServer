'use strict';
import { currentProfile } from './script.js';
import {
  showNotification,
  validateAmount,
  validateText,
  validateSelection,
  setButtonLoading,
} from './validation.js';

/**********************************************Variables***********************************************/

const billFrequency = document.querySelector('.billFrequency');
const paymentFrequency = document.querySelector('.paymentFrequency');
const billInput = document.querySelector('.form__input--amount--bills');
const paymentInput = document.querySelector('.form__input--amount--payments');
const billName = document.querySelector('.billInputName');
const paymentName = document.querySelector('.paymentName');
const billsBTN = document.querySelector('.form__btn--bills');
const paymentsBTN = document.querySelector('.form__btn--payments');
const billTypeSelect = document.querySelector('.billType');
const paymentTypeSelect = document.querySelector('.paymentType');

export let billInterval;
export let payInterval;
let billType;
let paymentType;

const socket = io('http://localhost:3000');
const billURL = `http://localhost:3000/bills`;
const schedulerStatusURL = `http://localhost:3000/scheduler/status`;

/**********************************************Functions***********************************************/

/**
 * Enhanced bill/payment data sender with better error handling and validation
 */
async function sendBillData(type, amount, interval, name, cat, date) {
  try {
    // Validate inputs
    if (!currentProfile) {
      throw new Error('No user profile loaded');
    }
    if (!amount || amount === 0) {
      throw new Error('Amount must be greater than 0');
    }
    if (!interval) {
      throw new Error('Please select a frequency');
    }
    if (!name || name.trim() === '') {
      throw new Error('Please enter a name');
    }
    if (!cat) {
      throw new Error('Please select a category');
    }

    console.log(`Sending ${type} data:`, {
      type,
      amount,
      interval,
      name,
      cat,
      date,
    });

    const response = await fetch(billURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: [currentProfile, type, amount, interval, name, cat, date],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Server error: ${response.status}`);
    }

    console.log(`${type} scheduled successfully:`, result);

    // Show success message
    showNotification(
      `${type.charAt(0).toUpperCase() + type.slice(1)} scheduled successfully!`,
      'success',
    );

    // Clear form
    clearForm(type);

    // Update scheduler status display
    await updateSchedulerStatus();

    return result;
  } catch (error) {
    console.error(`Error sending ${type} data:`, error);
    showNotification(`Error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Clear form fields after successful submission
 */
function clearForm(type) {
  if (type === 'bill') {
    billInput.value = '';
    billName.value = '';
    billFrequency.selectedIndex = 0;
    billTypeSelect.selectedIndex = 0;
    billInterval = '';
    billType = '';
  } else if (type === 'payment') {
    paymentInput.value = '';
    paymentName.value = '';
    paymentFrequency.selectedIndex = 0;
    paymentTypeSelect.selectedIndex = 0;
    payInterval = '';
    paymentType = '';
  }
}

/**
 * Update scheduler status display
 */
async function updateSchedulerStatus() {
  try {
    const response = await fetch(schedulerStatusURL);
    if (response.ok) {
      const status = await response.json();
      console.log('Scheduler Status:', status);

      // Update UI element if it exists
      const statusElement = document.getElementById('scheduler-status');
      if (statusElement) {
        statusElement.textContent = `Active Jobs: ${status.totalScheduledJobs}`;
      }
    }
  } catch (error) {
    console.error('Error updating scheduler status:', error);
  }
}

/**
 * Validate form inputs before submission using shared validation utilities
 */
function validateForm(type) {
  const inputs =
    type === 'bill'
      ? {
          amount: billInput.value,
          name: billName.value,
          interval: billInterval,
          category: billType,
        }
      : {
          amount: paymentInput.value,
          name: paymentName.value,
          interval: payInterval,
          category: paymentType,
        };

  const errors = [];

  // Validate amount
  const amountErrors = validateAmount(inputs.amount, {
    min: 0.01,
    max: 50000,
    fieldName: `${type.charAt(0).toUpperCase() + type.slice(1)} Amount`,
  });
  errors.push(...amountErrors);

  // Validate name
  const nameErrors = validateText(inputs.name, {
    minLength: 2,
    maxLength: 50,
    fieldName: `${type.charAt(0).toUpperCase() + type.slice(1)} Name`,
  });
  errors.push(...nameErrors);

  // Validate selections
  const intervalErrors = validateSelection(inputs.interval, {
    fieldName: 'Frequency',
  });
  errors.push(...intervalErrors);

  const categoryErrors = validateSelection(inputs.category, {
    fieldName: 'Category',
  });
  errors.push(...categoryErrors);

  return errors;
}

/**********************************************Event Listeners***********************************************/

// Handle bill frequency changes
billFrequency.addEventListener('change', function (event) {
  const selectedOption = event.target.selectedOptions[0];
  billInterval = selectedOption.value;
  console.log('Bill interval set:', billInterval);
});

// Handle bill type changes
billTypeSelect.addEventListener('change', function (event) {
  const selectedOption = event.target.selectedOptions[0];
  billType = selectedOption.value;
  console.log('Bill type set:', billType);
});

// Handle payment type changes
paymentTypeSelect.addEventListener('change', function (event) {
  const selectedOption = event.target.selectedOptions[0];
  paymentType = selectedOption.value;
  console.log('Payment type set:', paymentType);
});

// Handle payment frequency changes
paymentFrequency.addEventListener('change', function (event) {
  const selectedOption = event.target.selectedOptions[0];
  payInterval = selectedOption.value;
  console.log('Payment interval set:', payInterval);
});

// Handle bill submission with validation
billsBTN.addEventListener('click', async function (event) {
  event.preventDefault();

  const originalText = billsBTN.textContent;
  setButtonLoading(billsBTN, true, originalText);

  try {
    console.log('Bill button clicked', currentProfile);

    // Validate form
    const errors = validateForm('bill');
    if (errors.length > 0) {
      showNotification(errors.join(', '), 'error');
      return;
    }

    const newDate = new Date().toISOString();

    const result = await sendBillData(
      'bill',
      parseInt(-Math.abs(billInput.value)), // Ensure bills are negative
      billInterval,
      billName.value.trim(),
      billType,
      newDate,
    );

    // Direct lesson engine call for bill creation
    if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
      await lessonEngine.onAppAction('bill_created', {
        amount: parseInt(-Math.abs(billInput.value)),
        interval: billInterval,
        name: billName.value.trim(),
        category: billType,
        date: newDate,
        user: currentProfile?.memberName || currentProfile?.userName || '',
      });
    }
  } catch (error) {
    console.error('Error processing bill:', error);
  } finally {
    setTimeout(() => {
      setButtonLoading(billsBTN, false, originalText);
    }, 1000);
  }
});

// Handle payment submission with validation
paymentsBTN.addEventListener('click', async function (event) {
  event.preventDefault();

  const originalText = paymentsBTN.textContent;
  setButtonLoading(paymentsBTN, true, originalText);

  try {
    console.log('Payment button clicked', currentProfile);

    // Validate form
    const errors = validateForm('payment');
    if (errors.length > 0) {
      showNotification(errors.join(', '), 'error');
      return;
    }

    const newDate = new Date().toISOString();

    const result = await sendBillData(
      'payment',
      parseInt(Math.abs(paymentInput.value)), // Ensure payments are positive
      payInterval,
      paymentName.value.trim(),
      paymentType,
      newDate,
    );

    // Direct lesson engine call for payment creation
    if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
      await lessonEngine.onAppAction('payment_created', {
        amount: parseInt(Math.abs(paymentInput.value)),
        interval: payInterval,
        name: paymentName.value.trim(),
        category: paymentType,
        date: newDate,
        user: currentProfile?.memberName || currentProfile?.userName || '',
      });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
  } finally {
    setTimeout(() => {
      setButtonLoading(paymentsBTN, false, originalText);
    }, 1000);
  }
});

/**********************************************Initialization***********************************************/

// Initialize scheduler status on page load
document.addEventListener('DOMContentLoaded', function () {
  updateSchedulerStatus();

  // Update status periodically
  setInterval(updateSchedulerStatus, 30000); // Every 30 seconds
});

// Export functions for external use
export { sendBillData, updateSchedulerStatus, showNotification };
