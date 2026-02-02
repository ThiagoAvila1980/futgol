import React, { useState, useEffect, useRef } from 'react';
import DateInput from '../components/DateInput'; // Keep original path
import { authService } from '../services/auth';
import api from '../services/api';
import { User, Position } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { PhoneInput } from './ui/PhoneInput';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { TeamAutocomplete } from './ui/TeamAutocomplete';

interface LandingScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Form State
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration Extra Fields
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const [error, setError] = useState('');
  const [lookupInfo, setLookupInfo] = useState('');
  const [lookupGroups, setLookupGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [showForgot, setShowForgot] = useState(false);
  const [showPhoneExistsModal, setShowPhoneExistsModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotUid, setForgotUid] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [newForgotPassword, setNewForgotPassword] = useState('');
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/api/teams').then(data => {
      if (Array.isArray(data)) setTeamsList(data);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await api.get('/api/health');
        if (isMounted) setServerOnline(true);
      } catch {
        if (isMounted) setServerOnline(false);
      }
    })();
  }, []);

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



  const handlePhoneBlur = async () => {
    if (isLogin) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setLookupGroups([]);
      setLookupInfo('');
      return;
    }
    try {
      const resp = await authService.lookupByPhone(digits);
      if (resp && resp.found && resp.profile) {
        if (resp.profile.usuario === true) {
          setPhone(''); // Clear field
          setShowPhoneExistsModal(true);
          setLookupGroups([]);
          setLookupInfo('');
          // Clear other fields to be safe
          setName('');
          setBirthDate('');
          setFavoriteTeam('');
        } else {
          // Found player profile (usuario=false), auto-fill!
          setName(resp.profile.name || '');
          setBirthDate(resp.profile.birthDate || '');
          setEmail(resp.profile.email || ''); // Added email auto-fill
          setFavoriteTeam(resp.profile.favoriteTeam || '');

          setLookupGroups(resp.groups || []);
          setLookupInfo('Encontramos seu cadastro de jogador! Complete os dados abaixo para criar sua conta de usuário.');
        }
      } else {
        setLookupGroups([]);
        setLookupInfo('');
      }
    } catch {
      setLookupGroups([]);
      setLookupInfo('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Prevent double submission
    setIsLoading(true);
    setError('');

    try {
      let user;
      if (isLogin) {
        user = await authService.login(email, password);
      } else {
        user = await authService.register({
          name,
          email,
          password,
          birthDate,
          phone: phone.replace(/\D/g, ''),
          favoriteTeam,
          avatar
        });
      }
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar. Verifique os dados e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return; // Prevent double submission
    if (!forgotEmail) {
      alert('Informe o email cadastrado.');
      return;
    }
    setForgotLoading(true);
    setForgotInfo('');
    try {
      const resp = await authService.forgotPassword(forgotEmail || email);
      setForgotInfo('Se existir uma conta com este email, enviaremos instruções.');
      if (resp && resp.uid && resp.token) {
        setForgotUid(resp.uid);
        setForgotToken(resp.token);
      }
    } catch {
      setForgotInfo('Se existir uma conta com este email, enviaremos instruções.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return; // Prevent double submission
    if (!forgotUid || !forgotToken || !newForgotPassword) return;
    setForgotLoading(true);
    try {
      await authService.resetPasswordConfirm(forgotUid, forgotToken, newForgotPassword);
      setForgotInfo('Senha redefinida com sucesso. Faça login novamente.');
      setShowForgot(false);
      setNewForgotPassword('');
      setForgotUid('');
      setForgotToken('');
    } catch {
      setForgotInfo('Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-navy-50 font-sans">
      {/* Visual Side (Left) */}
      <div className="lg:w-1/2 flex flex-col justify-between p-6 lg:p-16 relative overflow-hidden bg-navy-950">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />

        {/* Content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 mb-6 lg:mb-10">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/10 backdrop-blur rounded-xl border border-white/20 flex items-center justify-center">
              <span className="text-xl lg:text-2xl">⚽</span>
            </div>
            <span className="text-white font-heading font-bold text-xl lg:text-2xl tracking-tight">Futgol</span>
          </div>

          <div className="max-w-lg">
            <h1 className="text-3xl lg:text-6xl font-heading font-extrabold text-white leading-[1.1] mb-4 lg:mb-6">
              O seu futebol <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-400">profissionalizado.</span>
            </h1>
            <p className="hidden lg:block text-navy-300 text-lg leading-relaxed mb-8">
              Organize partidas, gerencie pagamentos e acompanhe estatísticas do seu grupo em um só lugar. Simples, rápido e eficiente.
            </p>

            <div className="hidden lg:grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur border border-white/10 p-4 rounded-xl">
                <div className="text-brand-400 font-bold text-2xl mb-1">100%</div>
                <div className="text-navy-300 text-sm">Controle Financeiro</div>
              </div>
              <div className="bg-white/5 backdrop-blur border border-white/10 p-4 rounded-xl">
                <div className="text-accent-400 font-bold text-2xl mb-1">MVP</div>
                <div className="text-navy-300 text-sm">Rankings Automáticos</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block relative z-10 mt-12 text-navy-400 text-sm">
          &copy; {new Date().getFullYear()} Futgol App. Todos os direitos reservados.
        </div>
      </div>

      {/* Form Side (Right) */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6 lg:space-y-8 mt-10">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl lg:text-3xl font-heading font-bold text-navy-900">
              {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h2>
            <p className="text-navy-500 mt-2">
              {isLogin ? 'Entre para gerenciar seu grupo.' : 'Preencha seus dados para começar.'}
            </p>

            {serverOnline !== null && (
              <div className={`mt-4 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${serverOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-green-600' : 'bg-red-600'}`}></span>
                {serverOnline ? 'Sistema Online' : 'Sistema Offline'}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isLogin ? (
              <>
                <Input
                  label="Email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div>
                  <Input
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 hover:text-brand-600 focus:outline-none transition-colors"
                        tabIndex={-1}
                        title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => { setShowForgot(true); setForgotEmail(email); }}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex flex-col items-center mb-4">
                  <div
                    className={`relative group cursor-pointer w-24 h-24 rounded-full border-2 border-dashed border-navy-200 flex items-center justify-center overflow-hidden bg-navy-50 hover:border-brand-500 transition-colors ${isUploading ? 'opacity-50' : ''}`}
                    onClick={triggerFileInput}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-navy-400 flex flex-col items-center">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[10px] font-bold mt-1">FOTO</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-navy-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-[10px] font-bold">ALTERAR</span>
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                  <p className="text-xs text-navy-400 mt-2">Toque para escolher uma foto de perfil</p>
                </div>

                <div className="md:col-span-2">
                  <PhoneInput
                    ref={phoneInputRef}
                    label="Celular (WhatsApp)"
                    value={phone}
                    onChange={setPhone}
                    onBlur={handlePhoneBlur}
                    placeholder="(00) 00000-0000"
                    required
                    error={undefined}
                  />
                  <p className="text-xs text-navy-400 mt-1 ml-1">* Usado como sua identificação única.</p>
                </div>

                <div className="md:col-span-2">
                  <Input label="Nome Completo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João da Silva" required />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-navy-700 mb-1.5 ml-1">Nascimento</label>
                  <DateInput
                    value={birthDate}
                    onChange={setBirthDate}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <TeamAutocomplete
                    label="Time do coração"
                    value={favoriteTeam}
                    onChange={setFavoriteTeam}
                    placeholder="Ex: Flamengo"
                  />
                </div>



                <div className="md:col-span-2">
                  <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="******"
                    required
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 hover:text-brand-600 focus:outline-none transition-colors"
                        tabIndex={-1}
                        title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {(!isLogin && lookupInfo) && (
              <div className="bg-blue-50 text-navy-700 p-4 rounded-xl text-sm border border-blue-100 flex items-start gap-2">
                <span className="text-blue-500">ℹ️</span>
                <span>{lookupInfo}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-lg"
              size="lg"
              isLoading={isLoading}
            >
              {isLogin ? 'Entrar na conta' : 'Criar minha conta'}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-navy-500">
              {isLogin ? 'Não tem uma conta?' : 'Já tem cadastro?'}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setLookupInfo('');
                }}
                className="ml-2 font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                {isLogin ? 'Cadastre-se grátis' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal Overlay */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-navy-900 mb-2">Recuperar Senha</h3>
            <p className="text-navy-500 text-sm mb-4">Digite seu email para receber as instruções.</p>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <Input
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />

              {forgotInfo && <p className="text-sm font-medium text-brand-600 bg-brand-50 p-3 rounded-lg">{forgotInfo}</p>}

              {forgotUid && forgotToken && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-navy-400 font-bold uppercase">Ambiente de Desenvolvimento</p>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nova senha"
                    value={newForgotPassword}
                    onChange={(e) => setNewForgotPassword(e.target.value)}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 hover:text-brand-600 focus:outline-none transition-colors"
                        tabIndex={-1}
                        title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                  <Button type="button" onClick={handleForgotConfirm} isLoading={forgotLoading} className="w-full" size="sm">
                    Confirmar Nova Senha
                  </Button>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowForgot(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" isLoading={forgotLoading} className="flex-1">
                  Enviar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Phone Number Already Exists Modal */}
      <Modal
        isOpen={showPhoneExistsModal}
        onClose={() => {
          setShowPhoneExistsModal(false);
          setTimeout(() => phoneInputRef.current?.focus(), 100);
        }}
        title="Aviso"
      >
        <div className="space-y-6">
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mb-4">
              ⚠️
            </div>
            <p className="text-amber-900 leading-relaxed font-bold text-lg">
              Esse celular já existe cadastrado no sistema!
            </p>
            <p className="text-navy-500 text-sm mt-2">
              Utilize outro número ou faça login na sua conta existente.
            </p>
          </div>

          <Button
            type="button"
            className="w-full h-12 rounded-xl font-bold shadow-lg"
            onClick={() => {
              setShowPhoneExistsModal(false);
              setTimeout(() => phoneInputRef.current?.focus(), 100);
            }}
          >
            Entendido
          </Button>
        </div>
      </Modal>
    </div>
  );
};
