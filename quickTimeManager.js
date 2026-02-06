/**
 * Quick Time Manager for Sample Accounts
 * ========================================
 * Provides accelerated time simulation for sample student accounts
 *
 * Time Scale: 1 second = 1 day
 * - Weekly bills = 7 days = 7 seconds
 * - Bi-weekly = 14 days = 14 seconds
 * - Monthly = 30 days = 30 seconds
 *
 * This runs ONLY for sample accounts and does NOT interfere with
 * the regular node-cron system for other accounts.
 *
 * Uses the existing schedulerManager.processTransaction() system
 * to handle balance updates, so we don't reinvent the wheel.
 */

class QuickTimeManager {
  constructor(mongoClient, io, userSockets) {
    this.client = mongoClient;
    this.io = io;
    this.userSockets = userSockets; // Map to find sockets by username
    this.quickTimeUsers = new Map(); // Track users in quick time mode
    this.simulatedTime = new Map(); // Track each user's simulated time
    this.quickTimeIntervals = new Map(); // Track active intervals
  }

  /**
   * Check if a username is a sample user
   */
  isSampleUser(username) {
    return username && username.toLowerCase().includes("sample");
  }

  /**
   * Initialize quick time mode for a sample student
   * Starts tracking their simulated time and intervals
   */
  async initializeQuickTimeMode(username) {
    if (!this.isSampleUser(username)) {
      console.log(
        `ℹ️  [QuickTime] "${username}" is not a sample user - quick time not activated`,
      );
      return;
    }

    console.log(
      `⏱️  [QuickTime] Initializing quick time mode for: ${username}`,
    );

    // Initialize tracked data
    if (!this.simulatedTime.has(username)) {
      this.simulatedTime.set(username, new Date());
      console.log(
        `⏱️  [QuickTime] Simulated time initialized to: ${new Date().toISOString()}`,
      );
    }

    if (!this.quickTimeUsers.has(username)) {
      this.quickTimeUsers.set(username, true);
    }

    // Reschedule bills and paychecks from 7/14/30 days to 7/14/30 seconds
    await this.processPendingTransactions(username);

    // Start the quick time interval for this user
    this.startQuickTimeInterval(username);
  }

  /**
   * Start quick time interval for a user
   * Checks every second (simulated day) for transactions that should occur
   */
  startQuickTimeInterval(username) {
    // Clear any existing interval
    if (this.quickTimeIntervals.has(username)) {
      clearInterval(this.quickTimeIntervals.get(username));
      console.log(`⏱️  [QuickTime] Cleared existing interval for: ${username}`);
    }

    console.log(
      `⏱️  [QuickTime] Starting quick time interval for: ${username}`,
    );

    // Check every 1 second (to match 1 second = 1 day time scale)
    // This ensures accurate interval processing (weekly=7s, bi-weekly=14s, monthly=30s, yearly=365s)
    const interval = setInterval(() => {
      this.checkAndProcessTransactions(username);
    }, 1000);

    this.quickTimeIntervals.set(username, interval);
  }

  /**
   * Check if transactions are due and process them
   * Advances simulated time by 1 second = 1 day per check
   */
  async checkAndProcessTransactions(username) {
    if (!this.quickTimeUsers.has(username)) {
      // User is no longer in quick time mode, clear the interval
      if (this.quickTimeIntervals.has(username)) {
        clearInterval(this.quickTimeIntervals.get(username));
        this.quickTimeIntervals.delete(username);
      }
      return;
    }

    try {
      const userProfile = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": username });

      if (!userProfile) return;

      const currentSimulatedTime =
        this.simulatedTime.get(username) || new Date();

      // Check bills
      const bills = userProfile.checkingAccount?.bills || [];
      for (const bill of bills) {
        if (bill.nextExecution) {
          const nextExecTime = new Date(bill.nextExecution);
          const isDue =
            currentSimulatedTime.getTime() >= nextExecTime.getTime();

          if (isDue) {
            console.log(
              `⏱️  [QuickTime] Bill due for ${username}: ${bill.Name}`,
            );
            await this.processQuickTimeTransaction(
              username,
              bill,
              "bill",
              currentSimulatedTime,
            );
          }
        }
      }

      // Check paychecks (stored as "payments" in the database)
      const payments = userProfile.checkingAccount?.payments || [];
      for (const payment of payments) {
        if (payment.nextExecution) {
          const nextExecTime = new Date(payment.nextExecution);
          const isDue =
            currentSimulatedTime.getTime() >= nextExecTime.getTime();

          if (isDue) {
            console.log(
              `⏱️  [QuickTime] Payment due for ${username}: ${payment.Name}`,
            );
            await this.processQuickTimeTransaction(
              username,
              payment,
              "payment",
              currentSimulatedTime,
            );
          }
        }
      }

      // Advance simulated time by 1 second = 1 day
      const newSimulatedTime = new Date(currentSimulatedTime.getTime() + 1000);
      this.simulatedTime.set(username, newSimulatedTime);
    } catch (error) {
      console.error(
        `❌ [QuickTime] Error checking transactions for ${username}:`,
        error,
      );
    }
  }

  /**
   * Process a transaction in quick time mode
   * Mimics schedulerManager.processTransaction() but WITHOUT rescheduling cron jobs
   * since quick time handles its own timing
   */
  async processQuickTimeTransaction(
    username,
    transaction,
    type,
    simulatedTime,
  ) {
    try {
      console.log(
        `⏱️  [QuickTime] Processing ${type}: ${transaction.Name} for ${username}`,
      );

      const newDate = new Date().toISOString();

      // 1. Add transaction to user's account (same as schedulerManager)
      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": username },
          {
            $push: {
              "checkingAccount.transactions": {
                amount: transaction.amount,
                interval: transaction.interval,
                Name: transaction.Name,
                Category: transaction.Category,
                Date: newDate,
              },
            },
          },
        );

      // 2. Add movement date (same as schedulerManager)
      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": username },
          { $push: { "checkingAccount.movementsDates": newDate } },
        );

      // 3. Update balance by summing transactions (same as schedulerManager.updateBalance)
      const userProfile = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": username });

      if (userProfile) {
        const balance = userProfile.checkingAccount.transactions.reduce(
          (acc, mov) => acc + mov.amount,
          0,
        );

        await this.client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": username },
            { $set: { "checkingAccount.balanceTotal": balance } },
          );
      }

      // 4. Calculate next execution date for the bill/paycheck
      const frequency = transaction.interval || transaction.frequency;
      console.log(
        `⏰ [QuickTime] Calculating next execution with frequency: "${frequency}"`,
      );
      const nextExecutionDate = this.calculateNextExecutionDate(
        frequency,
        simulatedTime,
      );

      if (nextExecutionDate) {
        // Update the next execution date in the database
        const updateField =
          type === "bill"
            ? "checkingAccount.bills"
            : "checkingAccount.payments";

        await this.client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            {
              "checkingAccount.accountHolder": username,
              [`${updateField}._id`]: transaction._id,
            },
            {
              $set: {
                [`${updateField}.$.nextExecution`]:
                  nextExecutionDate.toISOString(),
              },
            },
          );
      }

      // 5. Notify user via socket (same as schedulerManager)
      const userSocket = this.userSockets.get(username);
      if (userSocket) {
        const updatedProfile = await this.client
          .db("TrinityCapital")
          .collection("User Profiles")
          .findOne({ "checkingAccount.accountHolder": username });

        if (updatedProfile) {
          userSocket.emit(
            "checkingAccountUpdate",
            updatedProfile.checkingAccount,
          );
        }
      }

      console.log(
        `✅ [QuickTime] ${type.charAt(0).toUpperCase() + type.slice(1)} processed: ${
          transaction.Name
        }`,
      );
    } catch (error) {
      console.error(
        `❌ [QuickTime] Error processing ${type} for ${username}:`,
        error,
      );
    }
  }

  /**
   * Calculate next execution date in quick time
   * 1 second = 1 day, so:
   * - weekly = 7 seconds
   * - bi-weekly = 14 seconds
   * - monthly = 30 seconds
   * - yearly = 365 seconds
   */
  calculateNextExecutionDate(frequency, baseTime) {
    const next = new Date(baseTime || new Date());

    if (!frequency) {
      frequency = "monthly";
    }

    switch (frequency.toLowerCase()) {
      case "weekly":
        next.setTime(next.getTime() + 7000); // 7 seconds
        break;
      case "bi-weekly":
        next.setTime(next.getTime() + 14000); // 14 seconds
        break;
      case "monthly":
        next.setTime(next.getTime() + 30000); // 30 seconds
        break;
      case "yearly":
        next.setTime(next.getTime() + 365000); // 365 seconds
        break;
      default:
        next.setTime(next.getTime() + 30000); // default to monthly
    }

    return next;
  }

  /**
   * Reschedule transactions for quick time
   * Adjusts nextExecution dates from real-time (7 days) to quick-time (7 seconds)
   */
  async processPendingTransactions(username) {
    console.log(
      `\n🔧 [QuickTime] ===== RESCHEDULE START for ${username} =====`,
    );
    try {
      // Add a small delay to ensure database writes have completed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const userProfile = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": username });

      if (!userProfile) {
        console.log(`❌ [QuickTime] User profile not found for: ${username}`);
        return;
      }

      const now = new Date();
      const quickTimeStartTime = this.simulatedTime.get(username) || now;

      let hasUpdates = false;

      // RESCHEDULE BILLS FOR QUICK TIME
      const bills = userProfile.checkingAccount?.bills || [];
      console.log(`📋 [QuickTime] Processing ${bills.length} bills...`);

      const rescheduledBills = bills.map((bill) => {
        if (bill.nextExecution) {
          const originalNextExec = new Date(bill.nextExecution);
          const delayMs = originalNextExec.getTime() - now.getTime();
          const delayDays = delayMs / (24 * 60 * 60 * 1000);
          const quickTimeDelayMs = delayDays * 1000;
          const newNextExec = new Date(
            quickTimeStartTime.getTime() + quickTimeDelayMs,
          );

          console.log(
            `  • Bill "${bill.Name}": ${delayDays.toFixed(1)} days → ${(quickTimeDelayMs / 1000).toFixed(1)}s`,
          );
          hasUpdates = true;

          return { ...bill, nextExecution: newNextExec.toISOString() };
        }
        return bill;
      });

      // RESCHEDULE PAYMENTS FOR QUICK TIME (stored as "payments" not "paychecks")
      const payments = userProfile.checkingAccount?.payments || [];
      console.log(`💵 [QuickTime] Processing ${payments.length} payments...`);

      const rescheduledPayments = payments.map((payment) => {
        console.log(
          `  📊 Payment: "${payment.Name}", frequency: "${payment.interval || payment.frequency}", nextExecution: ${payment.nextExecution}`,
        );
        if (payment.nextExecution) {
          const originalNextExec = new Date(payment.nextExecution);
          const delayMs = originalNextExec.getTime() - now.getTime();
          const delayDays = delayMs / (24 * 60 * 60 * 1000);
          const quickTimeDelayMs = delayDays * 1000;
          const newNextExec = new Date(
            quickTimeStartTime.getTime() + quickTimeDelayMs,
          );

          console.log(
            `  • Payment "${payment.Name}": ${delayDays.toFixed(1)} days → ${(quickTimeDelayMs / 1000).toFixed(1)}s`,
          );
          hasUpdates = true;

          return { ...payment, nextExecution: newNextExec.toISOString() };
        }
        return payment;
      });

      if (hasUpdates) {
        console.log(`📤 [QuickTime] Updating database...`);
        await this.client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": username },
            {
              $set: {
                "checkingAccount.bills": rescheduledBills,
                "checkingAccount.payments": rescheduledPayments,
              },
            },
          );

        console.log(`✅ [QuickTime] Database updated`);
      } else {
        console.log(`⏭️  [QuickTime] No transactions to reschedule`);
      }
    } catch (error) {
      console.error(
        `❌ [QuickTime] Error processing pending transactions:`,
        error.message,
      );
    }
    console.log(`🔧 [QuickTime] ===== RESCHEDULE END =====\n`);
  }

  /**
   * Disable quick time mode for a user
   */
  disableQuickTimeMode(username) {
    console.log(`⏱️  [QuickTime] Disabling quick time mode for: ${username}`);

    // Stop the interval
    if (this.quickTimeIntervals.has(username)) {
      clearInterval(this.quickTimeIntervals.get(username));
      this.quickTimeIntervals.delete(username);
    }

    // Clear tracking data
    this.quickTimeUsers.delete(username);
    this.simulatedTime.delete(username);
  }

  /**
   * Get quick time status for a user
   */
  getQuickTimeStatus(username) {
    return {
      isEnabled: this.quickTimeUsers.has(username),
      username,
      simulatedTime: this.simulatedTime.get(username),
      isSampleUser: this.isSampleUser(username),
    };
  }
}

module.exports = QuickTimeManager;
