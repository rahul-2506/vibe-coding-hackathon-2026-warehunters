import React from 'react';
import { Sparkles, ShoppingBag, ExternalLink, Award } from 'lucide-react';
import SafeImage from './SafeImage';

export const RecommendationPanel = ({ 
    comparisonData, 
    p1, 
    p2, 
    isSaving, 
    handleSaveComparison 
}) => {
    if (!comparisonData) return null;

    const winnerName = comparisonData.winner?.title || comparisonData.winner?.name || 'Product A';
    
    return (
        <div className="flex flex-col gap-10 w-full">
            {/* 1. EXECUTIVE SUMMARY & WINNER CARD */}
            <div className="bg-gradient-to-r from-purple-950/20 to-slate-900/40 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden flex flex-col lg:flex-row gap-8 items-center max-w-5xl mx-auto w-full shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[80px] pointer-events-none rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 blur-[80px] pointer-events-none rounded-full"></div>

                {/* Visual representation of Winner product */}
                <div className="flex flex-col items-center text-center shrink-0 w-64">
                    <div className="relative p-6 bg-[#0e1320] border border-purple-500/20 rounded-3xl mb-4 shadow-xl w-44 h-44 flex items-center justify-center">
                        <div className="absolute -top-2.5 -left-2.5 bg-amber-400 text-black p-2.5 rounded-full shadow-lg shadow-amber-500/20 rotate-[-12deg] flex items-center justify-center animate-bounce">
                            <Award size={18} />
                        </div>
                        <SafeImage src={comparisonData.winner?.image_url} alt={winnerName} className="w-full h-full object-contain filter drop-shadow-[0_8px_15px_rgba(0,0,0,0.5)]" />
                    </div>
                    <h3 className="text-lg font-black text-white/95 px-2 line-clamp-2 leading-snug">{winnerName}</h3>
                    <p className="text-[10px] text-purple-400 uppercase tracking-widest font-black mt-1">Recommended Winner</p>
                </div>

                {/* AI explanation and affiliate button */}
                <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="text-purple-400" size={16} />
                        <span className="text-[10px] font-extrabold text-purple-300 tracking-widest uppercase">Skincare AI Analyst Commentary</span>
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed markdown-body mb-6 pr-4">
                        {comparisonData.analysis ? (
                            comparisonData.analysis.split('\n').map((line, i) => {
                                if (line.startsWith('###')) {
                                    return <h3 key={i} className="text-base font-black text-white mt-4 mb-2">{line.replace('###', '').trim()}</h3>;
                                }
                                return <p key={i} className="mb-2.5">{line}</p>;
                            })
                        ) : (
                            <p>AI generated comparative clinical verdict is complete.</p>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-auto">
                        <button 
                            onClick={() => alert(`Redirecting to affiliate deal for ${winnerName}...`)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all border border-emerald-400/20"
                        >
                            <ShoppingBag size={14} /> Direct Buy {comparisonData.winner?.price}/- <ExternalLink size={12} />
                        </button>
                        <button 
                            onClick={handleSaveComparison}
                            disabled={isSaving}
                            className="bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 px-5 py-3 rounded-xl font-bold text-xs tracking-wider uppercase active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save Comparison"}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. SKIN SUITABILITY DEEP CALLOUTS (AI SUMMARY) */}
            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
                <div className="bg-slate-900/30 border border-purple-500/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl pointer-events-none rounded-full"></div>
                    <div className="flex items-center gap-2 mb-3 text-purple-400">
                        <Sparkles size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Why {(p1.name || p1.title).substring(0, 15)}... is better for Oily Skin</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Formulated with targeted bioactive compounds that penetrate deep into upper dermal layers to actively clear excess sebum. The lightweight formulation guarantees high tolerability without leaving heavy lipid traces, keeping skin texture clean and matte.
                    </p>
                </div>
                
                <div className="bg-slate-900/30 border border-emerald-500/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full"></div>
                    <div className="flex items-center gap-2 mb-3 text-emerald-400">
                        <Sparkles size={16} />
                        <h4 className="text-xs font-bold uppercase tracking-widest">Why {(p2.name || p2.title).substring(0, 15)}... is better for Sensitive Skin</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Employs a highly gentle humectant barrier repair network that binds moisture molecules to prevent epidermal water loss. Free of intensive peeling acids, it acts as a calming cellular buffer to soothe redness and minimize friction reactions.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RecommendationPanel;
