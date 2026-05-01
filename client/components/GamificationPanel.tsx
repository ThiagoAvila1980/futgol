import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [xpSortBy, setXpSortBy] = useState<string>(XP_SORT_TOTAL);
  const [xpSortFilterExpanded, setXpSortFilterExpanded] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, [groupId, playerId]);

  useEffect(() => {
    if (tab === 'ranking' && rankingMode === 'points') {
      loadPointsRanking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rankingMode, groupId, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lb, ach] = await Promise.all([
        api.get(`/api/achievements/leaderboard?groupId=${groupId}`),
        playerId
          ? api.get(`/api/achievements?playerId=${playerId}&groupId=${groupId}`)
          : Promise.resolve([]),
      ]);
      setLeaderboard(lb);
      setAchievements(ach);
    } catch (error) {
      console.error('Gamification load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedXpLeaderboard = useMemo(() => {
    const list = [...leaderboard];
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
  }, [leaderboard, xpSortBy]);

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
    return <div className="text-center text-navy-500 py-8">Carregando ranking...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('ranking')}
          className={cn(
            'px-2 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'ranking' ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
          )}
        >
          🏆 Ranking
        </button>
        <button
          onClick={() => setTab('badges')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'badges' ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
          )}
        >
          🎖️ Conquistas
        </button>
        <button
          onClick={() => setTab('stats')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'stats' ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
          )}
        >
          📊 Estatísticas
        </button>
      </div>

      {tab === 'ranking' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setRankingMode('points')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  rankingMode === 'points' ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                )}
              >
                Pontos (Justo)
              </button>
              <button
                onClick={() => setRankingMode('xp')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  rankingMode === 'xp' ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                )}
              >
                XP (Conquistas)
              </button>
            </div>
          </div>

          {rankingMode === 'points' && (
            <Card className="p-0 overflow-hidden border-navy-200 shadow-sm mb-2">
              <button
                type="button"
                onClick={() => setFiltersExpanded((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-navy-50/90 hover:bg-navy-100/90 transition-colors',
                  filtersExpanded && 'border-b border-navy-100/80'
                )}
                aria-expanded={filtersExpanded}
              >
                <span className="font-bold text-sm text-navy-900 tracking-tight">Filtros</span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-navy-500 transition-transform duration-200',
                    filtersExpanded && 'rotate-180'
                  )}
                  aria-hidden
                />
              </button>
              {filtersExpanded && (
                <div className="px-4 py-4 flex flex-wrap items-center gap-4 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy-500">De</span>
                    <DateInput value={startDate} onChange={setStartDate} className="bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-navy-500">Até</span>
                    <DateInput value={endDate} onChange={setEndDate} className="bg-white border border-navy-200 rounded-xl px-3 py-2 text-xs" />
                  </div>
                </div>
              )}
            </Card>
          )}

          {rankingMode === 'points' ? (
            pointsLoading ? (
              <div className="text-center text-navy-500 py-8">Carregando pontos...</div>
            ) : (
              <>
                {pointsRanking.map((entry) => {
                  const p = players.find(pl => pl.id === entry.playerId);
                  const name = p?.nickname || p?.name || entry.playerId;
                  const avatar = (p as any)?.avatar || '';
                  return (
                    <Card key={entry.playerId} className={cn(
                      'p-3 flex items-center gap-3',
                      entry.rank <= 3 && 'border-l-4',
                      entry.rank === 1 && 'border-l-yellow-400 bg-yellow-50/50',
                      entry.rank === 2 && 'border-l-gray-400 bg-gray-50/50',
                      entry.rank === 3 && 'border-l-amber-700 bg-amber-50/30',
                    )}>
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                        entry.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                        entry.rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-navy-100 text-navy-600'
                      )}>
                        {entry.rank}
                      </div>

                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold overflow-hidden">
                        {avatar ? (
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          name.charAt(0)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-navy-900 text-sm truncate">
                          {name}
                        </div>
                        <div className="text-xs text-navy-500">
                          {entry.matchesAttended} presença(s) • {entry.goals} gol(s) • {entry.assists} assist.
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-navy-500">
                        <span className="font-bold text-navy-900">{entry.points} pts</span>
                        <span title="Presença">✅ {entry.matchesAttended}</span>
                        <span title="Gols">⚽ {entry.goals}</span>
                        <span title="Assistências">👟 {entry.assists}</span>
                      </div>
                    </Card>
                  );
                })}

                {pointsRanking.length === 0 && (
                  <div className="text-center text-navy-500 py-8">
                    Nenhum dado de pontuação no período.
                  </div>
                )}
              </>
            )
          ) : (
            <>
              <Card className="p-0 overflow-hidden border-navy-200 shadow-sm mb-2">
                <button
                  type="button"
                  onClick={() => setXpSortFilterExpanded((v) => !v)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-navy-50/90 hover:bg-navy-100/90 transition-colors',
                    xpSortFilterExpanded && 'border-b border-navy-100/80'
                  )}
                  aria-expanded={xpSortFilterExpanded}
                >
                  <span className="font-bold text-sm text-navy-900 tracking-tight">
                    Ordenar por conquista
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-navy-500 transition-transform duration-200',
                      xpSortFilterExpanded && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>
                {xpSortFilterExpanded && (
                  <div className="px-4 py-3 bg-white flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setXpSortBy(XP_SORT_TOTAL)}
                      className={cn(
                        'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors',
                        xpSortBy === XP_SORT_TOTAL
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-navy-700 border-navy-200 hover:bg-navy-50'
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
                          'inline-flex items-center gap-1 rounded-full pl-2 pr-2.5 py-1.5 text-xs font-medium border transition-colors max-w-[12rem]',
                          xpSortBy === badgeId
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-white text-navy-700 border-navy-200 hover:bg-navy-50'
                        )}
                      >
                        <span className="text-base shrink-0" aria-hidden>
                          {BADGE_ICONS[badgeId] ?? '🏅'}
                        </span>
                        <span className="truncate text-left leading-tight">
                          {BADGE_LABELS_PT[badgeId] ?? badgeId}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {sortedXpLeaderboard.map((entry, index) => {
                const rank = index + 1;
                const pjPts = entry.primeiroJogoPoints ?? entry.xpBreakdown?.fromPrimeiroJogo ?? 0;
                const earned = new Set(entry.earnedBadges ?? []);
                return (
                <Card
                  key={entry.playerId}
                  className={cn(
                    'p-3 flex flex-row gap-3 items-stretch',
                    rank <= 3 && 'border-l-4',
                    rank === 1 && 'border-l-yellow-400 bg-yellow-50/50',
                    rank === 2 && 'border-l-gray-400 bg-gray-50/50',
                    rank === 3 && 'border-l-amber-700 bg-amber-50/30',
                  )}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                        rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                        rank === 2 ? 'bg-gray-300 text-gray-700' :
                        rank === 3 ? 'bg-amber-600 text-white' :
                        'bg-navy-100 text-navy-600'
                      )}>
                        {rank}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold overflow-hidden shrink-0">
                        {entry.avatar ? (
                          <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (entry.nickname || entry.name).charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-navy-900 text-sm truncate">
                          {entry.nickname || entry.name}
                        </div>
                        <div className="text-xs text-navy-500">
                          Nível {entry.level} — {LEVEL_TITLES[Math.min(entry.level, LEVEL_TITLES.length - 1)]}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap gap-x-2 gap-y-3 justify-start"
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
                          <div
                            key={badgeId}
                            className="flex flex-col items-center gap-0.5 w-[2.75rem] shrink-0"
                          >
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-9 h-9 rounded-lg border text-lg leading-none transition-colors',
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
                                'text-[10px] font-semibold tabular-nums leading-none',
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

                  <div className="shrink-0 flex flex-col items-center justify-center self-center px-2 border-l border-navy-100/90 min-h-[4.5rem] min-w-[4.25rem]">
                    <span className="text-xl font-black tabular-nums text-navy-900 leading-none">
                      {entry.xp}
                    </span>
                    <span className="text-[10px] font-bold text-navy-500 uppercase tracking-wider mt-1">
                      XP
                    </span>
                  </div>
                </Card>
              );
              })}

              {sortedXpLeaderboard.length === 0 && (
                <div className="text-center text-navy-500 py-8">
                  Nenhum jogador no ranking ainda.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'badges' && (
        <div className="space-y-3">
          {achievements.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {achievements.map((ach) => (
                <Card key={ach.id} className="p-4 text-center">
                  <div className="text-3xl mb-2">{BADGE_ICONS[ach.badge] || '🏅'}</div>
                  <h4 className="font-bold text-navy-900 text-sm">{ach.title}</h4>
                  <p className="text-xs text-navy-500 mt-1">{ach.description}</p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    {new Date(ach.awarded_at).toLocaleDateString('pt-BR')}
                  </Badge>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-navy-500 py-8">
              <div className="text-4xl mb-3">🎯</div>
              <p className="font-medium">Nenhuma conquista ainda</p>
              <p className="text-sm mt-1">Continue jogando para desbloquear conquistas!</p>
            </div>
          )}

          <div className="mt-6">
            <h4 className="font-bold text-navy-900 mb-3">Conquistas Disponíveis</h4>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(BADGE_ICONS).map(([key, icon]) => {
                const earned = achievements.some(a => a.badge === key);
                return (
                  <div key={key} className={cn(
                    'p-3 rounded-lg border text-center',
                    earned ? 'bg-brand-50 border-brand-200' : 'bg-navy-50 border-navy-100'
                  )}>
                    <div className="text-2xl">{icon}</div>
                    <div className="text-[10px] font-medium mt-1 text-navy-600">
                      {BADGE_LABELS_PT[key] || key.replace(/_/g, ' ')}
                    </div>
                    {earned && <span className="text-[10px] text-brand-600 font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="mt-2">
          <StatsScreen
            players={players}
            matches={matches}
            activeGroup={activeGroup}
          />
        </div>
      )}
    </div>
  );
};
