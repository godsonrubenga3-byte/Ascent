export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  coupleId: string | null;
  level: number;
  exp: number;
  disciplineScore: number;
  phoneMinutesToday: number;
  phoneDisciplineBonus: number;
  timezone?: string;
  lastActiveAt?: any;
}

export interface Couple {
  id: string;
  partner1Id: string;
  partner1Name: string;
  partner2Id?: string;
  partner2Name?: string;
  inviteCode: string;
  sharedLevel: number;
  sharedExp: number;
  verseOfTheDayShared?: {
    verse: string;
    reference: string;
    sharedBy: string;
    sharedByName: string;
    sharedAt: string;
  };
  motivationQuoteShared?: {
    quote: string;
    quoteAuthor: string;
    sharedBy: string;
    sharedByName: string;
    sharedAt: string;
  };
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: "income" | "workout" | "exploration" | "custom";
  level: number;
  exp: number;
  isImported?: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  category: "routine" | "workout" | "exploration" | "skill" | "prayer" | "leisure";
  startTime: string;
  endTime: string;
  adjustedStartTime?: string;
  adjustedEndTime?: string;
  isAdjusted: boolean;
  isDefault?: boolean;
  status: "pending" | "completed" | "missed";
  date: string; // YYYY-MM-DD
}

export interface PrayingSession {
  id: string;
  title: string;
  type: "solo" | "couple";
  status: "completed" | "missed";
  date: string; // YYYY-MM-DD
  notes?: string;
  completedAt?: string;
}

export interface DailyInspiration {
  verse: string;
  reference: string;
  quote: string;
  quoteAuthor: string;
}
