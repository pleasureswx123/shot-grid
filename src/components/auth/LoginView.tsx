import React, { useState } from 'react';
import { Clapperboard, Loader2, LockKeyhole, Mail, Server } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('admin@studio.local');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // AuthContext exposes the server-safe error message.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.2),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_35%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-7 flex items-center justify-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20">
            <Clapperboard className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">ShotGrid Light</h1>
            <p className="text-xs text-slate-400">工作室局域网影视协作系统</p>
          </div>
        </div>

        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">登录工作台</h2>
            <p className="text-xs text-slate-400 mt-1">使用工作室管理员分配的内部账号。</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">邮箱</span>
              <div className="mt-1.5 relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">密码</span>
              <div className="mt-1.5 relative">
                <LockKeyhole className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </label>

            {error && (
              <div className="px-3 py-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? '正在登录…' : '登录'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
            <Server className="w-3.5 h-3.5" />
            <span>账号和项目数据保存在工作室局域网服务器</span>
          </div>
        </section>
      </div>
    </main>
  );
};

