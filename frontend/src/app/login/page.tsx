'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Input, Spin, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

const { Text } = Typography;

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect') || '/p/default';
      router.replace(redirect);
    }
  }, [user, router, searchParams]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: 400,
        padding: '40px 36px 36px',
        background: 'var(--bg-surface, #ffffff)',
        borderRadius: 'var(--radius-lg, 14px)',
        boxShadow: 'var(--shadow-lg, 0 14px 36px rgba(15, 23, 42, 0.1), 0 2px 4px rgba(15, 23, 42, 0.04))',
        border: '1px solid var(--border-subtle, rgba(15, 23, 42, 0.07))'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--text-primary, #0f172a)',
            letterSpacing: '-0.01em',
            marginBottom: 8
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent, #2563eb)',
              marginRight: 10,
              verticalAlign: 'middle',
              marginBottom: 4
            }}
          />
          需求<span style={{ color: 'var(--accent, #2563eb)', fontStyle: 'italic' }}>看板</span>
        </div>
        <Text
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary, #64748b)'
          }}
        >
          Requirements Board
        </Text>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 24, borderRadius: 'var(--radius-sm, 6px)' }}
        />
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <Input
            size="large"
            placeholder="用户名"
            prefix={<UserOutlined style={{ color: 'var(--text-tertiary, #64748b)' }} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{
              height: 44,
              borderRadius: 'var(--radius-sm, 6px)',
              borderColor: 'var(--border-default, rgba(15, 23, 42, 0.1))'
            }}
          />
        </div>
        <div style={{ marginBottom: 28 }}>
          <Input.Password
            size="large"
            placeholder="密码"
            prefix={<LockOutlined style={{ color: 'var(--text-tertiary, #64748b)' }} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              height: 44,
              borderRadius: 'var(--radius-sm, 6px)',
              borderColor: 'var(--border-default, rgba(15, 23, 42, 0.1))'
            }}
          />
        </div>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
          size="large"
          disabled={!username || !password}
          style={{ height: 44, borderRadius: 'var(--radius-sm, 6px)', fontWeight: 500 }}
        >
          登录
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e8edf5 100%)'
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
