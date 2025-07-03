require("dotenv").config();

const express = require("express");
const app = express();
const cron = require("node-cron");
const { fork } = require("child_process");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const cors = require("cors");
const bodyParser = require("body-parser");
let Profiles;

const port = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");
const mongoUri = process.env.MONGODB_URI;

// All Stripe-related code (checkouts, webhooks, and references) removed as requested.
//Redeploy comment for github

/*****************************************LICENSE MANAGEMENT***************************************************/

// Get school licenses for admin dashboard
app.get("/school-licenses/:admin_email", async (req, res) => {
  try {
    const { admin_email } = req.params;

    const licenses = await client
      .db("TrinityCapital")
      .collection("School Licenses")
      .find({ admin_email: admin_email, is_active: true })
      .toArray();

    res.json(licenses);
  } catch (error) {
    console.error("Error fetching school licenses:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get access codes for a school
app.get("/access-codes/:school_name", async (req, res) => {
  try {
    const { school_name } = req.params;

    const codes = await client
      .db("TrinityCapital")
      .collection("Access Codes")
      .find({ school: school_name })
      .toArray();

    res.json(codes);
  } catch (error) {
    console.error("Error fetching access codes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Validate license capacity before account creation
app.post("/validate-license-capacity", async (req, res) => {
  try {
    const { access_code } = req.body;

    // Find the access code
    const code = await client
      .db("TrinityCapital")
      .collection("Access Codes")
      .findOne({ code: access_code });

    if (!code) {
      return res.status(404).json({ error: "Invalid access code" });
    }

    if (code.used) {
      return res.status(400).json({ error: "Access code already used" });
    }

    if (new Date() > new Date(code.expires_at)) {
      return res.status(400).json({ error: "Access code expired" });
    }

    // Check license capacity
    const license = await client
      .db("TrinityCapital")
      .collection("School Licenses")
      .findOne({ school_name: code.school, is_active: true });

    if (!license) {
      return res
        .status(404)
        .json({ error: "No active license found for this school" });
    }

    // Count current usage
    const currentUsers = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .countDocuments({ school: code.school });

    const totalLicenses = license.student_licenses + license.teacher_licenses;

    if (currentUsers >= totalLicenses) {
      return res.status(400).json({ error: "License capacity exceeded" });
    }

    res.json({
      valid: true,
      school: code.school,
      type: code.type,
      remaining_capacity: totalLicenses - currentUsers,
    });
  } catch (error) {
    console.error("Error validating license capacity:", error);
    res.status(500).json({ error: error.message });
  }
});

/*****************************************Socket.io***************************************************/

const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.SOCKET_ORIGIN.split(","),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store socket connections with user identifiers
const userSockets = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user identification
  socket.on("identify", (userId) => {
    try {
      console.log("User identified:", userId);
      userSockets.set(userId, socket);

      // Acknowledge successful identification
      socket.emit("identified", { success: true });
    } catch (error) {
      console.error("Error during user identification:", error);
      socket.emit("error", { message: "Failed to identify user" });
    }
  });

  // Handle studentCreated event from remote client (e.g., localhost:5000)
  socket.on("studentCreated", (data, callback) => {
    console.log("Received studentCreated event from remote client:", data);
    // Prepare student data with correct defaults and structure
    const studentData = {
      memberName: data.memberName,
      checkingBalance: data.checkingAccount?.balanceTotal ?? 0,
      savingsBalance: data.savingsAccount?.balanceTotal ?? 0,
      grade: data.grade ?? 0,
      lessonsCompleted: data.lessonsCompleted ?? 0,
      classPeriod: data.classPeriod ?? "",
    };
    io.emit("studentAdded", studentData);
    if (typeof callback === "function") {
      console.log("Sending ack callback for studentCreated event");
      callback({ success: true });
    } else {
      console.warn("No callback function provided for studentCreated event");
    }
  });

  /**
   * =================================================================
   * UNIFIED MESSAGING SYSTEM
   * =================================================================
   * This is the single entry point for all messages sent from any client.
   */
  socket.on("sendMessage", async (data, callback) => {
    const { senderId, recipientId, messageContent } = data;

    console.log("Received sendMessage event:", data);

    if (!senderId || !recipientId || !messageContent) {
      console.error("Invalid message data received:", data);
      if (callback) callback({ success: false, error: "Invalid data" });
      return;
    }

    const timestamp = new Date();
    // Check if it's a class-wide message
    const isClassMessage = recipientId.startsWith("class-message-");
    let threadId;
    let participants = [];

    try {
      let thread;
      if (isClassMessage) {
        threadId = recipientId; // e.g., 'class-message-Ms.Thompson'
        participants = [senderId, "class-message-recipient"]; // A generic recipient for class messages
        // Find the class message thread for this teacher
        thread = await client
          .db("TrinityCapital")
          .collection("threads")
          .findOne({ threadId: threadId });
        if (!thread) {
          // Create new class message thread
          thread = {
            threadId: threadId,
            type: "class",
            participants: participants,
            messages: [],
            createdAt: timestamp,
          };
          await client
            .db("TrinityCapital")
            .collection("threads")
            .insertOne(thread);
        }
      } else {
        // Private message
        // Ensure consistent threadId for private chats (sorted participants)
        const sortedParticipants = [senderId, recipientId].sort();
        threadId = sortedParticipants.join("_"); // e.g., 'Emily Johnson_Ms.Thompson'
        participants = sortedParticipants;

        // Find existing private thread
        thread = await client
          .db("TrinityCapital")
          .collection("threads")
          .findOne({
            threadId: threadId,
            type: "private",
          });

        if (!thread) {
          // Create new private thread
          thread = {
            threadId: threadId,
            type: "private",
            participants: participants,
            messages: [],
            createdAt: timestamp,
          };
          await client
            .db("TrinityCapital")
            .collection("threads")
            .insertOne(thread);
        }
      }

      const messageDoc = {
        senderId,
        recipientId, // Keep original recipientId for individual student targeting in class messages
        messageContent,
        timestamp,
        isClassMessage: isClassMessage,
        read: false, // Initial state
      };

      // Add message to the thread and update lastMessageTimestamp
      await client
        .db("TrinityCapital")
        .collection("threads")
        .updateOne(
          { threadId: threadId },
          {
            $push: { messages: messageDoc },
            $set: { lastMessageTimestamp: timestamp },
          }
        );

      // --- Broadcasting to relevant users ---
      // For class messages, broadcast to all students of the teacher AND the teacher
      if (isClassMessage) {
        const teacherName = senderId; // senderId is the teacher's full name
        const teacherDoc = await client
          .db("TrinityCapital")
          .collection("Teachers")
          .findOne({ name: teacherName });
        if (!teacherDoc) throw new Error("Teacher not found");

        const students = await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .find({ teacher: teacherDoc.name })
          .project({ memberName: 1 })
          .toArray();

        // Send to all students
        for (const student of students) {
          const studentSocket = userSockets.get(student.memberName);
          if (studentSocket) {
            // Send the message as if it's from the teacher to the student, marked as class message
            studentSocket.emit("newMessage", {
              senderId: teacherName,
              recipientId: student.memberName, // The student's ID
              messageContent,
              timestamp,
              isClassMessage: true,
            });
            console.log(`Forwarded class message to ${student.memberName}`);
          }
        }
        // Send to the teacher (sender)
        const teacherSocket = userSockets.get(teacherName);
        if (teacherSocket) {
          teacherSocket.emit("newMessage", messageDoc); // Send the original messageDoc
        }
      } else {
        // Private message: send to recipient and sender
        const recipientSocket = userSockets.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit("newMessage", messageDoc);
          console.log(`Forwarded private message to ${recipientId}`);
        }
        const senderSocket = userSockets.get(senderId);
        if (senderSocket) {
          senderSocket.emit("newMessage", messageDoc);
        }
      }
      if (callback) callback({ success: true });
    } catch (error) {
      console.error("Error processing sendMessage:", error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on("disconnect", () => {
    try {
      // Remove socket from map when user disconnects
      for (const [userId, userSocket] of userSockets.entries()) {
        if (userSocket === socket) {
          console.log("User disconnected:", userId);
          userSockets.delete(userId);
          break;
        }
      }
    } catch (error) {
      console.error("Error during disconnect:", error);
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Listen for 'studentCreated' event from another server (localhost:5000)
const { io: ClientIO } = require("socket.io-client");
const EXTERNAL_SOCKET_URL =
  process.env.EXTERNAL_SOCKET_URL || "http://localhost:5000";
const externalSocket = ClientIO(EXTERNAL_SOCKET_URL);

externalSocket.on("connect", () => {
  console.log(
    "Connected to external server at localhost:5000 for studentCreated events"
  );
});

externalSocket.on("studentCreated", (data, callback) => {
  console.log("Received studentCreated event from localhost:5000:", data);
  // Emit to all connected clients on this server
  io.emit("studentAdded", data);
  // Send confirmation back to 5000
  if (typeof callback === "function") {
    console.log("Sending ack callback for studentCreated event");
    callback({ success: true });
  } else {
    console.warn("No callback function provided for studentCreated event");
  }
});

externalSocket.on("disconnect", () => {
  console.log("Disconnected from external server at localhost:5000");
});

/*****************************************MongoDB***************************************************/

const { MongoClient, ServerApiVersion } = require("mongodb");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

/*****************************************Main Page***************************************************/

app.use(express.static("public"));
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.post("/initialBalance", async (req, res) => {
  const { parcel } = req.body;

  const profile = parcel;

  const memberName = profile.memberName;

  let checkingTransAmounts = [];
  let savingsTransAmounts = [];

  let checkingBalance;

  profile.checkingAccount.transactions.forEach((transaction) => {
    checkingTransAmounts.push(transaction.amount);
  });

  profile.savingsAccount.transactions.forEach((transaction) => {
    savingsTransAmounts.push(transaction.amount);
  });

  checkingBalance = checkingTransAmounts.reduce((acc, mov) => acc + mov, 0);
  savingsBalance = savingsTransAmounts.reduce((acc, mov) => acc + mov, 0);

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": memberName },
      {
        $set: { "checkingAccount.balanceTotal": checkingBalance },
      }
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "savingsAccount.accountHolder": memberName },
      {
        $set: { "savingsAccount.balanceTotal": savingsBalance },
      }
    );

  const updatedUserProfile = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .findOne({ "checkingAccount.accountHolder": memberName });

  const updatedChecking = updatedUserProfile.checkingAccount;

  // Send update only to specific user
  const userSocket = userSockets.get(memberName);
  if (userSocket) {
    userSocket.emit("checkingAccountUpdate", updatedChecking);
  }
});

app.get("/profiles", async (req, res) => {
  try {
    const profiles = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find()
      .toArray();

    // Send profiles only to the requesting user
    const userSocket = userSockets.get(req.query.userId);
    if (userSocket) {
      userSocket.emit("profiles", profiles);
    }

    res.status(200).send(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/loans", async (req, res) => {
  const { parcel } = req.body;
  const profile = parcel[0];
  const amount = parcel[1];
  let name = profile.checkingAccount.accountHolder;

  try {
    const UserProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": name });

    // Update the transactions in the user profile
    const balance = UserProfile.checkingAccount.transactions.reduce(
      (acc, mov) => acc + mov,
      0
    );
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": name },
        {
          $push: { "checkingAccount.transactions": amount },
          $set: { "checkingAccount.balanceTotal": balance },
        }
      );
    let newDate = new Date().toISOString();
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": name },
        { $push: { "checkingAccount.movementsDates": newDate } }
      );
    const updatedUserProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": name });

    const updatedChecking = updatedUserProfile.checkingAccount;

    // Send update only to specific user
    const userSocket = userSockets.get(name);
    if (userSocket) {
      userSocket.emit("checkingAccountUpdate", updatedChecking);
    }

    res.status(200).json({ message: "Transaction successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*****************************************Transfers***************************************************/

app.post("/transfer", async (req, res) => {
  const { parcel } = req.body;

  const currentProfile = parcel[0];
  const accountFromPg = parcel[1];
  const accountToPg = parcel[2];
  const amount = parcel[3];
  const memberNamePg = parcel[4];

  let fromBalanceField = [];
  let toBalanceField = [];

  let newDate = new Date().toISOString();

  if (
    accountFromPg.accountType === "Checking" &&
    accountToPg.accountType === "Savings"
  ) {
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": memberNamePg },
        {
          $push: {
            "checkingAccount.transactions": {
              amount: -amount,
              interval: "once",
              Name: ` ${accountFromPg.accountType} ---> ${accountToPg.accountType}`,
              Category: "Transfer",
            },
          },
        }
      );

    let newDate = new Date().toISOString();
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": memberNamePg },
        { $push: { "checkingAccount.movementsDates": newDate } }
      );

    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "savingsAccount.accountHolder": memberNamePg },
        {
          $push: {
            "savingsAccount.transactions": {
              amount: amount,
              interval: "once",
              Name: ` ${accountFromPg.accountType} ---> ${accountToPg.accountType}`,
              Category: "Transfer",
            },
          },
        }
      );

    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "savingsAccount.accountHolder": memberNamePg },
        { $push: { "savingsAccount.movementsDates": newDate } }
      );

    const updatedUserProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": memberNamePg });

    const upCheck = updatedUserProfile.checkingAccount;
    const upSav = updatedUserProfile.savingsAccount;

    balanceCalc(memberNamePg, upCheck, upCheck.accountType);
    balanceCalc(memberNamePg, upSav, upSav.accountType);
  }

  if (
    accountFromPg.accountType === "Savings" &&
    accountToPg.accountType === "Checking"
  ) {
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "savingsAccount.accountHolder": memberNamePg },
        {
          $push: {
            "savingsAccount.transactions": {
              amount: -amount,
              interval: "once",
              Name: ` ${accountFromPg.accountType} ---> ${accountToPg.accountType}`,
              Category: "Transfer",
            },
          },
        }
      );

    let newDate = new Date().toISOString();
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "savingsAccount.accountHolder": memberNamePg },
        { $push: { "savingsAccount.movementsDates": newDate } }
      );

    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": memberNamePg },
        {
          $push: {
            "checkingAccount.transactions": {
              amount: amount,
              interval: "once",
              Name: ` ${accountFromPg.accountType} ---> ${accountToPg.accountType}`,
              Category: "Transfer",
            },
          },
        }
      );

    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": memberNamePg },
        { $push: { "checkingAccount.movementsDates": newDate } }
      );

    const updatedUserProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": memberNamePg });

    const upCheck = updatedUserProfile.checkingAccount;
    const upSav = updatedUserProfile.savingsAccount;

    balanceCalc(memberNamePg, upCheck, upCheck.accountType);
    balanceCalc(memberNamePg, upSav, upSav.accountType);
  }
});

const balanceCalc = async function (memberName, acc, type) {
  console.log(
    `Starting balanceCalc for member: ${memberName}, account type: ${type}`
  );

  let amounts = [];
  let balance;

  // Collecting transaction amounts
  try {
    acc.transactions.forEach((transaction) => {
      amounts.push(transaction.amount);
    });
    console.log(`Collected transaction amounts: ${amounts}`);
  } catch (error) {
    console.error(
      `Error collecting transaction amounts for ${memberName}:`,
      error
    );
    return; // Exit early if there's an error
  }

  // Calculating balance
  try {
    balance = amounts.reduce((acc, mov) => acc + mov, 0);
    console.log(`Calculated balance for ${type} account: ${balance}`);
  } catch (error) {
    console.error(`Error calculating balance for ${memberName}:`, error);
    return;
  }

  // Updating database with new balance
  try {
    if (type === "Checking") {
      console.log(`Updating Checking account balance for ${memberName}`);
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberName },
          { $set: { "checkingAccount.balanceTotal": balance } }
        );
    } else if (type === "Savings") {
      console.log(`Updating Savings account balance for ${memberName}`);
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "savingsAccount.accountHolder": memberName },
          { $set: { "savingsAccount.balanceTotal": balance } }
        );
    }
  } catch (error) {
    console.error(`Error updating database for ${memberName}:`, error);
    return;
  }

  // Fetching updated user profile
  let updatedUserProfile;
  try {
    updatedUserProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": memberName });

    if (!updatedUserProfile) {
      console.error(`No user profile found for ${memberName}`);
      return;
    }

    console.log(
      `Fetched updated profile for ${memberName}:`,
      updatedUserProfile
    );
  } catch (error) {
    console.error(`Error fetching updated profile for ${memberName}:`, error);
    return;
  }

  // Extracting updated checking account
  const updatedChecking = updatedUserProfile.checkingAccount;
  console.log(`Updated Checking account data:`, updatedChecking);

  // Emitting socket event
  try {
    const userSocket = userSockets.get(memberName);
    if (userSocket) {
      console.log(
        `Emitting 'checkingAccountUpdate' event to socket for ${memberName}`
      );
      userSocket.emit("checkingAccountUpdate", updatedChecking);
    } else {
      console.warn(`No socket found for ${memberName}`);
    }
  } catch (error) {
    console.error(`Error emitting socket event for ${memberName}:`, error);
  }
};

app.post("/bills", async (req, res) => {
  const { parcel } = req.body;

  const profile = parcel[0];
  const type = parcel[1];
  const amount = parcel[2];
  const interval = parcel[3];
  const billName = parcel[4];
  const cat = parcel[5];
  const date = parcel[6];

  console.log(date, 387);
  const prfName = profile.memberName;

  const newTrans = {
    amount: amount,
    interval: interval,
    Name: billName,
    Category: cat,
    Date: date,
  };

  const billSetter = async function (type, name, newTrans) {
    if (type === "bill") {
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": name },
          { $push: { "checkingAccount.bills": newTrans } }
        );
    } else if (type === "payment") {
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": name },
          { $push: { "checkingAccount.payments": newTrans } }
        );
    }

    billManager(name);
    paymentManager(name);
  };

  billSetter(type, prfName, newTrans);

  const billManager = async function (name) {
    const newProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": name });

    let bills = newProfile.checkingAccount.bills;

    for (let i = 0; i < bills.length; i++) {
      let time = bills[i].interval;

      const now = new Date();
      let delay;

      if (time === "weekly") {
        // Map weekly schedules based on the current day of the week
        const weeklySchedules = {
          0: "0 0 * * 0", // Sunday
          1: "0 0 * * 1", // Monday
          2: "0 0 * * 2", // Tuesday
          3: "0 0 * * 3", // Wednesday
          4: "0 0 * * 4", // Thursday
          5: "0 0 * * 5", // Friday
          6: "0 0 * * 6", // Saturday
        };

        delay = weeklySchedules[now.getDay()];
        console.log(delay, 472);
      } else if (time === "bi-weekly") {
        // Run on the 1st and 15th of each month at midnight
        delay = `0 0 1,15 * *`;
      } else if (time === "monthly") {
        // Map monthly schedules based on the current month
        const monthlySchedules = {
          0: "0 0 1 1 *", // January
          1: "0 0 1 2 *", // February
          2: "0 0 1 3 *", // March
          3: "0 0 1 4 *", // April
          4: "0 0 1 5 *", // May
          5: "0 0 1 6 *", // June
          6: "0 0 1 7 *", // July
          7: "0 0 1 8 *", // August
          8: "0 0 1 9 *", // September
          9: "0 0 1 10 *", // October
          10: "0 0 1 11 *", // November
          11: "0 0 1 12 *", // December
        };
        delay = monthlySchedules[now.getMonth()];
      } else if (time === "yearly") {
        // Run yearly on January 1st at midnight
        delay = `0 0 1 1 *`;
      }

      const billSet = async () => {
        console.log(`Executing bill for ${name} with interval: ${time}`);
        let newDate = new Date().toISOString();
        await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": name },
            {
              $push: { "checkingAccount.transactions": bills[i] },
            }
          );

        await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": name },
            {
              $push: { "checkingAccount.movementsDates": newDate },
            }
          );

        updateCheckingBalanceFromTransactions(name);
        const updatedProfile = await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .findOne({ "checkingAccount.accountHolder": name });

        const updatedChecking = updatedProfile.checkingAccount;

        // Send update only to specific user
        const userSocket = userSockets.get(name);
        if (userSocket) {
          userSocket.emit("checkingAccountUpdate", updatedChecking);
        }
      };

      console.log(`Scheduling bill for ${name} with delay: ${delay}`);
      cron.schedule(delay, billSet);
    }
  };

  const paymentManager = async function (name) {
    let interval;
    const newProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": name });

    let payments = newProfile.checkingAccount.payments;

    for (let i = 0; i < payments.length; i++) {
      let time = payments[i].interval;

      const now = new Date();
      const currentDay = now.getDate();
      let delay;

      if (time === "weekly") {
        // Map weekly schedules based on the current day of the week
        const weeklySchedules = {
          0: "0 0 * * 0", // Sunday
          1: "0 0 * * 1", // Monday
          2: "0 0 * * 2", // Tuesday
          3: "0 0 * * 3", // Wednesday
          4: "0 0 * * 4", // Thursday
          5: "0 0 * * 5", // Friday
          6: "0 0 * * 6", // Saturday
        };

        delay = weeklySchedules[now.getDay()];
        console.log(delay, 558);
      } else if (time === "bi-weekly") {
        delay = `0 0 1,15 * *`;
      } else if (time === "monthly") {
        // Map monthly schedules based on the current month
        const monthlySchedules = {
          0: "0 0 1 1 *", // January
          1: "0 0 1 2 *", // February
          2: "0 0 1 3 *", // March
          3: "0 0 1 4 *", // April
          4: "0 0 1 5 *", // May
          5: "0 0 1 6 *", // June
          6: "0 0 1 7 *", // July
          7: "0 0 1 8 *", // August
          8: "0 0 1 9 *", // September
          9: "0 0 1 10 *", // October
          10: "0 0 1 11 *", // November
          11: "0 0 1 12 *", // December
        };
        delay = monthlySchedules[now.getMonth()];
      } else if (time === "yearly") {
        delay = `0 0 1 1 *`;
      }

      const paymentSet = async () => {
        let newDate = new Date().toISOString();
        await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": name },
            {
              $push: { "checkingAccount.transactions": payments[i] },
            }
          );

        await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .updateOne(
            { "checkingAccount.accountHolder": name },
            {
              $push: { "checkingAccount.movementsDates": newDate },
            }
          );

        updateCheckingBalanceFromTransactions(name);

        const updatedProfile = await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .findOne({ "checkingAccount.accountHolder": name });

        const updatedChecking = updatedProfile.checkingAccount;

        // Send update only to specific user
        const userSocket = userSockets.get(name);
        if (userSocket) {
          userSocket.emit("checkingAccountUpdate", updatedChecking);
        }
      };
      cron.schedule(delay, paymentSet);
      console.log(delay, 339);
    }
  };

  const updateCheckingBalanceFromTransactions = async function (name) {
    let balanceArray = [];
    let balance;
    let profile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": name });

    if (profile.checkingAccount.transactions.length <= 0) {
      balance = 0;
    } else if (profile.checkingAccount.transactions.length > 0) {
      for (let i = 0; i < profile.checkingAccount.transactions.length; i++) {
        let transAmounts = profile.checkingAccount.transactions[i].amount;

        balanceArray.push(transAmounts);
        balance = balanceArray.reduce((acc, mov) => acc + mov, 0);
      }
    }
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": name },
        {
          $set: { "checkingAccount.balanceTotal": balance },
        }
      );
  };
  const updatedUserProfile = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .findOne({ "checkingAccount.accountHolder": prfName });

  const updatedChecking = updatedUserProfile.checkingAccount;

  console.log(process.pid, 265);

  // Send update only to specific user
  const userSocket = userSockets.get(prfName);
  if (userSocket) {
    userSocket.emit("checkingAccountUpdate", updatedChecking);
  }
});

app.post("/simulateTimeTravel", async (req, res) => {
  const { userName, days } = req.body; // How many days to simulate

  if (!userName || !days) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  console.log(`Simulating ${days} days for ${userName}...`);

  try {
    await billManagerTimeTravel(userName, days);
    await paymentManagerTimeTravel(userName, days);

    return res
      .status(200)
      .json({ message: `Simulated ${days} days successfully for ${userName}` });
  } catch (error) {
    console.error("Error simulating time travel:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/************************************ Time Travel Functions ****************************************/

const timeMultiplier = 1; // 1 second = 1 day

async function billManagerTimeTravel(userName, daysToSimulate) {
  const userProfile = await client
    .db("TrinityCapital")
    .collection("Time Travel Profiles") // Ensure we're using time travel profiles
    .findOne({ userName: userName });

  if (!userProfile) {
    throw new Error(`Time travel profile for ${userName} not found`);
  }

  let bills = userProfile.checkingAccount.bills;
  const transactionsToProcess = [];

  for (let day = 0; day < daysToSimulate; day++) {
    const simulatedDate = new Date();
    simulatedDate.setSeconds(simulatedDate.getSeconds() + day * timeMultiplier);

    for (let bill of bills) {
      if (shouldProcessTransaction(bill.interval, day)) {
        transactionsToProcess.push({
          amount: bill.amount,
          Name: bill.Name,
          Category: bill.Category,
          Date: simulatedDate,
        });
      }
    }
  }

  for (let transaction of transactionsToProcess) {
    await client
      .db("TrinityCapital")
      .collection("Time Travel Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": userName },
        { $push: { "checkingAccount.transactions": transaction } }
      );

    console.log(`Processed bill: ${transaction.Name} for ${userName}`);
  }

  await balanceCalcTimeTravel(userName);
}

async function paymentManagerTimeTravel(userName, daysToSimulate) {
  const userProfile = await client
    .db("TrinityCapital")
    .collection("Time Travel Profiles")
    .findOne({ "checkingAccount.accountHolder": userName });

  if (!userProfile) {
    throw new Error(`Time travel profile for ${userName} not found`);
  }

  let payments = userProfile.checkingAccount.payments;
  const transactionsToProcess = [];

  for (let day = 0; day < daysToSimulate; day++) {
    const simulatedDate = new Date();
    simulatedDate.setSeconds(simulatedDate.getSeconds() + day * timeMultiplier);

    for (let payment of payments) {
      if (shouldProcessTransaction(payment.interval, day)) {
        transactionsToProcess.push({
          amount: payment.amount,
          Name: payment.Name,
          Category: payment.Category,
          Date: simulatedDate,
        });
      }
    }
  }

  for (let transaction of transactionsToProcess) {
    await client
      .db("TrinityCapital")
      .collection("Time Travel Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": userName },
        { $push: { "checkingAccount.transactions": transaction } }
      );

    console.log(`Processed payment: ${transaction.Name} for ${userName}`);
  }

  await balanceCalcTimeTravel(userName);
}

/************************************ Helper Function ****************************************/

function shouldProcessTransaction(interval, day) {
  if (interval === "weekly" && day % 7 === 0) return true;
  if (interval === "bi-weekly" && day % 14 === 0) return true;
  if (interval === "monthly" && day % 30 === 0) return true;
  if (interval === "yearly" && day % 365 === 0) return true;
  return false;
}

async function balanceCalcTimeTravel(userName) {
  try {
    let balanceArray = [];
    let balance;
    // Use the Time Travel Profiles collection
    let profile = await client
      .db("TrinityCapital")
      .collection("Time Travel Profiles")
      .findOne({ "checkingAccount.accountHolder": userName });

    if (
      !profile ||
      !profile.checkingAccount ||
      !profile.checkingAccount.transactions
    ) {
      console.error(
        `No transactions found for time travel profile: ${userName}`
      );
      return;
    }

    if (profile.checkingAccount.transactions.length === 0) {
      balance = 0;
    } else {
      for (let i = 0; i < profile.checkingAccount.transactions.length; i++) {
        let transAmounts = profile.checkingAccount.transactions[i].amount;
        balanceArray.push(transAmounts);
      }
      balance = balanceArray.reduce((acc, mov) => acc + mov, 0);
    }

    await client
      .db("TrinityCapital")
      .collection("Time Travel Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": userName },
        { $set: { "checkingAccount.balanceTotal": balance } }
      );

    const updatedProfile = await client
      .db("TrinityCapital")
      .collection("Time Travel Profiles")
      .findOne({ "checkingAccount.accountHolder": userName });
    const userSocket = userSockets.get(userName);
    if (userSocket && updatedProfile) {
      userSocket.emit("checkingAccountUpdate", updatedProfile.checkingAccount);
    }
  } catch (error) {
    console.error(`Error in balanceCalcTimeTravel for ${userName}:`, error);
  }
}
/********************************************************DEPOSITS***********************************************/

app.post("/deposits", async (req, res) => {
  let newDate = new Date().toISOString();
  const { parcel } = req.body;

  const amount = parcel[0];
  const destination = parcel[1];
  const memberName = parcel[2];

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": memberName },
      {
        $push: {
          "checkingAccount.transactions": {
            amount: -amount,
            interval: "once",
            Name: `${destination}`,
            Category: "Check Deposit",
          },
        },
      }
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": memberName },
      { $push: { "checkingAccount.movementsDates": newDate } }
    );

  const updatedUserProfile = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .findOne({ "checkingAccount.accountHolder": memberName });

  const updatedChecking = updatedUserProfile.checkingAccount;

  console.log(process.pid, 265);
  balanceCalc(memberName, updatedChecking, updatedChecking.accountType);

  // Send update only to specific user
  const userSocket = userSockets.get(memberName);
  if (userSocket) {
    userSocket.emit("checkingAccountUpdate", updatedChecking);
  }
});

app.post("/sendFunds", async (req, res) => {
  const { parcel } = req.body;

  const destinationProfile = parcel[0];
  const sender = parcel[1];
  const destinationAmount = parcel[2];

  console.log(destinationProfile, 470);

  let destinationDate = new Date();

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": destinationProfile },
      {
        $push: {
          "checkingAccount.transactions": {
            amount: destinationAmount,
            interval: "once",
            Name: `Deposit from ${sender}`,
            Category: "Money Deposit",
          },
        },
      }
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": destinationProfile },
      { $push: { "checkingAccount.movementsDates": destinationDate } }
    );

  //FOR SENDER
  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": sender },
      {
        $push: {
          "checkingAccount.transactions": {
            amount: -destinationAmount,
            interval: "once",
            Name: `Deposit to ${destinationProfile}`,
            Category: "Money Deposit",
          },
        },
      }
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": sender },
      { $push: { "checkingAccount.movementsDates": destinationDate } }
    );

  const updatedUserProfile = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .findOne({ "checkingAccount.accountHolder": sender });

  const updatedChecking = updatedUserProfile.checkingAccount;

  balanceCalc(sender, updatedChecking, updatedChecking.accountType);

  // Send update only to specific user
  const userSocket = userSockets.get(sender);
  if (userSocket) {
    userSocket.emit("checkingAccountUpdate", updatedChecking);
  }
});

app.post("/timeTravelProfiles", async (req, res) => {
  const db = client.db("TrinityCapital");
  const profilesCollection = db.collection("User Profiles");
  const timeTravelCollection = db.collection("Time Travel Profiles");

  const { userName } = req.body; // Get username from request

  try {
    // Get the user's socket ID
    const userSocket = userSockets.get(userName);

    if (!userSocket) {
      console.error(`No active socket connection found for user: ${userName}`);
    }

    // Check if a time travel profile already exists
    let existingProfile = await timeTravelCollection.findOne({ userName });

    if (existingProfile) {
      console.log(`Time Travel profile found for ${userName}`);
      const updatedChecking = existingProfile.checkingAccount;

      // Emit only to the user's socket
      if (userSocket) {
        userSocket.emit("checkingAccountUpdate", updatedChecking);
      }

      return res.status(200).json(existingProfile);
    }

    // If no time travel profile exists, get the regular user profile
    let regularProfile = await profilesCollection.findOne({ userName });

    if (!regularProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    // Create a new Time Travel Profile with empty transactions
    let newTimeTravelProfile = {
      memberName: regularProfile.memberName,
      pin: regularProfile.pin,
      numberOfAccounts: 2,
      accountLevel: regularProfile.accountLevel, // Keep existing account level
      checkingAccount: {
        routingNumber: 141257185,
        currency: "USD",
        locale: "en-US",
        created: new Date().toISOString(),
        accountHolder: regularProfile.memberName,
        balanceTotal: 0,
        bills: [],
        payments: [],
        accountType: "Checking",
        accountNumber: regularProfile.checkingAccount.accountNumber,
        movementsDates: [],
        transactions: [],
      },
      savingsAccount: {
        routingNumber: 141257185,
        currency: "USD",
        locale: "en-US",
        created: new Date().toISOString(),
        accountHolder: regularProfile.memberName,
        username: regularProfile.userName,
        balanceTotal: 0,
        bills: [],
        payments: [],
        accountType: "Savings",
        accountNumber: regularProfile.savingsAccount.accountNumber,
        movementsDates: [],
        transactions: [],
      },
      userName: regularProfile.userName,
    };

    // Insert new Time Travel Profile into the collection
    await timeTravelCollection.insertOne(newTimeTravelProfile);
    console.log(`Created new Time Travel profile for ${userName}`);

    const updatedChecking = newTimeTravelProfile.checkingAccount;

    // Emit only to the user's socket
    if (userSocket) {
      userSocket.emit("checkingAccountUpdate", updatedChecking);
    }

    return res.status(201).json(newTimeTravelProfile);
  } catch (error) {
    console.error("Error creating time travel profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**************************************************LESSON SERVER FUNCTIONS*********************************************/

app.post("/lessonArrays", async (req, res) => {
  try {
    // In a real application, you would fetch this from a 'Lessons' collection in your database.
    // For now, we'll use a mock array that matches the structure in index.html.
    const lessons = [
      { name: "Tutorial", icon: "fa-rocket rocketIcon", id: "lesson1Div" },
      { name: "Transfers", icon: "fa-money-bill-transfer", id: "lesson2Div" },
      {
        name: "Bills & Paychecks",
        icon: "fa-file-invoice-dollar bpImg",
        id: "lesson3Div",
      },
      {
        name: "Deposts",
        icon: "fa-money-check depositImg",
        id: "lesson4Div",
      },
      { name: "Sending Money", icon: "fa-dollar-sign smImg", id: "lesson5Div" },
      {
        name: "Credit",
        icon: "fa-regular fa-credit-card creditImg",
        id: "lesson6Div",
      },
    ];

    const htmlCode = lessons
      .map(
        (lesson) => `
      <div class="col-1 lessonDiv ${lesson.id}">
        <p class="lessonImg"><i class="fa-solid ${lesson.icon}"></i></p>
        <h5 class="lessonName">${lesson.name}</h5>
      </div>`
      )
      .join("");

    io.emit("lessonHtml", htmlCode);
    res.status(200).json({ message: "Lesson HTML emitted successfully." });
  } catch (error) {
    console.error("Error in /lessonArrays:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- SMTP CONFIG ENCRYPTION UTILS ---
const SMTP_SECRET = process.env.SMTP_SECRET || "changeme!";
function getKey() {
  // Always return a Buffer of exactly 32 bytes
  return Buffer.alloc(32, SMTP_SECRET, "utf8");
}
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}
function decrypt(text) {
  const [ivHex, encrypted] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// --- SAVE SMTP CONFIG ---
app.post("/saveSmtpConfig", async (req, res) => {
  const { teacherUsername, config } = req.body;
  if (!teacherUsername || !config)
    return res.status(400).json({ error: "Missing teacherUsername or config" });
  try {
    const toSave = { ...config };
    if (toSave.smtpPassword) toSave.smtpPassword = encrypt(toSave.smtpPassword);
    await client
      .db("TrinityCapital")
      .collection("SmtpConfigs")
      .updateOne({ teacherUsername }, { $set: toSave }, { upsert: true });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to save SMTP config:", err);
    res.status(500).json({
      error: "Failed to save SMTP config",
      details: err.message,
      stack: err.stack,
    });
  }
});

// --- GET SMTP CONFIG (no password) ---
app.get("/getSmtpConfig/:teacherUsername", async (req, res) => {
  const { teacherUsername } = req.params;
  if (!teacherUsername)
    return res.status(400).json({ error: "Missing teacherUsername" });
  try {
    const doc = await client
      .db("TrinityCapital")
      .collection("SmtpConfigs")
      .findOne({ teacherUsername });
    if (!doc) return res.status(200).json({});
    const { smtpPassword, ...rest } = doc;
    res.status(200).json(rest);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch SMTP config" });
  }
});

/****************************************TEACHER DASHBOARD********************************************/

app.post("/findTeacher", async (req, res) => {
  const { parcel } = req.body;
  const teachUser = parcel[0];
  const teachPin = parcel[1];

  console.log("teachUser:", teachUser);
  console.log("teachPin:", teachPin);

  try {
    let teacher = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teachUser, pin: teachPin });

    if (teacher !== null) {
      console.log(`Teacher found: ${teacher.name}`);

      // Send the teacher's name and their messages back to the frontend
      res.status(200).json({
        found: true,
        teacherName: teacher.name, // Only send the teacher's name
      });
    } else {
      console.log(
        `Teacher not found for username: ${teachUser}, pin: ${teachPin}`
      );
      res.status(404).json({ found: false });
    }
  } catch (error) {
    console.error("Error in /findTeacher:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/getStudents", async (req, res) => {
  const { parcel } = req.body;

  const periodNum = parcel[0];
  const teacherName = parcel[1];

  console.log("Period Number:", periodNum);
  console.log("Teacher Name:", teacherName);

  let students = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .find({ classPeriod: periodNum, teacher: teacherName })
    .toArray();

  io.emit("students", students);
});

/**
 * =================================================================
 * UNIFIED MESSAGE HISTORY ENDPOINT
 * =================================================================
 * Fetches all messages for a given user (student or teacher) and groups them into threads.
 */
app.get("/messages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    let query = {
      participants: userId, // Find threads where userId is a participant
    };

    // If the userId is a teacher, also include their specific class message thread
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ name: userId });
    if (teacherDoc) {
      query = {
        $or: [
          { participants: userId }, // Private threads involving the teacher
          { threadId: `class-message-${userId}` }, // The teacher's class message thread
        ],
      };
    }

    const threads = await client
      .db("TrinityCapital")
      .collection("threads")
      .find(query)
      .sort({ lastMessageTimestamp: -1 }) // Sort by most recent activity
      .toArray();

    res.status(200).json({ threads }); // Return threads, not messages
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

app.post("/studentInfo", async (req, res) => {
  const { parcel } = req.body;
  const studentName = parcel[0];
  const teacherName = parcel[1];

  console.log(studentName, teacherName);

  try {
    let student = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ memberName: studentName, teacher: teacherName });

    if (student) {
      res.json(student);
    } else {
      res.status(404).send("Student not found");
    }

    console.log(student);
  } catch (error) {
    console.error("Error fetching student info:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/classMessage", async (req, res) => {
  const { teacherName, message } = req.body;
  if (!teacherName || !message) {
    return res.status(400).json({ error: "Missing teacherName or message" });
  }

  // Find all students with this teacher
  const students = await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .find({ teacher: teacherName })
    .toArray();

  // Prepare HTML dialog
  const dialogHtml = `<dialog open class="baseModal"><h1>Message from ${teacherName}</h1><p>${message}</p><button onclick="this.parentElement.close()">Close</button></dialog>`;

  // Broadcast to all connected students
  students.forEach((student) => {
    const userSocket = userSockets.get(student.memberName);
    if (userSocket) {
      userSocket.emit("classMessage", dialogHtml);
    }
  });

  res.status(200).json({ success: true });
});

app.post("/generateClassCodes", async (req, res) => {
  try {
    const [teacherUsername, teacherEmail, periods] = req.body.parcel || [];
    if (
      !teacherUsername ||
      !teacherEmail ||
      !Array.isArray(periods) ||
      periods.length === 0
    ) {
      return res.status(400).json({
        error: `Missing teacherUsername, teacherEmail, or periods. Received: teacherUsername=${teacherUsername}, teacherEmail=${teacherEmail}, periods=${JSON.stringify(
          periods
        )}`,
      });
    }

    console.log("Searching for teacherUsername:", teacherUsername);
    // 1. Get teacher's state, school, and license number from Teachers collection
    const teacher = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teacherUsername });
    console.log("Teacher lookup result:", teacher);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // Get the access code from Access Codes collection using teacherEmail
    const accessCodeDoc = await client
      .db("TrinityCapital")
      .collection("Access Codes")
      .findOne({ sent_to: teacherEmail });
    console.log("Access code lookup result:", accessCodeDoc);

    let licenseNumber = "00000000";
    if (accessCodeDoc && accessCodeDoc.code) {
      // Use a shortened version (first 8 chars, uppercase) for display
      licenseNumber = accessCodeDoc.code.substring(0, 8).toUpperCase();
    }

    // Generate school shorthand from school name
    function getSchoolShortHand(schoolName) {
      return schoolName
        .split(" ")
        .map((word) => word[0].toUpperCase())
        .join("");
    }
    const state = teacher.state || "US";
    const schoolShortHand = getSchoolShortHand(teacher.school || "HSSCHOOL");

    // 2. Assign class periods to teacher profile
    await client
      .db("TrinityCapital")
      .collection("Teachers")
      .updateOne(
        { Username: teacherUsername },
        { $set: { classPeriods: periods } }
      );

    // 3. Generate codes for each period
    const codes = periods.map((period) => {
      return `${state}-${schoolShortHand}-${licenseNumber}-${period}`;
    });

    // Save each class code in the Access Codes collection with type 'student'
    const accessCodesCollection = client
      .db("TrinityCapital")
      .collection("Access Codes");
    for (let i = 0; i < codes.length; i++) {
      await accessCodesCollection.insertOne({
        code: codes[i],
        teacherUsername,
        teacherEmail,
        period: periods[i],
        type: "student",
        createdAt: new Date(),
      });
    }

    // If you want to send class codes via email, use the sendEmailWithOAuth2 helper and teacher's OAuth2 credentials instead.

    res.status(200).json({ codes, emailSent: true });
  } catch (err) {
    console.error("Error in /generateClassCodes:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

app.post("/teacherDashboard", async (req, res) => {
  try {
    const { teacherUsername } = req.body;
    console.log("Received /teacherDashboard request for:", teacherUsername);
    if (!teacherUsername) {
      console.log("Missing teacherUsername in request body");
      return res.status(400).json({ error: "Missing teacherUsername" });
    }

    // Find the teacher by username to get their actual name
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teacherUsername });
    if (!teacherDoc) {
      console.log("No teacher found for username:", teacherUsername);
      return res.status(404).json({ error: "Teacher not found" });
    }
    const teacherName = teacherDoc.name;
    console.log("Resolved teacher name:", teacherName);

    // Find all students assigned to this teacher by name
    const students = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({ teacher: teacherName })
      .toArray();

    // Prepare student data for dashboard
    const studentData = students.map((student) => ({
      memberName: student.memberName,
      checkingBalance: student.checkingAccount?.balanceTotal ?? 0,
      savingsBalance: student.savingsAccount?.balanceTotal ?? 0,
      grade: student.grade ?? 0,
      lessonsCompleted: student.lessonsCompleted ?? 0,
      classPeriod: student.classPeriod ?? "",
    }));

    console.log("Sending student data to frontend:", studentData);
    res.status(200).json({ students: studentData });
  } catch (error) {
    console.error("Error in /teacherDashboard:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// --- EMAIL SENDING ENDPOINT (Gmail API, not SMTP) ---
app.post("/sendEmail", async (req, res) => {
  try {
    const { sender, recipients, subject, message } = req.body;
    // Look up teacher's OAuth2 credentials
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: sender });
    console.log("SEND EMAIL DEBUG:");
    console.log("  sender (username):", sender);
    if (teacherDoc) {
      console.log("  teacherDoc.username:", teacherDoc.username);
      console.log("  teacherDoc.oauth:", teacherDoc.oauth);
    } else {
      console.log("  teacherDoc not found for username:", sender);
    }
    if (
      !teacherDoc ||
      !teacherDoc.oauth ||
      !teacherDoc.oauth.email ||
      !teacherDoc.oauth.refresh_token
    ) {
      return res
        .status(400)
        .json({ error: "No OAuth2 credentials found for teacher" });
    }
    const teacherEmail = teacherDoc.oauth.email;
    const refreshToken = teacherDoc.oauth.refresh_token;
    let finalSubject = subject;
    if (teacherDoc.name) {
      finalSubject = `${subject} (from ${teacherDoc.name})`;
    }
    try {
      await sendEmailViaGmailApi(
        teacherEmail,
        refreshToken,
        recipients,
        finalSubject,
        message
      );
      res.status(200).json({ success: true });
    } catch (error) {
      const errMsg = error && error.message ? error.message : "";
      if (
        errMsg.includes("invalid_grant") ||
        errMsg.includes("Invalid Credentials")
      ) {
        return res.status(401).json({ error: "oauth_reauth_required" });
      }
      res.status(500).json({
        success: false,
        error: "Failed to send email",
        details: errMsg,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: err.message,
    });
  }
});

// --- Send email using Gmail API (not SMTP) ---
async function sendEmailViaGmailApi(
  teacherEmail,
  refreshToken,
  to,
  subject,
  body
) {
  const { google } = require("googleapis");
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH2_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  // Build RFC822 message
  const messageParts = [
    `From: "Teacher" <${teacherEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const rawMessage = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });
  } catch (error) {
    console.error("Gmail API send error:", error);
    throw new Error(
      error?.response?.data?.error?.message ||
        error.message ||
        "Failed to send email via Gmail API"
    );
  }
}

// --- EMAIL SETTINGS FETCH ENDPOINT ---
app.get("/emailSettings/:teacherUsername", async (req, res) => {
  const { teacherUsername } = req.params;
  try {
    const doc = await client
      .db("TrinityCapital")
      .collection("EmailSettings")
      .findOne({ teacherUsername });
    if (doc) {
      res.status(200).json(doc);
    } else {
      // Create empty settings if not found
      const emptyDoc = {
        teacherUsername,
        addresses: [],
        templates: [],
        groups: [],
      };
      await client
        .db("TrinityCapital")
        .collection("EmailSettings")
        .insertOne(emptyDoc);
      res.status(200).json(emptyDoc);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch email settings" });
  }
});

// --- EMAIL MODAL FEATURE ENDPOINTS ---
app.post("/saveEmailAddress", async (req, res) => {
  const { sender, address } = req.body;
  try {
    await client
      .db("TrinityCapital")
      .collection("EmailSettings")
      .updateOne(
        { teacherUsername: sender },
        { $addToSet: { addresses: address } },
        { upsert: true }
      );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save address" });
  }
});

app.post("/saveEmailTemplate", async (req, res) => {
  const { sender, subject, message } = req.body;
  try {
    await client
      .db("TrinityCapital")
      .collection("EmailSettings")
      .updateOne(
        { teacherUsername: sender },
        { $addToSet: { templates: { subject, message } } },
        { upsert: true }
      );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save template" });
  }
});

app.post("/saveEmailGroup", async (req, res) => {
  const { sender, name, addresses } = req.body;
  try {
    await client
      .db("TrinityCapital")
      .collection("EmailSettings")
      .updateOne(
        { teacherUsername: sender },
        { $addToSet: { groups: { name, addresses } } },
        { upsert: true }
      );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save group" });
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
