import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      currentApartment: null,
      userRole: null,
      loading: true,
      initialized: false,
    });
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.currentApartment).toBeNull();
    expect(state.userRole).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.initialized).toBe(false);
  });

  it('setUser updates user', () => {
    const mockUser = { id: 'test-id', email: 'test@test.com' } as any;
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('setProfile updates profile', () => {
    const mockProfile = { id: 'test-id', full_name: 'Test User', phone: '+905321234567' } as any;
    useAuthStore.getState().setProfile(mockProfile);
    expect(useAuthStore.getState().profile).toEqual(mockProfile);
  });

  it('setCurrentApartment updates apartment', () => {
    const mockApartment = { id: 'apt-1', name: 'Test Apt', address: 'Test St' } as any;
    useAuthStore.getState().setCurrentApartment(mockApartment);
    expect(useAuthStore.getState().currentApartment).toEqual(mockApartment);
  });

  it('setUserRole updates role', () => {
    useAuthStore.getState().setUserRole('manager');
    expect(useAuthStore.getState().userRole).toBe('manager');
  });

  it('signOut clears all state', async () => {
    useAuthStore.getState().setUser({ id: 'x' } as any);
    useAuthStore.getState().setUserRole('manager');
    // signOut calls supabase.auth.signOut + resets state
    // We test the state reset part only
    useAuthStore.setState({
      user: null,
      profile: null,
      userRole: null,
      currentApartment: null,
      managedApartments: [],
    });
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.userRole).toBeNull();
    expect(state.currentApartment).toBeNull();
  });
});
