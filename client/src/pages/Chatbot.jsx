import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, Send, User, Sparkles, Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabaseClient';
import './Chatbot.css';

const Chatbot = () => {
    const location = useLocation();
    const activeProduct = location.state?.product;

    const [messages, setMessages] = useState(() => {
        if (location.state?.initialMessage) {
            return [{ role: 'ai', text: `Initiating comparison for **${activeProduct?.name || 'product'}**...` }];
        }
        if (activeProduct) {
            return [{ role: 'ai', text: `You selected **${activeProduct.name}**. Ask anything about this clinical profile.` }];
        }
        return [{ role: 'ai', text: '### Neural Interface Active\nHello! I am your AI Skincare Scientist. How can I assist with your research today?' }];
    });
    
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);

    // Voice Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;

    if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            // Auto-trigger send after a small delay to let state update
            setTimeout(() => {
                document.getElementById('vchat-form').dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true })
                );
            }, 500);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };
    }

    const toggleListening = () => {
        if (!recognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            setIsListening(true);
            recognition.start();
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (location.state?.initialMessage && messages.length === 1) {
            const autoMsg = location.state.initialMessage;
            setMessages(prev => [...prev, { role: 'user', text: autoMsg }]);
            
            const triggerSend = async () => {
                setLoading(true);
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ message: autoMsg })
                    });
                    if (!res.ok) throw new Error('Chat API Failed');
                    const data = await res.json();
                    setMessages(prev => [...prev, { role: 'ai', text: data.response }]);
                } catch (err) {
                    console.error('Chat Error:', err);
                } finally {
                    setLoading(false);
                }
            };
            triggerSend();
        }
    }, [location.state, activeProduct]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input;
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setInput('');
        setLoading(true);

        try {
            // Include product context if available
            const aiPrompt = activeProduct 
                ? `Regarding product '${activeProduct.name}' in category '${activeProduct.category}': ${userMessage}`
                : userMessage;

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: aiPrompt })
            });

            if (!res.ok) throw new Error('Chat API Failed');
            const data = await res.json();

            setMessages(prev => [...prev, { role: 'ai', text: data.response }]);
        } catch (err) {
            console.error('Chat Error:', err);
            setMessages(prev => [...prev, {
                role: 'ai',
                text: "⚠️ **Connection Error:** I'm unable to connect to the knowledge core right now. Please try again or check your service connection."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const suggestions = [
        "Is this good for acne?",
        "Explain the ingredients",
        "Compare with others",
        "Any side effects?"
    ];

    const handleSuggestion = (text) => {
        setInput(text);
        // We'll let the user click 'Send' manually or we can auto-send.
        // Auto-sending is usually better UX for suggestions.
    };

    return (
        <div className="chatbot-container">
            <header className="chatbot-header">
                <div className="header-info">
                    <Bot className="text-accent" />
                    <h1>V CHAT</h1>
                </div>
                <div className="status-indicator">
                    <div className="status-dot"></div>
                    <span>SYSTEM_ACTIVE</span>
                </div>
            </header>

            <div className="chat-window glass-panel">
                <div className="messages-area">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message-wrapper ${msg.role}`}>
                            <div className="avatar">
                                {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
                            </div>
                            <div className="message-bubble">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="message-wrapper ai">
                            <div className="avatar"><Bot size={18} /></div>
                            <div className="message-bubble typing">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggested Questions */}
                {!loading && (
                    <div className="suggestions-container">
                        {suggestions.map((text, i) => (
                            <button 
                                key={i} 
                                className="suggestion-btn"
                                onClick={() => handleSuggestion(text)}
                            >
                                {text}
                            </button>
                        ))}
                    </div>
                )}

                <form id="vchat-form" className="chat-input-area" onSubmit={handleSend}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything about products or skincare..."
                    />
                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                        <button 
                            type="button" 
                            onClick={toggleListening} 
                            className={`mic-btn ${isListening ? 'active' : ''}`}
                            style={{marginRight: '0.5rem'}}
                            title="Speak to AI"
                        >
                            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button type="submit" className="bg-accent" disabled={loading}>
                            <Send size={20} />
                        </button>
                    </div>
                </form>
            </div>

            <div className="chat-footer text-muted">
                <Sparkles size={14} /> AI Engine processing live product data
            </div>
        </div>
    );
};

export default Chatbot;
