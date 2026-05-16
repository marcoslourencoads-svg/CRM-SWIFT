import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthOrg {
  id: string;
  role: string;
  name?: string;
  onboardedAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  organization: AuthOrg | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    organization: AuthOrg;
  }) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setAuth: (data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('organization', JSON.stringify(data.organization));
    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      organization: data.organization,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      organization: null,
      isAuthenticated: false,
    });
  },

  hydrate: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    const orgStr = localStorage.getItem('organization');

    if (accessToken && refreshToken && userStr && orgStr) {
      set({
        accessToken,
        refreshToken,
        user: JSON.parse(userStr),
        organization: JSON.parse(orgStr),
        isAuthenticated: true,
      });
    }
  },
}));
