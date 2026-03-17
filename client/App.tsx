
import React, { useState, useEffect, useRef } from 'react';
import { Player, Field, Match, ViewState, User, Group } from './types';
import { PlayerScreen } from './components/PlayerScreen';
import { FieldScreen } from './components/FieldScreen';
import { MatchScreen } from './components/MatchScreen';
import { LandingScreen } from './components/LandingScreen';
import { GroupsScreen } from './components/GroupsScreen';
import { OwnerDashboard } from './components/OwnerDashboard';
import { ProfileScreen } from './components/ProfileScreen';
import { FinancialScreen } from './components/FinancialScreen';
import { StatsScreen } from './components/StatsScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GamificationPanel } from './components/GamificationPanel';
import { WhatsAppShare } from './components/WhatsAppShare';
import { storage } from './services/storage';
import { authService } from './services/auth';
import { pushService } from './services/push';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Badge } from './components/ui/Badge';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/Avatar';
import { Separator } from './components/ui/Separator';
import { Preloader } from './components/Preloader';
import { cn } from './lib/utils';

import {
  LayoutGrid,
  Clock,
  BarChart3,
  Users,
  MapPin,
  DollarSign,
  Building2,
  ChevronDown,
  User as UserIcon,
  UsersRound,
  LogOut,
  Trophy,
  TrendingUp,
  CalendarDays,
  Lightbulb,
  ArrowRightLeft,
  BadgeCheck,
  ShoppingBag,
  Medal,
} from 'lucide-react';

const VIEW_KEY = 'futgol_last_view';
const ACTIVE_GROUP_KEY = 'futgol_active_group_id';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const desktopUserMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY) as ViewState | null;
      return (v as ViewState) || 'groups';
    } catch {
      return 'groups';
    }
  });
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const prevConfirmCountsRef = useRef<Record<string, number>>({});

  const isAdmin = !!(activeGroup && currentUser && (
    activeGroup.adminId === currentUser.id ||
    (Array.isArray(activeGroup.admins) && activeGroup.admins.includes(currentUser.id))
  ));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutsideDesktop = desktopUserMenuRef.current && !desktopUserMenuRef.current.contains(event.target as Node);
      const clickedOutsideMobile = mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(event.target as Node);
      if (showUserMenu && clickedOutsideDesktop && clickedOutsideMobile) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await authService.validateSession();
        setCurrentUser(user);
        if (user && pushService.isSupported()) {
          pushService.subscribe(user.id).catch(() => {});
        }
      } catch (err) {
        console.error("Falha na validação da sessão", err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, currentView);
    } catch { }
  }, [currentView]);

  useEffect(() => {
    if (activeGroup) {
      try {
        localStorage.setItem(ACTIVE_GROUP_KEY, activeGroup.id);
      } catch { }
    }
  }, [activeGroup]);

  useEffect(() => {
    if (currentUser && !activeGroup) {
      const initGroups = async () => {
        try {
          const userGroups = await storage.groups.getByUser(currentUser.id);
          const lastSavedId = (() => {
            try { return localStorage.getItem(ACTIVE_GROUP_KEY) || ''; } catch { return ''; }
          })();
          const lastSavedGroup = userGroups.find(g => g.id === lastSavedId);
          const chosen = lastSavedGroup || (userGroups.length === 1 ? userGroups[0] : null);

          if (chosen) {
            setActiveGroup(chosen);
            const savedView = (() => {
              try {
                const v = localStorage.getItem(VIEW_KEY);
                return (v !== 'groups') ? (v as ViewState) : 'dashboard';
              } catch { return 'dashboard'; }
            })();
            setCurrentView(savedView || 'dashboard');
          } else {
            if (currentUser.role === 'field_owner') {
              setCurrentView('owner_dashboard');
            } else {
              setCurrentView('groups');
            }
          }
        } catch (e) {
          const savedView = (() => {
            try { return localStorage.getItem(VIEW_KEY) as ViewState | null; } catch { return null; }
          })();
          setCurrentView(savedView || 'groups');
        }
      };
      initGroups();
    }
  }, [currentUser, activeGroup]);

  useEffect(() => {
    if (currentUser && activeGroup) {
      fetchGroupData();
    } else {
      setPlayers([]);
      setFields([]);
      setMatches([]);
    }
  }, [currentUser, activeGroup]);

  const fetchGroupData = async (silent = false) => {
    if (!activeGroup || !currentUser) return;
    if (!silent) setIsDataLoading(true);
    try {
      const [loadedPlayers, loadedFields, loadedMatches, userGroups] = await Promise.all([
        storage.players.getAll(activeGroup.id),
        storage.fields.getAll(activeGroup.id),
        storage.matches.getAll(activeGroup.id),
        storage.groups.getByUser(currentUser.id)
      ]);

      const updatedActive = userGroups.find(g => g.id === activeGroup.id);
      if (updatedActive) {
        const hasAdminsChanged = JSON.stringify(updatedActive.admins) !== JSON.stringify(activeGroup.admins);
        const hasRequestsChanged = JSON.stringify(updatedActive.pendingRequests) !== JSON.stringify(activeGroup.pendingRequests);
        const hasMembersChanged = JSON.stringify(updatedActive.members) !== JSON.stringify(activeGroup.members);
        const hasNameChanged = updatedActive.name !== activeGroup.name;
        const hasLogoChanged = updatedActive.logo !== activeGroup.logo;

        if (hasAdminsChanged || hasRequestsChanged || hasMembersChanged || hasNameChanged || hasLogoChanged) {
          setActiveGroup(updatedActive);
        }
      }

      setPlayers(loadedPlayers);
      setFields(loadedFields);
      setMatches(loadedMatches);

      const capacityForSport = (sport?: string) => {
        if (sport === 'Futebol de Campo') return 22;
        return 14;
      };

      const cap = capacityForSport(activeGroup.sport);
      const prev = prevConfirmCountsRef.current;

      loadedMatches.forEach(m => {
        const count = (m.confirmedPlayerIds || []).length;
        const prevCount = prev[m.id] ?? count;
        if (prevCount >= cap && count < cap) {
          const field = loadedFields.find(f => f.id === m.fieldId);
          const label = `${m.date} ${m.time || ''} ${field ? ' - ' + field.name : ''}`.trim();
          setNotifications(n => [`Vaga aberta no jogo ${label}`, ...n].slice(0, 5));
        }
        prev[m.id] = count;
      });
    } catch (error) {
      console.error("Erro ao carregar dados do grupo:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handlePersistPlayer = async (player: Player) => {
    if (!activeGroup) return;
    const playerWithGroup = { ...player, groupId: activeGroup.id };
    await storage.players.save(playerWithGroup);
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.id === player.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = playerWithGroup;
        return newArr;
      }
      return [...prev, playerWithGroup];
    });
  };

  const handleDeletePlayer = async (id: string) => {
    if (!activeGroup) return;
    const playerToRemove = players.find(p => p.id === id);

    if (playerToRemove) {
      const targetId = playerToRemove.userId || playerToRemove.id;
      await storage.groups.removeMember(activeGroup.id, targetId);
      setActiveGroup(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members ? prev.members.filter(mId => mId !== targetId) : []
        };
      });
    }
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handlePersistField = async (field: Field) => {
    if (!activeGroup) return;
    const fieldWithGroup = { ...field, groupId: activeGroup.id };
    await storage.fields.save(fieldWithGroup);
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === field.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = fieldWithGroup;
        return newArr;
      }
      return [...prev, fieldWithGroup];
    });
  };

  const handleDeleteField = async (id: string) => {
    await storage.fields.delete(id);
    setFields(prev => prev.filter(f => f.id !== id));
  };

  const handlePersistMatch = async (match: Match) => {
    if (!activeGroup) return;
    const matchWithGroup = { ...match, groupId: activeGroup.id };
    await storage.matches.save(matchWithGroup);
    setMatches(prev => {
      const idx = prev.findIndex(m => m.id === match.id);
      if (idx >= 0) {
        const newArr = [...prev];
        newArr[idx] = matchWithGroup;
        return newArr;
      }
      return [matchWithGroup, ...prev];
    });
  };

  const handleDeleteMatch = async (id: string) => {
    await storage.matches.cancel(id);
    setMatches(prev => prev.map(m => m.id === id ? { ...m, isCanceled: true } : m));
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("Error logging out", e);
    }

    setShowLogoutModal(false);
    setShowUserMenu(false);
    setPlayers([]);
    setMatches([]);
    setFields([]);
    setActiveGroup(null);
    setCurrentUser(null);
    setCurrentView('groups');
  };

  const handleGroupSelect = (group: Group) => {
    setActiveGroup(group);
    setCurrentView('dashboard');
  };

  const handleUpdateProfile = async (updatedUser: User) => {
    try {
      const savedUser = await authService.updateProfile(updatedUser);
      setCurrentUser(savedUser);
      await storage.players.updateByUserId(savedUser.id, savedUser);
      if (activeGroup) {
        await fetchGroupData();
        setCurrentView('dashboard');
      } else {
        setCurrentView('groups');
      }
    } catch (e) {
      console.error("Failed to update profile", e);
      throw e;
    }
  };

  const getTopScorer = () => {
    if (players.length === 0 || matches.length === 0) return null;
    const mvpCounts: Record<string, number> = {};
    matches.forEach(m => {
      if (m.finished && m.mvpId) {
        mvpCounts[m.mvpId] = (mvpCounts[m.mvpId] || 0) + 1;
      }
    });

    let topPlayerId = null;
    let maxMvps = 0;
    Object.entries(mvpCounts).forEach(([id, count]) => {
      if (count > maxMvps) {
        maxMvps = count;
        topPlayerId = id;
      }
    });
    if (!topPlayerId) return null;
    const player = players.find(p => p.id === topPlayerId);
    return player ? { ...player, mvpCount: maxMvps } : null;
  };

  const topPlayer = getTopScorer();

  const renderContent = () => {
    if (currentView === 'owner_dashboard' && currentUser) {
      return <OwnerDashboard user={currentUser} />;
    }

    if (currentView === 'profile') {
      return (
        <ProfileScreen
          user={currentUser!}
          onSave={handleUpdateProfile}
          onCancel={() => activeGroup ? setCurrentView('dashboard') : setCurrentView('groups')}
        />
      );
    }

    if (!activeGroup && currentView !== 'groups') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-navy-500">
          <p className="font-medium mb-3">Selecione um grupo para continuar.</p>
          <Button variant="outline" onClick={() => setCurrentView('groups')}>Ir para Meus Grupos</Button>
          {currentUser && currentUser.role === 'field_owner' && (
            <Button variant="ghost" onClick={() => setCurrentView('owner_dashboard')} className="mt-4 text-brand-600 font-bold border border-brand-100 bg-brand-50 hover:bg-brand-100">
              <Building2 className="h-4 w-4 mr-1" /> Painel do Dono
            </Button>
          )}
        </div>
      );
    }

    switch (currentView) {
      case 'groups':
        return <GroupsScreen user={currentUser!} onSelectGroup={handleGroupSelect} activeGroupId={activeGroup?.id} onUpdateUser={handleUpdateProfile} />;
      case 'players':
        return (
          <PlayerScreen
            players={players}
            matches={matches}
            onSave={handlePersistPlayer}
            onDelete={handleDeletePlayer}
            activeGroup={activeGroup!}
            currentUser={currentUser!}
            onRefresh={fetchGroupData}
          />
        );
      case 'fields':
        return (
          <FieldScreen
            fields={fields}
            onSave={handlePersistField}
            onDelete={handleDeleteField}
            activeGroupId={activeGroup!.id}
            currentUser={currentUser!}
            activeGroup={activeGroup!}
          />
        );
      case 'matches':
        return (
          <MatchScreen
            players={players}
            fields={fields}
            matches={matches}
            onSave={handlePersistMatch}
            onDelete={handleDeleteMatch}
            activeGroupId={activeGroup!.id}
            currentUser={currentUser!}
            activeGroup={activeGroup!}
            onRefresh={fetchGroupData}
            isLoading={isDataLoading}
          />
        );
      case 'financial':
        return (
          <FinancialScreen
            activeGroup={activeGroup!}
            players={players}
          />
        );
      case 'stats':
        return (
          <StatsScreen
            players={players}
            matches={matches}
            activeGroup={activeGroup!}
          />
        );
      case 'gamification':
        return (
          <ErrorBoundary>
            <GamificationPanel
              groupId={activeGroup!.id}
              playerId={currentUser?.id}
              players={players}
              matches={matches}
              activeGroup={activeGroup!}
            />
          </ErrorBoundary>
        );
      case 'dashboard':
      default:
        return (
          <div className="space-y-6 animate-fade-in">
            {/* Active Group Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-2xl border border-navy-800 group">
              {activeGroup?.logo ? (
                <div className="absolute inset-0 z-0">
                  <img src={activeGroup.logo} className="w-full h-full object-cover scale-110 blur-2xl opacity-30 transform group-hover:scale-125 transition-transform duration-1000" alt="" />
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
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest bg-white/10 text-white/70 border-white/5">
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
                    {notifications.length > 0 && (
                      <button onClick={() => setCurrentView('matches')} className="flex items-center gap-2 text-white text-xs font-bold bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 hover:bg-white/20 transition-all">
                        <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                        {notifications[0]}
                      </button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentView('groups')}
                      className="bg-navy-800/50 border-white/10 text-white hover:bg-navy-800 hover:border-white/30 rounded-xl px-5"
                      leftIcon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                    >
                      Trocar Grupo
                    </Button>
                    {activeGroup && (
                      <WhatsAppShare group={activeGroup} type="invite" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Matches Card */}
              <div
                onClick={() => setCurrentView('matches')}
                className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 rounded-2xl text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group"
              >
                <div className="relative z-10">
                  <h3 className="text-2xl font-heading font-bold">Próximos Jogos</h3>
                  <div className="mt-8 flex items-baseline gap-2">
                    <span className="text-6xl font-extrabold tracking-tighter">{matches.filter(m => !m.finished).length}</span>
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
              </div>

              {/* MVP / Stats Card */}
              {topPlayer ? (
                <div className="bg-gradient-to-br from-accent-400 to-accent-600 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-accent-50 flex items-center gap-2 mb-4">
                      <span className="bg-white/20 p-1 rounded"><Trophy className="h-4 w-4" /></span>
                      Estatísticas dos jogadores
                    </h3>
                    <div onClick={() => setCurrentView('stats')} className="flex items-center gap-4 cursor-pointer">
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center text-white border-2 border-white/40 font-black text-2xl shadow-lg",
                        topPlayer.isMonthlySubscriber ? "bg-green-500" :
                          topPlayer.isGuest ? "bg-orange-500" : "bg-blue-500"
                      )}>
                        {topPlayer.isMonthlySubscriber ? 'M' : topPlayer.isGuest ? 'C' : 'A'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-3xl font-heading font-bold truncate">{topPlayer.nickname || topPlayer.name}</div>
                        {topPlayer.nickname && topPlayer.nickname !== topPlayer.name && (
                          <div className="text-accent-100/70 text-xs font-medium truncate -mt-1 mb-1">{topPlayer.name}</div>
                        )}
                        <div className="text-accent-100 text-sm font-medium">
                          {topPlayer.mvpCount} vezes MVP
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
                </div>
              ) : (
                <div
                  onClick={() => setCurrentView('stats')}
                  className="bg-green-50 p-6 rounded-2xl shadow-premium border border-navy-100 cursor-pointer hover:border-accent-400 transition-colors group flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-lg font-heading font-bold text-navy-800 group-hover:text-accent-600 transition-colors">Estatísticas dos jogadores</h3>
                    <p className="mt-2 text-navy-500 text-sm leading-relaxed">Acompanhe gols, assistências e frequência da galera.</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <TrendingUp className="h-12 w-12 text-navy-300 opacity-50" />
                  </div>
                </div>
              )}

              {/* Admin / Financial Card */}
              {isAdmin && (
                <div
                  onClick={() => setCurrentView('financial')}
                  className="bg-yellow-50 p-6 rounded-2xl shadow-premium border border-navy-100 cursor-pointer hover:border-navy-300 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-heading font-bold text-navy-900">Financeiro</h3>
                      <Badge variant="secondary" className="text-[10px] font-bold">ADMIN</Badge>
                    </div>
                    <p className="text-navy-500 text-sm">Gerencie o caixa, mensalidades e pagamentos de forma simples.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-navy-300 text-xs">Visão geral do caixa</span>
                    <DollarSign className="h-10 w-10 text-navy-300 opacity-50" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-brand-50 rounded-xl p-4 border border-brand-100 flex items-start gap-3">
              <Lightbulb className="h-6 w-6 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-brand-900 text-sm">Dica Profissional</h4>
                <p className="text-brand-800 text-sm mt-1 leading-relaxed">
                  Ao finalizar uma partida, não esqueça de selecionar o <strong>Craque da Partida (MVP)</strong>.
                  Isso gera estatísticas automáticas para o seu grupo!
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  if (isAuthLoading) {
    return <Preloader fullScreen text="Carregando Futgol..." />;
  }

  if (!currentUser) {
    return <LandingScreen onLoginSuccess={setCurrentUser} />;
  }

  const viewTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Início', subtitle: `E ae ${currentUser.name.split(' ')[0]}! Tudo pronto para o jogo?` },
    players: { title: 'Jogadores', subtitle: 'Gestão profissional do grupo.' },
    groups: { title: 'Meus Grupos', subtitle: 'Gerencie seus times' },
    profile: { title: 'Minha Conta', subtitle: 'Atualize seus dados pessoais' },
    stats: { title: 'Estatísticas', subtitle: 'Gestão profissional do grupo.' },
    financial: { title: 'Financeiro', subtitle: 'Controle financeiro transparente' },
    fields: { title: 'Locais', subtitle: 'Gestão profissional do grupo.' },
    owner_dashboard: { title: 'Painel do Dono', subtitle: 'Gerencie suas quadras e agendamentos' },
    gamification: { title: 'Ranking & Conquistas', subtitle: 'Acompanhe seu progresso e conquistas' },
  };

  const currentViewMeta = viewTitles[currentView] || { title: '', subtitle: '' };

  return (
    <div className="h-screen bg-navy-50 flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar */}
      <nav className="flex-none bg-navy-950 text-white flex flex-col z-30 shadow-xl md:w-72">
        <div className="p-6 flex items-center justify-between gap-3 border-b border-navy-800">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => activeGroup && setCurrentView('dashboard')}>
            <div className="relative">
              <img
                src="/logo-premium.svg"
                alt="Futgol"
                className="w-10 h-10 rounded-xl bg-white/10 p-1 border border-white/10 group-hover:scale-105 transition-transform"
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-500 rounded-full border-2 border-navy-950" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold tracking-tight">Futgol</h1>
              <p className="text-[10px] text-navy-400 font-medium uppercase tracking-widest">Premium</p>
            </div>

            {activeGroup && (
              <div className="md:hidden ml-auto">
                <Badge variant="brand" className="text-[10px] font-bold tracking-wider gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  ATIVO
                </Badge>
              </div>
            )}
          </div>

          {activeGroup?.logo && (
            <div className="flex items-center justify-center animate-fade-in">
              <img
                src={activeGroup.logo}
                alt={activeGroup.name}
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover border border-white/20 shadow-xl"
              />
            </div>
          )}

          {/* Mobile Profile Icon */}
          <div className="md:hidden relative ml-auto" ref={mobileUserMenuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="focus:outline-none">
              <Avatar className="h-9 w-9 border-2 border-navy-700">
                <AvatarImage src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`} alt={currentUser.name} />
                <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </button>

            {showUserMenu && (
              <div className="absolute top-12 right-0 w-56 bg-white rounded-xl shadow-xl border border-navy-100 py-2 z-50 text-navy-900">
                <div className="px-4 py-3 border-b border-navy-50 bg-navy-50/50">
                  <p className="text-sm font-bold truncate">{currentUser.name}</p>
                  <p className="text-xs text-navy-500 truncate">{currentUser.email}</p>
                </div>
                <button onClick={() => { setCurrentView('profile'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-navy-400" /> Minha Conta
                </button>
                <button onClick={() => { setCurrentView('groups'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-navy-400" /> Meus Grupos
                </button>
                {currentUser.role === 'field_owner' && (
                  <button onClick={() => { setCurrentView('owner_dashboard'); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-navy-400" /> Painel do Dono
                  </button>
                )}
                <Separator className="my-1" />
                <button onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> SAIR
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Sidebar Navigation */}
        {(activeGroup || currentUser.role === 'field_owner') && (
          <div className="hidden md:flex md:flex-col p-4 gap-2 md:flex-1 overflow-y-auto">

            {currentUser.role === 'field_owner' && (
              <>
                <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-2">Área do Dono</div>
                <NavButton
                  active={currentView === 'owner_dashboard'}
                  onClick={() => setCurrentView('owner_dashboard')}
                  icon={<Building2 className="h-5 w-5" />}
                  label="Painel do Dono"
                />
              </>
            )}

            {activeGroup && (
              <>
                <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-4">Menu Principal</div>
                <NavButton active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<LayoutGrid className="h-5 w-5" />} label="Início" />
                <NavButton active={currentView === 'matches'} onClick={() => setCurrentView('matches')} icon={<Clock className="h-5 w-5" />} label="Jogos" />
                <NavButton active={currentView === 'players'} onClick={() => setCurrentView('players')} icon={<Users className="h-5 w-5" />} label="Membros" />
                <NavButton active={currentView === 'fields'} onClick={() => setCurrentView('fields')} icon={<MapPin className="h-5 w-5" />} label="Campos" />
                <NavButton active={currentView === 'gamification'} onClick={() => setCurrentView('gamification')} icon={<Medal className="h-5 w-5" />} label="Ranking" />

                {isAdmin && (
                  <>
                    <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-6">Administração</div>
                    <NavButton active={currentView === 'financial'} onClick={() => setCurrentView('financial')} icon={<DollarSign className="h-5 w-5" />} label="Financeiro" />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* User Footer (Desktop) */}
        <div className="mt-auto border-t border-navy-800 p-4 hidden md:block">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-navy-900 cursor-pointer transition-colors" onClick={() => setShowUserMenu(!showUserMenu)} ref={desktopUserMenuRef}>
            <Avatar className="h-10 w-10 border border-navy-600">
              <AvatarImage src={currentUser.avatar || `https://ui-avatars.com/api/?name=${currentUser.name}`} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-navy-400 font-medium truncate">
                {activeGroup && activeGroup.adminId === currentUser.id ? 'ADMINISTRADOR' : 'MEMBRO'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-navy-400" />
            {showUserMenu && (
              <div className="absolute bottom-20 left-4 w-60 bg-white rounded-xl shadow-2xl border border-navy-100 py-2 z-50 text-navy-900 animate-in slide-in-from-bottom-2 fade-in duration-200">
                <button onClick={() => setCurrentView('profile')} className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                  <UserIcon className="h-4 w-4 text-navy-400" /> Minha Conta
                </button>
                <button onClick={() => setCurrentView('groups')} className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                  <UsersRound className="h-4 w-4 text-navy-400" /> Meus Grupos
                </button>
                {currentUser.role === 'field_owner' && (
                  <button onClick={() => setCurrentView('owner_dashboard')} className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-navy-400" /> Painel do Dono
                  </button>
                )}
                <Separator className="my-1" />
                <button onClick={() => setShowLogoutModal(true)} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3">
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 p-4 md:p-8 overflow-y-auto bg-navy-50 relative ${(activeGroup || currentUser?.role === 'field_owner') ? 'pb-24 md:pb-8' : ''}`}>
        {isDataLoading && <Preloader overlay text="Sincronizando..." />}
        {currentView !== 'matches' && (
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-3xl font-heading font-bold text-navy-900 capitalize tracking-tight">
                {currentViewMeta.title}
              </h2>
              <p className="text-navy-500 text-sm mt-1 font-medium">
                {currentViewMeta.subtitle}
              </p>
            </div>
          </header>
        )}
        <ErrorBoundary>{renderContent()}</ErrorBoundary>
      </main>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-heading font-bold text-navy-900">Sair da Conta?</h3>
            <p className="text-navy-500 mt-2 mb-6 leading-relaxed">
              Você precisará fazer login novamente para acessar seus dados.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowLogoutModal(false)} className="flex-1">
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleLogout} className="flex-1">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Mobile Tab Bar */}
      {(activeGroup || currentUser.role === 'field_owner') && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navy-950/95 backdrop-blur-xl border-t border-navy-800 px-2 py-3 pb-6 z-40 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.3)]">
          {currentUser.role === 'field_owner' && (
            <TabButton active={currentView === 'owner_dashboard'} onClick={() => setCurrentView('owner_dashboard')} icon={<Building2 className="h-5 w-5" />} label="Dono" />
          )}

          {activeGroup && (
            <>
              <TabButton active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<LayoutGrid className="h-5 w-5" />} label="Início" />
              <TabButton active={currentView === 'matches'} onClick={() => setCurrentView('matches')} icon={<Clock className="h-5 w-5" />} label="Jogos" />
              <TabButton active={currentView === 'players'} onClick={() => setCurrentView('players')} icon={<Users className="h-5 w-5" />} label="Jogadores" />
              <TabButton active={currentView === 'fields'} onClick={() => setCurrentView('fields')} icon={<MapPin className="h-5 w-5" />} label="Campos" />
              {(isAdmin || activeGroup.adminId === currentUser.id) && (
                <TabButton active={currentView === 'financial'} onClick={() => setCurrentView('financial')} icon={<DollarSign className="h-5 w-5" />} label="Financeiro" />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center gap-1 transition-all duration-200 flex-1",
      active ? "text-white scale-110" : "text-white/60"
    )}
  >
    <div className={cn("p-1.5 rounded-lg transition-colors", active && "bg-white/10")}>
      {icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all duration-200 whitespace-nowrap font-medium text-sm",
      active
        ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
        : "text-navy-300 hover:bg-white/5 hover:text-white"
    )}
  >
    {icon}
    <span>{label}</span>
    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
  </button>
);

export default App;
