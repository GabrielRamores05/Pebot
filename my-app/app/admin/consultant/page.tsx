'use client';

import { useState, useEffect, useRef } from 'react';

interface BrandingState {
  shopName: string;
  logoUrl: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ConsultantPage() {
  const [user, setUser] = useState<any>(null);
  const [branding, setBranding] = useState<BrandingState>({ shopName: 'Pebot', logoUrl: null });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (data.user.role !== 'ADMIN') {
            window.location.href = '/login';
          }
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });

    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});

    setMessages([
      {
        role: 'assistant',
        content: "Hello! I'm Pebot Assistant — your AI consultant for restaurant management. You can ask me about orders, inventory, staffing, sales strategies, or anything else about running your restaurant. What would you like to discuss today?",
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/consultant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      const data = await res.json();

      if (res.ok && data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'Sorry, I encountered an error. Please check your AI API key in Settings.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Network error. Please check your connection and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-page">
      <header className="px-6 pb-2 pt-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="c-title">{branding.shopName} Consultant</h1>
            <p className="mt-1.5 text-sm text-muted">AI-powered assistant for your restaurant</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-accent-text">
                  </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-800 shadow border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-gray-700">
                  <span className="text-sm font-semibold">U</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-accent-text">
                </div>
              <div className="bg-white shadow border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about orders, inventory, staffing, sales..."
              disabled={loading}
              className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <span className="text-lg">→</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            Powered by {messages.length > 0 ? 'OpenRouter' : 'OpenRouter'} — your AI consultant
          </p>
        </div>
      </footer>
    </div>
  );
}
