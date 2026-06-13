export interface GroupState {
  group: {
    id: string;
    group_name: string;
    partner1_name: string;
    partner2_name: string;
    shared_level: number;
    shared_exp: number;
    created_at: string;
  };
  partner1: {
    id: string;
    role: string;
    display_name: string;
    level: number;
    exp: number;
    discipline_score: number;
    phone_minutes_today: number;
    phone_discipline_bonus: number;
    last_active_at: string;
  } | null;
  partner2: {
    id: string;
    role: string;
    display_name: string;
    level: number;
    exp: number;
    discipline_score: number;
    phone_minutes_today: number;
    phone_discipline_bonus: number;
    last_active_at: string;
  } | null;
  skills: any[];
  scheduleItems: any[];
  prayingSessions: any[];
}

// For Desktop/Mobile production, replace this with your actual Vercel deployment URL
// Example: "https://duo-leveling.vercel.app"
const BASE_URL = "https://duo-ascent.vercel.app"; 

export function getUrl(path: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Check if we are running in Capacitor (localhost) or dev
  const isCapacitor = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.protocol === "file:");
  const base = isCapacitor ? BASE_URL : origin;
  return `${base}${path}`;
}

export async function apiLogin(groupName: string, role: "partner1" | "partner2", partnerName: string): Promise<GroupState> {
  const response = await fetch(getUrl("/api/groups/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupName, role, partnerName }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Failed to log in to Covenant Group");
  }
  return await response.json();
}

export async function apiSync(groupId: string): Promise<GroupState> {
  const response = await fetch(getUrl(`/api/groups/${groupId}/sync`));
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Synchronization failing");
  }
  return await response.json();
}

export async function apiUpdateUser(
  userId: string,
  level: number,
  exp: number,
  disciplineScore: number,
  phoneMinutesToday: number,
  phoneDisciplineBonus: number
): Promise<void> {
  await fetch(getUrl("/api/users/update"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      level,
      exp,
      disciplineScore,
      phoneMinutesToday,
      phoneDisciplineBonus,
    }),
  });
}

export async function apiAddSkill(userId: string, name: string, category: string, level = 1, exp = 0): Promise<string> {
  const response = await fetch(getUrl("/api/skills"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name, category, level, exp }),
  });
  const data = await response.json();
  return data.id;
}

export async function apiUpdateSkill(skillId: string, level: number, exp: number): Promise<void> {
  await fetch(getUrl("/api/skills/update"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skillId, level, exp }),
  });
}

export async function apiDeleteSkill(skillId: string): Promise<void> {
  await fetch(getUrl(`/api/skills/${skillId}`), { method: "DELETE" });
}

export async function apiAddScheduleItem(
  userId: string,
  title: string,
  category: string,
  startTime: string,
  endTime: string,
  date: string
): Promise<string> {
  const response = await fetch(getUrl("/api/schedule"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title, category, startTime, endTime, date }),
  });
  const data = await response.json();
  return data.id;
}

export async function apiUpdateScheduleItem(
  itemId: string,
  status: string,
  isAdjusted: boolean,
  adjustedStartTime?: string,
  adjustedEndTime?: string
): Promise<void> {
  await fetch(getUrl("/api/schedule/update"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, status, isAdjusted, adjustedStartTime, adjustedEndTime }),
  });
}

export async function apiDeleteScheduleItem(itemId: string): Promise<void> {
  await fetch(getUrl(`/api/schedule/${itemId}`), { method: "DELETE" });
}

export async function apiAddPrayingSession(
  userId: string,
  title: string,
  type: string,
  status: string,
  date: string,
  notes?: string
): Promise<string> {
  const response = await fetch(getUrl("/api/prayers"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title, type, status, date, notes }),
  });
  const data = await response.json();
  return data.id;
}

export async function apiUpdatePrayingSession(sessionId: string, status: string, notes?: string): Promise<void> {
  await fetch(getUrl("/api/prayers/update"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, status, notes }),
  });
}

export async function apiDeletePrayingSession(sessionId: string): Promise<void> {
  await fetch(getUrl(`/api/prayers/${sessionId}`), { method: "DELETE" });
}
