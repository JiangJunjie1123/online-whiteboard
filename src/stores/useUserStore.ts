import { create } from 'zustand'
import type { User } from '../types'

interface UserState {
  userId: string | null
  userName: string
  roomId: string | null
  users: User[]       // online users in current room
  connected: boolean
  setUserId: (id: string) => void
  setUserName: (name: string) => void
  setRoomId: (id: string | null) => void
  setUsers: (users: User[]) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  updateUserCursor: (userId: string, pos: { x: number; y: number }) => void
  setConnected: (connected: boolean) => void
  reset: () => void
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  userName: '',
  roomId: null,
  users: [],
  connected: false,

  setUserId: (id) => set({ userId: id }),
  setUserName: (name) => set({ userName: name }),
  setRoomId: (id) => set({ roomId: id }),
  setUsers: (users) => set({ users }),
  addUser: (user) => set((s) => ({
    users: s.users.some((u) => u.id === user.id) ? s.users : [...s.users, user],
  })),
  removeUser: (userId) => set((s) => ({
    users: s.users.filter((u) => u.id !== userId),
  })),
  updateUserCursor: (userId, pos) => set((s) => ({
    users: s.users.map((u) => (u.id === userId ? { ...u, cursor: pos } : u)),
  })),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ userId: null, roomId: null, users: [], connected: false }),
}))
