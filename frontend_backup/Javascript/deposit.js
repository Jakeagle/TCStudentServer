'use strict';

import { getInfoProfiles } from './script.js';
import { currentProfile } from './script.js';
import {
  showNotification,
  validateAmount,
  validateText,
  validateDate,
  validateSignature,
  setButtonLoading,
  validateForm,
} from './validation.js';

console.log(currentProfile);

/**************************************************Variables ***********************************************/

const name = $('.nameInput');

const dest = document.querySelector('.destInput');

const amount = $('.amountInput');

const date = $('.dateInput');

const signature = $('.sigInput');

const submit = $('.submitBtn');

const mainApp = $('.mainApp');

const backBTN = $('.backBtn');

const loginBTN = document.querySelector('.login__btn');

const depositLink = 'http://localhost:3000/deposits';

mainApp.css('display', 'none');

/******************************************************Event listeners **************************************/
backBTN.click(function () {
  location.replace('index.html');
});

submit.click(function (e) {
  e.preventDefault();

  const originalText = submit.text();
  setButtonLoading(submit[0], true, originalText);

  try {
    validateAndProcessDeposit();
  } finally {
    setTimeout(() => {
      setButtonLoading(submit[0], false, originalText);
    }, 1500);
  }
});

// Expose function to global scope to be called after login
window.initializeDeposit = initializeDeposit;

function initializeDeposit() {
  // Check if user is logged in
  if (!currentProfile || !currentProfile.memberName) {
    console.warn('User not logged in or member name not found');
    return;
  }

  console.log(currentProfile.memberName);
}

/********************************************************Functions *****************************************/

/**
 * Generate expected signature for current user
 */
function generateExpectedSignature() {
  if (!currentProfile || !currentProfile.memberName) {
    return '';
  }

  return currentProfile.memberName
    .toLowerCase()
    .split(' ')
    .map(name => name[0])
    .join('');
}

/**
 * Validate and process deposit with comprehensive validation
 */
const validateAndProcessDeposit = function () {
  const nameValue = name.val();
  const amountValue = amount.val();
  const dateValue = date.val();
  const signatureValue = signature.val();

  // Use the new payee manager for validation
  const payeeValidation = window.checkPayeeManager
    ? window.checkPayeeManager.validateSelection()
    : null;

  if (!payeeValidation || !payeeValidation.isValid) {
    showNotification(
      payeeValidation?.error || 'Please select a valid recipient',
      'error',
    );
    return;
  }

  const destValue = payeeValidation.payee.name;

  const expectedSignature = generateExpectedSignature();

  // Define validation rules
  const validationRules = [
    {
      field: name[0],
      value: nameValue,
      validations: [
        value =>
          validateText(value, {
            fieldName: 'Name',
            allowNumbers: false,
            allowSpecialChars: false,
          }),
        value => {
          if (value && value.trim() !== currentProfile.memberName) {
            return ['Name must match the account holder name'];
          }
          return [];
        },
      ],
      fieldName: 'Name',
    },
    {
      field: amount[0],
      value: amountValue,
      validations: [
        value =>
          validateAmount(value, {
            min: 0.01,
            max: 10000,
            fieldName: 'Deposit Amount',
          }),
      ],
      fieldName: 'Amount',
    },
    {
      field: date[0],
      value: dateValue,
      validations: [
        value =>
          validateDate(value, {
            allowFuture: false,
            fieldName: 'Date',
            maxPastDays: 30,
          }),
      ],
      fieldName: 'Date',
    },
    {
      field: signature[0],
      value: signatureValue,
      validations: [
        value => validateSignature(value, expectedSignature, 'Signature'),
      ],
      fieldName: 'Signature',
    },
  ];

  // Payee validation is already handled above
  // No need for additional destination validation here

  // Run validation
  const validation = validateForm(validationRules);

  if (!validation.isValid) {
    showNotification(validation.errors.join(', '), 'error');
    return;
  }

  // If validation passes, process the deposit
  processDeposit();
};

const processDeposit = function () {
  console.log('Processing deposit...');

  let userDeposit = parseFloat(amount.val());
  let member = currentProfile.memberName;

  // Get the selected payee information
  const payeeInfo = window.checkPayeeManager
    ? window.checkPayeeManager.getSelectedPayee()
    : null;

  if (!payeeInfo) {
    showNotification('Error: Could not get payee information', 'error');
    return;
  }

  let destination = payeeInfo.name;

  console.log(
    `📝 Check written to: ${payeeInfo.displayName} (${payeeInfo.type})`,
  );
  sendDeposit(userDeposit, destination, member);
};

// Legacy function - keeping for backward compatibility but with validation
const checkAll = function () {
  validateAndProcessDeposit();
};
export async function sendDeposit(loan, destination, member) {
  try {
    showNotification('Processing deposit...', 'info');

    const res = await fetch(depositLink, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: [loan, destination, member],
      }),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const result = await res.json();

    showNotification(
      `Deposit of $${loan.toFixed(2)} completed successfully!`,
      'success',
    );

    // Record deposit action using lesson engine
    if (window.lessonEngine && window.lessonEngine.initialized) {
      await window.lessonEngine.onAppAction('deposit', {
        amount: loan,
        destination: destination,
        member: member,
        transactionType: 'deposit',
        timestamp: new Date().toISOString(),
      });

      console.log(
        '✅ Deposit action recorded for lesson tracking:',
        `$${loan.toFixed(2)} to ${destination}`,
      );
    } else {
      console.warn(
        '⚠️ Lesson engine not available - deposit tracking disabled',
      );
    }

    // Clear form
    name.val('');
    amount.val('');
    date.val('');
    signature.val('');

    // Reset the payee dropdown
    if (window.checkPayeeManager) {
      window.checkPayeeManager.reset();
    }

    return result;
  } catch (error) {
    console.error('Deposit failed:', error);
    showNotification(`Deposit failed: ${error.message}`, 'error');
    throw error;
  }
}
