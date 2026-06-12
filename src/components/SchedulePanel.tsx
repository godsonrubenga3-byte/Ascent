import React, { useState } from "react";
import { db, handleFirestoreError, OperationType, collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from "../lib/firebase";
import { UserProfile, Couple, ScheduleItem } from "../types";
import { addExp } from "./DuoStatus";
import { Calendar, Clock, Plus, CheckCircle, XCircle, Settings, Edit, Loader2, Sparkles, Check, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SchedulePanelProps {
  userProfile: UserProfile;
  couple: Couple | null;
  scheduleItems: ScheduleItem[];
  partnerScheduleItems: ScheduleItem[];
  partnerProfile: UserProfile | null;
  activeTab: "mine" | "partner";
}

// Default layout templates for daily quest leveling
export const DEFAULT_SCHEDULE_TEMPLATES = [
  { title: "Wake-up & Quiet Prayer Devotion", startTime: "06:00", endTime: "06:45", category: "prayer" },
  { title: "Physical Solitary Workout Session", startTime: "07:00", endTime: "08:15", category: "workout" },
  { title: "Elite Skill Training: Financial Trading Practice", startTime: "09:00", endTime: "11:30", category: "skill" },
  { title: "Digital Marketing Strategy & Study", startTime: "13:00", endTime: "14:30", category: "skill" },
  { title: "Physical/Digital Lore Exploration: Greek Mythology", startTime: "15:00", endTime: "16:30", category: "exploration" },
  { title: "Graphic Designing & Artwork Practice", startTime: "17:00", endTime: "18:30", category: "skill" },
  { title: "Hobby Study: Sound & Music Instruments", startTime: "21:00", endTime: "22:00", category: "exploration" },
  { title: "Night Prayer & Partner Devotion Sync", startTime: "22:15", endTime: "22:45", category: "prayer" },
];

export default function SchedulePanel({
  userProfile,
  couple,
  scheduleItems,
  partnerScheduleItems,
  partnerProfile,
  activeTab,
}: SchedulePanelProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Form states for adding a new customizable task
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addCategory, setAddCategory] = useState<any>("routine");
  const [addStartTime, setAddStartTime] = useState("08:00");
  const [addEndTime, setAddEndTime] = useState("09:00");

  // Form states for adjusting timings of a task
  const [adjustingItem, setAdjustingItem] = useState<ScheduleItem | null>(null);
  const [adjustedStart, setAdjustedStart] = useState("");
  const [adjustedEnd, setAdjustedEnd] = useState("");

  const filteredItems = (activeTab === "mine" ? scheduleItems : partnerScheduleItems).filter(
    (item) => item.date === selectedDate
  );

  // Pre-populate schedules if none exist today
  const handleLoadTemplate = async () => {
    setLoadingAction("load_template");
    try {
      const batchRef = collection(db, "users", userProfile.uid, "scheduleItems");
      for (const temp of DEFAULT_SCHEDULE_TEMPLATES) {
        await addDoc(batchRef, {
          title: temp.title,
          startTime: temp.startTime,
          endTime: temp.endTime,
          category: temp.category,
          isAdjusted: false,
          status: "pending",
          date: selectedDate,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${userProfile.uid}/scheduleItems`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle) return;
    setLoadingAction("create");
    try {
      const taskColRef = collection(db, "users", userProfile.uid, "scheduleItems");
      await addDoc(taskColRef, {
        title: addTitle,
        category: addCategory,
        startTime: addStartTime,
        endTime: addEndTime,
        isAdjusted: false,
        status: "pending",
        date: selectedDate,
        updatedAt: new Date().toISOString(),
      });
      // reset form
      setAddTitle("");
      setAddCategory("routine");
      setAddStartTime("08:00");
      setAddEndTime("09:00");
      setShowAddForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${userProfile.uid}/scheduleItems`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Adjust timing of an existing quest
  const handleAdjustTiming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    setLoadingAction(`adjust_${adjustingItem.id}`);
    try {
      const docRef = doc(db, "users", userProfile.uid, "scheduleItems", adjustingItem.id);
      await updateDoc(docRef, {
        adjustedStartTime: adjustedStart,
        adjustedEndTime: adjustedEnd,
        isAdjusted: true,
        updatedAt: new Date().toISOString(),
      });
      setAdjustingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}/scheduleItems/${adjustingItem.id}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Calculate self discipline score and award level XP
  const updateDisciplineRateAndXP = async (newItems: ScheduleItem[], xpReward: number) => {
    const completedCount = newItems.filter((i) => i.status === "completed").length;
    const totalRated = newItems.filter((i) => i.status !== "pending").length;
    
    // Discipline score: ratio of completed to graded activities
    const disciplineScore = totalRated > 0 ? Math.floor((completedCount / totalRated) * 100) : 100;

    // Apply XP to individual
    const { exp: uExp, level: uLevel } = addExp(userProfile.exp, userProfile.level, xpReward);

    try {
      // Base user profile update
      await updateDoc(doc(db, "users", userProfile.uid), {
        disciplineScore,
        exp: uExp,
        level: uLevel,
        lastActiveAt: new Date().toISOString(),
      });

      // Joint couple covenant reward
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
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    }
  };

  const handleUpdateStatus = async (item: ScheduleItem, newStatus: "completed" | "missed" | "pending") => {
    setLoadingAction(`status_${item.id}`);
    try {
      const docRef = doc(db, "users", userProfile.uid, "scheduleItems", item.id);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Prepare updated local array to compute real-time scores
      const updatedLocalList = scheduleItems.map((i) =>
        i.id === item.id ? { ...i, status: newStatus } : i
      );

      // Rule: Completed yields +20 XP. Turning from completed to pending/missed takes -20 XP back.
      let xpDelta = 0;
      if (newStatus === "completed" && item.status !== "completed") {
        xpDelta = 20;
      } else if (newStatus !== "completed" && item.status === "completed") {
        xpDelta = -20;
      }

      await updateDisciplineRateAndXP(updatedLocalList, xpDelta);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}/scheduleItems/${item.id}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Abandon this quest from your system?")) return;
    setLoadingAction(`delete_${itemId}`);
    try {
      await deleteDoc(doc(db, "users", userProfile.uid, "scheduleItems", itemId));
      // Re-calculate scores
      const updatedLocal = scheduleItems.filter((i) => i.id !== itemId);
      await updateDisciplineRateAndXP(updatedLocal, 0);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userProfile.uid}/scheduleItems/${itemId}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "workout":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "exploration":
        return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
      case "skill":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "prayer":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "leisure":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-700";
    }
  };

  return (
    <div id="schedule_panel_wrapper" className="space-y-6">
      {/* Date Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm font-sans text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
          />
        </div>

        {activeTab === "mine" && (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs text-slate-100 font-sans font-medium rounded-xl flex items-center space-x-2 transition shadow-md shadow-indigo-950/40 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Initialize Custom Quest</span>
            </button>
          </div>
        )}
      </div>

      {/* Dynamic forms area */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h4 className="text-sm font-mono text-cyan-400 uppercase font-semibold mb-4 tracking-wider">Configure Custom Leveling Quest</h4>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Quest Title Name</label>
                <input
                  type="text"
                  placeholder="e.g., Read Greek Mythology, Study candlestick patterns"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Category Classification</label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="routine">Routine</option>
                  <option value="workout">Workout</option>
                  <option value="exploration">Exploration</option>
                  <option value="skill">Skill Improvement</option>
                  <option value="prayer">Prayer Synced</option>
                  <option value="leisure">Leisure</option>
                </select>
              </div>

              <div className="flex space-x-2 items-end">
                <div className="w-1/2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-100"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div className="md:col-span-4 flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-xl transition"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === "create"}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-xs text-slate-100 rounded-xl font-sans font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {loadingAction === "create" ? "Integrating..." : "Seal Quest Link"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustingItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden"
          >
            {/* Solo Leveling Warning Accent */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500 animate-pulse" />
            
            <div className="flex items-center space-x-2 text-amber-400 mb-3">
              <AlertTriangle className="h-4.5 w-4.5" />
              <h4 className="text-sm font-mono uppercase font-semibold tracking-wider">Adjustment Matrix Engine</h4>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">
              "Things may happen in between." Adjust the timeline for <strong className="text-slate-200">"{adjustingItem.title}"</strong> without losing system discipline integrity. Leveling points will still be awarded!
            </p>

            <form onSubmit={handleAdjustTiming} className="flex flex-col sm:flex-row items-end gap-4 max-w-xl">
              <div className="w-full sm:w-1/3">
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Adjusted Start</label>
                <input
                  type="time"
                  value={adjustedStart}
                  onChange={(e) => setAdjustedStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="w-full sm:w-1/3">
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Adjusted End</label>
                <input
                  type="time"
                  value={adjustedEnd}
                  onChange={(e) => setAdjustedEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-xl transition w-1/2 sm:w-auto"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === `adjust_${adjustingItem.id}`}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-xs text-slate-100 rounded-xl font-sans font-medium hover:opacity-90 disabled:opacity-50 w-1/2 sm:w-auto"
                >
                  Apply Shift
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Quests Display Area */}
      <div className="space-y-4">
        <h3 className="text-sm font-mono text-indigo-400 uppercase font-semibold flex items-center space-x-2 tracking-widest pl-1">
          <Clock className="h-4 w-4" />
          <span>{activeTab === "mine" ? "Your Active Daily Quest Log" : `${partnerProfile?.displayName || "Ally"}'s Daily Quest Log`}</span>
          <span className="text-xs font-sans text-slate-500 italic">({selectedDate})</span>
        </h3>

        {filteredItems.length === 0 ? (
          <div id="empty-schedule-card" className="border border-dashed border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 bg-slate-950/20">
            <Calendar className="h-8 w-8 text-slate-600 animate-pulse" />
            <div>
              <h4 className="text-sm font-semibold text-slate-300">No level system logs recorded for today</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                You can initialize today with our default Level-Up template sequence or set up custom quests manually.
              </p>
            </div>

            {activeTab === "mine" && (
              <button
                onClick={handleLoadTemplate}
                disabled={loadingAction === "load_template"}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-cyan-400 font-bold rounded-xl flex items-center space-x-2 transition cursor-pointer"
              >
                {loadingAction === "load_template" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                ) : (
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                )}
                <span>Populate Default Quest Timeline (+8 Nodes)</span>
              </button>
            )}
          </div>
        ) : (
          <div id="schedule_items_bento_grid" className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => {
              const isMineAndPending = activeTab === "mine";
              const isPending = item.status === "pending";
              const isCompleted = item.status === "completed";
              const isMissed = item.status === "missed";

              return (
                <div
                  key={item.id}
                  id={`item_${item.id}`}
                  className={`group relative flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl border transition duration-300 ${
                    isCompleted
                      ? "bg-emerald-950/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                      : isMissed
                      ? "bg-red-950/10 border-red-500/20"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Quest status indicators glow */}
                  <div className="flex items-start sm:items-center space-x-4">
                    {/* Checkbox trigger */}
                    {isMineAndPending ? (
                      <button
                        onClick={() => handleUpdateStatus(item, isCompleted ? "pending" : "completed")}
                        disabled={loadingAction?.startsWith("status")}
                        className={`mt-1 sm:mt-0 p-1 rounded-lg border transition ${
                          isCompleted
                            ? "bg-emerald-500 border-emerald-400 text-slate-950"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:border-cyan-500"
                        }`}
                        title="Mark Completed"
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : <div className="h-4 w-4" />}
                      </button>
                    ) : (
                      <div className="p-1">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                        ) : isMissed ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-slate-700 animate-pulse bg-slate-800" />
                        )}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h4 className={`text-sm font-sans font-medium transition ${isCompleted ? "text-slate-400 line-through" : "text-slate-100"}`}>
                          {item.title}
                        </h4>
                        
                        {/* Category tag */}
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>

                        {/* Timing Adjustment Marker */}
                        {item.isAdjusted && (
                          <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                            Adjusted Time
                          </span>
                        )}
                      </div>

                      {/* Display Timing info */}
                      <div className="flex items-center space-x-4 text-xs font-mono text-slate-400 mt-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {item.isAdjusted ? (
                            <>
                              <span className="line-through text-slate-600">{item.startTime} - {item.endTime}</span>
                              <ChevronRight className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-400 font-bold">{item.adjustedStartTime} - {item.adjustedEndTime}</span>
                            </>
                          ) : (
                            <span>{item.startTime} - {item.endTime}</span>
                          )}
                        </span>
                        
                        {isCompleted && (
                          <span className="text-emerald-400 font-bold">+20 XP Granted</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  {isMineAndPending && (
                    <div className="flex items-center space-x-2 mt-4 sm:mt-0 ml-9 sm:ml-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition duration-200">
                      {/* Mark Missed */}
                      {!isCompleted && !isMissed && (
                        <button
                          onClick={() => handleUpdateStatus(item, "missed")}
                          className="px-2.5 py-1.5 border border-red-500/30 text-[10px] uppercase font-mono font-bold text-red-400 hover:bg-red-950/20 rounded-xl transition cursor-pointer"
                        >
                          Mark Missed
                        </button>
                      )}

                      {isMissed && (
                        <button
                          onClick={() => handleUpdateStatus(item, "pending")}
                          className="px-2.5 py-1.5 border border-slate-800 text-[10px] uppercase font-mono text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"
                        >
                          Restore
                        </button>
                      )}

                      {/* Adjust timing button */}
                      <button
                        onClick={() => {
                          setAdjustingItem(item);
                          setAdjustedStart(item.adjustedStartTime || item.startTime);
                          setAdjustedEnd(item.adjustedEndTime || item.endTime);
                        }}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-xl transition"
                        title="Adjust timing slot"
                      >
                        <Settings className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl transition"
                        title="Abandon quest"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
