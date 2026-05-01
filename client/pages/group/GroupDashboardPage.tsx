import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  DollarSign,
  Lightbulb,
  MapPin,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { WhatsAppShare } from '../../components/WhatsAppShare';
import { cn } from '../../lib/utils';
import { useGroupWorkspace } from '../../context/GroupWorkspaceContext';

export const GroupDashboardPage: React.FC = () => {
  const { activeGroup, groupId, matches, players, currentUser } = useGroupWorkspace();

  const isAdmin = !!(
    activeGroup &&
    currentUser &&
    (activeGroup.adminId === currentUser.id ||
      (Array.isArray(activeGroup.admins) && activeGroup.admins.includes(currentUser.id)))
  );

  const getTopScorer = () => {
    if (players.length === 0 || matches.length === 0) return null;
    const mvpCounts: Record<string, number> = {};
    matches.forEach((m) => {
      if (m.finished && m.mvpId) {
        mvpCounts[m.mvpId] = (mvpCounts[m.mvpId] || 0) + 1;
      }
    });
    let topPlayerId: string | null = null;
    let maxMvps = 0;
    Object.entries(mvpCounts).forEach(([id, count]) => {
      if (count > maxMvps) {
        maxMvps = count;
        topPlayerId = id;
      }
    });
    if (!topPlayerId) return null;
    const player = players.find((p) => p.id === topPlayerId);
    return player ? { ...player, mvpCount: maxMvps } : null;
  };

  const topPlayer = getTopScorer();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-2xl border border-navy-800 group">
        {activeGroup?.logo ? (
          <div className="absolute inset-0 z-0">
            <img
              src={activeGroup.logo}
              className="w-full h-full object-cover scale-110 blur-2xl opacity-30 transform group-hover:scale-125 transition-transform duration-1000"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/80 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 to-navy-950" />
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-6 p-6 md:p-8">
          <div className="relative shrink-0">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl transform transition-transform group-hover:scale-105 duration-500">
              {activeGroup?.logo ? (
                <img src={activeGroup.logo} alt={activeGroup.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-600 flex items-center justify-center text-5xl">⚽</div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-brand-500 text-white p-1.5 rounded-lg shadow-lg">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center text-center md:text-left min-w-0">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mb-2">
              <Badge variant="brand" className="text-[10px] font-black uppercase tracking-[0.2em]">
                Grupo Ativo
              </Badge>
              <Badge
                variant="secondary"
                className="text-[10px] font-bold uppercase tracking-widest bg-white/10 text-white/70 border-white/5"
              >
                {activeGroup?.sport}
              </Badge>
            </div>
            <h3 className="text-3xl md:text-4xl font-heading font-black text-white truncate mb-1 leading-tight">
              {activeGroup?.name}
            </h3>
            {activeGroup?.city && (
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-navy-200 text-sm font-medium">
                <MapPin className="h-4 w-4 text-brand-400" />
                {activeGroup.city}
              </div>
            )}
          </div>

          <div className="flex flex-col flex-wrap justify-center gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="bg-navy-800/50 border-white/10 text-white hover:bg-navy-800 hover:border-white/30 rounded-xl px-5"
              >
                <Link to="/groups">
                  <span className="inline-flex items-center gap-2">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Trocar Grupo
                  </span>
                </Link>
              </Button>
              {activeGroup && <WhatsAppShare group={activeGroup} type="invite" />}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/g/$groupId/matches"
          params={{ groupId }}
          className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 rounded-2xl text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group block"
        >
          <div className="relative z-10">
            <h3 className="text-2xl font-heading font-bold">Próximos Jogos</h3>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="text-6xl font-extrabold tracking-tighter">{matches.filter((m) => !m.finished).length}</span>
              <div className="flex flex-col">
                <span className="text-brand-100 text-sm font-semibold uppercase tracking-wider">Jogos</span>
                <span className="text-brand-200 text-xs">agendados</span>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
          <div className="absolute top-4 right-4 opacity-20 transform rotate-12">
            <CalendarDays className="h-12 w-12" />
          </div>
        </Link>

        {topPlayer ? (
          <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-accent-50 flex items-center gap-2 mb-4">
                <span className="bg-white/20 p-1 rounded">
                  <Trophy className="h-4 w-4" />
                </span>
                Craque da galera
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center text-white border-2 border-white/40 font-black text-2xl shadow-lg',
                    topPlayer.isMonthlySubscriber ? 'bg-green-500' : topPlayer.isGuest ? 'bg-orange-500' : 'bg-blue-500',
                  )}
                >
                  {topPlayer.isMonthlySubscriber ? 'M' : topPlayer.isGuest ? 'C' : 'A'}
                </div>
                <div className="min-w-0">
                  <div className="text-3xl font-heading font-bold truncate">{topPlayer.nickname || topPlayer.name}</div>
                  {topPlayer.nickname && topPlayer.nickname !== topPlayer.name && (
                    <div className="text-accent-100/70 text-xs font-medium truncate -mt-1 mb-1">{topPlayer.name}</div>
                  )}
                  <div className="text-accent-100 text-sm font-medium">{topPlayer.mvpCount} vezes MVP</div>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
          </div>
        ) : (
          <div className="bg-green-50 p-6 rounded-2xl shadow-premium border border-navy-100 group flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-heading font-bold text-navy-800 group-hover:text-accent-600 transition-colors">
                Estatísticas dos jogadores
              </h3>
              <p className="mt-2 text-navy-500 text-sm leading-relaxed">
                Acompanhe gols, assistências e frequência da galera.
              </p>
            </div>
            <div className="flex justify-end mt-4">
              <TrendingUp className="h-12 w-12 text-navy-300 opacity-50" />
            </div>
          </div>
        )}

        {isAdmin && (
          <Link
            to="/g/$groupId/financial"
            params={{ groupId }}
            className="bg-yellow-50 p-6 rounded-2xl shadow-premium border border-navy-100 cursor-pointer hover:border-navy-300 transition-all group flex flex-col justify-between block"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-heading font-bold text-navy-900">Financeiro</h3>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  ADMIN
                </Badge>
              </div>
              <p className="text-navy-500 text-sm">Gerencie o caixa, mensalidades e pagamentos de forma simples.</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-navy-300 text-xs">Visão geral do caixa</span>
              <DollarSign className="h-10 w-10 text-navy-300 opacity-50" />
            </div>
          </Link>
        )}
      </div>

      <div className="bg-brand-50 rounded-xl p-4 border border-brand-100 flex items-start gap-3">
        <Lightbulb className="h-6 w-6 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-brand-900 text-sm">Dica Profissional</h4>
          <p className="text-brand-800 text-sm mt-1 leading-relaxed">
            Ao finalizar uma partida, não esqueça de selecionar o <strong>Craque da Partida (MVP)</strong>. Isso gera
            estatísticas automáticas para o seu grupo!
          </p>
        </div>
      </div>
    </div>
  );
};
