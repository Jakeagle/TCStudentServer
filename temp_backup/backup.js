'use strict';

if (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|OperaMini/i.test(
    navigator.userAgent,
  )
) {
  //window.location.replace('https://trinitycapitalmobile.netlify.app');
} else {
  console.log('Were on MOBILE!');
}

/********************************************Modal control*************************************/

//Modals
const mainApp = document.querySelector('.mainApp');
const loginBox = document.querySelector('.signOnBox');
const mobileLoginBox = document.querySelector('.mobileSignOnBox');
const billsModal = document.querySelector('.billsAndPaymentsModal');
const transferModal = document.querySelector('.transferModal');
const accountSwitchModal = document.querySelector('.accountSwitchModal');
const depositModal = document.querySelector('.depositModal');
const sendMoneyModal = document.querySelector('.sendMoneyModal');
const changeLanguageModal = document.querySelector('.changeLanguageModal');

//Modal Buttons
const accountSwitchBTN = document.querySelector('.accountSwitchBTN');
const transferModalBTN = document.querySelector('.transferBTN');
const billsModalBTN = document.querySelector('.billsModalBTN');
const depositModalBTN = document.querySelector('.depositsBTN');
const sendMoneyBTN = document.querySelector('.sendMoneyBTN');
const changeLanguageBTN = document.querySelector('.changeLanguageBTN');
const changeLangBTN = document.querySelector('.changeLangBtn');

//close Modals
const closeTransferModal = document.querySelector('.transferExitButton');
const closeBillModal = document.querySelector('.closeBills');
const closeAccountModal = document.querySelector('.closeAccounts');
const closeDepositModal = document.querySelector('.closeDeposits');
const closeSendMoneyModal = document.querySelector('.closeSendMoney');
const logOutBTN = document.querySelector('.logOutBTN');
const closeLanguageModal = document.querySelector('.closeLanguageModal');

logOutBTN.addEventListener('click', function () {
  location.reload();
});

changeLangBTN.addEventListener('click', function () {});

billsModalBTN.addEventListener('click', function () {
  billsModal.showModal();
});

closeBillModal.addEventListener('click', function () {
  billsModal.close();
});

transferModalBTN.addEventListener('click', function () {
  transferModal.showModal();
});

closeTransferModal.addEventListener('click', function () {
  transferModal.close();
});

accountSwitchBTN.addEventListener('click', function () {
  accountSwitchModal.showModal();
});

closeAccountModal.addEventListener('click', function () {
  accountSwitchModal.close();
});

depositModalBTN.addEventListener('click', function () {
  depositModal.showModal();
});

closeDepositModal.addEventListener('click', function () {
  depositModal.close();
});

sendMoneyBTN.addEventListener('click', function () {
  sendMoneyModal.showModal();
});

closeSendMoneyModal.addEventListener('click', function () {
  sendMoneyModal.close();
});

changeLanguageBTN.addEventListener('click', function () {
  changeLanguageModal.showModal();
});

closeLanguageModal.addEventListener('click', function () {
  changeLanguageModal.close();
});
window.screen.width <= 1300 ? mobileLoginBox.showModal() : loginBox.showModal();

if (mainApp) mainApp.style.display = 'none';

/***********************************************************Server Listeners**********************************************/

const socket = io('http://localhost:3000');
const socket2 = io('http://localhost:5040');

socket.on('connect', () => {
  console.log('User connected:' + socket.id);
});

socket.on('checkingAccountUpdate', updatedChecking => {
  const checkingAccount = updatedChecking;
  console.log(checkingAccount, 'This is working');
  displayBalance(checkingAccount);
  displayTransactions(checkingAccount);
});

const timerModal = document.querySelector('.timerModal');

timerModal.addEventListener('cancel', event => {
  event.preventDefault();
});

socket2.on('timer', active => {
  console.log(active);
  if (active) {
    timerModal.showModal();
  }

  if (!active) {
    timerModal.close();
  }
});

socket.on('donationChecking', updatedDonCheck => {
  const checkingAccount = updatedDonCheck;
  console.log(checkingAccount, 'This is working');
  displayBalance(checkingAccount);
  displayTransactions(checkingAccount);
});

socket.on('donationSaving', updatedDonSav => {
  const savingsAccount = updatedDonSav;
  console.log(savingsAccount, 'This is working');
  displayBalance(savingsAccount);
  displayTransactions(savingsAccount);
});

/***********************************************************Server Functions**********************************************/
const testServerProfiles = 'http://localhost:3000/profiles';

const loanURL = 'http://localhost:3000/loans';

const donationURL = 'http://localhost:3000/donations';

const donationSavingsURL = 'http://localhost:3000/donationsSavings';

const balanceURL = 'http://localhost:3000/initialBalance';

const productivityURL = 'http://localhost:5040/timers';

// Store the received profiles in a global variable or a state variable if you're using a front-end framework
let Profiles = [];

export async function getInfoProfiles() {
  try {
    console.log(
      'Step 1: Starting the process to fetch profiles from the server.',
    );

    const res = await fetch(testServerProfiles, {
      method: 'GET',
    });

    console.log('Step 2: Received a response from the server.');

    if (res.ok) {
      console.log(
        `Step 3: Server responded successfully with status ${res.status}. Attempting to parse the JSON response.`,
      );
      try {
        const Profiles = await res.json();
        console.log('Step 4: Successfully parsed JSON response:', Profiles);

        // Log the initialization of Socket.IO listener
        console.log(
          'Step 5: Setting up Socket.IO listener for profile updates.',
        );
        socket.on('profiles', updatedProfiles => {
          console.log(
            'Step 6: Received updated profiles from the server:',
            updatedProfiles,
          );
          // Update the UI or perform any necessary actions with updated profiles
        });

        console.log('Step 7: Returning the fetched and parsed profiles.');
        return Profiles;
      } catch (jsonError) {
        console.error(
          'Step 4 Error: Failed to parse JSON response:',
          jsonError.message,
        );
        console.error('The server response may not be in the correct format.');
        throw new Error('Invalid JSON response from server');
      }
    } else {
      console.error(
        `Step 3 Error: Server responded with status ${res.status} (${res.statusText}).`,
      );
      const errorDetails = await res.text(); // Attempt to read error details
      console.error(
        'Additional details from the server response:',
        errorDetails,
      );
      throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error(
      'Final Step Error: An unexpected error occurred during the process.',
    );
    console.error('Error message:', error.message);

    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }

    // Optionally rethrow the error or return a fallback value
    throw error;
  }
}

export async function initialBalance() {
  const res = await fetch(balanceURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parcel: currentProfile,
    }),
  });
}

async function loanPush() {
  const res = await fetch(loanURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parcel: [currentProfile, parseInt(loanAmount.value)],
    }),
  });
  console.log(currentProfile);
}

async function donationPush() {
  const res = await fetch(donationURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parcel: [currentAccount, parseInt(donateAmount.value)],
    }),
  });
}

async function donationPushSavings() {
  const res = await fetch(donationSavingsURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parcel: [currentAccount, parseInt(donateAmount.value)],
    }),
  });
}

export let profiles = await getInfoProfiles();

/******************************************Variables ***************************************************/

export let currentAccount;
export let currentProfile;
let currentTime;
let accPIN;
let accUser;
//Currency codes for formatting
const currencyCodeMap = {
  840: 'USD',
  978: 'EUR',
  // add more currency codes here as needed
};

const closeT1 = document.querySelector('.closeBtn');
const signOnForm = document.querySelector('signOnForm');
const signOnText = document.querySelector('.signOntext');
const loginButton = document.querySelector('.login__btn');
const mobileLoginButton = document.querySelector('.mobileLoginBtn');

const formDiv = document.querySelector('.formDiv');
export let balance;

const lastUpdated = document.querySelector('.updateDate');
const transActionsDate = document.querySelector('.transactions__date');
const balanceValue = document.querySelector('.balance__value');
const balanceLabel = document.querySelector('.balance__label');
const accNumSwitch = document.querySelector('.form__input--user--switch');
const accPinSwitch = document.querySelector('.form__input--pin--switch');
const accBtnSwitch = document.querySelector('.form__btn--switch');
const btnClose = document.querySelector('.form__btn--close');
const userClose = document.querySelector('.form__input--user--close');
const userClosePin = document.querySelector('.form__input--pin--close');
const transactionContainer = document.querySelector('.transactions');
const requestLoanbtn = document.querySelector('.form__btn--loan');
const loanAmount = document.querySelector('.form__input--loan-amount');
const donateBtn = document.querySelector('.form__btn--donate');
const donateAmount = document.querySelector('.form__input--donate--amount');
const donatePin = document.querySelector('.form__input--pin--donate');
const accNumHTML = document.querySelector('.accountNumber');
const balanceDate = document.querySelector(`.dateText`);
const now = new Date();

//Used for formatting dates
const options = {
  hour: 'numeric',
  minute: 'numeric',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  // weekday: 'long',
};

/*****************************************Event Listeners ******************************************/

//login event listener (used to login to the app)
if (loginButton) {
  loginButton.addEventListener('click', function (event) {
    event.preventDefault();
    const loginPIN = document.querySelector('.login__input--pin');
    const loginText = document.querySelector('.login__input--user');
    loginFunc(loginPIN, loginText, loginBox);
    // Get the value of the input field
  });
}

if (mobileLoginButton) {
  mobileLoginButton.addEventListener('click', function (event) {
    event.preventDefault();
    const mobileLoginPIN = document.querySelector('.mobile_login__input--pin');
    const mobileLoginText = document.querySelector(
      '.mobile_login__input--user',
    );
    loginFunc(mobileLoginPIN, mobileLoginText, mobileLoginBox);
    console.log('running');
  });
}

const loginFunc = function (PIN, user, screen) {
  const pin = parseInt(PIN.value);

  for (let i = 0; i < profiles.length; i++) {
    if (user.value === profiles[i].userName && pin === profiles[i].pin) {
      currentProfile = profiles[i];
    } else if (user.value === profiles[i].userName && pin !== profiles[i].pin) {
      alert('incorrect PIN');
    } else if (user.value !== profiles[i].userName && pin === profiles[i].pin) {
      alert('incorrect Username');
    }
  }

  if (currentProfile) {
    initialBalance();

    // Retrieve saved transactions for current account

    screen.close();

    const signOnSection = document.querySelector('.signOnSection');

    signOnSection.style.display = 'none';

    // Display welcome message
    const signOnText = document.querySelector('.signOnText');
    signOnText.textContent = currentProfile.memberName.split(' ')[0];

    // Hide login form and display main app
    const formDiv = document.querySelector('.formDiv');
    const mainApp = document.querySelector('.mainApp');

    mainApp.style.display = 'flex';
    mainApp.style.opacity = 100;

    const lessonName = document.querySelector('.lessonHeaderText');

    lessonName.textContent = currentProfile.currentLesson;

    currentAccount = currentProfile.checkingAccount;
    if (currentAccount) {
      console.log(currentAccount);
      //Add currentAccount here
      // Update the UI with the first account's information
      updateUI(currentAccount);
      //Starts loop function that displays the current Accounts bills

      //Displays the "Current Balanace for "x" string
      // balanceLabel.textContent = `Current balance for: #${currentAccount.accountNumber.slice(
      //   -4
      // )}`;

      //Displays the "As of" portion with the current date
      updateTime();
      balanceDate.textContent = `As of ${new Intl.DateTimeFormat(
        currentProfile.locale,
        options,
      ).format(currentTime)}`;
      //Display saved transactions for current account
      displayTransactions(currentAccount);
    } else {
      alert('No checking account found. Please contact customer service.');
    }
  }
};

//Switch accounts
if (accBtnSwitch) {
  accBtnSwitch.addEventListener('click', function (e) {
    e.preventDefault();
    console.log(currentAccount);
    //The value for the account you want to switch too
    let targetAccount = accNumSwitch.value;
    accPIN = parseInt(accPinSwitch.value);
    //Variable that matches the above with the matching account number
    let accountToSwitch;

    if (accPIN === currentProfile.pin) {
      if (
        targetAccount === currentProfile.checkingAccount.accountNumber.slice(-4)
      ) {
        currentAccount = currentProfile.checkingAccount;
        balanceLabel.textContent = `Current Balance for: #${currentAccount.accountNumber.slice(
          -4,
        )}`;
        updateUI(currentAccount);
      } else if (
        targetAccount === currentProfile.savingsAccount.accountNumber.slice(-4)
      ) {
        currentAccount = currentProfile.savingsAccount;
        balanceLabel.textContent = `Current Balance for: #${currentAccount.accountNumber.slice(
          -4,
        )}`;
        updateUI(currentAccount);
      }
    } else {
      alert('Incorrect PIN');
    }

    //Variable for the loan section
    const loanBox = document.querySelector('.operation--loan');
    //checks for savings accounr

    if (currentAccount.accountType === 'Savings') {
      loanBox.style.display = 'none';
    }
    //takes away loans if savings
    else if (currentAccount.accountType === 'Checking') {
      loanBox.style.display = 'inline';
    }

    accNumSwitch.value = '';
    accPinSwitch.value = '';
  });
}

//requesting loans

//checks if button exists
if (requestLoanbtn) {
  requestLoanbtn.addEventListener('click', function (e) {
    //prevents default action
    e.preventDefault();

    loanPush();

    loanAmount.value = '';

    //Declares the amount as the user entered amount.
  });
}

//Donating money
if (donateBtn) {
  donateBtn.addEventListener('click', function (e) {
    e.preventDefault();
    //How much a user donates

    if (currentAccount.accountType === 'Checking') {
      donationPush();
    } else if (currentAccount.accountType === 'Savings') {
      donationPushSavings();
    }

    donatePin.value = '';
    donateAmount.value = '';
  });
}

/********************************************Functions *********************************************/
if (mainApp) {
  mainApp.style.opacity = 0;
}

//createUsername(profiles);
//updates current time
const updateTime = function () {
  currentTime = new Date();
};

//This function updates local storage with any new data (Mainly transactions)

//Displays Currently Logged in profile's accounts sorted in order of checking first, then in order of most recently created.
const displayAccounts = function (currentAccount) {
  const accountContainer = document.querySelector('.accountContainer');
  accountContainer.innerHTML = '';

  //Shows no accounts if there are no accounts int the current profile

  //Sort the accounts by type (checking first) and creation date

  let balance = formatCur(
    currentProfile.locale,

    currentProfile.currency,
  );

  let lastTransactionDate = new Date(
    currentProfile.checkingAccount.movementsDates[
      currentProfile.checkingAccount.movementsDates.length - 1
    ],
  ).toLocaleDateString(currentProfile.locale);

  let lastTransactionDateSavings = new Date(
    currentProfile.savingsAccount.movementsDates[
      currentProfile.savingsAccount.movementsDates.length - 1
    ],
  ).toLocaleDateString(currentProfile.locale);

  const html = [
    `
        <div class="row accountsRow">
          <div class="col accountType">${
            currentProfile.checkingAccount.accountType
          }</div>
          <div class="col accountNumber">${currentProfile.checkingAccount.accountNumber.slice(
            -4,
          )}</div>
          <div class="col updateDate">${lastTransactionDate}</div>
        </div>
      
      <div class="row accountsRow">
        <div class="col accountType">${
          currentProfile.savingsAccount.accountType
        }</div>
        <div class="col accountNumber">${currentProfile.savingsAccount.accountNumber.slice(
          -4,
        )}</div>
        <div class="col updateDate">${lastTransactionDateSavings}</div>
      </div>
      `,
  ];

  accountContainer.insertAdjacentHTML('beforeEnd', html);
};

//Display Transactions
export const displayTransactions = function (currentAccount) {
  let movs;

  //selects the transactions HTML element
  const transactionContainer = document.querySelector('.transactionsColumn');
  transactionContainer.innerHTML = '';

  //Variable set for the transactions themselves

  movs = currentAccount.transactions;

  //A loop that runs through each transaction in the current account object
  movs.forEach(function (mov, i) {
    //ternerary to determine whether a transaction is a deposit or withdrawal

    let date;

    //Sets the date for each transaction according to the date set in the current Account object

    //Sets up the date variable for the transactions
    date = new Date(currentAccount.movementsDates[i]);

    //displays date next to transactions
    const displayDate = formatMovementDate(date, currentAccount.locale);
    //Formats transactions for user locale
    const formattedMov = formatCur(
      mov.amount,
      currentAccount.locale,
      currentAccount.currency,
    );
    let transType;
    let transName = mov.Name;

    let movIcon;

    if (mov.Category === 'Money Deposit') {
      movIcon = `<i class="fa-solid fa-dollar-sign transImg sndMon"></i>`;
    }
    if (mov.Category === 'Transfer') {
      movIcon = `<i class="fa-solid fa-money-bill-transfer transImg"></i>`;
    }

    if (mov.Category === 'car-note') {
      movIcon = `<i class="fa-solid fa-car transImg"></i>`;
    }
    if (mov.Category === 'rent') {
      movIcon = `<i class="fa-solid fa-house transImg"></i>`;
    }
    if (mov.Category === 'car-insurance') {
      movIcon = `<i class="fa-solid fa-car-burst transImg"></i>`;
    }
    if (mov.Category === 'home-insurance') {
      movIcon = `<i class="fa-solid fa-house-crack transImg"></i>`;
    }
    if (mov.Category === 'food') {
      movIcon = `<i class="fa-solid fa-utensils transImg"></i>`;
    }
    if (mov.Category === 'electric') {
      movIcon = `<i class="fa-solid fa-bolt transImg"></i>`;
    }

    if (mov.Category === 'gas') {
      movIcon = `<i class="fa-solid fa-fire-flame-simple transImg"></i>`;
    }

    if (mov.Category === 'water') {
      movIcon = `<i class="fa-solid fa-droplet transImg"></i>`;
    }

    if (mov.Category === 'trash-collection') {
      movIcon = `<i class="fa-solid fa-dumpster transImg"></i>`;
    }

    if (mov.Category === 'phone-bill') {
      movIcon = `<i class="fa-solid fa-phone transImg"></i>`;
    }

    if (mov.Category === 'internet') {
      movIcon = `<i class="fa-solid fa-wifi transImg"></i>`;
    }

    if (mov.Category === 'custom-expense') {
      movIcon = `<i class="fa-solid fa-screwdriver-wrench transImg"></i>`;
    }

    if (mov.Category === 'paycheck') {
      movIcon = `<i class="fa-solid fa-dollar-sign transImg dollarSignImg"></i>`;
    }
    if (mov.Category === 'Check Deposit') {
      movIcon = `<i class="fa-solid fa-money-check transImg"></i>`;
    }
    //HTML for transactions
    if (mov.amount < 0) {
      transType = 'negTrans';
    } else if (mov.amount > 0) {
      transType = 'posTrans';
    }
    const html = `<div class="transaction row">
                          <div class="transIcon col-4">
                            ${movIcon}
                          </div>
                          <div class="transNameAndDate col">
                            <p class="transName">${transName} (${mov.Category})</p>
                            <p class="transDate">${displayDate}</p>
                          </div>
                          <div class="transAmount col">
                            <p class="transAmountText ${transType}">${formattedMov}</p>
                          </div>
                        </div>`;
    //Inserts HTML with required data
    transactionContainer.insertAdjacentHTML('afterbegin', html);
    displayBillList(currentAccount);
  });
};
export const displayBillList = function (currentAccount) {
  let bills;

  //selects the transactions HTML element
  const billListContainer = document.querySelector('.bills');
  billListContainer.innerHTML = '';

  //Variable set for the transactions themselves

  bills = currentAccount.bills;

  //Sets the date for each transaction according to the date set in the current Account object

  //Sets up the date variable for the transactions

  //A loop that runs through each transaction in the current account object
  if (currentAccount.accountType != 'Savings') {
    bills.forEach(function (bill, i) {
      //ternerary to determine whether a transaction is a deposit or withdrawal

      let currentDate;
      let advancedDate;

      //Sets the date for each transaction according to the date set in the current Account object

      //Sets up the date variable for the transactions
      currentDate = new Date(bill.Date);

      //currentDate = new Date();

      if (bill.interval === 'weekly') {
        advancedDate = currentDate.setUTCDate(currentDate.getUTCDate() + 7);
      }

      if (bill.interval === 'bi-weekly') {
        advancedDate = currentDate.setUTCDate(currentDate.getUTCDate() + 14);
      }

      if (bill.interval === 'monthly') {
        advancedDate = currentDate.setUTCDate(currentDate.getUTCDate() + 30);
      }

      if (bill.interval === 'yearly') {
        advancedDate = currentDate.setUTCDate(currentDate.getUTCDate() + 365);
      }

      //displays date next to transactions
      const displayDate = formatMovementDate(
        advancedDate,
        currentAccount.locale,
      );

      //Formats transactions for user locale
      const formattedMov = formatCur(
        bill.amount,
        currentAccount.locale,
        currentAccount.currency,
      );
      let transType;
      let transName = bill.Name;

      let billIcon;

      if (bill.Category === 'car-note') {
        billIcon = `<i class="fa-solid fa-car "></i>`;
      }
      if (bill.Category === 'rent') {
        billIcon = `<i class="fa-solid fa-house rentIcon"></i>`;
      }
      if (bill.Category === 'car-insurance') {
        billIcon = `<i class="fa-solid fa-car-burst "></i>`;
      }
      if (bill.Category === 'home-insurance') {
        billIcon = `<i class="fa-solid fa-house-crack "></i>`;
      }
      if (bill.Category === 'food') {
        billIcon = `<i class="fa-solid fa-utensils "></i>`;
      }
      if (bill.Category === 'electric') {
        billIcon = `<i class="fa-solid fa-bolt "></i>`;
      }

      if (bill.Category === 'gas') {
        billIcon = `<i class="fa-solid fa-fire-flame-simple "></i>`;
      }

      if (bill.Category === 'water') {
        billIcon = `<i class="fa-solid fa-droplet "></i>`;
      }

      if (bill.Category === 'trash-collection') {
        billIcon = `<i class="fa-solid fa-dumpster "></i>`;
      }

      if (bill.Category === 'phone-bill') {
        billIcon = `<i class="fa-solid fa-phone "></i>`;
      }

      if (bill.Category === 'internet') {
        billIcon = `<i class="fa-solid fa-wifi wifiIcon "></i>`;
      }

      if (bill.Category === 'custom-expense') {
        billIcon = `<i class="fa-solid fa-screwdriver-wrench billListCustom "></i>`;
      }

      if (bill.Category === 'paycheck') {
        billIcon = `<i class="fa-solid fa-dollar-sign  "></i>`;
      }
      //HTML for transactions

      const html = `<div class="billsRow row">
      <div class="icon col-4">
        ${billIcon}
      </div>
      <div class="billName col">
        <p class="billText">${bill.Name}($${bill.amount})</p>
      </div>
      <div class="col billDate">
        <p>Reoccurs: ${displayDate}</p>
      </div>
    </div>`;
      //Inserts HTML with required data
      billListContainer.insertAdjacentHTML('afterbegin', html);
    });
  }
};

export const formatMovementDate = function (date, locale) {
  //international time format based on the date given in this function
  return new Intl.DateTimeFormat(locale).format(date);
};

//formats currency based on user locale
function formatCur(value, currency, locale) {
  //Sets currency based on locale currency code. (Defaults to USD if no locale can be found)
  const currencyCode = currencyCodeMap[currency] || 'USD';
  //Sets style and code, and formats the transaction
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}

//Displays the current balance based on the transactions array
export const displayBalance = function (acc) {
  //calculates the balance based on the transaction array

  //displays balance
  balanceValue.textContent = formatCur(
    acc.balanceTotal,
    acc.locale,
    acc.currency,
  );
};
