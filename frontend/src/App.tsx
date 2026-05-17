import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Cpu,
  Layers,
  Terminal,
  Info,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Search,
  Box,
  BrainCircuit,
  Lock,
  ChevronRight,
  Trophy,
  BarChart2,
} from 'lucide-react';
import axios from 'axios';
import heroImg from './assets/hero.png';
import CausalGraph from './components/CausalGraph';
import MetricsPanel from './components/MetricsPanel';

const API_BASE = '/api';

interface Config {
  features: string[];
  feature_descriptions: Record<string, string>;
  ground_truth: { source: string; target: string }[];
  strategies: { id: string; name: string; description: string; prompt: string }[];
  models: { id: string; name: string }[];
  dataset: Record<string, number>[];
}

interface AnalysisResult {
  raw_response: string;
  parsed_edges: { source: string; target: string }[];
  metrics: {
    precision: number; recall: number; f1: number; shd: number;
    fdr: number; pearson: number; hamming: number; frobenius: number;
  };
  slr: number;
}

interface LeaderboardEntry {
  model: string;
  model_id: string;
  strategy: string;
  strategy_id: string;
  metrics: { f1: number; precision: number; recall: number; shd: number; fdr: number; pearson: number; hamming: number; frobenius: number };
  slr: number;
  edge_count: number;
}

// ── Inline strategy bar chart ────────────────────────────────────────────────
const StrategyChart: React.FC<{
  data: LeaderboardEntry[];
  selectedStrategyId: string;
}> = ({ data, selectedStrategyId }) => {
  const maxF1 = Math.max(...data.map(d => d.metrics.f1), 0.01);
  return (
    <div className="space-y-3">
      {[...data].sort((a, b) => b.metrics.f1 - a.metrics.f1).map((entry, idx) => {
        const isActive = entry.strategy_id === selectedStrategyId;
        const pct = (entry.metrics.f1 / maxF1) * 100;
        return (
          <div key={entry.strategy_id} className="flex items-center gap-5">
            <div className={`w-28 text-[10px] font-black uppercase tracking-wider truncate text-right transition-colors ${isActive ? 'text-cyber-accent' : 'text-gray-600'}`}>
              {entry.strategy}
            </div>
            <div className="flex-1 h-7 bg-black/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.05 }}
                className={`h-full rounded-full ${
                  isActive
                    ? 'bg-gradient-to-r from-cyber-accent to-cyber-neon shadow-[0_0_12px_rgba(0,242,255,0.3)]'
                    : 'bg-white/10'
                }`}
              />
            </div>
            <div className={`w-12 text-sm font-black font-mono text-right transition-colors ${isActive ? 'text-cyber-accent' : 'text-gray-600'}`}>
              {(entry.metrics.f1 * 100).toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Rank badge ───────────────────────────────────────────────────────────────
const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const cls =
    rank === 1 ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
    rank === 2 ? 'bg-gray-400/20 text-gray-300 border-gray-400/30' :
    rank === 3 ? 'bg-orange-600/20 text-orange-400 border-orange-500/30' :
    'text-gray-600 border-transparent';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black border ${cls}`}>
      {rank}
    </span>
  );
};

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab]         = useState('about');
  const [config, setConfig]               = useState<Config | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [result, setResult]               = useState<AnalysisResult | null>(null);
  const [loading, setLoading]             = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [leaderboard, setLeaderboard]     = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE}/config`).then(res => {
      const data = res.data;
      if (data?.strategies?.length && data?.models?.length) {
        setConfig(data);
        setSelectedStrategy(data.strategies[0].id);
        setSelectedModel(data.models[0].id);
      }
    }).catch(err => console.error('Config fetch error:', err));

    axios.get(`${API_BASE}/leaderboard`)
      .then(res => setLeaderboard(res.data))
      .catch(err => console.error('Leaderboard fetch error:', err));
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/analyze`, {
        dataset_fingerprint: 'THESIS_DATASET',
        strategy_id: selectedStrategy,
        model_id: selectedModel,
      });
      setResult(res.data);
      setActiveTab('evaluation');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'about',       label: 'The Research',  icon: Info },
    { id: 'experiment',  label: 'Prompt Lab',    icon: Terminal },
    { id: 'evaluation',  label: 'Analysis',      icon: BrainCircuit },
    { id: 'leaderboard', label: 'Leaderboard',   icon: Trophy },
  ];

  const selectedModelName  = config?.models.find(m => m.id === selectedModel)?.name ?? '';
  const currentPrompt      = config?.strategies.find(s => s.id === selectedStrategy)?.prompt ?? '';
  const modelLeaderboard   = leaderboard.filter(e => e.model_id === selectedModel);

  if (!config) {
    return (
      <div className="min-h-screen bg-[#050506] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-cyber-accent border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#00f2ff]" />
          <p className="text-cyber-accent font-black tracking-[0.3em] uppercase text-xs animate-pulse">Initializing Research Pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050506] text-white selection:bg-cyber-accent selection:text-black overflow-hidden font-sans">

      {/* ── Background ── */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-cyber-neon/10 via-transparent to-cyber-accent/5" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyber-accent/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyber-neon/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="grid-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#7000ff" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path d="M 0 10 L 100 10 M 0 20 L 100 20 M 0 30 L 100 30 M 0 40 L 100 40 M 0 50 L 100 50 M 0 60 L 100 60 M 0 70 L 100 70 M 0 80 L 100 80 M 0 90 L 100 90" stroke="url(#grid-grad)" strokeWidth="0.05" />
            <path d="M 10 0 L 10 100 M 20 0 L 20 100 M 30 0 L 30 100 M 40 0 L 40 100 M 50 0 L 50 100 M 60 0 L 60 100 M 70 0 L 70 100 M 80 0 L 80 100 M 90 0 L 90 100" stroke="url(#grid-grad)" strokeWidth="0.05" />
          </svg>
        </div>
      </div>

      {/* ── Sidebar nav ── */}
      <nav className="fixed left-0 top-0 bottom-0 glass-morphism z-50 flex flex-col border-r border-white/5 shadow-2xl w-[260px]">
        <div className="p-8 flex items-center gap-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyber-accent to-cyber-neon rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
            <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center border border-white/10">
              <Cpu className="text-cyber-accent" size={20} />
            </div>
          </div>
          <span className="font-black tracking-tighter text-2xl bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent uppercase">Causal AI</span>
        </div>

        <div className="flex-1 px-4 mt-8 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                activeTab === tab.id
                  ? 'bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/20 shadow-[0_0_20px_rgba(0,242,255,0.05)]'
                  : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon size={18} className={activeTab === tab.id ? 'text-cyber-accent' : 'group-hover:text-cyber-accent transition-colors'} />
              <span className="font-bold text-sm tracking-wide">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="active-tab" className="ml-auto w-1.5 h-1.5 bg-cyber-accent rounded-full shadow-[0_0_10px_#00f2ff]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-8">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">System Ready</span>
            </div>
            <div className="space-y-1">
              <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Target Model</div>
              <div className="text-[11px] font-mono text-cyber-accent/70 truncate uppercase">
                {selectedModelName || 'Initializing...'}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="pl-[260px] h-screen overflow-y-auto relative z-10 custom-scrollbar">
        <header className="px-12 pt-12 pb-8 flex justify-between items-start sticky top-0 bg-transparent backdrop-blur-sm z-20">
          <div>
            <motion.h1
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-5xl font-black tracking-tighter mb-4 gradient-text"
            >
              {activeTab === 'about'       && 'The Causal Frontier'}
              {activeTab === 'experiment'  && 'Discovery Lab'}
              {activeTab === 'evaluation'  && 'Structural Insights'}
              {activeTab === 'leaderboard' && 'Performance Rankings'}
            </motion.h1>
            <p className="text-gray-500 text-base font-medium max-w-2xl leading-relaxed">
              Meta-Prompting and Reasoning-Based LLM Strategies for Sustainable Vehicle Telematics Optimization.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-5 py-3 glass-morphism rounded-2xl flex items-center gap-3 cursor-default">
              <div className="w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_10px_#00f2ff]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Constructor University 2026</span>
            </div>
          </div>
        </header>

        <div className="px-12 pb-24">
          <AnimatePresence mode="wait">

            {/* ═══════════════════════════════ ABOUT ═══════════════════════════════ */}
            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="max-w-5xl space-y-16"
              >
                <div className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl shadow-cyber-accent/5">
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                  <img
                    src={heroImg}
                    alt="High Fidelity Digital Visualization"
                    className="w-full h-[500px] object-cover opacity-80 group-hover:scale-105 transition-transform duration-1000 ease-in-out"
                  />
                  <div className="absolute bottom-12 left-12 z-20 space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-4 py-1.5 bg-cyber-accent text-black text-[10px] font-black rounded-full inline-block uppercase tracking-[0.2em]"
                    >
                      Yahya Maniar · Bachelor Thesis
                    </motion.div>
                    <h2 className="text-5xl font-black tracking-tight leading-none drop-shadow-2xl">
                      Meta-Prompting <br /> <span className="text-cyber-accent">&amp; Reasoning Strategies</span>
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-12 text-xl text-gray-300 font-light leading-[1.8]">
                    <p className="first-letter:text-7xl first-letter:font-black first-letter:mr-4 first-letter:float-left first-letter:text-cyber-accent first-letter:leading-none">
                      Vehicle telematics systems generate continuous streams of operational data covering energy consumption,
                      driving, battery status, and vehicle dynamics. As LLMs are increasingly applied to such data, two
                      practical questions arise: which prompting strategy produces the most accurate causal discovery results,
                      and does the choice of strategy also influence sensitivity leakage?
                    </p>
                    <div className="p-10 rounded-[2rem] bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity duration-700">
                        <Lock size={120} className="text-cyber-neon" />
                      </div>
                      <h3 className="text-cyber-accent font-black uppercase text-xs tracking-[0.3em] mb-6">Abstract Insight</h3>
                      <p className="relative z-10 italic text-gray-400">
                        "Llama 3.1 8B consistently parsed causal graphs across all strategies, while reasoning-oriented
                        models like DeepSeek-R1 required explicit output scaffolding to unlock their full potential."
                      </p>
                    </div>
                    <p>
                      This study introduces the Sensitivity Leakage Rate (SLR) to quantify prompt-level risks. Findings
                      indicate that constrained edge-notation output format effectively suppresses leakage, showing that
                      prompt scope — rather than strategy type — is the primary driver of data exposure.
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div className="glass-morphism p-8 rounded-[2rem] border-t border-white/10 space-y-6">
                      <BrainCircuit className="text-cyber-accent" size={32} />
                      <h4 className="text-lg font-bold">Thesis Overview</h4>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        A comparative evaluation of Few-Shot, CoT, Style, ReAct, and Meta-Prompting across Llama 3.1,
                        DeepSeek-R1, and Qwen3 architectures.
                      </p>
                      <ul className="space-y-4 pt-4">
                        {[
                          { label: '8 Metrics Framework', icon: Search, page: 13 },
                          { label: 'SLR Risk Analysis',   icon: ShieldCheck, page: 14 },
                          { label: 'Ground Truth Reference', icon: Layers, page: 18 },
                        ].map(item => (
                          <li
                            key={item.label}
                            onClick={() => window.open(`/Thesis_Maniar_Overleaf.pdf#page=${item.page + 2}`, '_blank')}
                            className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-cyber-accent transition-colors cursor-pointer group"
                          >
                            <item.icon size={14} className="group-hover:scale-110 transition-transform" /> {item.label}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      onClick={() => window.open('/Thesis_Maniar_Overleaf.pdf', '_blank')}
                      className="aspect-square glass-morphism rounded-[2rem] flex items-center justify-center p-8 text-center group cursor-pointer hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="space-y-4">
                        <div className="w-16 h-16 rounded-full bg-cyber-neon/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500">
                          <Activity className="text-cyber-neon" />
                        </div>
                        <div className="text-xs font-black uppercase tracking-widest">View Full Thesis</div>
                        <ArrowRight className="mx-auto text-gray-600 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════ EXPERIMENT ═══════════════════════════════ */}
            {activeTab === 'experiment' && (
              <motion.div
                key="experiment"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="grid grid-cols-1 xl:grid-cols-4 gap-12"
              >
                {/* Left controls */}
                <div className="xl:col-span-1 space-y-12">
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-6 flex items-center gap-3">
                        <span className="w-8 h-[1px] bg-gray-800" /> Benchmark Models
                      </h3>
                      <div className="space-y-3">
                        {config.models.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedModel(m.id)}
                            className={`w-full p-5 rounded-2xl text-left transition-all duration-300 border flex items-center justify-between group ${
                              selectedModel === m.id
                                ? 'bg-cyber-accent/10 border-cyber-accent/40 shadow-[0_0_20px_rgba(0,242,255,0.05)]'
                                : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className={`font-bold text-xs uppercase tracking-widest ${selectedModel === m.id ? 'text-cyber-accent' : 'text-gray-400 group-hover:text-white'}`}>
                                {m.name}
                              </div>
                              <div className="text-[10px] text-gray-600 font-medium">Research Configuration</div>
                            </div>
                            {selectedModel === m.id && <Zap size={14} className="text-cyber-accent fill-cyber-accent animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 mb-6 flex items-center gap-3">
                        <span className="w-8 h-[1px] bg-gray-800" /> Research Strategy
                      </h3>
                      <div className="relative">
                        <select
                          value={selectedStrategy}
                          onChange={e => setSelectedStrategy(e.target.value)}
                          className="w-full bg-[#121214] border border-white/10 rounded-xl px-6 py-5 text-sm font-bold tracking-wide focus:border-cyber-accent/50 outline-none appearance-none cursor-pointer hover:bg-white/5 transition-all text-white shadow-xl"
                        >
                          {config.strategies.map(s => (
                            <option key={s.id} value={s.id} className="bg-[#121214] text-white py-4">{s.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                          <ChevronRight className="rotate-90 text-cyber-accent" size={16} />
                        </div>
                      </div>
                      <div className="mt-6 p-6 rounded-2xl bg-cyber-neon/5 border border-cyber-neon/10 italic text-[11px] text-gray-500 leading-relaxed">
                        {config.strategies.find(s => s.id === selectedStrategy)?.description}
                      </div>
                    </section>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="group relative w-full overflow-hidden rounded-2xl cursor-pointer active:scale-95 transition-transform"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ff] to-[#7000ff] group-hover:scale-110 transition-transform duration-500" />
                      <div className="relative py-6 px-8 flex items-center justify-center gap-4 text-black font-black uppercase tracking-[0.4em] text-sm shadow-[0_0_40px_rgba(0,242,255,0.2)]">
                        {loading ? (
                          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <><Zap size={20} fill="black" /> Run Discovery</>
                        )}
                      </div>
                    </button>
                    <p className="mt-4 text-[9px] text-center text-gray-600 font-bold uppercase tracking-widest">
                      {selectedModelName} · {config.strategies.find(s => s.id === selectedStrategy)?.name}
                    </p>
                  </div>
                </div>

                {/* Right panels */}
                <div className="xl:col-span-3 space-y-12">
                  {/* Dataset preview table */}
                  <div className="glass-morphism rounded-[2.5rem] p-10 border border-white/5 overflow-hidden flex flex-col max-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-cyber-accent/20 flex items-center justify-center">
                          <Database size={14} className="text-cyber-accent" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Full Research Dataset Preview</span>
                      </div>
                      <span className="text-[10px] font-bold text-cyber-accent/50 uppercase tracking-widest">50 Rows Loaded</span>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar pr-4">
                      <table className="w-full text-[10px] font-mono text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10">
                            {config.features.map(f => (
                              <th key={f} className="px-4 py-3 text-gray-400 font-bold uppercase tracking-tighter truncate">{f.replace(/_/g, ' ')}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {config.dataset.map((row, i) => (
                            <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                              {config.features.map(f => (
                                <td key={f} className="px-4 py-3 text-cyber-accent/80">{Number(row[f]).toFixed(4)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Feature list + description tooltip */}
                    <div className="lg:col-span-1 space-y-8">
                      <div className="glass-morphism rounded-[2rem] p-8 space-y-6">
                        <div className="flex items-center gap-3">
                          <Box className="text-cyber-accent" size={18} />
                          <h4 className="text-xs font-black uppercase tracking-widest">Dataset Features</h4>
                        </div>
                        <div className="space-y-3">
                          {config.features.map(f => (
                            <div
                              key={f}
                              onMouseEnter={() => setHoveredFeature(f)}
                              onMouseLeave={() => setHoveredFeature(null)}
                              className={`px-4 py-3 rounded-xl border font-mono text-[10px] transition-all cursor-help uppercase tracking-wider ${
                                hoveredFeature === f
                                  ? 'bg-cyber-accent/10 border-cyber-accent text-white'
                                  : 'bg-black/20 border-white/5 text-gray-500'
                              }`}
                            >
                              {f.replace(/_/g, ' ')}
                            </div>
                          ))}
                        </div>

                        {/* Description tooltip area */}
                        <AnimatePresence mode="wait">
                          {hoveredFeature ? (
                            <motion.div
                              key={hoveredFeature}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="p-4 rounded-xl bg-cyber-accent/5 border border-cyber-accent/20"
                            >
                              <span className="text-cyber-accent font-black uppercase text-[9px] tracking-wider block mb-2">
                                {hoveredFeature.replace(/_/g, ' ')}
                              </span>
                              <p className="text-[10px] text-gray-400 leading-relaxed">
                                {config.feature_descriptions[hoveredFeature]}
                              </p>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="placeholder"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="p-4 rounded-xl border border-white/5 bg-white/[0.01]"
                            >
                              <p className="text-[10px] text-gray-700 italic text-center">Hover a feature to see its description</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Terminal panel */}
                    <div className="lg:col-span-3 glass-morphism rounded-[2.5rem] p-10 flex flex-col min-h-[600px] border border-white/5 shadow-inner">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-cyber-neon/20 flex items-center justify-center">
                            <Terminal size={14} className="text-cyber-neon" />
                          </div>
                          <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Pipeline Stream</span>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col bg-black/40 rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                        {/* Prompt section — always visible */}
                        <div className="p-8 border-b border-white/[0.05]">
                          <span className="text-[9px] tracking-[0.3em] uppercase text-cyber-accent/40 block mb-3">Input Prompt</span>
                          <pre className="text-gray-600 text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                            {currentPrompt}
                          </pre>
                        </div>

                        {/* Response section */}
                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                          {result ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="whitespace-pre-wrap text-emerald-400/80 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)] text-sm leading-loose"
                            >
                              <span className="text-[9px] tracking-[0.3em] uppercase text-emerald-500/40 block mb-3">Model Response</span>
                              {result.raw_response}
                            </motion.div>
                          ) : (
                            <div className="h-full flex items-center justify-center flex-col gap-6 text-gray-700 italic">
                              <Layers className="animate-bounce" size={40} />
                              <p className="tracking-widest uppercase text-[10px] font-black">Awaiting execution...</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {result && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-8 p-8 bg-gradient-to-r from-cyber-accent/5 to-transparent rounded-[2rem] border-l-4 border-cyber-accent flex items-center justify-between shadow-xl"
                        >
                          <div className="space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-cyber-accent mb-2">Discovery Finalized</div>
                            <div className="text-3xl font-black tracking-tighter">
                              {result.parsed_edges.length} <span className="text-sm font-medium text-gray-500 uppercase tracking-widest">Causal Links Identified</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveTab('evaluation')}
                            className="p-5 bg-white text-black rounded-full hover:scale-110 transition-all shadow-2xl shadow-white/10"
                          >
                            <ArrowRight size={24} strokeWidth={3} />
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════ EVALUATION ═══════════════════════════════ */}
            {activeTab === 'evaluation' && (
              <motion.div
                key="evaluation"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="space-y-16"
              >
                {!result ? (
                  <div className="h-[600px] glass-morphism rounded-[3rem] border border-dashed border-white/10 flex items-center justify-center flex-col gap-8 group">
                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                      <Search size={40} className="text-gray-700 group-hover:text-cyber-accent transition-colors" />
                    </div>
                    <button onClick={() => setActiveTab('experiment')} className="px-10 py-4 bg-white/5 border border-white/10 text-white rounded-full text-xs font-black uppercase tracking-[0.2em] hover:bg-cyber-accent hover:text-black hover:border-cyber-accent transition-all">
                      Launch Experiment
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Graph comparison */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                          <Lock size={18} className="text-cyber-neon" />
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Expert Ground Truth</h3>
                        </div>
                        <CausalGraph
                          nodes={config.features}
                          edges={config.ground_truth}
                          title="Reference Graph"
                          predictedEdges={result.parsed_edges}
                        />
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                          <Cpu size={18} className="text-cyber-accent" />
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">LLM Prediction</h3>
                        </div>
                        <CausalGraph
                          nodes={config.features}
                          edges={result.parsed_edges}
                          title={`${selectedModelName} Discovery`}
                          groundTruthEdges={config.ground_truth}
                        />
                      </div>
                    </div>

                    {/* Evaluation matrix */}
                    <div className="glass-morphism p-12 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-cyber-accent/5 rounded-full blur-[120px]" />
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-cyber-accent/20 flex items-center justify-center">
                            <Activity size={24} className="text-cyber-accent" />
                          </div>
                          <h3 className="text-3xl font-black tracking-tighter">Evaluation Matrix</h3>
                        </div>
                        <div className="flex gap-4">
                          <div className="px-6 py-4 glass-morphism rounded-2xl border border-emerald-500/20 text-center min-w-[120px]">
                            <div className="text-[10px] font-black text-gray-600 uppercase mb-1">F1 Score</div>
                            <div className="text-2xl font-black text-emerald-400">{(result.metrics.f1 * 100).toFixed(1)}%</div>
                          </div>
                          <div className="px-6 py-4 glass-morphism rounded-2xl border border-white/5 text-center min-w-[120px]">
                            <div className="text-[10px] font-black text-gray-600 uppercase mb-1">SHD</div>
                            <div className="text-2xl font-black text-amber-400">{result.metrics.shd}</div>
                          </div>
                          <div className="px-6 py-4 glass-morphism rounded-2xl border border-purple-500/20 text-center min-w-[120px]">
                            <div className="text-[10px] font-black text-gray-600 uppercase mb-1">SLR</div>
                            <div className="text-2xl font-black text-purple-400">{(result.slr * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>

                      {/* SLR explanation */}
                      <div className="mb-10 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-4 relative z-10">
                        <ShieldCheck size={18} className="text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 block mb-1">Sensitivity Leakage Rate (SLR) — Novel Metric</span>
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            Fraction of the model's response that falls outside structured edge notation.
                            SLR = 0 means the model output only edges (no leakage); SLR = 1 means the response contained no edge notation at all.
                            Constrained output formats suppress leakage — prompt scope, not strategy type, drives exposure.
                          </p>
                        </div>
                      </div>

                      <MetricsPanel metrics={result.metrics} />
                    </div>

                    {/* Strategy bar chart */}
                    {modelLeaderboard.length > 0 && (
                      <div className="glass-morphism p-12 rounded-[3rem] border border-white/5 shadow-2xl">
                        <div className="flex items-center justify-between mb-10">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-cyber-neon/20 flex items-center justify-center">
                              <BarChart2 size={24} className="text-cyber-neon" />
                            </div>
                            <h3 className="text-3xl font-black tracking-tighter">Strategy Performance</h3>
                          </div>
                          <span className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                            {selectedModelName} · F1 Score
                          </span>
                        </div>
                        <StrategyChart data={modelLeaderboard} selectedStrategyId={selectedStrategy} />
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ═══════════════════════════════ LEADERBOARD ═══════════════════════════════ */}
            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12 max-w-6xl"
              >
                {/* Summary stats */}
                {leaderboard.length > 0 && (
                  <div className="grid grid-cols-3 gap-6">
                    {[
                      { label: 'Best F1', value: `${(leaderboard[0].metrics.f1 * 100).toFixed(1)}%`, sub: `${leaderboard[0].model} · ${leaderboard[0].strategy}`, color: 'text-emerald-400' },
                      { label: 'Lowest SHD', value: String([...leaderboard].sort((a, b) => a.metrics.shd - b.metrics.shd)[0]?.metrics.shd ?? '-'), sub: [...leaderboard].sort((a, b) => a.metrics.shd - b.metrics.shd)[0] ? `${[...leaderboard].sort((a, b) => a.metrics.shd - b.metrics.shd)[0].model} · ${[...leaderboard].sort((a, b) => a.metrics.shd - b.metrics.shd)[0].strategy}` : '', color: 'text-amber-400' },
                      { label: 'Lowest SLR', value: `${(([...leaderboard].sort((a, b) => a.slr - b.slr)[0]?.slr ?? 0) * 100).toFixed(0)}%`, sub: [...leaderboard].sort((a, b) => a.slr - b.slr)[0] ? `${[...leaderboard].sort((a, b) => a.slr - b.slr)[0].model} · ${[...leaderboard].sort((a, b) => a.slr - b.slr)[0].strategy}` : '', color: 'text-purple-400' },
                    ].map(stat => (
                      <div key={stat.label} className="glass-morphism p-8 rounded-[2rem] border border-white/5 text-center space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">{stat.label}</div>
                        <div className={`text-4xl font-black tracking-tighter ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] text-gray-600 font-mono truncate">{stat.sub}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rankings table */}
                <div className="glass-morphism rounded-[2rem] border border-white/5 overflow-hidden">
                  <div className="px-8 py-6 border-b border-white/5 flex items-center gap-4">
                    <Trophy size={18} className="text-cyber-accent" />
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">All 24 Model × Strategy Combinations — Ranked by F1</span>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['Rank','Model','Strategy','F1','Precision','Recall','SHD','SLR','Edges'].map(col => (
                            <th key={col} className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-600 whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, i) => {
                          const isCurrent = result && entry.model_id === selectedModel && entry.strategy_id === selectedStrategy;
                          return (
                            <tr
                              key={`${entry.model_id}-${entry.strategy_id}`}
                              className={`border-b border-white/[0.03] transition-colors ${isCurrent ? 'bg-cyber-accent/5' : 'hover:bg-white/[0.02]'}`}
                            >
                              <td className="px-5 py-4"><RankBadge rank={i + 1} /></td>
                              <td className="px-5 py-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">{entry.model}</td>
                              <td className="px-5 py-4 font-bold text-[11px] text-gray-300 whitespace-nowrap">
                                {entry.strategy}
                                {isCurrent && <span className="ml-2 text-[9px] text-cyber-accent font-black uppercase tracking-wider">active</span>}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`font-black font-mono ${entry.metrics.f1 >= 0.5 ? 'text-emerald-400' : entry.metrics.f1 > 0 ? 'text-yellow-500' : 'text-gray-600'}`}>
                                  {(entry.metrics.f1 * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-5 py-4 font-mono text-gray-500">{(entry.metrics.precision * 100).toFixed(0)}%</td>
                              <td className="px-5 py-4 font-mono text-gray-500">{(entry.metrics.recall * 100).toFixed(0)}%</td>
                              <td className="px-5 py-4 font-mono text-amber-500/70">{entry.metrics.shd}</td>
                              <td className="px-5 py-4 font-mono text-purple-400/70">{(entry.slr * 100).toFixed(0)}%</td>
                              <td className="px-5 py-4 font-mono text-gray-600">{entry.edge_count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pl-[260px] p-12 border-t border-white/5 relative z-10 bg-[#050506]/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Yahya Maniar · Constructor University</div>
            <div className="text-[9px] font-medium text-gray-500">© 2026 Causal Intelligence Dashboard</div>
          </div>
          <div className="flex gap-10">
            {[
              { label: 'Methodology', page: 8 },
              { label: 'Ground Truth', page: 18 },
              { label: 'SLR Analysis', page: 14 },
              { label: 'Findings', page: 23 },
            ].map(item => (
              <span
                key={item.label}
                onClick={() => window.open(`/Thesis_Maniar_Overleaf.pdf#page=${item.page + 2}`, '_blank')}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-cyber-accent transition-colors cursor-pointer"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
