import React from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, GitCompare, Landmark, Star, BadgePercent, Truck, Award } from 'lucide-react';

export const ComparisonTable = ({ 
    p1, 
    p2, 
    scorecard1 = {}, 
    scorecard2 = {},
    getHighlightedIngredients,
    getProsAndCons
}) => {
    // Dynamically retrieve specifications
    const getSpecs = (p) => {
        if (!p) return {};
        if (p.specifications && Object.keys(p.specifications).length > 0) return p.specifications;
        if (p.features && Object.keys(p.features).length > 0) return p.features;
        return {};
    };

    const specs1 = getSpecs(p1);
    const specs2 = getSpecs(p2);
    
    // Combine spec keys
    const allSpecKeys = Array.from(new Set([...Object.keys(specs1), ...Object.keys(specs2)]))
        .filter(key => key !== 'Merchant' && key !== 'seller' && key !== 'Merchant Name' && key !== 'Seller');

    // Prices and discount computations
    const price1 = Number(p1.price || p1.current_price || 0);
    const origPrice1 = Number(p1.originalPrice || p1.original_price || price1);
    const disc1 = origPrice1 > price1 ? Math.round((1 - price1 / origPrice1) * 100) : 0;

    const price2 = Number(p2.price || p2.current_price || 0);
    const origPrice2 = Number(p2.originalPrice || p2.original_price || price2);
    const disc2 = origPrice2 > price2 ? Math.round((1 - price2 / origPrice2) * 100) : 0;

    const delivery1 = p1.delivery_estimate || p1.deliveryEstimate || (p1.id % 2 === 0 ? 'Delivery tomorrow' : 'Delivery in 2 days');
    const delivery2 = p2.delivery_estimate || p2.deliveryEstimate || (p2.id % 2 === 0 ? 'Delivery tomorrow' : 'Delivery in 2 days');

    return (
        <div className="flex flex-col gap-10 w-full">
            {/* CORE METRICS TABLE */}
            <div className="bg-[#121824]/60 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
                <div className="p-5 border-b border-white/5 flex items-center gap-2">
                    <GitCompare className="text-purple-400" size={16} />
                    <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Head-to-Head Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-1/3">Feature</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-purple-300 w-1/3">{p1.name || p1.title}</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wider text-emerald-300 w-1/3">{p2.name || p2.title}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-slate-200">
                            {/* Brand Row */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400 flex items-center gap-2">
                                    <Award size={14} className="text-indigo-400" /> Brand
                                </td>
                                <td className="p-4 font-bold text-white">{p1.brand || 'Premium Brand'}</td>
                                <td className="p-4 font-bold text-white">{p2.brand || 'Premium Brand'}</td>
                            </tr>
                            {/* Price Comparison */}
                            <tr className={price1 !== price2 ? (price1 < price2 ? 'bg-purple-500/5' : 'bg-emerald-500/5') : ''}>
                                <td className="p-4 font-semibold text-slate-400 flex items-center gap-2">
                                    <Landmark size={14} className="text-indigo-400" /> Current Price
                                </td>
                                <td className="p-4 font-black text-purple-400">
                                    ₹{price1.toLocaleString('en-IN')}
                                    {price1 < price2 && <span className="ml-2 text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 font-bold uppercase">Better Value</span>}
                                </td>
                                <td className="p-4 font-black text-emerald-400">
                                    ₹{price2.toLocaleString('en-IN')}
                                    {price2 < price1 && <span className="ml-2 text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-bold uppercase">Better Value</span>}
                                </td>
                            </tr>
                            {/* Original Price */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400">Original Price</td>
                                <td className="p-4 text-slate-400 text-xs text-decoration-line-through">₹{origPrice1.toLocaleString('en-IN')}</td>
                                <td className="p-4 text-slate-400 text-xs text-decoration-line-through">₹{origPrice2.toLocaleString('en-IN')}</td>
                            </tr>
                            {/* Discount */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400 flex items-center gap-2">
                                    <BadgePercent size={14} className="text-indigo-400" /> Discount
                                </td>
                                <td className="p-4 font-bold text-red-400">{disc1 > 0 ? `${disc1}% OFF` : '0%'}</td>
                                <td className="p-4 font-bold text-red-400">{disc2 > 0 ? `${disc2}% OFF` : '0%'}</td>
                            </tr>
                            {/* Rating Comparison */}
                            <tr className={Number(p1.rating) !== Number(p2.rating) ? (Number(p1.rating) > Number(p2.rating) ? 'bg-purple-500/5' : 'bg-emerald-500/5') : ''}>
                                <td className="p-4 font-semibold text-slate-400 flex items-center gap-2">
                                    <Star size={14} className="text-yellow-400" /> Rating
                                </td>
                                <td className="p-4 font-bold text-white">
                                    {Number(p1.rating || 4.0).toFixed(1)} / 5.0
                                    {Number(p1.rating) > Number(p2.rating) && <span className="ml-2 text-[10px] bg-purple-500/20 px-2 py-0.5 rounded text-purple-300 font-bold uppercase">Higher</span>}
                                </td>
                                <td className="p-4 font-bold text-white">
                                    {Number(p2.rating || 4.0).toFixed(1)} / 5.0
                                    {Number(p2.rating) > Number(p1.rating) && <span className="ml-2 text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-bold uppercase">Higher</span>}
                                </td>
                            </tr>
                            {/* Review Count */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400">Reviews count</td>
                                <td className="p-4 text-slate-300">{p1.review_count || p1.reviews_count || 12} reviews</td>
                                <td className="p-4 text-slate-300">{p2.review_count || p2.reviews_count || 12} reviews</td>
                            </tr>
                            {/* Platform Comparison */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400">Platform Source</td>
                                <td className="p-4 text-purple-300 font-bold">{p1.source || 'Internal Database'}</td>
                                <td className="p-4 text-emerald-300 font-bold">{p2.source || 'Internal Database'}</td>
                            </tr>
                            {/* Delivery Estimate */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400 flex items-center gap-2">
                                    <Truck size={14} className="text-indigo-400" /> Delivery Estimate
                                </td>
                                <td className="p-4 text-slate-300">{delivery1}</td>
                                <td className="p-4 text-slate-300">{delivery2}</td>
                            </tr>
                            {/* Availability */}
                            <tr>
                                <td className="p-4 font-semibold text-slate-400">Availability</td>
                                <td className="p-4 text-slate-300">
                                    {p1.stock > 0 ? (p1.stock < 15 ? `Only ${p1.stock} Left` : 'In Stock') : (p1.availability || 'In Stock')}
                                </td>
                                <td className="p-4 text-slate-300">
                                    {p2.stock > 0 ? (p2.stock < 15 ? `Only ${p2.stock} Left` : 'In Stock') : (p2.availability || 'In Stock')}
                                </td>
                            </tr>
                            {/* Dynamic Features from Specifications */}
                            {allSpecKeys.map(key => (
                                <tr key={key}>
                                    <td className="p-4 font-semibold text-slate-400">{key}</td>
                                    <td className="p-4 text-slate-300">{specs1[key] || 'N/A'}</td>
                                    <td className="p-4 text-slate-300">{specs2[key] || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FORMULA HIGHLIGHTS (Skincare only condition) */}
            {((p1.category || '').toLowerCase().includes('skincare') || (p1.category || '').toLowerCase().includes('beauty')) && (
                <div className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
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

            {/* VERIFIED PROS & CONS */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-slate-900/30 border border-purple-500/10 rounded-3xl p-6 flex flex-col gap-4 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-purple-300 uppercase tracking-widest border-b border-white/5 pb-2">Pros &amp; Cons: {p1.name || p1.title}</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Pros</h4>
                            {getProsAndCons && getProsAndCons(p1, scorecard1["Skin Compatibility"] >= scorecard2["Skin Compatibility"]).pros.map((pro, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-300 items-start">
                                    <CheckCircle2 className="text-emerald-400 mt-0.5 shrink-0" size={14} />
                                    <span>{pro}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Cons</h4>
                            {getProsAndCons && getProsAndCons(p1, scorecard1["Skin Compatibility"] >= scorecard2["Skin Compatibility"]).cons.map((con, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-400 items-start">
                                    <ShieldAlert className="text-amber-500 mt-0.5 shrink-0" size={14} />
                                    <span>{con}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-emerald-500/10 rounded-3xl p-6 flex flex-col gap-4 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-widest border-b border-white/5 pb-2">Pros &amp; Cons: {p2.name || p2.title}</h3>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Pros</h4>
                            {getProsAndCons && getProsAndCons(p2, scorecard2["Skin Compatibility"] >= scorecard1["Skin Compatibility"]).pros.map((pro, i) => (
                                <div key={i} className="flex gap-2 text-xs text-slate-300 items-start">
                                    <CheckCircle2 className="text-emerald-400 mt-0.5 shrink-0" size={14} />
                                    <span>{pro}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Clinical Cons</h4>
                            {getProsAndCons && getProsAndCons(p2, scorecard2["Skin Compatibility"] >= scorecard1["Skin Compatibility"]).cons.map((con, i) => (
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
