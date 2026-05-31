import React, { useEffect, useState, useMemo } from 'react';
import './SeasonalEffects.css';

const SeasonalEffects = () => {
    const [season, setSeason] = useState('summer');

    useEffect(() => {
        const month = new Date().getMonth();
        // Winter: Nov (10), Dec (11), Jan (0), Feb (1)
        if (month === 11 || month === 0 || month === 1 || month === 10) {
            setSeason('winter');
            document.body.setAttribute('data-season', 'winter');
        } else {
            setSeason('summer');
            document.body.setAttribute('data-season', 'summer');
        }
    }, []);

    // Cache the random snowflake dimensions to avoid chaotic jitters/coordinates resetting on rerenders
    const snowflakes = useMemo(() => {
        return Array.from({ length: 60 }).map((_, idx) => ({
            id: idx,
            left: `${Math.random() * 100}%`,
            animationDuration: `${Math.random() * 5 + 3}s`,
            animationDelay: `${Math.random() * 5}s`,
            opacity: Math.random() * 0.8 + 0.2,
            transform: `scale(${Math.random() * 0.8 + 0.4})`
        }));
    }, []);

    return (
        <div className={`seasonal-container ${season}`}>
            {season === 'winter' && (
                <div className="snow-container">
                    {snowflakes.map((sf) => (
                        <div 
                            key={sf.id} 
                            className="snowflake" 
                            style={{
                                left: sf.left,
                                animationDuration: sf.animationDuration,
                                animationDelay: sf.animationDelay,
                                opacity: sf.opacity,
                                transform: sf.transform
                            }}
                        >
                            ❄
                        </div>
                    ))}
                </div>
            )}
            {season === 'summer' && (
                <div className="sun-container">
                    <div className="sun-body">
                        <div className="sun-rays"></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeasonalEffects;
