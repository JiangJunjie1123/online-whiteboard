import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { WhiteboardCanvas } from './components/WhiteboardCanvas'
import { RoomModal } from './components/RoomModal'
import { AuthModal } from './components/AuthModal'
import { RemoteCursors } from './components/RemoteCursor'
import { useAuthStore } from './stores/useAuthStore'
import { createSyncManager } from './sync/SyncManager'

type AppPhase = 'checking' | 'auth' | 'room' | 'canvas'

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('checking')
  const wsInitialized = useRef(false)

  // On mount, check localStorage for existing auth token
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUserId = localStorage.getItem('auth_userId')
    const savedUserName = localStorage.getItem('auth_userName')

    if (savedToken && savedUserId && savedUserName) {
      useAuthStore.getState().login(savedUserId, savedUserName, savedToken)
      setPhase('room')
    } else {
      setPhase('auth')
    }
  }, [])

  // Connect WebSocket when entering room phase (auth is resolved)
  useEffect(() => {
    if (phase !== 'room' && phase !== 'canvas') return
    if (wsInitialized.current) return
    wsInitialized.current = true

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = useAuthStore.getState().token
    const wsUrl = token
      ? `${protocol}//${window.location.host}/ws?token=${token}`
      : `${protocol}//${window.location.host}/ws`
    const sm = createSyncManager(wsUrl)
    sm.connect()
  }, [phase])

  const handleAuthContinue = () => {
    setPhase('room')
  }

  const handleEnterRoom = () => {
    setPhase('canvas')
  }

  return (
    <div className="w-screen h-screen bg-canvas-bg relative overflow-hidden">
      {phase === 'auth' && (
        <AuthModal onContinue={handleAuthContinue} />
      )}

      {(phase === 'room') && (
        <RoomModal onEnter={handleEnterRoom} />
      )}

      {phase === 'canvas' && (
        <>
          <Sidebar />
          <WhiteboardCanvas />
          <RemoteCursors />
        </>
      )}
    </div>
  )
}
