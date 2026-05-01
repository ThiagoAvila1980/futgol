import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import type { Group, User } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/Avatar';
import { Separator } from '../components/ui/Separator';
import { DataSyncOverlay } from '../components/LoadingShells';
import { cn } from '../lib/utils';
import { authService } from '../services/auth';
import { queryClient } from '../query-client';
import { queryKeys } from '../query-keys';
import {
  LayoutGrid,
  Clock,
  Users,
  MapPin,
  DollarSign,
  Building2,
  ChevronDown,
  User as UserIcon,
  UsersRound,
  LogOut,
  Medal,
} from 'lucide-react';

export type ChromeHeader = { title: string; subtitle: string };

export type AuthenticatedChromeProps = {
  user: User;
  groupId?: string;
  activeGroup: Group | null;
  header: ChromeHeader;
  isDataLoading?: boolean;
  children: React.ReactNode;
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex flex-col items-center justify-center gap-1 transition-all duration-200 flex-1',
      active ? 'text-white scale-110' : 'text-white/60',
    )}
  >
    <div className={cn('p-1.5 rounded-lg transition-colors', active && 'bg-white/10')}>{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all duration-200 whitespace-nowrap font-medium text-sm',
      active
        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
        : 'text-navy-300 hover:bg-white/5 hover:text-white',
    )}
  >
    {icon}
    <span>{label}</span>
    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
  </button>
);

export const AuthenticatedChrome: React.FC<AuthenticatedChromeProps> = ({
  user,
  groupId,
  activeGroup,
  header,
  isDataLoading,
  children,
}) => {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const desktopUserMenuRef = useRef<HTMLDivElement>(null);
  const mobileUserMenuRef = useRef<HTMLDivElement>(null);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideHeader = groupId ? pathname.endsWith(`/g/${groupId}/matches`) : false;

  const isAdmin = !!(
    activeGroup &&
    user &&
    (activeGroup.adminId === user.id || (Array.isArray(activeGroup.admins) && activeGroup.admins.includes(user.id)))
  );

  const pathActive = (suffix: string) => groupId && pathname === `/g/${groupId}/${suffix}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutsideDesktop =
        desktopUserMenuRef.current && !desktopUserMenuRef.current.contains(event.target as Node);
      const clickedOutsideMobile =
        mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(event.target as Node);
      if (showUserMenu && clickedOutsideDesktop && clickedOutsideMobile) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error('Error logging out', e);
    }
    queryClient.setQueryData(queryKeys.me, null);
    setShowLogoutModal(false);
    setShowUserMenu(false);
    navigate({ to: '/' });
  };

  return (
    <div className="h-screen bg-navy-50 flex flex-col md:flex-row overflow-hidden font-sans">
      <nav className="flex-none bg-navy-950 text-white flex flex-col z-30 shadow-xl md:w-72">
        <div className="p-6 flex items-center justify-between gap-3 border-b border-navy-800">
          <Link
            {...(groupId
              ? { to: '/g/$groupId/dashboard' as const, params: { groupId } }
              : { to: '/groups' as const })}
            className="flex items-center gap-3 cursor-pointer group"
          >
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
          </Link>

          {activeGroup?.logo && (
            <div className="flex items-center justify-center animate-fade-in">
              <img
                src={activeGroup.logo}
                alt={activeGroup.name}
                className="w-9 h-9 md:w-10 md:h-10 rounded-xl object-cover border border-white/20 shadow-xl"
              />
            </div>
          )}

          <div className="md:hidden relative ml-auto" ref={mobileUserMenuRef}>
            <button type="button" onClick={() => setShowUserMenu(!showUserMenu)} className="focus:outline-none">
              <Avatar className="h-9 w-9 border-2 border-navy-700">
                <AvatarImage src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </button>

            {showUserMenu && (
              <div className="absolute top-12 right-0 w-56 bg-white rounded-xl shadow-xl border border-navy-100 py-2 z-50 text-navy-900">
                <div className="px-4 py-3 border-b border-navy-50 bg-navy-50/50">
                  <p className="text-sm font-bold truncate">{user.name}</p>
                  <p className="text-xs text-navy-500 truncate">{user.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4 text-navy-400" /> Minha Conta
                </Link>
                <Link
                  to="/groups"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2"
                >
                  <UsersRound className="h-4 w-4 text-navy-400" /> Meus Grupos
                </Link>
                {user.role === 'field_owner' && (
                  <Link
                    to="/owner"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-navy-50 flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4 text-navy-400" /> Painel do Dono
                  </Link>
                )}
                <Separator className="my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(true);
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> SAIR
                </button>
              </div>
            )}
          </div>
        </div>

        {(activeGroup || user.role === 'field_owner') && (
          <div className="hidden md:flex md:flex-col p-4 gap-2 md:flex-1 overflow-y-auto">
            {user.role === 'field_owner' && (
              <>
                <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-2">Área do Dono</div>
                <NavButton
                  active={pathname === '/owner'}
                  onClick={() => navigate({ to: '/owner' })}
                  icon={<Building2 className="h-5 w-5" />}
                  label="Painel do Dono"
                />
              </>
            )}

            {groupId && activeGroup && (
              <>
                <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-4">Menu Principal</div>
                <NavButton
                  active={!!pathActive('dashboard')}
                  onClick={() => navigate({ to: '/g/$groupId/dashboard', params: { groupId } })}
                  icon={<LayoutGrid className="h-5 w-5" />}
                  label="Início"
                />
                <NavButton
                  active={!!pathActive('matches')}
                  onClick={() => navigate({ to: '/g/$groupId/matches', params: { groupId } })}
                  icon={<Clock className="h-5 w-5" />}
                  label="Jogos"
                />
                <NavButton
                  active={!!pathActive('players')}
                  onClick={() => navigate({ to: '/g/$groupId/players', params: { groupId } })}
                  icon={<Users className="h-5 w-5" />}
                  label="Membros"
                />
                <NavButton
                  active={!!pathActive('fields')}
                  onClick={() => navigate({ to: '/g/$groupId/fields', params: { groupId } })}
                  icon={<MapPin className="h-5 w-5" />}
                  label="Campos"
                />
                <NavButton
                  active={!!pathActive('gamification')}
                  onClick={() => navigate({ to: '/g/$groupId/gamification', params: { groupId } })}
                  icon={<Medal className="h-5 w-5" />}
                  label="Ranking"
                />

                {isAdmin && (
                  <>
                    <div className="text-xs font-bold text-navy-500 uppercase tracking-wider px-4 mb-2 mt-6">Administração</div>
                    <NavButton
                      active={!!pathActive('financial')}
                      onClick={() => navigate({ to: '/g/$groupId/financial', params: { groupId } })}
                      icon={<DollarSign className="h-5 w-5" />}
                      label="Financeiro"
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-auto border-t border-navy-800 p-4 hidden md:block">
          <div
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-navy-900 cursor-pointer transition-colors"
            onClick={() => setShowUserMenu(!showUserMenu)}
            onKeyDown={(e) => e.key === 'Enter' && setShowUserMenu(!showUserMenu)}
            role="button"
            tabIndex={0}
            ref={desktopUserMenuRef}
          >
            <Avatar className="h-10 w-10 border border-navy-600">
              <AvatarImage src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}`} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-navy-400 font-medium truncate">
                {activeGroup && activeGroup.adminId === user.id ? 'ADMINISTRADOR' : 'MEMBRO'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-navy-400" />
            {showUserMenu && (
              <div className="absolute bottom-20 left-4 w-60 bg-white rounded-xl shadow-2xl border border-navy-100 py-2 z-50 text-navy-900 animate-in slide-in-from-bottom-2 fade-in duration-200">
                <Link to="/profile" className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                  <UserIcon className="h-4 w-4 text-navy-400" /> Minha Conta
                </Link>
                <Link to="/groups" className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                  <UsersRound className="h-4 w-4 text-navy-400" /> Meus Grupos
                </Link>
                {user.role === 'field_owner' && (
                  <Link to="/owner" className="w-full text-left px-4 py-3 text-sm hover:bg-navy-50 flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-navy-400" /> Painel do Dono
                  </Link>
                )}
                <Separator className="my-1" />
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                >
                  <LogOut className="h-4 w-4" /> Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main
        className={`flex-1 p-4 md:p-8 overflow-y-auto bg-navy-50 relative ${activeGroup || user.role === 'field_owner' ? 'pb-24 md:pb-8' : ''}`}
      >
        {isDataLoading && <DataSyncOverlay />}
        {!hideHeader && (
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-3xl font-heading font-bold text-navy-900 capitalize tracking-tight">{header.title}</h2>
              <p className="text-navy-500 text-sm mt-1 font-medium">{header.subtitle}</p>
            </div>
          </header>
        )}
        {children}
      </main>

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
              <Button variant="danger" onClick={() => void handleLogout()} className="flex-1">
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </Card>
        </div>
      )}

      {(activeGroup || user.role === 'field_owner') && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-navy-950/95 backdrop-blur-xl border-t border-navy-800 px-2 py-3 pb-6 z-40 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.3)]">
          {user.role === 'field_owner' && (
            <TabButton active={pathname === '/owner'} onClick={() => navigate({ to: '/owner' })} icon={<Building2 className="h-5 w-5" />} label="Dono" />
          )}

          {groupId && activeGroup && (
            <>
              <TabButton
                active={!!pathActive('dashboard')}
                onClick={() => navigate({ to: '/g/$groupId/dashboard', params: { groupId } })}
                icon={<LayoutGrid className="h-5 w-5" />}
                label="Início"
              />
              <TabButton
                active={!!pathActive('matches')}
                onClick={() => navigate({ to: '/g/$groupId/matches', params: { groupId } })}
                icon={<Clock className="h-5 w-5" />}
                label="Jogos"
              />
              <TabButton
                active={!!pathActive('players')}
                onClick={() => navigate({ to: '/g/$groupId/players', params: { groupId } })}
                icon={<Users className="h-5 w-5" />}
                label="Jogadores"
              />
              <TabButton
                active={!!pathActive('fields')}
                onClick={() => navigate({ to: '/g/$groupId/fields', params: { groupId } })}
                icon={<MapPin className="h-5 w-5" />}
                label="Campos"
              />
              <TabButton
                active={!!pathActive('gamification')}
                onClick={() => navigate({ to: '/g/$groupId/gamification', params: { groupId } })}
                icon={<Medal className="h-5 w-5" />}
                label="Ranking"
              />
              {(isAdmin || activeGroup.adminId === user.id) && (
                <TabButton
                  active={!!pathActive('financial')}
                  onClick={() => navigate({ to: '/g/$groupId/financial', params: { groupId } })}
                  icon={<DollarSign className="h-5 w-5" />}
                  label="Financeiro"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
