import React from 'react';

const Block: React.FC<{ className: string }> = ({ className }) => <div className={`skeleton rounded-xl ${className}`} />;

/** 路由切换骨架屏：与真实页面布局一致（标题 → 指标卡 → 主表格） */
export const PageSkeleton: React.FC = () => (
  <div className="space-y-5" aria-busy="true" aria-label="页面加载中">
    <div className="space-y-2">
      <Block className="h-3 w-40" />
      <Block className="h-7 w-64" />
      <Block className="h-3 w-[28rem] max-w-full" />
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Block className="h-3 w-20" />
          <Block className="h-6 w-28" />
          <Block className="h-2.5 w-24" />
        </div>
      ))}
    </div>
    <div className="space-y-3 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <Block className="h-9 w-full" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Block className="h-9 w-9 shrink-0 rounded-full" />
          <Block className="h-3 flex-1" />
          <Block className="h-3 w-24" />
          <Block className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);
