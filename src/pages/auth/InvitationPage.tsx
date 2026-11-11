import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useInvitationByToken, useAcceptInvitation } from '@/hooks/useInvitations';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Home, Clock, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff, Phone, Lock, User, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const { data: invitation, isLoading, error } = useInvitationByToken(token);
  const acceptMutation = useAcceptInvitation();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Pre-fill name and phone from invitation data when available
  useEffect(() => {
    if (invitation) {
      if (invitation.invited_name && !fullName) {
        setFullName(invitation.invited_name);
      }
      if (invitation.invited_phone && !phone) {
        setPhone(invitation.invited_phone);
      }
    }
  }, [invitation]);

  const handleAccept = async () => {
    if (!invitation) return;
    try {
      await acceptMutation.mutateAsync(invitation);
      navigate('/sakin');
    } catch {
      // Error handled by mutation
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast.error(error.message || 'Google ile giriş başarısız.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        if (!fullName.trim()) {
          toast.error('Lütfen adınızı girin.');
          return;
        }
        if (!email.trim()) {
          toast.error('E-posta adresi zorunludur.');
          return;
        }
        if (password.length < 8) {
          toast.error('Şifre en az 8 karakter olmalıdır.');
          return;
        }
        await signUp(phone, password, fullName.trim(), email.trim());
      } else {
        await signIn(phone, password);
      }

      // After auth, accept the invitation
      // Small delay to let auth state settle
      setTimeout(async () => {
        try {
          await acceptMutation.mutateAsync(invitation);
          navigate('/sakin');
        } catch {
          // Error handled
        }
      }, 500);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-primary-600 mx-auto mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500">Davet yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Geçersiz Davet</h2>
          <p className="text-gray-500 mb-6">
            Bu davet bağlantısı geçersiz veya bulunamadı. Lütfen yöneticinizden yeni bir davet isteyin.
          </p>
          <Link
            to="/giris"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700"
          >
            Giriş Sayfasına Git
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = invitation.status === 'expired';
  const isCancelled = invitation.status === 'cancelled';
  const isAccepted = invitation.status === 'accepted';
  const isValid = invitation.status === 'pending';

  const roleLabel = invitation.resident_role === 'owner' ? 'Ev Sahibi' : 'Kiracı';

  if (isAccepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Davet Zaten Kabul Edilmiş</h2>
          <p className="text-gray-500 mb-6">Bu davet daha önce kabul edilmiştir.</p>
          <Link
            to="/giris"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700"
          >
            Giriş Yap
          </Link>
        </div>
      </div>
    );
  }

  if (isExpired || isCancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isExpired ? 'Davetin Süresi Dolmuş' : 'Davet İptal Edilmiş'}
          </h2>
          <p className="text-gray-500 mb-6">
            {isExpired
              ? 'Bu davetin geçerlilik süresi dolmuştur. Lütfen yöneticinizden yeni bir davet isteyin.'
              : 'Bu davet yönetici tarafından iptal edilmiştir.'}
          </p>
          <Link
            to="/giris"
            className="inline-block px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700"
          >
            Giriş Sayfasına Git
          </Link>
        </div>
      </div>
    );
  }

  const GoogleSignInButton = () => (
    <>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={authLoading}
        className="w-full py-3 px-4 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-3"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google ile Devam Et
      </button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
        <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">veya</span></div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Apartman Daveti</h1>
        </div>

        {/* Invitation Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Apartman</p>
                <p className="font-medium text-gray-900">
                  {(invitation as any).apartments?.name || 'Apartman'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Daire</p>
                <p className="font-medium text-gray-900">
                  {(invitation as any).units?.block ? `${(invitation as any).units.block} Blok ` : ''}
                  Daire {(invitation as any).units?.unit_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Rol</p>
                <p className="font-medium text-gray-900">{roleLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-400">
                Davetin geçerlilik süresi:{' '}
                {new Date(invitation.expires_at).toLocaleString('tr-TR')}
              </p>
            </div>
          </div>
        </div>

        {/* If logged in, show accept button */}
        {user ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm text-gray-600 mb-4">
              <strong>{(invitation as any).apartments?.name}</strong> apartmanındaki daireye katılmak için daveti kabul edin.
            </p>
            <button
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {acceptMutation.isPending ? 'Kabul ediliyor...' : 'Daveti Kabul Et'}
            </button>
          </div>
        ) : (
          /* If not logged in, show auth form */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <GoogleSignInButton />

            <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Yeni Hesap
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  authMode === 'login'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                Giriş Yap
              </button>
            </div>

            <form onSubmit={handleAuthAndAccept} className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adınız Soyadınız"
                    className="block w-full px-3 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    required
                  />
                  {invitation.invited_name && (
                    <p className="text-xs text-gray-400 mt-1">Yönetici tarafından girildi — değiştirebilirsiniz</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    required
                  />
                </div>
                {invitation.invited_phone && (
                  <p className="text-xs text-gray-400 mt-1">Yönetici tarafından girildi — değiştirebilirsiniz</p>
                )}
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@email.com"
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      required
                    />
                  </div>
                  <p className="text-xs text-amber-600 mt-1">⚠️ Şifre sıfırlama için gereklidir</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={authMode === 'register' ? 'En az 8 karakter' : '••••••••'}
                    className="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    minLength={authMode === 'register' ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading || acceptMutation.isPending}
                className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {authLoading || acceptMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    İşleniyor...
                  </span>
                ) : authMode === 'register' ? (
                  'Kayıt Ol ve Daveti Kabul Et'
                ) : (
                  'Giriş Yap ve Daveti Kabul Et'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
