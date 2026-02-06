/**
 * GitHub Webhook Handler for Trinity Capital Updates
 *
 * This script listens for GitHub push events and triggers the update screen
 * when new code is pushed to your repository.
 *
 * SETUP INSTRUCTIONS:
 * 1. In your GitHub repository, go to Settings > Webhooks
 * 2. Click "Add webhook"
 * 3. Set Payload URL to: https://yourdomain.com/github-webhook
 * 4. Set Content type to: application/json
 * 5. Select "Just the push event"
 * 6. Set Secret to the value of GITHUB_WEBHOOK_SECRET in your .env
 * 7. Click "Add webhook"
 */

const crypto = require("crypto");
const express = require("express");
const axios = require("axios");

/**
 * Middleware to verify GitHub webhook signature
 * @param {string} secret - The webhook secret from GitHub
 * @returns {Function} Express middleware
 */
function verifyGitHubSignature(secret) {
  return (req, res, next) => {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature) {
      console.warn("⚠️ GitHub webhook received without signature");
      return res.status(401).json({ error: "Missing signature" });
    }

    const hash = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    const expected = `sha256=${hash}`;

    if (!crypto.timingSafeEqual(expected, signature)) {
      console.warn("❌ GitHub webhook signature verification failed");
      return res.status(401).json({ error: "Invalid signature" });
    }

    next();
  };
}

/**
 * Setup GitHub webhook endpoint
 * @param {Express.Application} app - Express application instance
 * @param {string} webhookSecret - Secret from .env GITHUB_WEBHOOK_SECRET
 * @param {string} serverUrl - Base URL of your server (e.g., http://localhost:3000)
 */
function setupGitHubWebhook(app, webhookSecret, serverUrl) {
  if (!webhookSecret) {
    console.warn(
      "⚠️ GITHUB_WEBHOOK_SECRET not set in .env. GitHub webhooks will not be verified."
    );
  }

  // GitHub webhook endpoint
  app.post(
    "/github-webhook",
    webhookSecret
      ? verifyGitHubSignature(webhookSecret)
      : (req, res, next) => next(),
    async (req, res) => {
      try {
        const event = req.headers["x-github-event"];
        const payload = req.body;

        console.log(`📦 GitHub webhook received: ${event}`);

        // Only process push events
        if (event !== "push") {
          console.log(`⏭️ Skipping non-push event: ${event}`);
          return res.status(200).json({ message: "Event ignored" });
        }

        const branch = payload.ref.split("/").pop();
        const repository = payload.repository.name;
        const pusher = payload.pusher.name;
        const commits = payload.commits.length;

        console.log(`🔄 Push detected:`);
        console.log(`   Repository: ${repository}`);
        console.log(`   Branch: ${branch}`);
        console.log(`   Pusher: ${pusher}`);
        console.log(`   Commits: ${commits}`);

        // Only trigger update for main/master branch (adjust as needed)
        const deployBranches = ["main", "master", "production"];
        if (!deployBranches.includes(branch)) {
          console.log(
            `⏭️ Branch "${branch}" is not a deploy branch. Skipping update.`
          );
          return res.status(200).json({ message: "Branch ignored" });
        }

        // Trigger update
        try {
          console.log(`🚀 Triggering Trinity Capital update...`);
          const response = await axios.post(`${serverUrl}/trigger-update`, {
            source: "github",
            repository: repository,
            branch: branch,
            commits: commits,
            pusher: pusher,
          });

          console.log(`✅ Update triggered successfully:`, response.data);

          // Optional: Simulate update stages
          triggerUpdateStages(serverUrl);

          res.status(200).json({
            success: true,
            message: "Update triggered",
            data: response.data,
          });
        } catch (error) {
          console.error(`❌ Error triggering update:`, error.message);
          res.status(500).json({
            error: "Failed to trigger update",
            message: error.message,
          });
        }
      } catch (error) {
        console.error("❌ Error processing GitHub webhook:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  console.log("✅ GitHub webhook endpoint registered at /github-webhook");
}

/**
 * Trigger update stages with delays
 * Simulates the update process with progress updates
 * @param {string} serverUrl - Base URL of your server
 */
async function triggerUpdateStages(serverUrl) {
  const stages = [
    { delay: 2000, progress: 15, message: "Downloading latest version" },
    { delay: 3000, progress: 35, message: "Extracting files" },
    { delay: 3000, progress: 55, message: "Installing dependencies" },
    { delay: 2000, progress: 75, message: "Finalizing update" },
    { delay: 2000, progress: 90, message: "Restarting server" },
  ];

  let currentDelay = 0;

  for (const stage of stages) {
    currentDelay += stage.delay;
    setTimeout(async () => {
      try {
        await axios.post(`${serverUrl}/trigger-update`, {
          progress: stage.progress,
          message: stage.message,
        });
        console.log(
          `📊 Update progress: ${stage.progress}% - ${stage.message}`
        );
      } catch (error) {
        console.error(`Error updating progress:`, error.message);
      }
    }, currentDelay);
  }

  // Complete update
  setTimeout(async () => {
    try {
      await axios.post(`${serverUrl}/complete-update`);
      console.log(`✅ Update completed`);
    } catch (error) {
      console.error(`Error completing update:`, error.message);
    }
  }, currentDelay + 3000);
}

/**
 * Manual update trigger function (for testing)
 * Call this to manually trigger an update
 * @param {string} serverUrl - Base URL of your server
 */
async function manualUpdateTrigger(serverUrl) {
  try {
    console.log("🔄 Manually triggering update...");
    await axios.post(`${serverUrl}/trigger-update`, {
      source: "manual",
      message: "Manual update triggered",
    });

    triggerUpdateStages(serverUrl);
    console.log("✅ Manual update triggered successfully");
  } catch (error) {
    console.error("❌ Error triggering manual update:", error.message);
  }
}

module.exports = {
  setupGitHubWebhook,
  triggerUpdateStages,
  manualUpdateTrigger,
  verifyGitHubSignature,
};
