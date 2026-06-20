'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// 登录弹窗组件，用于在主页或列表页面快速完成管理员登录鉴权
export default function LoginModal({ isOpen, onClose, onSuccess, isPage = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 如果 isOpen 为 false 且不是 page 模式，则该模态框不进行渲染
  if (!isOpen && !isPage) return null;

  // 提交登录表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      // 调用 NextAuth.js 的 signIn 方法，使用 credentials 凭证体系
      const result = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });
      if (result?.error) {
        console.error(result.error);
        toast.error("Incorrect username or password. Please check and try again.");
      } else {
        toast.success('Login successful!');
        if (onSuccess) {
          await onSuccess(); // 登录成功回调
        } else {
          setTimeout(() => {
            if (isPage) {
              window.location.href = '/admin'; // Page 登录成功后直接跳转到后台
            } else {
              window.location.reload(); // 延迟刷新页面刷新状态
            }
          }, 200);
        }
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const cardContent = (
    <div className={`relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle ${isPage ? 'shadow-md border border-zinc-200' : 'shadow-2xl border border-zinc-100 animate-in fade-in zoom-in-95 duration-200'}`}>
      {/* 关闭按钮 (非 Page 模式下显示) */}
      {!isPage && onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          Sign In to Dashboard
        </h2>
        <p className="mt-1.5 text-xs text-zinc-500">
          Please enter your administrator credentials
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5" htmlFor="modal-username">
            Username
          </label>
          <input
            id="modal-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="block w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-zinc-900 text-sm placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-0 transition-colors"
            placeholder="Admin"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5" htmlFor="modal-password">
            Password
          </label>
          <input
            id="modal-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="block w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-zinc-900 text-sm placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-0 transition-colors"
            placeholder="••••••••"
          />
        </div>

        {/* 登录提交按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none disabled:bg-zinc-400 transition-colors shadow-md mt-6"
        >
          {loading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-white" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log in</span>
          )}
        </button>
      </form>
    </div>
  );

  if (isPage) {
    return cardContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩层 */}
      <div 
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      {cardContent}
    </div>
  );
}
