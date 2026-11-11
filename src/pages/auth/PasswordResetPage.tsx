import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (email.endsWith('@apartman.local')) {
      toast.error('Bu bir gerçek e-posta adresi değil. Lütfen gerçek e-posta adresinizi girin.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });

      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast.error(error.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Şifre Sıfırlama</h1>
        </div>

        {/* Important Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Önemli Bilgi</p>
              <p>
                Bu uygulama telefon numarası ile giriş yapmaktadır.
                Şifre sıfırlama için hesabınıza bağlı bir e-posta adresi gereklidir.
              </p>
              <p className="mt-2">
                E-posta adresiniz yoksa veya hatırlayamıyorsanız, lütfen apartman yöneticinizle
                iletişime geçin.
              </p>
              <p className="mt-2 text-xs text-amber-600">
                Not: E-posta gönderimi için sunucu yapılandırması gereklidir.
                Bu özellik yapılandırma olmadan çalışmayabilir.
              </p>
            </div>
          </div>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <Mail className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">E-posta Gönderildi</h2>
            <p className="text-sm text-gray-500 mb-4">
              Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.
            </p>
            <Link
              to="/giris"
              className="inline-flex items-center gap-2 text-primary-600 font-medium hover:text-primary-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Giriş sayfasına dön
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/giris"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </div>
  );
}
