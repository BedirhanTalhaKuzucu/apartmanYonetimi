import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { parsePhoneToE164 } from '@/lib/format';
import toast from 'react-hot-toast';

function phoneToEmail(phone: string): string {
  const e164 = parsePhoneToE164(phone);
  return `${e164.replace('+', '')}@apartman.local`;
}

export function useAuth() {
  const store = useAuthStore();

  const loadUserProfile = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      store.setProfile(profile);
    }

    // Detect role: check manager first
    const { data: managerRecord } = await supabase
      .from('apartment_managers')
      .select('*, apartments(*)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (managerRecord) {
      store.setUserRole('manager');
      if (managerRecord.apartments) {
        store.setCurrentApartment(managerRecord.apartments as any);
      }
      return;
    }

    // Check resident
    const { data: residentRecord } = await supabase
      .from('unit_residents')
      .select('*, units(*, apartments(*))')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (residentRecord) {
      store.setUserRole('resident');
      const unit = residentRecord.units as any;
      if (unit?.apartments) {
        store.setCurrentApartment(unit.apartments);
      }
      return;
    }

    // No role yet (new user without apartment)
    store.setUserRole(null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          store.setUser(session.user);
          await loadUserProfile(session.user.id);
        } else {
          store.setUser(null);
          store.setProfile(null);
          store.setUserRole(null);
          store.setCurrentApartment(null);
        }
        store.setLoading(false);
        store.setInitialized(true);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        store.setUser(session.user);
        loadUserProfile(session.user.id).finally(() => {
          store.setLoading(false);
          store.setInitialized(true);
        });
      } else {
        store.setLoading(false);
        store.setInitialized(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Telefon + Şifre ile kayıt.
   * email parametresi opsiyonel — yönetici için zorunlu, sakin için opsiyonel.
   */
  const signUp = async (
    phone: string,
    password: string,
    fullName: string,
    email?: string
  ) => {
    const e164Phone = parsePhoneToE164(phone);
    // Supabase auth email: gerçek email varsa onu kullan, yoksa pseudo-email
    const authEmail = email?.trim() || phoneToEmail(phone);

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          phone: e164Phone,
          full_name: fullName,
          real_email: email?.trim() || null,
        },
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('Bu telefon numarası veya e-posta zaten kayıtlı.');
      }
      throw new Error(error.message);
    }

    if (data.user) {
      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          phone: e164Phone,
          full_name: fullName,
          email: email?.trim() || null,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }

    return data;
  };

  /**
   * Telefon + Şifre ile giriş.
   */
  const signIn = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Telefon numarası veya şifre hatalı.');
      }
      throw new Error(error.message);
    }

    return data;
  };

  /**
   * E-posta + Şifre ile giriş (email ile kayıt olmuş kullanıcılar için).
   */
  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-posta veya şifre hatalı.');
      }
      throw new Error(error.message);
    }

    return data;
  };

  /**
   * Google OAuth ile giriş.
   * Supabase Dashboard'da Google provider'ın aktif olması gerekir.
   */
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  };

  /**
   * Google ile giriş yapan kullanıcının profilini tamamla.
   * Telefon zorunlu. Email Google'dan otomatik gelir.
   */
  const completeGoogleProfile = async (phone: string, fullName?: string) => {
    if (!store.user) throw new Error('Giriş yapmanız gerekiyor.');

    const e164Phone = parsePhoneToE164(phone);
    const googleEmail = store.user.email || null;
    const name = fullName?.trim() || store.user.user_metadata?.full_name || '';

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: store.user.id,
        phone: e164Phone,
        full_name: name,
        email: googleEmail,
      });

    if (profileError) throw new Error(profileError.message);

    // Refresh profile in store
    await loadUserProfile(store.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    store.signOut();
  };

  const resetPassword = async (email: string) => {
    if (email.endsWith('@apartman.local')) {
      throw new Error(
        'Şifre sıfırlama için gerçek bir e-posta adresi gereklidir. Lütfen profilinize e-posta ekleyin veya apartman yöneticinizle iletişime geçin.'
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-sifirla`,
    });

    if (error) throw new Error(error.message);
  };

  /**
   * Kullanıcının profili tamamlanmış mı kontrol et.
   * Google ile giren kullanıcılar telefon girmemiş olabilir.
   */
  const isProfileComplete = (): boolean => {
    if (!store.profile) return false;
    return !!(store.profile.phone && store.profile.full_name);
  };

  /**
   * Google ile mi giriş yapılmış kontrol et.
   */
  const isGoogleUser = (): boolean => {
    return store.user?.app_metadata?.provider === 'google';
  };

  return {
    user: store.user,
    profile: store.profile,
    userRole: store.userRole,
    currentApartment: store.currentApartment,
    loading: store.loading,
    initialized: store.initialized,
    signUp,
    signIn,
    signInWithEmail,
    signInWithGoogle,
    completeGoogleProfile,
    signOut,
    resetPassword,
    isProfileComplete,
    isGoogleUser,
    refreshProfile: () => store.user ? loadUserProfile(store.user.id) : Promise.resolve(),
  };
}

export function useUpdateProfile() {
  const store = useAuthStore();

  const updateProfile = async (updates: { full_name?: string; email?: string; phone?: string }) => {
    if (!store.user) throw new Error('Giriş yapmanız gerekiyor.');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', store.user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    store.setProfile(data);
    return data;
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  };

  return { updateProfile, changePassword };
}
