'use strict';

import { currentProfile } from './script.js';

console.log(currentProfile, 'numberCrunch');

const loginButton = document.querySelector('.login__btn');
const incomeText = document.querySelector('.incomeAmount');
const spendingText = document.querySelector('.spendingAmount');
const budgetText = document.querySelector('.budget');

// Expose function to global scope to be called after login
window.incomeSpendingCalc = incomeSpendingCalc;

function incomeSpendingCalc() {
  // Check if user is logged in
  if (!currentProfile || !currentProfile.checkingAccount) {
    console.warn('User not logged in or no checking account found');
    return;
  }

  let payArray = [];
  let billArray = [];
  let payInterval;
  let payAmount;
  let billAmount;
  let billInterval;
  for (let i = 0; i < currentProfile.checkingAccount.payments.length; i++) {
    let payment = currentProfile.checkingAccount.payments[i];
    payAmount = payment.amount;
    payInterval = payment.interval;

    if (payInterval === 'weekly') {
      payAmount = payAmount * 4;
    } else if (payInterval === 'bi-weekly') {
      payAmount = payAmount * 2;
    } else if (payInterval === 'monthly') {
      payAmount = payAmount;
    }

    payArray.push(payAmount);
  }
  console.log(payArray);
  const totalIncome = payArray.reduce((acc, mov) => acc + mov, 0);
  incomeSpending('income', payArray);

  // Direct lesson engine call for income calculated
  if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
    lessonEngine.onAppAction('income_calculated', {
      totalIncome,
      user: currentProfile?.memberName || currentProfile?.userName || '',
      timestamp: new Date().toISOString(),
    });
  }

  for (let i = 0; i < currentProfile.checkingAccount.bills.length; i++) {
    let bill = currentProfile.checkingAccount.bills[i];
    billAmount = bill.amount;
    billInterval = bill.interval;

    if (billInterval === 'weekly') {
      billAmount = billAmount * 4;
    } else if (billInterval === 'bi-weekly') {
      billAmount = billAmount * 2;
    } else if (billInterval === 'monthly') {
      billAmount = billAmount;
    }

    billArray.push(billAmount);
  }
  const totalSpending = billArray.reduce((acc, mov) => acc + mov, 0);
  incomeSpending('spending', billArray);

  // Direct lesson engine call for spending calculated
  if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
    lessonEngine.onAppAction('spending_calculated', {
      totalSpending,
      user: currentProfile?.memberName || currentProfile?.userName || '',
      timestamp: new Date().toISOString(),
    });
  }
}

const incomeSpending = function (type, arr) {
  let finalAmount;
  finalAmount = arr.reduce((acc, mov) => acc + mov, 0);

  if (type === 'income') {
    incomeText.textContent = `+ ${finalAmount}`;
    budgetText.textContent = `$${finalAmount}.000`;
  } else if (type === 'spending') {
    spendingText.textContent = `${finalAmount}`;
  }
};
