import React, { useState, useEffect } from 'react';
import { ScheduledEvent } from '../types';
import { api } from '../services/api';
import { 
  Calendar, 
  Clock, 
  Radio, 
  MapPin, 
  Users, 
  Sparkles, 
  ExternalLink, 
  ChevronRight, 
  Check, 
  Bell, 
  Ticket, 
  RefreshCw,
  Video,
  X
} from 'lucide-react';

interface EventScheduleElementProps {
  onTalentClick?: (talentId: string) => void;
  className?: string;
  compact?: boolean;
}

export const EventScheduleElement: React.FC<EventScheduleElementProps> = ({ 
  onTalentClick, 
  className = '',
  compact = false 
}) => {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [todaySummary, setTodaySummary] = useState<{ date: string; totalToday: number; liveNow: number }>({
    date: new Date().toISOString().slice(0, 10),
    totalToday: 0,
    liveNow: 0
  });
  const [activeFilter, setActiveFilter] = useState<'today' | 'upcoming' | 'live' | 'all'>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [rsvpedEvents, setRsvpedEvents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('elysian_rsvped_events');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [selectedEventModal, setSelectedEventModal] = useState<ScheduledEvent | null>(null);

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const [todayRes, allEvents] = await Promise.all([
        api.events.getToday().catch(() => ({ date: new Date().toISOString().slice(0, 10), totalToday: 0, liveNow: 0, events: [] })),
        api.events.getAll().catch(() => [])
      ]);

      setTodaySummary({
        date: todayRes.date,
        totalToday: todayRes.totalToday,
        liveNow: todayRes.liveNow
      });

      // Filter events based on activeFilter
      if (activeFilter === 'today') {
        setEvents(todayRes.events && todayRes.events.length > 0 ? todayRes.events : allEvents.filter(e => e.date === todayRes.date));
      } else if (activeFilter === 'live') {
        setEvents(allEvents.filter(e => e.isLiveNow || e.status === 'live'));
      } else if (activeFilter === 'upcoming') {
        const todayStr = todayRes.date;
        setEvents(allEvents.filter(e => (e.date >= todayStr || (e.startDate && e.startDate.slice(0, 10) >= todayStr)) && e.status !== 'completed'));
      } else {
        setEvents(allEvents);
      }
    } catch (err) {
      console.error('Failed to load event schedule:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [activeFilter]);

  const handleRsvp = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (rsvpedEvents.has(eventId)) return;

    try {
      const res = await api.events.rsvp(eventId);
      if (res.success) {
        const next = new Set(rsvpedEvents);
        next.add(eventId);
        setRsvpedEvents(next);
        localStorage.setItem('elysian_rsvped_events', JSON.stringify([...next]));

        // Update local count
        setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, attendeesCount: res.attendeesCount } : ev));
        if (selectedEventModal && selectedEventModal.id === eventId) {
          setSelectedEventModal(prev => prev ? { ...prev, attendeesCount: res.attendeesCount } : null);
        }
      }
    } catch (err) {
      console.error('RSVP failed', err);
    }
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const todayStr = todaySummary.date || new Date().toISOString().slice(0, 10);
      if (dateStr === todayStr) return 'Today';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case 'livestream':
        return { label: 'Live Broadcast', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'premiere':
        return { label: '4K Premiere', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
      case 'appearance':
        return { label: 'VIP Appearance', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
      case 'vip_party':
        return { label: 'Gala / VIP Party', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'chat_session':
        return { label: 'Interactive Q&A', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      default:
        return { label: 'Special Event', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  return (
    <div className={`bg-[#0d0d0f] border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden ${className}`}>
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-1.5 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-yellow-400" />
              <span>Event Schedule</span>
            </span>

            {todaySummary.liveNow > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>{todaySummary.liveNow} Live Stream{todaySummary.liveNow > 1 ? 's' : ''} Today</span>
              </span>
            )}

            <span className="text-xs text-zinc-400">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Today's Schedule & Live Premieres</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time broadcasts, VIP private hosting, and exclusive 4K content launches across South Africa.
          </p>
        </div>

        {/* Filter Pills & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === 'today'
                  ? 'bg-yellow-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Today</span>
              {todaySummary.totalToday > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeFilter === 'today' ? 'bg-zinc-950 text-yellow-400' : 'bg-zinc-800 text-zinc-300'
                }`}>
                  {todaySummary.totalToday}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeFilter === 'live'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3 text-red-400" />
              <span>Live Now</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'upcoming'
                  ? 'bg-yellow-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Upcoming</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeFilter === 'all'
                  ? 'bg-yellow-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>All</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchSchedule}
            title="Refresh Schedule"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-yellow-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Event Cards Grid */}
      {isLoading && events.length === 0 ? (
        <div className="py-16 text-center text-zinc-500 text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />
          <span>Loading today's event schedule...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="py-14 text-center bg-black/40 border border-zinc-900 rounded-2xl p-6">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-white font-bold text-sm">No events found for {activeFilter === 'today' ? "today's schedule" : activeFilter}</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            Check the upcoming broadcast calendar or switch filters to view scheduled premier releases.
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            View Full Schedule
          </button>
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
          {events.map((event) => {
            const isToday = event.date === todaySummary.date;
            const isLive = event.isLiveNow || event.status === 'live';
            const badge = getEventTypeBadge(event.eventType);
            const isRsvped = rsvpedEvents.has(event.id);

            return (
              <div
                key={event.id}
                onClick={() => setSelectedEventModal(event)}
                className="group relative bg-[#121216] border border-zinc-800/90 hover:border-yellow-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/5 cursor-pointer flex flex-col justify-between"
              >
                {/* Event Image Banner */}
                <div className="relative h-44 w-full overflow-hidden bg-zinc-900">
                  <img
                    src={event.coverImageUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80'}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-black/40 to-black/20" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isLive ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1 shadow-lg shadow-red-600/40 animate-pulse">
                          <Radio className="w-3 h-3" />
                          <span>Live Now</span>
                        </span>
                      ) : isToday ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-500 text-zinc-950 flex items-center gap-1 shadow-md">
                          <Clock className="w-3 h-3" />
                          <span>Today</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-md text-zinc-300 border border-zinc-700/60">
                          {formatEventDate(event.date)}
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    {event.isVipOnly && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>VIP</span>
                      </span>
                    )}
                  </div>

                  {/* Time Ribbon */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-300">
                    <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px] font-mono font-medium">
                      <Clock className="w-3 h-3 text-yellow-400" />
                      <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''} {event.timezone || 'SAST'}</span>
                    </div>

                    {event.price && event.price > 0 ? (
                      <span className="bg-yellow-500/90 text-zinc-950 font-black px-2.5 py-1 rounded-lg text-[11px] shadow">
                        R{event.price}
                      </span>
                    ) : (
                      <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        Free Access
                      </span>
                    )}
                  </div>
                </div>

                {/* Event Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Host Avatar & Name */}
                    {event.talentName && (
                      <div 
                        className="flex items-center gap-2 mb-2 group/talent hover:opacity-90 transition-opacity"
                        onClick={(e) => {
                          if (event.talentId && onTalentClick) {
                            e.stopPropagation();
                            onTalentClick(event.talentId);
                          }
                        }}
                      >
                        <img
                          src={event.talentAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                          alt={event.talentName}
                          className="w-5 h-5 rounded-full object-cover border border-yellow-500/40"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';
                          }}
                        />
                        <span className="text-xs font-bold text-zinc-300 group-hover/talent:text-yellow-400 transition-colors">
                          {event.talentName}
                        </span>
                      </div>
                    )}

                    <h4 className="text-base font-bold text-white group-hover:text-yellow-400 transition-colors line-clamp-1">
                      {event.title}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  {/* Footer & RSVP Action */}
                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                      <Users className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="font-mono text-[11px]">{event.attendeesCount || 0} attending</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleRsvp(e, event.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isRsvped
                            ? 'bg-zinc-800 text-green-400 border border-green-500/30'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        }`}
                      >
                        {isRsvped ? (
                          <>
                            <Check className="w-3 h-3 text-green-400" />
                            <span>RSVP'd</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-3 h-3 text-yellow-400" />
                            <span>RSVP</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedEventModal(event)}
                        className="p-1.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-zinc-950 border border-yellow-500/20 transition-all"
                        title="View Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#121216] border border-zinc-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            {/* Modal Image Header */}
            <div className="relative h-56 w-full bg-zinc-900">
              <img
                src={selectedEventModal.coverImageUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80'}
                alt={selectedEventModal.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121216] via-black/40 to-black/20" />

              <button
                type="button"
                onClick={() => setSelectedEventModal(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black rounded-full text-zinc-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-500 text-zinc-950 flex items-center gap-1.5 shadow">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatEventDate(selectedEventModal.date)}</span>
                </span>

                {selectedEventModal.isLiveNow && (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white flex items-center gap-1.5 animate-pulse">
                    <Radio className="w-3.5 h-3.5" />
                    <span>Live Now</span>
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-black text-white">{selectedEventModal.title}</h3>
                <p className="text-sm text-zinc-300 mt-2 leading-relaxed whitespace-pre-wrap">
                  {selectedEventModal.description}
                </p>
              </div>

              {/* Host and Schedule Specs */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 border border-zinc-800/80 rounded-xl text-xs">
                <div>
                  <span className="text-zinc-500 block">Host & Talent</span>
                  <span className="font-bold text-white mt-0.5 block">{selectedEventModal.talentName || 'Elysian Creator'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Scheduled Time</span>
                  <span className="font-mono text-zinc-200 mt-0.5 block">
                    {selectedEventModal.startTime} {selectedEventModal.timezone || 'SAST'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Category</span>
                  <span className="text-yellow-400 font-semibold mt-0.5 block">{selectedEventModal.category}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Access & Tickets</span>
                  <span className="text-zinc-200 font-semibold mt-0.5 block">
                    {selectedEventModal.price && selectedEventModal.price > 0 ? `R${selectedEventModal.price}` : 'Free VIP Access'}
                  </span>
                </div>
              </div>

              {selectedEventModal.locationOrUrl && (
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300 truncate">
                    <MapPin className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <span className="truncate">{selectedEventModal.locationOrUrl}</span>
                  </div>
                  {selectedEventModal.locationOrUrl.startsWith('http') && (
                    <a
                      href={selectedEventModal.locationOrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold rounded-lg flex items-center gap-1 flex-shrink-0"
                    >
                      <span>Join Room</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <span className="text-xs text-zinc-500 font-mono">
                  {selectedEventModal.attendeesCount || 0} RSVPs registered
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleRsvp(e, selectedEventModal.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      rsvpedEvents.has(selectedEventModal.id)
                        ? 'bg-zinc-800 text-green-400 border border-green-500/30'
                        : 'bg-yellow-500 hover:bg-yellow-400 text-zinc-950'
                    }`}
                  >
                    {rsvpedEvents.has(selectedEventModal.id) ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>You're Attending</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        <span>RSVP / Remind Me</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEventModal(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventScheduleElement;
