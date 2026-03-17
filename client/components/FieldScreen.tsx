
import React, { useState } from 'react';
import { Field, User, Group } from '../types';
import { CurrencyInput } from './ui/CurrencyInput';
import { PhoneInput } from './ui/PhoneInput';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { cn } from '@/lib/utils';
import { Search, Plus, MapPin, Pencil, Trash2, ExternalLink, User as UserIcon, Phone, MessageSquare } from 'lucide-react';

interface FieldScreenProps {
  fields: Field[];
  onSave: (field: Field) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  activeGroupId: string;
  currentUser: User;
  activeGroup: Group;
}

export const FieldScreen: React.FC<FieldScreenProps> = ({ fields, onSave, onDelete, activeGroupId, currentUser, activeGroup }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<Field['type'] | ''>('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  const isAdmin = activeGroup.adminId === currentUser.id || (activeGroup.admins?.includes(currentUser.id) || false);

  const filteredFields = fields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !isAdmin || !name.trim()) return;

    const baseField = {
      name,
      location,
      type: type || undefined,
      contactName,
      contactPhone: contactPhone.replace(/\D/g, ''),
      hourlyRate: parseInt(hourlyRate || '0', 10) / 100,
      groupId: activeGroupId
    };

    try {
      setIsSaving(true);
      if (editingId) {
        const existing = fields.find(f => f.id === editingId);
        if (existing) await onSave({ ...existing, ...baseField });
      } else {
        const newField: Field = {
          ...baseField,
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        await onSave(newField);
      }
      closeModal();
    } catch (err) {
      alert('Falha ao cadastrar campo. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const openNewFieldModal = () => { resetForm(); setEditingId(null); setIsModalOpen(true); };

  const handleEdit = (field: Field) => {
    if (!isAdmin) return;
    setName(field.name);
    setLocation(field.location);
    setType(field.type || '');
    setContactName(field.contactName || '');
    setContactPhone(field.contactPhone || '');
    setHourlyRate(Math.round(field.hourlyRate * 100).toString());
    setEditingId(field.id);
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); resetForm(); setEditingId(null); };
  const resetForm = () => { setName(''); setLocation(''); setType(''); setContactName(''); setContactPhone(''); setHourlyRate(''); };

  const confirmDelete = async () => {
    if (!fieldToDelete || isSaving) return;
    setIsSaving(true);
    try {
      await onDelete(fieldToDelete);
      setFieldToDelete(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir campo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative h-full animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h3 className="font-heading font-bold text-navy-800 text-xl">Campos Cadastrados</h3>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Input
              placeholder="Buscar campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />
          </div>
          {isAdmin && (
            <Button onClick={openNewFieldModal} leftIcon={<Plus className="h-5 w-5" />} className="whitespace-nowrap">
              Novo Campo
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-30">
        {fields.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-navy-300 bg-white rounded-3xl border-2 border-dashed border-navy-100">
            <MapPin className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg font-medium text-navy-600">Nenhum campo cadastrado.</p>
            {isAdmin && <p className="text-sm text-navy-400">Clique em "Novo Campo" para adicionar um local de jogo.</p>}
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-navy-400">
            <Search className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum campo encontrado.</p>
          </div>
        ) : (
          filteredFields.map((field) => {
            const cleanPhone = field.contactPhone?.replace(/\D/g, '');
            const whatsappLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

            return (
              <Card key={field.id} className="p-0 overflow-hidden hover:shadow-premium-hover transition-all flex flex-col" hoverEffect>
                <div className="h-1.5 w-full bg-brand-500" />
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-navy-900 truncate pr-2">{field.name}</h3>
                      <div className="bg-brand-50 text-brand-700 font-bold px-2 py-1 rounded text-sm whitespace-nowrap border border-brand-100">
                        {field.hourlyRate > 0 ? `R$ ${field.hourlyRate}/h` : 'Grátis'}
                      </div>
                    </div>

                    <p className="text-navy-500 text-sm mt-1 mb-3 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-navy-400 shrink-0" />
                      <span className="truncate">{field.location || "Sem endereço cadastrado"}</span>
                    </p>

                    {(field.contactName || field.contactPhone) && (
                      <div className="bg-navy-50 p-3 rounded-xl text-sm text-navy-700 mb-3 space-y-1.5 border border-navy-100">
                        {field.contactName && (
                          <div className="font-medium flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-navy-400" /> {field.contactName}
                          </div>
                        )}
                        {field.contactPhone && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Phone className="h-3.5 w-3.5 text-navy-400" /> {field.contactPhone}
                            </span>
                            {whatsappLink && (
                              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1 border border-brand-100">
                                <MessageSquare className="h-3 w-3" /> WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {field.coordinates && (
                      <div className="mt-3">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${field.coordinates.lat},${field.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100 font-medium border border-blue-100"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver no Mapa
                        </a>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="mt-4 pt-4 border-t border-navy-50 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(field)} leftIcon={<Pencil className="h-4 w-4" />}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setFieldToDelete(field.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50" leftIcon={<Trash2 className="h-4 w-4" />}>
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {isAdmin && (
        <button
          onClick={openNewFieldModal}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-110 transition-transform"
        >
          <Plus className="h-8 w-8" />
        </button>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Editar Campo' : 'Novo Campo'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome do Campo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Arena Soccer Society" required />
          <Input label="Endereço" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Rua das Palmeiras, 100" icon={<MapPin className="h-4 w-4" />} />
          <div>
            <label className="block text-sm font-semibold text-navy-700 mb-1 ml-1">
              Tipo de Campo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Field['type'] | '')}
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
            >
              <option value="">Selecione o tipo</option>
              <option value="society">Society</option>
              <option value="quadra">Quadra</option>
              <option value="profissional">Campo Profissional</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Contato (Nome)" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Ex: Sr. João" icon={<UserIcon className="h-4 w-4" />} />
            <PhoneInput label="Celular do Contato" value={contactPhone} onChange={setContactPhone} placeholder="(00) 00000-0000" />
          </div>
          <CurrencyInput label="Valor da Hora" value={hourlyRate} onChange={setHourlyRate} placeholder="0,00" />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1" isLoading={isSaving}>{editingId ? 'Salvar Alterações' : 'Cadastrar Campo'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!fieldToDelete} onClose={() => setFieldToDelete(null)} title="Excluir Campo?">
        <p className="text-navy-600 mb-6">Tem certeza que deseja remover este campo?</p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setFieldToDelete(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={confirmDelete} className="flex-1">Sim, Excluir</Button>
        </div>
      </Modal>
    </div>
  );
};
