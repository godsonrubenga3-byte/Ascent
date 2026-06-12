/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInAnonymously,
  collection,
  doc,
  query,
  where,
  getDocs,
  setDoc,
  addDoc,
  onSnapshot,
  updateDoc,
} from "./lib/firebase";
import { UserProfile, Couple, Skill, ScheduleItem, PrayingSession, DailyInspiration } from "./types";
import DuoStatus, { addExp } from "./components/DuoStatus";
import SchedulePanel from "./components/SchedulePanel";
import SkillsImport from "./components/SkillsImport";
import PrayerTrack from "./components/PrayerTrack";
import { 
  Award, Shield, Calendar, Clock, Sparkles, User, Users, Compass, 
  BookOpen, Smartphone, ShieldCheck, Moon, RefreshCw, LogOut, Trophy, 
  Key, ArrowRight, Flame, Cross, Lock, Unlock, Zap, Heart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // Real-time Firestore State Data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);

  // User list resources
  const [mySkills, setMySkills] = useState<Skill[]>([]);
  const [myScheduleItems, setMyScheduleItems] = useState<ScheduleItem[]>([]);
  const [myPrayingSessions, setMyPrayingSessions] = useState<PrayingSession[]>([]);

  // Partner checklist lists (real-time sync!)
  const [partnerSkills, setPartnerSkills] = useState<Skill[]>([]);
  const [partnerScheduleItems, setPartnerScheduleItems] = useState<ScheduleItem[]>([]);
  const [partnerPrayingSessions, setPartnerPrayingSessions] = useState<PrayingSession[]>([]);

  // System general state variables
  const [activeTab, setActiveTab] = useState<"status" | "schedule" | "skills" | "prayers">("status");
  const [scheduleActiveSubtab, setScheduleActiveSubtab] = useState<"mine" | "partner">("mine");
  const [skillsActiveSubtab, setSkillsActiveSubtab] = useState<"mine" | "partner">("mine");
  const [coupleCodeInput, setCoupleCodeInput] = useState("");
  const [loadingUnionAction, setLoadingUnionAction] = useState<string | null>(null);

  // Dynamic Daily Inspiration state (Verse of the day/quote)
  const [dailyInspiration, setDailyInspiration] = useState<DailyInspiration | null>(null);
  const [loadingInspiration, setLoadingInspiration] = useState(false);

  // Phone restrict mode states
  const [isPhoneLocked, setIsPhoneLocked] = useState(false);
  const [phoneLockSeconds, setPhoneLockSeconds] = useState(0);

  const [authError, setAuthError] = useState<string | null>(null);

  // Group/Covenant login form states
  const [loginGroupName, setLoginGroupName] = useState("");
  const [loginPartnerName, setLoginPartnerName] = useState("");
  const [landingActiveTab, setLandingActiveTab] = useState<"concept" | "modules" | "start">("concept");

  const handleReinitDatabase = async () => {
    if (!window.confirm("Are you sure you want to completely re-initialize the database from scratch? This clears all existing player data, groups, schedules, and private logs.")) {
      return;
    }
    setLoadingUnionAction("login");
    setAuthError(null);
    try {
      const resp = await fetch("/api/db/reinit", { method: "POST" });
      if (!resp.ok) {
        throw new Error("HTTP connection failed with status code " + resp.status);
      }
      alert("Database reinitialized successfully! All covenants and logs are freshly cleared. You can now start completely fresh!");
      setLoginGroupName("");
      setLoginPartnerName("");
    } catch (e: any) {
      setAuthError("Failed to re-initialize database: " + e.message);
    } finally {
      setLoadingUnionAction(null);
    }
  };

  // --- 1. Authentic System Logins & Sandbox Support ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  const handleGroupLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginGroupName.trim() || !loginPartnerName.trim()) return;
    setLoadingUnionAction("login");
    setAuthError(null);
    try {
      const response = await fetch("/api/groups/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: loginGroupName.trim().toLowerCase(),
          partnerName: loginPartnerName.trim()
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to log in to premium group database.");
      }
      const state = await response.json();
      const resolvedRole = state.resolvedRole || "partner1";
      
      // Log inside the bridging MockAuth session instantly
      auth.setCurrentUser({
        uid: resolvedRole === "partner1" ? `${state.group.id}-p1` : `${state.group.id}-p2`,
        email: `${resolvedRole}@duoleveling.local`,
        displayName: loginPartnerName.trim(),
        groupId: state.group.id,
        activeRole: resolvedRole
      });
    } catch (err: any) {
      console.error("Login Error:", err);
      setAuthError(err.message || String(err));
    } finally {
      setLoadingUnionAction(null);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };


  // --- 3. Dynamic real-time listeners (The ultimate multi-device syncing engine) ---
  useEffect(() => {
    if (!currentUser) return;

    // Listen to user's profile
    const unsubProfile = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`));

    // Listen to user's subcollections
    const unsubSkills = onSnapshot(collection(db, "users", currentUser.uid, "skills"), (snap) => {
      setMySkills(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Skill[]);
    });

    const unsubSchedule = onSnapshot(collection(db, "users", currentUser.uid, "scheduleItems"), (snap) => {
      setMyScheduleItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ScheduleItem[]);
    });

    const unsubPrayers = onSnapshot(collection(db, "users", currentUser.uid, "prayingSessions"), (snap) => {
      setMyPrayingSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as PrayingSession[]);
    });

    return () => {
      unsubProfile();
      unsubSkills();
      unsubSchedule();
      unsubPrayers();
    };
  }, [currentUser]);

  // Listen to Couple covenant state & partner stats
  useEffect(() => {
    if (!userProfile?.coupleId) {
      setCouple(null);
      setPartnerProfile(null);
      return;
    }

    // Listen to Covenant document
    const unsubCouple = onSnapshot(doc(db, "couples", userProfile.coupleId), (snap) => {
      if (snap.exists()) {
        const cData = snap.data() as Couple;
        setCouple(cData);

        // Find Partner ID
        const partnerId = cData.partner1Id === currentUser.uid ? cData.partner2Id : cData.partner1Id;
        if (partnerId) {
          // Listen to Live Partner stats
          const unsubPartnerProfile = onSnapshot(doc(db, "users", partnerId), (pSnap) => {
            if (pSnap.exists()) {
              setPartnerProfile(pSnap.data() as UserProfile);
            }
          });

          // Listen to Live Partner checklists for side by side stats
          const unsubPartSkills = onSnapshot(collection(db, "users", partnerId, "skills"), (pSnap) => {
            setPartnerSkills(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Skill[]);
          });

          const unsubPartSchedule = onSnapshot(collection(db, "users", partnerId, "scheduleItems"), (pSnap) => {
            setPartnerScheduleItems(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ScheduleItem[]);
          });

          const unsubPartPrayers = onSnapshot(collection(db, "users", partnerId, "prayingSessions"), (pSnap) => {
            setPartnerPrayingSessions(pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PrayingSession[]);
          });

          return () => {
            unsubPartnerProfile();
            unsubPartSkills();
            unsubPartSchedule();
            unsubPartPrayers();
          };
        }
      }
    });

    return () => {
      unsubCouple();
    };
  }, [userProfile?.coupleId]);

  // --- 4. Fetch Scripture Inspiration & Quotes from Express endpoint ---
  const fetchInspiration = async () => {
    setLoadingInspiration(true);
    try {
      const response = await fetch("/api/daily-inspiration");
      if (response.ok) {
        const data = await response.json();
        setDailyInspiration(data);
      }
    } catch (e) {
      console.warn("Could not retrieve scripture inspiration quotes:", e);
    } finally {
      setLoadingInspiration(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchInspiration();
    }
  }, [currentUser]);

  // --- 5. Covenant Forging Actions ---
  const handleCreateCovenant = async () => {
    if (!userProfile) return;
    setLoadingUnionAction("create");
    try {
      const randomCode = "DUO-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const coupleId = doc(collection(db, "couples")).id;
      
      const newCouple: Couple = {
        id: coupleId,
        partner1Id: currentUser.uid,
        partner1Name: currentUser.displayName || "Duo Hero",
        inviteCode: randomCode,
        sharedLevel: 1,
        sharedExp: 0,
        createdAt: new Date().toISOString(),
      };

      // Set the covenant covenant doc
      await setDoc(doc(db, "couples", coupleId), newCouple);
      
      // Update user link
      await updateDoc(doc(db, "users", currentUser.uid), {
        coupleId: coupleId,
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "couples/new");
    } finally {
      setLoadingUnionAction(null);
    }
  };

  const handleJoinCovenant = async () => {
    if (!coupleCodeInput || !userProfile) return;
    const targetCode = coupleCodeInput.trim().toUpperCase();
    setLoadingUnionAction("join");

    try {
      const q = query(collection(db, "couples"), where("inviteCode", "==", targetCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert("The entered sacred covenant invitation code is invalid!");
        setLoadingUnionAction(null);
        return;
      }

      const matchCovenant = snap.docs[0].data() as Couple;
      if (matchCovenant.partner2Id) {
        alert("This covenant already has two active leveling partners!");
        setLoadingUnionAction(null);
        return;
      }

      // Link Partner 2 to Covenant
      await updateDoc(doc(db, "couples", matchCovenant.id), {
        partner2Id: currentUser.uid,
        partner2Name: currentUser.displayName || "Duo Ally",
      });

      // Link User Profile
      await updateDoc(doc(db, "users", currentUser.uid), {
        coupleId: matchCovenant.id,
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `couples/${coupleCodeInput}`);
    } finally {
      setLoadingUnionAction(null);
      setCoupleCodeInput("");
    }
  };

  // --- 6. Phone Usage Restrictor Timers ----
  useEffect(() => {
    let interval: any = null;
    if (isPhoneLocked) {
      interval = setInterval(() => {
        setPhoneLockSeconds(prev => prev + 1);
        
        // Every 60 seconds (1 minute locked) awards +1 User XP, +1 Couple XP to system!
        if ((phoneLockSeconds + 1) % 60 === 0 && userProfile) {
          const { exp: uExp, level: uLevel } = addExp(userProfile.exp, userProfile.level, 1);
          updateDoc(doc(db, "users", currentUser.uid), {
            exp: uExp,
            level: uLevel,
            phoneDisciplineBonus: (userProfile.phoneDisciplineBonus || 0) + 1,
          }).catch(e => console.warn("Incremental check error:", e));

          if (couple) {
            const reqCoveXp = couple.sharedLevel * 150;
            let sharedXp = couple.sharedExp + 1;
            let sharedLevel = couple.sharedLevel;
            if (sharedXp >= reqCoveXp) {
              sharedXp -= reqCoveXp;
              sharedLevel += 1;
            }
            updateDoc(doc(db, "couples", couple.id), {
              sharedExp: sharedXp,
              sharedLevel,
            }).catch(e => console.warn("Dual link incremental error:", e));
          }
        }
      }, 1000);
    } else {
      setPhoneLockSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isPhoneLocked, phoneLockSeconds, userProfile, couple]);

  const handleRecordPhoneUsage = async (m: number) => {
    if (!userProfile) return;
    const newMinutes = Math.max(0, userProfile.phoneMinutesToday + m);
    // Real-time discipline multiplier drops on excessive usage
    const bonusDeduct = m > 0 ? -2 : 2;
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        phoneMinutesToday: newMinutes,
        phoneDisciplineBonus: Math.max(0, userProfile.phoneDisciplineBonus + bonusDeduct),
      });
    } catch (e) {
      console.warn("Could not log minutes today:", e);
    }
  };

  // Rendering Loader on initial boot
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans space-y-3">
        <Sparkles className="h-8 w-8 text-cyan-400 animate-spin" />
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-widest font-mono select-none">
          SYNCHRONIZING LEVELING UNION...
        </h4>
      </div>
    );
  }

  // --- RENDERING AUTHENTICATION PANELS & SYSTEM INTRO LANDING PAGE ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 md:px-8 font-sans relative overflow-hidden py-12">
        {/* Aesthetic background glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/[0.04] blur-3xl rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/[0.04] blur-3xl rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-blue-500/[0.02] blur-[140px] rounded-full pointer-events-none" />

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* LEFT COLUMN: THE SYSTEM COVENANT MANUAL & GAMEPLAY INTRO */}
          <div className="lg:col-span-7 flex flex-col space-y-6 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-950/40 border border-cyan-500/30 rounded-full w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                COVENANT SYSTEM ENGAGEMENT MANUAL
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black text-slate-100 uppercase tracking-tight font-display leading-[1.05]">
                Conquer Daily Tasks <br/>
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  As Leveling Partners
                </span>
              </h1>
              <p className="text-sm md:text-base text-slate-400 leading-relaxed font-sans max-w-xl">
                Welcome to <strong className="text-slate-200">Duo Leveling</strong>, a gamified solo-leveling style discipline matrix built exclusively for partners, roommates, and couples to sync, track, and master habits together in real-time.
              </p>
            </div>

            {/* Interactive Tab pills for the onboarding guide */}
            <div className="flex border-b border-slate-900 pb-px space-x-4 max-w-md">
              {[
                { id: "concept", label: "🔥 Core Concept" },
                { id: "modules", label: "📊 System Modules" },
                { id: "start", label: "🚀 Getting Started" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLandingActiveTab(tab.id as any)}
                  className={`pb-2.5 text-xs font-mono font-bold tracking-wider uppercase border-b-2 transition relative cursor-pointer ${
                    landingActiveTab === tab.id
                      ? "border-cyan-400 text-cyan-400 font-extrabold"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB PORTALS */}
            <AnimatePresence mode="wait">
              {landingActiveTab === "concept" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 max-w-xl"
                >
                  <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-2xl space-y-3">
                    <h3 className="text-sm font-mono font-bold uppercase text-slate-200 flex items-center space-x-1.5">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <span>THE SOLO LEVELING RULEBOOK</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Duo Leveling takes inspiration from legendary game HUDs to transform life's daily frictions into leveling indicators. No more unacknowledged home chores, forgot-to-pray session schedules, or phone-screen doomscrolling waste.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Every completed deed, focus block, and skill training returns <strong className="text-cyan-400 font-semibold font-mono">EXP points</strong>. As you and your partner acquire EXP, both of your individual levels climb, which in turn fuels your shared <strong className="text-indigo-400 font-semibold font-mono">Duo Covenant Level</strong>.
                    </p>
                  </div>
                </motion.div>
              )}

              {landingActiveTab === "modules" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl"
                >
                  {[
                    {
                      icon: <Calendar className="h-4 w-4 text-cyan-400" />,
                      title: "Daily Quests",
                      desc: "Establish a list of routines. Check them off in real-time to gain stats and EXP together."
                    },
                    {
                      icon: <Award className="h-4 w-4 text-indigo-400" />,
                      title: "Specialty Hub",
                      desc: "Acquire & level-up custom vocational specialties like high-income tech skills or physical metrics."
                    },
                    {
                      icon: <Cross className="h-4 w-4 text-emerald-400" />,
                      title: "Devotion Matrix",
                      desc: "Synchronize daily reflections, prayer requests, or moments of silence side-by-side."
                    },
                    {
                      icon: <Lock className="h-4 w-4 text-amber-400" />,
                      title: "Phone Lock Ward",
                      desc: "Lock down your attention state with focus timers. Gaining +1 EXP for every minute of screen restriction."
                    },
                  ].map((feat, idx) => (
                    <div key={idx} className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
                      <div className="flex items-center space-x-2">
                        {feat.icon}
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">{feat.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">{feat.desc}</p>
                    </div>
                  ))}
                </motion.div>
              )}

              {landingActiveTab === "start" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3 max-w-xl text-xs text-slate-400"
                >
                  <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-3 font-sans leading-relaxed">
                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">1</div>
                      <p><strong>Create or Enter a Group Code:</strong> Choose any word (e.g., <code className="bg-slate-950 px-1 py-0.5 rounded text-cyan-400 font-mono">covenantteam</code>) and share it with your partner.</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">2</div>
                      <p><strong>Choose Unique Character Nicknames:</strong> One can log in as <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400 font-mono">Arthur</code> and the other as <code className="bg-slate-950 px-1 py-0.5 rounded text-teal-400 font-mono">Gwen</code>.</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">3</div>
                      <p><strong>Auto Role Allocation:</strong> The database engine automatically maps you to <strong>Partner 1</strong> or <strong>Partner 2</strong> slots instantly. No configuration manual required!</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT COLUMN: PORTAL OF INITIATION (LOGIN & SYNC CARD) */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div className="w-full max-w-md bg-slate-900/85 border border-slate-800/90 p-8 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
              
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-cyan-950/50 border border-cyan-500/40 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-950/40">
                  <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-black text-slate-100 uppercase tracking-widest font-sans bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  PORTAL INITIATION
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Forge your relational sync line with the covenant database.
                </p>
              </div>

              <form onSubmit={handleGroupLoginSubmit} className="space-y-4">
                {/* Group Code Word */}
                <div>
                  <label className="block text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase mb-1.5">
                    Covenant Group Code (Shared)
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. covenantteam"
                      value={loginGroupName}
                      onChange={(e) => setLoginGroupName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 font-sans focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 font-medium"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-sans">
                    Entering the exact same Group Code joins both players into the exact same dashboard.
                  </p>
                </div>

                {/* Partner Character Name */}
                <div>
                  <label className="block text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase mb-1.5">
                    Your Player Username inside Covenant
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Arthur, Gwen"
                      value={loginPartnerName}
                      onChange={(e) => setLoginPartnerName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 font-sans focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 font-medium"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-sans">
                    No complex signup flows. Individual avatar roles sync up automatically.
                  </p>
                </div>

                {/* Error alerts */}
                {authError && (
                  <div className="p-3 bg-red-950/30 border border-red-500/25 rounded-xl text-left">
                    <span className="text-[9px] font-mono text-rose-400 font-bold uppercase tracking-wider block mb-1">⚠️ Connection Refused</span>
                    <p className="text-xs text-rose-300 leading-normal">{authError}</p>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loadingUnionAction === "login"}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-slate-100 font-bold text-sm rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-950/30 cursor-pointer"
                >
                  <Zap className="h-4 w-4" />
                  <span>{loadingUnionAction === "login" ? "LINKING COVENANT..." : "INITIATE DUO QUEST LINK"}</span>
                </button>
              </form>

              <div className="flex flex-col items-center space-y-2 pt-2 border-t border-slate-800/40">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Duo Leveling Covenant System
                </span>
                <button
                  type="button"
                  onClick={handleReinitDatabase}
                  className="text-[9px] font-mono text-slate-600 hover:text-cyan-400 font-bold uppercase tracking-wider transition underline decoration-slate-800 hover:decoration-cyan-500 cursor-pointer"
                >
                  [ Re-initialize System Database ]
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }


  // --- MAIN APP OVERLAY: PHONE LOCKED DISCIPLINE TRANSIT ---
  if (isPhoneLocked && userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 font-sans relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/[0.02] blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-500/[0.02] blur-3xl rounded-full" />

        <div className="w-full max-w-md bg-slate-900/40 border border-emerald-500/20 p-8 rounded-3xl shadow-xl backdrop-blur-md text-center space-y-6 relative">
          {/* Animated locks */}
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl inline-block animate-pulse">
            <Lock className="h-8 w-8 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
              PHANTOM PHONE RESTRICTION ACTIVE
            </span>
            <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wide font-sans">
              Focus Period Initiated
            </h1>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Discipline counts ticking up. Gaining <strong className="text-emerald-400">+1 EXP/minute</strong> for you and dual covenant levels. Play instrument, read Greek mythology, or practice Day Trading now!
            </p>
          </div>

          {/* Locked timer display */}
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl font-mono">
            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Stealth Lock Duration</div>
            <div className="text-3xl font-black text-emerald-400">
              {Math.floor(phoneLockSeconds / 60).toString().padStart(2, "0")}:
              {(phoneLockSeconds % 60).toString().padStart(2, "0")}
            </div>
            <span className="text-[10px] text-emerald-500 font-semibold block mt-1">
              EXP Earned: +{Math.floor(phoneLockSeconds / 60)} XP Shared
            </span>
          </div>

          {dailyInspiration && (
            <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl text-left">
              <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block mb-1">Stealth Scripture Focus</span>
              <p className="text-xs text-slate-300 italic">"{dailyInspiration.verse}"</p>
              <cite className="block text-right text-[10px] font-mono text-emerald-400 not-italic mt-1">— {dailyInspiration.reference}</cite>
            </div>
          )}

          <button
            onClick={() => setIsPhoneLocked(false)}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 shadow-md transition cursor-pointer"
          >
            <Unlock className="h-4 w-4" />
            <span>Terminate Phone Lock Module</span>
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERING FULL ACTIVE HUD DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
      
      {/* Header HUD */}
      <header className="border-b border-slate-900 bg-slate-950/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/30 rounded-xl">
              <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-md font-sans font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                <span>Duo Leveling System</span>
                {couple && (
                  <span className="border border-cyan-500/30 text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/20 text-cyan-400">
                    DUO LEVEL {couple.sharedLevel}
                  </span>
                )}
              </h1>
              <span className="text-[10px] text-cyan-400 block -mt-0.5 font-mono uppercase tracking-wider font-bold">
                Covenant Alliance: Active
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="hidden sm:inline-block text-[10px] font-mono text-slate-500 uppercase select-none">
              Hero: {currentUser.email}
            </span>
            <button
              onClick={handleSignOut}
              className="px-3.5 py-1.5 border border-slate-800 hover:border-red-500/30 hover:bg-red-950/10 text-xs text-slate-300 hover:text-red-400 rounded-xl font-mono flex items-center space-x-1.5 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Covenant Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main HUD container */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left column sidebar widgets */}
        {userProfile && (
          <div className="lg:col-span-1 space-y-6">
            
            {/* Minimal profile HUD plate */}
            <div id="character_profile_card" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-500" />
              <div className="h-14 w-14 bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 mx-auto rounded-full flex items-center justify-center font-bold text-lg select-all mb-3 relative">
                <span>LV</span>
                <span className="text-cyan-200 ml-0.5 font-sans font-black text-xl">{userProfile.level}</span>
                <div className="absolute -bottom-1 -right-1 p-0.5 bg-slate-900 rounded-full border border-cyan-500/30">
                  <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-600 animate-pulse" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-200">{userProfile.displayName || "Duo Companion"}</h3>
              <p className="text-[11px] text-slate-400 leading-none mt-1 uppercase font-mono">Discipline Rating: {userProfile.disciplineScore}%</p>
            </div>

            {/* PHANTOM PHONE RESTRICTION ENGINE */}
            <div id="phone_restriction_dashboard" className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500/30" />
              
              <div className="flex items-center space-x-2 text-emerald-400 mb-3 ml-1">
                <Smartphone className="h-4.5 w-4.5" />
                <h4 className="text-xs font-mono uppercase font-bold tracking-wider">Phone Lock Ward</h4>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Usage Tracking</span>
                    <span className="text-xs font-mono font-bold text-slate-200">{userProfile.phoneMinutesToday}m</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${userProfile.phoneMinutesToday > 120 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${Math.min(100, (userProfile.phoneMinutesToday / 120) * 100)}%` }} 
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">Ideal daily screening limits: 120m</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleRecordPhoneUsage(15)}
                    className="p-1.5 hover:bg-slate-800 text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-xl font-bold text-center cursor-pointer select-none"
                  >
                    +15m Usage
                  </button>
                  <button
                    onClick={() => handleRecordPhoneUsage(-15)}
                    className="p-1.5 hover:bg-slate-800 text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-xl font-bold text-center cursor-pointer select-none"
                  >
                    -15m Usage
                  </button>
                </div>

                {/* Stealth lock trigger */}
                <button
                  onClick={() => {
                    setIsPhoneLocked(true);
                    setPhoneLockSeconds(0);
                  }}
                  className="w-full py-2.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-sans rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Activate Lock Focus</span>
                </button>
              </div>
            </div>

            {/* Quick Covenant Allies Plate */}
            {couple && (
              <div className="bg-slate-900/60 border border-indigo-500/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-indigo-400 ml-1">
                  <Users className="h-4.5 w-4.5" />
                  <h4 className="text-xs font-mono uppercase font-bold tracking-wider">Covenant Allies</h4>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-200">
                    <span className="font-semibold text-[11px] font-sans">You:</span>
                    <span className="font-mono text-[10px] text-cyan-400">LV.{userProfile.level} ({userProfile.disciplineScore}% DR)</span>
                  </div>

                  {partnerProfile ? (
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="font-semibold text-[11px] font-sans">{partnerProfile.displayName || "Partner"}:</span>
                      <span className="font-mono text-[10px] text-purple-400">LV.{partnerProfile.level} ({partnerProfile.disciplineScore}% DR)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-500 italic">
                      Ally pairing outstanding...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right column dashboard tabs with dynamic routers */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* RPG HUD TAB MATRIX */}
          <div id="systems-tab-rail" className="flex items-stretch overflow-x-auto gap-2 border-b border-slate-900 pb-2">
            {[
              { id: "status", label: "STATUS HUD", icon: <User className="h-4 w-4" /> },
              { id: "schedule", label: "DAILY QUESTS", icon: <Calendar className="h-4 w-4" /> },
              { id: "skills", label: "SPECIALTY HUB", icon: <Award className="h-4 w-4" /> },
              { id: "prayers", label: "DEVOTION MATRIX", icon: <Cross className="h-4 w-4 text-emerald-400" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 rounded-xl border flex items-center space-x-2 text-xs font-sans font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-slate-900 border-cyan-500 text-slate-100 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                    : "bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ACTIVE TAB VIEWS */}
          <div id="active-tab-portals">
            {activeTab === "status" && userProfile && (
              <DuoStatus
                userProfile={userProfile}
                partnerProfile={partnerProfile}
                couple={couple}
                dailyInspiration={dailyInspiration}
                loadingInspiration={loadingInspiration}
                onRefreshInspiration={fetchInspiration}
              />
            )}

            {activeTab === "schedule" && userProfile && (
              <div className="space-y-4">
                {/* Subtab for mine vs partner */}
                <div className="flex space-x-2 bg-slate-950 p-1 border border-slate-900 rounded-xl max-w-xs">
                  <button
                    onClick={() => setScheduleActiveSubtab("mine")}
                    className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-sans font-bold transition ${
                      scheduleActiveSubtab === "mine" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Your Timeline
                  </button>
                  <button
                    onClick={() => setScheduleActiveSubtab("partner")}
                    className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-sans font-bold transition ${
                      scheduleActiveSubtab === "partner" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Ally Timeline
                  </button>
                </div>

                <SchedulePanel
                  userProfile={userProfile}
                  partnerProfile={partnerProfile}
                  couple={couple}
                  scheduleItems={myScheduleItems}
                  partnerScheduleItems={partnerScheduleItems}
                  activeTab={scheduleActiveSubtab}
                />
              </div>
            )}

            {activeTab === "skills" && userProfile && (
              <div className="space-y-4">
                {/* Subtab for mine vs partner */}
                <div className="flex space-x-2 bg-slate-950 p-1 border border-slate-900 rounded-xl max-w-xs">
                  <button
                    onClick={() => setSkillsActiveSubtab("mine")}
                    className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-sans font-bold transition ${
                      skillsActiveSubtab === "mine" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    My Specialties
                  </button>
                  <button
                    onClick={() => setSkillsActiveSubtab("partner")}
                    className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] font-sans font-bold transition ${
                      skillsActiveSubtab === "partner" ? "bg-slate-900 text-slate-200" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Ally Specialties
                  </button>
                </div>

                <SkillsImport
                  userProfile={userProfile}
                  partnerProfile={partnerProfile}
                  couple={couple}
                  skills={mySkills}
                  partnerSkills={partnerSkills}
                  activeTab={skillsActiveSubtab}
                />
              </div>
            )}

            {activeTab === "prayers" && userProfile && (
              <PrayerTrack
                userProfile={userProfile}
                couple={couple}
                prayingSessions={myPrayingSessions}
                partnerPrayingSessions={partnerPrayingSessions}
                partnerProfile={partnerProfile}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
