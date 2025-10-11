/**
 * Catch-up Scheduler System for Trinity Capital
 * Ensures students never miss scheduled transactions regardless of server downtime
 *
 * Features:
 * - Detects missed executions during server downtime
 * - Processes overdue transactions with correct dates
 * - Adjusts future execution dates properly
 * - Maintains educational integrity
 */

const { MongoClient } = require('mongodb');

class CatchupScheduler {
  constructor(mongoClient, socketIO) {
    this.client = mongoClient;
    this.io = socketIO;
    this.lastServerShutdown = null;
    this.serverStartTime = new Date();
  }

  /**
   * Main catch-up function to run when server starts
   * This should be called during server initialization
   */
  async performCatchupCheck() {
    console.log('🔄 Starting catch-up check for missed transactions...');

    try {
      // Get the last shutdown time (if available)
      const shutdownInfo = await this.getLastShutdownTime();
      const checkFromTime = shutdownInfo || this.getEstimatedDowntimeStart();

      console.log(
        `📅 Checking for missed transactions since: ${checkFromTime.toLocaleString()}`,
      );

      // Find all users with scheduled transactions
      const usersWithSchedules =
        await this.getAllUsersWithScheduledTransactions();

      let totalProcessed = 0;
      let totalMissed = 0;

      for (const user of usersWithSchedules) {
        const result = await this.processCatchupForUser(user, checkFromTime);
        totalProcessed += result.processed;
        totalMissed += result.missed;
      }

      console.log(
        `✅ Catch-up complete: ${totalProcessed} transactions processed, ${totalMissed} were missed`,
      );

      // Record this startup time for future reference
      await this.recordServerStartup();

      return {
        success: true,
        totalProcessed,
        totalMissed,
        usersProcessed: usersWithSchedules.length,
      };
    } catch (error) {
      console.error('❌ Catch-up check failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process catch-up for a specific user
   */
  async processCatchupForUser(user, checkFromTime) {
    const accountHolder = user.checkingAccount.accountHolder;
    console.log(`👤 Processing catch-up for user: ${accountHolder}`);

    let processed = 0;
    let missed = 0;

    // Process bills
    if (user.checkingAccount.bills && user.checkingAccount.bills.length > 0) {
      const billResults = await this.processCatchupTransactions(
        user,
        user.checkingAccount.bills,
        'bill',
        checkFromTime,
      );
      processed += billResults.processed;
      missed += billResults.missed;
    }

    // Process payments
    if (
      user.checkingAccount.payments &&
      user.checkingAccount.payments.length > 0
    ) {
      const paymentResults = await this.processCatchupTransactions(
        user,
        user.checkingAccount.payments,
        'payment',
        checkFromTime,
      );
      processed += paymentResults.processed;
      missed += paymentResults.missed;
    }

    return { processed, missed };
  }

  /**
   * Process catch-up for specific transaction type (bills or payments)
   */
  async processCatchupTransactions(user, transactions, type, checkFromTime) {
    let processed = 0;
    let missed = 0;
    const now = new Date();
    const accountHolder = user.checkingAccount.accountHolder;

    for (const transaction of transactions) {
      // Skip one-time transactions
      if (transaction.interval === 'once') {
        continue;
      }

      const nextExecution = new Date(transaction.nextExecution);

      // Check if this transaction was supposed to execute during downtime
      if (nextExecution <= now && nextExecution >= checkFromTime) {
        console.log(
          `  🔍 Found missed transaction: ${transaction.Name} (should have executed: ${nextExecution.toLocaleString()})`,
        );

        // Execute the missed transaction with the correct original date
        await this.executeMissedTransaction(
          user,
          transaction,
          nextExecution,
          type,
        );
        processed++;
        missed++;

        // Calculate and update the next execution date
        const newNextExecution = this.calculateNextExecutionDate(
          nextExecution,
          transaction.interval,
        );
        await this.updateTransactionNextExecution(
          accountHolder,
          transaction._id,
          newNextExecution,
          type,
        );

        console.log(
          `  ✅ Processed missed ${type}: ${transaction.Name}, next execution: ${newNextExecution.toLocaleString()}`,
        );
      }
      // Check if execution is due today
      else if (this.isExecutionDueToday(nextExecution)) {
        console.log(`  📅 Transaction due today: ${transaction.Name}`);
        // This will be handled by the regular scheduler, but we log it for visibility
      }
      // Future transactions - just log for verification
      else if (nextExecution > now) {
        console.log(
          `  ⏰ Future transaction: ${transaction.Name} scheduled for ${nextExecution.toLocaleString()}`,
        );
      }
    }

    return { processed, missed };
  }

  /**
   * Execute a missed transaction with the original scheduled date
   */
  async executeMissedTransaction(
    user,
    transaction,
    originalExecutionDate,
    type,
  ) {
    const accountHolder = user.checkingAccount.accountHolder;

    try {
      // Create transaction record with original date
      const transactionRecord = {
        _id: transaction._id,
        amount: transaction.amount,
        Name: transaction.Name,
        Category: transaction.Category,
        Date: originalExecutionDate.toISOString(), // Use original scheduled date
        type: type,
        interval: transaction.interval,
        catchup: true, // Mark as catch-up transaction
      };

      // Update user's balance
      const newBalance = user.checkingAccount.balance + transaction.amount;

      // Add to transaction history and update balance
      await this.addTransactionToUser(
        accountHolder,
        transactionRecord,
        newBalance,
      );

      // Emit real-time update to user if they're online
      this.io.to(accountHolder).emit('catchupTransaction', {
        transaction: transactionRecord,
        newBalance: newBalance,
        message: `Catch-up: ${transaction.Name} processed for ${originalExecutionDate.toLocaleDateString()}`,
      });

      console.log(
        `  💰 Executed missed ${type}: ${transaction.Name} for $${transaction.amount} on ${originalExecutionDate.toLocaleDateString()}`,
      );
    } catch (error) {
      console.error(
        `  ❌ Failed to execute missed transaction ${transaction.Name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add transaction to user's account
   */
  async addTransactionToUser(accountHolder, transactionRecord, newBalance) {
    const db = this.client.db('TrinityCapital');
    const collection = db.collection('User Profiles');

    await collection.updateOne(
      { 'checkingAccount.accountHolder': accountHolder },
      {
        $push: {
          'checkingAccount.transactions': transactionRecord,
          'checkingAccount.checkingHistory': transactionRecord,
        },
        $set: {
          'checkingAccount.balance': newBalance,
          'checkingAccount.balanceTotal': newBalance,
        },
      },
    );
  }

  /**
   * Update the next execution date for a transaction
   */
  async updateTransactionNextExecution(
    accountHolder,
    transactionId,
    newNextExecution,
    type,
  ) {
    const db = this.client.db('TrinityCapital');
    const collection = db.collection('User Profiles');

    const arrayField =
      type === 'bill' ? 'checkingAccount.bills' : 'checkingAccount.payments';

    await collection.updateOne(
      {
        'checkingAccount.accountHolder': accountHolder,
        [`${arrayField}._id`]: transactionId,
      },
      {
        $set: {
          [`${arrayField}.$.nextExecution`]: newNextExecution.toISOString(),
        },
      },
    );
  }

  /**
   * Calculate the next execution date based on interval
   */
  calculateNextExecutionDate(currentDate, interval) {
    const nextDate = new Date(currentDate);

    switch (interval) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'bi-weekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        throw new Error(`Unknown interval: ${interval}`);
    }

    return nextDate;
  }

  /**
   * Check if a transaction is due today
   */
  isExecutionDueToday(executionDate) {
    const today = new Date();
    const execDate = new Date(executionDate);

    return execDate.toDateString() === today.toDateString();
  }

  /**
   * Get all users with scheduled transactions
   */
  async getAllUsersWithScheduledTransactions() {
    const db = this.client.db('TrinityCapital');
    const collection = db.collection('User Profiles');

    const users = await collection
      .find({
        $or: [
          { 'checkingAccount.bills.0': { $exists: true } },
          { 'checkingAccount.payments.0': { $exists: true } },
        ],
      })
      .toArray();

    return users;
  }

  /**
   * Get the last recorded shutdown time from database
   */
  async getLastShutdownTime() {
    try {
      const db = this.client.db('TrinityCapital');
      const collection = db.collection('Server Status');

      const lastShutdown = await collection.findOne(
        {},
        { sort: { shutdownTime: -1 } },
      );

      return lastShutdown ? new Date(lastShutdown.shutdownTime) : null;
    } catch (error) {
      console.log('⚠️  Could not retrieve last shutdown time:', error.message);
      return null;
    }
  }

  /**
   * Estimate downtime start based on server start time
   * Assumes server was down for maximum of 24 hours
   */
  getEstimatedDowntimeStart() {
    const estimatedDowntime = new Date(this.serverStartTime);
    estimatedDowntime.setHours(estimatedDowntime.getHours() - 24); // Look back 24 hours
    return estimatedDowntime;
  }

  /**
   * Record server startup time for future reference
   */
  async recordServerStartup() {
    try {
      const db = this.client.db('TrinityCapital');
      const collection = db.collection('Server Status');

      await collection.insertOne({
        startupTime: this.serverStartTime,
        timestamp: new Date(),
      });
    } catch (error) {
      console.log('⚠️  Could not record server startup:', error.message);
    }
  }

  /**
   * Record server shutdown (call this in server shutdown handler)
   */
  async recordServerShutdown() {
    try {
      const db = this.client.db('TrinityCapital');
      const collection = db.collection('Server Status');

      await collection.insertOne({
        shutdownTime: new Date(),
        timestamp: new Date(),
      });

      console.log('📝 Server shutdown time recorded for catch-up reference');
    } catch (error) {
      console.log('⚠️  Could not record server shutdown:', error.message);
    }
  }

  /**
   * Get catch-up statistics for monitoring
   */
  async getCatchupStats(days = 7) {
    try {
      const db = this.client.db('TrinityCapital');
      const collection = db.collection('User Profiles');

      const since = new Date();
      since.setDate(since.getDate() - days);

      const stats = await collection
        .aggregate([
          {
            $unwind: '$checkingAccount.transactions',
          },
          {
            $match: {
              'checkingAccount.transactions.catchup': true,
              'checkingAccount.transactions.Date': {
                $gte: since.toISOString(),
              },
            },
          },
          {
            $group: {
              _id: null,
              totalCatchupTransactions: { $sum: 1 },
              totalAmount: { $sum: '$checkingAccount.transactions.amount' },
              users: { $addToSet: '$checkingAccount.accountHolder' },
            },
          },
        ])
        .toArray();

      return (
        stats[0] || {
          totalCatchupTransactions: 0,
          totalAmount: 0,
          users: [],
        }
      );
    } catch (error) {
      console.error('❌ Failed to get catch-up stats:', error);
      return null;
    }
  }
}

module.exports = CatchupScheduler;
