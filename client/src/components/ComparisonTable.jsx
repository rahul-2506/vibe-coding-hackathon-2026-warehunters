import React from 'react';
import { Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ComparisonTable = ({ 
    p1, 
    p2, 
    scorecard1, 
    scorecard2,
    getHighlightedIngredients,
    getProsAndCons
}) => {
    return (
        <div className="flex flex-col gap-10 w-full">
            {/* 1. HIGHLIGHTED INGREDIENT DIFFERENCES */}
            <div className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
                <div className="p-5 border-b border-white/5 flex items-center gap-2">
                    <Sparkles className="text-purple-400" size={16} />
                    <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Bioactive Formula Highlights</h3>
                </div>
                
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                    {/* Product 1 ingredients */}
                    <div className="p-6 flex flex-col gap-4">
                        <h4 className="text-xs font-bold text-purple-300 uppercase tracking-widest mb-1">{p1.name || p1.title} Formula</h4>
                        <div className="flex flex-col gap-3">
                            {getHighlightedIngredients(p1).map((ing, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-xs font-bold text-slate-200 mb-0.5">{ing.name}</p>
                                    <p className="text-[10px] text-slate-400 leading-normal">{ing.role}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Product 2 ingredients */}
                    <div className="p-6 flex flex-col gap-4">
                        <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-1">{p2.name || p2.title} Formula</h4>
                        <div className="flex flex-col gap-3">
                            {getHighlightedIngredients(p2).map((ing, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-xs font-bold text-slate-200 mb-0.5">{ing.name}</p>
                                    <p className="text-[10px] text-slate-400 leading-normal">{ing.role}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. VERIFIED PROS & CONS */}
            <div className="grid md:grid-cols-2 gap-8">
                {/* Product 1 Pros & Cons */}
                <div className="bg-slate-900/30 border border-purple-500/10 rounded-3xl p-6 flex flex-col gap-4 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-purple-300 uppercase tracking-widest border-b border-white/5 pb-2">Pros &amp; Cons: {p1.name || p1.title}</h3>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Pros</h4>
                            {getProsAndCons(p1, scorecard1["Skin Compatibility"] >= scorecard2["Skin Compatibility"]).pros.map((pro, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-300 items-start">
                                    <CheckCircle2 className="text-emerald-400 mt-0.5 shrink-0" size={14} />
                                    <span>{pro}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Cons</h4>
                            {getProsAndCons(p1, scorecard1["Skin Compatibility"] >= scorecard2["Skin Compatibility"]).cons.map((con, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-400 items-start">
                                    <ShieldAlert className="text-amber-500 mt-0.5 shrink-0" size={14} />
                                    <span>{con}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Product 2 Pros & Cons */}
                <div className="bg-slate-900/30 border border-emerald-500/10 rounded-3xl p-6 flex flex-col gap-4 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-widest border-b border-white/5 pb-2">Pros &amp; Cons: {p2.name || p2.title}</h3>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Pros</h4>
                            {getProsAndCons(p2, scorecard2["Skin Compatibility"] >= scorecard1["Skin Compatibility"]).pros.map((pro, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-300 items-start">
                                    <CheckCircle2 className="text-emerald-400 mt-0.5 shrink-0" size={14} />
                                    <span>{pro}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Cons</h4>
                            {getProsAndCons(p2, scorecard2["Skin Compatibility"] >= scorecard1["Skin Compatibility"]).cons.map((con, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-400 items-start">
                                    <ShieldAlert className="text-amber-500 mt-0.5 shrink-0" size={14} />
                                    <span>{con}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonTable;
