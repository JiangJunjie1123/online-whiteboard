import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'

interface AuthModalProps {
  onContinue: () => void
}

type AuthTab = 'login' | 'register'

export function AuthModal({ onContinue }: AuthModalProps) {
  const { login: authLogin } = useAuthStore()
  const [tab, setTab] = useState<AuthTab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register fields
  const [regNickname, setRegNickname] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const clearError = () => setError('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!loginEmail.trim() || !loginPassword) {
      setError('请输入邮箱和密码')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || '登录失败')
        return
      }
      authLogin(data.user_id, data.nickname, data.token)
      onContinue()
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!regNickname.trim()) {
      setError('请输入昵称')
      return
    }
    if (!regEmail.trim()) {
      setError('请输入邮箱')
      return
    }
    if (regPassword.length < 6) {
      setError('密码至少6位')
      return
    }
    if (regPassword !== regConfirm) {
      setError('两次密码不一致')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail.trim(), password: regPassword, nickname: regNickname.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || '注册失败')
        return
      }
      authLogin(data.user_id, data.nickname, data.token)
      onContinue()
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = () => {
    onContinue()
  }

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1A73E8]/20 focus:border-[#1A73E8] transition-colors'
  const btnClass =
    'w-full py-2.5 bg-[#1A73E8] text-white rounded-lg text-sm font-medium hover:bg-[#1557B0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 w-96">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">在线协作白板</h1>
        <p className="text-sm text-gray-400 mb-6">多人实时绘图协作</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setTab('login'); clearError() }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'login' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => { setTab('register'); clearError() }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'register' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            注册
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">邮箱</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => { setLoginEmail(e.target.value); clearError() }}
                placeholder="请输入邮箱"
                className={inputClass}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">密码</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); clearError() }}
                placeholder="请输入密码"
                className={inputClass}
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className={btnClass}>
              {loading ? '登录中...' : '登录'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              没有账号？
              <button
                type="button"
                onClick={() => { setTab('register'); clearError() }}
                className="text-[#1A73E8] hover:underline ml-1"
              >
                去注册
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">昵称</label>
              <input
                type="text"
                value={regNickname}
                onChange={(e) => { setRegNickname(e.target.value); clearError() }}
                placeholder="输入你的昵称"
                className={inputClass}
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">邮箱</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => { setRegEmail(e.target.value); clearError() }}
                placeholder="请输入邮箱"
                className={inputClass}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">密码（至少6位）</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => { setRegPassword(e.target.value); clearError() }}
                placeholder="请输入密码"
                className={inputClass}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">确认密码</label>
              <input
                type="password"
                value={regConfirm}
                onChange={(e) => { setRegConfirm(e.target.value); clearError() }}
                placeholder="再次输入密码"
                className={inputClass}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className={btnClass}>
              {loading ? '注册中...' : '注册'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              已有账号？
              <button
                type="button"
                onClick={() => { setTab('login'); clearError() }}
                className="text-[#1A73E8] hover:underline ml-1"
              >
                去登录
              </button>
            </p>
          </form>
        )}

        {/* Guest mode */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleGuest}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            以游客身份继续
          </button>
        </div>
      </div>
    </div>
  )
}
