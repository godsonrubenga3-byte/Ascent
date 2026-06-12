import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import {
  initDB,
  loginOrRegisterGroup,
  getFullGroupState,
  updateUserStats,
  addSkill,
  updateSkill,
  deleteSkill,
  addScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  addPrayingSession,
  updatePrayingSession,
  deletePrayingSession,
  shareGroupItem,
  reinitDB
} from "./server/db.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Middleware to ensure DB is initialized
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized && process.env.VERCEL) {
    try {
      await initDB();
      dbInitialized = true;
    } catch (err) {
      console.error("DB Init Error in Middleware:", err);
    }
  }
  next();
});

// API: Authentic Covenant-Group Login/Registration
app.post("/api/groups/login", async (req, res) => {
  try {
    const { groupName, role, partnerName } = req.body;
    if (!groupName || !partnerName) {
      return res.status(400).json({ error: "GroupName and PartnerName are required" });
    }
    const state = await loginOrRegisterGroup(groupName, role, partnerName);
    res.json(state);
  } catch (err: any) {
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message || "Failed to log in" });
  }
});

// API: Re-initialize the entire database from scratch
app.post("/api/db/reinit", async (req, res) => {
  try {
    await reinitDB();
    res.json({ success: true, message: "Database re-initialized successfully." });
  } catch (err: any) {
    console.error("Reinit Error:", err);
    res.status(500).json({ error: err.message || "Failed to reinitialize database" });
  }
});

// API: Pull Complete Platform Sync state for a Group
app.get("/api/groups/:groupId/sync", async (req, res) => {
  try {
    const { groupId } = req.params;
    const state = await getFullGroupState(groupId);
    res.json(state);
  } catch (err: any) {
    console.error("Sync Error:", err);
    res.status(500).json({ error: err.message || "Failed to synchronize" });
  }
});

// API: Share to covenant board
app.post("/api/groups/share", async (req, res) => {
  try {
    const { groupId, type, payload } = req.body;
    if (!groupId || !type || !payload) {
      return res.status(400).json({ error: "Missing fields" });
    }
    await shareGroupItem(groupId, type, payload);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Share Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// API: Update Player Level / Exp / Stats
app.post("/api/users/update", async (req, res) => {
  try {
    const { userId, level, exp, disciplineScore, phoneMinutesToday, phoneDisciplineBonus } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }
    await updateUserStats(
      String(userId),
      Number(level ?? 0),
      Number(exp ?? 0),
      Number(disciplineScore ?? 0),
      Number(phoneMinutesToday ?? 0),
      Number(phoneDisciplineBonus ?? 0)
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("Update Stats Error:", err);
    res.status(500).json({ error: err.message || "Failed to update statistics" });
  }
});

// API: Add Skill
app.post("/api/skills", async (req, res) => {
  try {
    const { userId, name, category, level, exp } = req.body;
    if (!userId || !name || !category) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const id = await addSkill(userId, name, category, level || 1, exp || 0);
    res.json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update Skill
app.post("/api/skills/update", async (req, res) => {
  try {
    const { skillId, level, exp } = req.body;
    if (!skillId) {
      return res.status(400).json({ error: "SkillId is required" });
    }
    await updateSkill(skillId, level, exp);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete Skill
app.delete("/api/skills/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteSkill(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Add Schedule Item
app.post("/api/schedule", async (req, res) => {
  try {
    const { userId, title, category, startTime, endTime, date } = req.body;
    if (!userId || !title || !category || !startTime || !endTime || !date) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const id = await addScheduleItem(userId, title, category, startTime, endTime, date);
    res.json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update Schedule Item (Complete/Adjust)
app.post("/api/schedule/update", async (req, res) => {
  try {
    const { itemId, status, isAdjusted, adjustedStartTime, adjustedEndTime } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: "ItemId is required" });
    }
    await updateScheduleItem(itemId, status, isAdjusted, adjustedStartTime, adjustedEndTime);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete Schedule Item
app.delete("/api/schedule/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteScheduleItem(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Add Praying Session
app.post("/api/prayers", async (req, res) => {
  try {
    const { userId, title, type, status, date, notes } = req.body;
    if (!userId || !title || !type || !status || !date) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const id = await addPrayingSession(userId, title, type, status, date, notes);
    res.json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update Prayer Session
app.post("/api/prayers/update", async (req, res) => {
  try {
    const { sessionId, status, notes } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required" });
    }
    await updatePrayingSession(sessionId, status, notes);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete Prayer Session
app.delete("/api/prayers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deletePrayingSession(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Endpoint for Daily Scripture & Motivation Quote Generation
app.get("/api/daily-inspiration", async (req, res) => {
  try {
    // Return a solid fallback
    res.json({
      verse: "Keep your heart with all diligence, for out of it spring the issues of life.",
      reference: "Proverbs 4:23",
      quote: "Discipline is the bridge between goals and accomplishment.",
      quoteAuthor: "Jim Rohn"
    });
  } catch (error: any) {
    console.error("Inspiration Error:", error);
    res.status(500).json({ error: "Failed to get inspiration" });
  }
});

export default app;

// Static files server / Vite dev engine
async function start() {
  // Initialize Database tables synchronously on first boot
  await initDB();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Couples Leveling Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  start();
}

