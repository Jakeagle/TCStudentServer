/**
 * Migration script to convert existing bills/payments to new persistent scheduler format
 * This adds the necessary fields for the new scheduler system
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class SchedulerMigration {
  constructor() {
    this.client = null;
    this.db = null;
    this.mongoUri = process.env.MONGODB_URI;
  }

  async connect() {
    try {
      this.client = new MongoClient(this.mongoUri);
      await this.client.connect();
      this.db = this.client.db('TrinityCapital');
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('✅ Disconnected from MongoDB');
    }
  }

  calculateNextExecutionDate(createdDate, interval) {
    const created = new Date(createdDate);
    const now = new Date();

    switch (interval) {
      case 'weekly':
        const daysUntilNext = (7 - (now.getDay() - created.getDay())) % 7;
        const nextWeekly = new Date(now);
        nextWeekly.setDate(
          now.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext),
        );
        nextWeekly.setHours(0, 0, 0, 0);
        return nextWeekly;

      case 'bi-weekly':
        const daysSinceCreated = Math.floor(
          (now - created) / (1000 * 60 * 60 * 24),
        );
        const cyclesSinceCreated = Math.floor(daysSinceCreated / 14);
        const nextBiWeekly = new Date(created);
        nextBiWeekly.setDate(created.getDate() + (cyclesSinceCreated + 1) * 14);
        nextBiWeekly.setHours(0, 0, 0, 0);
        return nextBiWeekly;

      case 'monthly':
        const nextMonthly = new Date(created);
        nextMonthly.setMonth(now.getMonth() + 1);
        if (nextMonthly <= now) {
          nextMonthly.setMonth(now.getMonth() + 2);
        }
        nextMonthly.setHours(0, 0, 0, 0);
        return nextMonthly;

      case 'yearly':
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

  async migrateBillsAndPayments() {
    try {
      console.log('🔄 Starting bills and payments migration...');

      const profiles = await this.db
        .collection('User Profiles')
        .find({})
        .toArray();
      let totalUpdated = 0;
      let profilesUpdated = 0;

      for (const profile of profiles) {
        const memberName = profile.checkingAccount?.accountHolder;
        if (!memberName) continue;

        let profileNeedsUpdate = false;
        const updates = {};

        // Process bills
        if (profile.checkingAccount?.bills) {
          const updatedBills = profile.checkingAccount.bills.map(bill => {
            if (!bill._id) {
              bill._id = new ObjectId();
              profileNeedsUpdate = true;
              totalUpdated++;
            }

            if (!bill.Date) {
              bill.Date = new Date().toISOString();
              profileNeedsUpdate = true;
            }

            if (
              !bill.nextExecution &&
              bill.interval &&
              bill.interval !== 'once'
            ) {
              const nextExecution = this.calculateNextExecutionDate(
                bill.Date,
                bill.interval,
              );
              if (nextExecution) {
                bill.nextExecution = nextExecution.toISOString();
                profileNeedsUpdate = true;
              }
            }

            return bill;
          });

          if (profileNeedsUpdate) {
            updates['checkingAccount.bills'] = updatedBills;
          }
        }

        // Process payments
        if (profile.checkingAccount?.payments) {
          const updatedPayments = profile.checkingAccount.payments.map(
            payment => {
              if (!payment._id) {
                payment._id = new ObjectId();
                profileNeedsUpdate = true;
                totalUpdated++;
              }

              if (!payment.Date) {
                payment.Date = new Date().toISOString();
                profileNeedsUpdate = true;
              }

              if (
                !payment.nextExecution &&
                payment.interval &&
                payment.interval !== 'once'
              ) {
                const nextExecution = this.calculateNextExecutionDate(
                  payment.Date,
                  payment.interval,
                );
                if (nextExecution) {
                  payment.nextExecution = nextExecution.toISOString();
                  profileNeedsUpdate = true;
                }
              }

              return payment;
            },
          );

          if (profileNeedsUpdate) {
            updates['checkingAccount.payments'] = updatedPayments;
          }
        }

        // Update the profile if needed
        if (profileNeedsUpdate && Object.keys(updates).length > 0) {
          await this.db
            .collection('User Profiles')
            .updateOne({ _id: profile._id }, { $set: updates });
          profilesUpdated++;
          console.log(`✅ Updated profile for ${memberName}`);
        }
      }

      console.log(`\n📊 Migration Summary:`);
      console.log(`   Profiles processed: ${profiles.length}`);
      console.log(`   Profiles updated: ${profilesUpdated}`);
      console.log(`   Total transactions updated: ${totalUpdated}`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async verifyMigration() {
    try {
      console.log('\n🔍 Verifying migration...');

      const profiles = await this.db
        .collection('User Profiles')
        .find({
          $or: [
            { 'checkingAccount.bills': { $exists: true, $ne: [] } },
            { 'checkingAccount.payments': { $exists: true, $ne: [] } },
          ],
        })
        .toArray();

      let issues = 0;

      for (const profile of profiles) {
        const memberName = profile.checkingAccount?.accountHolder;

        // Check bills
        if (profile.checkingAccount?.bills) {
          for (const bill of profile.checkingAccount.bills) {
            if (!bill._id) {
              console.log(
                `⚠️  Missing _id in bill for ${memberName}: ${bill.Name}`,
              );
              issues++;
            }
            if (!bill.Date) {
              console.log(
                `⚠️  Missing Date in bill for ${memberName}: ${bill.Name}`,
              );
              issues++;
            }
          }
        }

        // Check payments
        if (profile.checkingAccount?.payments) {
          for (const payment of profile.checkingAccount.payments) {
            if (!payment._id) {
              console.log(
                `⚠️  Missing _id in payment for ${memberName}: ${payment.Name}`,
              );
              issues++;
            }
            if (!payment.Date) {
              console.log(
                `⚠️  Missing Date in payment for ${memberName}: ${payment.Name}`,
              );
              issues++;
            }
          }
        }
      }

      if (issues === 0) {
        console.log('✅ Migration verification passed - no issues found');
      } else {
        console.log(`❌ Migration verification found ${issues} issues`);
      }

      return issues === 0;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      return false;
    }
  }

  async run() {
    try {
      await this.connect();
      await this.migrateBillsAndPayments();
      await this.verifyMigration();
      console.log('\n🎉 Migration completed successfully!');
    } catch (error) {
      console.error('💥 Migration failed:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new SchedulerMigration();
  migration.run();
}

module.exports = SchedulerMigration;
