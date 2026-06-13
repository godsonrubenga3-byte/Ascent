import React, { useState } from "react";
import { db, handleFirestoreError, OperationType, collection, doc, addDoc, updateDoc, deleteDoc } from "../lib/firebase";
import { UserProfile, Couple, PrayingSession } from "../types";
import { addExp } from "./DuoStatus";
import { Heart, Moon, Sun, Flame, MessageCircleCode, Check, Cross, Sparkles, AlertCircle, Plus, PenTool } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PrayerTrackProps {
  userProfile: UserProfile;
  couple: Couple | null;
  prayingSessions: PrayingSession[];
  partnerPrayingSessions: PrayingSession[];
  partnerProfile: UserProfile | null;
}

export const DEFAULT_PRAYER_SLOTS = [
  { title: "Morning Rise Devotion", type: "solo" },
  { title: "Midday Gratitude Prayer", type: "solo" },
  { title: "Sunset Couple's United Covenant", type: "couple" },
  { title: "Bedtime Rest & Protection Prayer", type: "solo" },
];

export default function PrayerTrack({
  userProfile,
  couple,
  prayingSessions,
  partnerPrayingSessions,
  partnerProfile,
}: PrayerTrackProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  // Custom manual logging
  const [showLogForm, setShowLogForm] = useState(false);
  const [newPrayerTitle, setNewPrayerTitle] = useState("");
  const [newPrayerType, setNewPrayerType] = useState<"solo" | "couple">("solo");
  const [newPrayerNotes, setNewPrayerNotes] = useState("");

  const filteredMine = React.useMemo(() => {
    return prayingSessions.filter((s) => s.date === selectedDate);
  }, [prayingSessions, selectedDate]);

  const filteredPartner = React.useMemo(() => {
    return partnerPrayingSessions.filter((s) => s.date === selectedDate);
  }, [partnerPrayingSessions, selectedDate]);

  // Auto load slots if empty
  const handleLoadDefaultSlots = async () => {
    setLoadingId("loading_slots");
    try {
      const colRef = collection(db, "users", userProfile.uid, "prayingSessions");
      for (const slot of DEFAULT_PRAYER_SLOTS) {
        await addDoc(colRef, {
          title: slot.title,
          type: slot.type,
          status: "missed", // default state
          date: selectedDate,
          notes: "",
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${userProfile.uid}/prayingSessions`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleTogglePrayer = async (slotTitle: string, currentMatch: PrayingSession | undefined, isCoupleType: boolean) => {
    const nextStatus = currentMatch?.status === "completed" ? "missed" : "completed";
    setLoadingId(`toggle_${slotTitle}`);
    
    try {
      if (currentMatch) {
         // Update existing
         await updateDoc(doc(db, "users", userProfile.uid, "prayingSessions", currentMatch.id), {
           status: nextStatus,
           completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
         });
      } else {
         // Create fresh
         await addDoc(collection(db, "users", userProfile.uid, "prayingSessions"), {
           title: slotTitle,
           type: isCoupleType ? "couple" : "solo",
           status: "completed",
           date: selectedDate,
           notes: "",
           completedAt: new Date().toISOString(),
         });
      }

      // Xp delta calculation: Completed prayer awards 15 Individual & Couple XP
      const xpReward = nextStatus === "completed" ? 15 : -15;
      const { exp: uExp, level: uLevel } = addExp(userProfile.exp, userProfile.level, xpReward);
      await updateDoc(doc(db, "users", userProfile.uid), {
        exp: uExp,
        level: uLevel,
        lastActiveAt: new Date().toISOString(),
      });

      if (couple && xpReward > 0) {
        const sharedUpgradeXpLimit = couple.sharedLevel * 150;
        let newSharedExp = couple.sharedExp + xpReward;
        let newSharedLevel = couple.sharedLevel;
        while (newSharedExp >= sharedUpgradeXpLimit) {
          newSharedExp -= sharedUpgradeXpLimit;
          newSharedLevel += 1;
        }

        await updateDoc(doc(db, "couples", couple.id), {
          sharedExp: newSharedExp,
          sharedLevel: newSharedLevel,
        });

        // Also add a friendly schedule logging item automatically for extra tracking!
        try {
          await addDoc(collection(db, "users", userProfile.uid, "scheduleItems"), {
            title: `Completed Devotional Node: ${slotTitle}`,
            category: "prayer",
            startTime: new Date().toTimeString().split(" ")[0].slice(0, 5),
            endTime: new Date(Date.now() + 15 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5),
            isAdjusted: false,
            status: "completed",
            date: selectedDate,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Could not automatically record schedule log for prayer:", e);
        }
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}/prayingSessions`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleCustomPrayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayerTitle) return;
    setLoadingId("creating_custom");

    try {
      await addDoc(collection(db, "users", userProfile.uid, "prayingSessions"), {
        title: newPrayerTitle,
        type: newPrayerType,
        status: "completed",
        date: selectedDate,
        notes: newPrayerNotes,
        completedAt: new Date().toISOString(),
      });

      // Award XP
      const { exp: uExp, level: uLevel } = addExp(userProfile.exp, userProfile.level, 15);
      await updateDoc(doc(db, "users", userProfile.uid), {
        exp: uExp,
        level: uLevel,
      });

      if (couple) {
        const reqCoveXp = couple.sharedLevel * 150;
        let sharedXp = couple.sharedExp + 15;
        let sharedLevel = couple.sharedLevel;
        while (sharedXp >= reqCoveXp) {
          sharedXp -= reqCoveXp;
          sharedLevel += 1;
        }
        await updateDoc(doc(db, "couples", couple.id), {
          sharedExp: sharedXp,
          sharedLevel,
        });
      }

      setNewPrayerTitle("");
      setNewPrayerNotes("");
      setShowLogForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${userProfile.uid}/prayingSessions`);
    } finally {
      setLoadingId(null);
    }
  };

  const getSpiritualSync = () => {
    if (DEFAULT_PRAYER_SLOTS.length === 0) return 100;
    
    // Count matches where both partners or active partner clicked completed
    let totalCompletedSlots = 0;
    
    const slots = Array.from(new Set([
      ...DEFAULT_PRAYER_SLOTS.map(st => st.title),
      ...filteredMine.map(pm => pm.title),
      ...filteredPartner.map(pp => pp.title)
    ]));

    if (slots.length === 0) return 100;

    slots.forEach(slot => {
      const mineOk = filteredMine.find(f => f.title === slot)?.status === "completed";
      const partnerOk = partnerProfile ? filteredPartner.find(f => f.title === slot)?.status === "completed" : true;
      if (mineOk && partnerOk) {
        totalCompletedSlots += 1;
      } else if (mineOk || partnerOk) {
        totalCompletedSlots += 0.5; // partial sync
      }
    });

    return Math.floor((totalCompletedSlots / slots.length) * 100);
  };

  const spiritualHarmony = getSpiritualSync();

  return (
    <div id="prayer_track_container" className="space-y-6">
      {/* Dynamic Date Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        <div className="flex items-center space-x-3">
          <Cross className="h-5 w-5 text-emerald-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          />
        </div>

        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs text-slate-100 rounded-xl font-sans font-medium flex items-center space-x-2 transition shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Log Spontaneous Prayer Node</span>
        </button>
      </div>

      {/* Spontaneous log popover */}
      <AnimatePresence>
        {showLogForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h4 className="text-sm font-mono text-emerald-400 uppercase font-semibold mb-4 tracking-wider">Log Spontaneous Devotion Node</h4>
            <form onSubmit={handleCustomPrayerSubmit} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Prayer Intent Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Prayer for partner's study, Healing, Thanksgiving"
                    value={newPrayerTitle}
                    onChange={(e) => setNewPrayerTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Covenant Link</label>
                  <select
                    value={newPrayerType}
                    onChange={(e) => setNewPrayerType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none"
                  >
                    <option value="solo">Solitary Devotional Session</option>
                    <option value="couple">United Couple Alignment Devotion</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Meditative Journal / Prayer Notes</label>
                <textarea
                  placeholder="e.g. Expressing gratitude for mutual leveling, seeking patience in relationships."
                  value={newPrayerNotes}
                  onChange={(e) => setNewPrayerNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="px-4 py-2 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-xl transition"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={loadingId !== null}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-xs text-slate-100 rounded-xl font-sans font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {loadingId === "creating_custom" ? "Recording..." : "Register Devotion Node (+15 XP)"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spiritual Sync score gauge */}
      <div id="prayer_sync_card" className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center md:justify-between gap-4">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />

        <div className="flex items-center space-x-3.5 text-center md:text-left">
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-full animate-pulse">
            <Heart className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Duo Spiritual Alignment</h4>
            <p className="text-xs text-slate-400">
              Devotional sync rate computed dynamically from completed morning-to-evening devotions.
            </p>
          </div>
        </div>

        <div className="flex items-baseline space-x-2 shrink-0">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Alignment Factor:</span>
          <span className="text-3xl font-mono font-black text-emerald-400">{spiritualHarmony}%</span>
        </div>
      </div>

      {/* Main Devotion Nodes List */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono text-emerald-400 uppercase font-semibold flex items-center space-x-2 tracking-widest pl-1">
          <Sun className="h-4 w-4 text-emerald-400" />
          <span>Schedules Devotional Logs</span>
        </h3>

        {filteredMine.length === 0 && filteredPartner.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 bg-slate-950/20">
            <Cross className="h-8 w-8 text-slate-600 animate-pulse" />
            <div>
              <h4 className="text-sm font-semibold text-slate-300 font-sans">No spiritual logs tracked on {selectedDate}</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Establish morning, sunset, or evening slots to track mutual connection sync in real-time.
              </p>
            </div>
            <button
              onClick={handleLoadDefaultSlots}
              disabled={loadingId === "loading_slots"}
              className="px-5 py-2.5 bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-bold rounded-xl flex items-center space-x-2 transition cursor-pointer"
            >
              <span>Map Daily Prayer Modules (+4 Slots)</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* Merge default template slots with custom ones dynamically to display side-by-side */}
            {Array.from(new Set([
              ...DEFAULT_PRAYER_SLOTS.map(s => s.title),
              ...filteredMine.map(pm => pm.title),
              ...filteredPartner.map(pp => pp.title)
            ])).map((titleName) => {
              const myMatched = filteredMine.find((f) => f.title === titleName);
              const partnerMatched = filteredPartner.find((f) => f.title === titleName);

              const isCoupleType = DEFAULT_PRAYER_SLOTS.find(df => df.title === titleName)?.type === "couple" || 
                                    myMatched?.type === "couple" || partnerMatched?.type === "couple";

              const myCompleted = myMatched?.status === "completed";
              const partnerCompleted = partnerMatched?.status === "completed";

              return (
                <div
                  key={titleName}
                  className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <Flame className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-sans font-medium text-slate-200">{titleName}</h4>
                      <span className="text-[10px] font-mono uppercase text-indigo-400 bg-indigo-950/20 px-2 py-0.5 rounded border border-indigo-500/20 mt-0.5 inline-block">
                        {isCoupleType ? "Group United Covenant" : "Private Solitary Devotional"}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-side verification statuses */}
                  <div className="flex items-center justify-start sm:justify-end space-x-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800/40">
                    {/* User Slot */}
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-slate-400">You:</span>
                      <button
                        onClick={() => handleTogglePrayer(titleName, myMatched, isCoupleType)}
                        disabled={loadingId !== null}
                        className={`p-1 rounded-lg border transition ${
                          myCompleted
                            ? "bg-emerald-500 border-emerald-400 text-slate-950"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-emerald-500"
                        }`}
                      >
                        <Check className="h-4.5 w-4.5" />
                      </button>
                    </div>

                    {/* Partner Slot */}
                    {partnerProfile ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono text-slate-400">{partnerProfile.displayName || "Partner"}:</span>
                        <div
                          className={`p-1 rounded-lg border flex items-center justify-center ${
                            partnerCompleted
                              ? "bg-indigo-500 border-indigo-400 text-slate-950"
                              : "bg-slate-950 border-slate-800 text-slate-700"
                          }`}
                        >
                          <Check className="h-4.5 w-4.5" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center text-[10px] font-mono text-slate-500 italic">
                        Partner not connected
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
