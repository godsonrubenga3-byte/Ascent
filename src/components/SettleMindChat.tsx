import React, { useState, useRef, useEffect } from "react";
import { db, handleFirestoreError, OperationType, collection, addDoc, query } from "../lib/firebase";
import { UserProfile, ChatMessage } from "../types";
import { Flame, ShieldCheck, Moon, RefreshCw, Send, Loader2, Sparkles, MessageSquareHeart, EyeOff, User, Compass } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SettleMindChatProps {
  userProfile: UserProfile;
  chatMessages: ChatMessage[];
}

export default function SettleMindChat({ userProfile, chatMessages }: SettleMindChatProps) {
  const [selectedSin, setSelectedSin] = useState<"lust" | "anger" | "pride" | "general">("general");
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredHistory = chatMessages
    .filter((msg) => msg.sinType === selectedSin)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Auto scroll to bottom when new messages stream in
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || submitting) return;

    const userMsg = inputText.trim();
    setInputText("");
    setSubmitting(true);

    // 1. Write the User Message to Firestore
    try {
      const colRef = collection(db, "users", userProfile.uid, "chatMessages");
      await addDoc(colRef, {
        role: "user",
        content: userMsg,
        sinType: selectedSin,
        createdAt: new Date().toISOString(),
      });

      // Prepare history arrays for Gemini endpoint
      // Limit history to last 6 messages to keep payloads optimized and fast
      const apiHistory = filteredHistory.slice(-6).map((msg) => ({
        role: msg.role === "model" ? "model" : "user",
        text: msg.content,
      }));

      // 2. Query server server-side Gemini API
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMsg,
          history: apiHistory,
          sinType: selectedSin,
        }),
      });

      if (!response.ok) {
        throw new Error("Temptation counsel fails to respond.");
      }

      const data = await response.json();
      const replyText = data.reply || "Breathe deeply. Lock your eyes on things of honor. Remain focused.";

      // 3. Write model response in Firestore
      await addDoc(colRef, {
        role: "model",
        content: replyText,
        sinType: selectedSin,
        createdAt: new Date().toISOString(),
      });

    } catch (err) {
      console.error("Failed to process Sin-Control Chat message flow:", err);
      // Log failure but don't fail the complete UI
    } finally {
      setSubmitting(false);
    }
  };

  const getStruggleHeader = () => {
    switch (selectedSin) {
      case "lust":
        return {
          title: "Impulse Restraint Terminal",
          desc: "Targeting visual, mental, and physical cravings immediately. Eyes forward, lock down screen distractions, redirect focus.",
          color: "border-red-500/20 text-red-400 bg-red-950/10",
        };
      case "anger":
        return {
          title: "Sovereign Calm Sanctuary",
          desc: "Stabilizing volatile surges. Lower your vocal pitch, pause 10 seconds, write to release pressure, seek alignment.",
          color: "border-amber-500/20 text-amber-400 bg-amber-950/10",
        };
      case "pride":
        return {
          title: "Ego Decoupler Vault",
          desc: "Absorbing defensive posture. Say 'I was wrong', release being right, listen with full attention, team over self.",
          color: "border-purple-500/20 text-purple-400 bg-purple-950/10",
        };
      default:
        return {
          title: "Quest Master Mentor Guide",
          desc: "Universal counseling. Restraint, dynamic alignment, persistent scripture reflection, and joint leveling advice.",
          color: "border-cyan-500/20 text-cyan-400 bg-cyan-950/10",
        };
    }
  };

  const activeHeader = getStruggleHeader();

  return (
    <div id="mind_chat_panel_wrapper" className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-slate-950 rounded-2xl overflow-hidden p-1">
      {/* Struggle Filters Panel */}
      <div className="lg:col-span-1 space-y-3 bg-slate-900/40 p-4 border border-slate-900 rounded-xl flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800 pb-3">
            <EyeOff className="h-4.5 w-4.5 text-xs text-rose-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Struggle Wardens</span>
          </div>

          <h3 className="text-xs font-mono text-slate-400 leading-relaxed">
            Select an alignment focus to seek counsel and converse privately with your spiritual guide to avert error or sin:
          </h3>

          <div className="flex flex-col space-y-2 pt-2">
            {[
              { id: "general", label: "General Mentor", color: "hover:border-cyan-500/30 text-cyan-400" },
              { id: "lust", label: "Control Lust", color: "hover:border-red-500/30 text-rose-400" },
              { id: "anger", label: "Control Anger", color: "hover:border-amber-500/30 text-amber-400" },
              { id: "pride", label: "Control Pride", color: "hover:border-purple-500/30 text-purple-400" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedSin(btn.id as any)}
                className={`px-3 py-2.5 rounded-xl border text-left text-xs font-sans font-medium transition cursor-pointer select-none ${
                  selectedSin === btn.id
                    ? "bg-slate-900 border-indigo-500 text-slate-100 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                    : `bg-slate-950 border-slate-800/70 text-slate-400 hover:text-slate-200 ${btn.color}`
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Security Warning Badge */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start space-x-2.5 mt-4">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[10px] font-sans text-slate-400 leading-tight">
            <strong>Absolute Privacy:</strong> Your struggle logs are encrypted and strictly isolated. Your partner can never see or scrape your counseling logs.
          </div>
        </div>
      </div>

      {/* Primary chat matrix */}
      <div className="lg:col-span-3 bg-slate-900/20 border border-slate-900 rounded-xl p-4 flex flex-col justify-between min-h-[460px]">
        {/* Dynamic Header */}
        <div className={`p-4 border rounded-xl mb-4 flex items-start space-x-3 transition ${activeHeader.color}`}>
          <div className="p-2 bg-slate-950 rounded-lg shrink-0">
            <Compass className="h-4 w-4 text-slate-200" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider">{activeHeader.title}</h4>
            <p className="text-[11px] font-sans text-slate-300 opacity-90 mt-0.5">{activeHeader.desc}</p>
          </div>
        </div>

        {/* Dialogue scroll track */}
        <div className="flex-1 overflow-y-auto space-y-4 px-1 max-h-[320px] scrollbar-thin scrollbar-thumb-slate-800">
          {filteredHistory.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center py-10 space-y-3">
              <MessageSquareHeart className="h-8 w-8 text-slate-500" />
              <div>
                <h5 className="text-xs font-bold text-slate-300 uppercase font-mono">No private reflections yet in this focus</h5>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Type any heavy thought or state of mind below. Your spiritual guide will listen and offer counsel.
                </p>
              </div>
            </div>
          ) : (
            filteredHistory.map((msg) => {
              const isAssistant = msg.role === "model";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div className={`flex items-start space-x-2.5 max-w-md ${isAssistant ? "" : "flex-row-reverse space-x-reverse"}`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${isAssistant ? "bg-indigo-950 text-indigo-400" : "bg-cyan-950 text-cyan-400"}`}>
                      {isAssistant ? <Compass className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </div>
                    
                    <div className={`p-3 rounded-2xl text-xs font-sans leading-medium ${
                      isAssistant
                        ? "bg-slate-900 border border-slate-800 text-slate-200"
                        : "bg-slate-950 border border-slate-800 text-slate-200"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {submitting && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-950/80 text-indigo-400 block">
                  <Compass className="h-3.5 w-3.5 animate-spin" />
                </div>
                <div className="p-3 rounded-2xl text-xs font-mono text-indigo-300 bg-slate-900 border border-slate-800 flex items-center space-x-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>COMPILING SAGE COUNSEL MATRIX...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input prompt tray */}
        <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-slate-800 flex items-center space-x-3">
          <input
            type="text"
            placeholder={
              selectedSin === "lust"
                ? "Facing temptation? Type: 'I am struggling right now' or explain..."
                : selectedSin === "anger"
                ? "Frustrated? Write your feelings before speaking out loud..."
                : selectedSin === "pride"
                ? "Want to apologize but ego blocks? Describe the confrontation..."
                : "Type struggle or seeking leveling advice..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !inputText.trim()}
            className="p-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-100 rounded-xl transition disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
