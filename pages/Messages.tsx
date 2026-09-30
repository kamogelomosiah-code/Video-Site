import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, TalentProfile, ChatThread, ChatMessage } from '../types';
import { api } from '../services/api';
import { Send, ArrowLeft, CheckCircle, XCircle, AlertCircle, ShoppingBag, Clock, Sparkles } from 'lucide-react';

interface MessagesPageProps {
  currentUser: User;
  onBack: () => void;
  initialTalentId?: string;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ currentUser, onBack, initialTalentId }) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load talents and chat threads
  const loadThreadsAndTalents = useCallback(async () => {
    try {
      const [talentList, threadList] = await Promise.all([
        api.talent.getAll().catch(() => []),
        api.chat.getThreads().catch(() => [])
      ]);
      setTalents(talentList);
      setThreads(threadList);

      // Handle initialTalentId if passed
      if (initialTalentId) {
        const found = threadList.find(t => t.talentId === initialTalentId || t.userId === initialTalentId);
        if (found) {
          setSelectedThreadId(found.id);
        } else {
          try {
            const newThread = await api.chat.open(initialTalentId);
            setThreads(prev => [newThread, ...prev.filter(t => t.id !== newThread.id)]);
            setSelectedThreadId(newThread.id);
          } catch (e: any) {
            setErrorMessage(e.message || 'Unable to start chat with talent.');
          }
        }
      } else if (!selectedThreadId && threadList.length > 0) {
        setSelectedThreadId(threadList[0].id);
      }
    } catch (e) {
      console.error('Failed to load chat data', e);
    }
  }, [initialTalentId, selectedThreadId]);

  useEffect(() => {
    loadThreadsAndTalents();
  }, []);

  // Poll active thread
  useEffect(() => {
    if (!selectedThreadId) {
      setActiveThread(null);
      return;
    }

    const fetchThread = async () => {
      try {
        const data = await api.chat.getThread(selectedThreadId);
        setActiveThread(data);
      } catch (e) {
        console.error('Failed to load thread detail', e);
      }
    };

    fetchThread();
    const interval = setInterval(fetchThread, 3000);
    return () => clearInterval(interval);
  }, [selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedThreadId || isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await api.chat.sendMessage(selectedThreadId, inputText.trim());
      setActiveThread(updated);
      setThreads(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      setInputText('');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedThreadId || actionLoading) return;
    setActionLoading(true);
    try {
      const updated = await api.chat.accept(selectedThreadId);
      setActiveThread(updated);
      setThreads(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to accept thread.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedThreadId || actionLoading) return;
    setActionLoading(true);
    try {
      const updated = await api.chat.decline(selectedThreadId);
      setActiveThread(updated);
      setThreads(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to decline thread.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectProduct = async (productId: string) => {
    if (!selectedThreadId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.chat.selectProduct(selectedThreadId, productId);
      if (res?.thread) {
        setActiveThread(res.thread);
        setThreads(prev => prev.map(t => (t.id === res.thread.id ? res.thread : t)));
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to select tier.');
    } finally {
      setActionLoading(false);
    }
  };

  const getOtherParticipant = (thread: ChatThread) => {
    const isTalentUser = currentUser.id === thread.talentId;
    const otherId = isTalentUser ? thread.userId : thread.talentId;
    const matchedTalent = talents.find(t => t.id === otherId || t.userId === otherId);
    return {
      id: otherId,
      name: matchedTalent?.name || (isTalentUser ? `Fan #${otherId.slice(0, 6)}` : `Talent #${otherId.slice(0, 6)}`),
      avatar: matchedTalent?.imageUrl,
      talent: matchedTalent,
    };
  };

  const isTalent = activeThread ? currentUser.id === activeThread.talentId : false;
  const isConsumer = activeThread ? currentUser.id === activeThread.userId : false;
  const limitReached = isConsumer && (activeThread?.userMessageCount ?? 0) >= 4 && activeThread?.status === 'opened';
  const isDeclined = activeThread?.status === 'declined';
  const otherParty = activeThread ? getOtherParticipant(activeThread) : null;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] min-h-[550px] bg-black rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl">
      {/* Sidebar for conversations */}
      <div className={`w-full md:w-1/3 border-r border-zinc-800/80 flex flex-col ${activeThread ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>
              Direct Inquiries
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Secure talent communication portal</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
            {threads.length} {threads.length === 1 ? 'chat' : 'chats'}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-zinc-900 bg-zinc-950/60">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
              <p>No inquiry threads yet.</p>
              <p className="text-xs text-zinc-600">Browse the Talent Directory to open a chat request with verified creators.</p>
            </div>
          ) : (
            threads.map(t => {
              const participant = getOtherParticipant(t);
              const isSelected = selectedThreadId === t.id;
              const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedThreadId(t.id)}
                  className={`p-4 cursor-pointer hover:bg-zinc-900/60 transition-colors flex items-center gap-3.5 ${
                    isSelected ? 'bg-zinc-900/90 border-l-2 border-yellow-500' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {participant.avatar ? (
                      <img src={participant.avatar} alt={participant.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-sm">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-white text-sm truncate">{participant.name}</p>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        t.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                        t.status === 'declined' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {lastMsg ? lastMsg.text : 'Thread initialized'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Conversation Area */}
      {activeThread && otherParty ? (
        <div className={`w-full md:w-2/3 flex flex-col h-full bg-zinc-950 ${!activeThread ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="md:hidden text-zinc-400 hover:text-white"
                onClick={() => setSelectedThreadId(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {otherParty.avatar ? (
                <img src={otherParty.avatar} alt={otherParty.name} className="w-10 h-10 rounded-full object-cover border border-zinc-800" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-sm border border-zinc-800">
                  {otherParty.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-bold text-white text-sm md:text-base leading-none">{otherParty.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    activeThread.status === 'accepted' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    activeThread.status === 'declined' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {activeThread.status}
                  </span>
                  {isConsumer && (
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-yellow-500" />
                      Inquiry Messages: {activeThread.userMessageCount} / 4
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Talent Moderation Controls */}
            {isTalent && activeThread.status === 'opened' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleAccept}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Accept Inquiry
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleDecline}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-300 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Decline
                </button>
              </div>
            )}
          </div>

          {/* Product / Tier Selection Banner (if talent profile has products) */}
          {otherParty.talent?.products && otherParty.talent.products.length > 0 && (
            <div className="bg-zinc-900/50 border-b border-zinc-800/80 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-2 text-xs text-zinc-300 whitespace-nowrap">
                <ShoppingBag className="w-3.5 h-3.5 text-yellow-500" />
                <span className="font-semibold">Booking Packages:</span>
              </div>
              <div className="flex items-center gap-2">
                {otherParty.talent.products.map(p => {
                  const isSelected = activeThread.selectedProductId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleSelectProduct(p.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-yellow-500 text-black font-bold border-yellow-400 shadow-md shadow-yellow-500/20'
                          : 'bg-zinc-800/80 text-zinc-300 hover:text-white border-zinc-700 hover:border-yellow-500'
                      }`}
                    >
                      {p.name} (R{p.price})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Message Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeThread.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm space-y-2">
                <p>No messages sent yet.</p>
                <p className="text-xs text-zinc-600">Send an initial inquiry note to begin communication.</p>
              </div>
            ) : (
              activeThread.messages.map((msg: ChatMessage) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMine
                          ? 'bg-yellow-500 text-black font-medium rounded-br-none shadow-md shadow-yellow-500/10'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className={`text-[10px] ${isMine ? 'text-black/60 font-medium' : 'text-zinc-500'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box / Limit Warning */}
          <div className="p-4 border-t border-zinc-800/80 bg-black">
            {limitReached ? (
              <div className="text-center p-3 rounded-xl bg-zinc-900/80 border border-yellow-500/30 text-xs text-yellow-400">
                You have reached the 4-message inquiry threshold for this request. Please wait for the talent to accept the conversation.
              </div>
            ) : isDeclined ? (
              <div className="text-center p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-400">
                This inquiry request was declined by the talent. Further messaging is closed.
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={
                    isConsumer
                      ? `Inquire with ${otherParty.name} (${4 - (activeThread.userMessageCount || 0)} messages remaining)...`
                      : `Reply to ${otherParty.name}...`
                  }
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isLoading || !inputText.trim()}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black p-2.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-yellow-500/20 active:scale-95"
                >
                  <Send className="w-5 h-5 fill-current" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex w-2/3 items-center justify-center text-zinc-500 flex-col p-8 space-y-4">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
            <Send className="w-7 h-7 text-yellow-500" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-white font-bold text-base">Direct Booking Messenger</h3>
            <p className="text-xs text-zinc-500 max-w-sm">Select an existing thread from the left or book a creator via the Talent Directory.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
