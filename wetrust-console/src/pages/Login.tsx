import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { cn } from '../components/ui';
import type { Role } from '../lib/types';
import type { OperatorAccount } from '../lib/types';
import { DEFAULT_SECURITY_POLICY, INITIAL_OPERATORS } from '../lib/platform';
import { storage } from '../lib/storage';
import { hasDemoCredential, verifyDemoCredential } from '../lib/platformCredentials';

export interface LoginSession {
  username: string;
  displayName: string;
  role: Role;
  dept: string;
  loginAt: number;
  mfa: boolean;
}

export interface DemoAccount {
  username: string;
  password: string;
  displayName: string;
  role: Role;
  roleLabel: string;
  dept: string;
  phone: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'root', password: 'Admin@2026', displayName: '林知夏', role: 'super_admin', roleLabel: '超级管理员', dept: '平台架构组', phone: '138****9046' },
  { username: 'finance01', password: 'Fin@2026', displayName: '林清和', role: 'finance', roleLabel: '支付清结算', dept: '支付清结算部', phone: '136****2751' },
  { username: 'risk01', password: 'Risk@2026', displayName: '顾以宁', role: 'risk_ops', roleLabel: '风控运营', dept: '风控安全部', phone: '139****8820' },
  { username: 'mod01', password: 'Mod@2026', displayName: '沈知微', role: 'moderator', roleLabel: '内容审核', dept: '内容合规部', phone: '137****3305' },
];

const MAX_MFA_FAILS = 5;
const LOCK_MS = 60_000;
const CODE_TTL_MS = 5 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const EMPTY_CODE = ['', '', '', '', '', ''];

const generateCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

interface LoginPageProps {
  onSuccess: (session: LoginSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<'account' | 'mfa'>('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [pending, setPending] = useState<DemoAccount | null>(null);
  const [expectedCode, setExpectedCode] = useState('');
  const [codeIssuedAt, setCodeIssuedAt] = useState(0);
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [mfaError, setMfaError] = useState('');
  const [mfaFails, setMfaFails] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [loginPolicy] = useState(() => {
    try { return { ...DEFAULT_SECURITY_POLICY, ...JSON.parse(storage.get('wt.securityPolicy') ?? '{}') }; }
    catch { return DEFAULT_SECURITY_POLICY; }
  });
  const failLimit = Math.max(3, Math.min(10, loginPolicy.failed_login_limit));
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // 统一时钟：驱动锁定倒计时、验证码有效期与重发冷却
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (lockedUntil && now >= lockedUntil) {
      setLockedUntil(0);
      setFailCount(0);
      setError('');
    }
  }, [now, lockedUntil]);

  useEffect(() => {
    if (step === 'mfa') digitRefs.current[0]?.focus();
  }, [step, expectedCode]);

  const locked = lockedUntil > now;
  const lockRemaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const codeRemaining = Math.max(0, Math.ceil((codeIssuedAt + CODE_TTL_MS - now) / 1000));
  const resendRemaining = Math.max(0, Math.ceil((codeIssuedAt + RESEND_COOLDOWN_MS - now) / 1000));

  const issueCode = () => {
    setExpectedCode(generateCode());
    setCodeIssuedAt(Date.now());
    setDigits(EMPTY_CODE);
    setMfaError('');
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const name = username.trim().toLowerCase();
    if (!name || !password) {
      setError('请输入账号和密码');
      return;
    }
    const demo = DEMO_ACCOUNTS.find((a) => a.username === name);
    let operators = INITIAL_OPERATORS;
    try { const saved = JSON.parse(storage.get('wt.operators') ?? 'null') as OperatorAccount[] | null; if (Array.isArray(saved)) operators = saved; } catch { /* 使用初始账号数据 */ }
    const operator = operators.find((a) => a.username === name);
    const passwordCorrect = hasDemoCredential(name) ? await verifyDemoCredential(name, password) : Boolean(demo && demo.password === password);
    if (!operator || !passwordCorrect) {
      const next = failCount + 1;
      setFailCount(next);
      if (next >= failLimit) {
        setLockedUntil(Date.now() + LOCK_MS);
        setError(`连续 ${failLimit} 次失败，登录已临时锁定 60 秒`);
      } else {
        setError(`账号或密码错误，还可尝试 ${failLimit - next} 次`);
      }
      return;
    }
    if (!operator.enabled) { setError('账号已被禁用，活跃会话已撤销，请联系平台管理员'); return; }
    const account: DemoAccount = { username: operator.username, password: '', displayName: operator.display_name, role: operator.role, roleLabel: operator.role, dept: operator.department, phone: demo?.phone ?? '138****0000' };
    setError('');
    setFailCount(0);
    if (!loginPolicy.require_mfa) {
      onSuccess({ username: account.username, displayName: account.displayName, role: account.role, dept: account.dept, loginAt: Date.now(), mfa: false });
      return;
    }
    setPending(account);
    setMfaFails(0);
    issueCode();
    setStep('mfa');
  };

  const backToAccount = (message = '') => {
    setStep('account');
    setPending(null);
    setExpectedCode('');
    setDigits(EMPTY_CODE);
    setMfaError('');
    setMfaFails(0);
    setVerifying(false);
    setError(message);
  };

  const verify = (code: string) => {
    if (!pending || verifying) return;
    if (code.length !== 6) {
      setMfaError('请输入完整的 6 位验证码');
      return;
    }
    if (Date.now() > codeIssuedAt + CODE_TTL_MS) {
      setMfaError('验证码已过期，请点击「重新发送」');
      setDigits(EMPTY_CODE);
      digitRefs.current[0]?.focus();
      return;
    }
    if (code !== expectedCode) {
      const next = mfaFails + 1;
      setMfaFails(next);
      if (next >= MAX_MFA_FAILS) {
        backToAccount(`验证码连续 ${MAX_MFA_FAILS} 次错误，请重新登录`);
        return;
      }
      setMfaError(`验证码不正确，还可尝试 ${MAX_MFA_FAILS - next} 次`);
      setDigits(EMPTY_CODE);
      digitRefs.current[0]?.focus();
      return;
    }
    setMfaError('');
    setVerifying(true);
    const account = pending;
    window.setTimeout(() => {
      onSuccess({
        username: account.username,
        displayName: account.displayName,
        role: account.role,
        dept: account.dept,
        loginAt: Date.now(),
        mfa: true,
      });
    }, 350);
  };

  const setDigitAt = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, '');
    if (value.length > 1) {
      // 一次输入多位（粘贴或输入法联想）：从当前位置依次填充
      fillFrom(index, value);
      return;
    }
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setMfaError('');
    if (value && index < 5) digitRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== '')) verify(next.join(''));
  };

  const fillFrom = (index: number, value: string) => {
    const next = [...digits];
    const chars = value.replace(/\D/g, '').slice(0, 6 - index).split('');
    chars.forEach((ch, offset) => {
      next[index + offset] = ch;
    });
    setDigits(next);
    setMfaError('');
    const last = Math.min(5, index + chars.length);
    digitRefs.current[last]?.focus();
    if (next.every((d) => d !== '')) verify(next.join(''));
  };

  const fillCode = () => {
    setDigits(expectedCode.split(''));
    setMfaError('');
    verify(expectedCode);
  };

  const pickDemo = (account: DemoAccount) => {
    if (locked) return;
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1220] px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: 'linear-gradient(#3B4A63 1px, transparent 1px), linear-gradient(90deg, #3B4A63 1px, transparent 1px)', backgroundSize: '44px 44px' }}
      />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-orange-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-[520px] w-[520px] rounded-full bg-sky-500/15 blur-[130px]" />

      <div className="relative w-full max-w-[920px] overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.5)] lg:grid lg:grid-cols-[1.05fr_1fr]">
        {/* 左侧品牌区 */}
        <div className="relative hidden flex-col justify-between bg-[linear-gradient(150deg,#0B1220_0%,#182238_60%,#0B1220_100%)] p-9 text-white lg:flex">
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, #F97316 0, transparent 40%), radial-gradient(circle at 80% 80%, #0EA5E9 0, transparent 45%)' }}
          />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">WeTrust Console</p>
                <p className="font-mono text-[10px] text-gray-400">v2.6 · ENTERPRISE EDITION</p>
              </div>
            </div>
            <h1 className="mt-10 text-[26px] leading-snug font-semibold tracking-tight">
              微信生态治理中心
              <br />
              <span className="text-gray-400">支付 · 风控 · 内容 · 开放平台</span>
            </h1>
            <div className="mt-8 space-y-3">
              {[
                ['6 大业务域', '支付、风控、内容、开放生态、客服、系统'],
                ['4 种角色', '登录账号决定可见菜单与可执行操作'],
                ['全程留痕', '登录、审核、处置均写入审计日志'],
              ].map(([v, l]) => (
                <div key={v} className="flex items-baseline gap-3 rounded-xl bg-white/5 px-4 py-3">
                  <span className="shrink-0 font-mono text-sm font-semibold text-orange-300">{v}</span>
                  <span className="text-xs text-gray-300">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="relative mt-8 font-mono text-[10px] leading-relaxed text-gray-500">
            演示环境 · 所有数据均为模拟数据
            <br />
            账号密码 + 短信验证码双因素登录
          </p>
        </div>

        {/* 右侧表单区 */}
        <div className="p-7 sm:p-10">
          {step === 'account' ? (
            <form onSubmit={submitAccount} className="space-y-5" noValidate>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[#111827]">登录控制台</h2>
                <p className="mt-1 text-xs text-[#6B7280]">第 1 步 / 共 2 步 · 验证账号密码</p>
              </div>

              <div>
                <label htmlFor="login-username" className="mb-1.5 block text-xs font-medium text-[#374151]">
                  账号
                </label>
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="如 root"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full rounded-xl bg-[#F9FAFB] px-3.5 py-3 text-sm outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.1)]"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-[#374151]">
                  密码
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    className="w-full rounded-xl bg-[#F9FAFB] px-3.5 py-3 pr-11 text-sm outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.1)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#9CA3AF] hover:text-[#374151]"
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                  {locked && <span className="ml-auto font-mono">{lockRemaining}s</span>}
                </p>
              )}

              <button
                type="submit"
                disabled={locked}
                className="w-full cursor-pointer rounded-xl bg-[#111827] py-3 text-sm font-medium text-white shadow-[0_4px_14px_rgba(17,24,39,0.25)] transition-all hover:bg-[#242d3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {locked ? `已锁定，${lockRemaining} 秒后重试` : '下一步'}
              </button>

              <div>
                <p className="mb-2 text-[11px] font-medium text-[#6B7280]">演示账号 · 点击自动填入账号密码</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((a) => {
                    const active = username.trim().toLowerCase() === a.username && password === a.password;
                    return (
                      <button
                        key={a.username}
                        type="button"
                        onClick={() => pickDemo(a)}
                        className={cn(
                          'cursor-pointer rounded-xl px-3 py-2.5 text-left transition-all',
                          active ? 'bg-orange-50 shadow-[0_0_0_1.5px_#F97316]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
                            <Lock className="h-3 w-3 text-[#9CA3AF]" />
                            {a.username}
                          </span>
                          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#6B7280] shadow-xs">{a.roleLabel}</span>
                        </span>
                        <span className="mt-1 block font-mono text-[10px] text-[#9CA3AF]">密码 {a.password}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                  <Smartphone className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#111827]">短信验证</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">
                  第 2 步 / 共 2 步 · 验证码已发送至 {pending?.displayName} 的手机{' '}
                  <span className="font-mono font-medium text-[#111827]">{pending?.phone}</span>
                </p>
              </div>

              {/* 模拟短信：演示环境没有接短信网关，验证码直接展示在这里 */}
              <div className="rounded-2xl bg-[#F9FAFB] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
                    <MessageSquareText className="h-3.5 w-3.5" />
                    模拟短信（演示环境未接入短信网关）
                  </span>
                  <span className={cn('font-mono text-[10px]', codeRemaining > 0 ? 'text-[#9CA3AF]' : 'text-rose-600')}>
                    {codeRemaining > 0 ? `${Math.floor(codeRemaining / 60)}:${String(codeRemaining % 60).padStart(2, '0')} 后过期` : '已过期'}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 shadow-xs">
                  <p className="text-xs leading-relaxed text-[#374151]">
                    【WeTrust】您的登录验证码是{' '}
                    <span data-testid="sms-code" className="font-mono text-base font-semibold tracking-[0.2em] text-[#111827]">
                      {expectedCode}
                    </span>
                    ，5 分钟内有效。
                  </p>
                  <button
                    type="button"
                    onClick={fillCode}
                    disabled={verifying || codeRemaining === 0}
                    className="shrink-0 cursor-pointer rounded-lg bg-[#111827] px-3 py-2 text-[11px] font-medium text-white hover:bg-[#242d3d] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    一键填入
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between gap-2">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        digitRefs.current[i] = el;
                      }}
                      value={digit}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`验证码第 ${i + 1} 位`}
                      disabled={verifying}
                      onChange={(e) => setDigitAt(i, e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        fillFrom(i, e.clipboardData.getData('text'));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && i > 0) {
                          const next = [...digits];
                          next[i - 1] = '';
                          setDigits(next);
                          digitRefs.current[i - 1]?.focus();
                        }
                        if (e.key === 'Enter') verify(digits.join(''));
                      }}
                      className={cn(
                        'h-12 w-full rounded-xl bg-[#F9FAFB] text-center font-mono text-lg font-semibold outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.12)] disabled:opacity-60',
                        mfaError && 'shadow-[0_0_0_2px_rgba(225,29,72,0.3)]'
                      )}
                    />
                  ))}
                </div>
                {mfaError && (
                  <p role="alert" className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {mfaError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => verify(digits.join(''))}
                disabled={verifying}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#111827] py-3 text-sm font-medium text-white transition-all hover:bg-[#242d3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {verifying ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    验证通过，正在进入…
                  </>
                ) : (
                  '验证并登录'
                )}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => backToAccount()} className="cursor-pointer font-medium text-[#6B7280] hover:text-[#111827]">
                  ← 返回上一步
                </button>
                <button
                  type="button"
                  onClick={issueCode}
                  disabled={resendRemaining > 0 || verifying}
                  className="inline-flex cursor-pointer items-center gap-1 font-medium text-orange-600 hover:text-orange-700 disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
                >
                  <RefreshCcw className="h-3 w-3" />
                  {resendRemaining > 0 ? `${resendRemaining} 秒后可重新发送` : '重新发送'}
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-[#F9FAFB] p-3 text-[11px] leading-relaxed text-[#6B7280]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                验证码连续输错 {MAX_MFA_FAILS} 次需重新登录。登录成功后会写入一条审计日志。
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-4 font-mono text-[10px] text-[#B0B7C3]">
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              密码 + 短信双因素
            </span>
            <span>WeTrust 演示环境</span>
          </div>
        </div>
      </div>
    </div>
  );
};
