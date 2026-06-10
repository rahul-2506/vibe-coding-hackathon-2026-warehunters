import React from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, GitCompare, Landmark, Star, BadgePercent, Truck, Award } from 'lucide-react';
import SafeImage from './SafeImage';

export const ComparisonTable = ({ 
    p1, 
    p2, 
    scorecard1 = {}, 
    scorecard2 = {},
    getHighlightedIngredients,
    getProsAndCons,
    comparisonData
}) => {
    // If neither product is active, display a placeholder
    if (!p1 && !p2) {
        return (
            <div className="bg-[#121824]/60 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-md">
                <p className="text-slate-400 text-sm">Please select products to view comparison details.</p>
            </div>
        );
    }

    // Dynamic specs extraction
    const getSpecs = (p) => {
        if (!p) return {};
        if (p.specifications && Object.keys(p.specifications).length > 0) return p.specifications;
        if (p.features && Object.keys(p.features).length > 0) return p.features;
        return {};
    };

    const normalizeSpecKey = (key) => {
        if (!key) return '';
        const lowercase = key.toLowerCase().trim();
        if (lowercase.includes('ram') || lowercase === 'memory') return 'RAM / Memory';
        if (lowercase.includes('storage') || lowercase.includes('rom') || lowercase.includes('ssd') || lowercase.includes('hdd')) return 'Storage';
        if (lowercase.includes('cpu') || lowercase.includes('processor')) return 'Processor';
        if (lowercase.includes('gpu') || lowercase.includes('graphics') || lowercase.includes('card')) return 'Graphics';
        if (lowercase.includes('display') || lowercase.includes('screen') || lowercase.includes('resolution')) return 'Display / Screen';
        if (lowercase.includes('battery') || lowercase.includes('cell') || lowercase.includes('mah')) return 'Battery life';
        if (lowercase.includes('skin') || lowercase.includes('compatibility')) return 'Skin Compatibility';
        if (lowercase.includes('ingredient') || lowercase.includes('potency') || lowercase.includes('active')) return 'Active Ingredients';
        if (lowercase.includes('scent') || lowercase.includes('fragrance')) return 'Fragrance';
        if (lowercase.includes('texture') || lowercase.includes('feel')) return 'Texture / Feel';
        
        return key.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const getNormalizedSpecs = (p) => {
        if (!p) return {};
        const rawSpecs = getSpecs(p);
        const normalized = {};
        Object.entries(rawSpecs).forEach(([key, val]) => {
            const normKey = normalizeSpecKey(key);
            if (normKey && !['Merchant', 'Seller', 'Merchant Name', 'Url', 'Link', 'Image'].includes(normKey)) {
                normalized[normKey] = val;
            }
        });
        return normalized;
    };

    const specs1 = getNormalizedSpecs(p1);
    const specs2 = getNormalizedSpecs(p2);
    
    // Combine normalized spec keys
    const allSpecKeys = Array.from(new Set([...Object.keys(specs1), ...Object.keys(specs2)]));

    // Price extraction & conversion
    const price1 = p1 ? Number(p1.price || p1.current_price || 0) : null;
    const price2 = p2 ? Number(p2.price || p2.current_price || 0) : null;

    const origPrice1 = p1 ? Number(p1.originalPrice || p1.original_price || price1 || 0) : null;
    const origPrice2 = p2 ? Number(p2.originalPrice || p2.original_price || price2 || 0) : null;

    const disc1 = (origPrice1 && price1 && origPrice1 > price1) ? Math.round((1 - price1 / origPrice1) * 100) : 0;
    const disc2 = (origPrice2 && price2 && origPrice2 > price2) ? Math.round((1 - price2 / origPrice2) * 100) : 0;

    const rating1 = p1 ? Number(p1.rating || 0) : 0;
    const rating2 = p2 ? Number(p2.rating || 0) : 0;

    const delivery1 = p1 ? (p1.delivery_estimate || p1.deliveryEstimate || 'Delivery tomorrow') : 'N/A';
    const delivery2 = p2 ? (p2.delivery_estimate || p2.deliveryEstimate || 'Delivery tomorrow') : 'N/A';

    // Calculate scorecard averages for Performance/Feature Score
    const getAvgScore = (card) => {
        if (!card || Object.keys(card).length === 0) return 0;
        const vals = Object.values(card).map(Number).filter(v => !isNaN(v));
        if (vals.length === 0) return 0;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    const avgScore1 = getAvgScore(scorecard1);
    const avgScore2 = getAvgScore(scorecard2);

    // Identify winners
    const hasLowestPrice1 = price1 !== null && price2 !== null && price1 < price2 && price1 > 0;
    const hasLowestPrice2 = price1 !== null && price2 !== null && price2 < price1 && price2 > 0;

    const hasHighestRating1 = rating1 > rating2;
    const hasHighestRating2 = rating2 > rating1;

    const hasBestFeature1 = avgScore1 > avgScore2;
    const hasBestFeature2 = avgScore2 > avgScore1;

    // AI recommended winner mapping
    const isRecommended1 = p1 && comparisonData?.winner && (comparisonData.winner.id === p1.id || (p1.name && comparisonData.winner.name === p1.name));
    const isRecommended2 = p2 && comparisonData?.winner && (comparisonData.winner.id === p2.id || (p2.name && comparisonData.winner.name === p2.name));

    // Badge allocation lists
    const getBadges = (p, isP1) => {
        if (!p) return [];
        const badges = [];
        
        const isRec = isP1 ? isRecommended1 : isRecommended2;
        const isBestValue = isP1 ? (hasLowestPrice1 && rating1 >= 3.8) : (hasLowestPrice2 && rating2 >= 3.8);
        const isBestPerf = isP1 ? hasBestFeature1 : hasBestFeature2;
        const isBestReviews = isP1 ? hasHighestRating1 : hasHighestRating2;

        if (isRec) badges.push({ text: "Recommended Choice", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" });
        if (isBestValue) badges.push({ text: "Best Value", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" });
        if (isBestPerf) badges.push({ text: "Best Performance", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" });
        if (isBestReviews) badges.push({ text: "Best Reviews", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" });
        
        return badges;
    };

    const badges1 = getBadges(p1, true);
    const badges2 = getBadges(p2, false);

    // Retrieve Pros & Cons with safe fallbacks
    const getProsConsData = (p, isP1) => {
        if (!p) return { pros: [], cons: [] };
        if (getProsAndCons) {
            const compat = isP1 
                ? (scorecard1?.["Skin Compatibility"] >= scorecard2?.["Skin Compatibility"]) 
                : (scorecard2?.["Skin Compatibility"] >= scorecard1?.["Skin Compatibility"]);
            return getProsAndCons(p, compat);
        }
        return {
            pros: ["High quality active formulation", "Good customer satisfaction scores"],
            cons: ["Slight premium pricing filter"]
        };
    };

    const pc1 = getProsConsData(p1, true);
    const pc2 = getProsConsData(p2, false);

    return (
        <div className="flex flex-col gap-10 w-full">
            {/* CORE METRICS TABLE */}
            <div className="bg-[#121824]/60 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <div className="flex items-center gap-2">
                        <GitCompare className="text-purple-400 animate-pulse" size={16} />
                        <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Head-to-Head Specification Grid</h3>
                    </div>
                    {comparisonData?.winner && (
                        <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full text-purple-300 font-bold uppercase tracking-wider">
                            AI Audited Winner: {comparisonData.winner?.name || comparisonData.winner?.title || 'Product'}
                        </span>
                    )}
                </div>
                
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-white/5 bg-[#0f1422]">
                                <th className="p-5 text-xs font-bold uppercase tracking-wider text-slate-400 w-1/4">Comparison Specs</th>
                                <th className="p-5 text-xs font-bold uppercase tracking-wider w-3/8 text-purple-300 border-r border-white/5">
                                    {p1 ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="w-24 h-24 p-2 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden self-start">
                                                <SafeImage src={p1.image_url} alt={p1.name} className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
                                            </div>
                                            <div className="font-extrabold text-sm text-white truncate max-w-[250px]">{p1.name || p1.title}</div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {badges1.map((b, i) => (
                                                    <span key={i} className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-full ${b.color}`}>
                                                        {b.text}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-500">Product A Not Selected</span>
                                    )}
                                </th>
                                <th className="p-5 text-xs font-bold uppercase tracking-wider w-3/8 text-emerald-300">
                                    {p2 ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="w-24 h-24 p-2 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden self-start">
                                                <SafeImage src={p2.image_url} alt={p2.name} className="w-full h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
                                            </div>
                                            <div className="font-extrabold text-sm text-white truncate max-w-[250px]">{p2.name || p2.title}</div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {badges2.map((b, i) => (
                                                    <span key={i} className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-full ${b.color}`}>
                                                        {b.text}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-500">Product B Not Selected</span>
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                            {/* Brand Row */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                                    <Award size={14} className="text-indigo-400" /> Brand
                                </td>
                                <td className="p-4 font-semibold text-white border-r border-white/5">{p1?.brand || 'N/A'}</td>
                                <td className="p-4 font-semibold text-white">{p2?.brand || 'N/A'}</td>
                            </tr>
                            
                            {/* Price Comparison */}
                            <tr className={`hover:bg-white/1 transition-all ${hasLowestPrice1 ? 'bg-purple-500/5' : hasLowestPrice2 ? 'bg-emerald-500/5' : ''}`}>
                                <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                                    <Landmark size={14} className="text-indigo-400" /> Current Price
                                </td>
                                <td className="p-4 font-black text-purple-400 border-r border-white/5 text-sm">
                                    {price1 !== null ? `₹${price1.toLocaleString('en-IN')}` : 'N/A'}
                                    {hasLowestPrice1 && (
                                        <span className="ml-2 text-[9px] bg-purple-500/20 border border-purple-500/35 px-2 py-0.5 rounded text-purple-300 font-bold uppercase tracking-wider">
                                            Lowest Price
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 font-black text-emerald-400 text-sm">
                                    {price2 !== null ? `₹${price2.toLocaleString('en-IN')}` : 'N/A'}
                                    {hasLowestPrice2 && (
                                        <span className="ml-2 text-[9px] bg-emerald-500/20 border border-emerald-500/35 px-2 py-0.5 rounded text-emerald-300 font-bold uppercase tracking-wider">
                                            Lowest Price
                                        </span>
                                    )}
                                </td>
                            </tr>
                            
                            {/* Original Price */}
                            <tr className="hover:bg-white/1 transition-all text-slate-400">
                                <td className="p-4 font-bold">Original Price</td>
                                <td className="p-4 text-xs text-decoration-line-through border-r border-white/5">
                                    {origPrice1 !== null ? `₹${origPrice1.toLocaleString('en-IN')}` : 'N/A'}
                                </td>
                                <td className="p-4 text-xs text-decoration-line-through">
                                    {origPrice2 !== null ? `₹${origPrice2.toLocaleString('en-IN')}` : 'N/A'}
                                </td>
                            </tr>
                            
                            {/* Discount */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                                    <BadgePercent size={14} className="text-indigo-400" /> Discount Percentage
                                </td>
                                <td className="p-4 font-extrabold text-red-400 border-r border-white/5">{p1 ? (disc1 > 0 ? `${disc1}% OFF` : '0%') : 'N/A'}</td>
                                <td className="p-4 font-extrabold text-red-400">{p2 ? (disc2 > 0 ? `${disc2}% OFF` : '0%') : 'N/A'}</td>
                            </tr>
                            
                            {/* Rating Comparison */}
                            <tr className={`hover:bg-white/1 transition-all ${hasHighestRating1 ? 'bg-purple-500/5' : hasHighestRating2 ? 'bg-emerald-500/5' : ''}`}>
                                <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                                    <Star size={14} className="text-yellow-400" /> Community Rating
                                </td>
                                <td className="p-4 font-bold text-white border-r border-white/5">
                                    {p1 ? `${rating1.toFixed(1)} / 5.0` : 'N/A'}
                                    {hasHighestRating1 && (
                                        <span className="ml-2 text-[9px] bg-purple-500/20 border border-purple-500/35 px-2 py-0.5 rounded text-purple-300 font-bold uppercase tracking-wider">
                                            Highest Rating
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 font-bold text-white">
                                    {p2 ? `${rating2.toFixed(1)} / 5.0` : 'N/A'}
                                    {hasHighestRating2 && (
                                        <span className="ml-2 text-[9px] bg-emerald-500/20 border border-emerald-500/35 px-2 py-0.5 rounded text-emerald-300 font-bold uppercase tracking-wider">
                                            Highest Rating
                                        </span>
                                    )}
                                </td>
                            </tr>
                            
                            {/* Review Count */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400">Total Audited Reviews</td>
                                <td className="p-4 text-slate-300 border-r border-white/5">{p1 ? `${p1.review_count || p1.reviews_count || 0} reviews` : 'N/A'}</td>
                                <td className="p-4 text-slate-300">{p2 ? `${p2.review_count || p2.reviews_count || 0} reviews` : 'N/A'}</td>
                            </tr>
                            
                            {/* Platform Source */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400">Platform Source</td>
                                <td className="p-4 text-purple-300 font-bold border-r border-white/5">{p1?.source || 'N/A'}</td>
                                <td className="p-4 text-emerald-300 font-bold">{p2?.source || 'N/A'}</td>
                            </tr>
                            
                            {/* Delivery Estimate */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                                    <Truck size={14} className="text-indigo-400" /> Shipping Speed
                                </td>
                                <td className="p-4 text-slate-300 border-r border-white/5">{delivery1}</td>
                                <td className="p-4 text-slate-300">{delivery2}</td>
                            </tr>
                            
                            {/* Availability */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-slate-400">Inventory Availability</td>
                                <td className="p-4 text-slate-300 border-r border-white/5">
                                    {p1 ? (p1.stock > 0 ? (p1.stock < 15 ? `Only ${p1.stock} Left` : 'In Stock') : (p1.availability || 'In Stock')) : 'N/A'}
                                </td>
                                <td className="p-4 text-slate-300">
                                    {p2 ? (p2.stock > 0 ? (p2.stock < 15 ? `Only ${p2.stock} Left` : 'In Stock') : (p2.availability || 'In Stock')) : 'N/A'}
                                </td>
                            </tr>

                            {/* Pros Row */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-emerald-400 flex items-center gap-2">
                                    <CheckCircle2 size={14} /> Clinical Pros
                                </td>
                                <td className="p-4 border-r border-white/5">
                                    {p1 ? (
                                        <div className="flex flex-col gap-2">
                                            {pc1.pros.map((pro, i) => (
                                                <div key={i} className="flex gap-2 items-start text-slate-300">
                                                    <span className="text-emerald-400 text-xs shrink-0">•</span>
                                                    <span>{pro}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : 'N/A'}
                                </td>
                                <td className="p-4">
                                    {p2 ? (
                                        <div className="flex flex-col gap-2">
                                            {pc2.pros.map((pro, i) => (
                                                <div key={i} className="flex gap-2 items-start text-slate-300">
                                                    <span className="text-emerald-400 text-xs shrink-0">•</span>
                                                    <span>{pro}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : 'N/A'}
                                </td>
                            </tr>

                            {/* Cons Row */}
                            <tr className="hover:bg-white/1 transition-all">
                                <td className="p-4 font-bold text-amber-500 flex items-center gap-2">
                                    <ShieldAlert size={14} /> Clinical Cons
                                </td>
                                <td className="p-4 border-r border-white/5">
                                    {p1 ? (
                                        <div className="flex flex-col gap-2">
                                            {pc1.cons.map((con, i) => (
                                                <div key={i} className="flex gap-2 items-start text-slate-400">
                                                    <span className="text-amber-500 text-xs shrink-0">•</span>
                                                    <span>{con}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : 'N/A'}
                                </td>
                                <td className="p-4">
                                    {p2 ? (
                                        <div className="flex flex-col gap-2">
                                            {pc2.cons.map((con, i) => (
                                                <div key={i} className="flex gap-2 items-start text-slate-400">
                                                    <span className="text-amber-500 text-xs shrink-0">•</span>
                                                    <span>{con}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : 'N/A'}
                                </td>
                            </tr>

                            {/* Dynamic Features from Specifications */}
                            {allSpecKeys.map(key => (
                                <tr key={key} className="hover:bg-white/1 transition-all">
                                    <td className="p-4 font-semibold text-slate-400">{key}</td>
                                    <td className="p-4 text-slate-300 border-r border-white/5">{specs1[key] || 'N/A'}</td>
                                    <td className="p-4 text-slate-300">{specs2[key] || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* BIOACTIVE FORMULA HIGHLIGHTS (Skincare only condition) */}
            {p1 && p2 && ((p1.category || '').toLowerCase().includes('skincare') || (p1.category || '').toLowerCase().includes('beauty')) && (
                <div className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md shadow-lg">
                    <div className="p-5 border-b border-white/5 flex items-center gap-2">
                        <Sparkles className="text-purple-400" size={16} />
                        <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Bioactive Formula Highlights</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
                        <div className="p-6 flex flex-col gap-4">
                            <h4 className="text-xs font-bold text-purple-300 uppercase tracking-widest mb-1">{p1.name || p1.title} Formula</h4>
                            <div className="flex flex-col gap-3">
                                {getHighlightedIngredients && getHighlightedIngredients(p1).map((ing, i) => (
                                    <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-xs font-bold text-slate-200 mb-0.5">{ing.name}</p>
                                        <p className="text-[10px] text-slate-400 leading-normal">{ing.role}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 flex flex-col gap-4">
                            <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-1">{p2.name || p2.title} Formula</h4>
                            <div className="flex flex-col gap-3">
                                {getHighlightedIngredients && getHighlightedIngredients(p2).map((ing, i) => (
                                    <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-xs font-bold text-slate-200 mb-0.5">{ing.name}</p>
                                        <p className="text-[10px] text-slate-400 leading-normal">{ing.role}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparisonTable;
