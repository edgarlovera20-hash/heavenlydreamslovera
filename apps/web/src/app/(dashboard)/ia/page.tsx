'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================
// Types
// ============================================================
type MessageRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

// ============================================================
// Mock replies (IA service placeholder)
// ============================================================
const MOCK_REPLIES = [
  'Estoy procesando tu solicitud. El servicio de IA estará completamente disponible pronto.',
  'Entendido. Actualmente el asistente está en modo de configuración inicial.',
  'Gracias por tu mensaje. El módulo de inteligencia artificial está siendo configurado.',
  'He recibido tu consulta. El servicio de IA estará operativo en breve.',
  'Comprendido. Una vez completada la configuración, podré ayudarte de forma completa.',
];

function getMockReply(): string {
  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
}

// ============================================================
// Message bubble component
// ============================================================
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-indigo-600' : 'bg-gray-700',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-indigo-400" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-indigo-600 text-white'
            : 'rounded-tl-sm bg-gray-800 text-gray-200',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={clsx(
            'mt-1 text-[10px]',
            isUser ? 'text-indigo-300' : 'text-gray-500',
          )}
        >
          {message.timestamp.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// IA Page
// ============================================================
export default function IAPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hola, soy el Asistente IA de Heavenly Dreams. El servicio de IA está en configuración. Puedes escribirme y responderé con información básica mientras el sistema completa su configuración.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    // Simulate network latency for mock reply
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: getMockReply(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900/50">
          <Sparkles className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Asistente IA</h2>
          <p className="text-sm text-gray-400">Powered by Ollama · Phi-3 / Mistral 7B</p>
        </div>
        {/* Status pill */}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          En configuración
        </span>
      </div>

      {/* Chat window */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isSending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700">
                <Bot className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-gray-800 px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="h-2 w-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              className="flex-1 resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Servicio de IA en configuración — las respuestas actuales son simuladas.
          </p>
        </div>
      </div>
    </div>
  );
}
