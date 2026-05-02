import React, { useState, useMemo } from 'react';
import { Player, Match, Position, Group } from '../types';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import DateInput from './DateInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

interface StatsScreenProps {
    players: Player[];
    matches: Match[];
    activeGroup: Group;
    /** Mesmo intervalo do ranking “Pontos (Justo)” nesta página */
    startDate: string;
    endDate: string;
    onStartDateChange: (v: string) => void;
    onEndDateChange: (v: string) => void;
}

type SortBy = 'matches' | 'goals' | 'assists' | 'rating' | 'mvps';

export const StatsScreen: React.FC<StatsScreenProps> = ({
    players,
    matches,
    activeGroup: _activeGroup,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
}) => {
    const [sortBy, setSortBy] = useState<SortBy | 'mvps'>('goals');
    const [searchTerm, setSearchTerm] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(false);

    const filteredStats = useMemo(() => {
        const stats: Record<string, { matches: number; goals: number; assists: number; rating: number; mvps: number }> = {};

        players.forEach(p => {
            stats[p.id] = { matches: 0, goals: 0, assists: 0, rating: p.rating || 0, mvps: 0 };
        });

        matches.forEach(m => {
            if (!m.finished) return;
            if (m.isCanceled) return;
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

            const snapshot = m.playerPoints && Object.keys(m.playerPoints).length > 0 ? m.playerPoints : null;
            if (snapshot) {
                Object.entries(snapshot).forEach(([pid, pp]) => {
                    if (!stats[pid]) return;
                    stats[pid].goals += Number(pp?.goals || 0) || 0;
                    stats[pid].assists += Number(pp?.assists || 0) || 0;
                });
            } else {
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
            }
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
        <div className="space-y-4 animate-fade-in pb-6">
            <Card className="overflow-hidden border-b-4 border-b-brand-500 border-navy-200 p-0 shadow-sm">
                <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 bg-navy-50/90 px-4 py-3 text-left transition-colors hover:bg-navy-100/90 data-[state=open]:border-b data-[state=open]:border-navy-100/80">
                        <span className="text-sm font-bold tracking-tight text-navy-900">Filtros</span>
                        <ChevronDown
                            className={cn(
                                'size-5 shrink-0 text-navy-500 transition-transform duration-200',
                                filtersExpanded && 'rotate-180'
                            )}
                            aria-hidden
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="bg-white p-6 pt-5">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="stats-start" className="ml-1">
                                        Data inicial
                                    </Label>
                                    <DateInput
                                        id="stats-start"
                                        value={startDate}
                                        onChange={onStartDateChange}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="stats-end" className="ml-1">
                                        Data final
                                    </Label>
                                    <DateInput
                                        id="stats-end"
                                        value={endDate}
                                        onChange={onEndDateChange}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="stats-sort" className="ml-1">
                                        Ordenar por
                                    </Label>
                                    <div className="relative">
                                        <select
                                            id="stats-sort"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                                            className="w-full cursor-pointer appearance-none rounded-xl border border-navy-100 bg-navy-50/50 px-4 py-3 font-bold text-navy-900 transition-all hover:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                                        >
                                            <option value="goals">⚽ Gols</option>
                                            <option value="assists">👟 Assistências</option>
                                            <option value="matches">📅 Jogos</option>
                                            <option value="mvps">🏆 Craque da Galera</option>
                                            <option value="rating">⭐️ Habilidade</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-navy-400">
                                            <ChevronDown className="size-4" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="stats-search" className="ml-1">
                                        Buscar
                                    </Label>
                                    <Input
                                        id="stats-search"
                                        placeholder="Nome ou apelido..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="border-navy-100 bg-navy-50/50 hover:border-brand-300 focus:border-brand-500"
                                        icon={<Search className="h-4 w-4 text-navy-300" />}
                                    />
                                </div>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </Card>

            {/* Podium Section - Grande Campeão */}
            {filteredStats.length > 0 && filteredStats[0].mvps > 0 && (
                <div className="grid grid-cols-1 gap-4">
                    <Card className="p-6 bg-gradient-to-br from-brand-600 to-brand-800 text-white border-0 shadow-xl overflow-hidden relative">
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

            {/* Lista em linha por jogador (estilo ranking) */}
            <div className="space-y-3">
                {filteredStats.map((p, index) => {
                    const positionColorClass =
                        p.position === Position.GOLEIRO ? 'bg-red-500' :
                            p.position === Position.DEFENSOR ? 'bg-orange-500' :
                                p.position === Position.MEIO ? 'bg-blue-500' :
                                    'bg-green-500';

                    const isTop3 = index < 3;

                    const displayTitle =
                        p.nickname?.trim() && p.nickname.trim() !== p.name.trim()
                            ? `${p.name} (${p.nickname.trim()})`
                            : p.name;

                    const statsRow = (
                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 text-[11px] font-black text-navy-700 w-full md:w-auto shrink-0">
                            <div className="flex flex-col items-center min-w-[42px] py-0.5">
                                <span className="text-sm leading-none tabular-nums">{p.matches}</span>
                                <span className="uppercase text-[9px] text-navy-400 mt-1">Jogos</span>
                            </div>
                            <div className="flex flex-col items-center min-w-[40px] py-0.5">
                                <span className="text-sm leading-none tabular-nums">{p.goals}</span>
                                <span className="uppercase text-[9px] text-navy-400 mt-1">Gols</span>
                            </div>
                            <div className="flex flex-col items-center min-w-[44px] py-0.5">
                                <span className="text-sm leading-none tabular-nums">{p.assists}</span>
                                <span className="uppercase text-[9px] text-navy-400 mt-1">Assist.</span>
                            </div>
                            <div className="flex flex-col items-center min-w-[44px] py-0.5">
                                <span className="text-sm leading-none tabular-nums">{(p.rating || 0).toFixed(1)}</span>
                                <span className="uppercase text-[9px] text-navy-400 mt-1">Nível</span>
                            </div>
                        </div>
                    );

                    return (
                        <Card
                            key={p.id}
                            className={cn(
                                'px-4 py-4 md:py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:shadow-premium-hover transition-all bg-white min-h-[5.25rem] md:min-h-0',
                                isTop3 && 'border-l-4 border-l-brand-500'
                            )}
                            hoverEffect
                        >
                            <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                                <div
                                    className={cn(
                                        'w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-black text-xs mt-0.5',
                                        isTop3 ? positionColorClass : 'bg-navy-100 text-navy-700'
                                    )}
                                >
                                    {index + 1}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <h4 className="font-black text-navy-900 text-sm leading-snug break-words">
                                        {displayTitle}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-1 text-[9px]">
                                        <span
                                            className={cn(
                                                'font-black uppercase tracking-widest px-1.5 py-0.5 rounded',
                                                p.position === Position.GOLEIRO
                                                    ? 'bg-red-50 text-red-600 border border-red-100'
                                                    : p.position === Position.DEFENSOR
                                                      ? 'bg-orange-50 text-orange-600 border border-orange-100'
                                                      : p.position === Position.MEIO
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                        : 'bg-green-50 text-green-600 border border-green-100'
                                            )}
                                        >
                                            {p.position}
                                        </span>
                                        {p.isGuest && (
                                            <span className="font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-navy-50 text-navy-500 border border-navy-100">
                                                Convidado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full border-t border-navy-100 pt-3 pl-12 md:w-auto md:shrink-0 md:border-t-0 md:pt-0">
                                {statsRow}
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
