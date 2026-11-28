import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Undo2,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  ExternalLink,
  Boxes,
  Headphones,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  MessagesSquare,
  ReceiptText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  UserRound,
  Wallet,
  X,
  Star,
  Clock3,
  ClipboardCheck,
  Files,
  Settings2,
} from 'lucide-react';
import { ToastProvider, useToast, cn } from './components/ui';
import {
  AUDIT_LOGS,
  BLACKLIST_ENTRIES,
  CHAT_GROUPS,
  DEFAULT_EXPANDED_NAV_IDS,
  MERCHANT_APPLICATIONS,
  MOMENT_QUEUE,
  NAV_TREE,
  MASS_TRANSACTIONS,
  REFUND_EXCEPTIONS,
  RISK_STRATEGIES,
  ROLE_OPTIONS,
} from './lib/data';
import type {
  AuditLog,
  BlacklistEntry,
  ChatGroup,
  MerchantApplication,
  MerchantStatus,
  NavItem,
  PaymentTransaction,
  RefundException,
  RiskStrategy,
  Role,
  RouteKey,
} from './lib/types';
import { OverviewPage } from './pages/Overview';
import { MerchantDetailPage, MerchantListPage } from './pages/Merchants';
import { RefundExceptionsPage, TransactionsPage } from './pages/Payments';
import { BlacklistPage, StrategiesPage } from './pages/Risk';
import { ContentAuditPage, GroupManagementPage } from './pages/Content';
import { AuditLogPage, ContractsPage } from './pages/Contracts';
import { MarketingPage, SettlementPage } from './pages/Settlement';
import { RiskEventsPage, StrategyLabPage } from './pages/RiskBrain';
import { ImAuditPage, LiveWallPage } from './pages/SocialDeep';
import { MiniReviewPage, MpArticlePage } from './pages/OpenEco';
import { TicketsPage, TouchPage } from './pages/Service';
import { ALERT_POOL, EXT_NAV, EXT_ROUTES } from './lib/ops';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/PageSkeleton';
import { LoginPage } from './pages/Login';
import { storage } from './lib/storage';
import type { LoginSession } from './pages/Login';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 演示会话 2 小时
import { CommandPalette } from './components/CommandPalette';
import type { PaletteItem } from './components/CommandPalette';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { ConsolePreferences, ContentWatermark } from './components/ConsolePreferences';
import { OnboardingTour } from './components/OnboardingTour';
import { PLATFORM_NAV, APPROVAL_ROLES, INITIAL_APPROVALS, INITIAL_OPERATORS, DEFAULT_SECURITY_POLICY, REPORT_TEMPLATES } from './lib/platform';
import type { ApprovalItem, ExportJob, OperatorAccount, UiPreferences, WorkspaceTab, ReportKey, SecurityPolicy } from './lib/types';
import { ApprovalCenterPage } from './pages/ApprovalCenter';
import { PlatformSettingsPage } from './pages/PlatformSettings';
import { ExportCenterPage, buildReport } from './pages/ExportCenter';
import { saveDemoCredential } from './lib/platformCredentials';
import { downloadCsv } from './components/ui';
import { TICKETS } from './lib/ops';
import type { Ticket } from './lib/ops';

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Wallet,
  ShieldAlert,
  MessagesSquare,
  Layers3,
  Boxes,
  Headphones,
  ClipboardCheck,
  Files,
  Settings2,
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: '超级管理员',
  finance: '支付清结算专员',
  risk_ops: '风控运营专员',
  moderator: '内容审核专员',
};

const BASE_ROUTES_BY_ROLE: Record<Role, RouteKey[]> = {
  super_admin: [
    'overview',
    'merchants',
    'merchant-detail',
    'transactions',
    'refunds',
    'strategies',
    'blacklist',
    'content-audit',
    'content-groups',
    'contracts',
    'audit-logs',
    'approvals',
    'export-center',
    'platform-settings',
  ],
  finance: ['overview', 'merchants', 'merchant-detail', 'transactions', 'refunds', 'approvals', 'export-center'],
  risk_ops: ['overview', 'strategies', 'blacklist', 'approvals', 'export-center'],
  moderator: ['overview', 'content-audit', 'content-groups', 'approvals', 'export-center'],
};

const ALL_ROUTES_BY_ROLE: Record<Role, RouteKey[]> = {
  super_admin: [...BASE_ROUTES_BY_ROLE.super_admin, ...EXT_ROUTES.super_admin],
  finance: [...BASE_ROUTES_BY_ROLE.finance, ...EXT_ROUTES.finance],
  risk_ops: [...BASE_ROUTES_BY_ROLE.risk_ops, ...EXT_ROUTES.risk_ops],
  moderator: [...BASE_ROUTES_BY_ROLE.moderator, ...EXT_ROUTES.moderator],
};

/** 按业务域重排导航：监控 → 资金 → 风控 → 内容 → 生态 → 服务 → 系统 */
const NAV_ORDER = ['overview', 'approvals', 'pay', 'pay-extra', 'risk', 'risk-extra', 'content', 'social-deep', 'open', 'service', 'export-center', 'system', 'platform-settings'];
const NAV_SECTION_START: Record<string, string> = {
  overview: '总览 Overview',
  approvals: '工作台 Workspace',
  pay: '资金 Payments',
  risk: '风控 Risk',
  content: '内容 Content',
  open: '生态 Open',
  service: '服务 Service',
  'export-center': '数据 Data',
  system: '系统 System',
};

const FULL_NAV_TREE: NavItem[] = [...NAV_TREE, ...EXT_NAV, ...PLATFORM_NAV].sort(
  (a, b) => NAV_ORDER.indexOf(a.id) - NAV_ORDER.indexOf(b.id)
);

const makeWorkspaceTab = (route: RouteKey, merchantNo?: string): WorkspaceTab => ({
  id: route === 'merchant-detail' ? `${route}:${merchantNo ?? MERCHANT_APPLICATIONS[0].merchant_no}` : route,
  route,
  merchant_no: route === 'merchant-detail' ? merchantNo ?? MERCHANT_APPLICATIONS[0].merchant_no : undefined,
  label: route === 'merchant-detail' ? `进件 · ${MERCHANT_APPLICATIONS.find((m) => m.merchant_no === merchantNo)?.company_short ?? '商户详情'}` : findNavTrail(FULL_NAV_TREE, route).slice(-1)[0] ?? route,
  revision: 0,
});

interface ClosedWorkspaceSnapshot {
  tabs: WorkspaceTab[];
  activeId: string;
  readyIds: string[];
  positions: Record<string, number>;
  label: string;
}

const savedRoutes = (key: string, limit: number): RouteKey[] => {
  try {
    const parsed = JSON.parse(storage.get(key) ?? '[]') as unknown;
    return Array.isArray(parsed) ? [...new Set(parsed.filter((item): item is RouteKey => typeof item === 'string' && ALL_ROUTE_KEYS.includes(item as RouteKey)))].slice(0, limit) : [];
  } catch { return []; }
};

const ALL_ROUTE_KEYS: RouteKey[] = Array.from(new Set(Object.values(ALL_ROUTES_BY_ROLE).flat()));

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
};

const getSessionTtl = (): number => {
  try {
    const policy = JSON.parse(storage.get('wt.securityPolicy') ?? '{}') as Partial<SecurityPolicy>;
    return Math.max(30, Math.min(720, policy.session_minutes ?? 120)) * 60_000;
  } catch { return SESSION_TTL_MS; }
};

const SessionClock: React.FC<{ session: LoginSession; minutes: number; onLogout: () => void; onWarn: (notice: { title: string; description: string; tone: 'info' }) => void }> = ({ session, minutes, onLogout, onWarn }) => {
  const [remaining, setRemaining] = useState(() => minutes * 60_000 - (Date.now() - session.loginAt));
  const warned = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = minutes * 60_000 - (Date.now() - session.loginAt);
      setRemaining(left);
      if (left <= 300000 && left > 0 && !warned.current) { warned.current = true; onWarn({ title: '会话即将过期', description: '5 分钟后自动退出，请保存操作', tone: 'info' }); }
      if (left <= 0) onLogout();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.loginAt, minutes, onLogout, onWarn]);
  return <span className="hidden items-center gap-1.5 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 font-mono text-[10px] text-[#6B7280] xl:inline-flex" title="会话剩余时间">会话 {formatDuration(remaining)}</span>;
};

const nowStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const readHashRoute = (): RouteKey | null => {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0] as RouteKey;
  return ALL_ROUTE_KEYS.includes(raw) ? raw : null;
};

const FALLBACK_ROUTE: Record<Role, RouteKey> = {
  super_admin: 'overview',
  finance: 'merchants',
  risk_ops: 'strategies',
  moderator: 'content-audit',
};

const filterNavByRole = (items: NavItem[], role: Role): NavItem[] => {
  const result: NavItem[] = [];
  items.forEach((item) => {
    if (!item.roles.includes(role)) return;
    if (item.children && item.children.length > 0) {
      const children = filterNavByRole(item.children, role);
      if (children.length > 0) result.push({ ...item, children });
    } else if (item.route) {
      result.push({ ...item });
    }
  });
  return result;
};

const findNavTrail = (items: NavItem[], route: RouteKey, trail: string[] = []): string[] => {
  for (const item of items) {
    const nextTrail = [...trail, item.label];
    if (item.route === route) return nextTrail;
    if (item.children) {
      const found = findNavTrail(item.children, route, nextTrail);
      if (found.length > 0) return found;
    }
  }
  return [];
};

const collectNavIds = (items: NavItem[]): string[] => {
  const ids: string[] = [];
  items.forEach((item) => {
    if (item.children && item.children.length > 0) {
      ids.push(item.id, ...collectNavIds(item.children));
    }
  });
  return ids;
};

const collectSearchEntries = (
  items: NavItem[],
  trail: string[] = []
): { item: NavItem; trail: string[] }[] => {
  const entries: { item: NavItem; trail: string[] }[] = [];
  items.forEach((item) => {
    const nextTrail = [...trail, item.label];
    if (item.children) entries.push(...collectSearchEntries(item.children, nextTrail));
    else if (item.route) entries.push({ item, trail: nextTrail });
  });
  return entries;
};

interface NavTreeNodeProps {
  item: NavItem;
  depth: number;
  expanded: string[];
  activeRoute: RouteKey;
  onToggle: (id: string) => void;
  onNavigate: (route: RouteKey) => void;
  favorites: RouteKey[];
  onToggleFavorite: (route: RouteKey) => void;
}

const NavTreeNode: React.FC<NavTreeNodeProps> = ({ item, depth, expanded, activeRoute, onToggle, onNavigate, favorites, onToggleFavorite }) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const isExpanded = expanded.includes(item.id);
  const isActive = item.route === activeRoute;
  const subtreeActive = item.children?.some((child) => {
    const check = (node: NavItem): boolean =>
      node.route === activeRoute || Boolean(node.children?.some(check));
    return check(child);
  }) ?? false;
  const Icon = item.icon ? NAV_ICONS[item.icon] : undefined;

  return (
    <li className="group/menu relative">
      <button
        type="button"
        onClick={() => {
          if (hasChildren) onToggle(item.id);
          if (item.route) onNavigate(item.route);
        }}
        style={{ paddingLeft: `${depth === 1 ? 12 : 14 + (depth - 1) * 14}px` }}
        className={cn(
          'group flex w-full cursor-pointer items-center justify-between rounded-xl py-2.5 pr-7 text-left transition-all duration-150',
          isActive
            ? 'bg-[#111827] text-white shadow-[0_4px_14px_-6px_rgba(17,24,39,0.35)]'
            : subtreeActive
              ? 'bg-[#F9FAFB] text-[#111827]'
              : 'text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]'
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-orange-400' : 'text-[#9CA3AF]')} />
          ) : (
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                isActive ? 'bg-orange-400' : subtreeActive ? 'bg-[#111827]' : 'bg-[#D1D5DB]'
              )}
            />
          )}
          <span className={cn('truncate', depth === 1 ? 'text-[12.5px] font-medium' : 'text-[12px]')}>
            {item.label}
          </span>
          {depth === 1 && (
            <span className={cn('hidden font-mono text-[8px] uppercase xl:inline', isActive ? 'text-white/40' : 'text-[#C0C6CF]')}>
              {item.en.split(' ')[0]}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {item.badge && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium',
                isActive ? 'bg-white/15 text-white' : item.badge ? 'bg-orange-50 text-orange-600' : 'bg-[#F3F4F6] text-[#9CA3AF]'
              )}
            >
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <ChevronRight
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                isExpanded ? 'rotate-90' : 'rotate-0',
                isActive ? 'text-white/70' : 'text-[#9CA3AF]'
              )}
            />
          )}
        </span>
      </button>

      {!hasChildren && item.route && (
        <button type="button" aria-label={`${favorites.includes(item.route) ? '取消收藏' : '收藏'} ${item.label}`} title={favorites.includes(item.route) ? '取消收藏' : '收藏到常用'} onClick={() => onToggleFavorite(item.route!)} className={cn('absolute right-2 top-2.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md transition-opacity hover:bg-orange-50', favorites.includes(item.route) ? 'text-orange-500 opacity-100' : 'text-[#9CA3AF] opacity-0 group-hover/menu:opacity-100 focus:opacity-100')}><Star className={cn('h-3 w-3', favorites.includes(item.route) && 'fill-current')} /></button>
      )}

      {hasChildren && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <ul className="mt-0.5 space-y-0.5">
              {item.children!.map((child) => (
                <NavTreeNode
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  expanded={expanded}
                  activeRoute={activeRoute}
                  onToggle={onToggle}
                  onNavigate={onNavigate}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
};

const Shell: React.FC<{ session: LoginSession; onLogout: () => void }> = ({ session, onLogout }) => {
  const { push } = useToast();
  const [role, setRole] = useState<Role>(() => {
    return session.role;
  });
  const [route, setRoute] = useState<RouteKey>(() => {
    const fromHash = readHashRoute();
    const savedRole = session.role;
    const allowed = ALL_ROUTES_BY_ROLE[savedRole] ?? ALL_ROUTES_BY_ROLE.super_admin;
    return fromHash && allowed.includes(fromHash) ? fromHash : 'overview';
  });
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [makeWorkspaceTab(route)]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const [activeTabId, setActiveTabId] = useState<string>(() => makeWorkspaceTab(route).id);
  const [readyTabIds, setReadyTabIds] = useState<string[]>([]);
  const [closedSnapshot, setClosedSnapshot] = useState<ClosedWorkspaceSnapshot | null>(null);
  const paneRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollPositions = useRef<Record<string, number>>({});
  const [favorites, setFavorites] = useState<RouteKey[]>(() => savedRoutes(`wt.favorites.${session.username}`, 8));
  const [recent, setRecent] = useState<RouteKey[]>(() => savedRoutes(`wt.recent.${session.username}`, 6));
  const [preferences, setPreferences] = useState<UiPreferences>(() => {
    try { return { watermark: true, compact: false, ...JSON.parse(storage.get(`wt.preferences.${session.username}`) ?? '{}') as Partial<UiPreferences> }; }
    catch { return { watermark: true, compact: false }; }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => storage.get('wt.sidebar') === 'rail');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    try { const raw = storage.get(`wt.readNotices.${session.username}`); const parsed = JSON.parse(raw ?? '[]'); return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string[]>(DEFAULT_EXPANDED_NAV_IDS);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [merchants, setMerchants] = useState<MerchantApplication[]>(MERCHANT_APPLICATIONS);
  const [transactions] = useState<PaymentTransaction[]>(MASS_TRANSACTIONS);
  const [refunds, setRefunds] = useState<RefundException[]>(REFUND_EXCEPTIONS);
  const [strategies, setStrategies] = useState<RiskStrategy[]>(RISK_STRATEGIES);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(BLACKLIST_ENTRIES);
  const [groups, setGroups] = useState<ChatGroup[]>(CHAT_GROUPS);
  const [logs, setLogs] = useState<AuditLog[]>(() => [
    {
      log_id: `LOG-${String(session.loginAt).slice(-6)}`,
      operator: session.displayName,
      role: session.role,
      module: '登录认证',
      action: '登录成功（密码 + 短信验证）',
      target: session.username,
      ip: '10.20.31.8',
      result: 'success',
      created_at: nowStamp(),
    },
    ...AUDIT_LOGS,
  ]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>(INITIAL_APPROVALS);
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS);
  const [accounts, setAccounts] = useState<OperatorAccount[]>(() => {
    try { const stored = JSON.parse(storage.get('wt.operators') ?? 'null') as OperatorAccount[] | null; return Array.isArray(stored) && stored.length >= 7 ? stored : INITIAL_OPERATORS; }
    catch { return INITIAL_OPERATORS; }
  });
  const [policy, setPolicy] = useState<SecurityPolicy>(() => {
    try { return { ...DEFAULT_SECURITY_POLICY, ...JSON.parse(storage.get('wt.securityPolicy') ?? '{}') }; }
    catch { return DEFAULT_SECURITY_POLICY; }
  });
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const reportSnapshots = useRef<Record<string, ReturnType<typeof buildReport>>>({});

  // 只有超级管理员可以模拟其他角色视角；其余账号的角色固定为登录身份
  const canSimulate = session.role === 'super_admin';
  const simulating = role !== session.role;

  const searchRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef(push);
  toastRef.current = push;

  const visibleNav = useMemo(() => filterNavByRole(FULL_NAV_TREE, role), [role]);
  const authorizedRoutes = ALL_ROUTES_BY_ROLE[role];
  const visibleFavorites = favorites.filter((item) => authorizedRoutes.includes(item));
  const visibleRecent = recent.filter((item) => authorizedRoutes.includes(item));
  const approvalCount = approvals.filter((item) => item.status === 'pending' && APPROVAL_ROLES[item.category].includes(role)).length;



  const appendLog = (action: string, target: string, module: string, result: 'success' | 'failed' = 'success') => {
    const next: AuditLog = {
      log_id: `LOG-${98300 + Math.floor(Math.random() * 600)}`,
      operator: session.displayName,
      role: session.role,
      module,
      action,
      target,
      ip: '10.20.31.8',
      result,
      created_at: nowStamp(),
    };
    setLogs((prev) => [next, ...prev]);
  };

  const notify = (title: string, description?: string, tone: 'success' | 'error' | 'info' = 'success') => {
    toastRef.current({ title, description, tone });
  };

  const recordRecent = (nextRoute: RouteKey) => {
    setRecent((prev) => [nextRoute, ...prev.filter((r) => r !== nextRoute)].slice(0, 6));
  };

  const openTab = (nextRoute: RouteKey, merchantNo?: string) => {
    if (!ALL_ROUTES_BY_ROLE[role].includes(nextRoute)) {
      push({ title: '无访问权限', description: `当前角色 ${ROLE_LABEL[role]} 无权访问该模块`, tone: 'error' });
      return;
    }
    const next = makeWorkspaceTab(nextRoute, merchantNo);
    setTabs((prev) => prev.some((t) => t.id === next.id) ? prev : [...prev, next]);
    setActiveTabId(next.id);
    setRoute(nextRoute);
    recordRecent(nextRoute);
    setMobileSidebarOpen(false);
    setSearchFocused(false);
    setSearch('');
  };

  const activateTab = (id: string) => {
    const next = tabs.find((t) => t.id === id);
    if (!next) return;
    setActiveTabId(id);
    setRoute(next.route);
    recordRecent(next.route);
  };

  const closeTab = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    setClosedSnapshot({ tabs: [tabs[idx]], activeId: id, readyIds: readyTabIds.filter((key) => key === id), positions: { [id]: scrollPositions.current[id] ?? 0 }, label: tabs[idx].label });
    const next = tabs.filter((t) => t.id !== id);
    setTabs(next);
    setReadyTabIds((prev) => prev.filter((key) => key !== id));
    if (activeTabId === id) {
      const candidate = next[Math.min(idx, next.length - 1)];
      setActiveTabId(candidate?.id ?? '');
      setRoute(candidate?.route ?? 'overview');
    }
  };

  const closeOtherTabs = () => {
    const selected = tabs.find((t) => t.id === activeTabId);
    if (!selected) return;
    const removed = tabs.filter((t) => t.id !== activeTabId);
    setClosedSnapshot({ tabs: removed, activeId: removed[0]?.id ?? '', readyIds: readyTabIds.filter((id) => removed.some((tab) => tab.id === id)), positions: Object.fromEntries(removed.map((t) => [t.id, scrollPositions.current[t.id] ?? 0])), label: `${removed.length} 个其他页签` });
    setTabs([selected]);
    setReadyTabIds((prev) => prev.filter((id) => id === selected.id));
  };

  const closeAllTabs = () => {
    if (tabs.length === 0) return;
    setClosedSnapshot({ tabs: [...tabs], activeId: activeTabId, readyIds: [...readyTabIds], positions: Object.fromEntries(tabs.map((t) => [t.id, scrollPositions.current[t.id] ?? 0])), label: `${tabs.length} 个页签` });
    setTabs([]);
    setReadyTabIds([]);
    setActiveTabId('');
    setRoute('overview');
  };

  const restoreClosedTabs = () => {
    if (!closedSnapshot) return;
    const allowed = closedSnapshot.tabs.filter((t) => ALL_ROUTES_BY_ROLE[role].includes(t.route));
    if (allowed.length === 0) { setClosedSnapshot(null); notify('无法恢复', '当前角色无权访问此前关闭的页签', 'error'); return; }
    const restored = [...tabs];
    for (const tab of allowed) if (!restored.some((t) => t.id === tab.id)) restored.push(tab);
    setTabs(restored);
    setReadyTabIds((prev) => [...new Set([...prev, ...closedSnapshot.readyIds.filter((id) => allowed.some((t) => t.id === id))])]);
    Object.assign(scrollPositions.current, closedSnapshot.positions);
    const target = allowed.find((t) => t.id === closedSnapshot.activeId) ?? allowed[0];
    setActiveTabId(target.id);
    setRoute(target.route);
    setClosedSnapshot(null);
    notify('页签已恢复', `「${target.label}」的筛选、弹窗和滚动位置仍在`, 'success');
  };

  useEffect(() => {
    if (!closedSnapshot) return;
    const timer = window.setTimeout(() => {
      for (const tab of closedSnapshot.tabs) {
        if (!tabsRef.current.some((t) => t.id === tab.id)) {
          delete scrollPositions.current[tab.id];
          delete paneRefs.current[tab.id];
        }
      }
      setClosedSnapshot(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [closedSnapshot]);

  const refreshTab = (id: string = activeTabId) => {
    if (!id || !tabs.some((tab) => tab.id === id)) return;
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, revision: t.revision + 1 } : t));
    setReadyTabIds((prev) => prev.filter((key) => key !== id));
    scrollPositions.current[id] = 0;
    notify('页签已刷新', '该页未保存的筛选条件、弹窗与草稿已重置', 'info');
  };

  const toggleFavorite = (favoriteRoute: RouteKey) => {
    if (!favorites.includes(favoriteRoute) && favorites.length >= 8) {
      notify('收藏已达上限', '最多收藏 8 个页面，请先取消一项', 'error');
      return;
    }
    setFavorites((prev) => {
      if (prev.includes(favoriteRoute)) return prev.filter((r) => r !== favoriteRoute);
      return [...prev, favoriteRoute];
    });
  };

  useEffect(() => { storage.set(`wt.favorites.${session.username}`, JSON.stringify(favorites)); }, [favorites, session.username]);
  useEffect(() => { storage.set(`wt.recent.${session.username}`, JSON.stringify(recent)); }, [recent, session.username]);
  useEffect(() => { storage.set(`wt.preferences.${session.username}`, JSON.stringify(preferences)); }, [preferences, session.username]);
  useEffect(() => { storage.set('wt.operators', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { setRecent((prev) => [route, ...prev.filter((item) => item !== route)].slice(0, 6)); }, [session.username]);

  // 首次打开或主动刷新才展示骨架；已打开的页签仅隐藏 DOM，不卸载页面状态。
  useEffect(() => {
    const missing = tabs.filter((tab) => !readyTabIds.includes(tab.id));
    const timers = missing.map((tab) => window.setTimeout(() => setReadyTabIds((prev) => prev.includes(tab.id) ? prev : [...prev, tab.id]), 240));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [tabs, readyTabIds]);

  useLayoutEffect(() => {
    const pane = paneRefs.current[activeTabId];
    if (pane) pane.scrollTop = scrollPositions.current[activeTabId] ?? 0;
  }, [activeTabId, readyTabIds]);

  const routeLoading = Boolean(activeTabId && !readyTabIds.includes(activeTabId));

  // 路由 ⇄ URL hash 双向同步：刷新保持页面、支持浏览器前进后退
  useEffect(() => {
    if (!activeTabId) { window.history.replaceState(null, '', '#/'); return; }
    const target = `#/${route}`;
    if (!window.location.hash) window.history.replaceState(null, '', target);
    else if (window.location.hash !== target) window.history.pushState(null, '', target);
  }, [route, activeTabId]);

  useEffect(() => {
    const onPop = () => {
      const next = readHashRoute();
      if (!next) return;
      if (!ALL_ROUTES_BY_ROLE[role].includes(next)) {
        toastRef.current({ title: '无访问权限', description: `当前角色无法访问 ${next}`, tone: 'error' });
        window.history.replaceState(null, '', `#/${route}`);
        return;
      }
      openTab(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [role, route]);

  useEffect(() => {
    storage.set('wt.sidebar', collapsed ? 'rail' : 'full');
  }, [collapsed]);

  const navigate = (nextRoute: RouteKey) => {
    openTab(nextRoute);
  };

  const changeRole = (nextRole: Role) => {
    setRoleMenuOpen(false);
    if (!canSimulate) {
      push({ title: '无权切换角色', description: '只有超级管理员可以模拟其他角色视角', tone: 'error' });
      return;
    }
    if (nextRole === role) return;
    const allowed = ALL_ROUTES_BY_ROLE[nextRole];
    const remaining = tabs.filter((tab) => allowed.includes(tab.route));
    setClosedSnapshot(null);
    const active = remaining.find((tab) => tab.id === activeTabId) ?? remaining[0] ?? makeWorkspaceTab(FALLBACK_ROUTE[nextRole]);
    if (!remaining.some((tab) => tab.id === active.id)) remaining.push(active);
    setTabs(remaining);
    setReadyTabIds((prev) => prev.filter((id) => remaining.some((tab) => tab.id === id)));
    setActiveTabId(active.id);
    setRole(nextRole);
    setRoute(active.route);
    if (!ALL_ROUTES_BY_ROLE[nextRole].includes(route)) {
      push({
        title: nextRole === session.role ? '已退出模拟，恢复超级管理员视角' : `正在模拟「${ROLE_LABEL[nextRole]}」视角`,
        description: `已移除无权限页签，并跳转至「${active.label}」`,
        tone: 'info',
      });
    } else {
      push({ title: nextRole === session.role ? '已退出模拟，恢复超级管理员视角' : `正在模拟「${ROLE_LABEL[nextRole]}」视角`, description: `权限范围：${ROLE_OPTIONS.find((r) => r.role === nextRole)?.scope}`, tone: 'info' });
    }
    setNotificationsOpen(false);
    setProfileOpen(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'w') { event.preventDefault(); setPreferences((p) => ({ ...p, watermark: !p.watermark })); }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); setPreferences((p) => ({ ...p, compact: !p.compact })); }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (!typing && event.key === '?' && !event.metaKey && !event.ctrlKey) window.dispatchEvent(new Event('wt:shortcut-help'));
      if (!typing && event.altKey && event.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(activeTabId); }
      if (!typing && event.altKey && event.key.toLowerCase() === 'r') { event.preventDefault(); refreshTab(); }
      if (!typing && event.altKey && event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); restoreClosedTabs(); }
      if (!typing && event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key) && tabs.length > 1) {
        event.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        activateTab(tabs[(idx + (event.key === 'ArrowLeft' ? tabs.length - 1 : 1)) % tabs.length].id);
      }
      if (event.key === 'Escape') {
        setRoleMenuOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setSearchFocused(false);
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabs, activeTabId]);

  const searchEntries = useMemo(() => collectSearchEntries(visibleNav), [visibleNav]);

  const paletteItems: PaletteItem[] = [
    ...searchEntries.map(({ item, trail: itemTrail }) => ({
      id: `page-${item.id}`,
      group: '页面' as const,
      label: item.label,
      hint: itemTrail.join(' / '),
      keywords: `${item.en} ${item.route ?? ''}`,
      run: () => item.route && navigate(item.route),
    })),
    {
      id: 'act-sidebar',
      group: '操作',
      label: collapsed ? '展开侧边栏' : '收起侧边栏为图标栏',
      hint: '布局 · 偏好将持久化到本地',
      keywords: 'sidebar collapse 侧栏',
      run: () => setCollapsed((v) => !v),
    },
    {
      id: 'act-top',
      group: '操作',
      label: '回到页面顶部',
      hint: '滚动',
      keywords: 'top scroll',
      run: () => paneRefs.current[activeTabId]?.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    { id: 'act-watermark', group: '操作', label: preferences.watermark ? '关闭内容水印' : '开启内容水印', hint: '合规防截屏 · 自动记住偏好', keywords: 'watermark 水印', run: () => setPreferences((prev) => ({ ...prev, watermark: !prev.watermark })) },
    { id: 'act-density', group: '操作', label: preferences.compact ? '切换舒适密度' : '切换紧凑密度', hint: '收紧表格行高与卡片留白', keywords: 'density compact 紧凑', run: () => setPreferences((prev) => ({ ...prev, compact: !prev.compact })) },
    { id: 'act-refresh-tab', group: '操作', label: '刷新当前页签', hint: '重置该页未保存状态', keywords: 'refresh tab 重新加载', run: () => refreshTab() },
    { id: 'act-close-tab', group: '操作', label: '关闭当前页签', hint: '切换至邻近的已打开页面', keywords: 'close tab 关闭', run: () => closeTab(activeTabId) },
    {
      id: 'act-copy-link',
      group: '操作',
      label: '复制当前页面链接',
      hint: window.location.origin + window.location.pathname + '#/' + route,
      keywords: 'link url share 分享',
      run: () => {
        navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
        notify('页面链接已复制', window.location.href, 'success');
      },
    },
    ...(canSimulate ? ROLE_OPTIONS.filter((option) => option.role !== role) : []).map((option) => ({
      id: `role-${option.role}`,
      group: '角色' as const,
      label: `切换为 ${option.label}`,
      hint: `${option.code} · ${option.scope}`,
      keywords: `role ${option.code}`,
      run: () => changeRole(option.role),
    })),
  ];
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return searchEntries.slice(0, 5);
    return searchEntries.filter(
      ({ item, trail }) =>
        item.label.toLowerCase().includes(query) ||
        item.en.toLowerCase().includes(query) ||
        trail.join(' ').toLowerCase().includes(query)
    );
  }, [search, searchEntries]);

  const merchantNotifications = merchants.filter(
    (merchant) => merchant.status === 'pending_initial' || merchant.status === 'pending_review'
  ).length;
  const pendingAudit = MOMENT_QUEUE.length;
  const unresolvedRefunds = refunds.filter((refund) => refund.status !== 'resolved').length;

  const notices = useMemo(() => {
    const items = [
      ...ALERT_POOL.filter((a) => a.status === 'firing').slice(0, 2).map((a) => ({ id: a.id, title: `[${a.level === 'critical' ? '致命' : '高危'}] ${a.title}`, meta: `告警池 · ${a.time} · ${a.source}`, icon: Siren, action: 'overview' as RouteKey })),
      { id: 'notice-merchant', title: `${merchantNotifications} 笔商户进件等待复审`, meta: '支付与商户管理 · 需 2 小时内处理', icon: Building2, action: 'merchants' as RouteKey },
      { id: 'notice-audit', title: `${pendingAudit} 条朋友圈图文待人工裁定`, meta: '内容与社交 · AI 高危命中 98 分', icon: MessagesSquare, action: 'content-audit' as RouteKey },
      { id: 'notice-refund', title: `${unresolvedRefunds} 笔异常退款挂起`, meta: '交易中心 · 银行卡状态异常', icon: ReceiptText, action: 'refunds' as RouteKey },
    ];
    return items.map((item) => ({ ...item, unread: !readNoticeIds.includes(item.id) }));
  }, [merchantNotifications, pendingAudit, unresolvedRefunds, readNoticeIds]);
  const unreadCount = notices.filter((n) => n.unread).length;

  useEffect(() => { storage.set(`wt.readNotices.${session.username}`, JSON.stringify(readNoticeIds)); }, [readNoticeIds, session.username]);

  const markNoticeRead = (id: string) => setReadNoticeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const markAllNoticesRead = () => setReadNoticeIds(notices.map((n) => n.id));

  const updateMerchant = (merchantNo: string, status: MerchantStatus, notes: string, reviewer: string) => {
    setMerchants((prev) =>
      prev.map((merchant) =>
        merchant.merchant_no === merchantNo ? { ...merchant, status, review_notes: notes, reviewer } : merchant
      )
    );
    appendLog(status === 'approved' ? '审核通过进件' : '驳回进件', merchantNo, '商户进件', status === 'approved' ? 'success' : 'failed');
  };

  const retryRefund = (refundNo: string) => {
    setRefunds((prev) =>
      prev.map((refund) =>
        refund.refund_no === refundNo
          ? { ...refund, status: 'retrying', retry_count: refund.retry_count + 1, last_attempt_at: '2026-02-24 15:24:18' }
          : refund
      )
    );
    appendLog('手动重试退款', refundNo, '异常退款池');
    window.setTimeout(() => {
      setRefunds((prev) =>
        prev.map((refund) => (refund.refund_no === refundNo ? { ...refund, status: 'resolved' } : refund))
      );
      notify('退款重试成功', `${refundNo} 已通过原路通道退回，清算结果已回写`, 'success');
    }, 2600);
  };

  const saveStrategy = (strategy: RiskStrategy) => {
    setStrategies((prev) => {
      const exists = prev.some((item) => item.strategy_id === strategy.strategy_id);
      return exists ? prev.map((item) => (item.strategy_id === strategy.strategy_id ? strategy : item)) : [strategy, ...prev];
    });
    appendLog('保存风控策略', strategy.name, '风控策略');
  };

  const toggleStrategy = (strategyId: string, enabled: boolean) => {
    setStrategies((prev) =>
      prev.map((strategy) =>
        strategy.strategy_id === strategyId ? { ...strategy, enabled, updated_at: '2026-02-24 15:24:18' } : strategy
      )
    );
    appendLog(enabled ? '启用风控策略' : '停用风控策略', strategyId, '风控策略');
  };

  const decideApproval = (id: string, decision: 'approved' | 'rejected', reason: string) => {
    const item = approvals.find((a) => a.approval_id === id);
    if (!item || item.status !== 'pending' || !APPROVAL_ROLES[item.category].includes(role)) { notify('审批失败', '申请已处理或当前角色无权裁决', 'error'); return; }
    if (decision === 'rejected' && reason.trim().length < 8) { notify('审批失败', '驳回理由至少 8 个字', 'error'); return; }
    const decidedAt = new Date().toISOString();
    setApprovals((prev) => prev.map((a) => a.approval_id === id ? { ...a, status: decision, decision_reason: reason, reviewer: session.displayName, decided_at: decidedAt } : a));
    if (item.category === 'merchant' && decision === 'approved') {
      setMerchants((prev) => prev.map((m) => m.merchant_no === item.target_id ? { ...m, status: 'approved', reviewer: session.displayName, review_notes: reason } : m));
    }
    appendLog(decision === 'approved' ? '审批通过' : '审批驳回', id, '审批中心');
  };

  const setOperator = (username: string, updates: Partial<OperatorAccount>) => {
    if (username === session.username && updates.enabled === false) { notify('禁止禁用当前账号', '请由其他超级管理员执行该操作', 'error'); return; }
    setAccounts((prev) => prev.map((a) => a.username === username ? { ...a, ...updates, session_count: updates.role ? 0 : updates.session_count ?? a.session_count } : a));
    appendLog(updates.enabled === false ? '禁用账号并撤销会话' : updates.enabled === true ? '启用账号' : '更新账号 MFA', username, '系统设置');
    notify('账号配置已生效', username, 'success');
  };

  const createOperator = async (account: OperatorAccount, temp: string) => {
    await saveDemoCredential(account.username, temp);
    setAccounts((prev) => [account, ...prev]);
    appendLog('新建运营账号', account.username, '系统设置');
  };

  const resetOperatorPassword = async (username: string, temp: string) => {
    await saveDemoCredential(username, temp);
    setAccounts((prev) => prev.map((a) => a.username === username ? { ...a, session_count: 0 } : a));
    appendLog('重置运营账号密码并撤销会话', username, '系统设置');
  };

  const savePolicy = (next: SecurityPolicy) => {
    setPolicy(next);
    storage.set('wt.securityPolicy', JSON.stringify(next));
    appendLog('变更登录安全策略', `${next.session_minutes}min / MFA:${next.require_mfa}`, '系统设置');
  };

  const updateTicket = (id: string, updates: Partial<Ticket>) => {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    appendLog(updates.status === 'closed' ? '办结工单' : '流转工单', id, '客户服务');
  };

  const createExport = (key: ReportKey) => {
    const template = REPORT_TEMPLATES.find((t) => t.key === key);
    if (!template?.roles.includes(role)) { notify('无导出权限', '当前角色不能生成该报表', 'error'); return; }
    const report = buildReport(key, { merchants, transactions, refunds, blacklist, tickets, approvals, logs }, role);
    const id = `EXP-${Date.now().toString(36).toUpperCase()}`;
    reportSnapshots.current[id] = report;
    const now = new Date();
    const job: ExportJob = { job_id: id, template_key: key, status: 'queued', progress: 0, row_count: report.rows.length, file_name: `${key}_${now.toISOString().slice(0, 10)}.csv`, requested_by: session.displayName, requested_role: role, created_at: now.toISOString(), completed_at: null, expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(), error_message: null };
    setExportJobs((prev) => [job, ...prev]);
    appendLog('创建导出任务', id, '导出中心');
    notify('导出任务已加入队列', `${template.title} · ${report.rows.length.toLocaleString()} 行`, 'info');
  };

  useEffect(() => {
    if (!exportJobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    const timer = window.setInterval(() => setExportJobs((prev) => prev.map((job) => {
      if (job.status !== 'queued' && job.status !== 'running') return job;
      const progress = Math.min(100, job.progress + 12 + Math.floor(Math.random() * 18));
      return { ...job, progress, status: progress === 100 ? 'completed' : 'running', completed_at: progress === 100 ? new Date().toISOString() : null };
    })), 420);
    return () => window.clearInterval(timer);
  }, [exportJobs.some((job) => job.status === 'queued' || job.status === 'running')]);

  const downloadExport = (job: ExportJob) => {
    if (role !== 'super_admin' && job.requested_role !== role) { notify('下载被拒绝', '当前角色不能下载其他岗位创建的报表快照', 'error'); return; }
    if (job.status !== 'completed' || Date.now() >= new Date(job.expires_at).getTime()) { notify('报表已失效', '请重新创建导出任务', 'error'); return; }
    const report = reportSnapshots.current[job.job_id];
    if (!report) { notify('任务快照不可用', '请重新生成报表', 'error'); return; }
    downloadCsv(job.file_name, report.headers, report.rows);
    appendLog('下载导出报表', job.job_id, '导出中心');
    notify('报表已下载', `${job.file_name} · ${job.row_count} 行`, 'success');
  };

  const renderPage = (tab: WorkspaceTab) => {
    switch (tab.route) {
      case 'overview':
        return <OverviewPage role={role} onNavigate={navigate} />;
      case 'merchants':
        return (
          <MerchantListPage
            applications={merchants}
            role={role}
            onOpenDetail={(merchantNo) => {
              openTab('merchant-detail', merchantNo);
            }}
            onUpdateApplication={updateMerchant}
          />
        );
      case 'merchant-detail':
        {
        const merchant = merchants.find((m) => m.merchant_no === tab.merchant_no) ?? merchants[0];
        return (
          <MerchantDetailPage
            application={merchant}
            onBack={() => navigate('merchants')}
            onDecision={(status, notes) => updateMerchant(merchant.merchant_no, status, notes, session.displayName)}
            onNotify={(title, description) => notify(title, description, 'info')}
          />
        );
        }
      case 'transactions':
        return <TransactionsPage transactions={transactions} username={session.username} />;
      case 'refunds':
        return <RefundExceptionsPage refunds={refunds} onRetry={retryRefund} />;
      case 'settlement':
        return <SettlementPage />;
      case 'marketing':
        return <MarketingPage />;
      case 'strategies':
        return (
          <StrategiesPage
            strategies={strategies}
            merchants={merchants}
            onSave={saveStrategy}
            onToggle={toggleStrategy}
          />
        );
      case 'blacklist':
        return (
          <BlacklistPage
            entries={blacklist}
            onRemove={(entryId) => {
              setBlacklist((prev) => prev.filter((entry) => entry.entry_id !== entryId));
              appendLog('解除黑名单', entryId, '黑名单治理');
            }}
            onAdd={(entry) => {
              setBlacklist((prev) => [entry, ...prev]);
              appendLog('新增黑名单条目', entry.value, '黑名单治理');
            }}
          />
        );
      case 'strategy-lab':
        return <StrategyLabPage />;
      case 'risk-events':
        return <RiskEventsPage />;
      case 'content-audit':
        return <ContentAuditPage posts={MOMENT_QUEUE} onNotify={(title, description) => notify(title, description, 'info')} />;
      case 'content-groups':
        return (
          <GroupManagementPage
            groups={groups}
            onToggleMute={(groupId) => {
              setGroups((prev) =>
                prev.map((group) =>
                  group.group_id === groupId
                    ? { ...group, status: group.status === 'muted' ? 'active' : 'muted' }
                    : group
                )
              );
              appendLog('设置全员禁言', groupId, '群组管理');
            }}
            onDissolve={(groupId) => {
              setGroups((prev) =>
                prev.map((group) => (group.group_id === groupId ? { ...group, status: 'dissolved', messages_today: 0 } : group))
              );
              appendLog('强制解散群组', groupId, '群组管理');
            }}
            onNotify={(title, description) => notify(title, description, 'info')}
          />
        );
      case 'im-audit':
        return <ImAuditPage />;
      case 'live-wall':
        return <LiveWallPage />;
      case 'open-mini':
        return <MiniReviewPage />;
      case 'open-mp':
        return <MpArticlePage />;
      case 'tickets':
        return <TicketsPage tickets={tickets} onUpdateTicket={updateTicket} />;
      case 'touch':
        return <TouchPage />;
      case 'approvals':
        return <ApprovalCenterPage role={role} approvals={approvals} onDecide={decideApproval} />;
      case 'platform-settings':
        return <PlatformSettingsPage accounts={accounts} currentUsername={session.username} policy={policy} onSavePolicy={savePolicy} onSetAccount={setOperator} onCreateAccount={createOperator} onResetPassword={resetOperatorPassword} onAudit={(action, target) => appendLog(action, target, '系统设置')} />;
      case 'export-center':
        return <ExportCenterPage role={role} jobs={exportJobs} onCreate={createExport} onDownload={downloadExport} />;
      case 'contracts':
        return <ContractsPage />;
      case 'audit-logs':
        return <AuditLogPage logs={logs} />;
      default:
        return <OverviewPage role={role} onNavigate={navigate} />;
    }
  };

  return (
    <div className={cn('min-h-screen bg-[#F9FAFB] text-[#111827]', preferences.compact && 'density-compact')}>
      <header className="sticky top-0 z-40 bg-white/95 shadow-[0_1px_14px_rgba(15,23,42,0.04)] backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6] lg:hidden"
            aria-label="打开导航"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] shadow-[0_4px_14px_-4px_rgba(17,24,39,0.4)]">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold tracking-tight text-[#111827]">WeTrust Console</span>
                <span className="hidden rounded-md bg-[#F9FAFB] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#6B7280] sm:inline-block">
                  v2.6
                </span>
              </div>
              <p className="hidden text-[10px] text-[#9CA3AF] sm:block">微信生态 · 支付 / 风控 / 内容 一体化治理</p>
            </div>
          </div>

          <div className="mx-auto hidden w-full max-w-md px-4 md:block">
            <div className="relative">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2 transition-all',
                  searchFocused ? 'bg-white shadow-[0_0_0_2px_rgba(17,24,39,0.08)]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                )}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
                  placeholder="搜索页面、模块或功能..."
                  className="w-full bg-transparent text-xs text-[#111827] placeholder-[#9CA3AF] outline-none"
                />
                {search ? (
                  <button type="button" onClick={() => setSearch('')} aria-label="清空搜索" className="cursor-pointer text-[#9CA3AF] hover:text-[#374151]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="hidden items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 font-mono text-[9px] text-[#9CA3AF] shadow-xs sm:flex">
                    <Command className="h-2.5 w-2.5" />K
                  </span>
                )}
              </div>

              {searchFocused && (
                <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  <div className="px-2.5 py-1.5 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase">
                    {search ? '搜索结果' : '快捷入口'}
                  </div>
                  {searchResults.length > 0 ? (
                    searchResults.slice(0, 7).map(({ item, trail: itemTrail }) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={() => item.route && navigate(item.route)}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-[#F9FAFB]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F9FAFB] text-[#9CA3AF]">
                            <Search className="h-3 w-3" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-medium text-[#111827]">{item.label}</span>
                            <span className="block truncate text-[9px] text-[#9CA3AF]">{itemTrail.join(' / ')}</span>
                          </span>
                        </span>
                        <span className="ml-2 shrink-0 font-mono text-[9px] text-[#C0C6CF]">{item.route}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2.5 py-6 text-center text-[11px] text-[#9CA3AF]">未找到匹配的页面或功能</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ConsolePreferences value={preferences} onChange={setPreferences} />
            <SessionClock session={session} minutes={policy.session_minutes} onLogout={onLogout} onWarn={push} />
            <span className="hidden items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-700 xl:inline-flex" title="当前页面使用本地演示数据；部署 Rust 服务后方可显示真实 API 状态">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 演示数据
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!canSimulate) return;
                  setRoleMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                }}
                title={canSimulate ? '模拟其他角色视角' : '当前登录身份（角色由账号决定）'}
                aria-haspopup={canSimulate ? 'menu' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium text-[#111827] transition-colors sm:px-3',
                  simulating ? 'bg-amber-50' : 'bg-[#F9FAFB]',
                  canSimulate ? 'cursor-pointer hover:bg-[#F3F4F6]' : 'cursor-default'
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-[#6B7280]" />
                <span className="hidden sm:inline">{session.displayName} · {ROLE_LABEL[role]}</span>
                <span className="hidden rounded bg-white px-1 py-0.5 font-mono text-[8px] text-[#9CA3AF] shadow-xs sm:inline">
                  {role}
                </span>
                {canSimulate && <ChevronDown className={cn('h-3 w-3 text-[#9CA3AF] transition-transform', roleMenuOpen && 'rotate-180')} />}
              </button>

              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-[#111827]">模拟角色视角</p>
                      <p className="mt-0.5 text-[10px] text-[#9CA3AF]">无权限的页面将被自动剪枝并重定向</p>
                    </div>
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.role}
                        type="button"
                        onClick={() => changeRole(option.role)}
                        className={cn(
                          'flex w-full cursor-pointer items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors',
                          option.role === role ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                            option.role === role ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                          )}
                        >
                          <ShieldCheck className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[#111827]">{option.label}</span>
                            <span className="font-mono text-[8.5px] text-[#9CA3AF]">{option.code}</span>
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-[#9CA3AF]">{option.description}</span>
                        </span>
                        {option.role === role && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                      </button>
                    ))}
                    <div className="mt-1 rounded-lg bg-[#F9FAFB] px-2.5 py-2 font-mono text-[9px] text-[#9CA3AF]">
                      JWT claims · role / scope / exp verified by Axum
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setRoleMenuOpen(false);
                  setProfileOpen(false);
                }}
                className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                aria-label="通知中心"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-600 px-0.5 text-center font-mono text-[9px] leading-4 text-white">{unreadCount}</span>}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-[#111827]">通知中心</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-orange-50 px-1.5 py-0.5 font-mono text-[9px] text-orange-600">{unreadCount} UNREAD</span>
                        <button type="button" onClick={markAllNoticesRead} disabled={unreadCount === 0} className="cursor-pointer rounded-md px-1.5 py-1 text-[10px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-40">全部已读</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setNotificationsOpen(false); navigate('approvals'); }} className="mx-1 mb-1 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-2 text-left text-[11px] font-medium text-orange-800 hover:bg-orange-100"><ClipboardCheck className="h-3.5 w-3.5" />{approvalCount} 项授权审批待处理 <ChevronRight className="ml-auto h-3 w-3" /></button>
                    {notices.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { markNoticeRead(item.id); navigate(item.action); }}
                          className="flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left hover:bg-[#F9FAFB]"
                        >
                          <span className="relative mt-1.5 flex h-1.5 w-1.5 shrink-0">
                            {item.unread && <span className="absolute h-1.5 w-1.5 rounded-full bg-orange-500" />}
                          </span>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F9FAFB] text-[#6B7280]">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-[11px]', item.unread ? 'font-semibold text-[#111827]' : 'font-medium text-[#4B5563]')}>{item.title}</span>
                            <span className="mt-0.5 block truncate text-[10px] text-[#9CA3AF]">{item.meta}</span>
                          </span>
                          {item.unread && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-label="未读" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((prev) => !prev);
                  setRoleMenuOpen(false);
                  setNotificationsOpen(false);
                }}
                aria-label="账户菜单"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white shadow-[0_2px_8px_rgba(17,24,39,0.2)]"
              >
                {session.displayName.slice(-2)}
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-[#111827]">{session.displayName}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{session.username}@wetrust.internal · {session.dept}</p>
                      <div className="mt-2 flex gap-1.5">
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">MFA 已启用</span>
                        <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[9px] text-[#6B7280]">{ROLE_LABEL[session.role]}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        if (role === 'super_admin') navigate('platform-settings');
                        else notify('账户安全', '账号变更请联系超级管理员', 'info');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#4B5563] hover:bg-[#F9FAFB]"
                    >
                      <UserRound className="h-3.5 w-3.5 text-[#9CA3AF]" /> 账户与安全设置
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        notify('帮助中心', '企业级操作手册与接口文档已内置于数据契约中心', 'info');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-[#4B5563] hover:bg-[#F9FAFB]"
                    >
                      <CircleHelp className="h-3.5 w-3.5 text-[#9CA3AF]" /> 帮助中心
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        onLogout();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> 退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {routeLoading && <div className="route-progress" aria-hidden="true" />}
      </header>

      {simulating && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          <span>
            正在以「{ROLE_LABEL[role]}」视角预览，菜单与权限按该角色展示。实际登录身份：{session.displayName}（{ROLE_LABEL[session.role]}）
          </span>
          <button
            type="button"
            onClick={() => changeRole(session.role)}
            className="cursor-pointer rounded-md bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
          >
            退出模拟
          </button>
        </div>
      )}

      <div className="flex">
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-[#0B1220]/30 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        <aside
          className={cn(
            'fixed top-0 bottom-0 left-0 z-50 flex w-[268px] shrink-0 flex-col bg-white shadow-[2px_0_24px_rgba(15,23,42,0.04)] transition-[transform,width] duration-200 lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:shadow-[1px_0_0_rgba(15,23,42,0.035)]',
            collapsed ? 'lg:w-[76px]' : 'lg:w-[268px]',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-16 items-center justify-between px-4 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111827]">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              </div>
              <span className="text-xs font-semibold">WeTrust Console</span>
            </div>
            <button type="button" onClick={() => setMobileSidebarOpen(false)} className="cursor-pointer rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#F9FAFB]" aria-label="关闭导航">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 图标栏模式（仅桌面端收起时） */}
          {collapsed && (
            <nav className="hidden flex-1 flex-col items-center gap-1 overflow-y-auto py-4 lg:flex" aria-label="业务导航（图标栏）">
              {visibleNav.map((item) => {
                const Icon = item.icon ? NAV_ICONS[item.icon] : LayoutDashboard;
                const check = (node: NavItem): boolean => node.route === route || Boolean(node.children?.some(check));
                const active = check(item);
                return (
                  <React.Fragment key={item.id}>
                    {NAV_SECTION_START[item.id] && item.id !== 'overview' && <span className="my-1.5 h-px w-8 bg-[#F0F2F5]" />}
                    <button
                      type="button"
                      onClick={() => {
                        if (item.route) {
                          navigate(item.route);
                          return;
                        }
                        setCollapsed(false);
                        setExpandedNav((prev) => Array.from(new Set([...prev, item.id, ...collectNavIds(item.children ?? [])])));
                      }}
                      className={cn(
                        'group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-all',
                        active ? 'bg-[#111827] text-orange-400 shadow-[0_4px_14px_-6px_rgba(17,24,39,0.45)]' : 'text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827]'
                      )}
                      aria-label={item.label}
                    >
                      <Icon className="h-4 w-4" />
                      {item.badge && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-orange-500" />}
                      <span className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-white shadow-lg group-hover:block">
                        {item.label}
                        <span className="ml-1.5 font-mono text-[9px] text-gray-400">{item.en}</span>
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>
          )}

          <div className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'lg:hidden')}>
            <div className="hidden px-4 pt-5 pb-2 lg:block">
              <div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[#6B7280] shadow-xs">
                    <Building2 className="h-3 w-3" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold text-[#111827]">微信生态治理中心</p>
                    <p className="font-mono text-[8.5px] text-[#9CA3AF]">prod · cn-south-1</p>
                  </div>
                </div>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-1">
              <span className="font-mono text-[9px] tracking-[0.12em] text-[#9CA3AF] uppercase">Navigation</span>
              <button
                type="button"
                onClick={() => {
                  const allIds = collectNavIds(visibleNav);
                  setExpandedNav(expandedNav.length >= allIds.length ? [] : allIds);
                }}
                className="cursor-pointer rounded px-1.5 py-1 text-[9px] font-medium text-[#9CA3AF] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
              >
                {expandedNav.length > 6 ? '全部收起' : '展开全部'}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2.5 pb-4" aria-label="业务导航">
              {visibleFavorites.length > 0 && <div className="mb-2 px-1"><div className="flex items-center gap-1.5 px-2 pb-1 pt-2 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase"><Star className="h-3 w-3 text-orange-500" />常用 Favorites <span className="ml-auto">{visibleFavorites.length}/8</span></div>{visibleFavorites.map((item) => <button key={item} type="button" onClick={() => navigate(item)} className={cn('flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] transition-colors', route === item ? 'bg-orange-50 font-medium text-orange-700' : 'text-[#6B7280] hover:bg-[#F9FAFB]')}><Star className="h-3 w-3 shrink-0 fill-current text-orange-400" /><span className="truncate">{findNavTrail(FULL_NAV_TREE, item).slice(-1)[0] ?? item}</span></button>)}</div>}
              {visibleRecent.length > 0 && <div className="mb-2 px-1"><div className="flex items-center gap-1.5 px-2 pb-1 pt-2 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase"><Clock3 className="h-3 w-3" />最近访问 Recent</div>{visibleRecent.map((item) => <button key={item} type="button" onClick={() => navigate(item)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"><Clock3 className="h-3 w-3 shrink-0 text-[#AAB2BD]" /><span className="truncate">{findNavTrail(FULL_NAV_TREE, item).slice(-1)[0] ?? item}</span></button>)}</div>}
              <ul className="space-y-0.5">
                {visibleNav.map((item) => (
                  <React.Fragment key={item.id}>
                    {NAV_SECTION_START[item.id] && (
                      <li className="px-3 pt-3 pb-1 font-mono text-[9px] tracking-[0.1em] text-[#B0B7C3] uppercase first:pt-1">
                        {NAV_SECTION_START[item.id]}
                      </li>
                    )}
                    <NavTreeNode
                      item={item}
                      depth={1}
                      expanded={expandedNav}
                      activeRoute={route}
                      onToggle={(id) =>
                        setExpandedNav((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
                      }
                      onNavigate={navigate}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  </React.Fragment>
                ))}
              </ul>
            </nav>

            <div className="border-t border-[#F3F4F6] p-3">
              <div className="rounded-xl bg-[#F9FAFB] p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#374151]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 服务健康度 99.98%
                  </span>
                  <ExternalLink className="h-3 w-3 text-[#9CA3AF]" />
                </div>
                <div className="mt-2 flex items-end gap-0.5">
                  {[82, 90, 86, 94, 88, 96, 92, 98, 94, 100, 96, 99].map((height, index) => (
                    <span key={index} className="flex-1 rounded-sm bg-emerald-500/25" style={{ height: `${height / 4}px` }} />
                  ))}
                </div>
                <p className="mt-1.5 font-mono text-[8px] text-[#9CA3AF]">Axum · PgPool 32 · P99 42ms</p>
              </div>
            </div>
          </div>

          <div className="hidden border-t border-[#F3F4F6] p-2.5 lg:block">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={cn('flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]', collapsed && 'justify-center')}
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              title={collapsed ? '展开侧边栏' : '收起为图标栏'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />收起侧边栏</>}
            </button>
          </div>
        </aside>

        <main className={cn('relative flex min-w-0 flex-1 flex-col overflow-hidden', simulating ? 'h-[calc(100vh-6rem)]' : 'h-[calc(100vh-4rem)]')}>
          <WorkspaceTabs tabs={tabs} activeId={activeTabId} onActivate={activateTab} onClose={closeTab} onCloseOthers={closeOtherTabs} onCloseAll={closeAllTabs} onRefresh={() => refreshTab()} onRefreshTab={refreshTab} />
          <div className="relative min-h-0 flex-1">
            {preferences.watermark && <ContentWatermark operator={`${session.displayName} ${session.username}`} />}
            {tabs.length === 0 && <div className="flex h-full flex-col items-center justify-center text-center"><Files className="h-10 w-10 text-[#C0C6CF]" /><p className="mt-4 text-sm font-medium text-[#374151]">工作区已清空</p><p className="mt-1 text-xs text-[#9CA3AF]">从左侧菜单打开模块，或使用快捷键 ⌘ K 搜索页面</p><button type="button" onClick={() => navigate('overview')} className="mt-5 cursor-pointer rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-medium text-white">打开业务总览</button></div>}
            {[...tabs, ...(closedSnapshot?.tabs.filter((t) => !tabs.some((open) => open.id === t.id)) ?? [])].map((tab) => {
              const active = tab.id === activeTabId;
              const ready = readyTabIds.includes(tab.id) || Boolean(closedSnapshot?.readyIds.includes(tab.id));
              const tabTrail = findNavTrail(FULL_NAV_TREE, tab.route);
              return (
                <section key={tab.id} role="tabpanel" aria-label={tab.label} data-pane-id={tab.id} data-active={active ? 'true' : 'false'} ref={(el) => { paneRefs.current[tab.id] = el; }} onScroll={(e) => { scrollPositions.current[tab.id] = e.currentTarget.scrollTop; }} style={{ display: active ? 'block' : 'none' }} className="absolute inset-0 overflow-y-auto overscroll-contain">
                  <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#9CA3AF]"><span className="font-mono uppercase">Console</span>{tabTrail.map((crumb, index) => <React.Fragment key={`${crumb}-${index}`}><ChevronRight className="h-2.5 w-2.5 text-[#D1D5DB]" /><span className={index === tabTrail.length - 1 ? 'font-medium text-[#4B5563]' : ''}>{crumb}</span></React.Fragment>)}<ChevronRight className="h-2.5 w-2.5 text-[#D1D5DB]" /><span className="rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-[#9CA3AF] shadow-xs">{tab.route}{tab.merchant_no ? ` / ${tab.merchant_no}` : ''}</span></div><div className="flex items-center gap-3 font-mono text-[9px] text-[#B0B7C3]"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" />{ROLE_LABEL[role]}</span><span>{new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })}</span></div></div>
                    {ready ? <div key={`${tab.id}:${tab.revision}`} className="animate-pane-in"><ErrorBoundary resetKey={`${tab.id}:${tab.revision}`}>{renderPage(tab)}</ErrorBoundary></div> : active ? <PageSkeleton /> : null}
                    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F2F5] pt-4 text-[9.5px] text-[#B0B7C3]"><p>WeTrust Console · React / TypeScript / Tailwind / Rust Axum / PostgreSQL</p><p className="font-mono">演示数据 · 所有操作仅作用于当前会话</p></footer>
                  </div>
                </section>
              );
            })}
          </div>
        </main>
        {closedSnapshot && <div role="status" aria-label="撤销关闭页签" className="animate-toast-in fixed bottom-5 left-5 z-[65] flex items-center gap-3 overflow-hidden rounded-xl bg-[#111827] px-4 py-3 text-xs text-white shadow-[0_12px_36px_rgba(15,23,42,0.25)]"><span className="max-w-48 truncate">已关闭 {closedSnapshot.label}</span><button type="button" onClick={restoreClosedTabs} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/15 px-2 py-1 font-medium text-orange-200 hover:bg-white/25"><Undo2 className="h-3.5 w-3.5" />撤销</button><span className="font-mono text-[10px] text-gray-400">8s</span><span aria-hidden="true" className="undo-progress absolute bottom-0 left-0 h-[2px] bg-orange-400" /></div>}
        <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
        <OnboardingTour
          readDone={() => storage.get(`wt.tourDone.${session.username}`) === '1'}
          markDone={() => storage.set(`wt.tourDone.${session.username}`, '1')}
        />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <SessionGate />
    </ToastProvider>
  );
}

const SessionGate: React.FC = () => {
  const [session, setSession] = useState<LoginSession | null>(() => {
    try {
      const raw = storage.get('wt.session');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LoginSession>;
      const valid =
        typeof parsed.username === 'string' &&
        typeof parsed.displayName === 'string' &&
        typeof parsed.dept === 'string' &&
        typeof parsed.loginAt === 'number' &&
        typeof parsed.role === 'string' &&
        parsed.role in ALL_ROUTES_BY_ROLE;
      if (!valid || Date.now() - (parsed.loginAt as number) > getSessionTtl()) {
        storage.remove('wt.session');
        return null;
      }
      try {
        const users = JSON.parse(storage.get('wt.operators') ?? 'null') as OperatorAccount[] | null;
        if (Array.isArray(users) && users.some((a) => a.username === parsed.username && !a.enabled)) { storage.remove('wt.session'); return null; }
      } catch { /* 使用上次有效会话 */ }
      return parsed as LoginSession;
    } catch {
      return null;
    }
  });

  const handleLogin = (next: LoginSession) => {
    storage.set('wt.session', JSON.stringify(next));
    try {
      const accounts = JSON.parse(storage.get('wt.operators') ?? 'null') as OperatorAccount[] | null;
      const source = Array.isArray(accounts) ? accounts : INITIAL_OPERATORS;
      storage.set('wt.operators', JSON.stringify(source.map((a) => a.username === next.username ? { ...a, session_count: a.session_count + 1, last_login_at: new Date().toISOString() } : a)));
    } catch { /* 浏览器存储被禁用时沿用内存状态 */ }
    setSession(next);
  };

  const handleLogout = useCallback(() => {
    storage.remove('wt.session');
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;
    const verify = () => {
      try {
        const users = JSON.parse(storage.get('wt.operators') ?? 'null') as OperatorAccount[] | null;
        if (Array.isArray(users) && users.some((a) => a.username === session.username && (!a.enabled || a.role !== session.role || a.session_count === 0))) handleLogout();
      } catch { /* 浏览器存储被禁用时沿用内存会话 */ }
    };
    window.addEventListener('storage', verify);
    const timer = window.setInterval(verify, 5000);
    return () => { window.removeEventListener('storage', verify); window.clearInterval(timer); };
  }, [session, handleLogout]);

  if (!session) return <LoginPage onSuccess={handleLogin} />;
  return <Shell session={session} onLogout={handleLogout} />;
};
