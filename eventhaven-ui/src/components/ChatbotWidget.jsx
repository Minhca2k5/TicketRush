import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ChevronRight, MessageCircle, Send, User, X } from 'lucide-react';
import api from '../services/api';
import { getAuthToken } from '../lib/auth';

const STARTER_MESSAGES = [
  {
    id: 'welcome',
    from: 'bot',
    text: 'Hi, I am TicketRush Assistant. Ask me about TicketRush events, seats, booking, tickets, or the project architecture.',
    actions: [
      { label: 'Find events', command: 'events' },
      { label: 'How to book', command: 'book' },
      { label: 'My tickets', command: 'tickets' },
    ],
  },
];

const QUICK_PROMPTS = [
  'Find events',
  'How do I book a ticket?',
  'Where are my tickets?',
  'What do seat colors mean?',
];

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd');
}

function extractEvents(payload) {
  const data = payload?.data?.data?.content || payload?.data?.data || payload?.data || [];
  return Array.isArray(data) ? data : [];
}

function formatEventTime(value) {
  if (!value) return 'Date TBA';
  return new Date(value).toLocaleString();
}

function buildEventSuggestion(events) {
  const upcomingEvents = events.slice(0, 3);
  if (!upcomingEvents.length) {
    return {
      text: 'I could not find live events right now. You can refresh the events page or try again later.',
      actions: [{ label: 'Open events', to: '/events' }],
    };
  }

  const eventLines = upcomingEvents
    .map((event, index) => `${index + 1}. ${event.name || 'Untitled Event'} - ${formatEventTime(event.startTime)}`)
    .join('\n');

  return {
    text: `Here are a few events you can check:\n${eventLines}`,
    actions: [
      { label: 'Open all events', to: '/events' },
      ...upcomingEvents
        .filter((event) => event.id)
        .slice(0, 2)
        .map((event) => ({ label: event.name || 'View event', to: `/events/${event.id}` })),
    ],
  };
}

function mapBackendActions(actions = []) {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter((action) => action?.label)
    .map((action) => {
      if (action.type === 'route') {
        return { label: action.label, to: action.value };
      }
      return { label: action.label, command: action.value || action.label };
    });
}

function getLocalAnswer(input, isLoggedIn) {
  const text = normalizeText(input);

  if (!text) {
    return {
      text: 'Type a question or choose one of the quick actions below.',
      actions: QUICK_PROMPTS.map((label) => ({ label, command: label })),
    };
  }

  if (/(login|sign in|dang nhap|signin)/.test(text)) {
    return {
      text: 'Use the Login button in the header. After signing in, TicketRush will return you to the page you were trying to open.',
      actions: [{ label: 'Go to login', to: '/login' }],
    };
  }

  if (/(register|sign up|create account|dang ky)/.test(text)) {
    return {
      text: 'Create an account with the Register button, then verify your email before signing in.',
      actions: [{ label: 'Create account', to: '/register' }],
    };
  }

  if (/(ticket|order|my ticket|ve cua toi)/.test(text)) {
    return isLoggedIn
      ? {
        text: 'Your confirmed tickets are available in My Tickets.',
        actions: [{ label: 'Open My Tickets', to: '/orders' }],
      }
      : {
        text: 'Please sign in first, then open My Tickets to see your purchases.',
        actions: [{ label: 'Login', to: '/login' }],
      };
  }

  if (/(book|booking|buy|seat|dat ve|giu ghe|checkout)/.test(text)) {
    return {
      text: 'To book a ticket: open an event, choose available seats, review the summary, then confirm checkout. If you are not signed in, TicketRush will ask you to login first.',
      actions: [
        { label: 'Browse events', to: '/events' },
        ...(isLoggedIn ? [{ label: 'My tickets', to: '/orders' }] : [{ label: 'Login', to: '/login' }]),
      ],
    };
  }

  if (/(color|status|available|locked|sold|seat colors|mau ghe)/.test(text)) {
    return {
      text: 'Seat colors show availability: Available seats can be selected, In Queue seats are temporarily held, Booked seats are sold, and Your Selection is the seat you are holding.',
      actions: [{ label: 'Browse events', to: '/events' }],
    };
  }

  if (/(refund|cancel|support|help|contact)/.test(text)) {
    return {
      text: 'For payment, refund, or account issues, contact support from the footer or admin support area. For this demo, you can also check My Tickets after checkout.',
      actions: isLoggedIn ? [{ label: 'Open My Tickets', to: '/orders' }] : [{ label: 'Login', to: '/login' }],
    };
  }

  return {
    text: 'I can help with finding events, booking seats, login, register, and checking tickets. Try asking about one of those.',
    actions: [
      { label: 'Find events', command: 'events' },
      { label: 'How to book', command: 'book' },
      { label: 'Login help', command: 'login' },
    ],
  };
}

export function ChatbotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(STARTER_MESSAGES);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventLoadAttempted, setEventLoadAttempted] = useState(false);
  const scrollRef = useRef(null);

  const isLoggedIn = Boolean(getAuthToken());

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isOpen, messages, isThinking]);

  const botAvatar = useMemo(() => (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
      <Bot size={16} />
    </span>
  ), []);

  const loadEvents = async () => {
    if (eventLoadAttempted && events.length) {
      return events;
    }

    setEventLoadAttempted(true);
    const response = await api.get('/events');
    const nextEvents = extractEvents(response);
    setEvents(nextEvents);
    return nextEvents;
  };

  const askBackendChatbot = async (message) => {
    const response = await api.post('/chatbot', { message });
    const payload = response.data?.data || response.data || {};
    return {
      text: payload.answer || 'I could not generate an answer right now.',
      actions: mapBackendActions(payload.actions),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
    };
  };

  const addMessage = (message) => {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        ...message,
      },
    ]);
  };

  const replyTo = async (rawText) => {
    const userText = String(rawText || '').trim();
    if (!userText) return;

    addMessage({ from: 'user', text: userText });
    setInput('');
    setIsThinking(true);

    try {
      const backendReply = await askBackendChatbot(userText);
      addMessage({ from: 'bot', ...backendReply });
    } catch {
      const normalized = normalizeText(userText);
      if (/(event|events|show|find|concert|sport|festival|su kien)/.test(normalized)) {
        try {
          const nextEvents = await loadEvents();
          addMessage({ from: 'bot', ...buildEventSuggestion(nextEvents) });
          return;
        } catch {
          // Fall through to the local support answer below.
        }
      }

      addMessage({
        from: 'bot',
        ...getLocalAnswer(userText, isLoggedIn),
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handleAction = (action) => {
    if (action.to) {
      setIsOpen(false);
      navigate(action.to);
      return;
    }
    replyTo(action.command || action.label);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    replyTo(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
      {isOpen ? (
        <section className="flex h-[min(620px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <header className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <Bot size={20} />
              </span>
              <div>
                <h2 className="text-sm font-black">TicketRush Assistant</h2>
                <p className="text-xs font-medium text-violet-100">Online support</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message) => {
              const isUser = message.from === 'user';
              return (
                <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser ? botAvatar : null}
                  <div className={`max-w-[82%] ${isUser ? 'order-first' : ''}`}>
                    <div
                      className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 ${
                        isUser
                          ? 'bg-violet-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 shadow-sm'
                      }`}
                    >
                      {message.text}
                    </div>
                    {Array.isArray(message.actions) && message.actions.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={`${message.id}-${action.label}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
                          >
                            {action.to ? <ChevronRight size={13} /> : <MessageCircle size={13} />}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {Array.isArray(message.sources) && message.sources.length ? (
                      <div className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        Sources: {message.sources.map((source) => source.title).filter(Boolean).join(', ')}
                      </div>
                    ) : null}
                  </div>
                  {isUser ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                      <User size={16} />
                    </span>
                  ) : null}
                </div>
              );
            })}

            {isThinking ? (
              <div className="flex items-center gap-3">
                {botAvatar}
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
                  Typing...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 bg-white px-4 py-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => replyTo(prompt)}
                  className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about events, seats, or tickets"
                className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group inline-flex h-14 items-center gap-3 rounded-full bg-violet-600 px-5 text-sm font-black text-white shadow-2xl shadow-violet-600/30 transition hover:-translate-y-0.5 hover:bg-violet-500"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </span>
        <span className="hidden sm:inline">Chat</span>
      </button>
    </div>
  );
}
