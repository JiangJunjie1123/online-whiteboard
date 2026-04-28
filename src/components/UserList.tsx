import { useUserStore } from '../stores/useUserStore'

export function UserList() {
  const { users, userId, roomId, connected } = useUserStore()

  if (!roomId) return null

  return (
    <div className="fixed right-4 top-4 z-40 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-3 w-48">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          在线用户
        </h3>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>
      <p className="text-xs text-gray-400 mb-2">房间: {roomId}</p>
      <div className="space-y-1.5">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-sm text-gray-700 truncate">
              {user.name}
              {user.id === userId && (
                <span className="text-xs text-gray-400 ml-1">(你)</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {users.length === 0 && (
        <p className="text-xs text-gray-400">暂无用户</p>
      )}
    </div>
  )
}
