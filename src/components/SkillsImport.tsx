import React, { useState } from "react";
import { db, handleFirestoreError, OperationType, collection, doc, addDoc, updateDoc, deleteDoc } from "../lib/firebase";
import { UserProfile, Couple, Skill } from "../types";
import { addExp } from "./DuoStatus";
import { TrendingUp, Sparkles, BookOpen, Volume2, ShieldAlert, Award, Play, Plus, Book, Trash2, Check, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SkillsImportProps {
  userProfile: UserProfile;
  couple: Couple | null;
  skills: Skill[];
  partnerSkills: Skill[];
  partnerProfile: UserProfile | null;
  activeTab: "mine" | "partner";
}

// Pre-defined set of available initial income/hobby skills for quick activation
export const STARTER_SKILLS = [
  { name: "Financial Day & Swing Trading", category: "income", description: "Analyzing charts, indicators, risk management, and order entries." },
  { name: "Digital Marketing & Copywriting", category: "income", description: "SEO, conversion copywriting, paid ads, and social marketing campaigns." },
  { name: "Public Speaking & Rhetoric", category: "income", description: "Vocal control, storytelling, body language, and convincing engagement." },
  { name: "Graphic Designing & UI Art", category: "income", description: "Visual composition, typography pairing, wireframes, and layout brand templates." },
];

export default function SkillsImport({
  userProfile,
  couple,
  skills,
  partnerSkills,
  partnerProfile,
  activeTab,
}: SkillsImportProps) {
  const [loadingSkillId, setLoadingSkillId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Custom Skill Add
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState<any>("income");

  // Logging Sessions
  const [trainingSkill, setTrainingSkill] = useState<Skill | null>(null);
  const [trainDuration, setTrainDuration] = useState("30");
  const [trainNotes, setTrainNotes] = useState("");

  const activeSkillsList = React.useMemo(() => {
    return activeTab === "mine" ? skills : partnerSkills;
  }, [activeTab, skills, partnerSkills]);

  const handleImportSkill = async (name: string, category: "income" | "workout" | "exploration" | "custom") => {
    setLoadingSkillId("importing");
    try {
      const colRef = collection(db, "users", userProfile.uid, "skills");
      await addDoc(colRef, {
        name,
        category,
        level: 1,
        exp: 0,
        isImported: true,
      });
      setNewSkillName("");
      setShowAddForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${userProfile.uid}/skills`);
    } finally {
      setLoadingSkillId(null);
    }
  };

  const handleCustomSkillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName) return;
    handleImportSkill(newSkillName, newSkillCategory);
  };

  const handleTrainSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingSkill) return;
    setLoadingSkillId(`training_${trainingSkill.id}`);

    const duration = parseInt(trainDuration) || 30;
    // XP math: +30 Skill XP, +30 User Profile XP, +30 Couple XP
    const earnedXp = Math.floor(duration * 0.8) + 10; 

    // Compute updated subcollection Skill levels
    let currentSkillXp = trainingSkill.exp + earnedXp;
    let currentSkillLevel = trainingSkill.level;
    const reqSkillXp = currentSkillLevel * 100;
    let didLevelUpSkill = false;

    while (currentSkillXp >= reqSkillXp) {
      currentSkillXp -= reqSkillXp;
      currentSkillLevel += 1;
      didLevelUpSkill = true;
    }

    try {
      // 1. Update Subcollection Skill stats
      await updateDoc(doc(db, "users", userProfile.uid, "skills", trainingSkill.id), {
        level: currentSkillLevel,
        exp: currentSkillXp,
      });

      // 2. Award User level EXP
      const { exp: uExp, level: uLevel } = addExp(userProfile.exp, userProfile.level, earnedXp * 1.5);
      await updateDoc(doc(db, "users", userProfile.uid), {
        exp: uExp,
        level: uLevel,
        lastActiveAt: new Date().toISOString(),
      });

      // 3. Award couple covenant level EXP
      if (couple) {
        const sharedUpgradeXpLimit = couple.sharedLevel * 150;
        let newSharedExp = couple.sharedExp + Math.floor(earnedXp * 1.5);
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

      // Record a mock schedule task to schedules matching this training automatically!
      try {
        await addDoc(collection(db, "users", userProfile.uid, "scheduleItems"), {
          title: `Trained Skill: ${trainingSkill.name} (${trainNotes || 'Self study'})`,
          category: trainingSkill.category === "custom" ? "routine" : trainingSkill.category,
          startTime: new Date().toTimeString().split(" ")[0].slice(0, 5),
          endTime: new Date(Date.now() + duration * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5),
          isAdjusted: false,
          status: "completed",
          date: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString(),
        });
      } catch (errTask) {
        console.error("Failed to automatically push schedule training node:", errTask);
      }

      setTrainingSkill(null);
      setTrainNotes("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}/skills/${trainingSkill.id}`);
    } finally {
      setLoadingSkillId(null);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!window.confirm("Abandon training this specialty permanent node? It resets leveling stats.")) return;
    setLoadingSkillId(`deleting_${skillId}`);
    try {
      await deleteDoc(doc(db, "users", userProfile.uid, "skills", skillId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userProfile.uid}/skills/${skillId}`);
    } finally {
      setLoadingSkillId(null);
    }
  };

  const getSkillCategoryIcon = (category: string) => {
    switch (category) {
      case "income":
        return <TrendingUp className="h-5 w-5 text-emerald-400 font-semibold" />;
      case "workout":
        return <Award className="h-5 w-5 text-amber-500" />;
      case "exploration":
        return <BookOpen className="h-5 w-5 text-indigo-400" />;
      default:
        return <Book className="h-5 w-5 text-cyan-400" />;
    }
  };

  const unimportedStarters = STARTER_SKILLS.filter(
    (starter) => !skills.some((s) => s.name.toLowerCase().includes(starter.name.split(" ")[starter.name.split(" ").length - 1].toLowerCase()))
  );

  return (
    <div id="skills_hub_container" className="space-y-6">
      {/* Dynamic import forms */}
      {activeTab === "mine" && (
        <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-mono text-slate-100 font-bold uppercase tracking-widest pl-1">
              Active Specialties Matrix
            </h3>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 border border-slate-700 hover:border-cyan-500 text-xs text-cyan-400 font-bold font-sans rounded-xl flex items-center space-x-2 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Import Custom Specialty Node</span>
          </button>
        </div>
      )}

      {/* Specialty Training trigger form popover */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6"
          >
            <h4 className="text-sm font-mono text-cyan-400 uppercase font-semibold mb-4 tracking-wider">Configure Custom Specialty Node</h4>
            <form onSubmit={handleCustomSkillSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Specialty Name</label>
                <input
                  type="text"
                  placeholder="e.g., Fullstack Engineering, Content Script Writing, Greek mythology, Piano"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Class Theme</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="income">High-Income Catalyst</option>
                  <option value="workout">Physical Form (Fitness)</option>
                  <option value="exploration">Exploration (Greek Lore, Geography)</option>
                  <option value="custom">Hobby or Alternate Interest</option>
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-xl transition"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={loadingSkillId === "importing"}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-xs text-slate-100 rounded-xl font-sans font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {loadingSkillId === "importing" ? "Forging Node..." : "Establish Skill Connection"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skill training training logger popover */}
      <AnimatePresence>
        {trainingSkill && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400" />
            
            <h4 className="text-sm font-mono text-cyan-400 uppercase font-semibold mb-2 tracking-wider flex items-center space-x-2">
              <Play className="h-4.5 w-4.5 text-cyan-400" />
              <span>Log Training Practice Node: {trainingSkill.name}</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Practice sessions feed direct user and partnership level scales. Select duration to calculate earned system experience points (EXP).
            </p>

            <form onSubmit={handleTrainSkill} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Practice Duration</label>
                <select
                  value={trainDuration}
                  onChange={(e) => setTrainDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="15">15 Minutes (Micro trial)</option>
                  <option value="30">30 Minutes (Core focus)</option>
                  <option value="60">1 Hour (Intense study)</option>
                  <option value="120">2 Hours (Flow masterclass)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Focus Notes / Logging Notes</label>
                <input
                  type="text"
                  placeholder="e.g. studied ICT market models, practiced guitar scales"
                  value={trainNotes}
                  onChange={(e) => setTrainNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => setTrainingSkill(null)}
                  className="px-4 py-2 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={loadingSkillId === `training_${trainingSkill.id}`}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 text-xs text-slate-100 rounded-xl font-sans font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {loadingSkillId === `training_${trainingSkill.id}` ? "Absorbing EXP..." : "Lock Training Hour"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skill List Display */}
      {activeSkillsList.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4 bg-slate-950/20">
          <Award className="h-8 w-8 text-slate-600 animate-pulse" />
          <div>
            <h4 className="text-sm font-semibold text-slate-300">Active skill matrix is currently empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {activeTab === "mine"
                ? "Improve joint income capacities or exploration wisdom by unlocking high-income specialties below."
                : "Your partner hasn't loaded any specialties yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {activeSkillsList.map((skill) => {
            const reqSkillXp = skill.level * 100;
            const skillXpPercent = Math.min(100, Math.floor((skill.exp / reqSkillXp) * 100));

            return (
              <div
                key={skill.id}
                className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 p-3 flex space-x-1">
                  {activeTab === "mine" && (
                    <>
                      <button
                        onClick={() => setTrainingSkill(skill)}
                        className="p-1 text-slate-400 hover:text-cyan-400 bg-slate-950 border border-slate-800 rounded-lg hover:border-cyan-500/45 transition"
                        title="Train Specialty Node"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="p-1 text-slate-400 hover:text-red-500 bg-slate-950 border border-slate-800 rounded-lg transition"
                        title="Delete Specialty"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <div className="flex items-center space-x-2.5 mb-3">
                    <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-xl">
                      {getSkillCategoryIcon(skill.category)}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-500 block leading-none">
                        Category: {skill.category}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-100 mt-0.5">{skill.name}</h4>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-4 border-t border-slate-800/40">
                    <div className="flex items-baseline justify-between text-xs font-mono">
                      <span className="text-cyan-400 font-bold">LV. {skill.level}</span>
                      <span className="text-slate-400">
                        {skill.exp} / {reqSkillXp} EXP
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${skillXpPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested income leveling triggers (starter skills shelf) */}
      {activeTab === "mine" && unimportedStarters.length > 0 && (
        <div id="starter_skills_shelf" className="pt-6 border-t border-slate-800/40">
          <h4 className="text-xs font-mono text-indigo-400 uppercase font-semibold mb-3 tracking-widest pl-1 flex items-center space-x-1">
            <ArrowUpRight className="h-4 w-4" />
            <span>Available Income Specialties (Import Catalyst)</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unimportedStarters.map((starter) => (
              <div
                key={starter.name}
                className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between"
              >
                <div>
                  <h5 className="text-xs font-bold text-slate-200">{starter.name}</h5>
                  <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">{starter.description}</p>
                </div>
                <button
                  onClick={() => handleImportSkill(starter.name, "income")}
                  disabled={loadingSkillId !== null}
                  className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 uppercase font-bold rounded-lg transition shrink-0 cursor-pointer"
                >
                  Unlock Node
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
