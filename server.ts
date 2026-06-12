import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
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
  addChatMessage,
  shareGroupItem,
  reinitDB
} from "./server/db";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json());

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
    await updateUserStats(userId, level, exp, disciplineScore, phoneMinutesToday, phoneDisciplineBonus);
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

// API Endpoint for Sin-Control Chat Assistance & DB Recording
app.post("/api/assistant/chat", async (req, res) => {
  try {
    const { message, history, sinType, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const type = sinType || "general";

    let adviceContext = "";
    if (type === "lust") {
      adviceContext = "The user is struggling with Lust. Guide them away from looking, physical urges, or pornography. Suggest immediate grounding strategies: pause, do 20 pushups, wash their face with cold water, pray for their partner, or redirect their mind towards creative or productive skills. Frame control as a superpower that preserves spiritual strength for their partner.";
    } else if (type === "anger") {
      adviceContext = "The user is struggling with Anger or frustration. Encourage the 10-second pause rule. Advise them to speak in a calm, lowered octave, to identify the root wound rather than attacking, and remind them that passive aggressiveness or harsh words degrade the couple's sync. Remind them that true strength is self-mastery.";
    } else if (type === "pride") {
      adviceContext = "The user is struggling with Pride, defensiveness, or ego. Challenge them gently to prioritize relationship harmony over being right. Encourage them to offer a humble apology, practice active listening, appreciation, and embrace the team mentality (no master, no subordinate, only co-sovereigns).";
    } else {
      adviceContext = "Provide dynamic guidance on self-discipline, time blocking, overcoming spiritual laziness, and leveling up their daily skills alongside their partner.";
    }

    const systemInstruction = `You are a supportive, high-composure spiritual mentor and psychological companion for a Couple's Leveling System modeled after Solo Leveling. 
Your tone is serious, encouraging, sagely, and noble (similar to a quest system guide or mentor priest). 
Your objective is to help the user master their impulses and build absolute discipline.
Focus: ${adviceContext}
Keep replies fairly brief (under 150 words), actionable, empathetic, but powerful and motivating, reminding them of their rank and progress.`;

    // Map history to standard GenAI structure
    const contents = (history || []).map((h: any) => ({
      role: h.role === "assistant" || h.role === "model" ? "model" : "user",
      parts: [{ text: h.text || h.content }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const modelReply = response.text || "Continue on your path of self-mastery. Together you shall prevail.";

    // Save both to database if userId (active partner) is provided!
    if (userId) {
      await addChatMessage(userId, "user", message, type);
      await addChatMessage(userId, "model", modelReply, type);
    }

    res.json({ reply: modelReply });
  } catch (error: any) {
    console.error("Gemini Assistant Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate reply" });
  }
});

// API Endpoint for Daily Scripture & Motivation Quote Generation
app.get("/api/daily-inspiration", async (req, res) => {
  try {
    const todayStr = new Date().toDateString();
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a dynamic and inspiring combo of a Scripture Verse (relevant to self-discipline, patience, covenant, love, strength, or mutual support) and a high-impact motivational quote for hard-working partners today: ${todayStr}`,
      config: {
        systemInstruction: "You are a spiritual leader and a personal development trainer. Generate a beautifully aligned Scripture Verse of the Day and a motivational quote. Return valid raw JSON matching the requested schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verse: {
              type: Type.STRING,
              description: "The text of the scripture verse.",
            },
            reference: {
              type: Type.STRING,
              description: "The book chapter:verse (e.g., Romans 12:2).",
            },
            quote: {
              type: Type.STRING,
              description: "A motivating and powerful quote about pushing limits, leveling up skills, or perseverance.",
            },
            quoteAuthor: {
              type: Type.STRING,
              description: "The author of the quote.",
            },
          },
          required: ["verse", "reference", "quote", "quoteAuthor"],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text.trim());
      res.json(data);
    } else {
      throw new Error("No payload returned from model");
    }
  } catch (error: any) {
    console.error("Gemini Inspiration Error:", error);
    // Return a solid fallback in case of connection limits or issues
    res.json({
      verse: "Keep your heart with all diligence, for out of it spring the issues of life.",
      reference: "Proverbs 4:23",
      quote: "Discipline is the bridge between goals and accomplishment.",
      quoteAuthor: "Jim Rohn"
    });
  }
});

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Couples Leveling Server] Running on http://0.0.0.0:${PORT}`);
  });
}

start();
