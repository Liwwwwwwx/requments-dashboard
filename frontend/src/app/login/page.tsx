'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, ConfigProvider, Input } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

const loginTheme = {
  token: {
    colorPrimary: '#2563eb',
    colorPrimaryHover: '#1d4ed8',
    borderRadius: 6,
    controlHeight: 42,
    fontFamily: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif'
  }
};

function safeRedirectTarget(value: string | null) {
  if (!value) return '/p/default';
  if (!value.startsWith('/') || value.startsWith('//')) return '/p/default';
  return value;
}

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const didRedirect = useRef(false);

  useEffect(() => {
    if (user && !didRedirect.current) {
      didRedirect.current = true;
      router.replace(safeRedirectTarget(searchParams.get('redirect')));
    }
  }, [router, user, searchParams]);

  if (user) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
      <main className="login-page">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-brand">
            <div className="login-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="login-product">TraceBoard</div>
              <div className="login-subtitle">项目需求看板</div>
            </div>
          </div>

          <div className="login-heading">
            <h1 id="login-title">登录</h1>
            <p>进入你的项目需求工作台。</p>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="login-alert"
            />
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-username">用户名</label>
            <Input
              id="login-username"
              size="large"
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoFocus
            />

            <label htmlFor="login-password">密码</label>
            <Input.Password
              id="login-password"
              size="large"
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              disabled={!username.trim() || !password}
              block
            >
              登录
            </Button>
          </form>
        </section>

        <style>{`
          .login-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 32px;
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.95)),
              #f3f6fb;
          }

          .login-panel {
            width: 100%;
            max-width: 400px;
            padding: 32px;
            background: #ffffff;
            border: 1px solid #e5eaf2;
            border-radius: 8px;
            box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
          }

          .login-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 28px;
          }

          .login-mark {
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            gap: 3px;
            padding: 9px;
            border-radius: 8px;
            background: #2563eb;
          }

          .login-mark span {
            width: 100%;
            height: 2px;
            border-radius: 999px;
            background: #ffffff;
          }

          .login-product {
            font-size: 20px;
            font-weight: 650;
            line-height: 1.1;
            color: #0f172a;
          }

          .login-subtitle {
            margin-top: 3px;
            font-size: 12px;
            color: #64748b;
          }

          .login-heading {
            margin-bottom: 22px;
          }

          .login-heading h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 650;
            color: #0f172a;
            letter-spacing: 0;
          }

          .login-heading p {
            margin: 8px 0 0;
            font-size: 14px;
            color: #64748b;
            line-height: 1.5;
          }

          .login-alert {
            margin-bottom: 18px;
          }

          .login-form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .login-form label {
            font-size: 13px;
            color: #334155;
            font-weight: 500;
          }

          .login-form :global(.ant-input-affix-wrapper) {
            margin-bottom: 8px;
          }

          .login-form :global(.ant-btn) {
            margin-top: 8px;
            font-weight: 600;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }

          .login-form :global(.ant-btn:not(:disabled):hover) {
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(37, 99, 235, 0.2);
          }

          @media (max-width: 520px) {
            .login-page {
              padding: 20px;
              align-items: start;
            }

            .login-panel {
              margin-top: 48px;
              padding: 24px;
            }
          }
        `}</style>
      </main>
    </ConfigProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
