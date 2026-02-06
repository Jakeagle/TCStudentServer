/**
 * Sample Data Manager
 * ==================
 * Manages the lifecycle of sample user data in MongoDB.
 *
 * Purpose:
 * - Provides a clean slate for sample students and teachers on each login
 * - Cleans up all user-specific data when sample users log out/leave
 * - Maintains the user document itself (just resets their data)
 *
 * Usage:
 * - Call resetSampleUserData(username, userType) on logout
 * - Call setupSampleStudent(studentName, teacherName) when sample student logs in
 * - Call verifySampleStudent(studentName, teacherName) to ensure membership
 */

const { ObjectId } = require("mongodb");

class SampleDataManager {
  constructor(mongoClient) {
    this.client = mongoClient;
    this.db = mongoClient.db("TrinityCapital");
  }

  /**
   * Checks if a username contains "sample" (case-insensitive)
   */
  isSampleUser(username) {
    return username && username.toLowerCase().includes("sample");
  }

  /**
   * Resets all MongoDB data for a sample user while keeping the user document
   * Preserves: userName, pin, userType, name
   * Deletes: Everything else (account data, lessons, messages, etc.)
   */
  async resetSampleUserData(username, userType) {
    if (!this.isSampleUser(username)) {
      console.log(
        `ℹ️  [SampleDataManager] "${username}" is not a sample user - no data reset`,
      );
      return { success: false, reason: "not_sample_user" };
    }

    console.log(
      `🗑️  [SampleDataManager] Resetting sample user data for: ${username}`,
    );

    try {
      // For students (User Profiles)
      if (userType === "student") {
        const result = await this.resetStudentData(username);
        return result;
      }

      // For teachers (Teachers collection)
      if (userType === "teacher") {
        const result = await this.resetTeacherData(username);
        return result;
      }

      return { success: false, reason: "invalid_usertype" };
    } catch (error) {
      console.error(
        `❌ [SampleDataManager] Error resetting sample user data:`,
        error,
      );
      return { success: false, reason: "error", error: error.message };
    }
  }

  /**
   * Reset student data in User Profiles collection
   */
  async resetStudentData(studentName) {
    try {
      const userProfilesCollection = this.db.collection("User Profiles");

      // Get the original user to preserve essential fields
      const originalProfile = await userProfilesCollection.findOne({
        memberName: studentName,
      });

      if (!originalProfile) {
        console.log(
          `ℹ️  [SampleDataManager] No profile found for student: ${studentName}`,
        );
        return { success: false, reason: "profile_not_found" };
      }

      // Create a reset profile with default values
      const resetProfile = {
        memberName: originalProfile.memberName,
        userName: originalProfile.userName,
        pin: originalProfile.pin,
        userType: originalProfile.userType || "student",
        school: originalProfile.school,
        teacher: originalProfile.teacher,
        locale: originalProfile.locale || "en-US",
        grade: 0,
        lessonsCompleted: 0,
        classPeriod: originalProfile.classPeriod || "",

        // Reset account data
        checkingAccount: {
          accountHolder: studentName,
          accountType: "Checking",
          accountNumber:
            originalProfile.checkingAccount?.accountNumber || "XXXX-1001",
          routingNumber:
            originalProfile.checkingAccount?.routingNumber || "021000021",
          balanceTotal: 0,
          transactions: [],
          movementsDates: [],
          bills: [],
          payments: [],
        },
        savingsAccount: {
          accountHolder: studentName,
          accountType: "Savings",
          accountNumber:
            originalProfile.savingsAccount?.accountNumber || "XXXX-2001",
          routingNumber:
            originalProfile.savingsAccount?.routingNumber || "021000021",
          balanceTotal: 0,
          transactions: [],
          movementsDates: [],
          bills: [],
          payments: [],
        },

        // Reset lesson/unit data
        assignedUnitIds: originalProfile.assignedUnitIds || [],
        completedLessons: [],
        activeLessons: [],
        lessonTimers: {},

        // Reset other activity
        loans: [],
        donations: [],
        messages: [],
        lastLogin: new Date().toISOString(),
      };

      // Update the profile with reset data
      await userProfilesCollection.updateOne(
        { memberName: studentName },
        { $set: resetProfile },
      );

      console.log(
        `✅ [SampleDataManager] Reset student data for: ${studentName}`,
      );

      // Clean up related data in other collections
      await this.cleanupStudentRelatedData(studentName);

      return {
        success: true,
        message: `Student data reset for ${studentName}`,
      };
    } catch (error) {
      console.error(
        `❌ [SampleDataManager] Error resetting student data:`,
        error,
      );
      return { success: false, reason: "error", error: error.message };
    }
  }

  /**
   * Reset teacher data in Teachers collection
   */
  async resetTeacherData(teacherName) {
    try {
      const teachersCollection = this.db.collection("Teachers");

      // Get the original teacher to preserve essential fields
      const originalTeacher = await teachersCollection.findOne({
        name: teacherName,
      });

      if (!originalTeacher) {
        console.log(`ℹ️  [SampleDataManager] No teacher found: ${teacherName}`);
        return { success: false, reason: "teacher_not_found" };
      }

      // Create a reset teacher profile with default values
      const resetTeacher = {
        name: originalTeacher.name,
        email: originalTeacher.email,
        pin: originalTeacher.pin,
        school: originalTeacher.school,

        // Reset class and student data
        className: originalTeacher.className || "Sample Class",
        classCode: originalTeacher.classCode || "SAMPLE001",
        students: [], // Empty class
        units: [], // Clear all units/lessons
        lessons: [], // Clear lessons array
        customUnits: [],
        messages: [],
        emailSettings: {
          addresses: [],
          templates: [],
          groups: [],
        },
        lastLogin: new Date().toISOString(),
      };

      // Update the teacher with reset data
      await teachersCollection.updateOne(
        { name: teacherName },
        { $set: resetTeacher },
      );

      console.log(
        `✅ [SampleDataManager] Reset teacher data for: ${teacherName}`,
      );

      // Clean up related data in other collections
      await this.cleanupTeacherRelatedData(teacherName);

      return {
        success: true,
        message: `Teacher data reset for ${teacherName}`,
      };
    } catch (error) {
      console.error(
        `❌ [SampleDataManager] Error resetting teacher data:`,
        error,
      );
      return { success: false, reason: "error", error: error.message };
    }
  }

  /**
   * Clean up student-related data in other collections
   */
  async cleanupStudentRelatedData(studentName) {
    try {
      const collections = ["threads", "messages", "session_data"];

      for (const collName of collections) {
        const collection = this.db.collection(collName);

        // Delete messages/threads involving this student
        const result = await collection.deleteMany({
          $or: [
            { senderId: studentName },
            { participants: studentName },
            { studentName: studentName },
          ],
        });

        if (result.deletedCount > 0) {
          console.log(
            `🗑️  [SampleDataManager] Deleted ${result.deletedCount} documents from ${collName}`,
          );
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  [SampleDataManager] Error cleaning up student data:`,
        error.message,
      );
    }
  }

  /**
   * Clean up teacher-related data in other collections
   */
  async cleanupTeacherRelatedData(teacherName) {
    try {
      const collections = ["threads", "messages", "session_data"];

      for (const collName of collections) {
        const collection = this.db.collection(collName);

        // Delete messages/threads from this teacher
        const result = await collection.deleteMany({
          $or: [
            { senderId: teacherName },
            { participants: teacherName },
            { teacherName: teacherName },
          ],
        });

        if (result.deletedCount > 0) {
          console.log(
            `🗑️  [SampleDataManager] Deleted ${result.deletedCount} documents from ${collName}`,
          );
        }
      }
    } catch (error) {
      console.warn(
        `⚠️  [SampleDataManager] Error cleaning up teacher data:`,
        error.message,
      );
    }
  }

  /**
   * Setup a sample student to always be a member of a sample teacher's class
   */
  async setupSampleStudent(studentName, teacherName) {
    if (!this.isSampleUser(studentName) || !this.isSampleUser(teacherName)) {
      console.log(
        `ℹ️  [SampleDataManager] Not both sample users - skipping setup`,
      );
      return { success: false, reason: "not_sample_users" };
    }

    try {
      const studentCollection = this.db.collection("User Profiles");
      const teacherCollection = this.db.collection("Teachers");

      // Update student to belong to sample teacher
      await studentCollection.updateOne(
        { memberName: studentName },
        { $set: { teacher: teacherName } },
      );

      // Add student to teacher's class
      const teacher = await teacherCollection.findOne({ name: teacherName });
      if (teacher) {
        const students = teacher.students || [];
        if (!students.includes(studentName)) {
          students.push(studentName);
          await teacherCollection.updateOne(
            { name: teacherName },
            { $set: { students: students } },
          );
        }
      }

      console.log(
        `✅ [SampleDataManager] Setup: "${studentName}" is member of "${teacherName}"'s class`,
      );
      return { success: true };
    } catch (error) {
      console.error(
        `❌ [SampleDataManager] Error setting up sample student:`,
        error,
      );
      return { success: false, reason: "error", error: error.message };
    }
  }

  /**
   * Verify sample student membership (create if doesn't exist)
   */
  async verifySampleStudent(studentName, teacherName) {
    if (!this.isSampleUser(studentName) || !this.isSampleUser(teacherName)) {
      return { success: false, reason: "not_sample_users" };
    }

    try {
      const studentCollection = this.db.collection("User Profiles");
      const student = await studentCollection.findOne({
        memberName: studentName,
      });

      if (!student) {
        console.log(
          `ℹ️  [SampleDataManager] Sample student not found, creating...`,
        );
        // Create sample student if doesn't exist
        const newStudent = {
          memberName: studentName,
          userName: studentName,
          pin: 1234,
          userType: "student",
          teacher: teacherName,
          school: "Sample School",
          grade: 0,
          locale: "en-US",
          checkingAccount: {
            accountHolder: studentName,
            accountType: "Checking",
            accountNumber: "XXXX-1001",
            routingNumber: "021000021",
            balanceTotal: 0,
            transactions: [],
            movementsDates: [],
            bills: [],
            payments: [],
          },
          savingsAccount: {
            accountHolder: studentName,
            accountType: "Savings",
            accountNumber: "XXXX-2001",
            routingNumber: "021000021",
            balanceTotal: 0,
            transactions: [],
            movementsDates: [],
            bills: [],
            payments: [],
          },
          assignedUnitIds: [],
          completedLessons: [],
          activeLessons: [],
          lessonTimers: {},
          loans: [],
          donations: [],
          messages: [],
          lastLogin: new Date().toISOString(),
        };

        await studentCollection.insertOne(newStudent);
        console.log(
          `✅ [SampleDataManager] Created sample student: ${studentName}`,
        );
      } else {
        // Ensure membership
        await this.setupSampleStudent(studentName, teacherName);
      }

      return { success: true };
    } catch (error) {
      console.error(
        `❌ [SampleDataManager] Error verifying sample student:`,
        error,
      );
      return { success: false, reason: "error", error: error.message };
    }
  }
}

module.exports = SampleDataManager;
