import { useEffect, useRef, useState } from 'react'
import { Toolbar } from './components/Toolbar'
import { WhiteboardCanvas } from './components/WhiteboardCanvas'
import { RoomModal } from './components/RoomModal'
import { UserList } from './components/UserList'
import { RemoteCursors } from './components/RemoteCursor'
import { useUserStore } from './stores/useUserStore'
import { createSyncManager } from './sync/SyncManager'

export default function App() {
  const [inRoom, setInRoom] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    const sm = createSyncManager(wsUrl)
    sm.connect()
  }, [])

  const handleEnterRoom = () => {
    // The room_state message will set roomId; we show the canvas immediately
    setInRoom(true)
  }

  return (
    <div className="w-screen h-screen bg-gray-50 relative overflow-hidden">
      {!inRoom && (
        <RoomModal onEnter={handleEnterRoom} />
      )}

      {inRoom && (
        <>
          <Toolbar />
          <WhiteboardCanvas />
          <UserList />
          <RemoteCursors />
        </>
      )}
    </div>
  )
}
