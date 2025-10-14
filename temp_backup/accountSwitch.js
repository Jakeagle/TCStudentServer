'use strict';
import {
  currentAccount,
  currentProfile,
  updateUI,
  displayBalance,
  displayTransactions,
  displayBillList,
  getInfoProfiles,
  updateAccountNumberDisplay,
} from './script.js';

const loginButton = document.querySelector('.login__btn');
const accountBTNs = document.querySelectorAll('.form__btn--accountSwitch');
const accountContainer = document.querySelector('.accountListBg');
const testServerProfiles = 'http://localhost:3000/profiles';

let btnNum = 0;

// Expose function to global scope to be called after login
window.initializeAccountSwitch = initializeAccountSwitch;

function initializeAccountSwitch() {
  // Check if user is logged in
  if (
    !currentProfile ||
    !currentProfile.checkingAccount ||
    !currentProfile.savingsAccount
  ) {
    console.warn('User not logged in or accounts not found');
    return;
  }

  let accounts = [];

  accounts.push(currentProfile.checkingAccount);
  accounts.push(currentProfile.savingsAccount);

  console.log(accounts);

  accounts.forEach(account => {
    const html = [
      ` <li class="account">
       ${account.accountType} ------------- ${account.accountNumber.slice(-4)}
       <span>
         <button
           class="form__btn form__btn--transfer form__btn--accountSwitch ${
             account.accountType
           }"
         >
           Switch to account
         </button></span
       >
     </li>`,
    ];
    accountContainer.insertAdjacentHTML('beforeEnd', html);
  });
  let checking = document.querySelector('.Checking');
  let savings = document.querySelector('.Savings');

  checking.addEventListener('click', async function () {
    const accountNumber = document.querySelector('.accountNumber');
    const accountType = document.querySelector('.accountType');
    let newProfile;
    let Profiles = await getInfoProfiles();

    Profiles.forEach(profile => {
      if (profile.memberName === currentProfile.memberName) {
        newProfile = profile;
      }
    });

    updateUI(newProfile.checkingAccount);

    // Use the proper formatting function for account number display
    updateAccountNumberDisplay(newProfile.checkingAccount);

    // Record account switch action using lesson engine
    if (window.lessonEngine && window.lessonEngine.initialized) {
      await window.lessonEngine.onAppAction('account_switch', {
        fromAccount: currentAccount?.accountType || 'unknown',
        toAccount: 'Checking',
        accountNumber: newProfile.checkingAccount.accountNumber,
        balance: newProfile.checkingAccount.balanceTotal,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Account switch to Checking recorded for lesson tracking');
    }

    console.log(Profiles);
  });

  savings.addEventListener('click', async function () {
    const accountNumber = document.querySelector('.accountNumber');
    const accountType = document.querySelector('.accountType');
    let newProfile;
    let Profiles = await getInfoProfiles();

    Profiles.forEach(profile => {
      if (profile.memberName === currentProfile.memberName) {
        newProfile = profile;
      }
    });

    updateUI(newProfile.savingsAccount);

    // Use the proper formatting function for account number display
    updateAccountNumberDisplay(newProfile.savingsAccount);

    // Record account switch action using lesson engine
    if (window.lessonEngine && window.lessonEngine.initialized) {
      await window.lessonEngine.onAppAction('account_switch', {
        fromAccount: currentAccount?.accountType || 'unknown',
        toAccount: 'Savings',
        accountNumber: newProfile.savingsAccount.accountNumber,
        balance: newProfile.savingsAccount.balanceTotal,
        timestamp: new Date().toISOString(),
      });

      console.log('✅ Account switch to Savings recorded for lesson tracking');
    }

    console.log(Profiles);
  });
}
