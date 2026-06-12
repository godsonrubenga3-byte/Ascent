import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const connectionUrl = process.env.TURSO_CONNECTION_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

console.log(`[Database] Initializing connection to: ${connectionUrl}`);

export const dbClient = createClient({
  url: connectionUrl,
  authToken: authToken,
});

// Setup schema on startup
export async function initDB() {
  try {
    console.log("[Database] Running schema initialization...");

    // 1. Group info
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        group_name TEXT UNIQUE NOT NULL,
        partner1_name TEXT DEFAULT 'Partner 1',
        partner2_name TEXT DEFAULT 'Partner 2',
        shared_level INTEGER DEFAULT 1,
        shared_exp INTEGER DEFAULT 0,
        verse_text TEXT,
        verse_ref TEXT,
        verse_shared_by TEXT,
        verse_shared_name TEXT,
        quote_text TEXT,
        quote_author TEXT,
        quote_shared_by TEXT,
        quote_shared_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Individual User profiles
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        role TEXT NOT NULL, -- 'partner1' or 'partner2'
        display_name TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        discipline_score INTEGER DEFAULT 100,
        phone_minutes_today INTEGER DEFAULT 0,
        phone_discipline_bonus INTEGER DEFAULT 0,
        last_active_at TEXT,
        UNIQUE(group_id, role)
      )
    `);

    // 3. Skills
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        is_imported INTEGER DEFAULT 0
      )
    `);

    // 4. Schedule Items
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS schedule_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        adjusted_start_time TEXT,
        adjusted_end_time TEXT,
        is_adjusted INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        date TEXT NOT NULL
      )
    `);

    // 5. Praying sessions
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS praying_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        date TEXT NOT NULL,
        notes TEXT,
        completed_at TEXT
      )
    `);

    console.log("[Database] Schema successfully verified/created!");
  } catch (err) {
    console.error("[Database] Initialization Failed:", err);
  }
}

// Drops and reinitializes database tables
export async function reinitDB() {
  try {
    console.log("[Database] Performing clean database re-initialization...");
    await dbClient.execute("DROP TABLE IF EXISTS praying_sessions");
    await dbClient.execute("DROP TABLE IF EXISTS schedule_items");
    await dbClient.execute("DROP TABLE IF EXISTS skills");
    await dbClient.execute("DROP TABLE IF EXISTS users");
    await dbClient.execute("DROP TABLE IF EXISTS groups");
    await initDB();
    console.log("[Database] Clean reinit complete!");
    return true;
  } catch (err) {
    console.error("[Database] Reinit Failed:", err);
    throw err;
  }
}

// Map database records to clean JS types
function sanitizeRow(row: any) {
  if (!row) return null;
  const copy = { ...row };
  // Convert sqlite integer flags back to booleans
  if ('is_imported' in copy) copy.isImported = copy.is_imported === 1;
  if ('is_adjusted' in copy) copy.isAdjusted = copy.is_adjusted === 1;
  return copy;
}

// Generate unique identifier
function generateId(prefix = "") {
  return `${prefix}${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

// Seeds default starting data for the leveling experience
async function seedDefaultData(groupId: string, p1Id: string, p2Id: string) {
  try {
    // 1. Initial Skills (Partner 1)
    await dbClient.execute({
      sql: `INSERT INTO skills (id, user_id, name, category, level, exp, is_imported) VALUES 
        (?, ?, 'Financial Day Trading', 'income', 2, 40, 1),
        (?, ?, 'Digital Marketing Specialist', 'income', 1, 90, 1),
        (?, ?, 'Greek Lore Exploration', 'exploration', 3, 10, 1)`,
      args: [generateId("SK-"), p1Id, generateId("SK-"), p1Id, generateId("SK-"), p1Id]
    });

    // Initial Skills (Partner 2)
    await dbClient.execute({
      sql: `INSERT INTO skills (id, user_id, name, category, level, exp, is_imported) VALUES 
        (?, ?, 'Public Speaking Mastery', 'income', 3, 10, 1),
        (?, ?, 'Graphic Designing Artistry', 'income', 2, 60, 1)`,
      args: [generateId("SK-"), p2Id, generateId("SK-"), p2Id]
    });

    const today = new Date().toISOString().split("T")[0];

    // 3. Default Schedule items (Partner 1)
    await dbClient.execute({
      sql: `INSERT INTO schedule_items (id, user_id, title, category, start_time, end_time, is_adjusted, status, date) VALUES 
        (?, ?, 'Market Chart Analysis', 'income', '08:00', '10:00', 0, 'completed', ?),
        (?, ?, 'Strength Conditioning', 'workout', '17:00', '18:30', 0, 'pending', ?)`,
      args: [generateId("SCH-"), p1Id, today, generateId("SCH-"), p1Id, today]
    });

    // Default Schedule items (Partner 2)
    await dbClient.execute({
      sql: `INSERT INTO schedule_items (id, user_id, title, category, start_time, end_time, is_adjusted, status, date) VALUES 
        (?, ?, 'Design Concept Drafting', 'income', '09:00', '11:00', 0, 'completed', ?),
        (?, ?, 'Speech Warmup', 'skill', '14:00', '15:00', 0, 'pending', ?)`,
      args: [generateId("SCH-"), p2Id, today, generateId("SCH-"), p2Id, today]
    });

    // 4. Default Praying Session
    await dbClient.execute({
      sql: `INSERT INTO praying_sessions (id, user_id, title, type, status, date, notes) VALUES 
        (?, ?, 'Praising & Intercession', 'solo', 'completed', ?, 'Refreshed in prayer for my partner and my self-discipline.')`,
      args: [generateId("PR-"), p1Id, today]
    });

    console.log("[Database] Successfully seeded default group content!");
  } catch (err) {
    console.error("[Database] Failed seeding values:", err);
  }
}

// Master Login / Registration using Group Name
export async function loginOrRegisterGroup(groupName: string, role: string | undefined, partnerName: string) {
  const normName = groupName.trim().toLowerCase();
  
  // Find group
  const grpRes = await dbClient.execute({
    sql: "SELECT * FROM groups WHERE LOWER(group_name) = ?",
    args: [normName]
  });

  let group: any = null;
  let isNew = false;
  let resolvedRole: 'partner1' | 'partner2' = 'partner1';

  if (grpRes.rows.length === 0) {
    // Register new group
    resolvedRole = 'partner1';
    isNew = true;
    const groupId = "GRP-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await dbClient.execute({
      sql: `INSERT INTO groups (id, group_name, partner1_name, partner2_name, shared_level, shared_exp) 
            VALUES (?, ?, ?, ?, 1, 0)`,
      args: [
        groupId,
        groupName.trim(),
        partnerName.trim(),
        'Partner 2'
      ]
    });

    // Fetch the new group
    const gr = await dbClient.execute({
      sql: "SELECT * FROM groups WHERE id = ?",
      args: [groupId]
    });
    group = gr.rows[0];

    // Create the two default User Profiles
    const p1Id = `${groupId}-p1`;
    const p2Id = `${groupId}-p2`;

    await dbClient.execute({
      sql: `INSERT INTO users (id, group_id, role, display_name, level, exp, discipline_score, phone_minutes_today, phone_discipline_bonus, last_active_at) 
            VALUES (?, ?, 'partner1', ?, 1, 0, 100, 0, 0, ?)`,
      args: [p1Id, groupId, partnerName.trim(), new Date().toISOString()]
    });

    await dbClient.execute({
      sql: `INSERT INTO users (id, group_id, role, display_name, level, exp, discipline_score, phone_minutes_today, phone_discipline_bonus, last_active_at) 
            VALUES (?, ?, 'partner2', 'Partner 2', 1, 0, 100, 0, 0, ?)`,
      args: [p2Id, groupId, new Date().toISOString()]
    });

    // Seed defaults
    await seedDefaultData(groupId, p1Id, p2Id);
  } else {
    // Existing group
    group = grpRes.rows[0];
    const groupId = group.id;

    const p1NameLower = (group.partner1_name || 'Partner 1').trim().toLowerCase();
    const p2NameLower = (group.partner2_name || 'Partner 2').trim().toLowerCase();
    const inputNameLower = partnerName.trim().toLowerCase();

    // 1. Check if name matches partner1 or partner2 (case-insensitive)
    if (inputNameLower === p1NameLower) {
      resolvedRole = 'partner1';
    } else if (inputNameLower === p2NameLower) {
      resolvedRole = 'partner2';
    } 
    // 2. Check if name matches a default/unclaimed slot
    else {
      const p1IsDefault = p1NameLower === 'partner 1' || p1NameLower === 'partner1';
      const p2IsDefault = p2NameLower === 'partner 2' || p2NameLower === 'partner2';

      if (p2IsDefault) {
        resolvedRole = 'partner2';
      } else if (p1IsDefault) {
        resolvedRole = 'partner1';
      } else {
        // Both slots claimed by other different names. Default to Partner 2
        resolvedRole = 'partner2';
      }
    }

    // Update partner's name in group header and active user's table
    const colName = resolvedRole === 'partner1' ? 'partner1_name' : 'partner2_name';
    await dbClient.execute({
      sql: `UPDATE groups SET ${colName} = ? WHERE id = ?`,
      args: [partnerName.trim(), groupId]
    });

    // Reload updated group
    const reGrp = await dbClient.execute({
      sql: "SELECT * FROM groups WHERE id = ?",
      args: [groupId]
    });
    group = reGrp.rows[0];

    const userId = `${groupId}-${resolvedRole === 'partner1' ? 'p1' : 'p2'}`;
    await dbClient.execute({
      sql: "UPDATE users SET display_name = ?, last_active_at = ? WHERE id = ?",
      args: [partnerName.trim(), new Date().toISOString(), userId]
    });
  }

  // Fetch full state to return
  const fullState = await getFullGroupState(group.id);
  return {
    ...fullState,
    resolvedRole
  };
}

// Synchronizes the entire platform state (resolves relational constraints into single payload)
export async function getFullGroupState(groupId: string) {
  // 1. Group info
  const groupRes = await dbClient.execute({
    sql: "SELECT * FROM groups WHERE id = ?",
    args: [groupId]
  });

  if (groupRes.rows.length === 0) {
    throw new Error("Group does not exist");
  }

  const rawGroup = groupRes.rows[0];

  const group = {
    id: rawGroup.id,
    groupName: rawGroup.group_name,
    partner1Id: `${rawGroup.id}-p1`,
    partner1Name: rawGroup.partner1_name,
    partner2Id: `${rawGroup.id}-p2`,
    partner2Name: rawGroup.partner2_name,
    inviteCode: String(rawGroup.group_name).toUpperCase(),
    sharedLevel: Number(rawGroup.shared_level || 1),
    sharedExp: Number(rawGroup.shared_exp || 0),
    verseOfTheDayShared: rawGroup.verse_text ? {
      verse: rawGroup.verse_text,
      reference: rawGroup.verse_ref,
      sharedBy: rawGroup.verse_shared_by,
      sharedByName: rawGroup.verse_shared_name,
      sharedAt: new Date().toISOString()
    } : undefined,
    motivationQuoteShared: rawGroup.quote_text ? {
      quote: rawGroup.quote_text,
      quoteAuthor: rawGroup.quote_author,
      sharedBy: rawGroup.quote_shared_by,
      sharedByName: rawGroup.quote_shared_name,
      sharedAt: new Date().toISOString()
    } : undefined,
    createdAt: rawGroup.created_at
  };

  // 2. Both users
  const usersRes = await dbClient.execute({
    sql: "SELECT * FROM users WHERE group_id = ?",
    args: [groupId]
  });

  const rawP1 = usersRes.rows.find((u: any) => u.role === 'partner1') || null;
  const rawP2 = usersRes.rows.find((u: any) => u.role === 'partner2') || null;

  const mapUser = (u: any) => {
    if (!u) return null;
    return {
      uid: u.id,
      email: `${u.role}@duoleveling.local`,
      displayName: u.display_name,
      coupleId: u.group_id,
      level: Number(u.level || 1),
      exp: Number(u.exp || 0),
      disciplineScore: Number(u.discipline_score || 100),
      phoneMinutesToday: Number(u.phone_minutes_today || 0),
      phoneDisciplineBonus: Number(u.phone_discipline_bonus || 0),
      lastActiveAt: u.last_active_at
    };
  };

  const partner1 = mapUser(rawP1);
  const partner2 = mapUser(rawP2);

  // 3. Skills
  const skillsRes = await dbClient.execute({
    sql: `SELECT s.* FROM skills s 
          JOIN users u ON s.user_id = u.id 
          WHERE u.group_id = ?`,
    args: [groupId]
  });
  const skills = skillsRes.rows.map(sanitizeRow);

  // 4. Schedules
  const scheduleRes = await dbClient.execute({
    sql: `SELECT s.* FROM schedule_items s 
          JOIN users u ON s.user_id = u.id 
          WHERE u.group_id = ?`,
    args: [groupId]
  });
  const scheduleItems = scheduleRes.rows.map(sanitizeRow);

  // 5. Prayers
  const prayersRes = await dbClient.execute({
    sql: `SELECT p.* FROM praying_sessions p 
          JOIN users u ON p.user_id = u.id 
          WHERE u.group_id = ?`,
    args: [groupId]
  });
  const prayingSessions = prayersRes.rows.map(sanitizeRow);

  return {
    group,
    partner1,
    partner2,
    skills,
    scheduleItems,
    prayingSessions,
  };
}

// Share item to Group Message board
export async function shareGroupItem(
  groupId: string,
  type: 'verse' | 'quote',
  payload: any
) {
  if (type === 'verse') {
    await dbClient.execute({
      sql: `UPDATE groups SET 
              verse_text = ?, 
              verse_ref = ?, 
              verse_shared_by = ?, 
              verse_shared_name = ? 
            WHERE id = ?`,
      args: [payload.verse, payload.reference, payload.sharedBy, payload.sharedByName, groupId]
    });
  } else {
    await dbClient.execute({
      sql: `UPDATE groups SET 
              quote_text = ?, 
              quote_author = ?, 
              quote_shared_by = ?, 
              quote_shared_name = ? 
            WHERE id = ?`,
      args: [payload.quote, payload.quoteAuthor, payload.sharedBy, payload.sharedByName, groupId]
    });
  }
}


// Core Entity Updates
export async function updateUserStats(userId: string, level: number, exp: number, score: number, minutes: number, bonus: number) {
  // Defensive casting to ensure LibSQL doesn't receive undefined/null for numeric fields
  const safeLevel = Number(level ?? 1);
  const safeExp = Number(exp ?? 0);
  const safeScore = Number(score ?? 100);
  const safeMinutes = Number(minutes ?? 0);
  const safeBonus = Number(bonus ?? 0);

  await dbClient.execute({
    sql: `UPDATE users SET level = ?, exp = ?, discipline_score = ?, phone_minutes_today = ?, phone_discipline_bonus = ?, last_active_at = ? 
          WHERE id = ?`,
    args: [safeLevel, safeExp, safeScore, safeMinutes, safeBonus, new Date().toISOString(), userId]
  });

  // Calculate and update shared Group level / experience safely
  const userDetails = await dbClient.execute({
    sql: "SELECT group_id FROM users WHERE id = ?",
    args: [userId]
  });

  if (userDetails.rows.length > 0) {
    const groupId = userDetails.rows[0].group_id as string;
    const allUsers = await dbClient.execute({
      sql: "SELECT level, exp FROM users WHERE group_id = ?",
      args: [groupId]
    });
    
    let totalLevel = 0;
    let totalExp = 0;
    allUsers.rows.forEach((u: any) => {
      totalLevel += Number(u.level || 1);
      totalExp += Number(u.exp || 0);
    });

    const sharedLevel = Math.max(1, Math.floor(totalLevel / 2));
    const sharedExp = Math.floor(totalExp / 2);

    await dbClient.execute({
      sql: "UPDATE groups SET shared_level = ?, shared_exp = ? WHERE id = ?",
      args: [sharedLevel, sharedExp, groupId]
    });
  }
}

// Skills Logic
export async function addSkill(userId: string, name: string, category: string, level: number, exp: number) {
  const sId = generateId("SK-");
  await dbClient.execute({
    sql: `INSERT INTO skills (id, user_id, name, category, level, exp, is_imported) 
          VALUES (?, ?, ?, ?, ?, ?, 0)`,
    args: [sId, userId, name, category, level, exp]
  });
  return sId;
}

export async function updateSkill(skillId: string, level: number, exp: number) {
  await dbClient.execute({
    sql: `UPDATE skills SET level = ?, exp = ? WHERE id = ?`,
    args: [level, exp, skillId]
  });
}

export async function deleteSkill(skillId: string) {
  await dbClient.execute({
    sql: "DELETE FROM skills WHERE id = ?",
    args: [skillId]
  });
}

// Daily Schedule logic
export async function addScheduleItem(userId: string, title: string, category: string, startTime: string, endTime: string, date: string) {
  const sId = generateId("SCH-");
  await dbClient.execute({
    sql: `INSERT INTO schedule_items (id, user_id, title, category, start_time, end_time, is_adjusted, status, date) 
          VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', ?)`,
    args: [sId, userId, title, category, startTime, endTime, date]
  });
  return sId;
}

export async function updateScheduleItem(itemId: string, status: string, isAdjusted: boolean, adjStart?: string, adjEnd?: string) {
  await dbClient.execute({
    sql: `UPDATE schedule_items SET status = ?, is_adjusted = ?, adjusted_start_time = ?, adjusted_end_time = ? 
          WHERE id = ?`,
    args: [status, isAdjusted ? 1 : 0, adjStart || null, adjEnd || null, itemId]
  });
}

export async function deleteScheduleItem(itemId: string) {
  await dbClient.execute({
    sql: "DELETE FROM schedule_items WHERE id = ?",
    args: [itemId]
  });
}

// Prayers Logic
export async function addPrayingSession(userId: string, title: string, type: string, status: string, date: string, notes?: string) {
  const pId = generateId("PR-");
  const compAt = status === 'completed' ? new Date().toISOString() : null;
  await dbClient.execute({
    sql: `INSERT INTO praying_sessions (id, user_id, title, type, status, date, notes, completed_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [pId, userId, title, type, status, date, notes || null, compAt]
  });
  return pId;
}

export async function updatePrayingSession(sessionId: string, status: string, notes?: string) {
  const compAt = status === 'completed' ? new Date().toISOString() : null;
  await dbClient.execute({
    sql: `UPDATE praying_sessions SET status = ?, notes = ?, completed_at = ? WHERE id = ?`,
    args: [status, notes || null, compAt, sessionId]
  });
}

export async function deletePrayingSession(sessionId: string) {
  await dbClient.execute({
    sql: "DELETE FROM praying_sessions WHERE id = ?",
    args: [sessionId]
  });
}

// Turso Stats / Admin logic
export async function getTursoStats() {
  try {
    // 1. Get all user tables
    const tablesRes = await dbClient.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tableNames = tablesRes.rows.map(r => r.name as string);
    
    const tableStats = [];
    for (const name of tableNames) {
      const countRes = await dbClient.execute(`SELECT COUNT(*) as count FROM ${name}`);
      tableStats.push({ 
        name, 
        count: Number(countRes.rows[0].count) 
      });
    }

    // 2. Get some basic DB info
    const versionRes = await dbClient.execute("SELECT sqlite_version() as version");

    return {
      connectionUrl: (process.env.TURSO_CONNECTION_URL || "file:local.db").replace(/\?.*$/, ""), // Strip query params for safety
      version: versionRes.rows[0].version,
      tables: tableStats,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error("[Database] Stats fetch failed:", err);
    throw err;
  }
}

export async function runCustomQuery(sql: string, args: any[] = []) {
  try {
    const res = await dbClient.execute({ sql, args });
    return {
      columns: res.columns,
      rows: res.rows,
      rowsAffected: res.rowsAffected,
      lastInsertRowid: res.lastInsertRowid?.toString()
    };
  } catch (err: any) {
    console.error("[Database] Custom query failed:", err);
    throw new Error(err.message);
  }
}
