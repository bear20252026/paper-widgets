import type { ApprovalCategory, ApprovalItem, ApiKeyMeta, OperatorAccount, PlatformSettings, ReportKey, Role, SecurityPolicy } from './types';

export const APPROVAL_ROLES: Record<ApprovalCategory, Role[]> = {
  merchant: ['super_admin', 'finance'],
  withdrawal: ['super_admin', 'finance'],
  rule_publish: ['super_admin', 'risk_ops'],
  blacklist_release: ['super_admin', 'risk_ops'],
  group_dissolve: ['super_admin', 'moderator'],
  ban_appeal: ['super_admin', 'moderator'],
};

export const APPROVAL_LABELS: Record<ApprovalCategory, string> = {
  merchant: '商户准入终审', withdrawal: '大额提现放行', rule_publish: '规则全量发布',
  blacklist_release: '黑名单解封抽检', group_dissolve: '群组强制解散', ban_appeal: '封号申诉二审',
};

const due = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
const ago = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

export const INITIAL_APPROVALS: ApprovalItem[] = [
  { approval_id: 'AP-2026-4831', category: 'merchant', title: '厦门澄海跨境电商特约商户准入', applicant: '林清和 · 支付清结算部', target_id: 'M2026022400176', amount_fen: null, risk_level: 'high', risk_note: '进件风险分 87，跨境结算资质需终审确认', evidence: ['营业执照 OCR 99.6%', '受益人穿透 100%', '跨境经营许可证'], sla_deadline: due(42), requested_at: ago(78), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4830', category: 'withdrawal', title: '苏州鹿鸣医疗器械 T+1 大额提现', applicant: '林清和 · 支付清结算部', target_id: 'WD-20260224-6601', amount_fen: 62_000_000, risk_level: 'critical', risk_note: '超过 50 万人工电核阈值，需复核资金用途与法人授权', evidence: ['法人电核录音 03:41', '大额资金用途说明', '对公结算账户回执'], sla_deadline: due(19), requested_at: ago(101), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4829', category: 'rule_publish', title: '高风险 IP 支付阻断规则全量发布', applicant: '顾以宁 · 风控安全部', target_id: 'RS-2406', amount_fen: null, risk_level: 'high', risk_note: '1%/20% 灰度样本误杀率 0.18%，申请切换全量', evidence: ['灰度命中 312 次', '误杀回溯报告 0.18%', '回滚快照 v4.1.3'], sla_deadline: due(96), requested_at: ago(24), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4828', category: 'blacklist_release', title: '设备 MAC 黑名单解封抽检', applicant: '顾以宁 · 风控安全部', target_id: 'BL-D-4421', amount_fen: null, risk_level: 'medium', risk_note: '关联 11 个异常账号；7 天冷却期届满，申请人工抽检', evidence: ['设备指纹回溯', '关联账号注销记录'], sla_deadline: due(215), requested_at: ago(35), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4827', category: 'group_dissolve', title: '强制解散“跨境好物分享 ⑦ 群”', applicant: '沈知微 · 内容合规部', target_id: 'GRP-20240312-4410', amount_fen: null, risk_level: 'high', risk_note: '19 次诱导站外交易举报，已有成员遭遇损失', evidence: ['近 50 条上下文脱敏记录', '举报单 REP-771', '群主账号风控画像'], sla_deadline: due(64), requested_at: ago(56), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4826', category: 'ban_appeal', title: '朋友圈违规封号申诉复审', applicant: '沈知微 · 内容合规部', target_id: 'wx_uid_88492265', amount_fen: null, risk_level: 'critical', risk_note: '一审封号；需高级审核员复核证据并追溯责任', evidence: ['一审处罚结论', '用户申诉材料', 'MOM-20260224-0091 图文取证'], sla_deadline: due(28), requested_at: ago(92), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4825', category: 'merchant', title: '杭州星野数字科技首笔商户进件', applicant: '林清和 · 支付清结算部', target_id: 'M2026022400189', amount_fen: null, risk_level: 'medium', risk_note: '材料齐全，经营类目已映射国家统计局代码', evidence: ['营业执照与开户许可证', '法人活体认证'], sla_deadline: due(330), requested_at: ago(18), status: 'pending', reviewer: null, decision_reason: null, decided_at: null },
  { approval_id: 'AP-2026-4801', category: 'withdrawal', title: '广州拾光美妆货款结算放行', applicant: '林清和 · 支付清结算部', target_id: 'WD-20260224-6584', amount_fen: 24_500_000, risk_level: 'medium', risk_note: '结算账户与合同一致，资金流向正常', evidence: ['结算账户四要素一致', '发票及合同'], sla_deadline: due(450), requested_at: ago(180), status: 'approved', reviewer: 'root', decision_reason: '复核通过，符合资金结算规则。', decided_at: ago(110) },
];

export const INITIAL_OPERATORS: OperatorAccount[] = [
  { operator_id: 'stf_0001', username: 'root', display_name: '林知夏', department: '平台架构组', role: 'super_admin', mfa_enabled: true, enabled: true, session_count: 2, last_login_at: ago(12), created_at: ago(180_000) },
  { operator_id: 'stf_0002', username: 'finance01', display_name: '林清和', department: '支付清结算部', role: 'finance', mfa_enabled: true, enabled: true, session_count: 1, last_login_at: ago(34), created_at: ago(160_000) },
  { operator_id: 'stf_0003', username: 'risk01', display_name: '顾以宁', department: '风控安全部', role: 'risk_ops', mfa_enabled: true, enabled: true, session_count: 1, last_login_at: ago(18), created_at: ago(140_000) },
  { operator_id: 'stf_0004', username: 'mod01', display_name: '沈知微', department: '内容合规部', role: 'moderator', mfa_enabled: true, enabled: true, session_count: 1, last_login_at: ago(55), created_at: ago(120_000) },
  { operator_id: 'stf_0005', username: 'finance02', display_name: '方砚舟', department: '支付清结算部', role: 'finance', mfa_enabled: true, enabled: true, session_count: 0, last_login_at: ago(2_520), created_at: ago(96_000) },
  { operator_id: 'stf_0006', username: 'risk02', display_name: '许闻洲', department: '风控安全部', role: 'risk_ops', mfa_enabled: true, enabled: true, session_count: 0, last_login_at: ago(7_180), created_at: ago(78_000) },
  { operator_id: 'stf_0007', username: 'mod02', display_name: '周予安', department: '内容合规部', role: 'moderator', mfa_enabled: true, enabled: false, session_count: 0, last_login_at: ago(20_000), created_at: ago(60_000) },
];

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = { session_minutes: 120, failed_login_limit: 5, min_password_length: 12, require_mfa: true, ip_allowlist: ['10.20.0.0/16', '172.16.8.0/24'], updated_at: new Date().toISOString() };
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = { platform_name: 'WeTrust Console', timezone: 'Asia/Shanghai', log_retention_days: 365, support_email: 'sre@wetrust.internal', updated_at: new Date().toISOString() };
export const INITIAL_API_KEYS: ApiKeyMeta[] = [
  { key_id: 'key-pay-prod', name: '支付结算核心 API', key_prefix: 'wt_live_c5f2…', scopes: ['payment.read', 'settlement.write'], status: 'active', created_at: ago(60_000), expires_at: null, last_used_at: ago(3) },
  { key_id: 'key-risk-prod', name: '风控策略引擎 API', key_prefix: 'wt_live_8a91…', scopes: ['risk.read', 'rule.publish'], status: 'active', created_at: ago(35_000), expires_at: null, last_used_at: ago(1) },
  { key_id: 'key-content-retiring', name: '内容审核旧版 API', key_prefix: 'wt_live_91dd…', scopes: ['content.read'], status: 'retiring', created_at: ago(90_000), expires_at: due(960), last_used_at: ago(24) },
];

export interface ReportTemplate {
  key: ReportKey;
  title: string;
  code: string;
  description: string;
  roles: Role[];
  domain: string;
  fields: number;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  { key: 'merchant_applications', title: '商户进件审计明细', code: 'RPT-MERCHANT-001', description: '企业资质、法人掩码、风控得分、进件状态及审查意见', domain: '支付与商户', fields: 9, roles: ['super_admin', 'finance'] },
  { key: 'transaction_daily', title: '支付全量流水日报', code: 'RPT-TRADE-002', description: '微信支付单号、商户单号、支付金额、渠道、清算时间', domain: '交易中心', fields: 10, roles: ['super_admin', 'finance'] },
  { key: 'refund_exceptions', title: '异常退款处置台账', code: 'RPT-REFUND-003', description: '失败原因、银行通道、重试次数、最终处理状态', domain: '交易中心', fields: 9, roles: ['super_admin', 'finance'] },
  { key: 'blacklist', title: '黑名单治理清单', code: 'RPT-BLACKLIST-004', description: '六维主体、关联账号、风险来源与加入时间', domain: '风控安全', fields: 8, roles: ['super_admin', 'risk_ops'] },
  { key: 'sla_monthly', title: '客服 SLA 月度报告', code: 'RPT-SLA-005', description: '工单优先级、处理进度、SLA 逾期、责任人', domain: '客户服务', fields: 10, roles: ['super_admin', 'finance', 'moderator'] },
  { key: 'approval_audit', title: '审批裁决审计报告', code: 'RPT-APPROVAL-006', description: '申请类型、审核结论、原因、审批人与截止时点', domain: '审批中心', fields: 11, roles: ['super_admin', 'finance', 'risk_ops', 'moderator'] },
];

export const PLATFORM_NAV = [
  { id: 'approvals', label: '审批中心', en: 'Approvals', roles: ['super_admin', 'finance', 'risk_ops', 'moderator'] as Role[], route: 'approvals' as const, icon: 'ClipboardCheck' },
  { id: 'export-center', label: '导出中心', en: 'Exports', roles: ['super_admin', 'finance', 'risk_ops', 'moderator'] as Role[], route: 'export-center' as const, icon: 'Files' },
  { id: 'platform-settings', label: '系统设置', en: 'Settings', roles: ['super_admin'] as Role[], route: 'platform-settings' as const, icon: 'Settings2' },
];