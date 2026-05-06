import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  userName: string | null
  token: string | null
  login: (userId: string, userName: string, token: string) => void
  logout: () => void
  setGuest: (userId: string, userName: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  userName: null,
  token: null,

  login: (userId, userName, token) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_userId', userId)
    localStorage.setItem('auth_userName', userName)
    set({ isAuthenticated: true, userId, userName, token })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_userId')
    localStorage.removeItem('auth_userName')
    set({ isAuthenticated: false, userId: null, userName: null, token: null })
  },

  setGuest: (userId, userName) => {
    set({ isAuthenticated: false, userId, userName, token: null })
  },
}))
