import React, { useState, useMemo } from 'react';
import { ScheduledEvent, TalentProfile } from '../types';
import { 
  Calendar, 
  Clock, 
  Radio, 
  MapPin, 
  Users, 
  Sparkles, 
  ExternalLink, 
  PlusCircle, 
  Edit, 
  Trash2, 
  Check, 
  Copy, 
  Search, 
  Filter, 
  RefreshCw, 
  X, 
  Ticket,
  ChevronRight,
  Eye,
  AlertCircle
} from 'lucide-react';

interface EventSchedulePanelProps {
  events: ScheduledEvent[];
  talent: TalentProfile[];
  onRefresh: () => void;
  onAdd: (defaultToday?: boolean) => void;
  onEdit: (event: ScheduledEvent) => void;
  onDelete: (id: string) => void;
  onToggleLive: (id: string) => void;
}

export const EventSchedulePanel: React.FC<EventSchedulePanelProps> = ({
  events,
  talent,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
  onToggleLive
}) => {
  const [filterMode, setFilterMode] = useState<'today' | 'live' | 'upcoming' | 'all' | 'completed'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayEvents = useMemo(() => {
    return events.filter(e => e.date === todayStr || (e.startDate && e.startDate.startsWith(todayStr)));
  }, [events, todayStr]);

  const liveEvents = useMemo(() => {
    return events.filter(e => e.isLiveNow || e.status === 'live');
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return events.filter(e => (e.date >= todayStr || (e.startDate && e.startDate.slice(0, 10) >= todayStr)) && e.status !== 'completed');
  }, [events, todayStr]);

  // Filtered and searched events
  const displayedEvents = useMemo(() => {
    let list = events;
    if (filterMode === 'today') {
      list = todayEvents;
    } else if (filterMode === 'live') {
      list = liveEvents;
    } else if (filterMode === 'upcoming') {
      list = upcomingEvents;
    } else if (filterMode === 'completed') {
      list = events.filter(e => e.status === 'completed' || (e.date < todayStr && !e.isLiveNow));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        e.title.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.talentName || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.locationOrUrl || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      // Live first, then today, then chronological
      if (a.isLiveNow && !b.isLiveNow) return -1;
      if (!a.isLiveNow && b.isLiveNow) return 1;
      const dateA = a.date || (a.startDate ? a.startDate.slice(0, 10) : '');
      const dateB = b.date || (b.startDate ? b.startDate.slice(0, 10) : '');
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }, [events, filterMode, searchQuery, todayEvents, liveEvents, upcomingEvents, todayStr]);

  const handleCopyLink = (id: string, url?: string) => {
    const textToCopy = url || `${window.location.origin}/?page=media#schedule-${id}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Today Highlight */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-yellow-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                <span>Event Schedule Management</span>
              </span>
              <span className="text-xs text-zinc-400">
                Today: <strong className="text-white">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Event Schedule & Live Broadcast Engine</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Schedule broadcasts, premieres, VIP appearances, and private galas. Events scheduled for today appear instantly in the platform's Live Schedule element.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onAdd(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-yellow-500/10 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Event for Today</span>
            </button>

            <button
              type="button"
              onClick={() => onAdd(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-zinc-700"
            >
              <Calendar className="w-4 h-4 text-yellow-400" />
              <span>Schedule Upcoming</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              title="Refresh Schedule"
              className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Schedule Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-zinc-800/80">
          <div 
            onClick={() => setFilterMode('today')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              filterMode === 'today' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-black/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="text-[11px] text-zinc-400 font-medium">Scheduled for Today</div>
            <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
              <span>{todayEvents.length} Events</span>
              {todayEvents.length > 0 && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
            </div>
          </div>

          <div 
            onClick={() => setFilterMode('live')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              filterMode === 'live' ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-black/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="text-[11px] text-zinc-400 font-medium">Currently Live</div>
            <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
              <span>{liveEvents.length} Active</span>
              {liveEvents.length > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </div>
          </div>

          <div 
            onClick={() => setFilterMode('upcoming')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              filterMode === 'upcoming' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-black/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="text-[11px] text-zinc-400 font-medium">Upcoming Schedule</div>
            <div className="text-lg font-bold text-white mt-0.5">{upcomingEvents.length} Events</div>
          </div>

          <div 
            onClick={() => setFilterMode('all')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              filterMode === 'all' ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : 'bg-black/40 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <div className="text-[11px] text-zinc-400 font-medium">Total Events Recorded</div>
            <div className="text-lg font-bold text-white mt-0.5">{events.length} Total</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-[#111]/40 p-4 rounded-2xl border border-zinc-800/60">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'today' ? 'bg-yellow-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Today ({todayEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('live')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                filterMode === 'live' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3" />
              Live ({liveEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('upcoming')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'upcoming' ? 'bg-yellow-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Upcoming ({upcomingEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                filterMode === 'all' ? 'bg-yellow-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({events.length})
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search event title, host, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      {/* Events Table / Card List */}
      {displayedEvents.length === 0 ? (
        <div className="text-center py-16 bg-[#111]/30 border border-zinc-800/80 rounded-2xl p-6">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-base font-bold text-white">No scheduled events match the current filter</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            {filterMode === 'today'
              ? "There are currently no events scheduled for today. Click 'Add Event for Today' to schedule a live broadcast or premiere now!"
              : "Try switching filters or add a new scheduled event."}
          </p>
          <button
            type="button"
            onClick={() => onAdd(true)}
            className="mt-4 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-yellow-500/10 inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Event for Today</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4">Event & Cover</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Host / Talent</th>
                  <th className="py-3.5 px-4">Category & Type</th>
                  <th className="py-3.5 px-4">Status & Live</th>
                  <th className="py-3.5 px-4">RSVPs</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {displayedEvents.map((event) => {
                  const isToday = event.date === todayStr || (event.startDate && event.startDate.startsWith(todayStr));
                  const isLive = event.isLiveNow || event.status === 'live';

                  return (
                    <tr 
                      key={event.id}
                      className="hover:bg-zinc-900/40 transition-colors"
                    >
                      {/* Event Title & Cover */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <img
                            src={event.coverImageUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80'}
                            alt={event.title}
                            className="w-14 h-10 rounded-lg object-cover border border-zinc-800 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80';
                            }}
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-xs truncate max-w-[200px]" title={event.title}>
                              {event.title}
                            </h4>
                            <p className="text-[11px] text-zinc-400 truncate max-w-[200px] mt-0.5">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {isToday ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-500 text-zinc-950 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Today</span>
                              </span>
                            ) : (
                              <span className="text-zinc-300 font-medium">
                                {formatDisplayDate(event.date)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''} {event.timezone || 'SAST'}
                          </span>
                        </div>
                      </td>

                      {/* Talent Host */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <img
                            src={event.talentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                            alt={event.talentName || 'Talent'}
                            className="w-6 h-6 rounded-full object-cover border border-yellow-500/30"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
                            }}
                          />
                          <span className="font-semibold text-zinc-200 text-xs">
                            {event.talentName || 'Elysian Creator'}
                          </span>
                        </div>
                      </td>

                      {/* Category & Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700/60 w-fit">
                            {event.category || event.eventType}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {event.price && event.price > 0 ? `R${event.price}` : 'Free / VIP'}
                          </span>
                        </div>
                      </td>

                      {/* Status & Live Toggle */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onToggleLive(event.id)}
                            title={isLive ? "Click to take offline" : "Click to go live now"}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                              isLive
                                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 animate-pulse'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 hover:border-yellow-500/50'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500 animate-ping' : 'bg-zinc-500'}`} />
                            <span>{isLive ? 'Live Now' : 'Scheduled'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Attendees */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-zinc-400 font-mono">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{event.attendeesCount || 0}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(event.id, event.locationOrUrl)}
                            title="Copy event link"
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            {copiedId === event.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onEdit(event)}
                            title="Edit Event"
                            className="p-1.5 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(event.id)}
                            title="Delete Event"
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface EventFormModalProps {
  event: ScheduledEvent | null;
  talent: TalentProfile[];
  defaultToday?: boolean;
  onClose: () => void;
  onSubmit: (formData: any) => void;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  event,
  talent,
  defaultToday = false,
  onClose,
  onSubmit
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [talentId, setTalentId] = useState(event?.talentId || (talent[0]?.id || ''));
  const [category, setCategory] = useState(event?.category || 'Live Stream');
  const [eventType, setEventType] = useState<ScheduledEvent['eventType']>(event?.eventType || 'livestream');
  const [date, setDate] = useState(event?.date || (defaultToday ? todayStr : todayStr));
  const [startTime, setStartTime] = useState(event?.startTime || '20:00');
  const [endTime, setEndTime] = useState(event?.endTime || '22:00');
  const [locationOrUrl, setLocationOrUrl] = useState(event?.locationOrUrl || 'https://elysian.vip/live/stream');
  const [coverImageUrl, setCoverImageUrl] = useState(
    event?.coverImageUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80'
  );
  const [price, setPrice] = useState(event?.price?.toString() || '0');
  const [isVipOnly, setIsVipOnly] = useState(event?.isVipOnly ?? false);
  const [isLiveNow, setIsLiveNow] = useState(event?.isLiveNow ?? false);
  const [tags, setTags] = useState(event?.tags ? event.tags.join(', ') : 'live, exclusive');

  const selectedTalentProfile = talent.find(t => t.id === talentId || t.userId === talentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Event title and date are required');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      talentId: talentId || null,
      talentName: selectedTalentProfile?.name || event?.talentName || 'Elysian Creator',
      talentAvatar: selectedTalentProfile?.imageUrl || event?.talentAvatar || '',
      category,
      eventType,
      date,
      startTime,
      endTime,
      locationOrUrl: locationOrUrl.trim(),
      coverImageUrl: coverImageUrl.trim(),
      price: Number(price) || 0,
      isVipOnly,
      isLiveNow,
      status: isLiveNow ? 'live' : (event?.status || 'scheduled'),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121216] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-500" />
              <span>{event ? 'Edit Scheduled Event' : 'Schedule New Event'}</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configure event details, host talent, broadcast time, and access options.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block text-zinc-300 font-bold mb-1.5">Event Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. VIP Penthouse Live: Sunset Session & Fan Q&A"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Talent Host Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">Host Talent / Creator</label>
              <select
                value={talentId}
                onChange={(e) => setTalentId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="">Select Talent Host...</option>
                {talent.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.title || 'Creator'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="livestream">Live Broadcast / Stream</option>
                <option value="premiere">4K Premiere Screening</option>
                <option value="appearance">In-Person VIP Appearance</option>
                <option value="chat_session">Interactive 1-on-1 Q&A</option>
                <option value="vip_party">VIP Party / Gala</option>
              </select>
            </div>
          </div>

          {/* Date and Time Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">Date (YYYY-MM-DD) *</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setDate(todayStr)}
                  className="px-2 py-2 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-zinc-950 rounded-lg text-[10px] font-bold transition-all border border-yellow-500/20 whitespace-nowrap"
                  title="Set to Today"
                >
                  Today
                </button>
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">Start Time</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="20:00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-bold mb-1.5">End Time</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="22:30"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-500 font-mono"
              />
            </div>
          </div>

          {/* Location or Stream URL */}
          <div>
            <label className="block text-zinc-300 font-bold mb-1.5">Stream URL or Venue Location</label>
            <input
              type="text"
              value={locationOrUrl}
              onChange={(e) => setLocationOrUrl(e.target.value)}
              placeholder="e.g. https://elysian.vip/live/penthouse or Skyline Lounge, Sandton"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Cover Image URL */}
          <div>
            <label className="block text-zinc-300 font-bold mb-1.5">Cover Image URL</label>
            <input
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Price & VIP Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-black/40 border border-zinc-800/80 rounded-xl">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Ticket Price (Rands)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-yellow-500"
              />
              <span className="text-[10px] text-zinc-500 mt-0.5 block">0 = Free / Included</span>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="isVipOnly"
                checked={isVipOnly}
                onChange={(e) => setIsVipOnly(e.target.checked)}
                className="rounded border-zinc-700 text-yellow-500 focus:ring-yellow-500"
              />
              <label htmlFor="isVipOnly" className="text-zinc-300 font-medium cursor-pointer">
                VIP Access Only
              </label>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="isLiveNow"
                checked={isLiveNow}
                onChange={(e) => setIsLiveNow(e.target.checked)}
                className="rounded border-zinc-700 text-red-500 focus:ring-red-500"
              />
              <label htmlFor="isLiveNow" className="text-zinc-300 font-medium cursor-pointer flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>Broadcasting Live Now</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-300 font-bold mb-1.5">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide event overview, schedule highlights, and access instructions..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-zinc-300 font-bold mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="live, cape town, sunset, premiere"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold transition-colors shadow-lg shadow-yellow-500/10"
            >
              {event ? 'Update Scheduled Event' : 'Schedule Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
