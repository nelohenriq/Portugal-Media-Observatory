import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Plus, 
  Filter, 
  LayoutDashboard, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MapPin,
  Menu,
  X
} from "lucide-react";

interface StageRun {
  stage: string;
  status: string;
  errorMessage?: string;
}

interface Investigation {
  id: string;
  title: string;
  status: string;
  summary_pt?: string;
  reliability_score?: number;
  undercoverage_score?: number;
  createdAt: any;
  stages?: StageRun[];
}

export default function App() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);

  useEffect(() => {
    fetchInvestigations();
    const interval = setInterval(fetchInvestigations, 5000); // Polling for "real-time" updates
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchInvestigations = async () => {
    try {
      const statusParam = activeTab === "all" ? "" : `?status=${activeTab}`;
      const response = await fetch(`/api/investigations${statusParam}`);
      const data = await response.json();
      setInvestigations(data.items || []);
    } catch (error) {
      console.error("Failed to fetch investigations:", error);
    } finally {
      setLoading(false);
    }
  };

  const PipelineProgress = ({ stages }: { stages?: StageRun[] }) => {
    const sequence = ["curation", "research", "coverage", "risk", "writer"];
    
    return (
      <div className="flex items-center gap-1 mt-2">
        {sequence.map((step, idx) => {
          const run = stages?.find(s => s.stage === step);
          const isPending = !run || run.status === "pending";
          const isRunning = run?.status === "running";
          const isSucceeded = run?.status === "succeeded";
          const isFailed = run?.status === "failed";

          return (
            <div key={step} className="flex items-center flex-1">
              <div 
                className={`flex-1 h-1 rounded-sm transition-all duration-500 ${
                  isSucceeded ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                  isRunning ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                  isFailed ? "bg-rose-500" : "bg-slate-800"
                }`}
                title={`${step.toUpperCase()}: ${run?.status || "NOT_STARTED"}`}
              />
              {idx < sequence.length - 1 && (
                <div className="w-1 h-1 rounded-full bg-slate-800 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { color: string, icon: any }> = {
      intake: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
      researching: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Search },
      ready_for_review: { color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: AlertCircle },
      approved: { color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
      published: { color: "bg-slate-800 text-slate-100 border-slate-700", icon: ExternalLink },
    };
    const config = configs[status] || { color: "bg-slate-800 text-slate-400 border-slate-700", icon: FileText };
    const Icon = config.icon;

    return (
      <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-mono flex items-center gap-1 ${config.color}`}>
        <Icon size={10} />
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-brand-bg text-slate-300 font-sans overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-12 bg-brand-sidebar border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-brand-accent rounded flex items-center justify-center text-brand-sidebar font-bold italic shadow-[0_0_15px_rgba(245,158,11,0.3)]">H</div>
          <span className="font-display font-bold text-slate-100 tracking-tight text-sm uppercase">PT_MEDIA_WATCH // V1.4_STABLE</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-[10px] font-mono uppercase">
            <span className="text-emerald-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> FRAMEWORK: OK</span>
            <span className="text-amber-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> WORKFLOW: ACTIVE</span>
          </div>
          <button 
            onClick={() => setShowSubmissionModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-accent text-brand-sidebar font-bold text-xs rounded hover:bg-amber-400 transition-all shadow-lg active:scale-95"
          >
            <Plus size={14} />
            NEW_INVESTIGATION
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`bg-brand-sidebar border-r border-slate-800 transition-all duration-300 flex flex-col p-3 gap-1 ${isSidebarOpen ? "w-64" : "w-16"}`}>
          <div className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest px-2">{isSidebarOpen ? "Main Directory" : "DIR"}</div>
          <NavItem icon={LayoutDashboard} label="Dashboard" active={activeTab === "all"} onClick={() => setActiveTab("all")} collapsed={!isSidebarOpen} />
          <NavItem icon={Clock} label="Intake" active={activeTab === "intake"} onClick={() => setActiveTab("intake")} collapsed={!isSidebarOpen} />
          <NavItem icon={Search} label="Research" active={activeTab === "researching"} onClick={() => setActiveTab("researching")} collapsed={!isSidebarOpen} />
          <NavItem icon={CheckCircle2} label="Published" active={activeTab === "published"} onClick={() => setActiveTab("published")} collapsed={!isSidebarOpen} />
          
          <div className="mt-auto px-2">
            {isSidebarOpen && (
              <div className="p-3 bg-brand-bg/50 border border-slate-800 rounded mb-4">
                <div className="text-[10px] text-slate-500 font-mono mb-1 uppercase tracking-tighter">Usage Monitor</div>
                <div className="text-xs font-mono text-slate-300 flex justify-between">
                  <span>Tokens</span>
                  <span className="text-brand-accent">14,204 / 50k</span>
                </div>
                <div className="w-full h-1 bg-slate-800 mt-2 rounded-full overflow-hidden">
                  <div className="w-1/4 h-full bg-brand-accent"></div>
                </div>
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full p-2 rounded hover:bg-slate-800/50 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors"
            >
              <Menu size={18} />
            </button>
          </div>
        </aside>

        {/* Main TECHNICAL Workspace */}
        <main className="flex-1 flex flex-col min-w-0 bg-brand-bg relative overflow-hidden">
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

          <div className="flex-1 overflow-y-auto p-6 relative z-10">
            <div className="mb-6 flex items-end justify-between border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-display font-bold text-slate-100 flex items-center gap-3">
                  <TrendingUp className="text-brand-accent" size={24} />
                  INVESTIGATION_SUITE
                </h1>
                <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">Tracing truth through agentic observation chains</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-brand-sidebar border border-slate-800 rounded px-3 py-1.5 gap-2">
                  <Search size={14} className="text-slate-500" />
                  <input type="text" placeholder="FILTER_NODES..." className="bg-transparent border-none text-[11px] font-mono outline-none text-slate-300 w-32 focus:w-48 transition-all" />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-brand-card/50 border border-slate-800 rounded p-4 h-40 animate-pulse" />
                ))}
              </div>
            ) : investigations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-brand-sidebar/50 border border-dashed border-slate-800 rounded-lg text-center">
                <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700">
                  <FileText className="text-slate-600" size={24} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">System_Idle: Empty_Result_Set</h3>
                <button 
                  onClick={() => setShowSubmissionModal(true)}
                  className="mt-6 px-4 py-2 bg-slate-800 text-brand-accent text-xs font-bold rounded border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  INITIALIZE_NEW_SEQUENCE
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {investigations.map((inv) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={inv.id} 
                    className="bg-brand-card border border-slate-800 rounded shadow-lg hover:border-brand-accent/30 transition-all duration-300 group flex flex-col relative overflow-hidden"
                  >
                    {/* Corner Accent */}
                    <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute top-0 right-0 w-full h-full border-t border-r border-brand-accent/50 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500"></div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <StatusBadge status={inv.status} />
                        <span className="text-[9px] font-mono text-slate-500 tracking-widest bg-brand-sidebar px-1.5 py-0.5 rounded border border-slate-800 uppercase">
                          ID::{inv.id.slice(0, 6)}
                        </span>
                      </div>
                      
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-brand-accent transition-colors mb-2 line-clamp-2 uppercase tracking-wide leading-tight font-display">
                        {inv.title}
                      </h3>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase tracking-tighter mb-1">
                          <span>Pipeline_Execution</span>
                          <span className="text-brand-accent font-bold">
                            {inv.stages?.filter(s => s.status === 'succeeded').length || 0}/5
                          </span>
                        </div>
                        <PipelineProgress stages={inv.stages} />
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-mono opacity-80 mb-4 h-8 overflow-hidden">
                        {inv.summary_pt || "Awaiting_Processing..."}
                      </p>

                      <div className="flex items-center gap-4 border-t border-slate-800 p-4 pt-3 mt-auto -mx-4 -mb-4">
                        <div className="flex items-center gap-4">
                          {inv.reliability_score !== undefined && (
                            <div className="flex flex-col">
                              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">Reliability</span>
                              <div className="flex gap-1">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className={`w-3 h-1 ${i <= inv.reliability_score! ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-slate-800"}`} />
                                ))}
                              </div>
                            </div>
                          )}
                          {inv.undercoverage_score !== undefined && (
                            <div className="flex flex-col">
                              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mb-1">Media_Gap</span>
                              <div className="flex gap-1">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className={`w-2 h-2 rounded-sm transform rotate-45 ${i <= inv.undercoverage_score! ? "bg-brand-accent shadow-[0_0_5px_rgba(245,158,11,0.5)]" : "bg-slate-800 border border-slate-700"}`} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => setSelectedInvestigation(inv)}
                          className="ml-auto p-1.5 bg-brand-sidebar border border-slate-800 rounded group-hover:border-brand-accent transition-colors text-slate-500 group-hover:text-brand-accent"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedInvestigation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl"
              onClick={() => setSelectedInvestigation(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98, x: 20 }}
              className="relative bg-brand-card w-full max-w-4xl max-h-[90vh] rounded border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-700 bg-brand-sidebar flex items-center justify-between">
                <div className="flex items-center gap-4 text-left">
                  <StatusBadge status={selectedInvestigation.status} />
                  <h2 className="text-[12px] font-display font-medium text-slate-100 uppercase tracking-widest truncate max-w-xs md:max-w-xl">
                    {selectedInvestigation.title}
                  </h2>
                </div>
                <button onClick={() => setSelectedInvestigation(null)} className="text-slate-500 hover:text-slate-100 p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-0">
                {/* Left: Metadata & Scores */}
                <div className="p-8 border-r border-slate-800 bg-brand-sidebar/30">
                  <div className="space-y-8">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-4">Pipeline_Status</span>
                      <div className="space-y-4">
                        {["curation", "research", "coverage", "risk", "writer"].map(step => {
                          const run = selectedInvestigation.stages?.find(s => s.stage === step);
                          return (
                            <div key={step} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                run?.status === 'succeeded' ? 'bg-emerald-500' :
                                run?.status === 'running' ? 'bg-amber-400' : 'bg-slate-800'
                              }`} />
                              <span className={`text-[10px] font-mono uppercase ${run?.status === 'succeeded' ? 'text-slate-300' : 'text-slate-600'}`}>{step}</span>
                              <span className="ml-auto text-[9px] font-mono text-slate-600">{run?.status || 'PENDING'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-4">Metrics_Analysis</span>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-slate-600 mb-1 font-bold">RELIABILITY</div>
                          <div className="text-xl font-mono text-emerald-400">{selectedInvestigation.reliability_score || 0}/3</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-600 mb-1 font-bold">MEDIA_GAP</div>
                          <div className="text-xl font-mono text-amber-500">{selectedInvestigation.undercoverage_score || 0}/3</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Output/Content */}
                <div className="md:col-span-2 p-8 space-y-8">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <TrendingUp size={14} className="text-brand-accent" />
                       Normalized_Executive_Summary
                    </h3>
                    <div className="text-[11px] font-mono text-slate-300 leading-relaxed bg-[#020617] p-4 rounded border border-slate-800 min-h-[100px]">
                      {selectedInvestigation.summary_pt || "Awaiting_Processing..."}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-brand-sidebar border border-slate-800 rounded">
                      <div className="text-[9px] font-mono text-slate-500 uppercase mb-2 font-bold">Claim_Core</div>
                      <div className="text-[11px] text-slate-300 italic font-mono">"{selectedInvestigation.claim_core || 'Under_Analysis'}"</div>
                    </div>
                    <div className="p-4 bg-brand-sidebar border border-slate-800 rounded">
                      <div className="text-[9px] font-mono text-slate-500 uppercase mb-2 font-bold">Entities_Detected</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedInvestigation.entities?.length ? 
                          selectedInvestigation.entities.map((e: any, i: number) => (
                           <span key={i} className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{e.name || e}</span>
                          )) : (
                           <span className="text-[9px] font-mono text-slate-600 uppercase">Awaiting_Detection...</span>
                          )
                        }
                      </div>
                    </div>
                  </div>

                  {selectedInvestigation.status === 'ready_for_review' && (
                    <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
                      <button className="px-6 py-2 bg-slate-800 text-brand-accent text-[10px] font-bold rounded uppercase tracking-widest hover:bg-slate-700 transition-all border border-slate-700">REJECT_STORY</button>
                      <button className="px-6 py-2 bg-brand-accent text-brand-sidebar text-[10px] font-bold rounded uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg active:scale-95">APPROVE_FOR_PUBLICATION</button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Footer Bar */}
      <footer className="h-6 bg-brand-sidebar border-t border-slate-800 flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono italic shrink-0">
        <div className="flex gap-4">
          <span>SESSIONS: ROOT</span>
          <span>UPTIME: 04:22:11</span>
          <span className="text-brand-accent">STABILITY: OPTIMAL</span>
        </div>
        <div className="flex gap-4">
          <span className="text-emerald-500/50">SECURE_TUNNEL_ESTABLISHED</span>
          <span className="text-slate-400 not-italic">v1.4.0-HERMES</span>
        </div>
      </footer>

      {/* Submission Modal */}
      <AnimatePresence>
        {showSubmissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
              onClick={() => setShowSubmissionModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-brand-card w-full max-w-xl rounded border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-brand-sidebar">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-100 flex items-center gap-2">
                  <Plus size={16} className="text-brand-accent" />
                  Initialize_Investigation
                </h2>
                <button onClick={() => setShowSubmissionModal(false)} className="text-slate-500 hover:text-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between">
                      Source_Node (URL)
                      <span className="text-brand-accent/50 font-mono">*REQUIRED</span>
                    </label>
                    <input 
                      type="url" 
                      placeholder="https://..." 
                      className="w-full px-4 py-2.5 bg-brand-sidebar border border-slate-800 rounded text-xs font-mono focus:border-brand-accent outline-none text-slate-200 transition-all placeholder:text-slate-700"
                      id="submit-url"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contextual_Data_Stream</label>
                    <textarea 
                      placeholder="Input behavioral analysis or notes..." 
                      className="w-full px-4 py-3 bg-brand-sidebar border border-slate-800 rounded text-xs focus:border-brand-accent outline-none text-slate-200 transition-all h-28 resize-none placeholder:text-slate-700 font-mono leading-relaxed"
                      id="submit-notes"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Origin_Protocol</label>
                      <select className="w-full px-4 py-2.5 bg-brand-sidebar border border-slate-800 rounded text-xs outline-none text-slate-300 font-mono" id="submit-type">
                        <option value="x">PROTOCOL_X</option>
                        <option value="tiktok">PROTOCOL_TT</option>
                        <option value="blog">PROTOCOL_BLOG</option>
                        <option value="other">PROTOCOL_RAW</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-brand-sidebar border-t border-slate-700 flex justify-end gap-3">
                <button onClick={() => setShowSubmissionModal(false)} className="px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest">Abort</button>
                <button 
                  onClick={async () => {
                    const url = (document.getElementById("submit-url") as HTMLInputElement).value;
                    const notes = (document.getElementById("submit-notes") as HTMLTextAreaElement).value;
                    const source_type = (document.getElementById("submit-type") as HTMLSelectElement).value;

                    setLoading(true);
                    try {
                      await fetch("/api/investigations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url, notes, source_type })
                      });
                      setShowSubmissionModal(false);
                      fetchInvestigations();
                    } catch (error) {
                      console.error("Submission failed:", error);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="bg-brand-accent text-brand-sidebar px-6 py-2 rounded text-[10px] font-bold hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all active:scale-95 uppercase tracking-widest"
                >
                  EXECUTE_SEQUENCE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, collapsed }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2.5 rounded transition-all duration-200 group relative ${
        active 
          ? "bg-brand-accent/10 border-l-2 border-brand-accent text-brand-accent" 
          : "text-slate-500 hover:bg-slate-800/40 hover:text-slate-200"
      }`}
    >
      <Icon size={16} />
      {!collapsed && <span className="font-bold text-[11px] uppercase tracking-wider">{label}</span>}
      {active && !collapsed && <div className="ml-auto w-1 h-3 bg-brand-accent rounded-full animate-pulse" />}
      {collapsed && active && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-brand-accent rounded-full" />}
    </button>
  );
}
