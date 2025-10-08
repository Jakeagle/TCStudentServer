// Trinity Capital Lesson Engine Integration Test
// This test file simulates all major tracked actions and checks if the lesson engine processes them as expected.
// Run this in a browser environment with the app loaded and lessonEngine available.

async function testLessonEngineIntegration() {
  const results = [];
  function logResult(action, status, details = '') {
    results.push({ action, status, details });
    console.log(`[${status}] ${action}: ${details}`);
  }

  // Helper to wait for async engine processing
  function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // Ensure lessonEngine is available
  if (typeof lessonEngine === 'undefined' || !lessonEngine.onAppAction) {
    logResult('engine_load', 'FAIL', 'lessonEngine not found');
    return;
  }

  // Simulate student login/initialization
  try {
    await lessonEngine.initialize('Jake Ferguson');
    logResult('engine_initialize', 'PASS');
  } catch (e) {
    logResult('engine_initialize', 'FAIL', e.message);
    return;
  }

  // Simulate deposit
  try {
    await lessonEngine.onAppAction('deposit', {
      amount: 100,
      destination: 'Checking',
      member: 'Jake Ferguson',
      transactionType: 'deposit',
      timestamp: new Date().toISOString(),
    });
    logResult('deposit', 'PASS');
  } catch (e) {
    logResult('deposit', 'FAIL', e.message);
  }

  // Simulate bill creation
  try {
    await lessonEngine.onAppAction('bill_created', {
      amount: -50,
      interval: 'monthly',
      name: 'Test Bill',
      category: 'utilities',
      date: new Date().toISOString(),
      user: 'Jake Ferguson',
    });
    logResult('bill_created', 'PASS');
  } catch (e) {
    logResult('bill_created', 'FAIL', e.message);
  }

  // Simulate payment creation
  try {
    await lessonEngine.onAppAction('payment_created', {
      amount: 200,
      interval: 'monthly',
      name: 'Test Payment',
      category: 'income',
      date: new Date().toISOString(),
      user: 'Jake Ferguson',
    });
    logResult('payment_created', 'PASS');
  } catch (e) {
    logResult('payment_created', 'FAIL', e.message);
  }

  // Simulate transfer
  try {
    await lessonEngine.onAppAction('transfer', {
      amount: 25,
      fromAccount: 'Checking',
      toAccount: 'Savings',
      fromBalance: 500,
      toBalance: 200,
      member: 'Jake Ferguson',
      timestamp: new Date().toISOString(),
    });
    logResult('transfer', 'PASS');
  } catch (e) {
    logResult('transfer', 'FAIL', e.message);
  }

  // Simulate sending money
  try {
    await lessonEngine.onAppAction('money_sent', {
      amount: 10,
      recipient: 'Other Student',
      sender: 'Jake Ferguson',
      transactionType: 'peer_transfer',
      timestamp: new Date().toISOString(),
    });
    logResult('money_sent', 'PASS');
  } catch (e) {
    logResult('money_sent', 'FAIL', e.message);
  }

  // Simulate loan taken
  try {
    await lessonEngine.onAppAction('loan_taken', {
      amount: 300,
      user: 'Jake Ferguson',
    });
    logResult('loan_taken', 'PASS');
  } catch (e) {
    logResult('loan_taken', 'FAIL', e.message);
  }

  // Simulate account switch
  try {
    await lessonEngine.onAppAction('account_checked', {
      accountType: 'savings',
      user: 'Jake Ferguson',
    });
    logResult('account_checked', 'PASS');
  } catch (e) {
    logResult('account_checked', 'FAIL', e.message);
  }

  // Simulate message sent
  try {
    await lessonEngine.onAppAction('message_sent', {
      content: 'Test message',
      conversationId: 'teacher',
      recipient: 'admin@trinity-capital.net',
      user: 'Jake Ferguson',
      timestamp: new Date().toISOString(),
    });
    logResult('message_sent', 'PASS');
  } catch (e) {
    logResult('message_sent', 'FAIL', e.message);
  }

  // Simulate income and spending calculations
  try {
    await lessonEngine.onAppAction('income_calculated', {
      totalIncome: 1000,
      user: 'Jake Ferguson',
      timestamp: new Date().toISOString(),
    });
    logResult('income_calculated', 'PASS');
  } catch (e) {
    logResult('income_calculated', 'FAIL', e.message);
  }
  try {
    await lessonEngine.onAppAction('spending_calculated', {
      totalSpending: 800,
      user: 'Jake Ferguson',
      timestamp: new Date().toISOString(),
    });
    logResult('spending_calculated', 'PASS');
  } catch (e) {
    logResult('spending_calculated', 'FAIL', e.message);
  }

  // Summary
  setTimeout(() => {
    console.log(
      '\n--- Trinity Capital Lesson Engine Integration Test Results ---',
    );
    results.forEach(r => {
      console.log(
        `${r.action}: ${r.status}${r.details ? ' - ' + r.details : ''}`,
      );
    });
    console.log('----------------------------------------------------------\n');
  }, 1000);
}

// Attach to window for global access
window.testLessonEngineIntegration = testLessonEngineIntegration;
