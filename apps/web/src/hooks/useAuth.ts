import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Role } from '@heavenly/types';

// ============================================================
// Auth Store
// ============================================================
interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      logout: () => {
        set({ user: null, token: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hd_token');
          window.location.href = '/login';
        }
      },
    }),
    {
      name: 'hd_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);

// ============================================================
// useAuth hook
// ============================================================
export function useAuth() {
  const store = useAuthStore();
  const { user } = store;

  const isAuthenticated = !!user && !!store.token;

  const isAdmin =
    user?.role === Role.SUPER_ADMIN ||
    user?.role === Role.GERENTE ||
    user?.role === Role.ADMINISTRACION;

  const isSuperAdmin = user?.role === Role.SUPER_ADMIN;

  const isGerente =
    user?.role === Role.SUPER_ADMIN || user?.role === Role.GERENTE;

  const isSupervisor =
    isGerente || user?.role === Role.SUPERVISOR;

  const isCobranza =
    user?.role === Role.COBRANZA ||
    user?.role === Role.GERENTE ||
    user?.role === Role.SUPER_ADMIN;

  const hasRole = (...roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return {
    ...store,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isGerente,
    isSupervisor,
    isCobranza,
    hasRole,
  };
}
