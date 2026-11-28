import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass, MousePointerClick, Search, Settings2, X } from 'lucide-react';
import { Button, cn } from './ui';

interface TourStep {
  target: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: 'nav[aria-label="业务导航"]',
    icon: Compass,
    title: '左侧是业务导航',
    body: '按域分组的全部模块；悬停菜单项可一键收藏到「常用」，最近访问会自动记录最近 6 个页面。',
  },
  {
    target: '[aria-label="工作区页签"]',
    icon: MousePointerClick,
    title: '页签工作区，页面保活',
    body: '打开过的页面都变成可关闭页签：右键页签可关闭/刷新，切换时筛选、弹窗和滚动位置全部保留。',
  },
  {
    target: 'input[placeholder="搜索页面、模块或功能..."]',
    icon: Search,
    title: '⌘K 全局命令面板',
    body: '随时按 ⌘K / Ctrl+K 打开命令面板，搜索页面、切换角色、开关水印与密度，全程键盘操作。',
  },
  {
    target: 'button[aria-label="偏好设置"]',
    icon: Settings2,
    title: '偏好设置在这里',
    body: '内容水印防截屏外泄，紧凑密度适合大屏巡检，偏好会自动保存。',
  },
];

interface OnboardingTourProps {
  readDone: () => boolean;
  markDone: () => void;
}

/** 首次访问引导：四步高亮讲解，完成后按用户持久化 */
export const OnboardingTour: React.FC<OnboardingTourProps> = ({ readDone, markDone }) => {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (readDone()) return;
    const timer = window.setTimeout(() => setStep(0), 600);
    return () => window.clearTimeout(timer);
  }, [readDone]);

  useEffect(() => {
    if (step < 0) return;
    const measure = () => {
      const el = document.querySelector(STEPS[step].target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    const timer = window.setInterval(measure, 800);
    return () => {
      window.removeEventListener('resize', measure);
      window.clearInterval(timer);
    };
  }, [step]);

  if (step < 0) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const finish = () => {
    setStep(-1);
    markDone();
  };

  // 气泡位置：优先放在目标下方，空间不足放上方
  const placeBelow = rect ? rect.bottom + 340 < window.innerHeight : true;
  const bubbleStyle: React.CSSProperties = rect
    ? {
        top: placeBelow ? rect.bottom + 12 : undefined,
        bottom: placeBelow ? undefined : window.innerHeight - rect.top + 12,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 360)),
      }
    : { top: '30%', left: '50%', transform: 'translateX(-50%)' };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-[#0B1220]/45" onClick={finish} aria-hidden="true" />
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[71] rounded-2xl border-2 border-orange-400 shadow-[0_0_0_6px_rgba(249,115,22,0.18)] transition-all duration-300"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`新手引导 第 ${step + 1} / ${STEPS.length} 步：${current.title}`}
        style={bubbleStyle}
        className="animate-modal-in fixed z-[72] w-[344px] rounded-2xl bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.35)]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#111827]">{current.title}</h3>
              <button type="button" onClick={finish} aria-label="跳过引导" className="cursor-pointer rounded-md p-1 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#6B7280]">{current.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label="引导进度">
            {STEPS.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-orange-500' : 'w-1.5 bg-[#E5E7EB]')} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Button size="sm" variant="secondary" onClick={() => setStep(step - 1)}>上一步</Button>}
            {step < STEPS.length - 1 ? (
              <Button size="sm" variant="primary" icon={<ArrowRight className="h-3 w-3" />} onClick={() => setStep(step + 1)}>下一步</Button>
            ) : (
              <Button size="sm" variant="primary" onClick={finish}>开始使用</Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
