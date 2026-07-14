'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, ConfigProvider, Input } from 'antd';
import { ArrowRightOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { gsap } from 'gsap';
import { useAuth } from '@/components/AuthProvider';

const loginTheme = {
  token: {
    colorPrimary: '#5f8cff',
    colorPrimaryHover: '#7aa0ff',
    borderRadius: 10,
    controlHeight: 48,
    fontFamily: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif'
  }
};

function safeRedirectTarget(value: string | null) {
  if (!value) return '/p/default';
  if (!value.startsWith('/') || value.startsWith('//')) return '/p/default';
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login#')) return '/p/default';
  return value;
}

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageRef = useRef<HTMLElement | null>(null);
  const didRedirect = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && !didRedirect.current) {
      didRedirect.current = true;
      router.replace(safeRedirectTarget(searchParams.get('redirect')));
    }
  }, [router, user, searchParams]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.to('.login-hero-image', {
        y: -14,
        scale: 1.035,
        duration: 7.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      gsap.to('.login-brand-glyph', {
        boxShadow: '0 0 22px rgba(109, 145, 255, 0.58)',
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }, root);
    return () => context.revert();
  }, []);

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
      <main className="login-page" ref={pageRef}>
        <section className="login-shell" aria-labelledby="login-title">
          <aside className="login-story">
            <img
              className="login-hero-image"
              src="/images/login-workflow-hero.png"
              alt=""
              aria-hidden="true"
            />
            <div className="login-brand" aria-label="TraceBoard">
              <span className="login-brand-glyph">T</span>
              <span>TraceBoard</span>
            </div>

            <div className="login-story-main">
              <p className="login-story-kicker">REQUIREMENT WORKSPACE</p>
              <h1 className="login-story-title">
                让每一个下一步，
                <br />
                都留在轨道上。
              </h1>
              <p className="login-story-copy">
                统一管理项目、需求与变更历史，让团队始终知道现在该推进什么。
              </p>
            </div>

            <div className="login-story-rail" aria-label="产品能力">
              <span>01 · 项目上下文</span>
              <span>02 · 需求推进</span>
              <span>03 · 变更可追溯</span>
            </div>
          </aside>

          <section className="login-access">
            <div className="login-access-inner">
              <div className="login-access-heading">
                <span className="login-access-eyebrow">SECURE ACCESS</span>
                <h2 id="login-title">登录工作台</h2>
                <p>使用你的账号继续进入项目需求空间。</p>
              </div>

              {error && <Alert message={error} type="error" showIcon className="login-alert" />}

              <form onSubmit={handleSubmit} className="login-form">
                <label className="login-field" htmlFor="login-username">
                  <span>用户名</span>
                  <Input
                    id="login-username"
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="输入用户名"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoFocus
                  />
                </label>

                <label className="login-field" htmlFor="login-password">
                  <span>密码</span>
                  <Input.Password
                    id="login-password"
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="输入密码"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  disabled={!username.trim() || !password}
                  className="login-submit"
                  block
                >
                  进入工作台 <ArrowRightOutlined />
                </Button>
              </form>

              <p className="login-security-note">
                <LockOutlined /> 登录后将按你的项目权限加载工作内容。
              </p>
            </div>
          </section>
        </section>

        <style>{`
          .login-page {
            min-height: 100svh;
            padding: 0;
            background: #0c0f14;
            color: #f7f9fc;
          }

          .login-shell {
            min-height: 100svh;
            display: grid;
            grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
            overflow: hidden;
            background: #151922;
          }

          .login-story {
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 560px;
            padding: clamp(26px, 3.6vw, 52px);
            overflow: hidden;
            background: #151b27;
          }

          .login-hero-image {
            position: absolute;
            inset: 0;
            z-index: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: right center;
            opacity: 0.96;
            transform-origin: 72% 52%;
            filter: saturate(1.08) contrast(1.04);
          }

          .login-story::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            background: linear-gradient(90deg, #151b27 0%, rgba(21, 27, 39, 0.97) 31%, rgba(21, 27, 39, 0.58) 62%, rgba(21, 27, 39, 0.15) 100%);
          }

          .login-brand, .login-story-main, .login-story-rail { position: relative; z-index: 1; }

          .login-brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            font-size: 17px;
            font-weight: 650;
            letter-spacing: -0.02em;
          }

          .login-brand-glyph {
            display: grid;
            width: 28px;
            height: 28px;
            place-items: center;
            border-radius: 8px;
            background: #6d91ff;
            color: #10141c;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 14px;
            font-weight: 700;
          }

          .login-story-main { max-width: 510px; margin: clamp(76px, 11vh, 132px) 0 auto; }
          .login-story-kicker, .login-access-eyebrow {
            margin: 0 0 14px;
            color: #8da4d3;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.14em;
          }
          .login-story-title {
            margin: 0;
            color: #f7f9fc;
            font-size: clamp(40px, 4.5vw, 66px);
            font-weight: 600;
            letter-spacing: -0.065em;
            line-height: 1.05;
          }
          .login-story-copy {
            max-width: 440px;
            margin: 20px 0 0;
            color: #a9b1c1;
            font-size: 16px;
            line-height: 1.75;
          }
          .login-story-rail {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 28px;
            padding-top: 16px;
            border-top: 1px solid rgba(255,255,255,0.12);
            color: #7f899c;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            letter-spacing: 0.04em;
          }

          .login-access {
            display: grid;
            place-items: center;
            padding: clamp(24px, 4vw, 54px);
            background: #10141c;
          }
          .login-access-inner { width: min(100%, 380px); }
          .login-access-heading { margin-bottom: 26px; }
          .login-access-eyebrow { display: block; margin-bottom: 13px; color: #7796e8; }
          .login-access-heading h2 {
            margin: 0;
            color: #f7f9fc;
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.04em;
          }
          .login-access-heading p {
            margin: 10px 0 0;
            color: #8d96a7;
            font-size: 14px;
            line-height: 1.6;
          }
          .login-alert { margin-bottom: 14px; }
          .login-form { display: grid; gap: 14px; }
          .login-field { display: grid; gap: 8px; color: #bec6d5; font-size: 13px; font-weight: 500; }
          .login-form .ant-input-affix-wrapper {
            border-color: rgba(255,255,255,0.14);
            background: #181e29;
            color: #f7f9fc;
            box-shadow: none;
          }
          .login-form .ant-input-affix-wrapper:hover { border-color: rgba(109,145,255,0.65); }
          .login-form .ant-input-affix-wrapper-focused {
            border-color: #6d91ff;
            box-shadow: 0 0 0 3px rgba(109,145,255,0.14);
          }
          .login-form input { color: #f7f9fc; }
          .login-form input::placeholder { color: #687287; }
          .login-submit.ant-btn {
            height: 50px;
            margin-top: 6px;
            border-radius: 10px;
            font-weight: 600;
            box-shadow: 0 10px 26px rgba(79, 120, 235, 0.22);
          }
          .login-submit.ant-btn:disabled {
            color: #b9c8ef;
            background: #26395f;
            border-color: #314977;
            box-shadow: none;
          }
          .login-submit.ant-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(79, 120, 235, 0.32); }
          .login-security-note {
            display: flex;
            align-items: center;
            gap: 7px;
            margin: 18px 0 0;
            color: #707a8d;
            font-size: 12px;
          }
          @media (max-width: 820px) {
            .login-page { padding: 0; }
            .login-shell { min-height: 100svh; border: none; border-radius: 0; grid-template-columns: 1fr; }
            .login-story { min-height: auto; padding: 28px; }
            .login-hero-image { object-position: 68% center; opacity: 0.62; }
            .login-story::after { background: linear-gradient(90deg, rgba(21, 27, 39, 0.98), rgba(21, 27, 39, 0.68)); }
            .login-story-main { margin: 62px 0 42px; }
            .login-story-title { font-size: clamp(38px, 11vw, 56px); }
            .login-story-rail { display: none; }
            .login-access { place-items: start center; }
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
