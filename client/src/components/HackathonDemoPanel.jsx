import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useComparison } from '../context/ComparisonContext';
import { Play, Sparkles, GitCompare, MessageSquare, Compass, Terminal, CheckCircle2, ChevronRight, Minimize2, Award } from 'lucide-react';

const HackathonDemoPanel = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { setSelectedProducts, clearComparison } = useComparison();

    useEffect(() => {
        const handleToggle = () => setIsOpen(prev => !prev);
        window.addEventListener('toggle-hackathon-playbook', handleToggle);
        return () => window.removeEventListener('toggle-hackathon-playbook', handleToggle);
    }, []);

    const onboardingSteps = [
        {
            title: "RAG Skincare Discovery",
            desc: "Submit Skincare prompts to cross-reference global clinical datasets instantly.",
            badge: "AI Discovery",
            path: "/"
        },
        {
            title: "Neural Comparator Matrix",
            desc: "Trigger side-by-side parameters, SVG radar charts, and oily vs sensitive suitability breakouts.",
            badge: "Analyst Matrix",
            path: "/compare"
        },
        {
            title: "skinguru AI Chat",
            desc: "Interrogate formulation structures and active skincare ingredients in real-time.",
            badge: "RAG Chat",
            path: "/chatbot"
        }
    ];

    const suggestedQueries = [
        "Verify the best Salicylic Acid formulation for active acne clearing under 1500/-",
        "Find premium bioavailable Niacinamide serums that soothe barrier redness"
    ];

    const triggerSuggestedQuery = (query) => {
        // Safe query trigger: serialize to session storage and redirect
        sessionStorage.setItem('rl-demo-query', query);
        if (location.pathname !== '/') {
            navigate('/');
        } else {
            // If already on home, dispatch a custom event to auto-submit
            window.dispatchEvent(new CustomEvent('rl-trigger-demo-search', { detail: query }));
        }
        setIsOpen(false);
    };

    const triggerSampleComparison = () => {
        // Define high-fidelity clinical dummy products matching our visual scorecard tests
        const prodA = {
            id: 101,
            name: 'The Derma Co 1% Salicylic Acid Facewash',
            price: 15.00,
            category: 'Skincare & Beauty',
            rating: 4.8,
            brand: 'The Derma Co',
            stock: 25,
            trust_score: 95,
            image_url: 'https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/thumbnail.png'
        };

        const prodB = {
            id: 102,
            name: 'Himalaya Purifying Neem Facewash',
            price: 8.50,
            category: 'Skincare & Beauty',
            rating: 4.5,
            brand: 'Himalaya',
            stock: 40,
            trust_score: 82,
            image_url: 'https://cdn.dummyjson.com/products/images/beauty/Eyeshadow%20Palette%20with%20Mirror/thumbnail.png'
        };

        // Populate context atomically
        setSelectedProducts([prodA, prodB]);

        // Redirect to compare page (the selection triggers preferences modal instantly!)
        navigate('/compare');
        setIsOpen(false);
    };

    const teleportJudge = (path, idx) => {
        setActiveStep(idx);
        navigate(path);
    };

    return (
        <div className="fixed bottom-6 left-6 z-[999] font-sans">
            {/* 2. EXPANDED DEMO MODE PANEL */}
            {isOpen && (
                <div className="w-80 sm:w-96 bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl p-5 backdrop-blur-xl relative animate-fade-in text-slate-100">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-purple-400" size={18} />
                            <h4 className="text-sm font-black uppercase tracking-wider">Judge console</h4>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all"
                        >
                            <Minimize2 size={16} />
                        </button>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                        Welcome, Hackathon Judges! Fast-track your evaluation and verify premium RAG recommendation pathways in under 15 seconds.
                    </p>

                    {/* Step Onboarding Guide */}
                    <div className="flex flex-col gap-3 mb-4">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Guided Skincare Journey</h5>
                        
                        <div className="flex flex-col gap-2">
                            {onboardingSteps.map((step, idx) => {
                                const active = location.pathname === step.path;
                                return (
                                    <button 
                                        key={idx}
                                        onClick={() => teleportJudge(step.path, idx)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                            active 
                                                ? 'bg-purple-500/10 border-purple-500/30 text-white shadow-md' 
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'
                                        }`}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {active ? <CheckCircle2 size={14} className="text-purple-400" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-bold">{idx + 1}</div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold">{step.title}</span>
                                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${active ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-slate-500'}`}>{step.badge}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">{step.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Suggested Queries Trigger */}
                    <div className="flex flex-col gap-2 mb-4 border-t border-white/5 pt-3">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Skincare Queries</h5>
                        <div className="flex flex-col gap-1.5">
                            {suggestedQueries.map((query, i) => (
                                <button 
                                    key={i}
                                    onClick={() => triggerSuggestedQuery(query)}
                                    className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 hover:border-brand-500/30 hover:bg-brand-500/5 text-slate-300 hover:text-white rounded-xl text-left transition-all text-[11px] font-medium"
                                >
                                    <span className="truncate pr-2">"{query.substring(0, 48)}..."</span>
                                    <Play size={10} className="shrink-0 text-slate-500" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comparison Direct Trigger */}
                    <div className="border-t border-white/5 pt-3">
                        <button 
                            onClick={triggerSampleComparison}
                            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 py-3 rounded-xl font-bold tracking-wide text-xs shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <GitCompare size={14} /> Run Analyst Comparison Demo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HackathonDemoPanel;
