/**
 * 安全存储：优先使用 localStorage，不可用时（隐私模式、被禁用存储的 iframe 等）
 * 自动降级为内存存储，保证登录等关键流程不会因存储异常而中断。
 */
const memory = new Map<string, string>();

let available: boolean | null = null;

const canUseLocalStorage = (): boolean => {
  if (available !== null) return available;
  try {
    const probe = '__wt_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch {
    available = false;
  }
  return available;
};

export const storage = {
  get(key: string): string | null {
    if (canUseLocalStorage()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string): void {
    memory.set(key, value);
    if (canUseLocalStorage()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* 配额或权限异常时保留内存副本即可 */
      }
    }
  },
  remove(key: string): void {
    memory.delete(key);
    if (canUseLocalStorage()) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* 忽略 */
      }
    }
  },
  /** 当前是否持久化到浏览器（false 表示仅本次会话有效） */
  isPersistent(): boolean {
    return canUseLocalStorage();
  },
};
