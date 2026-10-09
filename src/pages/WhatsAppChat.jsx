import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Paperclip, Phone, MoreVertical, Bot } from 'lucide-react';

const SUGGESTIONS = [
  "Aaj 50 bag cement aaya",
  "Rajesh ko 2000 peshi diya",
  "500 rupaye chai nashta",
  "Sab hajir hain, Ramesh absent",
  "Kal 100 bag cement chahiye urgent",
  "Aaj first floor column casting hua",
  "15 bag cement aur 80 kg steel laga",
  "status",
];

function TelegramChat() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'system', text: '🔒 Messages are processed locally via your Telegram Bot', time: '' },
    { id: 2, sender: 'bot', text: '🏗️ *SiteCommand AI*\n\nNamaste! Main aapka construction site assistant hoon.\n\nAap Hindi ya English mein baat kar sakte hain. Bas apna update bhejiye:\n\n📦 "50 bag cement aaya"\n📋 "Sab hajir, Ramesh absent"\n💸 "500 rupaye chai ka kharcha"\n🏧 "Rajesh ko 2000 peshi"\n🎙️ Voice notes bhi bhej sakte hain!\n\nType "help" for full menu.', time: getTime() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function getTime() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  async function sendMessage(text) {
    if (!text?.trim()) return;
    setShowSuggestions(false);
    const userMsg = { id: Date.now(), sender: 'user', text: text.trim(), time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/simulate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), phone: 'demo_supervisor', siteId: 1 })
      });
      const data = await res.json();
      const botMsg = { id: Date.now() + 1, sender: 'bot', text: data.reply || data.error || 'No response', time: getTime() };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'bot', text: '❌ Server connection error. Is the backend running?', time: getTime() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function formatMessage(text) {
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💬 Chat Simulator</h1>
        <p className="page-description">Test the AI pipeline locally — same Groq extraction & DB updates as Telegram bot. Also works on actual Telegram!</p>
      </div>

      <div className="wa-chat-container">
        {/* Header */}
        <div className="wa-chat-header">
          <div className="wa-chat-avatar" style={{ background: 'linear-gradient(135deg, #2AABEE, #229ED9)' }}>
            <Bot size={22} />
          </div>
          <div className="wa-chat-info" style={{ flex: 1 }}>
            <h3>SiteCommand Bot</h3>
            <p>{loading ? 'typing...' : 'online • Groq Llama 3.1 powered'}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--wa-text-muted)' }}>
            <Phone size={20} style={{ cursor: 'pointer' }} />
            <MoreVertical size={20} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        {/* Messages */}
        <div className="wa-chat-messages">
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.sender === 'system' ? (
                <div className="wa-msg wa-msg-system">{msg.text}</div>
              ) : (
                <div className={`wa-msg ${msg.sender === 'user' ? 'wa-msg-outgoing' : 'wa-msg-incoming'}`}>
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                  {msg.time && <div className="wa-msg-time">{msg.time} {msg.sender === 'user' ? '✓✓' : ''}</div>}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="wa-msg wa-msg-incoming">
              <div className="wa-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="wa-suggestions">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="wa-suggestion-chip" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="wa-chat-input-area" onSubmit={handleSubmit}>
          <Paperclip size={22} color="var(--wa-text-muted)" style={{ cursor: 'pointer', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="wa-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
          />
          {input.trim() ? (
            <button type="submit" className="wa-send-btn" disabled={loading} style={{ background: '#2AABEE' }}>
              <Send size={18} />
            </button>
          ) : (
            <button type="button" className="wa-send-btn" style={{ background: '#2AABEE' }}>
              <Mic size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default TelegramChat;
