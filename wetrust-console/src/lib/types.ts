/* ============================================================================
 * WeTrust Console · 统一领域模型契约
 * 前端 TypeScript Interface 与 Rust (Axum + SQLx) Struct 一一镜像对齐
 * 金额统一为 i64 分；雪花 ID 使用 string；时间统一 ISO-8601 UTC
 * ========================================================================== */

export type Role = 'super_admin' | 'finance' | 'risk_ops' | 'moderator';

export type RouteKey =
  | 'overview'
  | 'merchants'
  | 'merchant-detail'
  | 'transactions'
  | 'refunds'
  | 'settlement'
  | 'marketing'
  | 'strategies'
  | 'strategy-lab'
  | 'blacklist'
  | 'risk-events'
  | 'content-audit'
  | 'content-groups'
  | 'im-audit'
  | 'live-wall'
  | 'open-mini'
  | 'open-mp'
  | 'tickets'
  | 'touch'
  | 'approvals'
  | 'platform-settings'
  | 'export-center'
  | 'contracts'
  | 'audit-logs';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  trace_id: string;
  server_time: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type MerchantStatus = 'pending_initial' | 'pending_review' | 'rejected' | 'frozen' | 'approved';
export type AccountType = 'corporate' | 'personal';
export type ContractStatus = 'signed' | 'signing' | 'expired' | 'voided';

export interface BeneficialOwner {
  owner_id: string;
  name: string;
  owner_type: 'holding_company' | 'natural_person' | 'partnership';
  ratio_percent: number;
  is_ubo: boolean;
  id_no_masked: string;
  region: string;
  children?: BeneficialOwner[];
}

export interface SettlementAccount {
  account_type: AccountType;
  account_holder: string;
  account_no_masked: string;
  bank_name: string;
  branch_name: string;
  union_pay_code: string;
  province: string;
  city: string;
}

export interface MerchantContract {
  contract_no: string;
  title: string;
  status: ContractStatus;
  signed_at: string | null;
  expire_at: string;
  pdf_url: string;
  signatories: string[];
}

export interface MerchantApplication {
  application_no: string;
  merchant_no: string;
  company_name: string;
  company_short: string;
  legal_name: string;
  legal_phone_masked: string;
  legal_id_masked: string;
  legal_id_plain: string;
  legal_email: string;
  legal_liveness_verified: boolean;
  risk_score: number;
  risk_tags: string[];
  status: MerchantStatus;
  applied_at: string;
  reviewer: string | null;
  review_notes: string;
  business_license_no: string;
  business_license_expire: string;
  registered_capital_wan: number;
  established_at: string;
  company_type: string;
  category_path: string[];
  business_scope: string;
  address: string;
  location: { lat: number; lng: number };
  contact_name: string;
  contact_phone: string;
  settlement: SettlementAccount;
  beneficial_owners: BeneficialOwner[];
  contract: MerchantContract;
  documents: { name: string; type: string; size: string; uploaded_at: string }[];
}

export type PayMethod = 'qr' | 'card' | 'api' | 'mini_program';
export type TradeStatus = 'success' | 'processing' | 'failed' | 'closed';

export interface PaymentTransaction {
  wechat_trade_no: string;
  merchant_trade_no: string;
  merchant_no: string;
  merchant_name: string;
  amount_fen: number;
  refund_fen: number;
  pay_method: PayMethod;
  trade_type: 'payment' | 'refund';
  status: TradeStatus;
  payer_openid: string;
  description: string;
  channel: string;
  paid_at: string;
  settled_at: string | null;
}

export type RefundStatus = 'pending' | 'retrying' | 'resolved' | 'manual_review';

export interface RefundException {
  refund_no: string;
  trade_no: string;
  merchant_no: string;
  merchant_name: string;
  amount_fen: number;
  reason_code: string;
  reason: string;
  bank_name: string;
  retry_count: number;
  status: RefundStatus;
  created_at: string;
  last_attempt_at: string;
}

export type StrategyScope = 'global' | 'merchant';
export type StrategyAction = 'alert' | 'block_freeze';

export interface RiskStrategy {
  strategy_id: string;
  name: string;
  scope: StrategyScope;
  merchant_no: string | null;
  merchant_name: string | null;
  single_limit_fen: number;
  daily_limit_fen: number;
  action: StrategyAction;
  enabled: boolean;
  hits_24h: number;
  updated_at: string;
  owner: string;
  description: string;
}

export type BlacklistDimension = 'user' | 'idcard' | 'phone' | 'device' | 'ip' | 'voice';

export interface BlacklistEntry {
  entry_id: string;
  dimension: BlacklistDimension;
  value: string;
  related_accounts: number;
  reason: string;
  source: string;
  operator: string;
  added_at: string;
}

export type GroupStatus = 'active' | 'muted' | 'dissolved' | 'locked';

export interface ChatGroup {
  group_id: string;
  name: string;
  owner_uid: string;
  member_count: number;
  max_members: number;
  status: GroupStatus;
  category: string;
  messages_today: number;
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
  notice: string;
}

export type ModerationTag = '涉黄' | '涉政' | '广告' | '欺诈' | '引流';
export type PunishmentLevel = 'warning' | 'mute_3d' | 'mute_7d' | 'ban';

export interface MomentPost {
  post_id: string;
  user_name: string;
  user_uid: string;
  avatar_tone: string;
  content: string;
  images: { label: string; tone: string }[];
  location: string;
  posted_at: string;
  likes: number;
  comments: number;
  report_reason: string;
  report_count: number;
  ai_score: number;
  ai_tags: string[];
  queue: 'high' | 'normal';
}

export interface ModerationDecision {
  post_id: string;
  tags: ModerationTag[];
  punishment: PunishmentLevel;
  opinion: string;
  result: 'approved' | 'rejected';
  operator: string;
  operated_at: string;
}

export interface AuditLog {
  log_id: string;
  operator: string;
  role: Role;
  module: string;
  action: string;
  target: string;
  ip: string;
  result: 'success' | 'failed';
  created_at: string;
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
  unit: string;
  delta: number;
  hint: string;
  tone: 'dark' | 'emerald' | 'amber' | 'rose' | 'sky';
}

export interface NavItem {
  id: string;
  label: string;
  en: string;
  roles: Role[];
  route?: RouteKey;
  icon?: string;
  badge?: string;
  children?: NavItem[];
}

export interface RoleOption {
  role: Role;
  label: string;
  code: string;
  description: string;
  scope: string;
}

export type ApprovalCategory = 'merchant' | 'withdrawal' | 'rule_publish' | 'blacklist_release' | 'group_dissolve' | 'ban_appeal';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalItem {
  approval_id: string;
  category: ApprovalCategory;
  title: string;
  applicant: string;
  target_id: string;
  amount_fen: number | null;
  risk_level: 'critical' | 'high' | 'medium';
  risk_note: string;
  evidence: string[];
  sla_deadline: string;
  requested_at: string;
  status: ApprovalStatus;
  reviewer: string | null;
  decision_reason: string | null;
  decided_at: string | null;
}

export interface OperatorAccount {
  operator_id: string;
  username: string;
  display_name: string;
  department: string;
  role: Role;
  mfa_enabled: boolean;
  enabled: boolean;
  session_count: number;
  last_login_at: string | null;
  created_at: string;
}

export interface SecurityPolicy {
  session_minutes: number;
  failed_login_limit: number;
  min_password_length: number;
  require_mfa: boolean;
  ip_allowlist: string[];
  updated_at: string;
}

export interface ApiKeyMeta {
  key_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: 'active' | 'retiring' | 'disabled';
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export interface PlatformSettings {
  platform_name: string;
  timezone: string;
  log_retention_days: number;
  support_email: string;
  updated_at: string;
}

export type ReportKey = 'merchant_applications' | 'transaction_daily' | 'refund_exceptions' | 'blacklist' | 'sla_monthly' | 'approval_audit';

export interface ExportJob {
  job_id: string;
  template_key: ReportKey;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'expired';
  progress: number;
  row_count: number;
  file_name: string;
  requested_by: string;
  requested_role: Role;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
  error_message: string | null;
}

export interface WorkspaceTab {
  id: string;
  route: RouteKey;
  label: string;
  merchant_no?: string;
  revision: number;
}

export interface UiPreferences {
  watermark: boolean;
  compact: boolean;
}
