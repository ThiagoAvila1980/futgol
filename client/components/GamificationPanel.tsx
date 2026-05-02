import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Label } from './ui/label';
import { Skeleton } from './ui/Skeleton';
import { Input } from './ui/Input';
import api from '../services/api';
import { cn } from '../lib/utils';
import { StatsScreen } from './StatsScreen';
import type { Player, Match, Group } from '../types';
import DateInput from './DateInput';

interface GamificationPanelProps {
  groupId: string;
  playerId?: string;
  players: Player[];
  matches: Match[];
  activeGroup: Group;
}

interface XpBreakdown {
  fromMatches: number;
  fromMvp: number;
  fromBadges: number;
  fromPrimeiroJogo: number;
}

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  name: string;
  nickname: string;
  position: string;
  rating: number;
  matchesPlayed: number;
  avatar: string;
  totalBadges: number;
  mvpCount: number;
  xp: number;
  level: number;
  /** Pontos “Primeiro jogo” (V=3, E=1, D=0 por sessão, somados no XP) */
  primeiroJogoPoints?: number;
  earnedBadges?: string[];
  xpBreakdown?: XpBreakdown;
}

interface Achievement {
  id: string;
  badge: string;
  title: string;
  description: string;
  awarded_at: string;
}

interface PointsRankingEntry {
  rank: number;
  playerId: string;
  points: number;
  goals: number;
  assists: number;
  matchesAttended: number;
  matchesCounted: number;
}

const BADGE_ICONS: Record<string, string> = {
  primeiro_jogo: '⚽',
  mvp_first: '🏆',
  mvp_5: '🌟',
  mvp_10: '👑',
  matches_10: '🎖️',
  matches_50: '🏅',
  matches_100: '💎',
  streak_5: '🔥',
  streak_10: '⚡',
  top_scorer_month: '🥇',
  top_scorer_year: '🎯',
  perfect_attendance: '✅',
};

const BADGE_LABELS_PT: Record<string, string> = {
  primeiro_jogo: 'Primeiro jogo',
  mvp_first: 'Primeiro MVP',
  mvp_5: '5x MVP',
  mvp_10: '10x MVP',
  matches_10: '10 jogos disputados',
  matches_50: '50 jogos disputados',
  matches_100: '100 jogos disputados',
  streak_5: 'Sequência de 5 jogos seguidos',
  streak_10: 'Sequência de 10 jogos seguidos',
  top_scorer_month: 'Artilheiro do mês',
  top_scorer_year: 'Artilheiro do ano',
  perfect_attendance: 'Presença perfeita',
};

const LEVEL_TITLES = [
  'Iniciante', 'Amador', 'Regular', 'Titular', 'Destaque',
  'Profissional', 'Craque', 'Lenda', 'Imortal', 'Hall da Fama'
];

/** Mesma ordem de inserção em BADGE_ICONS (igual à grelha "Conquistas Disponíveis"). */
const ALL_BADGE_IDS_ORDERED = Object.keys(BADGE_ICONS) as string[];

/** Valor de ordenação: XP agregado (mesmo critério do servidor). */
const XP_SORT_TOTAL = '__xp_total__';

/** XP desta conquista no cartão (15 por medalha; primeiro jogo = noites V/E/D + medalha). */
function xpContributionForBadge(entry: LeaderboardEntry, badgeId: string): number {
  const earned = new Set(entry.earnedBadges ?? []);
  const pj = entry.primeiroJogoPoints ?? entry.xpBreakdown?.fromPrimeiroJogo ?? 0;
  if (badgeId === 'primeiro_jogo') {
    return pj + (earned.has('primeiro_jogo') ? 15 : 0);
  }
  return earned.has(badgeId) ? 15 : 0;
}

export const GamificationPanel: React.FC<GamificationPanelProps> = ({
  groupId,
  playerId,
  players,
  matches,
  activeGroup,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [tab, setTab] = useState<'ranking' | 'badges' | 'stats'>('ranking');
  const [rankingMode, setRankingMode] = useState<'xp' | 'points'>('points');
  const [pointsRanking, setPointsRanking] = useState<PointsRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [xpLoading, setXpLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [xpSortBy, setXpSortBy] = useState<string>(XP_SORT_TOTAL);
  const [xpSortFilterExpanded, setXpSortFilterExpanded] = useState(false);
  const [xpPlayerSearch, setXpPlayerSearch] = useState('');

  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [xpStartDate, setXpStartDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [xpEndDate, setXpEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [groupId, playerId]);

  useEffect(() => {
    if (tab === 'ranking' && rankingMode === 'points') {
      loadPointsRanking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rankingMode, groupId, startDate, endDate]);

  useEffect(() => {
    if (tab !== 'ranking' || rankingMode !== 'xp') return;
    loadXpLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rankingMode, groupId, xpStartDate, xpEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const ach = playerId
        ? await api.get(`/api/achievements?playerId=${playerId}&groupId=${groupId}`)
        : [];
      setAchievements(ach);
    } catch (error) {
      console.error('Gamification load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadXpLeaderboard = async () => {
    setXpLoading(true);
    try {
      const qs = new URLSearchParams({
        groupId,
        startDate: xpStartDate,
        endDate: xpEndDate,
      });
      const lb = await api.get(`/api/achievements/leaderboard?${qs.toString()}`);
      setLeaderboard(lb);
    } catch (error) {
      console.error('XP leaderboard load error:', error);
      setLeaderboard([]);
    } finally {
      setXpLoading(false);
    }
  };

  const sortedXpLeaderboard = useMemo(() => {
    const q = xpPlayerSearch.trim().toLowerCase();
    let list = [...leaderboard];
    if (q) {
      list = list.filter((e) => {
        const n = (e.name || '').toLowerCase();
        const nk = (e.nickname || '').toLowerCase();
        return n.includes(q) || nk.includes(q);
      });
    }
    if (xpSortBy === XP_SORT_TOTAL) {
      list.sort((a, b) => b.xp - a.xp);
    } else {
      list.sort((a, b) => {
        const diff = xpContributionForBadge(b, xpSortBy) - xpContributionForBadge(a, xpSortBy);
        if (diff !== 0) return diff;
        return b.xp - a.xp;
      });
    }
    return list;
  }, [leaderboard, xpSortBy, xpPlayerSearch]);

  const loadPointsRanking = async () => {
    setPointsLoading(true);
    try {
      const data = await api.get(`/api/ranking/points?groupId=${encodeURIComponent(groupId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
      setPointsRanking((data?.ranking || []) as PointsRankingEntry[]);
    } catch (e) {
      console.error('Points ranking load error:', e);
      setPointsRanking([]);
    } finally {
      setPointsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <Skeleton className="h-10 w-full max-w-lg rounded-xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as 'ranking' | 'badges' | 'stats')}
      className="w-full"
    >
      <TabsList className="mb-1 h-auto min-h-10 w-full justify-start gap-1 sm:w-auto">
        <TabsTrigger value="ranking" className="gap-1.5 px-4">
          <span aria-hidden>🏆</span>
          Ranking
        </TabsTrigger>
        <TabsTrigger value="badges" className="gap-1.5 px-4">
          <span aria-hidden>🎖️</span>
          Conquistas
        </TabsTrigger>
        <TabsTrigger value="stats" className="gap-1.5 px-4">
          <span aria-hidden>📊</span>
          Estatísticas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ranking" className="mt-4 space-y-4">
        <Tabs
          value={rankingMode}
          onValueChange={(v) => setRankingMode(v as 'points' | 'xp')}
        >
          <TabsList className="h-auto min-h-10 w-full justify-start sm:w-auto">
            <TabsTrigger value="points">Pontos (Justo)</TabsTrigger>
            <TabsTrigger value="xp">XP (Conquistas)</TabsTrigger>
          </TabsList>

          <TabsContent value="points" className="mt-4 space-y-3">
            <Card className="overflow-hidden border-navy-200 p-0 shadow-sm">
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
                  <div className="flex flex-wrap items-end gap-4 bg-white px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rank-start" className="normal-case tracking-normal">
                        De
                      </Label>
                      <DateInput
                        id="rank-start"
                        value={startDate}
                        onChange={setStartDate}
                        className="min-w-[11rem]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rank-end" className="normal-case tracking-normal">
                        Até
                      </Label>
                      <DateInput
                        id="rank-end"
                        value={endDate}
                        onChange={setEndDate}
                        className="min-w-[11rem]"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {pointsLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {pointsRanking.map((entry) => {
                  const p = players.find((pl) => pl.id === entry.playerId);
                  const name = p?.nickname || p?.name || entry.playerId;
                  const avatar = (p as { avatar?: string })?.avatar || '';
                  return (
                    <Card
                      key={entry.playerId}
                      className={cn(
                        'flex items-center gap-3 p-3',
                        entry.rank <= 3 && 'border-l-4',
                        entry.rank === 1 && 'border-l-yellow-400 bg-yellow-50/50',
                        entry.rank === 2 && 'border-l-gray-400 bg-gray-50/50',
                        entry.rank === 3 && 'border-l-amber-700 bg-amber-50/30'
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          entry.rank === 1
                            ? 'bg-yellow-400 text-yellow-900'
                            : entry.rank === 2
                              ? 'bg-gray-300 text-gray-700'
                              : entry.rank === 3
                                ? 'bg-amber-600 text-white'
                                : 'bg-navy-100 text-navy-600'
                        )}
                      >
                        {entry.rank}
                      </div>

                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                        {avatar ? (
                          <img src={avatar} alt="" className="size-full object-cover" />
                        ) : (
                          name.charAt(0)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-navy-900">{name}</div>
                        <div className="text-xs text-navy-500">
                          {entry.matchesAttended} presença(s) • {entry.goals} gol(s) • {entry.assists}{' '}
                          assist.
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-xs text-navy-500">
                        <span className="font-bold text-navy-900">{entry.points} pts</span>
                        <span title="Presença">✅ {entry.matchesAttended}</span>
                        <span title="Gols">⚽ {entry.goals}</span>
                        <span title="Assistências">👟 {entry.assists}</span>
                      </div>
                    </Card>
                  );
                })}

                {pointsRanking.length === 0 && (
                  <p className="py-8 text-center text-navy-500">Nenhum dado de pontuação no período.</p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="xp" className="mt-4 space-y-3">
            <Card className="border-navy-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-navy-500">Filtros (somente XP)</p>
              <div className="mt-3 flex flex-col flex-wrap gap-4 lg:flex-row lg:items-end">
                <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
                  <Label htmlFor="xp-search" className="normal-case tracking-normal">
                    Buscar por nome ou apelido
                  </Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-400"
                      aria-hidden
                    />
                    <Input
                      id="xp-search"
                      type="search"
                      value={xpPlayerSearch}
                      onChange={(e) => setXpPlayerSearch(e.target.value)}
                      placeholder="Filtrar jogadores…"
                      autoComplete="off"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="xp-start" className="normal-case tracking-normal">
                      De
                    </Label>
                    <DateInput
                      id="xp-start"
                      value={xpStartDate}
                      onChange={setXpStartDate}
                      className="min-w-[11rem]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="xp-end" className="normal-case tracking-normal">
                      Até
                    </Label>
                    <DateInput
                      id="xp-end"
                      value={xpEndDate}
                      onChange={setXpEndDate}
                      className="min-w-[11rem]"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden border-navy-200 p-0 shadow-sm">
              <Collapsible open={xpSortFilterExpanded} onOpenChange={setXpSortFilterExpanded}>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 bg-navy-50/90 px-4 py-3 text-left transition-colors hover:bg-navy-100/90 data-[state=open]:border-b data-[state=open]:border-navy-100/80">
                  <span className="text-sm font-bold tracking-tight text-navy-900">Ordenar por conquista</span>
                  <ChevronDown
                    className={cn(
                      'size-5 shrink-0 text-navy-500 transition-transform duration-200',
                      xpSortFilterExpanded && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-wrap gap-2 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setXpSortBy(XP_SORT_TOTAL)}
                      className={cn(
                        'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                        xpSortBy === XP_SORT_TOTAL
                          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                          : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                      )}
                    >
                      XP total
                    </button>
                    {ALL_BADGE_IDS_ORDERED.map((badgeId) => (
                      <button
                        key={badgeId}
                        type="button"
                        onClick={() => setXpSortBy(badgeId)}
                        title={BADGE_LABELS_PT[badgeId] ?? badgeId}
                        className={cn(
                          'inline-flex max-w-[12rem] items-center gap-1 rounded-full border py-1.5 pl-2 pr-2.5 text-xs font-medium transition-colors',
                          xpSortBy === badgeId
                            ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                            : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                        )}
                      >
                        <span className="shrink-0 text-base" aria-hidden>
                          {BADGE_ICONS[badgeId] ?? '🏅'}
                        </span>
                        <span className="truncate text-left leading-tight">
                          {BADGE_LABELS_PT[badgeId] ?? badgeId}
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {xpLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {sortedXpLeaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const pjPts = entry.primeiroJogoPoints ?? entry.xpBreakdown?.fromPrimeiroJogo ?? 0;
                  const earned = new Set(entry.earnedBadges ?? []);
                  return (
                    <Card
                      key={entry.playerId}
                      className={cn(
                        'flex flex-row items-stretch gap-3 p-3',
                        rank <= 3 && 'border-l-4',
                        rank === 1 && 'border-l-yellow-400 bg-yellow-50/50',
                        rank === 2 && 'border-l-gray-400 bg-gray-50/50',
                        rank === 3 && 'border-l-amber-700 bg-amber-50/30'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                              rank === 1
                                ? 'bg-yellow-400 text-yellow-900'
                                : rank === 2
                                  ? 'bg-gray-300 text-gray-700'
                                  : rank === 3
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-navy-100 text-navy-600'
                            )}
                          >
                            {rank}
                          </div>
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                            {entry.avatar ? (
                              <img src={entry.avatar} alt="" className="size-full object-cover" />
                            ) : (
                              (entry.nickname || entry.name).charAt(0)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-navy-900">
                              {entry.nickname || entry.name}
                            </div>
                            <div className="text-xs text-navy-500">
                              Nível {entry.level} —{' '}
                              {LEVEL_TITLES[Math.min(entry.level, LEVEL_TITLES.length - 1)]}
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex flex-wrap justify-start gap-x-2 gap-y-3"
                          title="Ícone colorido quando há XP dessa conquista; número = pontos (15 por medalha; 1º jogo inclui noites V/E/D + medalha obtida)"
                        >
                          {ALL_BADGE_IDS_ORDERED.map((badgeId) => {
                            const has = earned.has(badgeId);
                            const ptsBelow =
                              badgeId === 'primeiro_jogo'
                                ? pjPts + (has ? 15 : 0)
                                : has
                                  ? 15
                                  : 0;
                            const hasPoints = ptsBelow > 0;
                            return (
                              <div key={badgeId} className="flex w-[2.75rem] shrink-0 flex-col items-center gap-0.5">
                                <span
                                  className={cn(
                                    'inline-flex size-9 items-center justify-center rounded-lg border text-lg leading-none transition-colors',
                                    hasPoints
                                      ? 'border-brand-300 bg-brand-50/90 opacity-100'
                                      : 'border-navy-100 bg-navy-50/80 opacity-45 grayscale'
                                  )}
                                  title={`${BADGE_LABELS_PT[badgeId] ?? badgeId}${
                                    hasPoints ? ` — ${ptsBelow} XP` : ' — sem pontos ainda'
                                  }`}
                                >
                                  {BADGE_ICONS[badgeId] ?? '🏅'}
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px] font-semibold leading-none tabular-nums',
                                    hasPoints ? 'text-brand-700' : 'text-navy-400'
                                  )}
                                >
                                  {ptsBelow}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex min-h-[4.5rem] min-w-[4.25rem] shrink-0 flex-col items-center justify-center self-center border-l border-navy-100/90 px-2">
                        <span className="text-xl font-black leading-none tabular-nums text-navy-900">
                          {entry.xp}
                        </span>
                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-navy-500">
                          XP
                        </span>
                      </div>
                    </Card>
                  );
                })}

                {sortedXpLeaderboard.length === 0 && (
                  <p className="py-8 text-center text-navy-500">
                    {leaderboard.length === 0
                      ? 'Nenhum jogador no ranking neste período.'
                      : 'Nenhum jogador corresponde à busca.'}
                  </p>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </TabsContent>

      <TabsContent value="badges" className="mt-4 space-y-6">
        {achievements.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {achievements.map((ach) => (
              <Card key={ach.id} className="p-4 text-center">
                <div className="mb-2 text-3xl">{BADGE_ICONS[ach.badge] || '🏅'}</div>
                <h4 className="text-sm font-bold text-navy-900">{ach.title}</h4>
                <p className="mt-1 text-xs text-navy-500">{ach.description}</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">
                  {new Date(ach.awarded_at).toLocaleDateString('pt-BR')}
                </Badge>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-navy-500">
            <div className="mb-3 text-4xl">🎯</div>
            <p className="font-medium">Nenhuma conquista ainda</p>
            <p className="mt-1 text-sm">Continue jogando para desbloquear conquistas!</p>
          </div>
        )}

        <div>
          <h4 className="mb-3 font-bold text-navy-900">Conquistas disponíveis</h4>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {Object.entries(BADGE_ICONS).map(([key, icon]) => {
              const earned = achievements.some((a) => a.badge === key);
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-lg border p-3 text-center',
                    earned ? 'border-brand-200 bg-brand-50' : 'border-navy-100 bg-navy-50'
                  )}
                >
                  <div className="text-2xl">{icon}</div>
                  <div className="mt-1 text-[10px] font-medium text-navy-600">
                    {BADGE_LABELS_PT[key] || key.replace(/_/g, ' ')}
                  </div>
                  {earned && <span className="text-[10px] font-bold text-brand-600">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="stats" className="mt-4">
        <StatsScreen
          players={players}
          matches={matches}
          activeGroup={activeGroup}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </TabsContent>
    </Tabs>
  );
};
