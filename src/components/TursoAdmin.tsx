import React, { useState, useEffect } from "react";
import { Database, RefreshCw, Table, Activity, Server, ShieldCheck, Play, Terminal, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TursoStats {
  connectionUrl: string;
  version: string;
  tables: { name: string; count: number }[];
  timestamp: string;
}

const BASE_URL = "https://duo-ascent.vercel.app";

function getUrl(path: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isCapacitor = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.protocol === "file:");
  const base = isCapacitor ? BASE_URL : origin;
  return `${base}${path}`;
}

export default function TursoAdmin() {
  const [stats, setStats] = useState<TursoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth protection
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passkey, setPasskey] = useState("");

  // Query state
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 5;");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(getUrl("/api/turso/stats"));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const resp = await fetch(getUrl("/api/turso/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: query })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setQueryResult(data);
    } catch (err: any) {
      setQueryError(err.message);
    } finally {
      setQueryLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
    }
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-6 text-center">
          <div className="mx-auto w-12 h-12 bg-cyan-950/50 border border-cyan-500/40 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-100 uppercase tracking-widest font-sans">RESTRICTED ACCESS</h2>
            <p className="text-xs text-slate-400 font-medium">Enter the covenant admin passkey to proceed.</p>
          </div>
          <input 
            type="password"
            placeholder="ADMIN_PASSKEY"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && passkey === "covenant2026" && setIsAuthorized(true)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-cyan-400 font-mono text-center focus:outline-none focus:border-cyan-500 transition"
          />
          <button 
            onClick={() => passkey === "covenant2026" && setIsAuthorized(true)}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs rounded-xl transition uppercase tracking-widest"
          >
            Authorize Session
          </button>
          <button 
            onClick={() => window.location.href = "/"}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition uppercase"
          >
            Return to Core HUD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl">
              <Database className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-100">Turso Control Center</h1>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-cyan-400 font-mono font-bold uppercase tracking-widest">Database Administration Hub</p>
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">VERCEL OPTIMIZED</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <button 
              onClick={() => window.location.href = "/"}
              className="px-4 py-2 text-xs font-bold font-mono text-slate-400 hover:text-slate-200 transition"
            >
              EXIT TO APP
            </button>
            <button 
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition text-xs font-bold font-mono text-slate-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>REFRESH NODES</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-950/30 border border-red-500/25 rounded-2xl">
            <p className="text-sm text-rose-300 font-medium">Failed to establish connection: {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Stats Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {stats && (
              <>
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl space-y-4"
                >
                  <div className="flex items-center space-x-2 text-indigo-400">
                    <Server className="h-4 w-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Node Config</h3>
                  </div>
                  <div className="space-y-3 font-mono">
                    <div>
                      <label className="text-[9px] text-slate-500 uppercase block mb-1">Target</label>
                      <code className="text-[10px] text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate">{stats.connectionUrl}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 uppercase">SQLite</span>
                      <code className="text-[10px] text-indigo-400 font-bold">{stats.version}</code>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-500 uppercase">Status</span>
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        READY
                      </span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl space-y-4"
                >
                  <div className="flex items-center space-x-2 text-cyan-400">
                    <Table className="h-4 w-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Schema Inventory</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.tables.map(table => (
                      <div key={table.name} className="flex justify-between items-center bg-slate-950/50 p-2 rounded-xl border border-slate-800/50">
                        <span className="text-[11px] font-mono font-bold text-slate-300">{table.name}</span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{table.count}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Query Interface */}
          <div className="lg:col-span-8 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Terminal className="h-5 w-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Interactive SQL Console</h3>
                </div>
                <button 
                  onClick={handleRunQuery}
                  disabled={queryLoading}
                  className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg transition text-xs font-black font-sans disabled:opacity-50"
                >
                  {queryLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                  <span>EXECUTE COMMAND</span>
                </button>
              </div>
              <div className="p-4 bg-slate-950">
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-32 bg-transparent text-cyan-400 font-mono text-sm focus:outline-none resize-none"
                  spellCheck={false}
                />
              </div>
            </motion.div>

            {/* Results Area */}
            <AnimatePresence mode="wait">
              {queryError && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-red-950/30 border border-red-500/25 rounded-2xl"
                >
                  <p className="text-xs text-rose-300 font-mono">ERROR: {queryError}</p>
                </motion.div>
              )}

              {queryResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                      Execution Result &bull; {queryResult.rows?.length || 0} Rows Found
                    </span>
                    {queryResult.rowsAffected > 0 && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        AFFECTED: {queryResult.rowsAffected}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                    {queryResult.rows && queryResult.rows.length > 0 ? (
                      <table className="w-full text-left border-collapse min-w-full">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800">
                            {queryResult.columns.map((col: string) => (
                              <th key={col} className="px-4 py-3 text-[10px] font-mono text-slate-400 uppercase tracking-wider">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {queryResult.rows.map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-cyan-500/[0.02] transition">
                              {queryResult.columns.map((col: string) => (
                                <td key={col} className="px-4 py-3 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                                  {row[col] === null ? <span className="text-slate-700 italic">null</span> : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Command completed with no visual output.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="text-center pt-8 border-t border-slate-900">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em]">
            Duo Leveling Covenant Admin Interface &bull; Vercel Deployment Sync
          </p>
        </footer>
      </div>
    </div>
  );
}
