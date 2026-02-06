// Add this to your lesson server (localhost:4000) to persist timers to MongoDB

// Assuming you have MongoDB connection as 'client'

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
        { upsert: true }
      );

    console.log(
      `Timer saved for student ${studentId}, lesson ${lessonId}: ${elapsedTime} seconds`
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
        `Timer fetched for student ${studentId}, lesson ${lessonId}: ${timerDoc.elapsedTime} seconds`
      );
      res.json({ elapsedTime: timerDoc.elapsedTime });
    } else {
      console.log(
        `No timer found for student ${studentId}, lesson ${lessonId}`
      );
      res.status(404).json({ error: "Timer not found" });
    }
  } catch (error) {
    console.error("Error fetching timer:", error);
    res.status(500).json({ error: "Failed to fetch timer" });
  }
});
