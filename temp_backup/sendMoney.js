import { currentProfile } from './script.js';
import { getInfoProfiles } from './script.js';
import {
  showNotification,
  validateAmount,
  validateSelection,
  setButtonLoading,
} from './validation.js';

/**********************************************Variables****************************************/

let profiles = await getInfoProfiles();
let targetProfile;
let profileSend;

const mainApp = document.querySelector('.mainApp');
const loginBTN = document.querySelector('.login__btn');
const inputAmount = document.querySelector('.form__input--amount--sendMoney');
const recipient = document.querySelector('.recipients');
const inputBTN = document.querySelector('.sendBtn');
const backBTN = document.querySelector('.backBtn');

const sendMoneyURL = `http://localhost:3000/sendFunds`;
let theRecipient;

mainApp.style.display = 'none';

/***********************************************Event LIsteners ********************************/

// Expose function to global scope to be called after login
window.initializeSendMoney = initializeSendMoney;

function initializeSendMoney() {
  // Check if user is logged in
  if (!currentProfile) {
    console.warn('User not logged in');
    return;
  }

  console.log(currentProfile, profiles);
  accountSetup();
}

recipient.addEventListener('change', function (event) {
  // Get the selected option element
  const selectedOption = event.target.selectedOptions[0];
  // Get the account number from the value property of the selected option
  theRecipient = selectedOption.value;
  console.log(theRecipient);
});

inputBTN.addEventListener('click', function (e) {
  e.preventDefault();

  const originalText = inputBTN.textContent;
  setButtonLoading(inputBTN, true, originalText);

  try {
    validateAndSendMoney();
  } finally {
    setTimeout(() => {
      setButtonLoading(inputBTN, false, originalText);
    }, 1500);
  }
});

/**
 * Validate and process money transfer
 */
function validateAndSendMoney() {
  const amount = parseFloat(inputAmount.value);
  const sender = currentProfile.memberName;
  const recipient = theRecipient;

  // Validate inputs
  const errors = [];

  // Validate recipient selection
  const recipientErrors = validateSelection(recipient, {
    fieldName: 'Recipient',
  });
  errors.push(...recipientErrors);

  // Check if sending to self
  if (recipient === sender) {
    errors.push('You cannot send money to yourself');
  }

  // Validate amount
  const amountErrors = validateAmount(amount, {
    min: 0.01,
    max: 10000,
    fieldName: 'Send Amount',
  });
  errors.push(...amountErrors);

  // Check if user has sufficient funds (assuming checking account)
  if (currentProfile && currentProfile.checkingAccount && amount) {
    if (amount > currentProfile.checkingAccount.balanceTotal) {
      errors.push('Insufficient funds in your account');
    }
  }

  if (errors.length > 0) {
    showNotification(errors.join(', '), 'error');
    return;
  }

  // Process the transfer
  sendFunds(recipient, sender, amount);
}
/**************************************************Functions*****************************************/
const accountSetup = function () {
  profiles.forEach(profile => {
    let option = document.createElement('option');

    option.value = profile.memberName;

    option.textContent = `${profile.memberName}`;
    recipient.appendChild(option);
  });
};
const sendFunds = async function (recip, sendr, amnt) {
  try {
    showNotification('Processing money transfer...', 'info');

    console.log('Sending funds:', { recip, sendr, amnt });

    const res = await fetch(sendMoneyURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: [recip, sendr, amnt],
      }),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    const result = await res.json();

    showNotification(
      `Successfully sent $${amnt.toFixed(2)} to ${recip}!`,
      'success',
    );

    // Direct lesson engine call for send money action
    if (typeof lessonEngine !== 'undefined' && lessonEngine.onAppAction) {
      await lessonEngine.onAppAction('money_sent', {
        amount: amnt,
        recipient: recip,
        sender: sendr,
        transactionType: 'peer_transfer',
        timestamp: new Date().toISOString(),
      });
      console.log(
        '✅ Send money action recorded for lesson tracking:',
        `$${amnt.toFixed(2)} to ${recip}`,
      );
    } else {
      console.warn(
        '⚠️ Lesson engine not available - send money tracking disabled',
      );
    }

    // Clear form
    inputAmount.value = '';
    recipient.selectedIndex = 0;
    theRecipient = null;

    return result;
  } catch (error) {
    console.error('Send money failed:', error);
    showNotification(`Transfer failed: ${error.message}`, 'error');
    throw error;
  }
};
