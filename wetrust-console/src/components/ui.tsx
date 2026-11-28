import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';

export const cn = (...values: Array<string | false | null | undefined>): string =>
  values.filter(Boolean).join(' ');

export type Tone =
  | 'slate'
  | 'gray'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'violet'
  | 'orange'
  | 'dark';

export const TONE_STYLES: Record<Tone, { badge: string; dot: string; soft: string; text: string }> = {
  slate: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', soft: 'bg-slate-50', text: 'text-slate-600' },
  gray: { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', soft: 'bg-gray-50', text: 'text-gray-600' },
  emerald: { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', soft: 'bg-emerald-50/70', text: 'text-emerald-700' },
  amber: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', soft: 'bg-amber-50/70', text: 'text-amber-700' },
  rose: { badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', soft: 'bg-rose-50/70', text: 'text-rose-700' },
  sky: { badge: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500', soft: 'bg-sky-50/70', text: 'text-sky-700' },
  violet: { badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500', soft: 'bg-violet-50/70', text: 'text-violet-700' },
  orange: { badge: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500', soft: 'bg-orange-50/70', text: 'text-orange-700' },
  dark: { badge: 'bg-[#111827] text-white', dot: 'bg-[#111827]', soft: 'bg-gray-50', text: 'text-[#111827]' },
};

export const Badge: React.FC<{
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}> = ({ tone = 'slate', children, dot = true, className }) => {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        styles.badge,
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)} />}
      {children}
    </span>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'orange';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.16)] hover:bg-[#242d3d] active:scale-[0.985]',
  secondary:
    'bg-white text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] hover:bg-[#F9FAFB] hover:text-[#111827] active:scale-[0.985]',
  ghost: 'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]',
  danger:
    'bg-rose-600 text-white shadow-[0_2px_8px_rgba(225,29,72,0.2)] hover:bg-rose-700 active:scale-[0.985]',
  success:
    'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.2)] hover:bg-emerald-700 active:scale-[0.985]',
  orange:
    'bg-orange-500 text-white shadow-[0_2px_8px_rgba(249,115,22,0.22)] hover:bg-orange-600 active:scale-[0.985]',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'xs';
    icon?: React.ReactNode;
  }
> = ({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props }) => {
  const sizeClass =
    size === 'xs'
      ? 'gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg'
      : size === 'sm'
        ? 'gap-1.5 px-3 py-2 text-xs rounded-xl'
        : 'gap-2 px-4 py-2.5 text-[13px] rounded-xl';
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        sizeClass,
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};

export const IconButton: React.FC<{
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'danger';
}> = ({ label, onClick, children, className, tone = 'default' }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={cn(
      'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors',
      tone === 'danger'
        ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
        : 'text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]',
      className
    )}
  >
    {children}
  </button>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_-12px_rgba(15,23,42,0.08)]',
      className
    )}
  >
    {children}
  </div>
);

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}> = ({ eyebrow, title, description, actions, meta }) => (
  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
    <div className="min-w-0">
      {eyebrow && (
        <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-[#9CA3AF] uppercase">
          <span className="h-1 w-1 rounded-full bg-orange-500" />
          {eyebrow}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">{title}</h1>
        {meta}
      </div>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#6B7280]">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
  </div>
);

export const SectionTitle: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, right, className }) => (
  <div className={cn('flex items-start justify-between gap-3', className)}>
    <div>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#111827]">{title}</h3>
      {subtitle && <p className="mt-1 text-xs leading-relaxed text-[#9CA3AF]">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const FormField: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, hint, error, required, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="flex items-center gap-1 text-xs font-medium text-[#374151]">
      {label}
      {required && <span className="text-rose-500">*</span>}
      {hint && <span className="ml-auto font-normal text-[11px] text-[#9CA3AF]">{hint}</span>}
    </label>
    {children}
    {error && (
      <p className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
        <AlertTriangle className="h-3 w-3" /> {error}
      </p>
    )}
  </div>
);

export const inputClass =
  'w-full rounded-xl bg-[#F9FAFB] px-3.5 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]';

export const TextInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
> = ({ className, ...props }) => <input {...props} className={cn(inputClass, className)} />;

export const Textarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }
> = ({ className, ...props }) => (
  <textarea {...props} className={cn(inputClass, 'resize-none leading-relaxed', className)} />
);

export const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { className?: string }
> = ({ className, children, ...props }) => (
  <select {...props} className={cn(inputClass, 'cursor-pointer pr-2', className)}>
    {children}
  </select>
);

export const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  className?: string;
}> = ({ value, onChange, placeholder, icon, className }) => (
  <div className={cn('relative', className)}>
    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#9CA3AF]">
      {icon}
    </span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(inputClass, 'pl-9 pr-8')}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-[#9CA3AF] hover:text-[#374151]"
        aria-label="清空"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export const Switch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label ?? '切换'}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
      checked ? 'bg-[#111827]' : 'bg-[#E5E7EB]'
    )}
  >
    <span
      className={cn(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      )}
    />
  </button>
);

export const Avatar: React.FC<{ name: string; tone?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  name,
  tone = 'bg-[#111827]',
  size = 'md',
}) => {
  const px = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-xs' : 'h-9 w-9 text-[11px]';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-white shadow-[0_2px_6px_rgba(15,23,42,0.12)]',
        px,
        tone
      )}
    >
      {name.slice(0, 2)}
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer, size = 'md', icon }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        // 焦点陷阱：Tab / Shift+Tab 只在弹窗内循环，避免焦点逃逸到背景页面
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    const firstFocus = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const focusTimer = window.setTimeout(() => firstFocus?.focus(), 30);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const width =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B1220]/35 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-modal-in flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]',
          width
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#374151]">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-[#111827]">{title}</h2>
              {subtitle && <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{subtitle}</p>}
            </div>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 bg-[#F9FAFB]/70 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------------------------- Toast --------------------------------- */

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="false" className="pointer-events-none fixed right-5 bottom-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl bg-[#111827] px-4 py-3.5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)]"
          >
            <span className="mt-0.5 shrink-0">
              {item.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : item.tone === 'error' ? (
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              ) : (
                <Check className="h-4 w-4 text-sky-400" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              className="ml-auto shrink-0 cursor-pointer text-gray-500 hover:text-white"
              aria-label="关闭通知"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => useContext(ToastContext);

/* --------------------------------- 通用区块 -------------------------------- */

export const Tabs: React.FC<{
  items: { key: string; label: string; count?: number; tone?: Tone }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}> = ({ items, active, onChange, className }) => (
  <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
    {items.map((item) => {
      const selected = item.key === active;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
            selected
              ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.14)]'
              : 'bg-white text-[#6B7280] shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:text-[#111827]'
          )}
        >
          {item.label}
          {typeof item.count === 'number' && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 font-mono text-[10px]',
                selected ? 'bg-white/15 text-white' : 'bg-[#F3F4F6] text-[#6B7280]'
              )}
            >
              {item.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const Pagination: React.FC<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}> = ({ page, pageSize, total, onPageChange }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-2 pt-5 sm:flex-row">
      <p className="text-xs text-[#9CA3AF]">
        共 <span className="font-mono text-[#374151]">{total}</span> 条记录 · 当前显示 {start}-{end}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#F9FAFB] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .slice(0, 6)
          .map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onPageChange(num)}
              className={cn(
                'h-8 min-w-8 cursor-pointer rounded-lg px-2 font-mono text-xs transition-colors',
                num === page
                  ? 'bg-[#111827] text-white'
                  : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
              )}
            >
              {num}
            </button>
          ))}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#F9FAFB] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* clipboard 不可用时依然给出反馈 */
        }
        setCopied(true);
        push({ title: '已复制到剪贴板', description: value, tone: 'success' });
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
      title="复制"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, icon, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F9FAFB] text-[#9CA3AF]">
      {icon}
    </div>
    <p className="mt-4 text-sm font-medium text-[#374151]">{title}</p>
    <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#9CA3AF]">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const MiniSparkline: React.FC<{ values: number[]; color?: string }> = ({
  values,
  color = '#10B981',
}) => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 72;
      const y = 22 - ((value - min) / Math.max(1, max - min)) * 18;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width="72" height="26" viewBox="0 0 72 26" fill="none" aria-hidden="true">
      <polyline points={points} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const downloadCsv = (filename: string, headers: string[], rows: string[][]): void => {
  // 防止 Excel / 表格软件将不可信字段当作公式执行。
  const escape = (cell: string) => {
    const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const useConfirmState = (): {
  pending: string | null;
  request: (id: string) => void;
  clear: () => void;
} => {
  const [pending, setPending] = useState<string | null>(null);
  return {
    pending,
    request: (id: string) => setPending(id),
    clear: () => setPending(null),
  };
};
