import type { NavItem, Role, RouteKey } from './types';

/* ============================ 模块一：上帝视角 ============================ */

export interface EcoGmv {
  totalFen: number;
  onlineFen: number;
  offlineFen: number;
  qrFen: number;
  miniApiFen: number;
  yesterdayFen: number;
}

export interface RegionHot {
  province: string;
  short: string;
  x: number; // 0-100 地图坐标
  y: number;
  txFen: number;
  riskCount: number;
  intensity: number; // 0-100
  kind: 'tx' | 'risk' | 'mixed';
}

export interface FunnelStage {
  stage: string;
  en: string;
  count: number;
  rate: number; // 相对上一步留存
  lossRate: number;
  avgMs: number;
}

export interface ServiceHealth {
  name: string;
  cluster: string;
  pods: string;
  cpu: number;
  mem: number;
  p99: number;
  qps: number;
  status: 'healthy' | 'degraded' | 'down';
  version: string;
}

export interface DbHealth {
  name: string;
  role: string;
  lagMs: number;
  qps: number;
  conns: number;
  slow: number;
  status: 'healthy' | 'degraded';
}

export interface DepHealth {
  name: string;
  category: string;
  availability: number;
  latencyMs: number;
  status: 'up' | 'flap' | 'down';
}

export interface AlertEvent {
  id: string;
  level: 'critical' | 'high' | 'medium';
  title: string;
  detail: string;
  source: string;
  time: string;
  count: number;
  status: 'firing' | 'muted' | 'resolved';
  actionLabel: string;
}

export interface ProvinceTile {
  code: string;
  name: string;
  short: string;
  col: number;
  row: number;
  txFen: number;
  riskCount: number;
  users: number;
}

/** 34 省级行政区方块地图（Tile Grid Cartogram），坐标按地理方位近似排布 */
export const PROVINCE_TILES: ProvinceTile[] = [
  { code: 'HL', name: '黑龙江', short: '黑', col: 7, row: 0, txFen: 6800000, riskCount: 3, users: 2180 },
  { code: 'XJ', name: '新疆', short: '新', col: 0, row: 1, txFen: 4200000, riskCount: 4, users: 1460 },
  { code: 'NM', name: '内蒙古', short: '蒙', col: 4, row: 1, txFen: 5600000, riskCount: 5, users: 1720 },
  { code: 'JL', name: '吉林', short: '吉', col: 7, row: 1, txFen: 5100000, riskCount: 2, users: 1630 },
  { code: 'GS', name: '甘肃', short: '甘', col: 2, row: 2, txFen: 3900000, riskCount: 6, users: 1210 },
  { code: 'NX', name: '宁夏', short: '宁', col: 3, row: 2, txFen: 1800000, riskCount: 1, users: 560 },
  { code: 'SX', name: '山西', short: '晋', col: 4, row: 2, txFen: 9400000, riskCount: 7, users: 2840 },
  { code: 'BJ', name: '北京', short: '京', col: 5, row: 2, txFen: 79600000, riskCount: 14, users: 18640 },
  { code: 'LN', name: '辽宁', short: '辽', col: 6, row: 2, txFen: 15800000, riskCount: 9, users: 4620 },
  { code: 'XZ', name: '西藏', short: '藏', col: 0, row: 3, txFen: 900000, riskCount: 0, users: 210 },
  { code: 'QH', name: '青海', short: '青', col: 1, row: 3, txFen: 1200000, riskCount: 1, users: 380 },
  { code: 'SN', name: '陕西', short: '陕', col: 3, row: 3, txFen: 19800000, riskCount: 6, users: 5840 },
  { code: 'HE', name: '河北', short: '冀', col: 4, row: 3, txFen: 21600000, riskCount: 18, users: 7120 },
  { code: 'TJ', name: '天津', short: '津', col: 5, row: 3, txFen: 14200000, riskCount: 22, users: 4380 },
  { code: 'SC', name: '四川', short: '川', col: 2, row: 4, txFen: 54200000, riskCount: 63, users: 12860 },
  { code: 'CQ', name: '重庆', short: '渝', col: 3, row: 4, txFen: 26800000, riskCount: 17, users: 7440 },
  { code: 'HA', name: '河南', short: '豫', col: 4, row: 4, txFen: 32400000, riskCount: 21, users: 10260 },
  { code: 'SD', name: '山东', short: '鲁', col: 5, row: 4, txFen: 48600000, riskCount: 19, users: 13480 },
  { code: 'YN', name: '云南', short: '滇', col: 2, row: 5, txFen: 12400000, riskCount: 112, users: 4120 },
  { code: 'GZ', name: '贵州', short: '黔', col: 3, row: 5, txFen: 9800000, riskCount: 11, users: 3060 },
  { code: 'HB', name: '湖北', short: '鄂', col: 4, row: 5, txFen: 28600000, riskCount: 11, users: 8920 },
  { code: 'AH', name: '安徽', short: '皖', col: 5, row: 5, txFen: 24800000, riskCount: 9, users: 7680 },
  { code: 'JS', name: '江苏', short: '苏', col: 6, row: 5, txFen: 91200000, riskCount: 12, users: 21460 },
  { code: 'GX', name: '广西', short: '桂', col: 3, row: 6, txFen: 13600000, riskCount: 38, users: 4520 },
  { code: 'HN', name: '湖南', short: '湘', col: 4, row: 6, txFen: 23200000, riskCount: 13, users: 7340 },
  { code: 'JX', name: '江西', short: '赣', col: 5, row: 6, txFen: 15400000, riskCount: 8, users: 5010 },
  { code: 'ZJ', name: '浙江', short: '浙', col: 6, row: 6, txFen: 98600000, riskCount: 21, users: 22180 },
  { code: 'SH', name: '上海', short: '沪', col: 7, row: 6, txFen: 88400000, riskCount: 9, users: 19720 },
  { code: 'GD', name: '广东', short: '粤', col: 4, row: 7, txFen: 142800000, riskCount: 48, users: 31840 },
  { code: 'FJ', name: '福建', short: '闽', col: 5, row: 7, txFen: 32800000, riskCount: 87, users: 9260 },
  { code: 'TW', name: '台湾', short: '台', col: 7, row: 7, txFen: 2600000, riskCount: 1, users: 640 },
  { code: 'HI', name: '海南', short: '琼', col: 3, row: 8, txFen: 6200000, riskCount: 14, users: 1980 },
  { code: 'MO', name: '澳门', short: '澳', col: 4, row: 8, txFen: 3100000, riskCount: 6, users: 860 },
  { code: 'HK', name: '香港', short: '港', col: 5, row: 8, txFen: 11800000, riskCount: 10, users: 3240 },
];


/** 今日 24 小时分时 GMV（万元）+ 收盘预测虚线 */
export const HOURLY_GMV: { hour: number; actual: number | null; forecast: number | null }[] = [
  { hour: 0, actual: 12.4, forecast: null }, { hour: 1, actual: 8.1, forecast: null }, { hour: 2, actual: 5.6, forecast: null },
  { hour: 3, actual: 4.2, forecast: null }, { hour: 4, actual: 3.8, forecast: null }, { hour: 5, actual: 5.1, forecast: null },
  { hour: 6, actual: 9.8, forecast: null }, { hour: 7, actual: 18.6, forecast: null }, { hour: 8, actual: 32.4, forecast: null },
  { hour: 9, actual: 41.2, forecast: null }, { hour: 10, actual: 48.6, forecast: null }, { hour: 11, actual: 55.1, forecast: null },
  { hour: 12, actual: 62.8, forecast: null }, { hour: 13, actual: 51.4, forecast: null }, { hour: 14, actual: 58.9, forecast: null },
  { hour: 15, actual: 64.2, forecast: null }, { hour: 16, actual: null, forecast: 71.0 }, { hour: 17, actual: null, forecast: 78.5 },
  { hour: 18, actual: null, forecast: 88.2 }, { hour: 19, actual: null, forecast: 96.4 }, { hour: 20, actual: null, forecast: 92.1 },
  { hour: 21, actual: null, forecast: 74.6 }, { hour: 22, actual: null, forecast: 51.2 }, { hour: 23, actual: null, forecast: 28.4 },
];

/** 各渠道今日交易额占比（用于环形图） */
export const CHANNEL_DONUT: { label: string; fen: number; color: string }[] = [
  { label: '扫码支付', fen: 353899900, color: '#111827' },
  { label: '小程序 API', fen: 261211900, color: '#F97316' },
  { label: '刷卡支付', fen: 160097600, color: '#10B981' },
  { label: 'APP/JSAPI', fen: 67409542, color: '#38BDF8' },
];

export const ECO_GMV: EcoGmv = {
  totalFen: 842619042,
  onlineFen: 381280400,
  offlineFen: 197330800,
  qrFen: 158220342,
  miniApiFen: 105787500,
  yesterdayFen: 749820000,
};

export const REGION_HOTSPOTS: RegionHot[] = [
  { province: '广东省', short: '粤', x: 62, y: 74, txFen: 142800000, riskCount: 48, intensity: 96, kind: 'mixed' },
  { province: '浙江省', short: '浙', x: 74, y: 58, txFen: 98600000, riskCount: 21, intensity: 82, kind: 'tx' },
  { province: '江苏省', short: '苏', x: 72, y: 50, txFen: 91200000, riskCount: 12, intensity: 76, kind: 'tx' },
  { province: '上海市', short: '沪', x: 78, y: 52, txFen: 88400000, riskCount: 9, intensity: 74, kind: 'tx' },
  { province: '北京市', short: '京', x: 66, y: 30, txFen: 79600000, riskCount: 14, intensity: 70, kind: 'tx' },
  { province: '四川省', short: '川', x: 46, y: 60, txFen: 54200000, riskCount: 63, intensity: 88, kind: 'risk' },
  { province: '福建省', short: '闽', x: 70, y: 68, txFen: 32800000, riskCount: 87, intensity: 93, kind: 'risk' },
  { province: '湖北省', short: '鄂', x: 60, y: 56, txFen: 28600000, riskCount: 11, intensity: 48, kind: 'tx' },
  { province: '陕西省', short: '陕', x: 56, y: 44, txFen: 19800000, riskCount: 6, intensity: 36, kind: 'tx' },
  { province: '云南省', short: '滇', x: 42, y: 74, txFen: 12400000, riskCount: 112, intensity: 98, kind: 'risk' },
  { province: '新疆', short: '新', x: 22, y: 32, txFen: 4200000, riskCount: 4, intensity: 18, kind: 'tx' },
  { province: '黑龙江', short: '黑', x: 78, y: 16, txFen: 6800000, riskCount: 3, intensity: 22, kind: 'tx' },
];

export const FUNNEL_STAGES: FunnelStage[] = [
  { stage: '曝光', en: 'Expose', count: 48210600, rate: 100, lossRate: 0, avgMs: 0 },
  { stage: '点击', en: 'Click', count: 8912400, rate: 18.49, lossRate: 81.51, avgMs: 320 },
  { stage: '加购', en: 'Cart', count: 2418300, rate: 27.13, lossRate: 72.87, avgMs: 1850 },
  { stage: '支付', en: 'Pay', count: 1489620, rate: 61.6, lossRate: 38.4, avgMs: 890 },
  { stage: '结算', en: 'Settle', count: 1478218, rate: 99.23, lossRate: 0.77, avgMs: 2400 },
];

export const SERVICE_HEALTH: ServiceHealth[] = [
  { name: 'pay-gateway', cluster: 'pay-core / cn-south-1', pods: '48/48', cpu: 41, mem: 58, p99: 42, qps: 18240, status: 'healthy', version: 'v2.18.4' },
  { name: 'risk-engine', cluster: 'risk / cn-south-1', pods: '32/32', cpu: 67, mem: 71, p99: 88, qps: 18240, status: 'healthy', version: 'v4.2.0' },
  { name: 'im-gateway', cluster: 'im / cn-east-1', pods: '64/64', cpu: 52, mem: 49, p99: 31, qps: 96400, status: 'healthy', version: 'v6.9.1' },
  { name: 'settle-worker', cluster: 'pay-core / cn-south-1', pods: '15/16', cpu: 84, mem: 77, p99: 412, qps: 1240, status: 'degraded', version: 'v1.44.2' },
  { name: 'audit-pipeline', cluster: 'content / cn-north-1', pods: '24/24', cpu: 38, mem: 44, p99: 120, qps: 3880, status: 'healthy', version: 'v3.11.0' },
  { name: 'push-dispatch', cluster: 'msg / cn-east-1', pods: '0/12', cpu: 0, mem: 0, p99: 0, qps: 0, status: 'down', version: 'v2.3.9' },
];

export const DB_HEALTH: DbHealth[] = [
  { name: 'tidb-pay (主)', role: 'primary · 南沙', lagMs: 0, qps: 24180, conns: 812, slow: 3, status: 'healthy' },
  { name: 'tidb-pay (从)', role: 'replica · 张家口', lagMs: 142, qps: 18320, conns: 655, slow: 1, status: 'healthy' },
  { name: 'pg-risk', role: 'primary · 南沙', lagMs: 12, qps: 9210, conns: 220, slow: 0, status: 'healthy' },
  { name: 'pg-content', role: 'replica · 上海', lagMs: 890, qps: 4410, conns: 188, slow: 14, status: 'degraded' },
];

export const DEP_HEALTH: DepHealth[] = [
  { name: '公安 NCIIC 实名核验', category: '合规', availability: 99.99, latencyMs: 210, status: 'up' },
  { name: '银联前置通道', category: '清算', availability: 99.98, latencyMs: 180, status: 'up' },
  { name: '网联清算通道', category: '清算', availability: 99.97, latencyMs: 165, status: 'up' },
  { name: '招商银行企业网银', category: '银行', availability: 99.92, latencyMs: 340, status: 'up' },
  { name: '建设银行代付', category: '银行', availability: 97.42, latencyMs: 1420, status: 'flap' },
  { name: '反诈中心黑库同步', category: '风控', availability: 100, latencyMs: 95, status: 'up' },
];

export const ALERT_POOL: AlertEvent[] = [
  { id: 'ALT-20260224-101', level: 'critical', title: '滇南边境 IP 段突发薅羊毛攻击', detail: '192.0.2.0/24 在 10 分钟内用 1,204 个新设备领取立减金，命中设备农场模型。', source: '营销风控引擎', time: '2 分钟前', count: 1204, status: 'firing', actionLabel: '一键熔断该批次' },
  { id: 'ALT-20260224-098', level: 'critical', title: '商户 M2026022000325 大额资金异常流出', detail: '单笔 98,000 元连续 5 笔流向同一私人卡，AML 规则 RS-2401 命中。', source: '反洗钱监控', time: '9 分钟前', count: 5, status: 'firing', actionLabel: '冻结商户并止付' },
  { id: 'ALT-20260224-095', level: 'high', title: 'push-dispatch 集群 12 个 Pod 全部 Crash', detail: 'cn-east-1 消息推送延迟飙升至 42s，模板消息堆积 18 万条。', source: 'SRE / Prometheus', time: '16 分钟前', count: 12, status: 'firing', actionLabel: '切流到备用集群' },
  { id: 'ALT-20260224-091', level: 'high', title: '疑似 DDOS：im-gateway SYN 洪水', detail: '单 IP 段每秒 48 万包，WAF 已限流，WebSocket 抖动 0.8%。', source: 'WAF 安全防护', time: '31 分钟前', count: 1, status: 'muted', actionLabel: '封禁攻击网段' },
  { id: 'ALT-20260224-086', level: 'medium', title: 'pg-content 从库延迟突破 800ms', detail: '上海从库慢查询 14 条，内容审核列表读取已自动降级走主库。', source: 'DBA / TiDB Monitor', time: '44 分钟前', count: 14, status: 'firing', actionLabel: 'Kill 慢查询' },
];

/* ==================== 模块二：资金全生命周期 ==================== */

export interface SplitRule {
  id: string;
  merchantNo: string;
  merchantName: string;
  ratio: number;
  mode: 'realtime' | 'delay';
  delayDays: number;
  monthFen: number;
  status: 'active' | 'paused' | 'rollback_pending';
  approver: string;
}

export interface Withdrawal {
  id: string;
  merchantNo: string;
  merchantName: string;
  amountFen: number;
  type: 'T0' | 'T1';
  bank: string;
  status: 'queued' | 'verifying' | 'paying' | 'success' | 'failed';
  failReason: string | null;
  phoneVerified: boolean;
  createdAt: string;
}

export interface LedgerGap {
  id: string;
  tradeNo: string;
  kind: 'long' | 'short' | 'single';
  amountFen: number;
  reason: string;
  channel: string;
  status: 'open' | 'fixing' | 'fixed';
  createdAt: string;
}

export interface VoucherBatch {
  id: string;
  name: string;
  budgetFen: number;
  issuedFen: number;
  redeemed: number;
  redeemRate: number;
  fuseThreshold: number;
  status: 'running' | 'fused' | 'ended';
  channel: string;
}

export interface EnterprisePay {
  id: string;
  receiver: string;
  receiverUid: string;
  amountFen: number;
  dayUsedFen: number;
  dayLimitFen: number;
  kyc: 'pass' | 'pending' | 'fail';
  status: 'success' | 'refunding' | 'failed';
  failReason: string | null;
  createdAt: string;
}

export const SPLIT_RULES: SplitRule[] = [
  { id: 'SPLIT-8810', merchantNo: 'M2026022200718', merchantName: '北京青禾文化传媒', ratio: 6.5, mode: 'delay', delayDays: 7, monthFen: 48260000, status: 'active', approver: '林清和' },
  { id: 'SPLIT-8804', merchantNo: 'M2026022100497', merchantName: '广州拾光美妆贸易', ratio: 3.2, mode: 'realtime', delayDays: 0, monthFen: 98672000, status: 'active', approver: 'root' },
  { id: 'SPLIT-8799', merchantNo: 'M2026022400176', merchantName: '厦门澄海跨境电子', ratio: 8.0, mode: 'delay', delayDays: 14, monthFen: 86430000, status: 'rollback_pending', approver: '顾以宁' },
  { id: 'SPLIT-8791', merchantNo: 'M2026022200683', merchantName: '成都云栖餐饮管理', ratio: 2.0, mode: 'realtime', delayDays: 0, monthFen: 49862000, status: 'paused', approver: '林清和' },
  { id: 'SPLIT-8788', merchantNo: 'M2026022400189', merchantName: '杭州星野数字科技', ratio: 1.5, mode: 'realtime', delayDays: 0, monthFen: 64218000, status: 'active', approver: 'root' },
];

export const WITHDRAWALS: Withdrawal[] = [
  { id: 'WD-20260224-6601', merchantNo: 'M2026022100532', merchantName: '苏州鹿鸣医疗器械', amountFen: 62000000, type: 'T1', bank: '招商银行', status: 'verifying', failReason: null, phoneVerified: false, createdAt: '2026-02-24 14:02:11' },
  { id: 'WD-20260224-6598', merchantNo: 'M2026022400189', merchantName: '杭州星野数字科技', amountFen: 18800000, type: 'T0', bank: '建设银行', status: 'paying', failReason: null, phoneVerified: true, createdAt: '2026-02-24 13:48:52' },
  { id: 'WD-20260224-6590', merchantNo: 'M2026022200683', merchantName: '成都云栖餐饮管理', amountFen: 9200000, type: 'T1', bank: '工商银行', status: 'failed', failReason: '结算账户处于司法冻结，代付被银行拒绝', phoneVerified: true, createdAt: '2026-02-24 11:20:33' },
  { id: 'WD-20260224-6584', merchantNo: 'M2026022100497', merchantName: '广州拾光美妆贸易', amountFen: 24500000, type: 'T1', bank: '农业银行', status: 'queued', failReason: null, phoneVerified: true, createdAt: '2026-02-24 10:15:09' },
  { id: 'WD-20260224-6577', merchantNo: 'M2026022400176', merchantName: '厦门澄海跨境电子', amountFen: 56000000, type: 'T1', bank: '中国银行', status: 'failed', failReason: '可用余额不足，T+1 在途资金未到账', phoneVerified: true, createdAt: '2026-02-24 09:41:27' },
  { id: 'WD-20260224-6570', merchantNo: 'M2026022300921', merchantName: '上海陆屿智能科技', amountFen: 7600000, type: 'T0', bank: '招商银行', status: 'success', failReason: null, phoneVerified: true, createdAt: '2026-02-24 09:02:44' },
];

export const LEDGER_GAPS: LedgerGap[] = [
  { id: 'GAP-4401', tradeNo: '4200002451202602231830916955', kind: 'single', amountFen: 980000, reason: '银行已扣款，微信侧未收到回调', channel: '银联', status: 'open', createdAt: '2026-02-23 19:26:10' },
  { id: 'GAP-4398', tradeNo: '4200002451202602241830917012', kind: 'long', amountFen: 12900, reason: '重复回调导致平台长款', channel: '网联', status: 'fixing', createdAt: '2026-02-24 09:19:02' },
  { id: 'GAP-4395', tradeNo: '4200002451202602231830916874', kind: 'short', amountFen: 1560000, reason: '手续费多扣 0.6%，平台短款', channel: '网联', status: 'open', createdAt: '2026-02-23 15:42:31' },
  { id: 'GAP-4391', tradeNo: '4200002451202602241830917098', kind: 'single', amountFen: 35900, reason: '退款成功但订单状态未翻转', channel: '银联', status: 'fixed', createdAt: '2026-02-24 12:34:08' },
];

export const VOUCHER_BATCHES: VoucherBatch[] = [
  { id: 'VC-2026-0218', name: '开学季满100减20立减金', budgetFen: 500000000, issuedFen: 386200000, redeemed: 182340, redeemRate: 47.2, fuseThreshold: 90, status: 'running', channel: '小程序' },
  { id: 'VC-2026-0211', name: '跨境美妆新人 50 元券', budgetFen: 200000000, issuedFen: 198400000, redeemed: 96210, redeemRate: 48.5, fuseThreshold: 95, status: 'fused', channel: '扫码' },
  { id: 'VC-2026-0204', name: '餐饮连锁周末 5 折券', budgetFen: 120000000, issuedFen: 119800000, redeemed: 88420, redeemRate: 73.8, fuseThreshold: 92, status: 'ended', channel: '扫码' },
  { id: 'VC-2026-0130', name: '医疗器械企业采购券', budgetFen: 80000000, issuedFen: 21400000, redeemed: 3120, redeemRate: 14.6, fuseThreshold: 90, status: 'running', channel: 'API' },
];

export const ENTERPRISE_PAYS: EnterprisePay[] = [
  { id: 'EP-77120', receiver: '陆星河 · 数码评测', receiverUid: 'wx_uid_88492179', amountFen: 880000, dayUsedFen: 1880000, dayLimitFen: 5000000, kyc: 'pass', status: 'success', failReason: null, createdAt: '2026-02-24 14:31:05' },
  { id: 'EP-77118', receiver: '福利派发官 007', receiverUid: 'wx_uid_88492265', amountFen: 28800, dayUsedFen: 28800, dayLimitFen: 5000000, kyc: 'fail', status: 'failed', failReason: '收款人命中欺诈黑名单，付款被拦截', createdAt: '2026-02-24 13:12:48' },
  { id: 'EP-77109', receiver: '苏清禾 Studio', receiverUid: 'wx_uid_88492104', amountFen: 1200000, dayUsedFen: 1200000, dayLimitFen: 5000000, kyc: 'pass', status: 'refunding', failReason: '收款账户注销，资金原路退回中', createdAt: '2026-02-24 11:55:19' },
  { id: 'EP-77102', receiver: '陈默远 (跨境严选)', receiverUid: 'wx_uid_88492038', amountFen: 1500000, dayUsedFen: 1500000, dayLimitFen: 5000000, kyc: 'pending', status: 'failed', failReason: '收款人未完成增强实名核验', createdAt: '2026-02-24 10:28:36' },
];

/* ==================== 模块三：风控大脑 ==================== */

export interface VisualRule {
  id: string;
  name: string;
  conditions: { field: string; op: string; value: string }[];
  logic: 'AND' | 'OR';
  action: string;
  grayPct: number;
  killRate: number;
  status: 'draft' | 'gray' | 'live' | 'rolledback';
}

export interface StrategyVersion {
  version: string;
  author: string;
  time: string;
  change: string;
  grayPct: number;
  killRate: number;
  stable: boolean;
}

export interface RiskCase {
  id: string;
  uid: string;
  nickname: string;
  amountFen: number;
  level: 'critical' | 'high' | 'medium';
  reason: string;
  time: string;
  tags: string[];
  radar: { label: string; score: number }[];
  status: 'open' | 'frozen' | 'closed';
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'user' | 'device' | 'ip' | 'card' | 'contact';
  x: number;
  y: number;
  risk: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export const VISUAL_RULES: VisualRule[] = [
  { id: 'VR-301', name: '大额异地交易拦截', conditions: [{ field: '交易金额', op: '>', value: '10000 元' }, { field: 'IP归属地', op: '!=', value: '常驻地' }], logic: 'AND', action: '拦截并冻结', grayPct: 100, killRate: 0.32, status: 'live' },
  { id: 'VR-302', name: '凌晨高频代付告警', conditions: [{ field: '时段', op: 'in', value: '23:00-06:00' }, { field: '1小时代付笔数', op: '>', value: '5 笔' }], logic: 'AND', action: '仅告警', grayPct: 20, killRate: 0.08, status: 'gray' },
  { id: 'VR-303', name: '模拟器改机阻断', conditions: [{ field: '设备类型', op: '=', value: '模拟器/改机' }, { field: '单日交易额', op: '>', value: '3000 元' }], logic: 'OR', action: '拦截并冻结', grayPct: 1, killRate: 0.02, status: 'gray' },
  { id: 'VR-298', name: '新设备大额提现', conditions: [{ field: '设备注册天数', op: '<', value: '7 天' }, { field: '提现金额', op: '>', value: '50000 元' }], logic: 'AND', action: '转人工复核', grayPct: 0, killRate: 0, status: 'draft' },
];

export const STRATEGY_VERSIONS: StrategyVersion[] = [
  { version: 'v4.2.0', author: '顾以宁', time: '2026-02-24 08:02', change: '新增高风险 IP 阻断 + 凌晨熔断阈值下调', grayPct: 100, killRate: 0.31, stable: true },
  { version: 'v4.1.3', author: 'root', time: '2026-02-21 17:40', change: '修复跨境商户误杀：汇率套利规则放宽', grayPct: 100, killRate: 0.12, stable: true },
  { version: 'v4.1.2', author: '沈知微', time: '2026-02-20 11:05', change: '设备多账号规则误杀率 2.1% 偏高，已回滚', grayPct: 0, killRate: 2.1, stable: false },
  { version: 'v4.1.0', author: '顾以宁', time: '2026-02-18 09:30', change: '全量上线新进件商户提现保护', grayPct: 100, killRate: 0.18, stable: true },
];

export const RISK_CASES: RiskCase[] = [
  {
    id: 'RISK-20260224-9081', uid: 'wx_uid_88492265', nickname: '福利派发官 007', amountFen: 14860000, level: 'critical',
    reason: '凌晨 02:15-02:42 在 3 个异地 IP 连续接收 37 笔满额转账，90 秒内分拆提现，命中洗钱链路规则 AML_VELOCITY_992。',
    time: '2026-02-24 02:43', tags: ['洗钱链路', '快进快出', '代理IP'], status: 'frozen',
    radar: [{ label: '异地登录', score: 97 }, { label: '设备异常', score: 88 }, { label: '高额高频', score: 98 }, { label: '凌晨活跃', score: 92 }, { label: '关联黑产', score: 95 }, { label: '社交裂变', score: 61 }],
  },
  {
    id: 'RISK-20260224-9045', uid: 'wx_uid_88492038', nickname: '陈默远 (跨境严选)', amountFen: 6250000, level: 'high',
    reason: '更换模拟器设备 5 分钟内关闭人脸校验，向涉赌商户池发起连续大额代付，存在虚拟定位篡改。',
    time: '2026-02-24 01:18', tags: ['模拟器', '涉赌代付', '定位篡改'], status: 'open',
    radar: [{ label: '异地登录', score: 86 }, { label: '设备异常', score: 94 }, { label: '高额高频', score: 91 }, { label: '凌晨活跃', score: 88 }, { label: '关联黑产', score: 72 }, { label: '社交裂变', score: 44 }],
  },
  {
    id: 'RISK-20260223-8812', uid: 'wx_uid_88492771', nickname: '拾光分销·阿K', amountFen: 1820000, level: 'medium',
    reason: '同一设备关联 6 个账号批量领券，优惠券核销 IP 高度重合，疑似团伙薅羊毛。',
    time: '2026-02-23 20:07', tags: ['薅羊毛', '批量领券'], status: 'open',
    radar: [{ label: '异地登录', score: 42 }, { label: '设备异常', score: 78 }, { label: '高额高频', score: 55 }, { label: '凌晨活跃', score: 38 }, { label: '关联黑产', score: 66 }, { label: '社交裂变', score: 81 }],
  },
];

export const RISK_GRAPH_NODES: GraphNode[] = [
  { id: 'u0', label: '福利派发官 007', kind: 'user', x: 50, y: 46, risk: 98 },
  { id: 'd1', label: '改机设备 A4:C3…', kind: 'device', x: 22, y: 24, risk: 92 },
  { id: 'd2', label: '改机设备 8E:2C…', kind: 'device', x: 24, y: 70, risk: 85 },
  { id: 'i1', label: '203.0.113.42', kind: 'ip', x: 50, y: 14, risk: 90 },
  { id: 'i2', label: '198.51.100.17', kind: 'ip', x: 78, y: 24, risk: 76 },
  { id: 'c1', label: '尾号 3181 建行卡', kind: 'card', x: 80, y: 66, risk: 88 },
  { id: 'c2', label: '尾号 9042 邮储卡', kind: 'card', x: 52, y: 84, risk: 71 },
  { id: 'f1', label: '联系人：陈默远', kind: 'contact', x: 18, y: 48, risk: 64 },
];

export const RISK_GRAPH_EDGES: GraphEdge[] = [
  { from: 'u0', to: 'd1', label: '登录 47 次' },
  { from: 'u0', to: 'd2', label: '登录 19 次' },
  { from: 'u0', to: 'i1', label: '支付 31 笔' },
  { from: 'd1', to: 'i1', label: '同出口' },
  { from: 'u0', to: 'c1', label: '提现 12 笔' },
  { from: 'u0', to: 'c2', label: '提现 5 笔' },
  { from: 'u0', to: 'f1', label: '转账 8 笔' },
  { from: 'd2', to: 'i2', label: '同出口' },
];

/* ==================== 模块四：社交内容深渊 ==================== */

export interface SensWord {
  id: string;
  word: string;
  category: '涉政' | '涉黄' | '涉诈' | '广告';
  lang: string;
  regex: boolean;
  hitCount: number;
  enabled: boolean;
}

export interface ChatMsg {
  msgId: string;
  from: string;
  content: string;
  time: string;
  hit: boolean;
  mine: boolean;
}

export interface InterceptItem {
  id: string;
  type: '链接' | '文件' | '小程序';
  name: string;
  detail: string;
  risk: string;
  action: string;
  time: string;
}

export interface VideoItem {
  id: string;
  author: string;
  uid: string;
  duration: string;
  aiTags: string[];
  riskScore: number;
  frames: { label: string; tone: string }[];
  status: 'pending' | 'pass' | 'reject';
  reports: number;
}

export interface LiveRoomFull {
  id: string;
  anchor: string;
  title: string;
  viewers: number;
  category: string;
  riskScore: number;
  status: 'live' | 'warned' | 'cut';
  credit: number;
  danmaku: { user: string; text: string; hit: boolean }[];
}

export const SENS_WORDS: SensWord[] = [
  { id: 'SW-1201', word: '加微信.*领.*(福利|红包|返利)', category: '涉诈', lang: '中文', regex: true, hitCount: 4821, enabled: true },
  { id: 'SW-1202', word: '日入.{0,4}1500', category: '涉诈', lang: '中文', regex: true, hitCount: 1932, enabled: true },
  { id: 'SW-1188', word: '裸聊', category: '涉黄', lang: '中文', regex: false, hitCount: 884, enabled: true },
  { id: 'SW-1176', word: 'free vpn download', category: '广告', lang: '英文', regex: false, hitCount: 412, enabled: true },
  { id: 'SW-1160', word: '兼职.*刷单', category: '涉诈', lang: '中文', regex: true, hitCount: 3318, enabled: true },
  { id: 'SW-1142', word: 'Tối nay nhận thưởng', category: '涉诈', lang: '越南语', regex: false, hitCount: 156, enabled: false },
];

export const CHAT_CONTEXT: ChatMsg[] = [
  { msgId: 'm-101', from: '陆屿科技 王工', content: '兄弟，你发的那个返利链接靠谱吗？', time: '02:11:08', hit: false, mine: false },
  { msgId: 'm-102', from: '福利派发官 007', content: '靠谱啊，内部渠道，昨晚刚到账 288', time: '02:11:44', hit: false, mine: true },
  { msgId: 'm-103', from: '福利派发官 007', content: '加微信 wx_fuli_8899，前 50 名送免单名额', time: '02:12:03', hit: true, mine: true },
  { msgId: 'm-104', from: '陆屿科技 王工', content: '要先交 99 吗？我看群里有人说要垫付', time: '02:12:40', hit: false, mine: false },
  { msgId: 'm-105', from: '福利派发官 007', content: '那是升级 VIP 的，不升级也能领基础包', time: '02:13:15', hit: false, mine: true },
  { msgId: 'm-106', from: '福利派发官 007', content: '扫这个码进群，今晚 12 点开奖，手慢无', time: '02:13:51', hit: true, mine: true },
  { msgId: 'm-107', from: '系统', content: '【风控提示】该用户 19 次被举报导流欺诈', time: '02:14:00', hit: false, mine: false },
];

export const INTERCEPT_ITEMS: InterceptItem[] = [
  { id: 'BL-6601', type: '链接', name: 'http://fuli-8899.top/get', detail: '仿冒微信红包页，诱导输入支付密码', risk: '钓鱼盗号', action: '已拦截并全网封禁域名', time: '02:13:52' },
  { id: 'BL-6598', type: '文件', name: '返利助手.apk (18.2MB)', detail: '检出窃取短信 + 远程控制木马特征', risk: '木马远控', action: '已拦截下载并上报样本库', time: '01:58:20' },
  { id: 'BL-6590', type: '小程序', name: '天天领免单（wx8f2…）', detail: '诱导分享裂变，类目与实际功能不符', risk: '诱导分享', action: '已下架并冻结结算', time: '昨天 22:41' },
];

export const VIDEO_QUEUE: VideoItem[] = [
  { id: 'VD-9021', author: '福利派发官 007', uid: 'wx_uid_88492265', duration: '00:47', aiTags: ['二维码导流', '虚假收益'], riskScore: 96, frames: [{ label: '0:05 开场话术', tone: 'from-rose-500 to-orange-500' }, { label: '0:18 收益截图', tone: 'from-emerald-500 to-teal-600' }, { label: '0:33 二维码', tone: 'from-slate-700 to-slate-900' }, { label: '0:44 催单话术', tone: 'from-amber-500 to-red-500' }], status: 'pending', reports: 23 },
  { id: 'VD-9018', author: '陈默远 (跨境严选)', uid: 'wx_uid_88492038', duration: '01:12', aiTags: ['兼职诈骗', '收益承诺'], riskScore: 91, frames: [{ label: '0:08 招募话术', tone: 'from-sky-500 to-indigo-600' }, { label: '0:40 到账演示', tone: 'from-emerald-500 to-green-600' }, { label: '1:02 私信引导', tone: 'from-violet-500 to-purple-600' }], status: 'pending', reports: 11 },
  { id: 'VD-9009', author: '苏清禾 Studio', uid: 'wx_uid_88492104', duration: '03:20', aiTags: ['正常内容'], riskScore: 8, frames: [{ label: '0:30 读书分享', tone: 'from-emerald-500 to-teal-600' }, { label: '1:50 互动问答', tone: 'from-stone-500 to-stone-700' }], status: 'pending', reports: 0 },
];

export const LIVE_WALL: LiveRoomFull[] = [
  { id: 'LV-1001', anchor: '拾光美妆·小禾', title: '春季新品口红专场｜全场 5 折', viewers: 48210, category: '美妆', riskScore: 12, status: 'live', credit: 98, danmaku: [{ user: '桃子🍑', text: '色号 08 还有吗', hit: false }, { user: '阿梨', text: '已下单两支', hit: false }, { user: '客服号', text: '加微信领隐藏券 wx_gg01', hit: true }] },
  { id: 'LV-1002', anchor: '副业导师K哥', title: '0 基础日入四位数，今晚揭秘', viewers: 12880, category: '财经', riskScore: 94, status: 'warned', credit: 61, danmaku: [{ user: '想翻身', text: '真的假的', hit: false }, { user: '托儿A', text: '我上周赚了 9000', hit: true }, { user: 'K哥', text: '私信我发教程', hit: true }] },
  { id: 'LV-1003', anchor: '云栖探店', title: '成都火锅 39.9 双人餐', viewers: 22140, category: '美食', riskScore: 22, status: 'live', credit: 92, danmaku: [{ user: '干饭人', text: '地址发一下', hit: false }, { user: '主播', text: '团购链接在小黄车', hit: false }] },
  { id: 'LV-1004', anchor: '午夜情感树洞', title: '深夜连麦｜情感咨询', viewers: 8860, category: '情感', riskScore: 68, status: 'warned', credit: 74, danmaku: [{ user: '路人', text: '主播露一下', hit: true }, { user: '主播', text: '文明观看哦', hit: false }] },
  { id: 'LV-1005', anchor: '陆屿科技官方', title: '新品 SaaS 发布会', viewers: 15230, category: '科技', riskScore: 4, status: 'live', credit: 100, danmaku: [{ user: 'CTO老王', text: 'API 文档什么时候出', hit: false }, { user: '主播', text: '今晚 8 点同步', hit: false }] },
  { id: 'LV-1006', anchor: '翡翠原石老周', title: '缅北直供｜今晚切涨', viewers: 31200, category: '珠宝', riskScore: 88, status: 'warned', credit: 58, danmaku: [{ user: '翠友', text: '这块多少', hit: false }, { user: '老周', text: '加微信私下转，不走平台', hit: true }] },
  { id: 'LV-1007', anchor: '青禾读书会', title: '《置身事内》共读第 4 期', viewers: 4210, category: '文化', riskScore: 2, status: 'live', credit: 100, danmaku: [{ user: '书友', text: '老师讲得真好', hit: false }] },
  { id: 'LV-1008', anchor: '球鞋搬运工', title: '限量球鞋 3 折秒杀', viewers: 18900, category: '潮鞋', riskScore: 57, status: 'live', credit: 79, danmaku: [{ user: '买家', text: '是正品吗', hit: false }, { user: '主播', text: '支持得物鉴定', hit: false }] },
  { id: 'LV-1009', anchor: '深夜福利姬', title: '点关注进粉丝群…', viewers: 9640, category: '颜值', riskScore: 97, status: 'cut', credit: 32, danmaku: [{ user: '管理员', text: '该直播因低俗已被切断', hit: true }] },
];

/* ==================== 模块五：开放生态 ==================== */

export interface MiniApp {
  id: string;
  name: string;
  appid: string;
  version: string;
  category: string;
  appliedCategory: string;
  match: boolean;
  scanIssues: { level: string; desc: string }[];
  status: 'reviewing' | 'pass' | 'reject' | 'offline';
  applicant: string;
  updatedAt: string;
}

export interface MpArticle {
  id: string;
  title: string;
  account: string;
  similarity: number;
  origin: string;
  status: 'online' | 'deleted' | 'banned';
  reads: number;
}

export const MINI_APPS: MiniApp[] = [
  { id: 'MA-3101', name: '天天领免单', appid: 'wx8f2a91c4d7', version: '2.4.1', category: '社交红包', appliedCategory: '工具/效率', match: false, scanIssues: [{ level: '高危', desc: '调用未声明的 getPhoneNumber 静默获取手机号' }, { level: '高危', desc: '含诱导分享 API：onShareAppMessage 强制裂变' }], status: 'reviewing', applicant: '天津海川数据', updatedAt: '2026-02-24 13:22' },
  { id: 'MA-3098', name: '星野严选商城', appid: 'wx3b19e70ac2', version: '5.1.0', category: '电商/品牌直营', appliedCategory: '电商/品牌直营', match: true, scanIssues: [], status: 'pass', applicant: '杭州星野数字', updatedAt: '2026-02-23 18:40' },
  { id: 'MA-3095', name: '云栖点餐', appid: 'wx77d2c018be', version: '3.0.2', category: '餐饮/点餐', appliedCategory: '餐饮/点餐', match: true, scanIssues: [{ level: '中危', desc: '地理位置权限申请范围过大' }], status: 'reviewing', applicant: '成都云栖餐饮', updatedAt: '2026-02-24 09:15' },
  { id: 'MA-3088', name: '翡翠原石直购', appid: 'wx91aa47c3f0', version: '1.9.8', category: '珠宝/拍卖', appliedCategory: '珠宝/拍卖', match: true, scanIssues: [{ level: '高危', desc: '含站外支付跳转，绕过微信支付' }], status: 'offline', applicant: '个体·老周', updatedAt: '2026-02-22 21:07' },
];

export const MP_ARTICLES: MpArticle[] = [
  { id: 'MP-5501', title: '震惊！每天喝它，血管干净如新', account: '健康养生堂', similarity: 92, origin: '“养生前沿” 2026-02-10', status: 'online', reads: 102400 },
  { id: 'MP-5498', title: '日入 1500 的秘密，知道的人不多', account: '副业情报局', similarity: 88, origin: '“防骗指南” 2026-02-08（反向洗稿）', status: 'online', reads: 88400 },
  { id: 'MP-5490', title: '《置身事内》读书笔记（四）', account: '青禾读书会', similarity: 6, origin: '原创', status: 'online', reads: 12400 },
  { id: 'MP-5482', title: '内部返利群招募，名额有限', account: '福利情报站', similarity: 95, origin: '“福利派发官”朋友圈文案', status: 'banned', reads: 45200 },
];

/* ==================== 模块六：客服与触达 ==================== */

export interface Ticket {
  id: string;
  kind: '用户申诉' | '商户投诉' | '资金解冻' | '内容处罚申诉';
  title: string;
  requester: string;
  priority: 'P0' | 'P1' | 'P2';
  slaMinutes: number;
  slaLeft: number;
  status: 'open' | 'doing' | 'escalated' | 'closed';
  assignee: string;
  createdAt: string;
  timeline: { time: string; actor: string; action: string }[];
}

export interface TouchTemplate {
  id: string;
  channel: '站内信' | '短信' | '模板消息' | 'Push';
  name: string;
  content: string;
  freqLimit: string;
  sent: number;
  successRate: number;
  blocked: number;
  status: 'active' | 'paused';
}

export const TICKETS: Ticket[] = [
  { id: 'TK-20260224-310', kind: '资金解冻', title: '商户称 62 万提现被风控拦截，要求加急解冻', requester: '苏州鹿鸣医疗器械', priority: 'P0', slaMinutes: 120, slaLeft: 38, status: 'doing', assignee: '林清和', createdAt: '2026-02-24 14:02', timeline: [{ time: '14:02', actor: '系统', action: '工单创建，SLA 120 分钟' }, { time: '14:20', actor: '林清和', action: '已调取提现风控报告，发起电核' }, { time: '14:44', actor: '系统', action: '电核通过，等待复核放行' }] },
  { id: 'TK-20260224-305', kind: '用户申诉', title: '用户称账号被误封，否认发布返利内容', requester: 'wx_uid_88492179', priority: 'P1', slaMinutes: 240, slaLeft: 122, status: 'open', assignee: '待分配', createdAt: '2026-02-24 12:31', timeline: [{ time: '12:31', actor: '系统', action: '工单创建，关联处罚单 MOM-20260224-0091' }] },
  { id: 'TK-20260224-298', kind: '商户投诉', title: '投诉分账比例与合同不符，要求回退', requester: '厦门澄海跨境电子', priority: 'P1', slaMinutes: 480, slaLeft: -12, status: 'escalated', assignee: '顾以宁', createdAt: '2026-02-23 16:20', timeline: [{ time: '16:20', actor: '系统', action: '工单创建' }, { time: '今 08:20', actor: '系统', action: 'SLA 超时 12 分钟，自动升级给主管' }] },
  { id: 'TK-20260224-290', kind: '内容处罚申诉', title: '主播对直播断流处罚申诉，要求恢复信用分', requester: '翡翠原石老周', priority: 'P2', slaMinutes: 720, slaLeft: 402, status: 'doing', assignee: '沈知微', createdAt: '2026-02-24 09:14', timeline: [{ time: '09:14', actor: '系统', action: '工单创建，关联直播 LV-1006' }, { time: '10:02', actor: '沈知微', action: '已回放断流前 5 分钟录像，确认站外交易话术' }] },
  { id: 'TK-20260223-281', kind: '用户申诉', title: '群聊被误解散，群主申请恢复', requester: 'wx_uid_88492825', priority: 'P2', slaMinutes: 720, slaLeft: 0, status: 'closed', assignee: '沈知微', createdAt: '2026-02-23 15:40', timeline: [{ time: '15:40', actor: '系统', action: '工单创建' }, { time: '17:55', actor: '沈知微', action: '核实为考试禁言群，已驳回恢复申请并关单' }] },
];

export const TOUCH_TEMPLATES: TouchTemplate[] = [
  { id: 'TP-101', channel: '模板消息', name: '提现到账通知', content: '您的提现 {金额} 已到账 {银行}（{尾号}），请注意查收。', freqLimit: '每用户每天 ≤ 5 条', sent: 182340, successRate: 99.4, blocked: 212, status: 'active' },
  { id: 'TP-102', channel: '短信', name: '风控冻结告知', content: '【微信支付】您的账户因 {原因} 被临时冻结，申诉请回复 TD 退订。', freqLimit: '每用户每天 ≤ 2 条', sent: 8842, successRate: 98.1, blocked: 34, status: 'active' },
  { id: 'TP-103', channel: '站内信', name: '内容违规处罚通知', content: '您发布的内容 {标题} 因 {违规项} 被{处罚}，申诉入口…', freqLimit: '不限（合规通知）', sent: 44210, successRate: 100, blocked: 0, status: 'active' },
  { id: 'TP-104', channel: 'Push', name: '营销活动推送', content: '开学季满100减20，今日开抢！', freqLimit: '每用户每周 ≤ 1 条', sent: 1204800, successRate: 96.8, blocked: 18240, status: 'paused' },
];

/* ==================== 扩展导航（与原 NAV_TREE 合并） ==================== */

export const EXT_NAV: NavItem[] = [
  {
    id: 'pay-extra', label: '资金清结算', en: 'Settlement', roles: ['super_admin', 'finance'] as Role[], icon: 'Wallet',
    children: [
      { id: 'settle', label: '分账 · 提现 · 差错', en: 'Settlement', roles: ['super_admin', 'finance'] as Role[], route: 'settlement' as RouteKey },
      { id: 'mkt', label: '营销与企业付款', en: 'Marketing', roles: ['super_admin', 'finance'] as Role[], route: 'marketing' as RouteKey },
    ],
  },
  {
    id: 'risk-extra', label: '风控大脑', en: 'Risk Brain', roles: ['super_admin', 'risk_ops'] as Role[], icon: 'ShieldAlert',
    children: [
      { id: 'lab', label: '规则编排实验室', en: 'Rule Lab', roles: ['super_admin', 'risk_ops'] as Role[], route: 'strategy-lab' as RouteKey, badge: 'NEW' },
      { id: 'cases', label: '欺诈风险工作台', en: 'Risk Cases', roles: ['super_admin', 'risk_ops'] as Role[], route: 'risk-events' as RouteKey, badge: '3' },
    ],
  },
  {
    id: 'social-deep', label: '社交深渊治理', en: 'Social Deep', roles: ['super_admin', 'moderator'] as Role[], icon: 'MessagesSquare',
    children: [
      { id: 'im', label: 'IM 聊天审计', en: 'IM Audit', roles: ['super_admin', 'moderator'] as Role[], route: 'im-audit' as RouteKey },
      { id: 'live', label: '直播监看墙', en: 'Live Wall', roles: ['super_admin', 'moderator'] as Role[], route: 'live-wall' as RouteKey, badge: '9' },
    ],
  },
  {
    id: 'open', label: '开放生态', en: 'Open Ecosystem', roles: ['super_admin'] as Role[], icon: 'Boxes',
    children: [
      { id: 'mini', label: '小程序提审', en: 'Mini Programs', roles: ['super_admin'] as Role[], route: 'open-mini' as RouteKey, badge: '2' },
      { id: 'mp', label: '公众号文章', en: 'MP Articles', roles: ['super_admin'] as Role[], route: 'open-mp' as RouteKey },
    ],
  },
  {
    id: 'service', label: '客服与触达', en: 'Service', roles: ['super_admin', 'finance', 'moderator'] as Role[], icon: 'Headphones',
    children: [
      { id: 'tk', label: '全局工单', en: 'Tickets', roles: ['super_admin', 'finance', 'moderator'] as Role[], route: 'tickets' as RouteKey, badge: '4' },
      { id: 'touch', label: '多渠道触达', en: 'Touch', roles: ['super_admin', 'finance', 'moderator'] as Role[], route: 'touch' as RouteKey },
    ],
  },
];

export const EXT_ROUTES: Record<Role, RouteKey[]> = {
  super_admin: ['settlement', 'marketing', 'strategy-lab', 'risk-events', 'im-audit', 'live-wall', 'open-mini', 'open-mp', 'tickets', 'touch'],
  finance: ['settlement', 'marketing', 'tickets', 'touch'],
  risk_ops: ['strategy-lab', 'risk-events'],
  moderator: ['im-audit', 'live-wall', 'tickets', 'touch'],
};

export const formatFen = (fen: number): string =>
  `¥${(fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatYi = (fen: number): string => `¥${(fen / 100 / 100000000).toFixed(2)} 亿`;
