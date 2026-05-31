import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { supabase } from '../config/supabaseClient';

const ProductChatInterface = ({ product, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Initialize chat when opened with a product
    useEffect(() => {
        if (product) {
            setMessages([
                {
                    id: Date.now(),
                    sender: 'bot',
                    text: `You selected ${product.name}. Ask anything about this product.`
                }
            ]);
        }
    }, [product]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async (customQuery = null) => {
        const queryText = customQuery || inputValue;
        if (!queryText.trim() || !product) return;

        // Add user message
        const userMsg = { id: Date.now(), sender: 'user', text: queryText };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Append product context transparently
            const aiPrompt = `Regarding product '${product.name}' in category '${product.category}': ${queryText}`;

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: aiPrompt })
            });

            if (!res.ok) throw new Error('Network response was not ok');
            
            const data = await res.json();
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: data.response }]);

        } catch (error) {
            console.error("Chat error:", error);
            // Fallback mock logic if server fails
            setTimeout(() => {
                let fallbackRes = `I'm sorry, I cannot connect to the intelligence core right now, but ${product.name} is a great choice!`;
                if (queryText.toLowerCase().includes('review')) fallbackRes = `Reviews for ${product.name} are generally positive.`;
                if (queryText.toLowerCase().includes('ingredient')) fallbackRes = `This product includes key active ingredients specific to its formulation.`;
                if (queryText.toLowerCase().includes('good for me')) fallbackRes = `Based on its profile, ${product.name} is excellent if it matches your preferences.`;
                
                setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: fallbackRes }]);
            }, 600);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (actionText) => {
        handleSend(actionText);
    };

    if (!product) return null;

    return (
        <div className="product-chat-overlay open">
            <div className="chat-header">
                <div>
                    <h3 style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <Bot size={20} className="text-accent" />
                        {product.name} Assistant
                    </h3>
                </div>
                <button className="close-chat-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                        {msg.text}
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-message bot" style={{opacity: 0.7}}>
                        Thinking...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="quick-actions">
                <button className="quick-btn" onClick={() => handleQuickAction('Show reviews summary')}>Reviews</button>
                <button className="quick-btn" onClick={() => handleQuickAction('What are the key ingredients?')}>Ingredients</button>
                <button className="quick-btn" onClick={() => handleQuickAction('Is it good for me?')}>Is it good for me?</button>
            </div>

            <div className="chat-input-area">
                <form className="chat-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask about this product..."
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={!inputValue.trim() || isLoading}>
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProductChatInterface;
