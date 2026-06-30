'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Input, Typography, ConfigProvider } from 'antd';
import { LockOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

const { Text } = Typography;

const loginTheme = {
  token: {
    colorPrimary: '#2563eb',
    colorPrimaryHover: '#1d4ed8',
    borderRadius: 6,
    fontFamily: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
    controlHeight: 46,
  },
};

function LoginForm() {
  const { login, user } = useAuth();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const didRedirect = useRef(false);

  useEffect(() => {
    if (user && !didRedirect.current) {
      didRedirect.current = true;
      const redirect = searchParams.get('redirect') || '/p/default';
      window.location.href = redirect;
    }
  }, [user, searchParams]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowError(false);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={loginTheme}>
      <div className="login-form-container" style={{ width: 380, maxWidth: '100%' }}>
        <div className="login-brand" style={{ marginBottom: 36 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <div className="login-logo-icon"
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3h8M3 7h8M3 11h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Trace<span style={{ color: '#2563eb', fontStyle: 'italic' }}>Board</span>
            </span>
          </div>
          <Text
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#64748b',
              paddingLeft: 38,
            }}
          >
            Project Management Platform
          </Text>
        </div>

        <div className="login-heading" style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 26,
              fontWeight: 600,
              color: '#0f172a',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            欢迎回来
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#64748b',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            登录以继续管理你的项目与团队
          </p>
        </div>

        <div className={`login-error ${showError ? 'shake' : ''}`} style={{ minHeight: 0 }}>
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field" style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 500,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: '0.02em',
              }}
            >
              用户名
            </label>
            <Input
              size="large"
              placeholder="请输入用户名"
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              style={{ height: 46, borderRadius: 8 }}
            />
          </div>
          <div className="login-field" style={{ marginBottom: 28 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 500,
                color: '#334155',
                marginBottom: 6,
                letterSpacing: '0.02em',
              }}
            >
              密码
            </label>
            <Input.Password
              size="large"
              placeholder="请输入密码"
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: 46, borderRadius: 8 }}
            />
          </div>
          <div className="login-field">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              disabled={!username || !password}
              className="login-submit-btn"
              style={{
                height: 46,
                borderRadius: 8,
                fontWeight: 500,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? '登录中...' : (
                <>
                  登录
                  <ArrowRightOutlined style={{ fontSize: 12 }} />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="login-hint"
          style={{
            marginTop: 24,
            padding: '12px 14px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <p
            style={{
              fontSize: 11.5,
              color: '#64748b',
              margin: 0,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              lineHeight: 1.6,
            }}
          >
            默认账号：admin / admin
          </p>
        </div>
      </div>
    </ConfigProvider>
  );
}

/* ── Animated SVG Node Graph ── */
function AnimatedNodeGraph() {
  const nodes = useMemo(() => [
    { x: 120, y: 80, r: 4, delay: 0 },
    { x: 280, y: 50, r: 3, delay: 0.5 },
    { x: 200, y: 160, r: 5, delay: 1 },
    { x: 350, y: 130, r: 3, delay: 1.5 },
    { x: 80, y: 220, r: 3, delay: 0.8 },
    { x: 320, y: 240, r: 4, delay: 1.2 },
    { x: 160, y: 300, r: 3, delay: 0.3 },
    { x: 260, y: 340, r: 5, delay: 1.8 },
    { x: 400, y: 310, r: 3, delay: 0.7 },
    { x: 60, y: 360, r: 4, delay: 1.4 },
    { x: 420, y: 180, r: 3, delay: 2 },
    { x: 140, y: 420, r: 3, delay: 0.9 },
  ], []);

  const connections = useMemo(() => [
    [0, 2], [1, 2], [1, 3], [2, 5], [3, 5], [4, 6],
    [5, 7], [6, 7], [7, 9], [3, 10], [5, 10], [7, 11],
    [0, 4], [2, 6], [8, 10], [8, 7],
  ], []);

  return (
    <svg
      viewBox="0 0 480 480"
      fill="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(96, 165, 250, 0)" />
          <stop offset="50%" stopColor="rgba(96, 165, 250, 0.25)" />
          <stop offset="100%" stopColor="rgba(96, 165, 250, 0)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map(([from, to], i) => {
        const n1 = nodes[from];
        const n2 = nodes[to];
        return (
          <line
            key={`line-${i}`}
            x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
            stroke="url(#lineGrad)"
            strokeWidth="1"
            className="node-line"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        );
      })}

      {nodes.map((node, i) => (
        <g key={`node-${i}`} filter="url(#glow)">
          <circle
            cx={node.x} cy={node.y} r={node.r}
            fill="rgba(96, 165, 250, 0.6)"
            className="node-dot"
            style={{ animationDelay: `${node.delay}s` }}
          />
          <circle
            cx={node.x} cy={node.y} r={node.r * 2.5}
            fill="rgba(96, 165, 250, 0.08)"
            className="node-ring"
            style={{ animationDelay: `${node.delay}s` }}
          />
        </g>
      ))}

      {/* Traveling particles along connections */}
      {connections.slice(0, 6).map(([from, to], i) => {
        const n1 = nodes[from];
        const n2 = nodes[to];
        return (
          <circle
            key={`particle-${i}`}
            r="2"
            fill="rgba(147, 197, 253, 0.9)"
            className="node-particle"
            style={{ animationDelay: `${i * 0.8}s`, animationDuration: `${3 + i * 0.5}s` }}
          >
            <animateMotion
              dur={`${3 + i * 0.5}s`}
              repeatCount="indefinite"
              begin={`${i * 0.8}s`}
              path={`M${n1.x},${n1.y} L${n2.x},${n2.y}`}
            />
          </circle>
        );
      })}
    </svg>
  );
}

/* ── Floating Geometric Shapes ── */
function FloatingShapes() {
  const shapes = useMemo(() => [
    { type: 'circle', x: '15%', y: '20%', size: 60, delay: 0, dur: 12 },
    { type: 'triangle', x: '75%', y: '15%', size: 40, delay: 2, dur: 14 },
    { type: 'circle', x: '85%', y: '60%', size: 30, delay: 4, dur: 10 },
    { type: 'diamond', x: '25%', y: '70%', size: 35, delay: 1, dur: 13 },
    { type: 'triangle', x: '60%', y: '80%', size: 45, delay: 3, dur: 11 },
    { type: 'circle', x: '45%', y: '40%', size: 20, delay: 5, dur: 9 },
    { type: 'diamond', x: '90%', y: '35%', size: 25, delay: 2.5, dur: 15 },
  ], []);

  return (
    <>
      {shapes.map((shape, i) => (
        <div
          key={i}
          className="floating-shape"
          style={{
            position: 'absolute',
            left: shape.x,
            top: shape.y,
            width: shape.size,
            height: shape.size,
            animationDelay: `${shape.delay}s`,
            animationDuration: `${shape.dur}s`,
            opacity: 0.06,
          }}
        >
          {shape.type === 'circle' && (
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="48" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
            </svg>
          )}
          {shape.type === 'triangle' && (
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <polygon points="50,5 95,95 5,95" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
            </svg>
          )}
          {shape.type === 'diamond' && (
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
            </svg>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Wave Animation at Bottom ── */
function WaveAnimation() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: '100%' }}>
        <path
          d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z"
          fill="rgba(37, 99, 235, 0.04)"
          className="wave-path wave-1"
        />
        <path
          d="M0,80 C300,20 600,100 900,40 C1100,10 1300,90 1440,50 L1440,120 L0,120 Z"
          fill="rgba(37, 99, 235, 0.03)"
          className="wave-path wave-2"
        />
        <path
          d="M0,90 C240,50 480,110 720,70 C960,30 1200,100 1440,60 L1440,120 L0,120 Z"
          fill="rgba(96, 165, 250, 0.02)"
          className="wave-path wave-3"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        background: '#ffffff',
      }}
    >
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes gridDrift {
          0% { background-position: 0 0; }
          100% { background-position: 48px 48px; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes floatShape {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(8px, -12px) rotate(90deg); }
          50% { transform: translate(-4px, -20px) rotate(180deg); }
          75% { transform: translate(-12px, -8px) rotate(270deg); }
        }
        @keyframes nodePulse {
          0%, 100% { opacity: 0.6; r: 4; }
          50% { opacity: 1; r: 6; }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 1; r: 8; }
          50% { opacity: 0; r: 16; }
        }
        @keyframes lineFade {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes waveMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes orbMove1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes orbMove2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(0.9); }
          66% { transform: translate(20px, -25px) scale(1.05); }
        }
        @keyframes orbMove3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, 25px) scale(1.08); }
          66% { transform: translate(-30px, -10px) scale(0.92); }
        }

        .login-left-panel {
          animation: slideInLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .login-form-container {
          animation: slideInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
        }
        .login-brand {
          animation: fadeInUp 0.6s ease-out 0.3s both;
        }
        .login-heading {
          animation: fadeInUp 0.6s ease-out 0.4s both;
        }
        .login-field {
          animation: fadeInUp 0.5s ease-out both;
        }
        .login-field:nth-of-type(1) { animation-delay: 0.5s; }
        .login-field:nth-of-type(2) { animation-delay: 0.6s; }
        .login-field:nth-of-type(3) { animation-delay: 0.7s; }
        .login-hint {
          animation: fadeInUp 0.5s ease-out 0.85s both;
        }
        .login-logo-icon {
          animation: float 3s ease-in-out infinite;
        }
        .login-error.shake {
          animation: shake 0.5s ease-in-out;
        }
        .login-grid-pattern {
          animation: gridDrift 20s linear infinite;
        }
        .login-glow-1 {
          animation: breathe 4s ease-in-out infinite;
        }
        .login-glow-2 {
          animation: breathe 4s ease-in-out infinite 2s;
        }
        .login-submit-btn {
          transition: all 0.2s ease !important;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px) !important;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.25) !important;
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0) !important;
        }
        .floating-shape {
          animation: floatShape 10s ease-in-out infinite;
        }
        .node-dot {
          animation: nodePulse 2s ease-in-out infinite;
        }
        .node-ring {
          animation: ringPulse 2s ease-in-out infinite;
        }
        .node-line {
          animation: lineFade 3s ease-in-out infinite;
        }
        .wave-path {
          animation: waveMove 8s linear infinite;
        }
        .wave-2 { animation-duration: 12s; animation-direction: reverse; }
        .wave-3 { animation-duration: 16s; }
        .orb-1 { animation: orbMove1 15s ease-in-out infinite; }
        .orb-2 { animation: orbMove2 18s ease-in-out infinite; }
        .orb-3 { animation: orbMove3 20s ease-in-out infinite; }
      `}</style>

      {/* Left Panel - Branding */}
      <div
        className="login-left-panel"
        style={{
          position: 'relative',
          background: 'linear-gradient(160deg, #0a0f1a 0%, #0f172a 30%, #1a1f35 60%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          overflow: 'hidden',
        }}
      >
        {/* Animated gradient orbs */}
        <div className="orb-1" style={{
          position: 'absolute', top: -100, right: -60,
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="orb-2" style={{
          position: 'absolute', bottom: 80, left: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="orb-3" style={{
          position: 'absolute', top: '40%', left: '30%',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle grid */}
        <div
          className="login-grid-pattern"
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
          }}
        />

        {/* Node graph SVG */}
        <AnimatedNodeGraph />

        {/* Floating geometric shapes */}
        <FloatingShapes />

        {/* Wave at bottom */}
        <WaveAnimation />

        {/* Top brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              display: 'grid', placeItems: 'center', flex: '0 0 auto',
            }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                <path d="M3 3h8M3 7h8M3 11h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 20,
              color: '#f1f5f9', letterSpacing: '-0.01em',
            }}>
              Trace<span style={{ color: '#60a5fa', fontStyle: 'italic' }}>Board</span>
            </span>
          </div>
        </div>

        {/* Center tagline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 400,
            color: '#f1f5f9', lineHeight: 1.2, margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>
            让需求管理<br />回归<span style={{ color: '#60a5fa', fontStyle: 'italic' }}>清晰</span>
          </h2>
          <p style={{
            fontSize: 15, color: 'rgba(148, 163, 184, 0.8)',
            lineHeight: 1.6, margin: 0, maxWidth: 340,
          }}>
            事件溯源驱动的多项目需求看板，<br />为团队提供可追溯的全生命周期管理。
          </p>
        </div>

        {/* Bottom stats */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex', gap: 32, padding: '20px 0',
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>事件溯源</div>
              <div style={{ fontSize: 11.5, color: 'rgba(148, 163, 184, 0.6)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>EVENT SOURCING</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>多项目</div>
              <div style={{ fontSize: 11.5, color: 'rgba(148, 163, 184, 0.6)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>MULTI-PROJECT</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 600, color: '#f1f5f9', letterSpacing: '-0.01em' }}>可追溯</div>
              <div style={{ fontSize: 11.5, color: 'rgba(148, 163, 184, 0.6)', marginTop: 2, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>TRACEABLE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px', background: '#fafbfc',
      }}>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
