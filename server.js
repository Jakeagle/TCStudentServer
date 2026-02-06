require("dotenv").config();
// Restart trigger

const express = require("express");
const app = express();
const cron = require("node-cron");
const { fork } = require("child_process");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const SchedulerManager = require("./schedulerManager");

// Import GitHub webhook handler if available (optional in production)
let setupGitHubWebhook;
try {
  setupGitHubWebhook = require("./githubWebhookHandler").setupGitHubWebhook;
} catch (err) {
  console.warn(
    "⚠️ GitHub webhook handler not available. Update notifications disabled.",
  );
  setupGitHubWebhook = () => {}; // No-op function
}

// Add fetch for Node.js versions that don't have it built-in
let fetch;
try {
  // Try to use built-in fetch (Node.js 18+)
  fetch = globalThis.fetch;
} catch (error) {
  // Fallback to node-fetch for older Node.js versions
  try {
    fetch = require("node-fetch");
  } catch (fetchError) {
    console.warn(
      "Fetch not available. Install node-fetch: npm install node-fetch",
    );
  }
}

const cors = require("cors");
const bodyParser = require("body-parser");
const SampleDataManager = require("./sampleDataManager");
const QuickTimeManager = require("./quickTimeManager");
let Profiles;
let sampleDataManager; // Will be initialized after MongoDB connection
let quickTimeManager; // Will be initialized after MongoDB connection

const port = process.env.PORT || 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");
const mongoUri = process.env.MONGODB_URI;

// All Stripe-related code (checkouts, webhooks, and references) removed as requested.

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

// Initialize scheduler manager
let schedulerManager;

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user identification
  socket.on("identify", (userId) => {
    try {
      console.log(`🆔 User identified: ${userId} (Socket ID: ${socket.id})`);
      userSockets.set(userId, socket);
      console.log(`📊 Total identified users: ${userSockets.size}`);

      // Initialize quick time mode for sample students on login
      if (quickTimeManager && quickTimeManager.isSampleUser(userId)) {
        console.log(
          `⏱️  [Socket.Identify] Sample student detected: ${userId} - Initializing Quick Time mode`,
        );
        quickTimeManager.initializeQuickTimeMode(userId);
      }

      // Acknowledge successful identification
      socket.emit("identified", { success: true });
    } catch (error) {
      console.error("❌ Error during user identification:", error);
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
    const { senderId, recipientId, messageContent, optimisticId } = data;

    console.log("Received sendMessage event:", data);

    if (!senderId || !recipientId || !messageContent) {
      console.error("Invalid message data received:", data);
      if (callback) callback({ success: false, error: "Invalid data" });
      return;
    }

    // Profanity check
    console.log(`[Profanity Check] Starting for message: "${messageContent}"`);
    try {
      const response = await fetch(
        `https://www.purgomalum.com/service/json?text=${encodeURIComponent(messageContent)}`,
      );
      if (response.ok) {
        const filterData = await response.json();
        console.log("[Profanity Check] API Response:", filterData);
        if (filterData.result !== messageContent) {
          console.log(
            "[Profanity Check] Profanity detected. Blocking message.",
          );
          const userSocket = userSockets.get(senderId);
          if (userSocket) {
            userSocket.emit("profanity-detected", {
              message: "Profanity is not allowed.",
              optimisticId: optimisticId,
            });
          }
          if (callback)
            callback({ success: false, error: "Profanity is not allowed." });
          return;
        }
        console.log("[Profanity Check] Message is clean.");
      } else {
        console.error(
          "[Profanity Check] PurgoMalum service returned an error:",
          response.status,
        );
        const userSocket = userSockets.get(senderId);
        if (userSocket) {
          userSocket.emit("profanity-detected", {
            message: "Could not validate message. Please try again.",
            optimisticId: optimisticId,
          });
        }
        if (callback)
          callback({ success: false, error: "Could not validate message." });
        return;
      }
    } catch (error) {
      console.error(
        "[Profanity Check] Error calling PurgoMalum service:",
        error,
      );
      const userSocket = userSockets.get(senderId);
      if (userSocket) {
        userSocket.emit("profanity-detected", {
          message: "Could not send message. Please try again later.",
          optimisticId: optimisticId,
        });
      }
      if (callback)
        callback({ success: false, error: "Could not send message." });
      return;
    }

    const timestamp = new Date();
    // Check if it's a class-wide message
    const isClassMessage = recipientId.startsWith("class-message-");
    let threadId;
    let participants = [];

    console.log(
      `[SendMessage] Processing ${isClassMessage ? "CLASS" : "PRIVATE"} message.`,
    );
    console.log(`[SendMessage] Sender: ${senderId}, Recipient: ${recipientId}`);

    try {
      let thread;
      if (isClassMessage) {
        threadId = recipientId; // e.g., 'class-message-Ms.Thompson'
        participants = [senderId, "class-message-recipient"]; // A generic recipient for class messages
        console.log(`[SendMessage] CLASS message. ThreadID: ${threadId}`);

        // Find the class message thread for this teacher
        thread = await client
          .db("TrinityCapital")
          .collection("threads")
          .findOne({ threadId: threadId });
        if (!thread) {
          console.log(
            `[SendMessage] No existing class thread found. Creating new one.`,
          );
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
          console.log(`[SendMessage] New class thread created: ${threadId}`);
        } else {
          console.log(`[SendMessage] Found existing class thread: ${threadId}`);
        }
      } else {
        // Private message
        // Ensure consistent threadId for private chats (sorted participants)
        const sortedParticipants = [senderId, recipientId].sort();
        threadId = sortedParticipants.join("_"); // e.g., 'Emily Johnson_Ms.Thompson'
        participants = sortedParticipants;
        console.log(`[SendMessage] PRIVATE message. ThreadID: ${threadId}`);

        // Find existing private thread
        thread = await client
          .db("TrinityCapital")
          .collection("threads")
          .findOne({
            threadId: threadId,
            type: "private",
          });

        if (!thread) {
          console.log(
            `[SendMessage] No existing private thread found. Creating new one.`,
          );
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
          console.log(`[SendMessage] New private thread created: ${threadId}`);
        } else {
          console.log(
            `[SendMessage] Found existing private thread: ${threadId}`,
          );
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
          },
        );
      console.log(
        `[SendMessage] Message document added to thread ${threadId} in DB.`,
      );

      // --- Broadcasting to relevant users ---
      // For class messages, broadcast to all students of the teacher AND the teacher
      if (isClassMessage) {
        const teacherName = senderId; // senderId is the teacher's full name
        console.log(
          `[SendMessage] Broadcasting class message from teacher: ${teacherName}`,
        );
        const teacherDoc = await client
          .db("TrinityCapital")
          .collection("Teachers")
          .findOne({ name: teacherName });
        if (!teacherDoc) {
          console.error(
            `[SendMessage] CRITICAL: Teacher document not found for name: ${teacherName}`,
          );
          throw new Error("Teacher not found");
        }

        const students = await client
          .db("TrinityCapital")
          .collection("User Profiles")
          .find({ teacher: teacherDoc.name })
          .project({ memberName: 1 })
          .toArray();
        console.log(
          `[SendMessage] Found ${students.length} students for teacher ${teacherName}.`,
        );

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
            console.log(
              `[SendMessage] --> Emitted 'newMessage' to student: ${student.memberName}`,
            );
          } else {
            console.log(
              `[SendMessage] --X No active socket for student: ${student.memberName}`,
            );
          }
        }
        // Send to the teacher (sender) for echo
        const teacherSocket = userSockets.get(teacherName);
        if (teacherSocket) {
          teacherSocket.emit("newMessage", messageDoc); // Send the original messageDoc
          console.log(
            `[SendMessage] --> Echoed 'newMessage' to sender (teacher): ${teacherName}`,
          );
        } else {
          console.log(
            `[SendMessage] --X No active socket for sender (teacher): ${teacherName}`,
          );
        }
      } else {
        // Private message: send to recipient and sender
        console.log(
          `[SendMessage] Distributing private message between ${senderId} and ${recipientId}.`,
        );
        const recipientSocket = userSockets.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit("newMessage", messageDoc);
          console.log(
            `[SendMessage] --> Emitted 'newMessage' to recipient: ${recipientId}`,
          );
        } else {
          console.log(
            `[SendMessage] --X No active socket for recipient: ${recipientId}`,
          );
        }
        const senderSocket = userSockets.get(senderId);
        if (senderSocket) {
          senderSocket.emit("newMessage", messageDoc);
          console.log(
            `[SendMessage] --> Echoed 'newMessage' to sender: ${senderId}`,
          );
        } else {
          console.log(
            `[SendMessage] --X No active socket for sender: ${senderId}`,
          );
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
          console.log(
            `👋 User disconnected: ${userId} (Socket ID: ${socket.id})`,
          );

          // Disable quick time mode if user was in it
          if (quickTimeManager && quickTimeManager.isSampleUser(userId)) {
            console.log(
              `⏱️  [Disconnect] Disabling Quick Time mode for: ${userId}`,
            );
            quickTimeManager.disableQuickTimeMode(userId);
          }

          userSockets.delete(userId);
          console.log(`📊 Total identified users now: ${userSockets.size}`);
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
    "Connected to external server at localhost:5000 for studentCreated events",
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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    // Initialize sample data manager after MongoDB connection
    sampleDataManager = new SampleDataManager(client);
    console.log("✅ Sample Data Manager initialized");

    // Initialize scheduler manager FIRST (before quick time manager needs it)
    schedulerManager = new SchedulerManager(client, io, userSockets);
    await schedulerManager.initializeScheduler();

    // Initialize quick time manager for sample accounts (now that schedulerManager exists)
    quickTimeManager = new QuickTimeManager(
      client,
      io,
      userSockets,
      schedulerManager,
    );
    console.log("✅ Quick Time Manager initialized");

    // Setup GitHub webhook handler
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";
    const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
    setupGitHubWebhook(app, webhookSecret, serverUrl);
  } finally {
    // // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

/*****************************************Main Page***************************************************/

// Removed express.static('public') as frontend is handled separately in Frontend folder
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Test route to verify API is working

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
      },
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "savingsAccount.accountHolder": memberName },
      {
        $set: { "savingsAccount.balanceTotal": savingsBalance },
      },
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
      userSocket.emit("profilesData", profiles);
    }

    res.json(profiles);
  } catch (error) {
    console.error("Error retrieving profiles:", error);
    res.status(500).json({ error: "Error retrieving profiles" });
  }
});

// NEW: Get profile by memberName (student name)
app.get("/profiles/:memberName", async (req, res) => {
  try {
    const { memberName } = req.params;
    console.log(`\n\n📋 PROFILE REQUEST for student: ${memberName}`);

    const collection = client.db("TrinityCapital").collection("User Profiles");
    const profile = await collection.findOne({ memberName });

    if (!profile) {
      console.log(`❌ No profile found for student: ${memberName}`);
      return res.status(404).json({
        success: false,
        message: `No profile found for student: ${memberName}`,
      });
    }

    console.log(`✅ Profile found for student: ${memberName}`);
    console.log(`👤 Student: ${profile.memberName}`);
    console.log(`🏫 School: ${profile.school || "N/A"}`);
    console.log(`👨‍🏫 Teacher: ${profile.teacher || "N/A"}`);

    // Log assigned units structure
    if (profile.assignedUnitIds && Array.isArray(profile.assignedUnitIds)) {
      console.log(`📚 Assigned Units: ${profile.assignedUnitIds.length}`);
      profile.assignedUnitIds.forEach((unit, index) => {
        console.log(
          `  Unit ${index + 1}: ${unit.unitName || unit.unitId || "Unknown"}`,
        );
        console.log(
          `    - Lesson IDs: ${Array.isArray(unit.lessonIds) ? unit.lessonIds.length : "None"}`,
        );
        if (Array.isArray(unit.lessonIds)) {
          console.log(
            `    - First few lesson IDs: ${unit.lessonIds.slice(0, 3).join(", ")}${unit.lessonIds.length > 3 ? "..." : ""}`,
          );
        }
      });
    } else {
      console.log(`❌ No assignedUnitIds found or not an array`);
      console.log(
        `   assignedUnitIds value: ${JSON.stringify(profile.assignedUnitIds)}`,
      );
    }

    res.json(profile);
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).json({
      success: false,
      error: "Error retrieving profile",
      message: error.message,
    });
  }
});

// NEW: Get profile by memberName (student name)
app.get("/profiles/:memberName", async (req, res) => {
  try {
    const { memberName } = req.params;
    console.log(`\n\n📋 PROFILE REQUEST for student: ${memberName}`);

    const collection = client.db("TrinityCapital").collection("User Profiles");
    const profile = await collection.findOne({ memberName });

    if (!profile) {
      console.log(`❌ No profile found for student: ${memberName}`);
      return res.status(404).json({
        success: false,
        message: `No profile found for student: ${memberName}`,
      });
    }

    console.log(`✅ Profile found for student: ${memberName}`);
    console.log(`👤 Student: ${profile.memberName}`);
    console.log(`🏫 School: ${profile.school || "N/A"}`);
    console.log(`👨‍🏫 Teacher: ${profile.teacher || "N/A"}`);

    // Log assigned units structure
    if (profile.assignedUnitIds && Array.isArray(profile.assignedUnitIds)) {
      console.log(`📚 Assigned Units: ${profile.assignedUnitIds.length}`);
      profile.assignedUnitIds.forEach((unit, index) => {
        console.log(
          `  Unit ${index + 1}: ${unit.unitName || unit.unitId || "Unknown"}`,
        );
        console.log(
          `    - Lesson IDs: ${Array.isArray(unit.lessonIds) ? unit.lessonIds.length : "None"}`,
        );
        if (Array.isArray(unit.lessonIds)) {
          console.log(
            `    - First few lesson IDs: ${unit.lessonIds.slice(0, 3).join(", ")}${unit.lessonIds.length > 3 ? "..." : ""}`,
          );
        }
      });
    } else {
      console.log(`❌ No assignedUnitIds found or not an array`);
      console.log(
        `   assignedUnitIds value: ${JSON.stringify(profile.assignedUnitIds)}`,
      );
    }

    res.json(profile);
  } catch (error) {
    console.error("Error retrieving profile:", error);
    res.status(500).json({
      success: false,
      error: "Error retrieving profile",
      message: error.message,
    });
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
      0,
    );
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": name },
        {
          $push: { "checkingAccount.transactions": amount },
          $set: { "checkingAccount.balanceTotal": balance },
        },
      );
    let newDate = new Date().toISOString();
    await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(
        { "checkingAccount.accountHolder": name },
        { $push: { "checkingAccount.movementsDates": newDate } },
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

  try {
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
          },
        );

      let newDate = new Date().toISOString();
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "checkingAccount.accountHolder": memberNamePg },
          { $push: { "checkingAccount.movementsDates": newDate } },
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
          },
        );

      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "savingsAccount.accountHolder": memberNamePg },
          { $push: { "savingsAccount.movementsDates": newDate } },
        );

      const updatedUserProfile = await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": memberNamePg });

      const updatedChecking = updatedUserProfile.checkingAccount;

      // Send update only to specific user
      const userSocket = userSockets.get(memberNamePg);
      if (userSocket) {
        userSocket.emit("checkingAccountUpdate", updatedChecking);
      }

      res.status(200).json({ message: "Transaction successful" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const balanceCalc = async function (memberName, acc, type) {
  console.log(
    `Starting balanceCalc for member: ${memberName}, account type: ${type}`,
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
      error,
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
          { $set: { "checkingAccount.balanceTotal": balance } },
        );
    } else if (type === "Savings") {
      console.log(`Updating Savings account balance for ${memberName}`);
      await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .updateOne(
          { "savingsAccount.accountHolder": memberName },
          { $set: { "savingsAccount.balanceTotal": balance } },
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
      updatedUserProfile,
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
        `Emitting 'checkingAccountUpdate' event to socket for ${memberName}`,
      );
      userSocket.emit("checkingAccountUpdate", updatedChecking);
    } else {
      console.warn(`No socket found for ${memberName}`);
    }
  } catch (error) {
    console.error(`Error emitting socket event for ${memberName}:`, error);
  }

  // Notify teachers about student financial data changes for class health updates
  try {
    // Find the student's teacher from the updated profile
    const studentTeacher = updatedUserProfile.teacher;
    if (studentTeacher) {
      console.log(
        `Notifying teacher ${studentTeacher} about financial update for student ${memberName}`,
      );

      // Emit to all connected sockets (teachers will filter by their name)
      io.emit("studentFinancialUpdate", {
        studentName: memberName,
        teacherName: studentTeacher,
        updatedData: {
          checkingBalance:
            updatedUserProfile.checkingAccount?.balanceTotal ?? 0,
          savingsBalance: updatedUserProfile.savingsAccount?.balanceTotal ?? 0,
          memberName: memberName,
        },
      });
    }
  } catch (error) {
    console.error(
      `Error notifying teachers about student financial update:`,
      error,
    );
  }
};

app.post("/bills", async (req, res) => {
  try {
    const { parcel } = req.body;

    const profile = parcel[0];
    const type = parcel[1];
    const amount = parcel[2];
    const interval = parcel[3];
    const billName = parcel[4];
    const cat = parcel[5];
    const date = parcel[6];

    console.log("Processing bill/payment:", {
      type,
      amount,
      interval,
      billName,
      cat,
      date,
    });
    const prfName = profile.memberName;

    const newTrans = {
      amount: amount,
      interval: interval,
      Name: billName,
      Category: cat,
      Date: date,
    };

    // Use the new scheduler manager
    if (schedulerManager) {
      await schedulerManager.addScheduledTransaction(prfName, newTrans, type);

      // AFTER the transaction is added, reschedule for quick time if needed
      if (quickTimeManager && quickTimeManager.isSampleUser(prfName)) {
        console.log(
          `⏱️  [Bills] Sample user detected: ${prfName} - Rescheduling transactions for Quick Time`,
        );
        await quickTimeManager.processPendingTransactions(prfName);
      }

      // Get updated profile for response
      const updatedUserProfile = await client
        .db("TrinityCapital")
        .collection("User Profiles")
        .findOne({ "checkingAccount.accountHolder": prfName });

      const updatedChecking = updatedUserProfile.checkingAccount;

      // Send update to user
      const userSocket = userSockets.get(prfName);
      if (userSocket) {
        userSocket.emit("checkingAccountUpdate", updatedChecking);
      }

      res.status(200).json({
        success: true,
        message: `${type} scheduled successfully`,
        schedulerStatus: schedulerManager.getSchedulerStatus(),
        quickTimeMode: quickTimeManager?.isSampleUser(prfName) || false,
      });
    } else {
      res.status(500).json({ error: "Scheduler not initialized" });
    }
  } catch (error) {
    console.error("Error in /bills endpoint:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Process existing bills and payments immediately (for testing/setup)
app.post("/processExistingBillsPayments", async (req, res) => {
  try {
    const { memberName } = req.body;

    if (!memberName) {
      return res.status(400).json({ error: "Missing memberName" });
    }

    console.log(`Processing existing bills and payments for ${memberName}`);

    // Get the user profile
    const userProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": memberName });

    if (!userProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const bills = userProfile.checkingAccount.bills || [];
    const payments = userProfile.checkingAccount.payments || [];

    console.log(
      `Found ${bills.length} bills and ${payments.length} payments for ${memberName}`,
    );

    // Process bills immediately
    for (let bill of bills) {
      if (schedulerManager) {
        await schedulerManager.processTransaction(memberName, bill, "bill");
      }
    }

    // Process payments immediately
    for (let payment of payments) {
      if (schedulerManager) {
        await schedulerManager.processTransaction(
          memberName,
          payment,
          "payment",
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${bills.length} bills and ${payments.length} payments for ${memberName}`,
      billsProcessed: bills.length,
      paymentsProcessed: payments.length,
    });
  } catch (error) {
    console.error("Error processing existing bills/payments:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Get scheduler status
app.get("/scheduler/status", (req, res) => {
  try {
    if (schedulerManager) {
      res.json(schedulerManager.getSchedulerStatus());
    } else {
      res.status(500).json({ error: "Scheduler not initialized" });
    }
  } catch (error) {
    console.error("Error getting scheduler status:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Get quick time mode status
app.get("/quicktime/status/:username", (req, res) => {
  try {
    const { username } = req.params;

    if (!quickTimeManager) {
      return res
        .status(500)
        .json({ error: "Quick Time Manager not initialized" });
    }

    const status = quickTimeManager.getQuickTimeStatus(username);
    res.json(status);
  } catch (error) {
    console.error("Error getting quick time status:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Remove a scheduled bill or payment
app.post("/scheduler/remove", async (req, res) => {
  try {
    const { memberName, transactionId, type } = req.body;

    if (!memberName || !transactionId || !type) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (schedulerManager) {
      await schedulerManager.removeScheduledTransaction(
        memberName,
        transactionId,
        type,
      );
      res.json({ success: true, message: `Removed scheduled ${type}` });
    } else {
      res.status(500).json({ error: "Scheduler not initialized" });
    }
  } catch (error) {
    console.error("Error removing scheduled transaction:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Get scheduled transactions for a user
app.get("/scheduler/user/:memberName", async (req, res) => {
  try {
    const { memberName } = req.params;

    const userProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ "checkingAccount.accountHolder": memberName });

    if (!userProfile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const bills = userProfile.checkingAccount.bills || [];
    const payments = userProfile.checkingAccount.payments || [];

    res.json({
      memberName,
      bills: bills.map((bill) => ({
        ...bill,
        nextExecution: bill.nextExecution || "Not scheduled",
      })),
      payments: payments.map((payment) => ({
        ...payment,
        nextExecution: payment.nextExecution || "Not scheduled",
      })),
    });
  } catch (error) {
    console.error("Error getting user scheduled transactions:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Get catch-up statistics
app.get("/scheduler/catchup-stats", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await schedulerManager.getCatchupStats(days);

    res.json({
      success: true,
      days: days,
      stats: stats,
    });
  } catch (error) {
    console.error("Error getting catch-up stats:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// Manual catch-up check (for admin/testing purposes)
app.post("/scheduler/manual-catchup", async (req, res) => {
  try {
    console.log("🔧 Manual catch-up check requested...");
    const result = await schedulerManager.manualCatchupCheck();

    res.json({
      success: result.success,
      message: result.success
        ? `Catch-up complete: ${result.totalProcessed} transactions processed`
        : `Catch-up failed: ${result.error}`,
      details: result,
    });
  } catch (error) {
    console.error("Error performing manual catch-up:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

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
      },
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": memberName },
      { $push: { "checkingAccount.movementsDates": newDate } },
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
      },
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": destinationProfile },
      { $push: { "checkingAccount.movementsDates": destinationDate } },
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
      },
    );

  await client
    .db("TrinityCapital")
    .collection("User Profiles")
    .updateOne(
      { "checkingAccount.accountHolder": sender },
      { $push: { "checkingAccount.movementsDates": destinationDate } },
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

/**************************************************DONATIONS*********************************************/

// Simple donation endpoint for checking account donations
app.post("/donations", async (req, res) => {
  try {
    const { parcel } = req.body;
    const [donorName, donationAmount] = parcel;

    console.log(`Donation of $${donationAmount} from ${donorName} to checking`);

    // For now, just return success - implement donation logic as needed
    res.json({
      success: true,
      message: `Donation of $${donationAmount} processed successfully`,
      amount: donationAmount,
      donor: donorName,
      account: "checking",
    });
  } catch (error) {
    console.error("Error processing donation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process donation",
    });
  }
});

// Simple donation endpoint for savings account donations
app.post("/donationsSavings", async (req, res) => {
  try {
    const { parcel } = req.body;
    const [donorName, donationAmount] = parcel;

    console.log(`Donation of $${donationAmount} from ${donorName} to savings`);

    // For now, just return success - implement donation logic as needed
    res.json({
      success: true,
      message: `Savings donation of $${donationAmount} processed successfully`,
      amount: donationAmount,
      donor: donorName,
      account: "savings",
    });
  } catch (error) {
    console.error("Error processing savings donation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process savings donation",
    });
  }
});

/**************************************************FEEDBACK*********************************************/

let feedbackTransporter;

// Use generic EMAIL_USER/EMAIL_PASS env vars for email configuration
const mailUser = process.env.EMAIL_USER;
const mailPass = process.env.EMAIL_PASS;

if (mailUser && mailPass) {
  // Create a transporter for sending feedback emails.
  // NOTE: Prefer setting EMAIL_USER and EMAIL_PASS in your .env file.
  feedbackTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // use TLS
    auth: {
      user: mailUser,
      pass: mailPass, // App password recommended
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      // set to true in production if you want strict cert checks
      rejectUnauthorized: true,
    },
    // optionally enable debug: true for verbose logs in dev
  });
  console.log("✅ Feedback email service is configured.");
} else {
  console.warn(
    "⚠️ WARNING: Email credentials are not set in the .env file (EMAIL_USER/EMAIL_PASS).",
  );
  console.warn(
    "The /submit-feedback endpoint will save to the database but will NOT send emails.",
  );
}

// Helper to send feedback email with timeout and graceful fallback
async function trySendFeedbackEmail(mailOptions, timeoutMs = 12000) {
  if (!feedbackTransporter) {
    return false;
  }
  try {
    const sendPromise = feedbackTransporter.sendMail(mailOptions);
    const result = await Promise.race([
      sendPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("send_timeout")), timeoutMs),
      ),
    ]);
    console.log("Feedback email sent:", result && result.response);
    return true;
  } catch (err) {
    console.error(
      "Feedback email failed:",
      err && err.message ? err.message : err,
    );
    return false;
  }
}

app.post("/submit-feedback", async (req, res) => {
  try {
    const { parcel } = req.body;
    const { type, userType, ...data } = parcel;

    if (!type || !data) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid feedback data." });
    }

    if (type === "general") {
      // --- General Feedback Handler ---
      const { category, details } = data;
      const feedbackDoc = {
        studentName: "Anonymous",
        userType: userType || "Unknown",
        category,
        details,
        submittedAt: new Date(),
      };

      // 1. Save to database
      await client
        .db("TrinityCapital")
        .collection("GeneralFeedback")
        .insertOne(feedbackDoc);

      // 2. Send email (only if transporter is configured)
      if (feedbackTransporter) {
        const mailOptions = {
          from: `"Trinity Capital Feedback" <${mailUser}>`,
          to: "trinitycapitalsim@gmail.com",
          subject: `New General Feedback from a ${userType || "user"}`,
          html: `
          <h3>General Feedback Received</h3>
          <p><strong>User Type:</strong> ${userType || "Unknown"}</p>
          <p><strong>Student:</strong> Anonymous</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Details:</strong></p>
          <pre>${details}</pre>
          <p><em>Submitted at: ${feedbackDoc.submittedAt.toString()}</em></p>
        `,
        };
        const emailOk = await trySendFeedbackEmail(mailOptions);
        if (!emailOk) {
          console.warn(
            "Feedback email could not be sent. Check SMTP/network/credentials.",
          );
        }
      } else {
        console.warn(
          "Skipping feedback email because email service is not configured.",
        );
      }

      res.json({
        success: true,
        message: "General feedback submitted successfully.",
      });
    } else if (type === "bug") {
      // --- Bug Report Handler ---
      const { device, datetime, school, features, details } = data;
      const bugReportDoc = {
        studentName: "Anonymous",
        userType: userType || "Unknown",
        device,
        datetime: new Date(datetime),
        school,
        feature: features,
        details,
        submittedAt: new Date(),
      };

      // 1. Save to database
      await client
        .db("TrinityCapital")
        .collection("BugReports")
        .insertOne(bugReportDoc);

      // 2. Send email (only if transporter is configured)
      if (feedbackTransporter) {
        const mailOptions = {
          from: `"Trinity Capital Bug Report" <${mailUser}>`,
          to: "trinitycapitalsim@gmail.com",
          subject: `🚨 New Bug Report from a ${userType || "user"}`,
          html: `
          <h3>Bug Report Submitted</h3>
          <p><strong>User Type:</strong> ${userType || "Unknown"}</p>
          <p><strong>Student:</strong> Anonymous</p>
          <p><strong>School:</strong> ${school}</p>
          <p><strong>Device:</strong> ${device}</p>
          <p><strong>Feature:</strong> ${features}</p>
          <p><strong>Date & Time of Issue:</strong> ${bugReportDoc.datetime.toString()}</p>
          <p><strong>Details:</strong></p>
          <pre>${details}</pre>
          <p><em>Submitted at: ${bugReportDoc.submittedAt.toString()}</em></p>
        `,
        };
        const emailOk = await trySendFeedbackEmail(mailOptions);
        if (!emailOk) {
          console.warn(
            "Bug report email could not be sent. Check SMTP/network/credentials.",
          );
        }
      } else {
        console.warn(
          "Skipping feedback email because email service is not configured.",
        );
      }

      res.json({
        success: true,
        message: "Bug report submitted successfully.",
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: `Unknown feedback type: ${type}` });
    }
  } catch (error) {
    console.error("Error processing feedback:", error);
    res.status(500).json({
      success: false,
      message: "An internal error occurred.",
      details: error.message,
    });
  }
});

/**************************************************TIMER ENDPOINTS*********************************************/

// POST /api/timers - Save lesson timer
app.post("/api/timers", async (req, res) => {
  try {
    const { studentId, lessonId, elapsedTime } = req.body;

    if (!studentId || !lessonId || elapsedTime === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Upsert the timer document
    const result = await client
      .db("TrinityCapital")
      .collection("LessonTimers")
      .updateOne(
        { studentId, lessonId },
        {
          $set: {
            elapsedTime: elapsedTime,
            lastUpdated: new Date(),
          },
        },
        { upsert: true },
      );

    console.log(
      `Timer saved for student ${studentId}, lesson ${lessonId}: ${elapsedTime} seconds`,
    );
    res.json({ success: true, message: "Timer saved" });
  } catch (error) {
    console.error("Error saving timer:", error);
    res.status(500).json({ error: "Failed to save timer" });
  }
});

// GET /api/timers - Fetch lesson timer
app.get("/api/timers", async (req, res) => {
  try {
    const { studentId, lessonId } = req.query;

    if (!studentId || !lessonId) {
      return res.status(400).json({ error: "Missing studentId or lessonId" });
    }

    const timerDoc = await client
      .db("TrinityCapital")
      .collection("LessonTimers")
      .findOne({ studentId, lessonId });

    if (timerDoc) {
      console.log(
        `Timer fetched for student ${studentId}, lesson ${lessonId}: ${timerDoc.elapsedTime} seconds`,
      );
      res.json({ elapsedTime: timerDoc.elapsedTime });
    } else {
      console.log(
        `No timer found for student ${studentId}, lesson ${lessonId}`,
      );
      res.status(404).json({ error: "Timer not found" });
    }
  } catch (error) {
    console.error("Error fetching timer:", error);
    res.status(500).json({ error: "Failed to fetch timer" });
  }
});

/**************************************************LESSON SERVER FUNCTIONS*********************************************/

// Helper function to calculate student health metrics
function calculateStudentHealth(student) {
  const health = {
    financial: 0,
    academic: 0,
    overall: 0,
    status: "Poor",
    details: {
      financialFactors: {},
      academicFactors: {},
    },
  };

  // Financial Health Calculation (0-100 scale)
  let financialScore = 0;
  let financialFactors = 0;

  // Checking account balance (25% of financial health)
  const checkingBalance = student.checkingAccount?.balanceTotal ?? 0;
  if (checkingBalance >= 1000) {
    financialScore += 25;
  } else if (checkingBalance >= 500) {
    financialScore += 20;
  } else if (checkingBalance >= 100) {
    financialScore += 15;
  } else if (checkingBalance >= 0) {
    financialScore += 10;
  }
  health.details.financialFactors.checkingBalance = checkingBalance;
  financialFactors += 25;

  // Savings account balance (20% of financial health)
  const savingsBalance = student.savingsAccount?.balanceTotal ?? 0;
  if (savingsBalance >= 500) {
    financialScore += 20;
  } else if (savingsBalance >= 200) {
    financialScore += 15;
  } else if (savingsBalance >= 50) {
    financialScore += 10;
  } else if (savingsBalance >= 0) {
    financialScore += 5;
  }
  health.details.financialFactors.savingsBalance = savingsBalance;
  financialFactors += 20;

  // Emergency fund (15% of financial health)
  const emergencyFund = student.emergencyFund ?? 0;
  if (emergencyFund >= 1000) {
    financialScore += 15;
  } else if (emergencyFund >= 500) {
    financialScore += 12;
  } else if (emergencyFund >= 100) {
    financialScore += 8;
  } else if (emergencyFund >= 0) {
    financialScore += 3;
  }
  health.details.financialFactors.emergencyFund = emergencyFund;
  financialFactors += 15;

  // Debt level (20% of financial health, inverse scoring)
  const totalDebt = student.debt ?? 0;
  if (totalDebt === 0) {
    financialScore += 20;
  } else if (totalDebt <= 100) {
    financialScore += 15;
  } else if (totalDebt <= 500) {
    financialScore += 10;
  } else if (totalDebt <= 1000) {
    financialScore += 5;
  }
  health.details.financialFactors.totalDebt = totalDebt;
  financialFactors += 20;

  // Bill management (20% of financial health)
  const bills = student.bills ?? [];
  const activeBills = bills.filter((bill) => bill.amount > 0).length;
  if (activeBills === 0) {
    financialScore += 20;
  } else if (activeBills <= 2) {
    financialScore += 15;
  } else if (activeBills <= 4) {
    financialScore += 10;
  } else {
    financialScore += 5;
  }
  health.details.financialFactors.activeBills = activeBills;
  financialFactors += 20;

  health.financial = Math.round((financialScore / financialFactors) * 100);

  // Academic Health Calculation (0-100 scale)
  let academicScore = 0;
  let academicFactors = 0;

  // Total lessons completed (40% of academic health)
  const totalLessonsCompleted =
    student.totalLessonsCompleted ?? student.lessonsCompleted ?? 0;
  if (totalLessonsCompleted >= 10) {
    academicScore += 40;
  } else if (totalLessonsCompleted >= 5) {
    academicScore += 30;
  } else if (totalLessonsCompleted >= 2) {
    academicScore += 20;
  } else if (totalLessonsCompleted >= 1) {
    academicScore += 10;
  }
  health.details.academicFactors.totalLessonsCompleted = totalLessonsCompleted;
  academicFactors += 40;

  // Average score (40% of academic health)
  const averageScore = student.averageScore ?? 0;
  if (averageScore >= 90) {
    academicScore += 40;
  } else if (averageScore >= 80) {
    academicScore += 32;
  } else if (averageScore >= 70) {
    academicScore += 24;
  } else if (averageScore >= 60) {
    academicScore += 16;
  } else if (averageScore > 0) {
    academicScore += 8;
  }
  health.details.academicFactors.averageScore = averageScore;
  academicFactors += 40;

  // Recent activity (20% of academic health)
  const lastActivity = student.lastActivity ?? student.lastLessonCompleted;
  if (lastActivity) {
    const daysSinceActivity = Math.floor(
      (new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceActivity <= 1) {
      academicScore += 20;
    } else if (daysSinceActivity <= 3) {
      academicScore += 15;
    } else if (daysSinceActivity <= 7) {
      academicScore += 10;
    } else if (daysSinceActivity <= 14) {
      academicScore += 5;
    }
    health.details.academicFactors.daysSinceActivity = daysSinceActivity;
  } else {
    health.details.academicFactors.daysSinceActivity = null;
  }
  academicFactors += 20;

  health.academic =
    academicFactors > 0
      ? Math.round((academicScore / academicFactors) * 100)
      : 0;

  // Overall Health (weighted average: 60% financial, 40% academic)
  health.overall = Math.round(health.financial * 0.6 + health.academic * 0.4);

  // Determine status
  if (health.overall >= 85) {
    health.status = "Excellent";
  } else if (health.overall >= 70) {
    health.status = "Good";
  } else if (health.overall >= 55) {
    health.status = "Fair";
  } else if (health.overall >= 40) {
    health.status = "Poor";
  } else {
    health.status = "Critical";
  }

  return health;
}

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
      </div>`,
      )
      .join("");

    io.emit("lessonHtml", htmlCode);
    res.status(200).json({ message: "Lesson HTML emitted successfully." });
  } catch (error) {
    console.error("Error in /lessonArrays:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Handle lesson completion and update student profile
app.post("/lesson-completion", async (req, res) => {
  try {
    const {
      studentName,
      lessonId,
      lessonTitle,
      score,
      grade,
      completionDate,
      duration,
      autoCompleted,
      difficultyLevel,
      conditionsBreakdown,
      totalConditions,
      completedConditions,
    } = req.body;

    console.log(
      `🎓 Processing lesson completion for ${studentName}: ${lessonTitle} (${score}% - ${grade})`,
    );

    // Find and update the student's profile
    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    // Create the lesson completion record
    const lessonCompletion = {
      lessonId,
      lessonTitle,
      score,
      grade,
      completionDate: new Date(completionDate),
      duration,
      autoCompleted,
      difficultyLevel,
      conditionsBreakdown,
      totalConditions,
      completedConditions,
    };

    // First, get the current student profile
    const currentProfile = await userProfilesCollection.findOne({
      memberName: studentName,
    });

    if (!currentProfile) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
        message: `No profile found for student: ${studentName}`,
      });
    }

    // Calculate new totals
    const newTotalLessonsCompleted =
      (currentProfile.totalLessonsCompleted || 0) + 1;
    const newTotalScore = (currentProfile.totalScore || 0) + score;
    const newAverageScore =
      Math.round((newTotalScore / newTotalLessonsCompleted) * 100) / 100;

    // Calculate updated grade based on average score
    let updatedGrade = "F";
    if (newAverageScore >= 90) updatedGrade = "A";
    else if (newAverageScore >= 80) updatedGrade = "B";
    else if (newAverageScore >= 70) updatedGrade = "C";
    else if (newAverageScore >= 60) updatedGrade = "D";

    console.log(`📊 Updated stats for ${studentName}:`, {
      totalLessonsCompleted: newTotalLessonsCompleted,
      averageScore: newAverageScore,
      grade: updatedGrade,
    });

    // Update student profile with lesson completion and new stats
    const updateResult = await userProfilesCollection.updateOne(
      { memberName: studentName },
      {
        $push: {
          completedLessons: lessonCompletion,
        },
        $set: {
          totalLessonsCompleted: newTotalLessonsCompleted,
          totalScore: newTotalScore,
          averageScore: newAverageScore,
          grade: updatedGrade,
          lessonsCompleted: newTotalLessonsCompleted, // Also update the lessonsCompleted field for dashboard compatibility
          lastLessonCompleted: new Date(completionDate),
          lastActivity: new Date(),
        },
      },
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found during update",
        message: `Failed to update profile for student: ${studentName}`,
      });
    }

    console.log(
      `✅ Successfully updated ${studentName}'s profile with lesson completion`,
    );

    // Get the student's teacher information for dashboard updates
    const teacherName = currentProfile.teacher;
    const classPeriod = currentProfile.classPeriod;

    // Emit socket events for real-time dashboard updates
    if (teacherName) {
      console.log(`📡 Emitting dashboard updates for teacher: ${teacherName}`);

      // Emit student progress update to teacher dashboards
      io.emit("studentProgressUpdate", {
        studentName: studentName,
        teacherName: teacherName,
        classPeriod: classPeriod,
        lessonTitle: lessonTitle,
        score: score,
        grade: updatedGrade,
        totalLessonsCompleted: newTotalLessonsCompleted,
        averageScore: newAverageScore,
        completionDate: new Date(completionDate),
      });

      // Emit class health update to trigger dashboard refresh
      io.emit("classHealthUpdate", {
        teacherName: teacherName,
        studentName: studentName,
        updateType: "lesson_completion",
        timestamp: new Date(),
      });

      // Emit specific student lesson completion event
      io.emit("lessonCompleted", {
        studentName: studentName,
        lessonId: lessonId,
        lessonTitle: lessonTitle,
        score: score,
        grade: updatedGrade,
        teacherName: teacherName,
        timestamp: new Date(completionDate),
      });

      console.log(`📊 Dashboard update events emitted for ${studentName}`);
    }

    // Also emit a direct update to the specific student
    const studentSocket = userSockets.get(studentName);
    if (studentSocket) {
      studentSocket.emit("lessonCompletionConfirmed", {
        lessonTitle: lessonTitle,
        score: score,
        grade: updatedGrade,
        totalLessonsCompleted: newTotalLessonsCompleted,
        averageScore: newAverageScore,
      });
      console.log(`🎯 Sent lesson completion confirmation to ${studentName}`);
    }

    res.json({
      success: true,
      message: "Lesson completion saved successfully",
      data: {
        studentName,
        lessonTitle,
        score,
        grade: updatedGrade,
        totalLessonsCompleted: newTotalLessonsCompleted,
        averageScore: newAverageScore,
        teacherName: teacherName,
        dashboardUpdated: true,
      },
    });
  } catch (error) {
    console.error("❌ Error saving lesson completion:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save lesson completion",
      message: error.message,
    });
  }
});

/*****************************************NEW LESSON ENGINE API ENDPOINTS***************************************************/

// Test endpoint to debug Jake Ferguson's data
app.get("/api/debug-student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const decodedStudentId = decodeURIComponent(studentId);

    console.log(`🔍 DEBUG: Checking data for student: ${decodedStudentId}`);

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    // Find student profile by memberName
    const studentProfile = await userProfilesCollection.findOne({
      memberName: decodedStudentId,
    });

    if (!studentProfile) {
      console.log(`❌ DEBUG: Student not found: ${decodedStudentId}`);

      // Let's also check what students do exist
      const allStudents = await userProfilesCollection
        .find(
          {},
          {
            projection: { memberName: 1, _id: 0 },
          },
        )
        .limit(10)
        .toArray();

      return res.json({
        found: false,
        searchedFor: decodedStudentId,
        existingStudents: allStudents.map((s) => s.memberName),
      });
    }

    console.log(`✅ DEBUG: Found student profile for: ${decodedStudentId}`);

    // Return all relevant data for debugging
    return res.json({
      found: true,
      studentName: studentProfile.memberName,
      lessonIds: studentProfile.lessonIds,
      assignedUnitIds: studentProfile.assignedUnitIds,
      currentLessonId: studentProfile.currentLessonId,
      hasLegacyLessons: !!(
        studentProfile.lessonIds && studentProfile.lessonIds.length > 0
      ),
      hasNewLessons: !!(
        studentProfile.assignedUnitIds &&
        studentProfile.assignedUnitIds.length > 0
      ),
    });
  } catch (error) {
    console.error("❌ DEBUG Error:", error);
    res.status(500).json({ error: "Debug failed", details: error.message });
  }
});

// Get current active lesson for a student
app.get("/api/student-current-lesson/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const decodedStudentId = decodeURIComponent(studentId);

    console.log(`🔍 Fetching current lesson for student: ${decodedStudentId}`);

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    // Find student profile by memberName (actual student name)
    const studentProfile = await userProfilesCollection.findOne({
      memberName: decodedStudentId,
    });

    if (!studentProfile) {
      console.log(`❌ Student not found: ${decodedStudentId}`);
      return res.status(404).json({ error: "Student not found" });
    }

    console.log(`✅ Found student profile for: ${decodedStudentId}`);

    // Check if student has any assigned lessons
    const assignedLessonIds = studentProfile.lessonIds || [];
    const assignedUnitIds = studentProfile.assignedUnitIds || [];

    // If no lessons assigned, return null
    if (assignedLessonIds.length === 0 && assignedUnitIds.length === 0) {
      console.log(`ℹ️ No lessons assigned to student: ${decodedStudentId}`);
      return res.json(null);
    }

    // Try to get current lesson from newer ObjectID-based system first
    if (assignedUnitIds.length > 0) {
      console.log(
        `🔗 Using ObjectID-based lesson system for ${decodedStudentId}`,
      );

      // Get all lesson IDs from assigned units
      let allLessonIds = [];
      assignedUnitIds.forEach((unitAssignment) => {
        if (
          unitAssignment.lessonIds &&
          Array.isArray(unitAssignment.lessonIds)
        ) {
          allLessonIds.push(...unitAssignment.lessonIds);
        }
      });

      if (allLessonIds.length > 0) {
        // For now, return the first lesson as current lesson
        // TODO: Implement proper lesson progression logic
        const currentLessonId = allLessonIds[0];

        console.log(`📝 Trying to fetch lesson with ID: ${currentLessonId}`);

        // Load Dallas Fed lesson data
        const fs = require("fs");
        const path = require("path");
        let dallasFedLessons = [];
        try {
          const lessonDataPath = path.join(
            __dirname,
            "dallas_fed_aligned_lessons.json",
          );
          const lessonData = JSON.parse(
            fs.readFileSync(lessonDataPath, "utf8"),
          );
          dallasFedLessons = lessonData.lessons || [];
        } catch (error) {
          console.log(
            "⚠️ Could not load Dallas Fed lesson data, using fallback titles",
          );
        }

        // Get the lesson index and corresponding Dallas Fed data
        const lessonIndex = allLessonIds.indexOf(currentLessonId);
        const dallasFedLesson = dallasFedLessons[lessonIndex];
        const lessonTitle =
          dallasFedLesson?.lesson_title || `Unit 1 Lesson ${lessonIndex + 1}`;
        const lessonDescription =
          dallasFedLesson?.lesson_description ||
          `Dallas Fed Curriculum Lesson ${currentLessonId}`;

        // Return a lesson with actual titles from Dallas Fed data
        const mockLesson = {
          _id: currentLessonId,
          lesson_title: lessonTitle,
          lesson_description: lessonDescription,
          lesson_type: "interactive",
          lesson_blocks: [
            {
              type: "instruction",
              content:
                dallasFedLesson?.lesson_description ||
                `This is lesson ${lessonIndex + 1} from the Dallas Fed curriculum.`,
            },
            {
              type: "action",
              content: "Complete the financial tasks as instructed.",
            },
            {
              type: "condition_check",
              content:
                "Your progress will be tracked automatically as you complete banking activities.",
            },
          ],
          lesson_conditions: dallasFedLesson?.lesson_conditions || [
            {
              type: "balance_check",
              target: 100,
              description: "Maintain account balance above $100",
            },
            {
              type: "transaction_count",
              target: 3,
              description: "Complete at least 3 transactions",
            },
          ],
          intro_text_blocks: [
            {
              type: "intro",
              content: `Welcome to ${lessonTitle}! In this lesson, you'll learn about managing your finances effectively.`,
            },
          ],
          teacher: "admin@trinity-capital.net",
          unit: dallasFedLesson?.unit || "unit1",
          unitName: dallasFedLesson?.unit || "Unit 1: Earning and Spending",
          lessonNumber: lessonIndex + 1,
          isAvailable: true,
          isCompleted: false,
        };

        console.log(`✅ Returning mock lesson for testing: ${currentLessonId}`);
        return res.json(mockLesson);

        // Commented out the lesson server and database lookup for now
        /*
        try {
          // First try to fetch from lesson server with numeric IDs
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const lessonServerResponse = await fetch(
            'http://localhost:4000/get-lessons-by-ids',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lessonIds: [currentLessonId],
                studentName: decodedStudentId,
              }),
              signal: controller.signal,
            },
          );
          
          clearTimeout(timeoutId);

          if (lessonServerResponse.ok) {
            const lessonData = await lessonServerResponse.json();
            if (lessonData.success && lessonData.lessons.length > 0) {
              console.log(`✅ Retrieved current lesson from lesson server`);
              return res.json(lessonData.lessons[0]);
            } else {
              console.log(`⚠️ Lesson server responded but no lessons found for ID: ${currentLessonId}`);
            }
          } else {
            console.log(`⚠️ Lesson server request failed with status: ${lessonServerResponse.status}`);
          }
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            console.warn('Lesson server request timed out');
          } else {
            console.warn('Could not fetch from lesson server:', fetchError.message);
          }
        }

        // Try to find lesson by numeric ID in the local collection
        try {
          const lessonsCollection = client
            .db('TrinityCapital')
            .collection('Lessons');

          // Try searching by the numeric ID as a string field
          let currentLesson = await lessonsCollection.findOne({
            lessonId: currentLessonId,
          });

          // If not found, try searching by _id as string
          if (!currentLesson) {
            currentLesson = await lessonsCollection.findOne({
              _id: currentLessonId,
            });
          }

          // If still not found, try searching in lesson.lesson_id field
          if (!currentLesson) {
            currentLesson = await lessonsCollection.findOne({
              'lesson.lesson_id': currentLessonId,
            });
          }

          if (currentLesson) {
            console.log(`✅ Retrieved current lesson from legacy system`);
            return res.json(currentLesson);
          } else {
            console.log(`⚠️ Lesson not found in local collection with ID: ${currentLessonId}`);
          }
        } catch (localError) {
          console.warn(`Error searching local collection:`, localError.message);
        }
        */
      }
    }

    // Fallback to legacy lesson system
    if (assignedLessonIds.length > 0) {
      console.log(`📚 Using legacy lesson system for ${decodedStudentId}`);

      const currentLessonId =
        studentProfile.currentLessonId || assignedLessonIds[0];

      try {
        const lessonsCollection = client
          .db("TrinityCapital")
          .collection("Lessons");
        const currentLesson = await lessonsCollection.findOne({
          _id: new ObjectId(currentLessonId),
        });

        if (currentLesson) {
          console.log(`✅ Retrieved current lesson from legacy system`);
          return res.json(currentLesson);
        }
      } catch (objectIdError) {
        console.warn(
          `Invalid ObjectId in legacy system: ${currentLessonId}`,
          objectIdError,
        );
      }
    }

    // If we get here, no valid lesson was found
    console.log(
      `ℹ️ No valid current lesson found for student: ${decodedStudentId}`,
    );
    return res.json(null);
  } catch (error) {
    console.error("❌ Error fetching current lesson:", error);
    res.status(500).json({ error: "Failed to fetch current lesson" });
  }
});

// Get student financial data for condition evaluation
app.get("/api/student-financial-data/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const decodedStudentId = decodeURIComponent(studentId);

    console.log(`💰 Getting financial data for student: ${decodedStudentId}`);

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");
    const studentProfile = await userProfilesCollection.findOne({
      memberName: decodedStudentId,
    });

    if (!studentProfile) {
      console.log(`❌ Student not found: ${decodedStudentId}`);
      return res.status(404).json({ error: "Student not found" });
    }

    // Calculate financial data from student profile
    const checkingBalance = studentProfile.checkingAccount?.balanceTotal || 0;
    const savingsBalance = studentProfile.savingsAccount?.balanceTotal || 0;
    const totalBalance = checkingBalance + savingsBalance;

    const bills = studentProfile.checkingAccount?.bills || [];
    const payments = studentProfile.checkingAccount?.payments || [];
    const checkingTransactions =
      studentProfile.checkingAccount?.transactions || [];
    const savingsTransactions =
      studentProfile.savingsAccount?.transactions || [];

    const totalBills = bills.reduce(
      (sum, bill) => sum + (parseFloat(bill.amount) || 0),
      0,
    );
    const totalPayments = payments.reduce(
      (sum, payment) => sum + (parseFloat(payment.amount) || 0),
      0,
    );

    const financialData = {
      checkingBalance,
      savingsBalance,
      totalBalance,
      totalBills,
      totalIncome: totalPayments, // payments are typically income
      transactionCount:
        checkingTransactions.length + savingsTransactions.length,
      lessonStartTime: studentProfile.lessonStartTime || Date.now(),
      bills: bills.length,
      income: payments.length,
      currentAccount: studentProfile.currentAccount || "checking",
    };

    console.log(`💰 Financial data for ${decodedStudentId}:`, {
      checkingBalance,
      savingsBalance,
      totalBalance,
      billCount: bills.length,
      paymentCount: payments.length,
    });

    res.json(financialData);
  } catch (error) {
    console.error("❌ Error fetching student financial data:", error);
    res.status(500).json({ error: "Failed to fetch financial data" });
  }
});

// Check lesson access (lesson gating)
app.get("/api/lesson-access/:studentId/:lessonId", async (req, res) => {
  try {
    const { studentId, lessonId } = req.params;

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");
    const studentProfile = await userProfilesCollection.findOne({
      memberName: studentId,
    });

    if (!studentProfile) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Check if student has access to this lesson
    const assignedLessonIds = studentProfile.lessonIds || [];
    const completedLessonIds = studentProfile.completedLessons || [];

    const hasAccess = assignedLessonIds.includes(lessonId);
    const isCompleted = completedLessonIds.some(
      (completed) => completed.lessonId === lessonId,
    );

    // For lesson gating, check if previous lessons are completed
    // This is a simplified version - could be enhanced based on specific gating rules
    const lessonIndex = assignedLessonIds.indexOf(lessonId);
    const canAccess =
      lessonIndex === 0 || lessonIndex <= completedLessonIds.length;

    res.json({
      hasAccess: hasAccess && canAccess,
      isCompleted,
      lessonIndex,
    });
  } catch (error) {
    console.error("❌ Error checking lesson access:", error);
    res.status(500).json({ error: "Failed to check lesson access" });
  }
});

// Get lesson data by ID
app.get("/api/lesson/:lessonId", async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lessonsCollection = client.db("TrinityCapital").collection("Lessons");
    const lesson = await lessonsCollection.findOne({
      _id: new ObjectId(lessonId),
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json(lesson);
  } catch (error) {
    console.error("❌ Error fetching lesson:", error);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

// Lock lesson for student
app.post("/api/lock-lesson", async (req, res) => {
  try {
    const { studentId, lessonId } = req.body;

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    await userProfilesCollection.updateOne(
      { memberName: studentId },
      {
        $addToSet: { lockedLessons: lessonId },
        $set: { lastLessonLocked: new Date() },
      },
    );

    res.json({ success: true, message: "Lesson locked successfully" });
  } catch (error) {
    console.error("❌ Error locking lesson:", error);
    res.status(500).json({ error: "Failed to lock lesson" });
  }
});

// Unlock next lesson for student
app.post("/api/unlock-next-lesson", async (req, res) => {
  try {
    const { studentId, currentLessonId } = req.body;

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");
    const studentProfile = await userProfilesCollection.findOne({
      memberName: studentId,
    });

    if (!studentProfile) {
      return res.status(404).json({ error: "Student not found" });
    }

    const assignedLessonIds = studentProfile.lessonIds || [];
    const currentIndex = assignedLessonIds.indexOf(currentLessonId);

    if (currentIndex >= 0 && currentIndex < assignedLessonIds.length - 1) {
      const nextLessonId = assignedLessonIds[currentIndex + 1];

      await userProfilesCollection.updateOne(
        { memberName: studentId },
        {
          $set: { currentLessonId: nextLessonId },
          $pull: { lockedLessons: nextLessonId },
        },
      );

      res.json({
        success: true,
        nextLessonId,
        message: "Next lesson unlocked",
      });
    } else {
      res.json({ success: true, message: "No more lessons to unlock" });
    }
  } catch (error) {
    console.error("❌ Error unlocking next lesson:", error);
    res.status(500).json({ error: "Failed to unlock next lesson" });
  }
});

// Sync lesson completion with teacher dashboard
app.post("/api/sync-teacher-dashboard", async (req, res) => {
  try {
    const { studentId, lessonId, grade, conditionsData } = req.body;

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");
    const studentProfile = await userProfilesCollection.findOne({
      memberName: studentId,
    });

    if (!studentProfile) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Update student's completed lessons
    const completionRecord = {
      lessonId,
      grade,
      completedDate: new Date(),
      conditionsData,
      studentHealth: studentProfile.studentHealth || "healthy",
    };

    await userProfilesCollection.updateOne(
      { memberName: studentId },
      {
        $addToSet: { completedLessons: completionRecord },
        $set: {
          lastLessonCompleted: new Date(),
          studentHealth: grade >= 70 ? "healthy" : "needs_attention",
        },
      },
    );

    res.json({
      success: true,
      message: "Teacher dashboard synced successfully",
    });
  } catch (error) {
    console.error("❌ Error syncing teacher dashboard:", error);
    res.status(500).json({ error: "Failed to sync teacher dashboard" });
  }
});

// Get available lessons for student
app.get("/api/student-lessons/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const decodedStudentId = decodeURIComponent(studentId);

    console.log(`📚 Fetching lessons for student: ${decodedStudentId}`);

    const userProfilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    const studentProfile = await userProfilesCollection.findOne({
      memberName: decodedStudentId,
    });

    if (!studentProfile) {
      console.log(`❌ Student not found: ${decodedStudentId}`);
      return res.status(404).json({ error: "Student not found" });
    }

    let allLessons = [];

    // Check for lessons in the new unit-based system
    const assignedUnitIds = studentProfile.assignedUnitIds || [];
    if (assignedUnitIds.length > 0) {
      console.log(`🔗 Found ${assignedUnitIds.length} assigned units`);

      // Get all lesson IDs from assigned units
      let allLessonIds = [];
      assignedUnitIds.forEach((unitAssignment) => {
        if (
          unitAssignment.lessonIds &&
          Array.isArray(unitAssignment.lessonIds)
        ) {
          allLessonIds.push(...unitAssignment.lessonIds);
          console.log(
            `Unit "${unitAssignment.unitName}" contributes ${unitAssignment.lessonIds.length} lesson IDs`,
          );
        }
      });

      console.log(
        `📝 Found ${allLessonIds.length} lesson IDs: ${allLessonIds.slice(0, 3)}...`,
      );

      // Load Dallas Fed lesson data
      const fs = require("fs");
      const path = require("path");
      let dallasFedLessons = [];
      try {
        const lessonDataPath = path.join(
          __dirname,
          "dallas_fed_aligned_lessons.json",
        );
        const lessonData = JSON.parse(fs.readFileSync(lessonDataPath, "utf8"));
        dallasFedLessons = lessonData.lessons || [];
      } catch (error) {
        console.log(
          "⚠️ Could not load Dallas Fed lesson data, using fallback titles",
        );
      }

      // Create lessons with actual titles from Dallas Fed data
      allLessons = allLessonIds.map((lessonId, index) => {
        const dallasFedLesson = dallasFedLessons[index];
        const lessonTitle =
          dallasFedLesson?.lesson_title || `Unit 1 Lesson ${index + 1}`;
        const lessonDescription =
          dallasFedLesson?.lesson_description ||
          `Dallas Fed Curriculum Lesson ${lessonId}`;

        return {
          _id: lessonId,
          lesson_title: lessonTitle,
          lesson_description: lessonDescription,
          lesson_type: "interactive",
          lesson_blocks: [
            {
              type: "instruction",
              content:
                dallasFedLesson?.lesson_description ||
                `This is lesson ${index + 1} from the Dallas Fed curriculum.`,
            },
            {
              type: "action",
              content: "Complete the financial tasks as instructed.",
            },
          ],
          lesson_conditions: dallasFedLesson?.lesson_conditions || [
            {
              type: "balance_check",
              target: 100,
              description: "Maintain account balance",
            },
          ],
          intro_text_blocks: [
            {
              type: "intro",
              content: `Welcome to ${lessonTitle}!`,
            },
          ],
          teacher: "admin@trinity-capital.net",
          unit: dallasFedLesson?.unit || "unit1",
          unitName: dallasFedLesson?.unit || "Unit 1: Earning and Spending",
          lessonNumber: index + 1,
          isAvailable: true,
          isCompleted: false,
        };
      });
    }

    // Fallback to legacy lesson system
    const assignedLessonIds = studentProfile.lessonIds || [];
    if (assignedLessonIds.length > 0 && allLessons.length === 0) {
      console.log(
        `📚 Using legacy lesson system with ${assignedLessonIds.length} lessons`,
      );

      try {
        const lessonsCollection = client
          .db("TrinityCapital")
          .collection("Lessons");
        const lessons = await lessonsCollection
          .find({
            _id: { $in: assignedLessonIds.map((id) => new ObjectId(id)) },
          })
          .toArray();
        allLessons = lessons;
      } catch (error) {
        console.warn("Could not fetch legacy lessons:", error.message);
      }
    }

    console.log(
      `✅ Returning ${allLessons.length} lessons for ${decodedStudentId}`,
    );
    res.json(allLessons);
  } catch (error) {
    console.error("❌ Error fetching student lessons:", error);
    res.status(500).json({ error: "Failed to fetch student lessons" });
  }
});

/*****************************************END NEW LESSON ENGINE API ENDPOINTS***************************************************/

// Replace lesson in unit endpoint
app.post("/replaceLessonInUnit", async (req, res) => {
  try {
    const { teacherName, unitValue, oldLessonId, newLessonId } = req.body;

    // Debug logging
    console.log("Replace lesson request received:");
    console.log("teacherName:", teacherName);
    console.log("unitValue:", unitValue, "type:", typeof unitValue);
    console.log("oldLessonId:", oldLessonId, "type:", typeof oldLessonId);
    console.log("newLessonId:", newLessonId, "type:", typeof newLessonId);

    if (!teacherName || !unitValue || !oldLessonId || !newLessonId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: teacherName, unitValue, oldLessonId, newLessonId",
      });
    }

    // Function to validate ObjectId
    function isValidObjectId(id) {
      return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
    }

    // Validate new lesson ObjectId
    if (!isValidObjectId(newLessonId)) {
      console.log("Invalid newLessonId format:", newLessonId);
      return res.status(400).json({
        success: false,
        message: "Invalid newLessonId format",
      });
    }

    // Get the old lesson details from the Lessons collection to find the title
    const oldLesson = await client
      .db("TrinityCapital")
      .collection("Lessons")
      .findOne({ _id: new ObjectId(oldLessonId) });

    if (!oldLesson) {
      return res.status(404).json({
        success: false,
        message: "Old lesson not found",
      });
    }

    // Get the new lesson details from the Lessons collection
    const newLesson = await client
      .db("TrinityCapital")
      .collection("Lessons")
      .findOne({ _id: new ObjectId(newLessonId) });

    if (!newLesson) {
      return res.status(404).json({
        success: false,
        message: "New lesson not found",
      });
    }

    // Update the lesson in the teacher's document using lesson title for matching
    const updateResult = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .updateOne(
        {
          name: teacherName,
          "units.value": unitValue,
          "units.lessons.lesson_title": oldLesson.lesson.lesson_title,
        },
        {
          $set: {
            "units.$[unit].lessons.$[lesson]": {
              lesson_title: newLesson.lesson.lesson_title,
              intro_text_blocks: newLesson.lesson.intro_text_blocks,
              conditions: newLesson.lesson.conditions,
            },
          },
        },
        {
          arrayFilters: [
            { "unit.value": unitValue },
            { "lesson.lesson_title": oldLesson.lesson.lesson_title },
          ],
        },
      );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher, unit, or lesson not found for replacement",
      });
    }

    console.log(
      `Lesson replaced successfully: ${oldLesson.lesson.lesson_title} -> ${newLesson.lesson.lesson_title} in unit ${unitValue} for teacher ${teacherName}`,
    );

    // --- Emit Socket.IO event to update lesson management modal ---
    io.emit("lessonReplaced", {
      teacherName: teacherName,
      unitValue: unitValue,
      oldLesson: {
        _id: oldLessonId,
        lesson_title: oldLesson.lesson.lesson_title,
      },
      newLesson: {
        _id: newLessonId,
        lesson_title: newLesson.lesson.lesson_title,
      },
    });

    res.status(200).json({
      success: true,
      message: "Lesson replaced successfully",
      replacedLesson: {
        _id: newLessonId,
        lesson_title: newLesson.lesson.lesson_title,
      },
    });
  } catch (error) {
    console.error("Error replacing lesson in unit:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Save unit changes endpoint
app.post("/saveUnitChanges", async (req, res) => {
  try {
    const { teacherName, unitValue, lessons } = req.body;

    // Debug logging
    console.log("Save unit changes request received:");
    console.log("teacherName:", teacherName);
    console.log("unitValue:", unitValue);
    console.log("lessons:", lessons);

    if (!teacherName || !unitValue || !Array.isArray(lessons)) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: teacherName, unitValue, lessons",
      });
    }

    // Update the unit's lessons in the teacher's document
    const updateResult = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .updateOne(
        {
          name: teacherName,
          "units.value": unitValue,
        },
        {
          $set: {
            "units.$.lessons": lessons,
          },
        },
      );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher or unit not found",
      });
    }

    if (updateResult.modifiedCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes were made to the unit",
      });
    }

    console.log(
      `Unit ${unitValue} updated successfully for teacher ${teacherName} with ${lessons.length} lessons`,
    );

    // --- Emit Socket.IO event to update lesson management modal ---
    io.emit("unitSaved", {
      teacherName: teacherName,
      unitValue: unitValue,
      lessons: lessons,
    });

    res.status(200).json({
      success: true,
      message: "Unit changes saved successfully",
      unitValue: unitValue,
      lessonsCount: lessons.length,
    });
  } catch (error) {
    console.error("Error saving unit changes:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
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
        `Teacher not found for username: ${teachUser}, pin: ${teachPin}`,
      );
      res.status(404).json({ found: false });
    }
  } catch (error) {
    console.error("Error in /findTeacher:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/*****************************************SAMPLE DATA MANAGEMENT***************************************************/

/**
 * Reset sample user data on logout
 * POST /sample/reset-data
 * Body: { username, userType } OR { teacherName, userType }
 * userType: "student" | "teacher"
 */
app.post("/sample/reset-data", async (req, res) => {
  try {
    const { username, teacherName, userType } = req.body;

    // For teachers, use teacherName; for students, use username
    const identifier = userType === "teacher" ? teacherName : username;

    if (!identifier || !userType) {
      return res.status(400).json({
        error:
          "Missing identifier (username for students, teacherName for teachers) or userType",
      });
    }

    if (!sampleDataManager) {
      return res
        .status(500)
        .json({ error: "Sample data manager not initialized" });
    }

    const result = await sampleDataManager.resetSampleUserData(
      identifier,
      userType,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error resetting sample data:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Setup sample student membership
 * POST /sample/setup-student
 * Body: { studentName, teacherName }
 */
app.post("/sample/setup-student", async (req, res) => {
  try {
    const { studentName, teacherName } = req.body;

    if (!studentName || !teacherName) {
      return res
        .status(400)
        .json({ error: "Missing studentName or teacherName" });
    }

    if (!sampleDataManager) {
      return res
        .status(500)
        .json({ error: "Sample data manager not initialized" });
    }

    const result = await sampleDataManager.setupSampleStudent(
      studentName,
      teacherName,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error setting up sample student:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify sample student (create if doesn't exist)
 * POST /sample/verify-student
 * Body: { studentName, teacherName }
 */
app.post("/sample/verify-student", async (req, res) => {
  try {
    const { studentName, teacherName } = req.body;

    if (!studentName || !teacherName) {
      return res
        .status(400)
        .json({ error: "Missing studentName or teacherName" });
    }

    if (!sampleDataManager) {
      return res
        .status(500)
        .json({ error: "Sample data manager not initialized" });
    }

    const result = await sampleDataManager.verifySampleStudent(
      studentName,
      teacherName,
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Error verifying sample student:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sample/cleanup-messages/:teacherName
 * Deletes all message threads for a sample teacher
 * Called during sample teacher login cleanup
 */
app.post("/sample/cleanup-messages/:teacherName", async (req, res) => {
  try {
    const { teacherName } = req.params;
    const decodedTeacherName = decodeURIComponent(teacherName);

    if (!decodedTeacherName) {
      return res.status(400).json({ error: "Missing teacherName parameter" });
    }

    console.log("\n" + "=".repeat(80));
    console.log(
      `💬 [SampleTeacherMessagesCleanup] Starting message cleanup for: ${decodedTeacherName}`,
    );
    console.log("=".repeat(80));

    const threadsCollection = client.db("TrinityCapital").collection("threads");

    // Debug: Check what threads exist BEFORE deletion
    console.log(`\n📋 [DEBUG] Checking threads BEFORE cleanup...`);
    const threadsBeforeDelete = await threadsCollection.find({}).toArray();
    console.log(
      `Found ${threadsBeforeDelete.length} total threads in database`,
    );

    // Find all threads with this teacher in the threadId
    const threadQuery = {
      $or: [
        { threadId: { $regex: decodedTeacherName, $options: "i" } },
        { participants: decodedTeacherName },
      ],
    };

    const threadsToDelete = await threadsCollection.find(threadQuery).toArray();

    console.log(
      `\n🔍 [DEBUG] Found ${threadsToDelete.length} threads for teacher: ${decodedTeacherName}`,
    );
    threadsToDelete.forEach((thread, idx) => {
      console.log(
        `  [${idx + 1}] Thread ID: "${thread.threadId}", Participants: ${JSON.stringify(
          thread.participants || [],
        )}`,
      );
    });

    // Delete all threads for this teacher
    const deleteResult = await threadsCollection.deleteMany(threadQuery);

    console.log(
      `\n✅ Deleted ${deleteResult.deletedCount} message threads for ${decodedTeacherName}`,
    );

    // Debug: Verify threads are deleted
    console.log(`\n📋 [DEBUG] Checking threads AFTER cleanup...`);
    const threadsAfterDelete = await threadsCollection
      .find(threadQuery)
      .toArray();
    console.log(`Found ${threadsAfterDelete.length} threads remaining`);
    if (threadsAfterDelete.length > 0) {
      console.log("⚠️  WARNING: Threads still exist after delete!");
      threadsAfterDelete.forEach((thread) => {
        console.log(
          `  Remaining: "${thread.threadId}" with participants: ${JSON.stringify(
            thread.participants || [],
          )}`,
        );
      });
    }

    console.log("=".repeat(80) + "\n");

    res.status(200).json({
      success: true,
      message: `Message threads cleaned up for ${decodedTeacherName}`,
      threadsDeleted: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Error during message cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup message threads: " + error.message,
    });
  }
});

/**
 * POST /sample/cleanup-student/:studentName
 * Deletes all data for a sample student
 * Clears: bills, payments, transactions, movementsDates, lesson data, messages
 * Called during sample student login
 */
app.post("/sample/cleanup-student/:studentName", async (req, res) => {
  try {
    const { studentName } = req.params;
    const decodedStudentName = decodeURIComponent(studentName);

    if (!decodedStudentName) {
      return res.status(400).json({ error: "Missing studentName parameter" });
    }

    console.log("\n" + "=".repeat(80));
    console.log(
      `👤 [SampleStudentCleanup] Starting cleanup for: ${decodedStudentName}`,
    );
    console.log("=".repeat(80));

    const profilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");
    const threadsCollection = client.db("TrinityCapital").collection("threads");
    const lessonTimersCollection = client
      .db("TrinityCapital")
      .collection("LessonTimers");

    // Debug: Check student BEFORE cleanup
    console.log(`\n📋 [DEBUG] Checking student account BEFORE cleanup...`);
    const studentBefore = await profilesCollection.findOne({
      memberName: decodedStudentName,
    });

    if (!studentBefore) {
      console.log(`⚠️  Student not found: ${decodedStudentName}`);
      return res.status(404).json({
        success: false,
        message: `Student not found: ${decodedStudentName}`,
      });
    }

    console.log(`✓ Found student: ${studentBefore.memberName}`);
    console.log(
      `  Checking bills: ${
        studentBefore.checkingAccount?.bills?.length || 0
      }, payments: ${studentBefore.checkingAccount?.payments?.length || 0}`,
    );
    console.log(
      `  Transactions: ${
        studentBefore.checkingAccount?.transactions?.length || 0
      }`,
    );

    // Clear financial data for both accounts
    console.log(`\n🔄 [STEP 1] Clearing checking account...`);
    const checkingUpdateResult = await profilesCollection.updateOne(
      { memberName: decodedStudentName },
      {
        $set: {
          "checkingAccount.bills": [],
          "checkingAccount.payments": [],
          "checkingAccount.transactions": [],
          "checkingAccount.movementsDates": [],
          "checkingAccount.balanceTotal": 0,
        },
      },
    );
    console.log(
      `✅ Checking account cleared - matched: ${checkingUpdateResult.matchedCount}, modified: ${checkingUpdateResult.modifiedCount}`,
    );

    console.log(`\n🔄 [STEP 2] Clearing savings account...`);
    const savingsUpdateResult = await profilesCollection.updateOne(
      { memberName: decodedStudentName },
      {
        $set: {
          "savingsAccount.bills": [],
          "savingsAccount.payments": [],
          "savingsAccount.transactions": [],
          "savingsAccount.movementsDates": [],
          "savingsAccount.balanceTotal": 0,
        },
      },
    );
    console.log(
      `✅ Savings account cleared - matched: ${savingsUpdateResult.matchedCount}, modified: ${savingsUpdateResult.modifiedCount}`,
    );

    // Clear lesson data
    console.log(`\n🔄 [STEP 3] Clearing lesson data...`);
    await profilesCollection.updateOne(
      { memberName: decodedStudentName },
      {
        $set: {
          activeLessons: [],
          completedLessons: [],
          lessonTimers: {},
          assignedUnitIds: [],
        },
      },
    );
    console.log(`✅ Lesson data cleared`);

    // Delete all lesson timers for this student
    console.log(`\n🔄 [STEP 4] Deleting lesson timers...`);
    const timerDeleteResult = await lessonTimersCollection.deleteMany({
      studentId: decodedStudentName,
    });
    console.log(`✅ Deleted ${timerDeleteResult.deletedCount} lesson timers`);

    // Delete all message threads involving this student
    console.log(`\n🔄 [STEP 5] Deleting message threads...`);
    const threadDeleteResult = await threadsCollection.deleteMany({
      participants: decodedStudentName,
    });
    console.log(
      `✅ Deleted ${threadDeleteResult.deletedCount} message threads`,
    );

    // Debug: Verify cleanup
    console.log(`\n📋 [DEBUG] Checking student account AFTER cleanup...`);
    const studentAfter = await profilesCollection.findOne({
      memberName: decodedStudentName,
    });
    console.log(
      `  Checking bills: ${studentAfter.checkingAccount.bills.length}`,
    );
    console.log(
      `  Checking payments: ${studentAfter.checkingAccount.payments.length}`,
    );
    console.log(
      `  Checking transactions: ${studentAfter.checkingAccount.transactions.length}`,
    );
    console.log(
      `  Checking movementsDates: ${studentAfter.checkingAccount.movementsDates.length}`,
    );
    console.log(`  Savings bills: ${studentAfter.savingsAccount.bills.length}`);
    console.log(
      `  Savings transactions: ${studentAfter.savingsAccount.transactions.length}`,
    );
    console.log(
      `  Savings movementsDates: ${studentAfter.savingsAccount.movementsDates.length}`,
    );
    console.log(
      `  Active lessons: ${
        Array.isArray(studentAfter.activeLessons)
          ? studentAfter.activeLessons.length
          : 0
      }`,
    );

    console.log("=".repeat(80) + "\n");

    // Emit socket event to notify the student to refresh their UI
    const studentSocket = userSockets.get(decodedStudentName);
    if (studentSocket) {
      console.log(
        `📡 Emitting sampleDataCleanupComplete to ${decodedStudentName}`,
      );
      studentSocket.emit("sampleDataCleanupComplete", {
        studentName: decodedStudentName,
        accountsCleared: true,
        lessonsCleared: true,
        threadsDeleted: threadDeleteResult.deletedCount,
      });
    } else {
      console.log(`⚠️ Student socket not found for: ${decodedStudentName}`);
    }

    res.status(200).json({
      success: true,
      message: `Sample student data cleaned up for ${decodedStudentName}`,
      accountsCleared: true,
      lessonsCleared: true,
      threadsDeleted: threadDeleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Error during sample student cleanup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup sample student data: " + error.message,
    });
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

// Get student financial profiles for class health dashboard
app.get("/students/profiles/:teacherUsername", async (req, res) => {
  try {
    const { teacherUsername } = req.params;

    console.log(
      "Fetching student profiles for teacher username:",
      teacherUsername,
    );

    // First, find the teacher's name from the Teachers collection
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teacherUsername });

    if (!teacherDoc) {
      console.log("Teacher not found for username:", teacherUsername);
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
        details: `No teacher found with username: ${teacherUsername}`,
      });
    }

    const teacherName = teacherDoc.name;
    console.log("Found teacher name:", teacherName);

    // Find all students assigned to this teacher using the teacher's name
    const studentProfiles = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({
        teacher: teacherDoc.name, // Use teacher's name, not username
        role: { $ne: "teacher" }, // Exclude teacher profiles
      })
      .project({
        // Include only necessary fields for health calculation
        username: 1,
        firstName: 1,
        lastName: 1,
        memberName: 1, // Include memberName for display
        classPeriod: 1,
        teacher: 1,
        checkingAccount: 1,
        savingsAccount: 1,
        loan: 1,
        income: 1,
        grade: 1,
        bills: 1,
        debt: 1,
        emergencyFund: 1,
        // Include lesson completion data for academic health
        totalLessonsCompleted: 1,
        lessonsCompleted: 1, // Legacy field
        averageScore: 1,
        totalScore: 1,
        completedLessons: 1,
        lastLessonCompleted: 1,
        lastActivity: 1,
      })
      .toArray();

    console.log(
      `Found ${studentProfiles.length} student profiles for teacher ${teacherName} (username: ${teacherUsername})`,
    );

    // Calculate health metrics for each student
    const studentsWithHealth = studentProfiles.map((student) => {
      const health = calculateStudentHealth(student);
      return {
        ...student,
        health: health,
      };
    });

    res.json({
      success: true,
      students: studentsWithHealth,
      count: studentsWithHealth.length,
    });
  } catch (error) {
    console.error("Error fetching student profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch student profiles",
      details: error.message,
    });
  }
});

// Get real-time class health update for a specific teacher
app.get("/class-health/:teacherUsername", async (req, res) => {
  try {
    const { teacherUsername } = req.params;

    console.log(
      `🏥 Fetching real-time class health for teacher: ${teacherUsername}`,
    );

    // Find the teacher's name from the Teachers collection
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teacherUsername });

    if (!teacherDoc) {
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
      });
    }

    const teacherName = teacherDoc.name;

    // Get all students for this teacher
    const students = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({
        teacher: teacherName,
        role: { $ne: "teacher" },
      })
      .toArray();

    // Calculate health metrics for each student and class averages
    const studentsWithHealth = students.map((student) => {
      const health = calculateStudentHealth(student);
      return {
        memberName: student.memberName,
        firstName: student.firstName || student.memberName?.split(" ")[0] || "",
        lastName: student.lastName || student.memberName?.split(" ")[1] || "",
        classPeriod: student.classPeriod,
        grade: student.grade || "F",
        health: health,
        totalLessonsCompleted: student.totalLessonsCompleted ?? 0,
        averageScore: student.averageScore ?? 0,
        lastActivity: student.lastActivity ?? student.lastLessonCompleted,
      };
    });

    // Calculate class averages
    const classStats = {
      totalStudents: studentsWithHealth.length,
      averageFinancialHealth: 0,
      averageAcademicHealth: 0,
      averageOverallHealth: 0,
      totalLessonsCompleted: 0,
      averageClassScore: 0,
      healthDistribution: {
        Excellent: 0,
        Good: 0,
        Fair: 0,
        Poor: 0,
        Critical: 0,
      },
      recentActivity: 0, // Students active in last 7 days
    };

    if (studentsWithHealth.length > 0) {
      const totalFinancial = studentsWithHealth.reduce(
        (sum, student) => sum + student.health.financial,
        0,
      );
      const totalAcademic = studentsWithHealth.reduce(
        (sum, student) => sum + student.health.academic,
        0,
      );
      const totalOverall = studentsWithHealth.reduce(
        (sum, student) => sum + student.health.overall,
        0,
      );
      const totalLessons = studentsWithHealth.reduce(
        (sum, student) => sum + student.totalLessonsCompleted,
        0,
      );
      const totalScores = studentsWithHealth.reduce(
        (sum, student) => sum + (student.averageScore || 0),
        0,
      );

      classStats.averageFinancialHealth = Math.round(
        totalFinancial / studentsWithHealth.length,
      );
      classStats.averageAcademicHealth = Math.round(
        totalAcademic / studentsWithHealth.length,
      );
      classStats.averageOverallHealth = Math.round(
        totalOverall / studentsWithHealth.length,
      );
      classStats.totalLessonsCompleted = totalLessons;
      classStats.averageClassScore = Math.round(
        totalScores / studentsWithHealth.length,
      );

      // Count health status distribution
      studentsWithHealth.forEach((student) => {
        classStats.healthDistribution[student.health.status]++;
      });

      // Count recent activity (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      classStats.recentActivity = studentsWithHealth.filter((student) => {
        if (!student.lastActivity) return false;
        return new Date(student.lastActivity) > sevenDaysAgo;
      }).length;
    }

    console.log(
      `📊 Class health calculated for ${studentsWithHealth.length} students`,
    );

    res.json({
      success: true,
      teacherName: teacherName,
      teacherUsername: teacherUsername,
      students: studentsWithHealth,
      classStats: classStats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("❌ Error fetching class health:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch class health data",
      details: error.message,
    });
  }
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

// Endpoint to create a new thread
app.post("/newThread", async (req, res) => {
  try {
    const { participants } = req.body;

    if (!participants || participants.length < 2) {
      return res
        .status(400)
        .json({ error: "A thread requires at least two participants." });
    }

    // Create a canonical threadId by sorting participants
    const sortedParticipants = participants.sort();
    const threadId = sortedParticipants.join("_");

    // Check if thread already exists
    const existingThread = await client
      .db("TrinityCapital")
      .collection("threads")
      .findOne({ threadId: threadId });

    if (existingThread) {
      return res
        .status(200)
        .json({ message: "Thread already exists.", thread: existingThread });
    }

    // Create new thread object
    const newThread = {
      threadId: threadId,
      type: "private",
      participants: sortedParticipants,
      messages: [],
      createdAt: new Date(),
      lastMessageTimestamp: new Date(),
    };

    // Insert the new thread into the database
    await client
      .db("TrinityCapital")
      .collection("threads")
      .insertOne(newThread);

    // Emit an event to notify clients (optional, but good for real-time updates)
    // Notify both participants that a new thread has been created
    sortedParticipants.forEach((participantId) => {
      const userSocket = userSockets.get(participantId);
      if (userSocket) {
        userSocket.emit("threadCreated", newThread);
      }
    });

    res
      .status(201)
      .json({ message: "Thread created successfully.", thread: newThread });
  } catch (error) {
    console.error("Error creating new thread:", error);
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
        error: `Missing teacherUsername, teacherEmail, or periods. Received: teacherUsername=${teacherUsername}, teacherEmail=${teacherEmail}, periods=${JSON.stringify(periods)}`,
      });
    }

    console.log("Searching for teacherUsername:", teacherUsername);
    // 1. Get teacher's state, school, and access code from Teachers collection
    const teacher = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: teacherUsername });
    console.log("Teacher lookup result:", teacher);
    console.log(
      "Teacher fields available:",
      teacher ? Object.keys(teacher) : "No teacher found",
    );

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // 2. Decrypt the teacher's access code (stored encrypted as AES-256-CBC in the accessCode field)
    console.log("Decrypting teacher's access code...");
    console.log("  teacher.accessCode:", teacher.accessCode);

    let licenseNumber = "00000000";
    if (!teacher.accessCode) {
      console.warn("No accessCode found for teacher:", teacherUsername);
      return res.status(400).json({
        error: "Teacher has no access code. Contact admin to verify licensing.",
      });
    }

    try {
      // Decrypt the AES-256-CBC encrypted code
      const decryptedAccessCode = decrypt(teacher.accessCode);
      console.log(
        "✅ Successfully decrypted access code:",
        decryptedAccessCode,
      );

      // Extract first 8 characters as the license number (e.g., "23A442C4" from "US-NMHS-23A442C4-01")
      licenseNumber = decryptedAccessCode.substring(0, 8).toUpperCase();
      console.log("License number extracted:", licenseNumber);
    } catch (decryptError) {
      console.error("❌ Failed to decrypt access code:", decryptError.message);
      console.error("Encrypted code was:", teacher.accessCode);
      return res.status(500).json({
        error: "Failed to decrypt teacher access code",
        details: decryptError.message,
      });
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
        { username: teacherUsername },
        { $set: { classPeriods: periods } },
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
      firstName: student.firstName || student.memberName?.split(" ")[0] || "",
      lastName: student.lastName || student.memberName?.split(" ")[1] || "",
      checkingBalance: student.checkingAccount?.balanceTotal ?? 0,
      savingsBalance: student.savingsAccount?.balanceTotal ?? 0,
      grade: student.grade ?? "F",
      lessonsCompleted:
        student.totalLessonsCompleted ?? student.lessonsCompleted ?? 0,
      totalLessonsCompleted: student.totalLessonsCompleted ?? 0,
      averageScore: student.averageScore ?? 0,
      totalScore: student.totalScore ?? 0,
      lastLessonCompleted: student.lastLessonCompleted ?? null,
      lastActivity: student.lastActivity ?? null,
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
    const { sender, recipients, cc, subject, message } = req.body;
    // Look up teacher's OAuth2 credentials
    const teacherDoc = await client
      .db("TrinityCapital")
      .collection("Teachers")
      .findOne({ username: sender });
    console.log("SEND EMAIL DEBUG:");
    console.log("  sender (username):", sender);
    console.log("  recipients:", recipients);
    console.log("  cc:", cc);
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
        cc, // Pass CC parameter
        finalSubject,
        message,
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
  cc,
  subject,
  body,
) {
  const { google } = require("googleapis");
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH2_REDIRECT_URI,
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  // Build RFC822 message
  const messageParts = [`From: "Teacher" <${teacherEmail}>`, `To: ${to}`];

  // Add CC if provided
  if (cc && cc.trim()) {
    messageParts.push(`Cc: ${cc}`);
  }

  messageParts.push(
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  );
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
        "Failed to send email via Gmail API",
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
        { upsert: true },
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
        { upsert: true },
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
        { upsert: true },
      );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save group" });
  }
});

// --- NEW ENDPOINTS FOR UNIT ASSIGNMENT ---

// Get all students for admin unit assignment
app.get("/allStudents", async (req, res) => {
  try {
    console.log("Fetching all students for admin unit assignment");

    const allStudents = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({ type: { $ne: "teacher" } }) // Exclude teacher profiles
      .project({ _id: 1, memberName: 1, username: 1 })
      .toArray();

    // Return array of student IDs/usernames for assignment
    const studentIds = allStudents.map(
      (student) => student._id || student.username || student.memberName,
    );

    console.log(`Found ${studentIds.length} students for admin assignment`);
    res.json(studentIds);
  } catch (error) {
    console.error("Error fetching all students:", error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

// Get students in a specific period
app.get("/studentsInPeriod/:period", async (req, res) => {
  try {
    const { period } = req.params;
    const periodNumber = parseInt(period, 10);

    console.log(`Fetching students in period ${periodNumber}`);

    const studentsInPeriod = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({
        classPeriod: periodNumber,
        type: { $ne: "teacher" }, // Exclude teacher profiles
      })
      .project({ _id: 1, memberName: 1, username: 1 })
      .toArray();

    // Return array of student IDs/usernames for assignment
    const studentIds = studentsInPeriod.map(
      (student) => student._id || student.username || student.memberName,
    );

    console.log(
      `Found ${studentIds.length} students in period ${periodNumber}`,
    );
    res.json(studentIds);
  } catch (error) {
    console.error("Error fetching students in period:", error);
    res.status(500).json({ error: "Failed to fetch students in period" });
  }
});

// Get all assigned units with full lesson content for a student
app.get("/student/:studentId/assignedUnits", async (req, res) => {
  try {
    const { studentId } = req.params;

    console.log(`=== GET /student/${studentId}/assignedUnits ===`);
    console.log("Request received at:", new Date().toISOString());
    console.log("Student ID:", studentId);

    // Check if MongoDB client is connected
    if (!client) {
      console.error("MongoDB client is not initialized");
      return res.status(500).json({
        success: false,
        error: "Database connection not available",
      });
    }

    console.log("MongoDB client is available, searching for student...");

    // Find the student profile
    const studentProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({
        $or: [
          { _id: studentId },
          { username: studentId },
          { memberName: studentId },
        ],
      });

    if (!studentProfile) {
      console.log(`Student not found in database: ${studentId}`);
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    // Check both old and new assignment systems
    const oldAssignedUnits = studentProfile.assignedUnits || [];
    const newAssignedUnitIds = studentProfile.assignedUnitIds || [];

    console.log(
      `Found ${oldAssignedUnits.length} old assigned units and ${newAssignedUnitIds.length} new ObjectID-based units for student`,
    );

    // Process old system units first
    const enrichedUnits = [];

    for (const unit of oldAssignedUnits) {
      console.log(
        `Processing OLD unit: ${unit.name} (${unit.value}) assigned by ${unit.assignedBy}`,
      );

      try {
        // Fetch fresh lesson content from the lesson server
        const lessonServerResponse = await fetch(
          `http://localhost:4000/lessons/${unit.assignedBy}`,
        );

        if (lessonServerResponse.ok) {
          const lessonData = await lessonServerResponse.json();
          if (lessonData.success && lessonData.units) {
            const fullUnit = lessonData.units.find(
              (u) => u.value === unit.value,
            );
            if (fullUnit && fullUnit.lessons) {
              // Create enriched unit with complete lesson data
              const enrichedUnit = {
                ...unit,
                lessons: fullUnit.lessons, // Full lesson objects with lesson_blocks and conditions
              };
              enrichedUnits.push(enrichedUnit);
              console.log(
                `✅ Enriched unit ${unit.name} with ${fullUnit.lessons.length} complete lessons`,
              );
            } else {
              console.warn(
                `Unit ${unit.value} not found in lesson server data`,
              );
              enrichedUnits.push(unit); // Keep original unit if no enrichment possible
            }
          } else {
            console.warn(
              `No units data from lesson server for ${unit.assignedBy}`,
            );
            enrichedUnits.push(unit);
          }
        } else {
          console.warn(
            `Could not fetch lesson content from lesson server for unit ${unit.value}`,
          );
          enrichedUnits.push(unit);
        }
      } catch (error) {
        console.warn(
          `Error fetching lesson content for unit ${unit.value}:`,
          error.message,
        );
        enrichedUnits.push(unit); // Keep original unit on error
      }
    }

    // Process NEW ObjectID-based system units
    if (newAssignedUnitIds.length > 0) {
      console.log(
        `Processing ${newAssignedUnitIds.length} NEW ObjectID-based units...`,
      );

      // Get all lesson IDs from all assigned units
      const allLessonIds = [];

      newAssignedUnitIds.forEach((unitAssignment) => {
        if (
          unitAssignment.lessonIds &&
          Array.isArray(unitAssignment.lessonIds)
        ) {
          allLessonIds.push(...unitAssignment.lessonIds);
          console.log(
            `Unit "${unitAssignment.unitName}" contributes ${unitAssignment.lessonIds.length} lesson IDs`,
          );
        }
      });

      // Remove duplicates and convert to ObjectIds
      const uniqueLessonIds = [...new Set(allLessonIds)];
      console.log(`Total unique lesson ObjectIDs: ${uniqueLessonIds.length}`);

      if (uniqueLessonIds.length > 0) {
        try {
          console.log(
            `Querying lessons with IDs: ${uniqueLessonIds.slice(0, 3).join(", ")}...`,
          );

          // Try both numeric and ObjectId formats for lesson lookup
          const { ObjectId } = require("mongodb");
          let lessons = [];

          // First try numeric IDs (Dallas Fed lessons)
          const numericIds = uniqueLessonIds
            .map((id) => {
              const parsed = parseInt(id);
              return isNaN(parsed) ? null : parsed;
            })
            .filter((id) => id !== null);

          if (numericIds.length > 0) {
            console.log(
              `Trying numeric IDs: ${numericIds.slice(0, 3).join(", ")}...`,
            );
            const numericLessons = await client
              .db("TrinityCapital")
              .collection("Lessons")
              .find({ _id: { $in: numericIds } })
              .toArray();
            lessons.push(...numericLessons);
            console.log(
              `Found ${numericLessons.length} lessons with numeric IDs`,
            );
          }

          // Then try ObjectId format for any remaining IDs
          const objectIds = uniqueLessonIds
            .map((id) => {
              try {
                return new ObjectId(id);
              } catch (error) {
                return null;
              }
            })
            .filter((id) => id !== null);

          if (objectIds.length > 0) {
            console.log(
              `Trying ObjectId format for ${objectIds.length} IDs...`,
            );
            const objectIdLessons = await client
              .db("TrinityCapital")
              .collection("Lessons")
              .find({ _id: { $in: objectIds } })
              .toArray();
            lessons.push(...objectIdLessons);
            console.log(
              `Found ${objectIdLessons.length} lessons with ObjectId format`,
            );
          }

          console.log(
            `Fetched ${lessons.length} lesson documents from database`,
          );

          // Create a lookup map for lessons (handle both numeric and ObjectId keys)
          const lessonLookup = {};
          lessons.forEach((lessonDoc) => {
            const docId = lessonDoc._id;
            // Store by both string representation and original format
            lessonLookup[docId.toString()] = lessonDoc;
            lessonLookup[docId] = lessonDoc;
          });

          console.log(`Created lesson lookup with ${lessons.length} lessons`);

          // Build units with lesson content for the new system
          newAssignedUnitIds.forEach((unitAssignment) => {
            const unitLessons = (unitAssignment.lessonIds || [])
              .map((lessonId) => {
                // Try different lookup strategies
                let lessonDoc =
                  lessonLookup[lessonId] || lessonLookup[parseInt(lessonId)];

                if (lessonDoc) {
                  // Handle both old and new lesson data structures
                  const lessonData = lessonDoc.lesson || lessonDoc;

                  // Use the existing content structure that the user created
                  const introBlocks = lessonData.intro_text_blocks || [];
                  const lessonBlocks = lessonData.lesson_blocks || [];
                  const contentArray = lessonData.content || [];

                  return {
                    lesson_title:
                      lessonData.lesson_title ||
                      lessonData.title ||
                      "Untitled Lesson",
                    intro_text_blocks: introBlocks,
                    lesson_blocks: lessonBlocks,
                    content: contentArray, // Preserve the user's content array
                    lesson_conditions:
                      lessonData.lesson_conditions ||
                      lessonData.conditions ||
                      [],
                    _id: lessonDoc._id.toString(),
                  };
                } else {
                  console.warn(`Lesson not found for ID: ${lessonId}`);
                  return null;
                }
              })
              .filter((lesson) => lesson !== null);

            // Create enriched unit for the new system
            const enrichedNewUnit = {
              unitName: unitAssignment.unitName || unitAssignment.unit,
              unitValue: unitAssignment.unitId || unitAssignment.unitValue,
              assignedBy:
                unitAssignment.teacherName || unitAssignment.assignedBy,
              assignedAt: unitAssignment.assignedAt || new Date().toISOString(),
              lessons: unitLessons,
              assignmentType: "objectId-based",
              classPeriod: unitAssignment.classPeriod,
            };

            enrichedUnits.push(enrichedNewUnit);
            console.log(
              `✅ Added ObjectID-based unit "${unitAssignment.unitName}" with ${unitLessons.length} lessons`,
            );
          });
        } catch (error) {
          console.error("Error processing ObjectID-based units:", error);
        }
      }
    }

    console.log(
      `✅ Successfully enriched ${enrichedUnits.length} total units (old + new systems) with complete lesson data`,
    );

    res.json({
      success: true,
      studentId: studentId,
      assignedUnits: enrichedUnits,
      message: `Found ${enrichedUnits.length} assigned units with complete lesson content`,
    });
  } catch (error) {
    console.error("Error fetching student assigned units:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch assigned units",
    });
  }
});

// NEW: Get student's lessons using ObjectID references
app.get("/student-lessons-by-ids/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    console.log(
      `--- Fetching ObjectID-based lessons for student: ${studentId} ---`,
    );

    // Get student profile
    const studentProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({
        $or: [
          { _id: studentId },
          { username: studentId },
          { memberName: studentId },
        ],
      });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    console.log(`Found student: ${studentProfile.memberName || studentId}`);

    // Get lesson ObjectIDs from new ObjectID-based assignments
    let allLessonIds = [];
    if (
      studentProfile.assignedUnitIds &&
      studentProfile.assignedUnitIds.length > 0
    ) {
      console.log(
        `Student has ${studentProfile.assignedUnitIds.length} ObjectID-based unit assignments`,
      );

      studentProfile.assignedUnitIds.forEach((unitAssignment) => {
        if (
          unitAssignment.lessonIds &&
          Array.isArray(unitAssignment.lessonIds)
        ) {
          allLessonIds.push(...unitAssignment.lessonIds);
          console.log(
            `Unit "${unitAssignment.unitName}" contributes ${unitAssignment.lessonIds.length} lesson IDs`,
          );
        }
      });
    }

    // Remove duplicates
    const uniqueLessonIds = [...new Set(allLessonIds)];
    console.log(`Total unique lesson ObjectIDs: ${uniqueLessonIds.length}`);

    if (uniqueLessonIds.length === 0) {
      return res.json({
        success: true,
        lessons: [],
        message: "No lessons assigned to this student via ObjectID system",
        assignmentType: "objectId-based",
      });
    }

    // Fetch lesson content from lesson server using ObjectIDs
    try {
      console.log(`🔗 Requesting lesson content from lesson server...`);
      const lessonServerResponse = await fetch(
        "http://localhost:4000/get-lessons-by-ids",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lessonIds: uniqueLessonIds,
            studentName: studentProfile.memberName || studentId,
          }),
        },
      );

      if (lessonServerResponse.ok) {
        const lessonData = await lessonServerResponse.json();

        if (lessonData.success) {
          console.log(
            `✅ Retrieved ${lessonData.lessons.length} lessons from lesson server`,
          );

          // Log lesson content summary
          console.log("--- Retrieved Lesson Summary ---");
          lessonData.lessons.forEach((lesson, index) => {
            console.log(`${index + 1}. ${lesson.lesson_title}`);
            console.log(
              `   - Blocks: ${lesson.lesson_blocks ? lesson.lesson_blocks.length : 0}`,
            );
            console.log(
              `   - Conditions: ${lesson.lesson_conditions ? lesson.lesson_conditions.length : 0}`,
            );
          });

          return res.json({
            success: true,
            lessons: lessonData.lessons,
            requestedIds: uniqueLessonIds.length,
            retrievedCount: lessonData.lessons.length,
            assignmentType: "objectId-based",
            message: `Retrieved ${lessonData.lessons.length} lessons using ObjectID references`,
          });
        } else {
          console.error("Lesson server returned error:", lessonData.message);
          return res.status(500).json({
            success: false,
            message: "Failed to retrieve lesson content: " + lessonData.message,
          });
        }
      } else {
        console.error(
          `Lesson server responded with status: ${lessonServerResponse.status}`,
        );
        return res.status(500).json({
          success: false,
          message: "Failed to contact lesson server",
        });
      }
    } catch (error) {
      console.error("Error fetching lessons from lesson server:", error);
      return res.status(500).json({
        success: false,
        message: "Error communicating with lesson server: " + error.message,
      });
    }
  } catch (error) {
    console.error("Error fetching student lessons by IDs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student lessons: " + error.message,
    });
  }
});

// Assign unit to individual student (NEW ObjectID-based system)
app.post("/assignUnitToStudent", async (req, res) => {
  try {
    const { studentId, unitId, unitName, assignedBy } = req.body;

    console.log(`--- NEW ObjectID-based Unit Assignment ---`);
    console.log(
      `Assigning unit "${unitName}" (${unitId}) to student ${studentId} by ${assignedBy}`,
    );

    // Fetch the unit structure from the lesson server to get lesson ObjectIDs
    let lessonIds = [];
    try {
      console.log(
        `🔍 Fetching unit structure from lesson server for unit ${unitId}...`,
      );
      const lessonServerResponse = await fetch(
        `http://localhost:4000/lessons/${assignedBy}`,
      );
      if (lessonServerResponse.ok) {
        const lessonData = await lessonServerResponse.json();
        console.log(`📋 Lesson server response for ${assignedBy}:`, {
          success: lessonData.success,
          unitsCount: lessonData.units ? lessonData.units.length : 0,
        });

        if (lessonData.success && lessonData.units) {
          const targetUnit = lessonData.units.find(
            (unit) => unit.value === unitId,
          );
          if (targetUnit && targetUnit.lessons) {
            // Create a lookup map from lesson titles to ObjectIDs from the lessons array
            const lessonLookup = {};
            if (lessonData.lessons && Array.isArray(lessonData.lessons)) {
              lessonData.lessons.forEach((lesson) => {
                if (lesson._id && lesson.lesson_title) {
                  lessonLookup[lesson.lesson_title] = lesson._id;
                }
              });
              console.log(
                `📚 Available lessons with ObjectIDs: ${Object.keys(lessonLookup).length}`,
              );
            }

            // Extract ObjectIDs by matching lesson titles
            lessonIds = targetUnit.lessons
              .map((lesson) => {
                if (lesson._id) {
                  // Lesson already has proper ObjectID (Units 2-5)
                  console.log(
                    `✅ Direct ObjectID: ${lesson.lesson_title} -> ${lesson._id}`,
                  );
                  return lesson._id;
                } else if (
                  lesson.lesson_title &&
                  lessonLookup[lesson.lesson_title]
                ) {
                  // Find ObjectID by matching lesson title (Unit 1)
                  const objectId = lessonLookup[lesson.lesson_title];
                  console.log(
                    `🔗 Matched by title: ${lesson.lesson_title} -> ${objectId}`,
                  );
                  return objectId;
                } else {
                  console.warn(
                    `⚠️ No ObjectID found for lesson: ${lesson.lesson_title || "Unknown"}`,
                  );
                  return null;
                }
              })
              .filter((id) => id); // Remove any null/undefined IDs
            console.log(
              `✅ Found ${lessonIds.length} lesson ObjectIDs for unit ${unitName}`,
            );
            console.log(`� Lesson ObjectIDs:`, lessonIds);
          } else {
            console.warn(
              `⚠️ Unit ${unitId} not found or has no lessons in teacher data`,
            );
          }
        } else {
          console.warn(`⚠️ Invalid lesson server response structure`);
        }
      } else {
        console.warn(
          `Could not fetch unit structure from lesson server for unit ${unitId}: ${lessonServerResponse.status}`,
        );
      }
    } catch (error) {
      console.warn(
        `Error fetching unit structure for unit ${unitId}:`,
        error.message,
      );
    }

    // Create ObjectID-based unit assignment
    const unitAssignment = {
      unitId: unitId,
      unitName: unitName,
      assignedBy: assignedBy,
      assignedAt: new Date(),
      lessonIds: lessonIds, // Store only ObjectIDs, not full content
      assignmentType: "objectId-based",
    };

    console.log(`📦 ObjectID-based unit assignment created:`, {
      unitId: unitAssignment.unitId,
      unitName: unitAssignment.unitName,
      assignedBy: unitAssignment.assignedBy,
      lessonIdsCount: unitAssignment.lessonIds.length,
      assignmentType: unitAssignment.assignmentType,
    });

    // Update student profile with ObjectID-based assignment
    // Handle studentId that might be an ObjectId string, numeric ID, or username
    const { ObjectId } = require("mongodb");
    let query = {};

    try {
      // Try as ObjectId first
      if (studentId.match(/^[0-9a-f]{24}$/i)) {
        query = { _id: new ObjectId(studentId) };
      } else {
        // Try as numeric ID or username
        const numericId = parseInt(studentId, 10);
        if (!isNaN(numericId)) {
          query = { _id: numericId };
        } else {
          query = {
            $or: [{ username: studentId }, { memberName: studentId }],
          };
        }
      }
    } catch (e) {
      // If ObjectId conversion fails, try as string fields
      query = {
        $or: [{ username: studentId }, { memberName: studentId }],
      };
    }

    console.log(`🔍 Searching for student with query:`, query);

    const updateResult = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .updateOne(query, {
        $addToSet: { assignedUnitIds: unitAssignment }, // New field for ObjectID-based assignments
      });

    if (updateResult.matchedCount === 0) {
      console.log(`❌ Student not found: ${studentId}`);
      console.log(`   Query attempted:`, query);
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    console.log(
      `✅ Successfully assigned unit with ${lessonIds.length} lesson ObjectIDs to student ${studentId}`,
    );
    console.log(
      `🔗 Assignment uses ObjectID references instead of full lesson content`,
    );

    // Emit socket event to notify student app of new unit assignment
    io.emit("unitAssignedToStudent", {
      studentId: studentId,
      unitId: unitId,
      unitName: unitName,
      assignedBy: assignedBy,
      unitAssignment: unitAssignment,
      assignmentType: "objectId-based",
    });

    res.json({
      success: true,
      message: "Unit assigned successfully using ObjectID references",
      unitAssignment: unitAssignment,
      lessonIdsIncluded: lessonIds.length,
      assignmentType: "objectId-based",
    });
  } catch (error) {
    console.error("Error assigning unit to student:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign unit to student",
    });
  }
});

// Get bill information for a student
app.get("/getBillInfo/:memberName", async (req, res) => {
  try {
    const { memberName } = req.params;
    console.log(`Fetching bill info for: ${memberName}`);

    // Connect to MongoDB if not already connected
    if (!client) {
      await connectToMongoDB();
    }

    // Find the student's profile to get their bill information
    const studentProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ memberName: memberName });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    // Return bill vendors/payees (you may need to adjust this based on your schema)
    const billInfo = {
      success: true,
      bills: studentProfile.bills || [],
      vendors: [
        "Electricity Co.",
        "Water Utility",
        "Internet Provider",
        "Phone Company",
      ],
    };

    res.json(billInfo);
  } catch (error) {
    console.error("Error fetching bill info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bill information",
      details: error.message,
    });
  }
});

// Get classmates for a student
app.get("/classmates/:memberName", async (req, res) => {
  try {
    const { memberName } = req.params;
    console.log(`Fetching classmates for: ${memberName}`);

    // Connect to MongoDB if not already connected
    if (!client) {
      await connectToMongoDB();
    }

    // Find the student's profile to get their class/teacher information
    const studentProfile = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .findOne({ memberName: memberName });

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    // Find other students with the same teacher (classmates)
    const classmates = await client
      .db("TrinityCapital")
      .collection("User Profiles")
      .find({
        teacher: studentProfile.teacher,
        memberName: { $ne: memberName }, // Exclude the requesting student
      })
      .project({ memberName: 1, _id: 0 })
      .toArray();

    const classmateNames = classmates.map((classmate) => classmate.memberName);

    res.json({
      success: true,
      classmates: classmateNames,
      teacher: studentProfile.teacher, // Include the teacher's name
    });
  } catch (error) {
    console.error("Error fetching classmates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch classmates",
      details: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      server: "running",
      database: "connected",
      port: port,
    },
    version: "1.0.0",
  });
});

/*****************************************UPDATE MANAGEMENT***************************************************/

// Track update status globally
let updateStatus = {
  isUpdating: false,
  progress: 0,
  message: "Idle",
  startTime: null,
};

// Connected clients for update notifications
const updateClients = new Set();

// Endpoint to show update screen
app.get("/update-screen", (req, res) => {
  res.sendFile(__dirname + "/Frontend/updateScreen.html");
});

// Endpoint to trigger an update (can be called by GitHub webhook or admin panel)
app.post("/trigger-update", async (req, res) => {
  try {
    const { progress, message } = req.body;

    if (updateStatus.isUpdating && progress === 0) {
      // Update already in progress
      return res.status(409).json({
        error: "Update already in progress",
        currentProgress: updateStatus.progress,
      });
    }

    // Start update
    if (!updateStatus.isUpdating) {
      updateStatus.isUpdating = true;
      updateStatus.startTime = new Date();
      console.log(
        "🔄 UPDATE TRIGGERED: Starting Trinity Capital update process",
      );

      // Notify all connected clients
      io.emit("update-start", {
        message: "Update initiated",
        timestamp: new Date().toISOString(),
      });

      // Simulate update process if no progress provided
      if (!progress) {
        simulateUpdate();
      }
    }

    // Update progress if provided
    if (progress !== undefined) {
      updateStatus.progress = Math.min(progress, 99); // Cap at 99 until completion
      if (message) {
        updateStatus.message = message;
      }

      // Notify clients of progress
      io.emit("update-progress", {
        progress: updateStatus.progress,
        message: updateStatus.message,
      });
    }

    res.json({
      success: true,
      message: "Update triggered",
      status: updateStatus,
    });
  } catch (error) {
    console.error("Error triggering update:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to complete update
app.post("/complete-update", (req, res) => {
  try {
    if (!updateStatus.isUpdating) {
      return res.status(400).json({ error: "No update in progress" });
    }

    updateStatus.progress = 100;
    updateStatus.message = "Update complete";

    console.log("✅ UPDATE COMPLETE: Trinity Capital successfully updated");

    // Notify all clients
    io.emit("update-complete", {
      message: "Update completed successfully",
      duration: Date.now() - updateStatus.startTime,
    });

    // Reset update status
    setTimeout(() => {
      updateStatus.isUpdating = false;
      updateStatus.progress = 0;
      updateStatus.message = "Idle";
      updateStatus.startTime = null;
    }, 2000);

    res.json({
      success: true,
      message: "Update completed",
      duration: Date.now() - updateStatus.startTime,
    });
  } catch (error) {
    console.error("Error completing update:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get current update status
app.get("/update-status", (req, res) => {
  res.json({
    isUpdating: updateStatus.isUpdating,
    progress: updateStatus.progress,
    message: updateStatus.message,
    startTime: updateStatus.startTime,
  });
});

// Middleware to redirect all requests to update screen if updating
app.use((req, res, next) => {
  // Don't redirect these routes
  const bypassRoutes = [
    "/update-screen",
    "/update-status",
    "/trigger-update",
    "/complete-update",
    "/health",
    "/api/",
  ];

  const shouldBypass = bypassRoutes.some((route) => req.path.startsWith(route));

  if (updateStatus.isUpdating && !shouldBypass && req.method === "GET") {
    return res.redirect("/update-screen");
  }

  next();
});

// Simulate update process (for demo/testing)
function simulateUpdate() {
  const stages = [
    { delay: 1000, progress: 15, message: "Downloading latest version" },
    { delay: 2000, progress: 35, message: "Extracting files" },
    { delay: 2000, progress: 55, message: "Installing dependencies" },
    { delay: 1500, progress: 75, message: "Finalizing update" },
    { delay: 1500, progress: 90, message: "Restarting server" },
    { delay: 2000, progress: 100, message: "Update complete" },
  ];

  let currentDelay = 0;

  stages.forEach((stage) => {
    currentDelay += stage.delay;
    setTimeout(() => {
      updateStatus.progress = stage.progress;
      updateStatus.message = stage.message;

      io.emit("update-progress", {
        progress: updateStatus.progress,
        message: updateStatus.message,
      });

      if (stage.progress === 100) {
        setTimeout(() => {
          updateStatus.isUpdating = false;
          io.emit("update-complete", {
            message: "Update completed successfully",
            duration: Date.now() - updateStatus.startTime,
          });
        }, 1000);
      }
    }, currentDelay);
  });
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
