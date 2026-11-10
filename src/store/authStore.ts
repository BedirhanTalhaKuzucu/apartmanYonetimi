import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile, Apartment, UserRole } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  userRole: UserRole | null;
  currentApartment: Apartment | null;
  managedApartments: Apartment[];

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setCurrentApartment: (apartment: Apartment | null) => void;
  setUserRole: (role: UserRole | null) => void;
  setManagedApartments: (apartments: Apartment[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  userRole: null,
  currentApartment: null,
  managedApartments: [],

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCurrentApartment: (apartment) => set({ currentApartment: apartment }),
  setUserRole: (role) => set({ userRole: role }),
  setManagedApartments: (apartments) => set({ managedApartments: apartments }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      profile: null,
      userRole: null,
      currentApartment: null,
      managedApartments: [],
    });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      set({ profile });
    }
  },

  initialize: async () => {
    try {
      set({ loading: true });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ user: null, profile: null, loading: false, initialized: true });
        return;
      }

      const user = session.user;
      set({ user });

      // Profili getir
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        set({ profile });
      }

      // Yönetici mi kontrol et
      const { data: managerRows } = await supabase
        .from('apartment_managers')
        .select('apartment_id, apartments(*)')
        .eq('user_id', user.id);

      if (managerRows && managerRows.length > 0) {
        const apartments = managerRows
          .map((r: any) => r.apartments)
          .filter(Boolean) as Apartment[];
        set({
          userRole: 'manager',
          managedApartments: apartments,
          currentApartment: apartments[0] || null,
        });
      } else {
        // Sakin mi kontrol et
        const { data: residentRows } = await supabase
          .from('unit_residents')
          .select('unit_id, units(*, apartments(*))')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (residentRows && residentRows.length > 0) {
          const firstUnit = (residentRows[0] as any)?.units;
          const apartment = firstUnit?.apartments as Apartment | undefined;
          set({
            userRole: 'resident',
            currentApartment: apartment || null,
          });
        } else {
          // Henüz hiçbir role atanmamış — yeni kullanıcı
          set({ userRole: null });
        }
      }
    } catch (error) {
      console.error('Auth başlatma hatası:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },
}));
