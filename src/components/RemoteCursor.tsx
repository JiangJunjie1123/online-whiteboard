import { useUserStore } from '../stores/useUserStore'
import { useCanvasStore } from '../stores/useCanvasStore'

export function RemoteCursors() {
  const { users, userId } = useUserStore()
  const { stageX, stageY, scale } = useCanvasStore()

  return (
    <>
      {users
        .filter((u) => u.id !== userId && u.cursor)
        .map((user) => {
          const screenX = user.cursor!.x * scale + stageX
          const screenY = user.cursor!.y * scale + stageY
          return (
            <div
              key={user.id}
              className="pointer-events-none absolute z-30"
              style={{
                left: screenX,
                top: screenY,
                transform: 'translate(-2px, -2px)',
              }}
            >
              {/* Cursor arrow */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 2L6 14L8 10L12 12L14 4L2 2Z"
                  fill={user.color}
                  opacity={0.8}
                />
              </svg>
              {/* Name label */}
              <div
                className="absolute left-4 -top-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap text-white"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          )
        })}
    </>
  )
}
