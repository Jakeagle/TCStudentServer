'use strict';

//import profiles object from App.js
import { currentProfile } from './script.js';
import { initialBalance } from './script.js';
import {
  showNotification,
  validateAmount,
  validateSelection,
  setButtonLoading,
} from './validation.js';

/************************************************Variables*************************************************/

const inputPIN = document.querySelector('.login__input--pin--transfer');

const btnPIN = document.querySelector('.login__btn--transfer');

const accountListFrom = document.querySelector('.accountsListFrom');

const accountListToo = document.querySelector('.accountsListTo');

const loginButton = document.querySelector('.login__btn');

const amountInput = document.querySelector('.form__input--amount--transfer');

const btnAmount = document.querySelector('.form__btn--transfer');

const mainApp = document.querySelector('.mainSection');

const backBTN = document.querySelector('.backBtn');

let accountSend;

let accountRecieve;

let amount;

const transferLink = `http://localhost:3000/transfer`;

/************************************************Functions*************************************************/

console.log(currentProfile);

/**
 * Validate transfer form inputs
 */
function validateTransferForm(fromAccount, toAccount, amount) {
  const errors = [];

  // Validate account selection
  const fromErrors = validateSelection(fromAccount, {
    fieldName: 'From Account',
  });
  const toErrors = validateSelection(toAccount, { fieldName: 'To Account' });
  errors.push(...fromErrors, ...toErrors);

  // Check if accounts are different
  if (fromAccount && toAccount && fromAccount === toAccount) {
    errors.push('You cannot transfer to the same account');
  }

  // Validate amount
  const amountErrors = validateAmount(amount, {
    min: 0.01,
    max: 50000,
    fieldName: 'Transfer Amount',
  });
  errors.push(...amountErrors);

  // Check if user has sufficient funds
  if (fromAccount && amount && !isNaN(amount)) {
    const accounts = [
      currentProfile.checkingAccount,
      currentProfile.savingsAccount,
    ];
    const fromAccountObj = accounts.find(
      acc => acc.accountNumber === fromAccount,
    );

    if (fromAccountObj && parseFloat(amount) > fromAccountObj.balanceTotal) {
      errors.push('Insufficient funds in selected account');
    }
  }

  return errors;
}

// Expose function to global scope to be called after login
window.accountSetup = accountSetup;

function accountSetup() {
  // Check if user is logged in
  if (
    !currentProfile ||
    !currentProfile.checkingAccount ||
    !currentProfile.savingsAccount
  ) {
    console.warn('User not logged in or accounts not found');
    return;
  }

  let accounts = [
    currentProfile.checkingAccount,
    currentProfile.savingsAccount,
  ];

  accounts.forEach(account => {
    let option = document.createElement('option');

    option.value = account.accountNumber;

    option.textContent = `${
      account.accountType
    }----------${account.accountNumber.slice(-4)}`;
    accountListFrom.appendChild(option);
  });

  accounts.forEach(account => {
    let option = document.createElement('option');

    option.value = account.accountNumber;

    option.textContent = `${
      account.accountType
    }----------${account.accountNumber.slice(-4)}`;
    accountListToo.appendChild(option);
  });
}
//Handles math for transfer
const transPush = function (from, to) {
  try {
    const amount = parseFloat(amountInput.value);

    // Validate the transfer
    const errors = validateTransferForm(from, to, amount);

    if (errors.length > 0) {
      showNotification(errors.join(', '), 'error');
      return;
    }

    let accountFrom;
    let accountTo;

    let accounts = [
      currentProfile.checkingAccount,
      currentProfile.savingsAccount,
    ];

    accounts.forEach(account => {
      if (from === account.accountNumber) {
        accountFrom = account;
        console.log(accountFrom, 'from');
      }
      if (to === account.accountNumber) {
        accountTo = account;
        console.log(accountTo, 'to');
      }
    });

    const memberName = currentProfile.memberName;
    console.log(memberName);

    sendTransferData(
      currentProfile,
      accountFrom,
      accountTo,
      amount,
      memberName,
    );
  } catch (error) {
    console.error('Transfer error:', error);
    showNotification('An error occurred during the transfer', 'error');
  }
};

const sendTransferData = async function (
  profile,
  from,
  to,
  amount,
  memberName,
) {
  try {
    showNotification('Processing transfer...', 'info');

    const res = await fetch(transferLink, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: [profile, from, to, amount, memberName],
      }),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const result = await res.json();

    showNotification(
      `Transfer of $${amount.toFixed(2)} completed successfully!`,
      'success',
    );

    // Direct lesson engine call for transfer action
    if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
      await lessonEngine.onAppAction('transfer', {
        amount: amount,
        fromAccount: from.accountType,
        toAccount: to.accountType,
        fromBalance: from.balanceTotal,
        toBalance: to.balanceTotal,
        member: memberName,
        timestamp: new Date().toISOString(),
      });
      console.log(
        '✅ Transfer action recorded for lesson tracking:',
        `$${amount.toFixed(2)} from ${from.accountType} to ${to.accountType}`,
      );
    } else {
      console.warn(
        '⚠️ Lesson engine not available - transfer tracking disabled',
      );
    }

    // Clear form
    amountInput.value = '';
    accountListFrom.selectedIndex = 0;
    accountListToo.selectedIndex = 0;
    accountSend = null;
    accountRecieve = null;

    // Update balance
    initialBalance();
  } catch (error) {
    console.error('Transfer failed:', error);
    showNotification(`Transfer failed: ${error.message}`, 'error');
  }
};

/************************************************Event Listeners*************************************************/

//Handles selecting the from account
accountListFrom.addEventListener('change', function (event) {
  // Get the selected option element
  const selectedOption = event.target.selectedOptions[0];
  // Get the account number from the value property of the selected option
  accountSend = selectedOption.value;
  console.log(accountSend);
});

//handles selecting too account
accountListToo.addEventListener('change', function (event) {
  // Get the selected option element
  const selectedOption = event.target.selectedOptions[0];
  // Get the account number from the value property of the selected option
  accountRecieve = selectedOption.value;
  console.log(accountRecieve);
});

//handles getting amount
btnAmount.addEventListener('click', function (e) {
  e.preventDefault();

  const originalText = btnAmount.textContent;
  setButtonLoading(btnAmount, true, originalText);

  try {
    transPush(accountSend, accountRecieve);
  } finally {
    // Reset button state after a short delay
    setTimeout(() => {
      setButtonLoading(btnAmount, false, originalText);
    }, 1000);
  }
});
