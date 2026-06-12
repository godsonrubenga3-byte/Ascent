/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- 1. COVENANT REAL-TIME REST BRIDGE FOR FIRESTORE ---

export class DocRef {
  constructor(
    public collectionPath: string,
    public docId: string,
    public parentSegments: string[] = []
  ) {}
  get id() {
    return this.docId;
  }
}

export class CollectionRef {
  constructor(
    public path: string,
    public segments: string[] = []
  ) {}
}

export class QueryRef {
  constructor(
    public collectionPath: string,
    public filters: any[] = []
  ) {}
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

// Client-side Local State store from sync endpoint pool
let activeGroupState: any = null;

// Callbacks list for React component state triggers
interface Listener {
  id: string;
  path: string;
  isDoc: boolean;
  callback: (snap: any) => void;
}
const activeListeners: Listener[] = [];

// Helper to push updates to active UI listeners
export function triggerSyncNotification() {
  if (!activeGroupState) return;

  const state = activeGroupState;

  for (const listener of activeListeners) {
    const p = listener.path;

    if (listener.isDoc) {
      // 1. User profiles (p matches "users/userId")
      if (p.startsWith("users/")) {
        const uId = p.split("/")[1];
        const isP1 = state.partner1 && state.partner1.uid === uId;
        const isP2 = state.partner2 && state.partner2.uid === uId;
        const uProfile = isP1 ? state.partner1 : isP2 ? state.partner2 : null;

        listener.callback({
          exists: () => uProfile !== null,
          data: () => uProfile,
          id: uId,
        });
      }
      // 2. Group info (p matches "couples/coupleId")
      else if (p.startsWith("couples/")) {
        const cId = p.split("/")[1];
        const matches = state.group && state.group.id === cId;
        listener.callback({
          exists: () => matches,
          data: () => state.group,
          id: cId,
        });
      }
    } else {
      // 3. User subcollections
      // matches "users/userId/skills"
      if (p.endsWith("/skills")) {
        const uId = p.split("/")[1];
        const docs = state.skills
          .filter((s: any) => s.user_id === uId)
          .map((s: any) => ({
            id: s.id,
            data: () => s,
            ...s,
          }));
        listener.callback({
          docs,
          empty: docs.length === 0,
          forEach: (fn: any) => docs.forEach(fn),
        });
      }
      // matches "users/userId/scheduleItems"
      else if (p.endsWith("/scheduleItems")) {
        const uId = p.split("/")[1];
        const docs = state.scheduleItems
          .filter((s: any) => s.user_id === uId)
          .map((s: any) => ({
            id: s.id,
            data: () => s,
            ...s,
          }));
        listener.callback({
          docs,
          empty: docs.length === 0,
          forEach: (fn: any) => docs.forEach(fn),
        });
      }
      // matches "users/userId/prayingSessions"
      else if (p.endsWith("/prayingSessions")) {
        const uId = p.split("/")[1];
        const docs = state.prayingSessions
          .filter((s: any) => s.user_id === uId)
          .map((s: any) => ({
            id: s.id,
            data: () => s,
            ...s,
          }));
        listener.callback({
          docs,
          empty: docs.length === 0,
          forEach: (fn: any) => docs.forEach(fn),
        });
      }
    }
  }
};

// Global active sync routine
let syncInterval: any = null;

// Example: "https://duo-ascent.vercel.app"
const BASE_URL = "https://duo-ascent.vercel.app";

function getUrl(path: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Check if we are running in Capacitor (localhost) or dev
  const isCapacitor = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.protocol === "file:");
  const base = isCapacitor ? BASE_URL : origin;
  return `${base}${path}`;
}

export async function pullDatabaseSync(groupId: string) {
  try {
    const res = await fetch(getUrl(`/api/groups/${groupId}/sync`));
    if (res.ok) {
      activeGroupState = await res.json();
      triggerSyncNotification();
    }
  } catch (err) {
    console.warn("[Bridge] Sync connection paused:", err);
  }
}

export function startDatabaseSyncLoop(groupId: string) {
  if (syncInterval) clearInterval(syncInterval);
  pullDatabaseSync(groupId);
  syncInterval = setInterval(() => pullDatabaseSync(groupId), 2500);
}

export function stopDatabaseSyncLoop() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Database Mock Instances
export const db = {};

// Path parser
export function doc(first: any, ...segments: string[]): DocRef {
  const allSegs = [...segments];
  const len = allSegs.length;
  const docId = allSegs[len - 1];
  const collectionPath = allSegs.slice(0, len - 1).join("/");
  return new DocRef(collectionPath, docId, allSegs);
}

export function collection(first: any, ...segments: string[]): CollectionRef {
  // If first is an instance of DocRef, prepend parent segments
  let allSegs = [...segments];
  if (first instanceof DocRef) {
    allSegs = [...first.parentSegments, ...segments];
  }
  return new CollectionRef(allSegs.join("/"), allSegs);
}

export function query(colRef: CollectionRef, ...filters: any[]): QueryRef {
  return new QueryRef(colRef.path, filters);
}

export function where(field: string, opStr: string, value: any) {
  return { field, opStr, value };
}

export async function getDocs(queryOrCol: any) {
  // Return cached synced arrays
  const p = queryOrCol instanceof QueryRef ? queryOrCol.collectionPath : queryOrCol.path;
  if (!activeGroupState) return { docs: [], empty: true, forEach: () => {} };

  const state = activeGroupState;

  if (p.endsWith("/skills")) {
    const uId = p.split("/")[1];
    const docs = state.skills
      .filter((s: any) => s.user_id === uId)
      .map((s: any) => ({
        id: s.id,
        data: () => s,
        ...s,
      }));
    return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn) };
  }

  if (p.endsWith("/scheduleItems")) {
    const uId = p.split("/")[1];
    const docs = state.scheduleItems
      .filter((s: any) => s.user_id === uId)
      .map((s: any) => ({
        id: s.id,
        data: () => s,
        ...s,
      }));
    return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn) };
  }

  return { docs: [], empty: true, forEach: () => {} };
}

// REST Mutation Mappers
export async function addDoc(colRef: CollectionRef, data: any) {
  const p = colRef.path;
  const uId = colRef.segments[1];
  let newId = "MOCK-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  // A. SKILLS ADD
  if (p.endsWith("/skills")) {
    const res = await fetch(getUrl("/api/skills"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: uId,
        name: data.name,
        category: data.category,
        level: data.level || 1,
        exp: data.exp || 0,
      }),
    });
    const parsed = await res.json();
    newId = parsed.id;
  }
  // B. DAILY QUESTS ADD
  else if (p.endsWith("/scheduleItems")) {
    const res = await fetch(getUrl("/api/schedule"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: uId,
        title: data.title,
        category: data.category,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date,
      }),
    });
    const parsed = await res.json();
    newId = parsed.id;
  }
  // C. DEVOTION TRACKS ADD
  else if (p.endsWith("/prayingSessions")) {
    const res = await fetch(getUrl("/api/prayers"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: uId,
        title: data.title,
        type: data.type,
        status: data.status,
        date: data.date,
        notes: data.notes || "",
      }),
    });
    const parsed = await res.json();
    newId = parsed.id;
  }

  // Pull updates immediately following mutation
  if (activeGroupState?.group?.id) {
    await pullDatabaseSync(activeGroupState.group.id);
  }

  return new DocRef(p, newId);
}

export async function setDoc(docRef: DocRef, data: any) {
  // Used in App.tsx mock sandbox setup - we can safely ignore or mock
}

export async function updateDoc(docRef: DocRef, data: any) {
  const segs = docRef.parentSegments;
  const colPath = docRef.collectionPath;
  const itemId = docRef.docId;

  // A. USER STATS (e.g. stats multipliers or phone lock rewards)
  if (colPath === "users") {
    await fetch(getUrl("/api/users/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: itemId,
        level: data.level,
        exp: data.exp,
        disciplineScore: data.disciplineScore,
        phoneMinutesToday: data.phoneMinutesToday,
        phoneDisciplineBonus: data.phoneDisciplineBonus,
      }),
    });
  }
  // B. COVENANT BOARD SHARING
  else if (colPath === "couples") {
    if (data.verseOfTheDayShared) {
      await fetch(getUrl("/api/groups/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: itemId,
          type: "verse",
          payload: data.verseOfTheDayShared,
        }),
      });
    } else if (data.motivationQuoteShared) {
      await fetch(getUrl("/api/groups/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: itemId,
          type: "quote",
          payload: data.motivationQuoteShared,
        }),
      });
    }
  }
  // C. SPECIALTY HUB LEVELS EXP
  else if (segs[2] === "skills") {
    await fetch(getUrl("/api/skills/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId: itemId,
        level: data.level,
        exp: data.exp,
      }),
    });
  }
  // D. DAILY QUEST LOGS PROGRESS
  else if (segs[2] === "scheduleItems") {
    await fetch(getUrl("/api/schedule/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: itemId,
        status: data.status,
        isAdjusted: data.isAdjusted || false,
        adjustedStartTime: data.adjustedStartTime,
        adjustedEndTime: data.adjustedEndTime,
      }),
    });
  }
  // E. DEVOTIONS LOGS STATUS
  else if (segs[2] === "prayingSessions") {
    await fetch(getUrl("/api/prayers/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: itemId,
        status: data.status,
        notes: data.notes,
      }),
    });
  }

  // Pull down new SQLite snapshots
  if (activeGroupState?.group?.id) {
    await pullDatabaseSync(activeGroupState.group.id);
  }
}

export async function deleteDoc(docRef: DocRef) {
  const segs = docRef.parentSegments;
  const itemId = docRef.docId;

  if (segs[2] === "skills") {
    await fetch(getUrl(`/api/skills/${itemId}`), { method: "DELETE" });
  } else if (segs[2] === "scheduleItems") {
    await fetch(getUrl(`/api/schedule/${itemId}`), { method: "DELETE" });
  } else if (segs[2] === "prayingSessions") {
    await fetch(getUrl(`/api/prayers/${itemId}`), { method: "DELETE" });
  }

  if (activeGroupState?.group?.id) {
    await pullDatabaseSync(activeGroupState.group.id);
  }
}

export function onSnapshot(ref: any, callback: (snap: any) => void, onError?: (err: any) => void) {
  const id = Math.random().toString(36).substring(2, 12);
  const isDoc = ref instanceof DocRef;
  const path = isDoc ? `${ref.collectionPath}/${ref.docId}` : ref.path;

  activeListeners.push({ id, path, isDoc, callback });

  // If sync data is already loaded, trigger immediately to remove empty transitions
  if (activeGroupState) {
    setTimeout(() => {
      triggerSyncNotification();
    }, 0);
  }

  return () => {
    const idx = activeListeners.findIndex((sub) => sub.id === id);
    if (idx !== -1) {
      activeListeners.splice(idx, 1);
    }
  };
}

export function writeBatch(dbInstance: any) {
  return {
    commit: async () => {},
    set: (docRef: DocRef, data: any) => {},
    update: (docRef: DocRef, data: any) => {},
    delete: (docRef: DocRef) => {},
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Database action error detail: ${operationType} on path: ${path}`, error);
}

// --- 2. AUTH MOCKING ROUTINES BACKED BY SQL GROUP ENTRIES ---

export class MockAuth {
  private listeners: ((user: any) => void)[] = [];
  public currentUser: any = null;

  constructor() {
    const savedGroupId = localStorage.getItem("covenant_group_id");
    const activeRole = localStorage.getItem("covenant_active_role");
    const displayName = localStorage.getItem("covenant_display_name");

    if (savedGroupId && activeRole) {
      const pId = `${savedGroupId}-${activeRole === "partner1" ? "p1" : "p2"}`;
      this.currentUser = {
        uid: pId,
        email: `${activeRole}@duoleveling.local`,
        displayName: displayName || "Leveler",
        groupId: savedGroupId,
        activeRole,
      };
      
      // Kick off serverless synchronization loop!
      startDatabaseSyncLoop(savedGroupId);
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem("covenant_group_id", user.groupId);
      localStorage.setItem("covenant_active_role", user.activeRole);
      localStorage.setItem("covenant_display_name", user.displayName);
      startDatabaseSyncLoop(user.groupId);
    } else {
      localStorage.removeItem("covenant_group_id");
      localStorage.removeItem("covenant_active_role");
      localStorage.removeItem("covenant_display_name");
      stopDatabaseSyncLoop();
      activeGroupState = null;
    }
    this.listeners.forEach((l) => l(this.currentUser));
  }
}

export const auth = new MockAuth();

export function onAuthStateChanged(authInstance: MockAuth, callback: (user: any) => void) {
  return authInstance.onAuthStateChanged(callback);
}

// Placeholder popups
export async function signInWithPopup(authInstance: MockAuth, provider: any) {
  throw new Error("Popup not accepted in relational system.");
}

export async function signInAnonymously(authInstance: MockAuth) {
  throw new Error("Anonymous login disabled.");
}

export async function signOut(authInstance: MockAuth) {
  authInstance.setCurrentUser(null);
}

export class GoogleAuthProvider {}
export const googleProvider = new GoogleAuthProvider();
