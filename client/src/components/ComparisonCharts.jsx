import React from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';

// Custom Glowing Radar Chart Component (React-19 compliant custom SVG)
export const GlowingRadarChart = ({ name1, name2, scorecard1 = {}, scorecard2 = {} }) => {
    const size = 300;
    const center = size / 2;
    const rMax = 100; // max radius inside svg
    
    const preferences = ["Safety", "Ingredients", "Value", "Skin Match", "Community"];
    const scores1 = {
        "Safety": scorecard1?.["Safety Score"] || 50,
        "Ingredients": scorecard1?.["Ingredient Quality"] || 50,
        "Value": scorecard1?.["Price Value"] || 50,
        "Skin Match": scorecard1?.["Skin Compatibility"] || 50,
        "Community": scorecard1?.["Community Rating"] || 50
    };
    const scores2 = {
        "Safety": scorecard2?.["Safety Score"] || 50,
        "Ingredients": scorecard2?.["Ingredient Quality"] || 50,
        "Value": scorecard2?.["Price Value"] || 50,
        "Skin Match": scorecard2?.["Skin Compatibility"] || 50,
        "Community": scorecard2?.["Community Rating"] || 50
    };

    const numPoints = preferences.length;
    
    // Calculates coordinate vertices for polygon plotting
    const getCoordinates = (index, value) => {
        const angle = (Math.PI * 2 / numPoints) * index - Math.PI / 2;
        const radius = (value / 100) * rMax;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        return { x, y };
    };

    // Concentric grid rings
    const rings = [20, 40, 60, 80, 100];
    
    // Paths for product polygons
    const points1 = preferences.map((pref, i) => {
        const val = scores1[pref];
        const coord = getCoordinates(i, val);
        return `${coord.x},${coord.y}`;
    }).join(' ');

    const points2 = preferences.map((pref, i) => {
        const val = scores2[pref];
        const coord = getCoordinates(i, val);
        return `${coord.x},${coord.y}`;
    }).join(' ');

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-white/5 rounded-3xl backdrop-blur-xl max-w-full w-full">
            <h4 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Preference Spectrum</h4>
            
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Defs for neon gradients and glowing shadow filters */}
                <defs>
                    <radialGradient id="grad-center" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                    
                    <linearGradient id="neon-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    
                    <linearGradient id="neon-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    
                    <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Base center circle */}
                <circle cx={center} cy={center} r={rMax} fill="url(#grad-center)" />

                {/* Grid Web Concentric Rings */}
                {rings.map((ring, idx) => (
                    <circle 
                        key={idx} 
                        cx={center} 
                        cy={center} 
                        r={(ring / 100) * rMax} 
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.04)" 
                        strokeWidth="1"
                    />
                ))}

                {/* Spokes Axis Lines */}
                {preferences.map((_, i) => {
                    const coord = getCoordinates(i, 100);
                    return (
                        <line 
                            key={i} 
                            x1={center} 
                            y1={center} 
                            x2={coord.x} 
                            y2={coord.y} 
                            stroke="rgba(255, 255, 255, 0.05)" 
                            strokeWidth="1"
                            strokeDasharray="2,2"
                        />
                    );
                })}

                {/* Plot: Product 1 Polygon (Neon Purple / Indigo) */}
                <polygon 
                    points={points1} 
                    fill="rgba(99, 102, 241, 0.12)" 
                    stroke="url(#neon-purple)" 
                    strokeWidth="2"
                    filter="url(#glow-purple)"
                />

                {/* Plot: Product 2 Polygon (Neon Emerald) */}
                <polygon 
                    points={points2} 
                    fill="rgba(16, 185, 129, 0.08)" 
                    stroke="url(#neon-emerald)" 
                    strokeWidth="2"
                    filter="url(#glow-emerald)"
                />

                {/* Metric Vertex Text Labels */}
                {preferences.map((pref, i) => {
                    const labelDistance = 120; // pushes labels outside vertices slightly
                    const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
                    const x = center + labelDistance * Math.cos(angle);
                    const y = center + labelDistance * Math.sin(angle);
                    
                    let anchor = "middle";
                    if (Math.cos(angle) > 0.1) anchor = "start";
                    else if (Math.cos(angle) < -0.1) anchor = "end";

                    return (
                        <text 
                            key={i}
                            x={x}
                            y={y + 3}
                            fill="rgba(148, 163, 184, 0.9)"
                            fontSize="9"
                            fontWeight="700"
                            textAnchor={anchor}
                            className="tracking-wider uppercase select-none font-sans"
                        >
                            {pref}
                        </text>
                    );
                })}
            </svg>

            {/* Legend Labels */}
            <div className="flex gap-4 mt-6 border-t border-white/5 pt-4 w-full justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 shadow-md"></div>
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[110px]">{name1}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-md"></div>
                    <span className="text-xs font-bold text-slate-300 truncate max-w-[110px]">{name2}</span>
                </div>
            </div>
        </div>
    );
};

export const ComparisonCharts = ({ p1, p2, comparisonData, scorecard1 = {}, scorecard2 = {} }) => {
    return (
        <div className="grid lg:grid-cols-2 gap-8 items-start w-full">
            {/* Custom Radar Spectrum Chart */}
            <GlowingRadarChart 
                scorecard1={scorecard1}
                scorecard2={scorecard2}
                name1={p1?.name || p1?.title || 'Product A'}
                name2={p2?.name || p2?.title || 'Product B'}
            />

            {/* Fake Review Probability & Integrity Audit Cards */}
            <div className="flex flex-col gap-6 w-full">
                <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
                    <div className="flex items-center gap-2.5 mb-4 text-purple-400">
                        <ShieldAlert size={18} />
                        <h4 className="font-extrabold text-xs uppercase tracking-widest">Integrity Audit: {(p1?.name || p1?.title || 'Product A').substring(0, 18)}...</h4>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0 flex items-center justify-center">
                            <svg width="70" height="70" className="rotate-[-90deg]">
                                <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="5" />
                                <circle 
                                    cx="35" 
                                    cy="35" 
                                    r="28" 
                                    fill="none" 
                                    stroke={(comparisonData?.fake_analysis?.product_1?.fake_prob || 0) > 40 ? '#f87171' : '#34d399'} 
                                    strokeWidth="5" 
                                    strokeDasharray={2 * Math.PI * 28}
                                    strokeDashoffset={(1 - (comparisonData?.fake_analysis?.product_1?.fake_prob || 10) / 100) * (2 * Math.PI * 28)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-[10px] font-black">{comparisonData?.fake_analysis?.product_1?.fake_prob || 0}%</span>
                        </div>
                        <div className="flex-1 text-xs text-slate-400 leading-relaxed">
                            <p className="font-bold text-slate-300 mb-1">Fake Review Risk Level</p>
                            <p>Detected {comparisonData?.fake_analysis?.product_1?.duplicate_count || 0} duplicate review patterns and {comparisonData?.fake_analysis?.product_1?.spam_count || 0} short comment bursts out of {comparisonData?.fake_analysis?.product_1?.total_reviews || 0} total posts.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
                    <div className="flex items-center gap-2.5 mb-4 text-emerald-400">
                        <ShieldAlert size={18} />
                        <h4 className="font-extrabold text-xs uppercase tracking-widest">Integrity Audit: {(p2?.name || p2?.title || 'Product B').substring(0, 18)}...</h4>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0 flex items-center justify-center">
                            <svg width="70" height="70" className="rotate-[-90deg]">
                                <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="5" />
                                <circle 
                                    cx="35" 
                                    cy="35" 
                                    r="28" 
                                    fill="none" 
                                    stroke={(comparisonData?.fake_analysis?.product_2?.fake_prob || 0) > 40 ? '#f87171' : '#34d399'} 
                                    strokeWidth="5" 
                                    strokeDasharray={2 * Math.PI * 28}
                                    strokeDashoffset={(1 - (comparisonData?.fake_analysis?.product_2?.fake_prob || 10) / 100) * (2 * Math.PI * 28)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-[10px] font-black">{comparisonData?.fake_analysis?.product_2?.fake_prob || 0}%</span>
                        </div>
                        <div className="flex-1 text-xs text-slate-400 leading-relaxed">
                            <p className="font-bold text-slate-300 mb-1">Fake Review Risk Level</p>
                            <p>Detected {comparisonData?.fake_analysis?.product_2?.duplicate_count || 0} duplicate review patterns and {comparisonData?.fake_analysis?.product_2?.spam_count || 0} short comment bursts out of {comparisonData?.fake_analysis?.product_2?.total_reviews || 0} total posts.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComparisonCharts;
