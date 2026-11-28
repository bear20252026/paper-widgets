import { useEffect, useState } from "react";
import { useI18n } from "../i18nContext";
import { WeChatLogo } from "./WeChatLogo";
import { cn } from "../utils/cn";

type Mode = "password" | "sms";
type SubPage = "login" | "register" | "forgot";

type FieldError = string | null;

type Props = {
  onSwitchToQr?: () => void;
};

export function MobileLogin({ onSwitchToQr }: Props) {
  const { t } = useI18n();
  const [subPage, setSubPage] = useState<SubPage>("login");

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [agree, setAgree] = useState(false);
  const [accountError, setAccountError] = useState<FieldError>(null);
  const [pwdError, setPwdError] = useState<FieldError>(null);
  const [codeError, setCodeError] = useState<FieldError>(null);
  const [globalError, setGlobalError] = useState<FieldError>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // SMS code countdown
  const [codeCd, setCodeCd] = useState(0);
  useEffect(() => {
    if (codeCd <= 0) return;
    const id = window.setTimeout(() => setCodeCd((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [codeCd]);

  // Register state
  const [regStep, setRegStep] = useState(0);
  const [regNickname, setRegNickname] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPwd, setRegPwd] = useState("");
  const [regPwd2, setRegPwd2] = useState("");
  const [regError, setRegError] = useState<FieldError>(null);
  const [regCd, setRegCd] = useState(0);
  useEffect(() => {
    if (regCd <= 0) return;
    const id = window.setTimeout(() => setRegCd((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [regCd]);

  // Forgot state
  const [fgStep, setFgStep] = useState(0);
  const [fgPhone, setFgPhone] = useState("");
  const [fgCode, setFgCode] = useState("");
  const [fgPwd, setFgPwd] = useState("");
  const [fgPwd2, setFgPwd2] = useState("");
  const [fgError, setFgError] = useState<FieldError>(null);
  const [fgCd, setFgCd] = useState(0);
  useEffect(() => {
    if (fgCd <= 0) return;
    const id = window.setTimeout(() => setFgCd((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [fgCd]);

  // Password visibility
  const [showPwd, setShowPwd] = useState(false);

  // Validators
  const phoneRegex = /^1[3-9]\d{9}$/;
  const isPhone = (v: string) => phoneRegex.test(v);

  const codeValid = /^\d{6}$/.test(code);

  const canSubmit =
    agree &&
    account.trim().length > 0 &&
    (mode === "password" ? password.length > 0 : codeValid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setAccountError(null);
    setPwdError(null);
    setCodeError(null);
    if (!agree) {
      setGlobalError(t.errorNoAgree);
      return;
    }
    if (!account.trim()) {
      setAccountError(t.errorEmptyAccount);
      return;
    }
    if (mode === "password") {
      if (!password) {
        setPwdError(t.errorEmptyPassword);
        return;
      }
      if (password.length < 6) {
        setPwdError(t.errorPasswordLength);
        return;
      }
    } else {
      if (!codeValid) {
        setCodeError(t.errorCodeLength);
        return;
      }
    }
    setSubmitting(true);
    // simulate request
    window.setTimeout(() => {
      setSubmitting(false);
      // fake "invalid credentials" when password is "wrong" or code is 000000
      if (mode === "password" && password === "wrong") {
        setGlobalError(t.errorWrongCred);
        setPwdError(t.errorWrongCred);
        return;
      }
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2200);
    }, 900);
  };

  const sendSmsCode = () => {
    const v = account.trim();
    setCodeError(null);
    if (!isPhone(v)) {
      setAccountError(t.errorPhoneFormat);
      return;
    }
    setCodeCd(60);
  };

  const switchMode = () => {
    setMode((m) => (m === "password" ? "sms" : "password"));
    setCodeError(null);
    setPwdError(null);
    setGlobalError(null);
  };

  // ===== Register flow =====
  const regNext = () => {
    setRegError(null);
    if (regStep === 0) {
      if (!regNickname.trim()) return setRegError(t.errorNickname);
      if (!isPhone(regPhone)) return setRegError(t.errorPhoneFormat);
      if (!/^\d{6}$/.test(regCode)) return setRegError(t.errorCodeLength);
      setRegStep(1);
      return;
    }
    if (regStep === 1) {
      if (regPwd.length < 6) return setRegError(t.errorPasswordLength);
      if (regPwd !== regPwd2) return setRegError(t.errorConfirmPassword);
      setRegStep(2);
    }
  };

  const regSendCode = () => {
    if (!isPhone(regPhone)) {
      setRegError(t.errorPhoneFormat);
      return;
    }
    setRegCd(60);
  };

  // ===== Forgot flow =====
  const fgNext = () => {
    setFgError(null);
    if (fgStep === 0) {
      if (!isPhone(fgPhone)) return setFgError(t.errorPhoneFormat);
      if (!/^\d{6}$/.test(fgCode)) return setFgError(t.errorCodeLength);
      setFgStep(1);
      return;
    }
    if (fgStep === 1) {
      if (fgPwd.length < 6) return setFgError(t.errorPasswordLength);
      if (fgPwd !== fgPwd2) return setFgError(t.errorConfirmPassword);
      setFgStep(2);
    }
  };

  const fgSendCode = () => {
    if (!isPhone(fgPhone)) {
      setFgError(t.errorPhoneFormat);
      return;
    }
    setFgCd(60);
  };

  // ====== RENDER ======
  if (subPage === "register") {
    return (
      <MobileShell title={t.registerTitle} subtitle={t.registerSubtitle}>
        <Stepper step={regStep} steps={[t.findAccount, t.setNewPassword, t.enterWechat]} />
        {regStep === 0 && (
          <div className="space-y-4">
            <TextField
              label={t.nickname}
              value={regNickname}
              onChange={setRegNickname}
              placeholder={t.nickname}
            />
            <TextField
              label={t.phone}
              value={regPhone}
              onChange={setRegPhone}
              placeholder={t.phone}
              type="tel"
              maxLength={11}
            />
            <TextField
              label={t.codePlaceholder}
              value={regCode}
              onChange={setRegCode}
              placeholder={t.codePlaceholder}
              type="tel"
              maxLength={6}
              suffix={
                <button
                  type="button"
                  onClick={regSendCode}
                  disabled={regCd > 0}
                  className="whitespace-nowrap text-sm font-medium text-[#07C160] disabled:text-slate-400"
                >
                  {regCd > 0 ? `${regCd}${t.sec}` : t.sendSmsCode}
                </button>
              }
            />
          </div>
        )}
        {regStep === 1 && (
          <div className="space-y-4">
            <TextField
              label={t.password}
              value={regPwd}
              onChange={setRegPwd}
              placeholder={t.passwordPlaceholder}
              type="password"
            />
            <TextField
              label={t.confirmPassword}
              value={regPwd2}
              onChange={setRegPwd2}
              placeholder={t.passwordPlaceholder}
              type="password"
            />
          </div>
        )}
        {regStep === 2 && (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#07C160]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.enterWechat}</p>
            <p className="mt-1 text-sm text-slate-500">{t.welcomeBack}</p>
          </div>
        )}
        {regError && <p className="mt-3 text-sm text-rose-500">{regError}</p>}
        <div className="mt-8 space-y-3">
          {regStep < 2 && (
            <PrimaryButton onClick={regNext} disabled={false}>
              {regStep === 0 ? t.next : t.finish}
            </PrimaryButton>
          )}
          {regStep === 2 && (
            <PrimaryButton onClick={() => { setSubPage("login"); setRegStep(0); }}>
              {t.backToLogin}
            </PrimaryButton>
          )}
          <button
            type="button"
            className="w-full text-center text-sm text-slate-500 hover:text-[#07C160]"
            onClick={() => { setSubPage("login"); setRegStep(0); setRegError(null); }}
          >
            {t.alreadyHave} {t.login}
          </button>
        </div>
      </MobileShell>
    );
  }

  if (subPage === "forgot") {
    return (
      <MobileShell title={t.forgotTitle} subtitle={t.forgotSubtitle}>
        <Stepper step={fgStep} steps={[t.verifyIdentity, t.resetPassword, t.resetDone]} />
        {fgStep === 0 && (
          <div className="space-y-4">
            <TextField
              label={t.phone}
              value={fgPhone}
              onChange={setFgPhone}
              placeholder={t.phone}
              type="tel"
              maxLength={11}
            />
            <TextField
              label={t.codePlaceholder}
              value={fgCode}
              onChange={setFgCode}
              placeholder={t.codePlaceholder}
              type="tel"
              maxLength={6}
              suffix={
                <button
                  type="button"
                  onClick={fgSendCode}
                  disabled={fgCd > 0}
                  className="whitespace-nowrap text-sm font-medium text-[#07C160] disabled:text-slate-400"
                >
                  {fgCd > 0 ? `${fgCd}${t.sec}` : t.sendSmsCode}
                </button>
              }
            />
          </div>
        )}
        {fgStep === 1 && (
          <div className="space-y-4">
            <TextField label={t.setNewPassword} value={fgPwd} onChange={setFgPwd} placeholder={t.passwordPlaceholder} type="password" />
            <TextField label={t.confirmNewPassword} value={fgPwd2} onChange={setFgPwd2} placeholder={t.passwordPlaceholder} type="password" />
          </div>
        )}
        {fgStep === 2 && (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#07C160]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">{t.resetDone}</p>
            <p className="mt-1 text-sm text-slate-500">{t.resetDoneDesc}</p>
          </div>
        )}
        {fgError && <p className="mt-3 text-sm text-rose-500">{fgError}</p>}
        <div className="mt-8 space-y-3">
          {fgStep < 2 && (
            <PrimaryButton onClick={fgNext}>{t.next}</PrimaryButton>
          )}
          {fgStep === 2 && (
            <PrimaryButton onClick={() => { setSubPage("login"); setFgStep(0); }}>
              {t.backToLogin}
            </PrimaryButton>
          )}
          <button
            type="button"
            className="w-full text-center text-sm text-slate-500 hover:text-[#07C160]"
            onClick={() => { setSubPage("login"); setFgStep(0); setFgError(null); }}
          >
            {t.backToLogin}
          </button>
        </div>
      </MobileShell>
    );
  }

  // ===== LOGIN PAGE =====
  return (
    <MobileShell title={t.mobileTitle} subtitle={t.mobileSubtitle}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          value={account}
          onChange={(v) => {
            setAccount(v);
            setAccountError(null);
            setGlobalError(null);
          }}
          placeholder={t.accountPlaceholder}
          error={accountError || undefined}
          autoComplete="username"
          leading={
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />

        {mode === "password" ? (
          <TextField
            value={password}
            onChange={(v) => {
              setPassword(v);
              setPwdError(null);
              setGlobalError(null);
            }}
            placeholder={t.passwordPlaceholder}
            type={showPwd ? "text" : "password"}
            error={pwdError || undefined}
            autoComplete="current-password"
            leading={
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            suffix={
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="toggle password"
              >
                {showPwd ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20 20 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20 20 0 0 1-3.17 4.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            }
          />
        ) : (
          <TextField
            value={code}
            onChange={(v) => {
              setCode(v.replace(/\D/g, "").slice(0, 6));
              setCodeError(null);
              setGlobalError(null);
            }}
            placeholder={t.codePlaceholder}
            type="tel"
            maxLength={6}
            error={codeError || undefined}
            leading={
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" />
                <path d="M4 9h16" />
              </svg>
            }
            suffix={
              <button
                type="button"
                onClick={sendSmsCode}
                disabled={codeCd > 0}
                className="whitespace-nowrap text-sm font-medium text-[#07C160] disabled:text-slate-400"
              >
                {codeCd > 0 ? `${codeCd}${t.sec}` : t.sendCode}
              </button>
            }
          />
        )}

        {globalError && (
          <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {globalError}
          </div>
        )}

        <div className="flex justify-between pt-1 text-sm">
          <button
            type="button"
            onClick={switchMode}
            className="text-[#576b95] hover:underline dark:text-blue-400"
          >
            {mode === "password" ? t.viaSms : t.viaPassword}
          </button>
          <button
            type="button"
            onClick={() => setSubPage("forgot")}
            className="text-[#576b95] hover:underline dark:text-blue-400"
          >
            {t.forgotPassword}
          </button>
        </div>

        <div className="pt-2">
          <PrimaryButton
            type="submit"
            disabled={!canSubmit || submitting}
            loading={submitting}
          >
            {submitting ? t.logging : t.login}
          </PrimaryButton>
        </div>

        <label className="flex cursor-pointer items-start gap-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#07C160]"
          />
          <span className="leading-relaxed">
            {t.agreementText}
            <a href="#" onClick={(e) => e.preventDefault()} className="text-[#576b95] dark:text-blue-400">
              {t.agreementUser}
            </a>
            {t.and}
            <a href="#" onClick={(e) => e.preventDefault()} className="text-[#576b95] dark:text-blue-400">
              {t.agreementPrivacy}
            </a>
          </span>
        </label>
      </form>

      {/* Success toast */}
      {success && (
        <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-slate-900/80 px-5 py-3 text-sm text-white shadow-xl backdrop-blur">
          ✓ {t.loginSuccess}
        </div>
      )}

      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          {t.otherLogin}
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center justify-center gap-10">
          {onSwitchToQr && (
            <button
              type="button"
              onClick={onSwitchToQr}
              className="flex flex-col items-center gap-1 text-xs text-slate-500 hover:text-[#07C160] dark:text-slate-400"
              title={t.switchToQr}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3h-3zM20 14v7M14 20h3" />
                </svg>
              </span>
              {t.switchToQr}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubPage("register")}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 hover:text-[#07C160] dark:text-slate-400"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <WeChatLogo size={40} />
            </span>
            {t.register}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

// ----- sub components -----
function MobileShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#EDEDED] px-6 pb-10 pt-16 dark:bg-slate-900 sm:min-h-0 sm:rounded-[32px] sm:pt-16 md:px-10">
      <div className="mb-10 flex flex-col items-center text-center">
        <WeChatLogo size={64} />
        <h1 className="mt-5 text-xl font-medium text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      <div className="w-full max-w-sm self-center">{children}</div>
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  leading,
  suffix,
  autoComplete,
  maxLength,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  leading?: React.ReactNode;
  suffix?: React.ReactNode;
  autoComplete?: string;
  maxLength?: number;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
      )}
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-md border-b bg-transparent px-2 transition-colors",
          error
            ? "border-rose-400 dark:border-rose-500"
            : "border-slate-200 focus-within:border-[#07C160] dark:border-slate-700 dark:focus-within:border-emerald-500"
        )}
      >
        {leading && <span className="shrink-0">{leading}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className="h-full flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  loading,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-md text-[15px] font-medium text-white transition-all",
        disabled
          ? "cursor-not-allowed bg-[#9ED9BB] dark:bg-emerald-900/60 dark:text-emerald-200/60"
          : "bg-[#07C160] hover:bg-[#06ad56] active:bg-[#059a4d]"
      )}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

function Stepper({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="mb-6 flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium",
              i <= step
                ? "border-[#07C160] bg-[#07C160] text-white"
                : "border-slate-300 text-slate-400 dark:border-slate-600"
            )}
          >
            {i < step ? "✓" : i + 1}
          </div>
          <span className={i <= step ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          )}
        </div>
      ))}
    </div>
  );
}
