import React, { useState, useEffect, useRef } from 'react';
import { User, Field, FieldSlot, Venue } from '../types';
import api from '../services/api';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import DateInput from './DateInput';

interface OwnerDashboardProps {
  user: User;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'venues' | 'fields' | 'schedule'>('venues');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Field Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editField, setEditField] = useState<Partial<Field>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Venue Editor State
  const [isEditingVenue, setIsEditingVenue] = useState(false);
  const [editVenue, setEditVenue] = useState<Partial<Venue>>({});

  // Schedule State
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [slots, setSlots] = useState<FieldSlot[]>([]);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/owner/venues');
      setVenues(data);
      if (data.length > 0 && !selectedVenueId) {
        const firstId = data[0].id;
        setSelectedVenueId(firstId);
        await fetchFields(firstId);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (targetVenueId?: string) => {
    try {
      setLoading(true);
      const vid = targetVenueId ?? selectedVenueId;
      const url = vid ? `/api/owner/fields?venueId=${encodeURIComponent(vid)}` : '/api/owner/fields';
      const data = await api.get(url);
      setFields(data);
      if (data.length > 0 && !selectedFieldId) {
        setSelectedFieldId(data[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async () => {
    try {
      const payload = { ...editField, venueId: editField.venueId ?? selectedVenueId };
      if (!payload.venueId) {
        alert('Selecione um Local para vincular o campo.');
        return;
      }
      if (payload.photos && Array.isArray(payload.photos)) {
        payload.photos = payload.photos.filter((p: any) => typeof p === 'string' && p.trim().length > 0);
      }
      if (editField.id) {
        await api.put(`/api/owner/fields/${editField.id}`, payload);
      } else {
        await api.post('/api/owner/fields', payload);
      }
      setIsEditing(false);
      setEditField({});
      fetchFields(selectedVenueId);
    } catch (error) {
      alert('Erro ao salvar campo');
    }
  };

  const handleSelectImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toUpload: { name: string; dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(f);
      });
      toUpload.push({ name: f.name, dataUrl });
    }
    try {
      const res = await api.post('/api/uploads', { files: toUpload }) as any;
      const urls: string[] = Array.isArray(res.urls) ? res.urls : [];
      setEditField(prev => ({ ...prev, photos: [ ...(prev.photos || []), ...urls ] }));
    } catch (e) {
      alert('Falha ao enviar imagens');
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await api.delete(`/api/owner/fields/${id}`);
      fetchFields();
    } catch (error) {
      alert('Erro ao excluir');
    }
  };

  const handleSaveVenue = async () => {
    try {
      if (editVenue.id) {
        await api.put(`/api/owner/venues/${editVenue.id}`, editVenue);
      } else {
        await api.post('/api/owner/venues', editVenue);
      }
      setIsEditingVenue(false);
      setEditVenue({});
      await fetchVenues();
    } catch (error) {
      alert('Erro ao salvar local');
    }
  };

  const handleDeleteVenue = async (id: string) => {
    if (!confirm('Tem certeza? Isso removerá também os campos vinculados.')) return;
    try {
      await api.delete(`/api/owner/venues/${id}`);
      await fetchVenues();
    } catch (error) {
      alert('Erro ao excluir local');
    }
  };

  const fetchSlots = async () => {
    if (!selectedFieldId) return;
    try {
      const start = scheduleDate; // e.g., 2025-02-05
      const end = scheduleDate;   // Same day for simple view
      // Ideally convert to ISO timestamps for full day range
      const startTs = `${start}T00:00:00`;
      const endTs = `${end}T23:59:59`;
      
      const data = await api.get(`/api/owner/fields/${selectedFieldId}/slots?start=${startTs}&end=${endTs}`);
      setSlots(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchSlots();
    }
  }, [activeTab, selectedFieldId, scheduleDate]);

  const handleGenerateSlots = async () => {
    if (!selectedFieldId) return;
    // Simple generator: 18:00 to 23:00 for the selected date
    const newSlots = [];
    for (let hour = 18; hour < 23; hour++) {
      newSlots.push({
        start: `${scheduleDate}T${hour}:00:00`,
        end: `${scheduleDate}T${hour + 1}:00:00`,
        price: fields.find(f => f.id === selectedFieldId)?.hourlyRate || 100
      });
    }
    try {
      await api.post(`/api/owner/fields/${selectedFieldId}/slots`, { slots: newSlots });
      fetchSlots();
    } catch (error) {
      alert('Erro ao gerar horários');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 text-white px-4 md:px-8 py-6 md:py-8 rounded-2xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-90">Painel Premium</div>
            <h1 className="text-2xl md:text-3xl font-black">Campos e Quadras de: {user.name}</h1>
            <div className="text-sm md:text-base font-medium opacity-90 mt-1">Gestão profissional de Locais, Campos e Agenda</div>
          </div>
          <div className="flex bg-white/15 backdrop-blur rounded-xl p-1 ring-1 ring-white/30 shadow-md">
            <button 
              onClick={() => setActiveTab('venues')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'venues' ? 'bg-white text-brand-700 shadow' : 'text-white hover:bg-white/10'}`}
            >
              🏢 Meus Locais
            </button>
            <button 
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'fields' ? 'bg-white text-brand-700 shadow' : 'text-white hover:bg-white/10'}`}
            >
              🏟️ Meus Campos
            </button>
            <button 
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white text-brand-700 shadow' : 'text-white hover:bg-white/10'}`}
            >
              📅 Agenda
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card className="bg-white/20 text-white ring-1 ring-white/30 p-4">
            <div className="text-xs font-bold uppercase opacity-90">Locais</div>
            <div className="text-3xl font-black">{venues.length}</div>
          </Card>
          <Card className="bg-white/20 text-white ring-1 ring-white/30 p-4">
            <div className="text-xs font-bold uppercase opacity-90">Campos</div>
            <div className="text-3xl font-black">{fields.length}</div>
          </Card>
          <Card className="bg-white/20 text-white ring-1 ring-white/30 p-4">
            <div className="text-xs font-bold uppercase opacity-90">Horários hoje</div>
            <div className="text-3xl font-black">{activeTab === 'schedule' ? slots.length : 0}</div>
          </Card>
        </div>
      </div>

      {activeTab === 'venues' && (
        <div className="space-y-6">
          {!isEditingVenue ? (
            <>
              <div className="flex justify-end">
                <Button onClick={() => { setEditVenue({}); setIsEditingVenue(true); }} className="bg-brand-600 hover:bg-brand-700 text-white shadow">
                  + Adicionar Local
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venues.map(venue => (
                  <Card key={venue.id} className="p-6 flex flex-col justify-between h-full hover:shadow-lg transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-navy-900">{venue.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${venue.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {venue.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-navy-500 text-sm mb-4">{venue.city || 'Sem cidade definida'}</p>
                      <div className="space-y-2 text-sm text-navy-600">
                        <div className="flex items-center gap-2">
                          <span>📍</span> {venue.address}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>☎️</span> {venue.contactPhone || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-6 pt-4 border-t border-navy-50">
                      <Button variant="outline" size="sm" onClick={() => { setEditVenue(venue); setIsEditingVenue(true); }} className="flex-1">Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteVenue(venue.id)} className="text-red-600 hover:bg-red-50 px-2">🗑️</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedVenueId(venue.id); setActiveTab('fields'); }} className="px-2">➡️ Campos</Button>
                    </div>
                  </Card>
                ))}
                {venues.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12 text-navy-400 bg-navy-50 rounded-2xl border-2 border-dashed border-navy-200">
                    Nenhum local cadastrado.
                  </div>
                )}
              </div>
            </>
          ) : (
            <Card className="p-6 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold text-navy-900 mb-6">{editVenue.id ? 'Editar Local' : 'Novo Local'}</h3>
              <div className="space-y-4">
                <Input 
                  label="Nome do Local" 
                  value={editVenue.name || ''} 
                  onChange={e => setEditVenue({ ...editVenue, name: e.target.value })}
                  required
                />
                <Input 
                  label="Cidade" 
                  value={editVenue.city || ''} 
                  onChange={e => setEditVenue({ ...editVenue, city: e.target.value })}
                />
                <Input 
                  label="Endereço Completo" 
                  value={editVenue.address || ''} 
                  onChange={e => setEditVenue({ ...editVenue, address: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Contato (Nome)" 
                    value={editVenue.contactName || ''} 
                    onChange={e => setEditVenue({ ...editVenue, contactName: e.target.value })}
                  />
                  <Input 
                    label="Telefone Contato" 
                    value={editVenue.contactPhone || ''} 
                    onChange={e => setEditVenue({ ...editVenue, contactPhone: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setIsEditingVenue(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={handleSaveVenue} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white">Salvar</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'fields' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-navy-100 shadow-sm">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-navy-400 uppercase">Selecione o Local</label>
              <select 
                value={selectedVenueId} 
                onChange={async e => { const v = e.target.value; setSelectedVenueId(v); await fetchFields(v); }}
                className="w-full mt-1 p-2 rounded-lg border-navy-200 font-bold text-navy-800"
              >
                <option value="">Todos os Locais</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                {!venues.length && <option value="">Sem locais</option>}
              </select>
            </div>
          </div>
          {!isEditing ? (
            <>
              <div className="flex justify-end">
                <Button onClick={() => { setEditField({ venueId: selectedVenueId, type: 'society', hourlyRate: 0, photos: [] }); setIsEditing(true); }} className="bg-brand-600 hover:bg-brand-700 text-white shadow">
                  + Adicionar Campo
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fields.map(field => (
                  <Card key={field.id} className="p-6 flex flex-col justify-between h-full hover:shadow-lg transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-navy-900">{field.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${field.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {field.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-navy-600">
                        <div className="flex items-center gap-2">
                          <span>🏷️</span> {field.type || '—'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>💰</span> R$ {field.hourlyRate}/hora
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-6 pt-4 border-t border-navy-50">
                      <Button variant="outline" size="sm" onClick={() => { setEditField(field); setIsEditing(true); }} className="flex-1">Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteField(field.id)} className="text-red-600 hover:bg-red-50 px-2">🗑️</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedFieldId(field.id); setActiveTab('schedule'); }} className="px-2">➡️ Agenda</Button>
                    </div>
                  </Card>
                ))}
                {fields.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12 text-navy-400 bg-navy-50 rounded-2xl border-2 border-dashed border-navy-200">
                    Nenhum campo cadastrado.
                  </div>
                )}
              </div>
            </>
          ) : (
            <Card className="p-0 max-w-3xl mx-auto overflow-hidden ring-1 ring-navy-100 shadow-xl">
              <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 text-white px-6 py-5">
                <div className="text-xs font-bold uppercase tracking-widest opacity-90">{editField.id ? 'Editar Campo' : 'Novo Campo'}</div>
                <div className="text-lg font-black mt-0.5">{editField.name || 'Campo/Quadra'}</div>
              </div>
              <div className="p-6 space-y-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-navy-500 uppercase mb-1">Local</label>
                    <select 
                      value={editField.venueId || selectedVenueId}
                      onChange={e => setEditField({ ...editField, venueId: e.target.value })}
                      className="w-full p-2 rounded-lg border-navy-200 font-bold text-navy-800"
                      required
                    >
                      {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-navy-500 uppercase mb-1">Tipo</label>
                    <select 
                      value={editField.type || 'society'}
                      onChange={e => setEditField({ ...editField, type: e.target.value })}
                      className="w-full p-2 rounded-lg border-navy-200 font-bold text-navy-800"
                    >
                      <option value="society">Campo Society</option>
                      <option value="quadra">Quadra</option>
                      <option value="profissional">Campo Profissional</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Input 
                      label="Nome do Campo/Quadra" 
                      value={editField.name || ''} 
                      onChange={e => setEditField({...editField, name: e.target.value})} 
                      required
                    />
                  </div>
                  <div>
                    <Input 
                      label="Valor por Hora (R$)" 
                      type="number" 
                      value={editField.hourlyRate || ''} 
                      onChange={e => setEditField({...editField, hourlyRate: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-navy-500 uppercase mb-1">Descrição</label>
                    <textarea 
                      className="w-full rounded-xl border border-navy-200 p-3 text-sm focus:ring-brand-500"
                      rows={3}
                      placeholder="Características do campo, tamanho, piso, observações."
                      value={editField.description || ''}
                      onChange={e => setEditField({...editField, description: e.target.value})}
                    />
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-navy-500 uppercase">Fotos do Campo</label>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={e => handleSelectImages(e.target.files)}
                        className="hidden"
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Selecionar fotos"
                        className="p-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
                          <circle cx="8.5" cy="10.5" r="2.5"></circle>
                          <path d="M21 15l-5-5L5 21"></path>
                        </svg>
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(editField.photos || []).map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative group">
                          <img src={url} alt="Foto do campo" className="w-full h-24 object-cover rounded-lg ring-1 ring-navy-100" />
                          <button 
                            type="button"
                            onClick={() => setEditField(prev => ({ ...prev, photos: (prev.photos || []).filter((u, i) => i !== idx) }))}
                            className="absolute top-1 right-1 text-xs bg-red-600 text-white rounded px-1 opacity-0 group-hover:opacity-100"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setIsEditing(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={handleSaveField} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white">Salvar</Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-navy-100 shadow-sm">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-navy-400 uppercase">Selecione o Campo</label>
              <select 
                value={selectedFieldId} 
                onChange={e => setSelectedFieldId(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border-navy-200 font-bold text-navy-800"
              >
                {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="w-full md:w-auto">
              <label className="text-xs font-bold text-navy-400 uppercase">Data</label>
              <DateInput 
                value={scheduleDate} 
                onChange={setScheduleDate} 
                className="mt-1"
              />
            </div>
          </div>

          {selectedFieldId && (
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-navy-900">Horários do Dia</h3>
                <Button size="sm" onClick={handleGenerateSlots} className="bg-brand-600 hover:bg-brand-700 text-white">
                  🪄 Gerar Horários (18h-23h)
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {slots.map(slot => {
                  const timeLabel = `${slot.startTime.split('T')[1].slice(0, 5)} - ${slot.endTime.split('T')[1].slice(0, 5)}`;
                  return (
                    <div key={slot.id} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 ${slot.isBooked ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                      <span className="text-lg font-black text-navy-900">{timeLabel}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${slot.isBooked ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                        {slot.isBooked ? 'Reservado' : 'Disponível'}
                      </span>
                      <span className="text-sm font-medium text-navy-600">R$ {slot.price}</span>
                    </div>
                  );
                })}
                {slots.length === 0 && (
                  <div className="col-span-full text-center py-8 text-navy-400">
                    Nenhum horário criado para este dia.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
