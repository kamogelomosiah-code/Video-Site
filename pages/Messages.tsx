import React, { useState, useEffect, useRef } from 'react';
import { User, TalentProfile, Message } from '../types';
import { api } from '../services/api';
import { Send, ArrowLeft } from 'lucide-react';

interface MessagesPageProps {
  currentUser: User;
  onBack: () => void;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ currentUser, onBack }) => {
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [selectedTalent, setSelectedTalent] = useState<TalentProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTalents = async () => {
      const data = await api.talent.getAll();
      setTalents(data);
    };
    fetchTalents();
  }, []);

  useEffect(() => {
    if (selectedTalent) {
      const fetchMessages = async () => {
        const data = await api.messages.getConversation(currentUser.id, selectedTalent.id);
        setMessages(data);
        scrollToBottom();
      };
      fetchMessages();
      
      const interval = setInterval(fetchMessages, 3000); // simple polling
      return () => clearInterval(interval);
    }
  }, [selectedTalent, currentUser.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedTalent) return;
    setIsLoading(true);
    try {
      const newMsg = await api.messages.send(currentUser.id, selectedTalent.id, inputText);
      setMessages([...messages, newMsg]);
      setInputText('');
      scrollToBottom();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-black rounded-xl overflow-hidden border border-zinc-900">
      {/* Sidebar for conversations */}
      <div className={`w-full md:w-1/3 border-r border-zinc-900 ${selectedTalent ? 'hidden md:block' : 'block'}`}>
        <div className="p-4 border-b border-zinc-900">
          <h2 className="text-xl font-bold text-white">Messages</h2>
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {talents.map(talent => (
            <div 
              key={talent.id} 
              onClick={() => setSelectedTalent(talent)}
              className={`p-4 border-b border-zinc-900/50 cursor-pointer hover:bg-[#111] transition-colors flex items-center ${selectedTalent?.id === talent.id ? 'bg-[#111]' : ''}`}
            >
              <div className="relative">
                {talent.imageUrl ? (
                  <img src={talent.imageUrl} alt={talent.name} className="w-12 h-12 rounded-full object-cover border border-zinc-800" />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-zinc-800 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-sm">
                    {(talent.name || "T").charAt(0).toUpperCase()}
                  </div>
                )}
                {talent.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>}
              </div>
              <div className="ml-4">
                <p className="font-semibold text-white">{talent.name}</p>
                <p className="text-xs text-zinc-500">Tap to chat</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedTalent ? (
        <div className={`w-full md:w-2/3 flex flex-col h-full ${!selectedTalent ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-900 flex items-center bg-[#111]/50">
            <button className="md:hidden mr-4 text-zinc-400 hover:text-white" onClick={() => setSelectedTalent(null)}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            {selectedTalent.imageUrl ? (
              <img src={selectedTalent.imageUrl} alt={selectedTalent.name} className="w-10 h-10 rounded-full object-cover mr-3" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-xs mr-3">
                {(selectedTalent.name || "T").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-white">{selectedTalent.name}</p>
              <p className="text-xs text-green-500">{selectedTalent.online ? 'Online' : 'Offline'}</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                No messages yet. Send a message to start the conversation!
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-yellow-500 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-200 rounded-bl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-900 bg-black">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-[#111] border border-zinc-800 rounded-full px-4 py-2 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !inputText.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-white p-2.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex w-2/3 items-center justify-center text-zinc-500 flex-col">
          <div className="w-16 h-16 bg-[#111] rounded-full flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-zinc-600" />
          </div>
          <p>Select a conversation to start chatting</p>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
