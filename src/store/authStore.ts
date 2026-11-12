import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile, Apartment, UserRole, ApartmentMembership } from '@/types';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY_PREFIX = 'apt_context_';

function saveActiveContext(userId: string, apartmentId: string, role: UserRole) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify({ apartmentId, role })
    );
  } catch {
    // ignore storage errors
  }
}

function loadActiveContext(userId: string): { apartmentId: string; role: UserRole } | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.apartmentId && (parsed?.role === 'manager' || parsed?.role === 'resident')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  userRole: UserRole | null;
  currentApartment: Apartment | null;
  managedApartments: Apartment[];
  residentApartments: Apartment[];
  apartmentMemberships: ApartmentMembership[];

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setCurrentApartment: (apartment: Apartment | null) => void;
  setUserRole: (role: UserRole | null) => void;
  setManagedApartments: (apartments: Apartment[]) => void;
  setResidentApartments: (apartments: Apartment[]) => void;
  setApartmentMemberships: (memberships: ApartmentMembership[]) => void;
  switchApartment: (apartment: Apartment, role?: UserRole) => void;
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
  residentApartments: [],
  apartmentMemberships: [],

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCurrentApartment: (apartment) => set({ currentApartment: apartment }),
  setUserRole: (role) => set({ userRole: role }),
  setManagedApartments: (apartments) => set({ managedApartments: apartments }),
  setResidentApartments: (apartments) => set({ residentApartments: apartments }),
  setApartmentMemberships: (memberships) => set({ apartmentMemberships: memberships }),

  switchApartment: (apartment, role) => {
    const { user, apartmentMemberships, userRole } = get();
    let targetRole: UserRole | null = role ?? null;

    if (!targetRole) {
      const matching = apartmentMemberships.filter((m) => m.apartment.id === apartment.id);
      if (matching.length === 1) {
        targetRole = matching[0].role;
      } else if (matching.length > 1) {
        // Prefer current role if user has both roles in the same apartment, else manager
        const hasCurrent = matching.some((m) => m.role === userRole);
        targetRole = hasCurrent ? userRole : 'manager';
      } else {
        targetRole = userRole || 'manager';
      }
    }

    set({
      currentApartment: apartment,
      userRole: targetRole,
    });

    if (user && targetRole) {
      saveActiveContext(user.id, apartment.id, targetRole);
    }
  },

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
      residentApartments: [],
      apartmentMemberships: [],
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
        set({
          user: null,
          profile: null,
          userRole: null,
          currentApartment: null,
          managedApartments: [],
          residentApartments: [],
          apartmentMemberships: [],
          loading: false,
          initialized: true,
        });
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

      // Hem yönetici hem sakin olduğu tüm apartmanları paralel sorgula
      const [{ data: managerRows }, { data: residentRows }] = await Promise.all([
        supabase
          .from('apartment_managers')
          .select('apartment_id, apartments(*)')
          .eq('user_id', user.id),
        supabase
          .from('unit_residents')
          .select('unit_id, units(id, unit_number, block, floor, apartment_id, apartments(*))')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ]);

      const managedApartments: Apartment[] = [];
      const seenManagedIds = new Set<string>();
      for (const r of managerRows || []) {
        const apt = (r as any).apartments as Apartment | null;
        if (apt && !seenManagedIds.has(apt.id)) {
          seenManagedIds.add(apt.id);
          managedApartments.push(apt);
        }
      }

      const residentApartmentsMap = new Map<
        string,
        {
          apartment: Apartment;
          units: { id: string; unit_number: string; block?: string | null; floor?: string | null }[];
        }
      >();

      for (const r of residentRows || []) {
        const unit = (r as any).units;
        const apt = unit?.apartments as Apartment | null;
        if (!apt) continue;

        if (!residentApartmentsMap.has(apt.id)) {
          residentApartmentsMap.set(apt.id, { apartment: apt, units: [] });
        }
        const entry = residentApartmentsMap.get(apt.id)!;
        if (!entry.units.some((u) => u.id === unit.id)) {
          entry.units.push({
            id: unit.id,
            unit_number: unit.unit_number,
            block: unit.block,
            floor: unit.floor,
          });
        }
      }

      const residentApartments = Array.from(residentApartmentsMap.values()).map((v) => v.apartment);

      const memberships: ApartmentMembership[] = [
        ...managedApartments.map((apt) => ({
          apartment: apt,
          role: 'manager' as UserRole,
        })),
        ...Array.from(residentApartmentsMap.values()).map((v) => ({
          apartment: v.apartment,
          role: 'resident' as UserRole,
          units: v.units,
        })),
      ];

      // Aktif apartman ve rolü belirle (önce localStorage, yoksa managed, yoksa resident)
      let activeApartment: Apartment | null = null;
      let activeRole: UserRole | null = null;

      const saved = loadActiveContext(user.id);
      if (saved) {
        const match = memberships.find(
          (m) => m.apartment.id === saved.apartmentId && m.role === saved.role
        );
        if (match) {
          activeApartment = match.apartment;
          activeRole = match.role;
        }
      }

      if (!activeApartment) {
        if (managedApartments.length > 0) {
          activeApartment = managedApartments[0];
          activeRole = 'manager';
        } else if (residentApartments.length > 0) {
          activeApartment = residentApartments[0];
          activeRole = 'resident';
        }
      }

      set({
        managedApartments,
        residentApartments,
        apartmentMemberships: memberships,
        currentApartment: activeApartment,
        userRole: activeRole,
      });
    } catch (error) {
      console.error('Auth başlatma hatası:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },
}));
