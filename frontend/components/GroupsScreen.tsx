import React, { useState, useEffect } from 'react';
import DateInput from './DateInput';
import { User, Group, Player, Position } from '../types';
import { storage } from '../services/storage';
import { authService } from '../services/auth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PhoneInput } from './ui/PhoneInput';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { CityInput } from './CityInput';
import { CurrencyInput } from './ui/CurrencyInput';

interface GroupsScreenProps {
  user: User;
  onSelectGroup: (group: Group) => void;
  activeGroupId?: string;
  onUpdateUser?: (u: User) => void;
}

export const GroupsScreen: React.FC<GroupsScreenProps> = ({ user, onSelectGroup, activeGroupId, onUpdateUser }) => {
  // Data State
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [otherGroups, setOtherGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [joiningGroup, setJoiningGroup] = useState<Group | null>(null);
  const [groupToLeave, setGroupToLeave] = useState<Group | null>(null);
  const [successGroupName, setSuccessGroupName] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  // Create Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSport, setNewGroupSport] = useState('Futebol Society');
  const [newGroupDate, setNewGroupDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newGroupLogo, setNewGroupLogo] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [newPaymentMode, setNewPaymentMode] = useState<'split' | 'fixed'>('fixed');
  const [newFixedPerPerson, setNewFixedPerPerson] = useState<string>('0');
  const [newMonthlyFee, setNewMonthlyFee] = useState<string>('0');
  const [newGroupCity, setNewGroupCity] = useState<string>('');
  const groupNameInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => groupNameInputRef.current?.focus(), 300);
    }
  }, [showCreateModal]);

  const openCreateModal = () => {
    setNewGroupName('');
    setNewGroupSport('Futebol Society');
    setNewGroupDate(new Date().toISOString().split('T')[0]);
    setNewGroupLogo('');
    setNewPaymentMode('fixed');
    setNewFixedPerPerson('0');
    setNewMonthlyFee('0');
    setNewGroupCity('');
    setShowCreateModal(true);
  };

  const compressImage = (file: File, maxWidth = 512, maxHeight = 512, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('noctx')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Join Group Form
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    loadGroups();

    // Refresh group list periodically to show new request alerts
    const timer = setInterval(() => {
      loadGroups(true); // silent refresh
    }, 30000);

    return () => clearInterval(timer);
  }, [user.id]);

  const loadGroups = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch user groups explicitly (includes group_players logic from backend)
      const userGroups = await storage.groups.getByUser(user.id);

      // Fetch all groups for exploration
      const allGroups = await storage.groups.getAll();

      const sortedUserGroups = [...userGroups].sort((a, b) => {
        const aIsAdmin = a.adminId === user.id;
        const bIsAdmin = b.adminId === user.id;
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        return a.name.localeCompare(b.name);
      });

      // Filter other groups: those that are NOT in userGroups
      const userGroupIds = new Set(userGroups.map(g => g.id));
      const others = allGroups.filter(g => !userGroupIds.has(g.id));

      setMyGroups(sortedUserGroups);
      setOtherGroups(others);
    } catch (error) {
      console.error("Failed to load groups", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // Prevent double click
    try {
      setIsSaving(true);
      const genId = (prefix: string) => {
        const c: any = (window as any).crypto;
        if (c && typeof c.randomUUID === 'function') return c.randomUUID();
        return `${prefix}_` + Math.random().toString(36).slice(2) + Date.now().toString(36);
      };

      const newGroupId = genId('group');

      const newGroup: Group = {
        id: newGroupId,
        adminId: user.id,
        name: newGroupName,
        sport: newGroupSport,
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: new Date(newGroupDate).toISOString(),
        members: [user.id],
        pendingRequests: [],
        logo: newGroupLogo || undefined,
        paymentMode: newPaymentMode,
        fixedAmount: newPaymentMode === 'fixed' ? (parseInt(newFixedPerPerson || '0', 10) / 100) : 0,
        monthlyFee: (parseInt(newMonthlyFee || '0', 10) / 100),
        city: newGroupCity.trim(),
        admins: [user.id] // Creator is always the first admin
      };

      const savedGroup = await storage.groups.save(newGroup);

      const adminPlayer: Player = {
        id: user.id, // Must be the global Player ID (User ID)
        groupId: savedGroup.id, // Use real Backend ID
        userId: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname || user.name.split(' ')[0],
        phone: user.phone || '',
        birthDate: user.birthDate || '',
        favoriteTeam: user.favoriteTeam || '',
        position: user.position || Position.MEIO,
        rating: 5,
        matchesPlayed: 0
      };

      await storage.players.save(adminPlayer);



      setMyGroups([...myGroups, savedGroup]);
      setShowCreateModal(false);
      setNewGroupName('');
      setNewGroupDate(new Date().toISOString().split('T')[0]);
      setNewGroupLogo('');
      onSelectGroup(savedGroup);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível criar o grupo. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !joiningGroup) return;
    try {
      setIsSaving(true);

      if (joiningGroup.members?.includes(user.id)) {
        alert("Você já faz parte deste grupo!");
        return;
      }
      if (joiningGroup.pendingRequests?.includes(user.id)) {
        alert("Você já enviou uma solicitação para este grupo.");
        return;
      }

      await storage.groups.requestJoin(joiningGroup.id, user.id, joinMessage);

      setSuccessGroupName(joiningGroup.name);
      setShowJoinSuccessModal(true);
      setShowJoinModal(false);
      setJoiningGroup(null);
      setJoinMessage('');
      loadGroups();
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Erro ao solicitar entrada.");
    } finally {
      setIsSaving(false);
    }
  };

  const openJoinModal = (group: Group) => {
    setJoiningGroup(group);
    setJoinMessage('');
    setShowJoinModal(true);
  };

  const openEditGroup = (group: Group) => {
    setEditGroup(group);
    setNewGroupName(group.name);
    setNewGroupSport(group.sport);
    setNewGroupDate(group.createdAt.split('T')[0]);
    setNewGroupLogo(group.logo || '');
    setNewPaymentMode(group.paymentMode || 'fixed');
    setNewFixedPerPerson(String(Math.round((group.fixedAmount ?? 0) * 100)));
    setNewMonthlyFee(String(Math.round(((group as any).monthlyFee ?? 0) * 100)));
    setNewGroupCity(group.city || '');
    setShowEditModal(true);
  };

  const handleCancelRequest = async (groupId: string) => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      await storage.groups.cancelRequest(groupId, user.id);
      await loadGroups();
    } catch (err: any) {
      alert(err?.message || 'Não foi possível cancelar a solicitação.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async (group: Group) => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      await storage.groups.removeMember(group.id, user.id);
      await loadGroups();
      setShowLeaveModal(false);
      setGroupToLeave(null);
      alert(`Você saiu do grupo "${group.name}".`);
    } catch (err: any) {
      alert(err?.message || 'Não foi possível sair do grupo.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(user.id);
    alert("ID (Celular) copiado!");
  };

  // Filter Logic
  const filteredOtherGroups = otherGroups.filter(g => {
    const q = searchTerm.toLowerCase();
    const c = cityFilter.toLowerCase();
    const matchesQuery = !q || g.name.toLowerCase().includes(q) || g.sport.toLowerCase().includes(q);
    const matchesCity = !c || (g.city || '').toLowerCase().includes(c);
    return matchesQuery && matchesCity;
  });

  return (
    <div className="space-y-12 animate-fade-in">
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full shadow-lg"></div>
        </div>
      ) : (
        <>
          {/* Section 1: My Groups (Priority) */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-1">
              <div className="flex items-center gap-3 mb-3">
                <Button
                  onClick={openCreateModal}
                  className="mr-30 rounded-2xl px-6 shadow-lg shadow-brand-500/20"
                  rightIcon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>}
                >
                  Criar Novo Grupo
                </Button>

                <Button
                  variant="outline"
                  onClick={loadGroups}
                  isLoading={loading}
                  className="rounded-2xl w-12 h-12 p-0 border-navy-100 hover:border-brand-500 hover:bg-brand-50 shadow-sm"
                  title="Atualizar lista"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-navy-600 group-hover:text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.length === 0 ? (
                <div className="col-span-full py-16 text-center text-navy-400 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-navy-200">
                  <div className="text-4xl mb-4">🏠</div>
                  <p className="text-xl font-bold text-navy-700 mb-1">Você ainda não participa de nenhum grupo.</p>
                  <p className="text-sm">Encontre uma comunidade abaixo ou crie seu próprio grupo no Hub.</p>
                </div>
              ) : (
                myGroups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    isActive={group.id === activeGroupId}

                    onClick={() => onSelectGroup(group)}
                    isOwner={group.adminId === user.id}
                    isAdmin={group.adminId === user.id || (group.admins?.includes(user.id) ?? false)}
                    onEdit={() => openEditGroup(group)}
                    onLeave={() => {
                      setGroupToLeave(group);
                      setShowLeaveModal(true);
                    }}
                  />
                ))
              )}
            </div>
          </section>

          {/* Section 2: Explore Community */}
          <section className="bg-gradient-to-br from-navy-300/90 via-white to-white -mx-4 md:-mx-6 px-4 md:px-6 py-10 rounded-[2.5rem] border border-navy-100/30 space-y-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
              <div>
                <h3 className="font-heading font-black text-navy-900 text-2xl flex items-center gap-3">
                  <span className="bg-accent-100 text-accent-700 p-2 rounded-xl text-lg shadow-sm">🌍</span>
                  Explorar Comunidade
                </h3>
                <p className="text-sm text-navy-500 mt-1 ml-1">Descubra novos grupos públicos e solicite sua entrada.</p>
              </div>

              {/* Search Bars */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <Input
                  className="w-full md:w-64 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou esporte..."
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
                <CityInput
                  className="w-full md:w-64 shadow-sm"
                  value={cityFilter}
                  onChange={setCityFilter}
                  placeholder="Filtrar por cidade..."
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414m0 0a4 4 0 10-5.657 5.657 4 4 0 005.657-5.657z" /></svg>}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOtherGroups.length === 0 ? (
                <div className="col-span-full py-12 text-center text-navy-400">
                  <div className="text-4xl mb-4">🔍</div>
                  {searchTerm ? <p className="font-bold">Nenhum grupo encontrado para "{searchTerm}".</p> : <p className="font-bold">Não há outros grupos públicos no momento.</p>}
                </div>
              ) : (
                filteredOtherGroups.map(group => {
                  const isPending = group.pendingRequests?.includes(user.id);
                  return (
                    <GroupDiscoveryCard
                      key={group.id}
                      group={group}
                      isPending={isPending}
                      onJoin={() => openJoinModal(group)}
                      onCancel={() => handleCancelRequest(group.id)}
                    />
                  );
                })
              )}
            </div>
          </section>


        </>
      )}

      {/* Create Group Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Criar Novo Grupo">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <Input
            ref={groupNameInputRef}
            label="Nome do Grupo"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Ex: Pelada de Quarta"
            required
          />

          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Modalidade</label>
            <div className="relative">
              <select
                value={newGroupSport}
                onChange={(e) => setNewGroupSport(e.target.value)}
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
              >
                <option>Futebol Society</option>
                <option>Futebol de Campo</option>
                <option>Futsal</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Data de Criação</label>
            <DateInput
              value={newGroupDate}
              onChange={(v) => setNewGroupDate(v)}
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
              required
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Logo (Opcional)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-navy-200 overflow-hidden bg-navy-50 flex items-center justify-center shrink-0">
                {newGroupLogo ? (
                  <img src={newGroupLogo} alt="Logo" className={`w-full h-full object-cover ${isUploadingLogo ? 'opacity-50' : ''}`} />
                ) : (
                  <span className="text-navy-300 text-2xl">📷</span>
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  className="px-4 py-2 bg-navy-50 rounded-xl text-sm font-bold text-navy-600 hover:bg-navy-100 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? 'Enviando...' : 'Selecionar imagem'}
                </button>
                <p className="text-xs text-navy-400 mt-2">Formatos suportados: PNG, JPG. Máx: 2MB.</p>
              </div>
            </div>
          </div>

          <CityInput
            label="Cidade"
            value={newGroupCity}
            onChange={setNewGroupCity}
            placeholder="Ex: São Paulo, SP"
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414m0 0a4 4 0 10-5.657 5.657 4 4 0 005.657-5.657z" /></svg>}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Cobrança</label>
              <div className="relative">
                <select
                  value={newPaymentMode}
                  onChange={(e) => {
                    const v = e.target.value as 'split' | 'fixed';
                    setNewPaymentMode(v);
                    if (v === 'split') setNewFixedPerPerson('0');
                  }}
                  className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
                >
                  <option value="split">Dividir conta</option>
                  <option value="fixed">Valor fixo</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            {newPaymentMode === 'fixed' && (
              <div className="flex-1">
                <CurrencyInput
                  label="Valor p/ pessoa"
                  value={newFixedPerPerson}
                  onChange={setNewFixedPerPerson}
                />
              </div>
            )}
          </div>

          <CurrencyInput label="Valor da Mensalidade" value={newMonthlyFee} onChange={setNewMonthlyFee} />



          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1" isLoading={isSaving} disabled={isSaving}>Criar Grupo</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditGroup(null); }} title="Editar Grupo">
        {editGroup && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              setIsSaving(true);
              const updated: Group = {
                ...editGroup,
                name: newGroupName,
                sport: newGroupSport,
                logo: newGroupLogo || undefined,
                createdAt: new Date(newGroupDate).toISOString(),
                paymentMode: newPaymentMode,
                fixedAmount: newPaymentMode === 'fixed' ? (parseInt(newFixedPerPerson || '0', 10) / 100) : 0,
                monthlyFee: (parseInt(newMonthlyFee || '0', 10) / 100),
                city: newGroupCity.trim()
              };
              await storage.groups.save(updated);



              setShowEditModal(false);
              setEditGroup(null);
              await loadGroups();
            } catch (err: any) {
              alert(err?.message || 'Não foi possível salvar o grupo.');
            } finally {
              setIsSaving(false);
            }
          }} className="space-y-4">
            <Input label="Nome do Grupo" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Data de Criação</label>
              <DateInput
                value={newGroupDate}
                onChange={(v) => setNewGroupDate(v)}
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                required
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Modalidade</label>
              <div className="relative">
                <select
                  value={newGroupSport}
                  onChange={(e) => setNewGroupSport(e.target.value)}
                  className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
                >
                  <option>Futebol Society</option>
                  <option>Futebol de Campo</option>
                  <option>Futsal</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-navy-200 overflow-hidden bg-navy-50 flex items-center justify-center shrink-0">
                  {newGroupLogo ? (<img src={newGroupLogo} alt="Logo" className="w-full h-full object-cover" />) : (<span className="text-navy-300 text-2xl">📷</span>)}
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-navy-50 rounded-xl text-sm font-bold text-navy-600 hover:bg-navy-100 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? 'Enviando...' : 'Alterar imagem'}
                </button>
              </div>
            </div>

            <CityInput
              label="Cidade"
              value={newGroupCity}
              onChange={setNewGroupCity}
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 12.414m0 0a4 4 0 10-5.657 5.657 4 4 0 005.657-5.657z" /></svg>}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Cobrança</label>
                <div className="relative">
                  <select
                    value={newPaymentMode}
                    onChange={(e) => {
                      const v = e.target.value as 'split' | 'fixed';
                      setNewPaymentMode(v);
                      if (v === 'split') setNewFixedPerPerson('0');
                    }}
                    className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium appearance-none"
                  >
                    <option value="split">Dividir conta</option>
                    <option value="fixed">Valor fixo</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>
              {newPaymentMode === 'fixed' && (
                <div className="flex-1">
                  <CurrencyInput
                    label="Valor p/ pessoa"
                    value={newFixedPerPerson}
                    onChange={setNewFixedPerPerson}
                  />
                </div>
              )}
            </div>

            <CurrencyInput label="Valor da Mensalidade" value={newMonthlyFee} onChange={setNewMonthlyFee} />




            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => { setShowEditModal(false); setEditGroup(null); }} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1" isLoading={isSaving} disabled={isSaving}>Salvar Alterações</Button>
            </div>
          </form>
        )}
      </Modal >

      {/* Leave Group Confirmation Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => { setShowLeaveModal(false); setGroupToLeave(null); }}
        title="Confirmar Saída"
      >
        <div className="space-y-6">
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-3xl">⚠️</span>
              <h4 className="text-lg font-black text-red-900">Atenção!</h4>
            </div>
            <p className="text-red-800 leading-relaxed font-medium">
              Tem certeza que deseja deixar de ser membro do grupo <span className="font-black">"{groupToLeave?.name}"</span>?
            </p>
            <p className="text-red-600 text-sm mt-3">
              Você perderá acesso aos jogos, estatísticas e financeiro deste grupo.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowLeaveModal(false); setGroupToLeave(null); }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-500/20"
              isLoading={isSaving}
              onClick={() => groupToLeave && handleLeaveGroup(groupToLeave)}
            >
              Confirmar Saída
            </Button>
          </div>
        </div>
      </Modal>

      {/* Join Group Modal */}
      < Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} title="Entrar em um Grupo" >
        <form onSubmit={handleJoinGroup} className="space-y-4">
          {joiningGroup && (
            <div className="bg-brand-50 p-4 rounded-xl mb-4 border border-brand-100">
              <p className="text-sm text-brand-800 font-bold mb-1">Solicitando entrada em:</p>
              <h4 className="text-lg font-black text-brand-900">{joiningGroup.name}</h4>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome do Jogador"
              value={user.name}
              readOnly
              className="bg-gray-100 text-gray-600 cursor-not-allowed border-transparent"
            />
            <PhoneInput
              label="Celular"
              value={user.phone || ''}
              onChange={() => { }}
              readOnly
              className="bg-gray-100 text-gray-600 cursor-not-allowed border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Mensagem para o Admin</label>
            <textarea
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              placeholder="Ex: Olá, gostaria de entrar no grupo. Jogo de goleiro."
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium min-h-[100px]"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setShowJoinModal(false)} className="flex-1">Cancelar</Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isSaving}
              disabled={isSaving}
            >
              Solicitar Entrada
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Request Success Modal */}
      <Modal
        isOpen={showJoinSuccessModal}
        onClose={() => { setShowJoinSuccessModal(false); setSuccessGroupName(''); }}
        title="Solicitação Enviada"
      >
        <div className="space-y-6">
          <div className="bg-brand-50 p-8 rounded-[2rem] border border-brand-100 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-4xl mb-6 animate-bounce">
              ✅
            </div>
            <h4 className="text-xl font-black text-brand-900 mb-2">Quase lá!</h4>
            <p className="text-navy-600 leading-relaxed font-medium">
              Sua solicitação de entrada no grupo <span className="font-black text-brand-700">"{successGroupName}"</span> foi enviada com sucesso.
            </p>
            <div className="mt-6 p-4 bg-white/50 rounded-xl border border-brand-100/50 w-full">
              <p className="text-xs text-navy-500 font-bold uppercase tracking-wider">Próximos passos</p>
              <p className="text-sm text-navy-600 mt-1">
                Agora basta aguardar que um dos administradores aprove sua entrada. Você será notificado assim que for aceito!
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-brand-500/20"
            onClick={() => { setShowJoinSuccessModal(false); setSuccessGroupName(''); }}
          >
            Entendido
          </Button>
        </div>
      </Modal>

      {/* Hidden Global Input for File Uploads */}
      < input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setIsUploadingLogo(true);
          compressImage(file)
            .then((dataUrl) => {
              setNewGroupLogo(dataUrl);
            })
            .catch(() => {
              alert('Falha ao processar a imagem. Tente outra imagem.');
            })
            .finally(() => {
              setIsUploadingLogo(false);
              if (e.target) e.target.value = ''; // Reset to allow same file selection
            });
        }}
      />
    </div >
  );
};

// Card for "My Groups"
const GroupCard: React.FC<{ group: Group; isActive?: boolean; onClick: () => void; isOwner?: boolean; isAdmin?: boolean; onEdit?: () => void; onLeave?: () => void }> = ({ group, isActive, onClick, isOwner, isAdmin, onEdit, onLeave }) => (
  <Card
    hoverEffect
    onClick={onClick}
    className={`p-0 overflow-hidden border transition-all relative
    ${isActive ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-navy-100 hover:border-brand-300'}`}
  >
    {isActive && (
      <div className="absolute top-0 left-0 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg z-20 shadow-sm uppercase tracking-wider">
        Ativo
      </div>
    )}

    {isAdmin && group.pendingRequests && group.pendingRequests.length > 0 && (
      <div
        className="absolute top-3 right-3 w-4 h-4 bg-red-500 rounded-full z-30 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-alert-pulse border-2 border-white"
        title={`${group.pendingRequests.length} solicitações pendentes`}
      />
    )}



    {/* Banner/Header */}
    <div className={`h-28 flex items-center justify-center text-5xl relative overflow-hidden
      ${isActive ? 'bg-gradient-to-br from-brand-600 to-navy-900' : 'bg-gradient-to-br from-navy-50 to-navy-100'}`}>
      {group.logo ? (
        <img src={group.logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110" />
      ) : (
        <span className="z-10 relative text-6xl drop-shadow-lg opacity-80">⚽</span>
      )}
      <div className={`absolute inset-0 ${isActive ? 'bg-black/20' : 'bg-navy-900/5'}`}></div>
    </div>

    <div className="p-5">
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-heading font-bold text-navy-900 text-lg leading-tight truncate pr-2">{group.name}</h3>
        {isOwner ? (
          <span className="text-[10px] uppercase font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">Admin</span>
        ) : (
          <span className="text-[10px] uppercase font-bold text-navy-600 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">Membro</span>
        )}
      </div>
      <p className="text-xs text-navy-500 mb-5 font-medium">{group.sport}</p>



      <div className="mt-5 pt-4 border-t border-navy-50 flex items-center justify-between text-sm">
        <span className="text-brand-600 font-bold text-xs uppercase tracking-wide hover:underline">Acessar Painel</span>
        {isAdmin ? (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
            className="text-navy-500 text-xs font-bold hover:text-navy-800 hover:bg-navy-50 px-2 py-1 rounded transition-colors"
          >
            Configurações
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onLeave && onLeave(); }}
            className="text-red-500 text-xs font-bold hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            Deixar de ser Membro
          </button>
        )}
      </div>
    </div>
  </Card>
);

// Card for "Discovery"
const GroupDiscoveryCard: React.FC<{ group: Group; isPending?: boolean; onJoin: () => void; onCancel?: () => void }> = ({ group, isPending, onJoin, onCancel }) => (
  <Card hoverEffect className="p-0 overflow-hidden flex flex-col h-full border border-navy-100 hover:border-accent-300 transition-all">
    <div className="h-28 flex items-center justify-center text-4xl relative overflow-hidden bg-gradient-to-br from-navy-50 to-navy-100 group">
      {group.logo ? (
        <img src={group.logo} alt="Logo" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110" />
      ) : (
        <span className="z-10 relative text-5xl drop-shadow-md opacity-40 group-hover:scale-110 transition-transform duration-700">⚽</span>
      )}
      <div className="absolute inset-0 bg-navy-900/5 transition-opacity group-hover:opacity-0"></div>
    </div>
    <div className="p-5 flex flex-col justify-between gap-4 flex-1">
      <div>
        <h3 className="font-bold text-navy-900 text-lg leading-tight">{group.name}</h3>
        <p className="text-xs text-navy-500 font-medium mt-1">{group.sport}</p>
        {group.city && <p className="text-xs text-navy-400 mt-1 flex items-center gap-1"><span className="opacity-70">🏙️</span> {group.city}</p>}
      </div>

      {isPending ? (
        <div className="space-y-2 mt-auto">
          <Button variant="ghost" disabled className="w-full bg-yellow-50 text-yellow-700 hover:bg-yellow-50 text-xs">
            Aguardando Aprovação
          </Button>
          <Button variant="outline" onClick={onCancel} size="sm" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={onJoin} className="w-full mt-auto text-brand-600 hover:text-brand-700 hover:bg-brand-50 border-brand-100">
          Solicitar Entrada
        </Button>
      )}
    </div>
  </Card>
);
