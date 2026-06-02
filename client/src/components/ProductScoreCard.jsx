import React from 'react';

export const ProductScoreCard = ({ scorecard1, scorecard2 }) => {
    return (
        <div className="bg-slate-900/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
            <div className="p-5 border-b border-white/5">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Comparison Scorecard</h3>
            </div>
            
            <div className="flex flex-col divide-y divide-white/5">
                {Object.keys(scorecard1).map((metric, idx) => {
                    const val1 = scorecard1[metric];
                    const val2 = scorecard2[metric];
                    const isWinner1 = val1 >= val2;
                    return (
                        <div key={idx} className="grid grid-cols-3 p-5 items-center gap-4">
                            <div className="text-xs font-bold tracking-wider text-slate-400 uppercase">{metric}</div>
                            
                            {/* Product 1 score bar */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden hidden md:block">
                                    <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full" style={{ width: `${val1}%` }}></div>
                                </div>
                                <span className={`text-xs font-bold ${isWinner1 ? 'text-purple-300 font-extrabold' : 'text-slate-500'}`}>
                                    {val1}% {isWinner1 && "🏆"}
                                </span>
                            </div>

                            {/* Product 2 score bar */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden hidden md:block">
                                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full" style={{ width: `${val2}%` }}></div>
                                </div>
                                <span className={`text-xs font-bold ${!isWinner1 ? 'text-emerald-300 font-extrabold' : 'text-slate-500'}`}>
                                    {val2}% {!isWinner1 && "🏆"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProductScoreCard;
