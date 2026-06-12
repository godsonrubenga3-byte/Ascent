import React, { useState } from "react";
import { db, handleFirestoreError, OperationType, doc, updateDoc } from "../lib/firebase";
import { UserProfile, Couple, DailyInspiration } from "../types";
import { Shield, Sparkles, Users, User, ArrowRight, Share2, Clipboard, Check, Trophy, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DuoStatusProps {
  userProfile: UserProfile;
  partnerProfile: UserProfile | null;
  couple: Couple | null;
  dailyInspiration: DailyInspiration | null;
  loadingInspiration: boolean;
  onRefreshInspiration: () => void;
}

export function addExp(currentExp: number, currentLevel: number, amount: number) {
  let exp = currentExp + amount;
  let level = currentLevel;
  const getRequiredXp = (lvl: number) => lvl * 100;
  
  while (exp >= getRequiredXp(level)) {
    exp -= getRequiredXp(level);
    level += 1;
  }
  return { exp, level };
}

export default function DuoStatus({
  userProfile,
  partnerProfile,
  couple,
  dailyInspiration,
  loadingInspiration,
  onRefreshInspiration,
}: DuoStatusProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [sharingVerse, setSharingVerse] = useState(false);
  const [sharingQuote, setSharingQuote] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const reqXpUser = userProfile.level * 100;
  const currentXpPercentUser = Math.min(100, Math.floor((userProfile.exp / reqXpUser) * 100));

  const reqXpPartner = partnerProfile ? partnerProfile.level * 100 : 100;
  const currentXpPercentPartner = partnerProfile
    ? Math.min(100, Math.floor((partnerProfile.exp / reqXpPartner) * 100))
    : 0;

  const reqXpCouple = couple ? couple.sharedLevel * 150 : 150;
  const currentXpPercentCouple = couple
    ? Math.min(100, Math.floor((couple.sharedExp / reqXpCouple) * 100))
    : 0;

  const handleCopyInviteCode = () => {
    if (couple?.inviteCode) {
      navigator.clipboard.writeText(couple.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShareVerse = async () => {
    if (!couple || !dailyInspiration) return;
    setSharingVerse(true);
    try {
      await updateDoc(doc(db, "couples", couple.id), {
        verseOfTheDayShared: {
          verse: dailyInspiration.verse,
          reference: dailyInspiration.reference,
          sharedBy: userProfile.uid,
          sharedByName: userProfile.displayName || "Partner",
          sharedAt: new Date().toISOString(),
        },
      });
      showShareFeedback("Verse Shared to Covenant Board!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `couples/${couple.id}`);
    } finally {
      setSharingVerse(false);
    }
  };

  const handleShareQuote = async () => {
    if (!couple || !dailyInspiration) return;
    setSharingQuote(true);
    try {
      await updateDoc(doc(db, "couples", couple.id), {
        motivationQuoteShared: {
          quote: dailyInspiration.quote,
          quoteAuthor: dailyInspiration.quoteAuthor,
          sharedBy: userProfile.uid,
          sharedByName: userProfile.displayName || "Partner",
          sharedAt: new Date().toISOString(),
        },
      });
      showShareFeedback("Motivation Shared to Covenant Board!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `couples/${couple.id}`);
    } finally {
      setSharingQuote(false);
    }
  };

  const showShareFeedback = (msg: string) => {
    setShareFeedback(msg);
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const getDisciplineGrade = (score: number) => {
    if (score >= 90) return { grade: "S-RANK", color: "text-amber-400 border-amber-500/50 shadow-amber-500/20 bg-amber-950/20" };
    if (score >= 80) return { grade: "A-RANK", color: "text-purple-400 border-purple-500/50 shadow-purple-500/20 bg-purple-950/20" };
    if (score >= 65) return { grade: "B-RANK", color: "text-blue-400 border-blue-500/50 shadow-blue-500/20 bg-blue-950/20" };
    if (score >= 50) return { grade: "C-RANK", color: "text-green-400 border-green-500/50 shadow-green-500/20 bg-green-950/20" };
    return { grade: "D-RANK (TIRED)", color: "text-red-400 border-red-500/30 shadow-red-500/10 bg-red-950/10" };
  };

  const userRank = getDisciplineGrade(userProfile.disciplineScore);
  const partnerRank = partnerProfile ? getDisciplineGrade(partnerProfile.disciplineScore) : null;

  return (
    <div id="duo-status-container" className="space-y-6">
      {/* Real-time sync notifications */}
      <AnimatePresence>
        {shareFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-cyan-900 border border-cyan-400 text-cyan-200 px-4 py-3 rounded-xl shadow-lg shadow-cyan-950/50 flex items-center space-x-2 font-sans"
          >
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">{shareFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main HUD Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Card */}
        <div id="user_level_card" className="relative overflow-hidden bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          {/* Solo Leveling Electric Accent Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/30 rounded-xl">
                <User className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <span className="text-xs font-mono text-cyan-500 uppercase tracking-widest font-semibold">Covenant Hero</span>
                <h3 className="text-lg font-sans font-medium text-slate-100">{userProfile.displayName || "You"}</h3>
              </div>
            </div>
            
            {/* Rank Plate */}
            <div className={`px-3 py-1 font-mono text-xs font-bold border rounded-lg shadow-md ${userRank.color}`}>
              {userRank.grade}
            </div>
          </div>

          <div className="space-y-4">
            {/* LEVEL & EXP */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-mono text-cyan-400 font-bold">LV. {userProfile.level}</span>
                <span className="text-xs font-mono text-slate-400">
                  {userProfile.exp} / {reqXpUser} XP
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${currentXpPercentUser}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>

            {/* Discipline Rating Gauge */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
                <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Discipline Rating</span>
                <span className="text-xl font-mono text-slate-100 font-bold">{userProfile.disciplineScore}%</span>
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mt-1 bg-slate-950">
                  <div 
                    className="h-full bg-cyan-400" 
                    style={{ width: `${userProfile.disciplineScore}%` }} 
                  />
                </div>
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
                <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Phone Usage Today</span>
                <span className="text-xl font-mono text-slate-100 font-bold flex items-center space-x-1">
                  <Smartphone className="h-4 w-4 text-emerald-400 inline" />
                  <span>{userProfile.phoneMinutesToday}m</span>
                </span>
                <span className="block text-[9px] font-sans text-emerald-400 mt-1">
                  Bonus: +{userProfile.phoneDisciplineBonus} XP Discipline
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Partner Card */}
        <div id="partner_level_card" className="relative overflow-hidden bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          {/* Solo Leveling Electric Purple/Pink Accent Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
          
          {partnerProfile ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-950/60 border border-purple-500/30 rounded-xl">
                    <Users className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-xs font-mono text-purple-500 uppercase tracking-widest font-semibold">Covenant Ally</span>
                    <h3 className="text-lg font-sans font-medium text-slate-100">{partnerProfile.displayName || "Partner"}</h3>
                  </div>
                </div>
                
                {/* Rank Plate */}
                <div className={`px-3 py-1 font-mono text-xs font-bold border rounded-lg shadow-md ${partnerRank?.color}`}>
                  {partnerRank?.grade}
                </div>
              </div>

              <div className="space-y-4">
                {/* LEVEL & EXP */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-mono text-purple-400 font-bold">LV. {partnerProfile.level}</span>
                    <span className="text-xs font-mono text-slate-400">
                      {partnerProfile.exp} / {reqXpPartner} XP
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentXpPercentPartner}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                </div>

                {/* Performance stats */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/50">
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Discipline Rating</span>
                    <span className="text-xl font-mono text-slate-100 font-bold">{partnerProfile.disciplineScore}%</span>
                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mt-1 bg-slate-950">
                      <div 
                        className="h-full bg-purple-400" 
                        style={{ width: `${partnerProfile.disciplineScore}%` }} 
                      />
                    </div>
                  </div>

                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Phone Usage Today</span>
                    <span className="text-xl font-mono text-slate-100 font-bold flex items-center space-x-1">
                      <Smartphone className="h-4 w-4 text-emerald-400 inline" />
                      <span>{partnerProfile.phoneMinutesToday}m</span>
                    </span>
                    <span className="block text-[9px] font-sans text-emerald-400 mt-1">
                      Bonus: +{partnerProfile.phoneDisciplineBonus} XP Discipline
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div id="no-partner-invite-section" className="h-full flex flex-col justify-center items-center text-center space-y-4 py-4">
              <Users className="h-10 w-10 text-slate-600 animate-pulse" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Awaiting Leveling Ally...</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Share your sacred invite code, or tell them to connect their account to link schedules and synchronize prayer devotions.
                </p>
              </div>
              
              {couple && (
                <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 w-full max-w-xs mt-2">
                  <span className="text-sm font-mono text-indigo-400 font-bold ml-2 select-all">{couple.inviteCode}</span>
                  <button 
                    onClick={handleCopyInviteCode}
                    className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                    title="Copy Invite Code"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Shared Covenant Status Gauge */}
      {couple && (
        <div id="covenant_board" className="relative p-6 bg-slate-900 border border-indigo-500/20 rounded-2xl shadow-lg shadow-indigo-950/10 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl relative">
                <Trophy className="h-6 w-6 text-indigo-400" />
                <motion.div 
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full"
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              </div>
              <div>
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest font-semibold">Shared Covenant State</span>
                <h3 className="text-lg font-sans font-medium text-slate-100 flex items-center space-x-2">
                  <span>Duo Bond Level {couple.sharedLevel}</span>
                </h3>
              </div>
            </div>
            
            <div className="text-xs font-mono text-slate-400 text-right">
              Shared EXP: {couple.sharedExp} / {couple.sharedLevel * 150} XP
            </div>
          </div>

          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${currentXpPercentCouple}%` }}
              transition={{ duration: 1 }}
            />
          </div>

          <p className="text-[11px] font-sans text-indigo-300 mt-2 text-center italic">
            "One levels up quickly, but a couple levels up permanently." Completing joint prayers and practicing creative skills together multiplies progress.
          </p>
        </div>
      )}

      {/* Daily Motivation & Verse Covenant Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scripture Box */}
        <div id="scripture_inspiration_card" className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-emerald-400 font-semibold tracking-wider uppercase">Holy Scripture</span>
              <span className="text-xs font-mono text-slate-500">Verse of the Day</span>
            </div>

            {loadingInspiration ? (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-11/12" />
                <div className="h-4 bg-slate-800 rounded w-4/12" />
              </div>
            ) : dailyInspiration ? (
              <blockquote className="space-y-2 py-2">
                <p className="text-slate-200 text-sm font-sans italic leading-relaxed leading-medium">
                  "{dailyInspiration.verse}"
                </p>
                <cite className="block text-right text-xs font-mono text-emerald-400 font-bold not-italic">
                  — {dailyInspiration.reference}
                </cite>
              </blockquote>
            ) : null}
          </div>

          <div className="pt-4 border-t border-slate-800/40 mt-4 flex items-center justify-between">
            <button 
              onClick={onRefreshInspiration}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 transition"
            >
              Force Generate New
            </button>
            <button
              onClick={handleShareVerse}
              disabled={sharingVerse || !dailyInspiration}
              className="px-4 py-2 text-xs font-sans border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-950/20 text-emerald-400 rounded-xl flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{sharingVerse ? "Communicating..." : "Share with Partner"}</span>
            </button>
          </div>
        </div>

        {/* Motivational Quote Box */}
        <div id="motivation_quote_card" className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider uppercase">Absolute Will</span>
              <span className="text-xs font-mono text-slate-500">Dynamic Motivation</span>
            </div>

            {loadingInspiration ? (
              <div className="space-y-3 py-4 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-10/12" />
                <div className="h-4 bg-slate-800 rounded w-3/12" />
              </div>
            ) : dailyInspiration ? (
              <blockquote className="space-y-2 py-2">
                <p className="text-slate-200 text-sm font-sans italic leading-relaxed leading-medium">
                  "{dailyInspiration.quote}"
                </p>
                <cite className="block text-right text-xs font-mono text-cyan-400 font-bold not-italic">
                  — {dailyInspiration.quoteAuthor}
                </cite>
              </blockquote>
            ) : null}
          </div>

          <div className="pt-4 border-t border-slate-800/40 mt-4 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-500">Refresh on startup</span>
            <button
              onClick={handleShareQuote}
              disabled={sharingQuote || !dailyInspiration}
              className="px-4 py-2 text-xs font-sans border border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-950/20 text-cyan-400 rounded-xl flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{sharingQuote ? "Communicating..." : "Share with Partner"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Shared Board Notifications (Real-time updates) */}
      {couple && (couple.verseOfTheDayShared || couple.motivationQuoteShared) && (
        <div id="covenant_daily_shares" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-slate-950 text-indigo-400 font-bold border border-indigo-500/30">
              LIVE SHARED COVENANT
            </span>
          </div>

          <h3 className="text-sm font-mono text-indigo-400 mb-4 uppercase font-bold tracking-wider">Covenant Message Board</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {couple.verseOfTheDayShared && (
              <div className="bg-slate-950/60 border border-emerald-950/50 p-4 rounded-xl">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block mb-1">
                  Shared Verse by {couple.verseOfTheDayShared.sharedByName}
                </span>
                <p className="text-xs font-sans text-slate-200 italic">"{couple.verseOfTheDayShared.verse}"</p>
                <span className="text-[11px] font-mono text-slate-400 block mt-1 text-right">— {couple.verseOfTheDayShared.reference}</span>
              </div>
            )}

            {couple.motivationQuoteShared && (
              <div className="bg-slate-950/60 border border-cyan-950/50 p-4 rounded-xl">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block mb-1">
                  Shared Quote by {couple.motivationQuoteShared.sharedByName}
                </span>
                <p className="text-xs font-sans text-slate-200 italic">"{couple.motivationQuoteShared.quote}"</p>
                <span className="text-[11px] font-mono text-slate-400 block mt-1 text-right">— {couple.motivationQuoteShared.quoteAuthor}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
