/**
 * Persistent Scheduler Manager for Bills and Payments
 * Handles scheduling with database persistence to survive server restarts
 * Includes catch-up mechanism for missed transactions during server downtime
 */

const cron = require("node-cron");
const { ObjectId } = require("mongodb");
const CatchupScheduler = require("./catchupScheduler");

class SchedulerManager {
  constructor(mongoClient, io, userSockets) {
    this.client = mongoClient;
    this.io = io;
    this.userSockets = userSockets;
    this.scheduledJobs = new Map(); // Track active cron jobs
    this.catchupScheduler = new CatchupScheduler(mongoClient, io);
    this.quickTimeIntervals = new Map(); // Track quick time intervals for sample users
  }

  /**
   * Check if a user is a sample user (for quick time mode)
   */
  isSampleUser(memberName) {
    return memberName && memberName.toLowerCase().includes("sample");
  }

  /**
   * Calculate the next execution date based on interval and creation date
   * For sample users in quick time mode, intervals are calculated in seconds (1 sec = 1 day)
   */
  calculateNextExecutionDate(createdDate, interval, isSample = false) {
    const created = new Date(createdDate);
    const now = new Date();

    // For sample users: convert day intervals to seconds (1 second = 1 day)
    if (isSample) {
      const secondsPerDay = 1;
      const daysInInterval = {
        weekly: 7,
        "bi-weekly": 14,
        monthly: 30,
        yearly: 365,
      };

      const dayCount = daysInInterval[interval] || 1;
      const nextExecution = new Date(now.getTime() + dayCount * 1000); // dayCount seconds from now
      console.log(
        `⏱️  [QuickTime] Next ${interval} execution in ${dayCount} seconds`,
      );
      return nextExecution;
    }

    // Regular (non-sample) execution date calculation
    switch (interval) {
      case "weekly":
        // Find next occurrence of the same day of week
        const daysUntilNext = (7 - (now.getDay() - created.getDay())) % 7;
        const nextWeekly = new Date(now);
        nextWeekly.setDate(
          now.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext),
        );
        nextWeekly.setHours(0, 0, 0, 0);
        return nextWeekly;

      case "bi-weekly":
        // Every 14 days from creation date
        const daysSinceCreated = Math.floor(
          (now - created) / (1000 * 60 * 60 * 24),
        );
        const cyclesSinceCreated = Math.floor(daysSinceCreated / 14);
        const nextBiWeekly = new Date(created);
        nextBiWeekly.setDate(created.getDate() + (cyclesSinceCreated + 1) * 14);
        nextBiWeekly.setHours(0, 0, 0, 0);
        return nextBiWeekly;

      case "monthly":
        // Same day of each month
        const nextMonthly = new Date(created);
        nextMonthly.setMonth(now.getMonth() + 1);
        if (nextMonthly <= now) {
          nextMonthly.setMonth(now.getMonth() + 2);
        }
        nextMonthly.setHours(0, 0, 0, 0);
        return nextMonthly;

      case "yearly":
        // Same date each year
        const nextYearly = new Date(created);
        nextYearly.setFullYear(now.getFullYear() + 1);
        if (nextYearly <= now) {
          nextYearly.setFullYear(now.getFullYear() + 2);
        }
        nextYearly.setHours(0, 0, 0, 0);
        return nextYearly;

      default:
        return null;
    }
  }

  /**
   * Convert date to cron expression for scheduling
   */
  dateToCronExpression(date) {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Process a bill or payment transaction
   */
  async processTransaction(memberName, transaction, type) {
    try {
      console.log(`Processing ${type} for ${memberName}:`, transaction);

      const newDate = new Date().toISOString();

      // Add transaction to user's account
      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
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

      // Add movement date
      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
          { $push: { "checkingAccount.movementsDates": newDate } },
        );

      // Update balance
      await this.updateBalance(memberName);

      // Calculate next execution date
      const nextExecutionDate = this.calculateNextExecutionDate(
        transaction.Date,
        transaction.interval,
        this.isSampleUser(memberName), // Pass sample user flag
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
              "checkingAccount.accountHolder": memberName,
              [`${updateField}._id`]: transaction._id,
            },
            {
              $set: {
                [`${updateField}.$.nextExecution`]:
                  nextExecutionDate.toISOString(),
              },
            },
          );

        // Schedule the next execution
        this.scheduleTransaction(
          memberName,
          transaction,
          type,
          nextExecutionDate,
        );
      }

      // Notify user via socket
      const userSocket = this.userSockets.get(memberName);
      if (userSocket) {
        const updatedProfile = await this.client
          .db("TrinityCapital")
          .collection("User Profiles")
          .findOne({ "checkingAccount.accountHolder": memberName });

        userSocket.emit(
          "checkingAccountUpdate",
          updatedProfile.checkingAccount,
        );
      }

      // Notify teachers
      await this.notifyTeachers(memberName, type);
    } catch (error) {
      console.error(`Error processing ${type} for ${memberName}:`, error);
    }
  }

  /**
   * Schedule a transaction for future execution
   */
  scheduleTransaction(memberName, transaction, type, executionDate) {
    const jobKey = `${memberName}-${type}-${transaction._id}`;

    // Cancel existing job if it exists
    if (this.scheduledJobs.has(jobKey)) {
      this.scheduledJobs.get(jobKey).destroy();
    }

    // For sample users, use quick time mode (check every 1 second = 1 day)
    if (this.isSampleUser(memberName)) {
      console.log(
        `⏱️  [QuickTime] Scheduling ${type} for sample user ${memberName} in quick time mode`,
      );

      const intervalId = setInterval(async () => {
        const now = new Date();
        if (now >= executionDate) {
          console.log(
            `⏱️  [QuickTime] Executing ${type} for ${memberName} (Quick Time trigger)`,
          );
          await this.processTransaction(memberName, transaction, type);
          clearInterval(intervalId);
          this.quickTimeIntervals.delete(jobKey);
        }
      }, 1000); // Check every 1 second

      this.quickTimeIntervals.set(jobKey, intervalId);
    } else {
      // Regular cron scheduling for non-sample users
      const cronExpression = this.dateToCronExpression(executionDate);
      console.log(
        `Scheduling ${type} for ${memberName} at ${executionDate} (${cronExpression})`,
      );

      const job = cron.schedule(
        cronExpression,
        () => {
          this.processTransaction(memberName, transaction, type);
        },
        {
          scheduled: true,
          timezone: "America/New_York", // Adjust timezone as needed
        },
      );

      this.scheduledJobs.set(jobKey, job);
    }
  }

  /**
   * Initialize scheduler on server startup with catch-up mechanism
   */
  async initializeScheduler() {
    try {
      console.log(
        "🚀 Initializing persistent scheduler with catch-up mechanism...",
      );

      // STEP 1: Perform catch-up check for missed transactions
      console.log("🔄 Performing catch-up check for missed transactions...");
      const catchupResult = await this.catchupScheduler.performCatchupCheck();

      if (catchupResult.success) {
        console.log(
          `✅ Catch-up complete: ${catchupResult.totalProcessed} transactions processed`,
        );
      } else {
        console.error("❌ Catch-up failed:", catchupResult.error);
      }

      // STEP 2: Initialize regular scheduler
      const profiles = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .find({})
        .toArray();

      for (const profile of profiles) {
        const memberName = profile.checkingAccount?.accountHolder;
        if (!memberName) continue;

        // Process bills
        const bills = profile.checkingAccount?.bills || [];
        for (const bill of bills) {
          await this.initializeTransactionSchedule(memberName, bill, "bill");
        }

        // Process payments
        const payments = profile.checkingAccount?.payments || [];
        for (const payment of payments) {
          await this.initializeTransactionSchedule(
            memberName,
            payment,
            "payment",
          );
        }
      }

      console.log(
        `📅 Scheduler initialized with ${this.scheduledJobs.size} scheduled transactions`,
      );

      // Setup graceful shutdown handler
      this.setupShutdownHandler();
    } catch (error) {
      console.error("Error initializing scheduler:", error);
    }
  }

  /**
   * Initialize schedule for a single transaction
   */
  async initializeTransactionSchedule(memberName, transaction, type) {
    try {
      let nextExecutionDate;

      if (transaction.nextExecution) {
        // Use existing next execution date
        nextExecutionDate = new Date(transaction.nextExecution);
      } else {
        // Calculate next execution date based on creation date
        nextExecutionDate = this.calculateNextExecutionDate(
          transaction.Date,
          transaction.interval,
        );

        if (nextExecutionDate) {
          // Store calculated date in database
          const updateField =
            type === "bill"
              ? "checkingAccount.bills"
              : "checkingAccount.payments";

          await this.client
            .db("TrinityCapital")
            .collection("User Profiles")
            .updateOne(
              {
                "checkingAccount.accountHolder": memberName,
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
      }

      // Only schedule if the execution date is in the future
      if (nextExecutionDate && nextExecutionDate > new Date()) {
        this.scheduleTransaction(
          memberName,
          transaction,
          type,
          nextExecutionDate,
        );
      }
    } catch (error) {
      console.error(`Error initializing schedule for ${type}:`, error);
    }
  }

  /**
   * Add a new bill or payment and schedule it
   */
  async addScheduledTransaction(memberName, transactionData, type) {
    try {
      // Add unique ID to transaction
      transactionData._id = new ObjectId();
      transactionData.Date = transactionData.Date || new Date().toISOString();

      // Calculate next execution date
      const nextExecutionDate = this.calculateNextExecutionDate(
        transactionData.Date,
        transactionData.interval,
      );
      if (nextExecutionDate) {
        transactionData.nextExecution = nextExecutionDate.toISOString();
      }

      // Add to database
      const updateField =
        type === "bill" ? "checkingAccount.bills" : "checkingAccount.payments";

      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
          { $push: { [updateField]: transactionData } },
        );

      // Schedule first execution
      if (nextExecutionDate && nextExecutionDate > new Date()) {
        this.scheduleTransaction(
          memberName,
          transactionData,
          type,
          nextExecutionDate,
        );
      }

      console.log(
        `Added and scheduled ${type} for ${memberName}:`,
        transactionData,
      );
    } catch (error) {
      console.error(`Error adding scheduled ${type}:`, error);
    }
  }

  /**
   * Update balance after transaction
   */
  async updateBalance(memberName) {
    try {
      const profile = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": memberName });

      if (!profile || !profile.checkingAccount.transactions) return;

      const balance = profile.checkingAccount.transactions.reduce(
        (acc, transaction) => {
          return acc + (transaction.amount || 0);
        },
        0,
      );

      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
          { $set: { "checkingAccount.balanceTotal": balance } },
        );
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  }

  /**
   * Notify teachers about student financial updates
   */
  async notifyTeachers(memberName, transactionType) {
    try {
      const profile = await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": memberName });

      if (profile && profile.teacher) {
        console.log(
          `Notifying teacher ${profile.teacher} about ${transactionType} for student ${memberName}`,
        );

        this.io.emit("studentFinancialUpdate", {
          studentName: memberName,
          teacherName: profile.teacher,
          updatedData: {
            checkingBalance: profile.checkingAccount?.balanceTotal ?? 0,
            savingsBalance: profile.savingsAccount?.balanceTotal ?? 0,
            memberName: memberName,
          },
        });
      }
    } catch (error) {
      console.error("Error notifying teachers:", error);
    }
  }

  /**
   * Remove a scheduled transaction
   */
  async removeScheduledTransaction(memberName, transactionId, type) {
    try {
      const jobKey = `${memberName}-${type}-${transactionId}`;

      // Cancel the scheduled job
      if (this.scheduledJobs.has(jobKey)) {
        this.scheduledJobs.get(jobKey).destroy();
        this.scheduledJobs.delete(jobKey);
      }

      // Remove from database
      const updateField =
        type === "bill" ? "checkingAccount.bills" : "checkingAccount.payments";

      await this.client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
          { $pull: { [updateField]: { _id: transactionId } } },
        );

      console.log(`Removed scheduled ${type} for ${memberName}`);
    } catch (error) {
      console.error(`Error removing scheduled ${type}:`, error);
    }
  }

  /**
   * Get status of all scheduled transactions
   */
  getSchedulerStatus() {
    const status = {
      totalScheduledJobs: this.scheduledJobs.size,
      jobs: [],
    };

    for (const [jobKey, job] of this.scheduledJobs.entries()) {
      status.jobs.push({
        key: jobKey,
        running: job.running,
      });
    }

    return status;
  }

  /**
   * Setup graceful shutdown handler to record shutdown time
   */
  setupShutdownHandler() {
    const gracefulShutdown = async (signal) => {
      console.log(
        `📝 Received ${signal}. Recording shutdown time for catch-up...`,
      );

      try {
        await this.catchupScheduler.recordServerShutdown();
        console.log("✅ Shutdown time recorded successfully");
      } catch (error) {
        console.error("❌ Failed to record shutdown time:", error);
      }

      // Stop all scheduled jobs
      for (const [jobKey, job] of this.scheduledJobs.entries()) {
        job.stop();
        console.log(`🛑 Stopped job: ${jobKey}`);
      }

      console.log("🔄 Scheduler shutdown complete");
      process.exit(0);
    };

    // Handle different shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // For nodemon
  }

  /**
   * Get catch-up statistics for monitoring
   */
  async getCatchupStats(days = 7) {
    return await this.catchupScheduler.getCatchupStats(days);
  }

  /**
   * Manually trigger catch-up check (for testing or admin purposes)
   */
  async manualCatchupCheck() {
    console.log("🔧 Manual catch-up check triggered...");
    return await this.catchupScheduler.performCatchupCheck();
  }
}

module.exports = SchedulerManager;
