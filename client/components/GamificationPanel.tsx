import React, { useState, useEffect } from 'react';
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
  first_match: '⚽',
  mvp_first: '🏆',
  mvp_5: '🌟',
  mvp_10: '👑',
  matches_10: '🎖️',
  matches_50: '🏅',
  matches_100: '💎',
  streak_5: '🔥',
  streak_10: '⚡',
  top_scorer_month: '🥇',
  perfect_attendance: '✅',
  group_founder: '🛡️',
};

const BADGE_LABELS_PT: Record<string, string> = {
  first_match: 'Primeiro jogo',
  mvp_first: 'Primeiro MVP',
  mvp_5: '5x MVP',
  mvp_10: '10x MVP',
  matches_10: '10 jogos disputados',
  matches_50: '50 jogos disputados',
  matches_100: '100 jogos disputados',
  streak_5: 'Sequência de 5 jogos seguidos',
  streak_10: 'Sequência de 10 jogos seguidos',
  top_scorer_month: 'Artilheiro do mês',
  perfect_attendance: 'Presença perfeita',
  group_founder: 'Fundador do grupo',
};

const LEVEL_TITLES = [
  'Iniciante', 'Amador', 'Regular', 'Titular', 'Destaque',
  'Profissional', 'Craque', 'Lenda', 'Imortal', 'Hall da Fama'
];

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
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
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

            {rankingMode === 'points' && (
              <div className="flex flex-wrap items-center gap-2">
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
          </div>

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
              {leaderboard.map((entry) => (
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
                      Nível {entry.level} - {LEVEL_TITLES[Math.min(entry.level, LEVEL_TITLES.length - 1)]}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-navy-500">
                    <span title="XP">{entry.xp} XP</span>
                    <span title="MVP">🏆 {entry.mvpCount}</span>
                    <span title="Conquistas">🎖️ {entry.totalBadges}</span>
                  </div>

                  <div className="w-20">
                    <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (entry.xp % 100))}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {leaderboard.length === 0 && (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(BADGE_ICONS).map(([key, icon]) => {
                const earned = achievements.some(a => a.badge === key);
                return (
                  <div key={key} className={cn(
                    'p-3 rounded-lg border text-center',
                    earned ? 'bg-brand-50 border-brand-200' : 'bg-navy-50 border-navy-100 opacity-50'
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
