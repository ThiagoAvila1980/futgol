import React, { useState, useMemo } from 'react';
import { Player, Match, Position, Group } from '../types';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import DateInput from './DateInput';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface StatsScreenProps {
    players: Player[];
    matches: Match[];
    activeGroup: Group;
}

type SortBy = 'matches' | 'goals' | 'assists' | 'rating' | 'mvps';

export const StatsScreen: React.FC<StatsScreenProps> = ({ players, matches, activeGroup }) => {
    const [startDate, setStartDate] = useState(() => {
        // Default to first day of current month
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [sortBy, setSortBy] = useState<SortBy | 'mvps'>('goals');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredStats = useMemo(() => {
        const stats: Record<string, { matches: number; goals: number; assists: number; rating: number; mvps: number }> = {};

        players.forEach(p => {
            stats[p.id] = { matches: 0, goals: 0, assists: 0, rating: p.rating || 0, mvps: 0 };
        });

        matches.forEach(m => {
            if (!m.finished) return;
            if (startDate && m.date < startDate) return;
            if (endDate && m.date > endDate) return;

            // Count attendance - anyone who arrived or was in a submatch or in confirmed list
            const attendees = new Set([
                ...(m.arrivedPlayerIds || []),
                // Fallback/Legacy: also count players in teams if arrived list is not used
                ...m.teamA.map(p => p.id),
                ...m.teamB.map(p => p.id)
            ]);

            // Also add anyone who played a submatch (just in case they were added manually)
            m.subMatches?.forEach(sm => {
                sm.teamA.forEach(p => attendees.add(p.id));
                sm.teamB.forEach(p => attendees.add(p.id));
            });

            attendees.forEach(pid => {
                if (stats[pid]) {
                    stats[pid].matches += 1;
                }
            });

            // Count MVP
            if (m.mvpId && stats[m.mvpId]) {
                stats[m.mvpId].mvps += 1;
            }

            m.subMatches?.forEach(sm => {
                if (sm.goals) {
                    Object.entries(sm.goals).forEach(([pid, count]) => {
                        if (stats[pid]) stats[pid].goals += (count as number);
                    });
                }
                if (sm.assists) {
                    Object.entries(sm.assists).forEach(([pid, count]) => {
                        if (stats[pid]) stats[pid].assists += (count as number);
                    });
                }
            });
        });

        return Object.entries(stats)
            .map(([id, s]) => {
                const player = players.find(p => p.id === id);
                if (!player) return null;
                return {
                    ...player,
                    ...s
                };
            })
            .filter((p): p is (Player & { matches: number; goals: number; assists: number; rating: number; mvps: number }) => {
                if (!p) return false;
                const term = searchTerm.toLowerCase();
                const matchesName = p.name.toLowerCase().includes(term);
                const matchesNickname = p.nickname && p.nickname.toLowerCase().includes(term);
                return matchesName || matchesNickname || false;
            })
            .sort((a, b) => {
                if (sortBy === 'matches') return b.matches - a.matches || b.goals - a.goals;
                if (sortBy === 'goals') return b.goals - a.goals || b.assists - a.assists;
                if (sortBy === 'assists') return b.assists - a.assists || b.goals - a.goals;
                if (sortBy === 'rating') return b.rating - a.rating || b.goals - a.goals;
                if (sortBy === 'mvps') return b.mvps - a.mvps || b.goals - a.goals;
                return 0;
            });
    }, [players, matches, startDate, endDate, sortBy, searchTerm]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Filters Card */}
            <Card className="p-6 border-b-4 border-b-brand-500 shadow-premium">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-navy-400 uppercase tracking-[0.2em] ml-1">Data Inicial</label>
                        <DateInput
                            value={startDate}
                            onChange={setStartDate}
                            className="w-full bg-navy-50/50 border-navy-100 hover:border-brand-300 focus:border-brand-500 transition-all rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-navy-400 uppercase tracking-[0.2em] ml-1">Data Final</label>
                        <DateInput
                            value={endDate}
                            onChange={setEndDate}
                            className="w-full bg-navy-50/50 border-navy-100 hover:border-brand-300 focus:border-brand-500 transition-all rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-navy-400 uppercase tracking-[0.2em] ml-1">Ordenar Por</label>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortBy)}
                                className="w-full bg-navy-50/50 border border-navy-100 rounded-xl px-4 py-3 text-navy-900 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 transition-all appearance-none cursor-pointer hover:bg-white"
                            >
                                <option value="goals">⚽ Gols</option>
                                <option value="assists">👟 Assistências</option>
                                <option value="matches">📅 Jogos</option>
                                <option value="mvps">🏆 Craque da Galera</option>
                                <option value="rating">⭐️ Habilidade</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-navy-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-navy-400 uppercase tracking-[0.2em] ml-1">Buscar</label>
                        <Input
                            placeholder="Nome ou apelido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-navy-50/50 border-navy-100 hover:border-brand-300 focus:border-brand-500 transition-all rounded-xl"
                            icon={
                                <svg className="h-4 w-4 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            }
                        />
                    </div>
                </div>
            </Card>

            {/* Podium Section - Grande Campeão */}
            {filteredStats.length > 0 && filteredStats[0].mvps > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="col-span-full p-8 bg-gradient-to-br from-brand-600 to-brand-800 text-white border-0 shadow-xl overflow-hidden relative">
                        <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                            <span className="text-[200px]">🏆</span>
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <div className="relative">
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-amber-400 text-navy-900 text-xl font-black rounded-full flex items-center justify-center border-4 border-white shadow-lg animate-bounce">
                                    1º
                                </div>
                                {filteredStats[0].avatar && !filteredStats[0].avatar.includes('ui-avatars.com') ? (
                                    <img src={filteredStats[0].avatar} alt={filteredStats[0].name} className="w-32 h-32 rounded-3xl object-cover border-4 border-white/20 shadow-2xl" />
                                ) : (
                                    <div className="w-32 h-32 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-4 border-white/20 shadow-2xl font-black text-5xl uppercase">
                                        {(filteredStats[0].nickname || filteredStats[0].name)[0]}
                                    </div>
                                )}
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className="text-3xl font-black mb-2 uppercase tracking-tight">O Grande Campeão 🏆</h3>
                                <p className="text-brand-100 text-lg mb-4 font-medium">O Craque da Galera do período selecionado!</p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/10">
                                        <p className="text-xs font-black text-brand-200 uppercase tracking-widest mb-1">Jogador</p>
                                        <p className="text-xl font-black">{filteredStats[0].nickname || filteredStats[0].name}</p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 border border-white/10">
                                        <p className="text-xs font-black text-brand-200 uppercase tracking-widest mb-1">Títulos de MVP</p>
                                        <p className="text-xl font-black">{filteredStats[0].mvps} vitórias</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStats.map((p, index) => {
                    const positionColorClass =
                        p.position === Position.GOLEIRO ? 'bg-red-500' :
                            p.position === Position.DEFENSOR ? 'bg-orange-500' :
                                p.position === Position.MEIO ? 'bg-blue-500' :
                                    'bg-green-500';

                    return (
                        <Card key={p.id} className="p-0 overflow-hidden hover:shadow-premium-hover transition-all group border-0 bg-white" hoverEffect>
                            <div className={cn("h-2 w-full transition-all group-hover:h-3", positionColorClass)}></div>
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="relative shrink-0">
                                        <div className="absolute -top-3 -left-3 w-8 h-8 bg-navy-950 text-white text-xs font-black rounded-full flex items-center justify-center border-4 border-white shadow-lg z-10">
                                            {index + 1}
                                        </div>
                                        {p.avatar && !p.avatar.includes('ui-avatars.com') ? (
                                            <img src={p.avatar} alt={p.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-navy-50 shadow-sm" />
                                        ) : (
                                            <div className={cn(
                                                "w-16 h-16 rounded-2xl flex items-center justify-center text-white border-2 border-navy-50 shadow-sm font-black text-2xl uppercase",
                                                p.isMonthlySubscriber ? "bg-green-500" :
                                                    p.isGuest ? "bg-orange-500" : "bg-blue-500"
                                            )}>
                                                {(p.nickname || p.name)[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-black text-navy-900 truncate text-xl leading-tight group-hover:text-brand-600 transition-colors">
                                            {p.nickname || p.name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                                p.position === Position.GOLEIRO ? "bg-red-50 text-red-600 border border-red-100" :
                                                    p.position === Position.DEFENSOR ? "bg-orange-50 text-orange-600 border border-orange-100" :
                                                        p.position === Position.MEIO ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                                            "bg-green-50 text-green-600 border border-green-100"
                                            )}>
                                                {p.position}
                                            </span>
                                            {p.isGuest && (
                                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-navy-50 text-navy-500 border border-navy-100">
                                                    Convidado
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex text-accent-400 text-xs mt-2">
                                            {'★'.repeat(Math.floor(p.rating || 0))}
                                            <span className="text-navy-100">{'★'.repeat(5 - Math.floor(p.rating || 0))}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col items-center p-3 rounded-2xl bg-navy-50/50 border border-navy-100/50 hover:bg-navy-50 transition-colors">
                                        <span className="text-xl font-black text-navy-900 leading-none">{p.matches}</span>
                                        <span className="text-[10px] uppercase font-black text-navy-400 tracking-tighter mt-1">Jogos</span>
                                    </div>
                                    <div className="flex flex-col items-center p-3 rounded-2xl bg-amber-50 border border-amber-100/50 hover:bg-amber-100/30 transition-colors">
                                        <span className="text-xl font-black text-amber-600 leading-none">{p.mvps}</span>
                                        <span className="text-[10px] uppercase font-black text-amber-500 tracking-tighter mt-1">MVP</span>
                                    </div>
                                    <div className="flex flex-col items-center p-3 rounded-2xl bg-brand-50 border border-brand-100/50 hover:bg-brand-100/30 transition-colors">
                                        <span className="text-xl font-black text-brand-600 leading-none">{p.goals}</span>
                                        <span className="text-[10px] uppercase font-black text-brand-400 tracking-tighter mt-1">Gols</span>
                                    </div>
                                    <div className="flex flex-col items-center p-3 rounded-2xl bg-blue-50 border border-blue-100/50 hover:bg-blue-100/30 transition-colors">
                                        <span className="text-xl font-black text-blue-600 leading-none">{p.assists}</span>
                                        <span className="text-[10px] uppercase font-black text-blue-400 tracking-tighter mt-1">Assits</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}

                {filteredStats.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-navy-100">
                        <div className="text-7xl mb-6 grayscale opacity-20">⚽️</div>
                        <h3 className="text-xl font-bold text-navy-900">Nenhuma estatística encontrada</h3>
                        <p className="text-navy-400 font-medium mt-1">Experimente ajustar os filtros de data ou busca.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
