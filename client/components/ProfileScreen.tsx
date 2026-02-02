
import React, { useState, useRef } from 'react';
import DateInput from './DateInput';
import { User, Position } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PhoneInput, formatPhone } from './ui/PhoneInput';
import { Card } from './ui/Card';
import { TeamAutocomplete } from './ui/TeamAutocomplete';

interface ProfileScreenProps {
  user: User;
  onSave: (updatedUser: User) => Promise<void>;
  onCancel: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onSave, onCancel }) => {
  const [name, setName] = useState(user.name);
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [favoriteTeam, setFavoriteTeam] = useState(user.favoriteTeam || '');
  const [avatar, setAvatar] = useState<string>(user.avatar || '');

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem deve ser menor que 2MB.");
        return;
      }

      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // Prevent double submission
    setIsSaving(true);

    const updatedUser: User = {
      ...user,
      name,
      birthDate,
      email,
      favoriteTeam,
      phone: phone.replace(/\D/g, ''),
      avatar
    };

    try {
      await onSave(updatedUser);
    } catch (error) {
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-10 animate-fade-in-up">
      <Card className="p-0 overflow-hidden border-navy-100 shadow-xl">
        {/* Header Banner */}
        <div className="h-40 bg-gradient-to-r from-brand-600 to-navy-900 relative">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
            size="sm"
            leftIcon={<span>←</span>}
          >
            Voltar
          </Button>

          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
            <div className={`relative group cursor-pointer ${isUploading ? 'cursor-wait' : ''}`} onClick={!isUploading ? triggerFileInput : undefined}>
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-navy-50 relative z-10">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className={`w-full h-full object-cover transition-opacity ${isUploading ? 'opacity-50' : ''}`} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-navy-300 bg-navy-50">
                    <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                )}
              </div>
              {/* Overlay Icon */}
              <div className="absolute inset-0 rounded-full bg-navy-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <span className="text-white text-sm font-bold">Alterar</span>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" disabled={isUploading} />
            </div>
          </div>
        </div>

        <div className="pt-20 pb-8 px-8 lg:px-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-heading font-bold text-navy-900">{name}</h2>
            <p className="text-navy-500 font-medium">Gerencie suas informações pessoais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Input label="Nome Completo" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <PhoneInput
                label="Celular"
                value={phone}
                onChange={setPhone}
                placeholder="(00) 00000-0000"
              />

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Data de Nascimento</label>
                <DateInput
                  value={birthDate}
                  onChange={(v) => setBirthDate(v)}
                  className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="md:col-span-2">
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="md:col-span-2">
                <TeamAutocomplete
                  label="Time do Coração"
                  value={favoriteTeam}
                  onChange={setFavoriteTeam}
                  placeholder="Ex: Flamengo"
                />
              </div>


            </div>

            <div className="pt-8 flex gap-4 border-t border-navy-50 mt-8">
              <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isSaving}
                className="flex-[2]"
              >
                Salvar Alterações
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
