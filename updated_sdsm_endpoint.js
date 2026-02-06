// Updated SDSM session endpoint to handle completed lessons with snapshots
// Add this to your lesson server (localhost:4000)

app.post("/api/sdsm/session", async (req, res) => {
  try {
    const {
      studentName,
      activeLessons,
      completedLessons,
      lessonTimers,
      timestamp,
    } = req.body;
    if (!studentName) {
      return res.status(400).json({
        success: false,
        message: "Missing studentName in request.",
      });
    }

    console.log("Received student session data for:", studentName);
    console.log("Session Data:", req.body);

    const profilesCollection = client
      .db("TrinityCapital")
      .collection("User Profiles");

    // Prepare session data object
    const sessionData = {
      studentName: studentName,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    };

    // Add active lessons if provided
    if (activeLessons && Array.isArray(activeLessons)) {
      sessionData.activeLessons = activeLessons;
    }

    // Add lesson timers if provided (though these are now saved separately)
    if (lessonTimers && typeof lessonTimers === "object") {
      sessionData.lessonTimers = lessonTimers;
    }

    // Handle completed lessons with snapshots
    if (
      completedLessons &&
      Array.isArray(completedLessons) &&
      completedLessons.length > 0
    ) {
      console.log(
        `Processing ${completedLessons.length} completed lessons for ${studentName}`
      );

      // Store completed lessons in a separate collection for grading
      const completedLessonsCollection = client
        .db("TrinityCapital")
        .collection("Completed Lessons");

      for (const completedLesson of completedLessons) {
        const completionRecord = {
          studentName: studentName,
          lessonId: completedLesson.lessonId,
          lessonTitle: completedLesson.lessonTitle,
          completedAt: new Date(completedLesson.completedAt),
          snapshot: completedLesson.snapshot,
          sessionTimestamp: sessionData.timestamp,
        };

        // Upsert the completion record (update if exists, insert if not)
        await completedLessonsCollection.updateOne(
          {
            studentName: studentName,
            lessonId: completedLesson.lessonId,
            completedAt: completionRecord.completedAt,
          },
          { $set: completionRecord },
          { upsert: true }
        );

        console.log(
          `Stored completion snapshot for lesson: ${completedLesson.lessonTitle}`
        );
      }

      sessionData.completedLessonsCount = completedLessons.length;
    }

    // Update or create session data in user profile
    const updateResult = await profilesCollection.updateOne(
      { memberName: studentName },
      {
        $push: {
          "Lesson Data": sessionData,
        },
        $set: {
          lastSessionUpdate: sessionData.timestamp,
        },
      },
      { upsert: true }
    );

    if (updateResult.acknowledged) {
      console.log(`Session data stored for ${studentName}`);
      res.status(200).json({
        success: true,
        message: "Session data stored successfully",
        completedLessonsStored: completedLessons ? completedLessons.length : 0,
      });
    } else {
      console.error("Failed to store session data");
      res.status(500).json({
        success: false,
        message: "Failed to store session data",
      });
    }
  } catch (error) {
    console.error("Error processing SDSM session data:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to store session data." });
  }
});
