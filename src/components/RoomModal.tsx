import { useState } from 'react'
import { useUserStore } from '../stores/useUserStore'
import { useAuthStore } from '../stores/useAuthStore'
import { getSyncManager } from '../sync/SyncManager'

interface RoomModalProps {
  onEnter: () => void
}

export function RoomModal({ onEnter }: RoomModalProps) {
  const { userName, setUserName, connected } = useUserStore()
  const [roomId, setRoomId] = useState('')
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!userName.trim()) {
      setError('请输入昵称')
      return
    }
    setError('')

    const sm = getSyncManager()
    if (!sm) return

    if (mode === 'join' && !roomId.trim()) {
      setError('请输入房间号')
      return
    }

    const authStore = useAuthStore.getState()
    let userId: string
    if (authStore.isAuthenticated && authStore.userId) {
      userId = authStore.userId
    } else {
      userId = 'user_' + crypto.randomUUID()
      useAuthStore.getState().setGuest(userId, userName.trim())
    }

    sm.joinRoom(mode === 'join' ? roomId.trim() : undefined, userId, userName.trim())
    onEnter()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 w-96">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">在线白板</h1>
        <p className="text-sm text-gray-400 mb-6">多人实时协作绘图</p>

        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'create' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            创建房间
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'join' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            加入房间
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">昵称</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError('') }}
              placeholder="输入你的昵称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500"
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">房间号</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value); setError('') }}
                placeholder="输入房间号"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-gray-500"
                maxLength={20}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {mode === 'create' ? '创建并进入' : '加入房间'}
          </button>

          {!connected && (
            <p className="text-xs text-amber-500 text-center">正在连接服务器...</p>
          )}
        </div>
      </div>
    </div>
  )
}
