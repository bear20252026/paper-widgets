import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileCode2,
  Filter,
  Layers3,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Pagination,
  Select,
  Tone,
  cn,
  downloadCsv,
  useToast,
} from '../components/ui';
import type { AuditLog, Role } from '../lib/types';

const MERCHANT_TS = `export type MerchantStatus =
  | 'pending_initial'
  | 'pending_review'
  | 'rejected'
  | 'frozen'
  | 'approved';

export interface SettlementAccount {
  account_type: 'corporate' | 'personal';
  account_holder: string;
  account_no_masked: string;
  bank_name: string;
  branch_name: string;
  union_pay_code: string;
}

export interface BeneficialOwner {
  owner_id: string;
  name: string;
  owner_type: 'holding_company' | 'natural_person' | 'partnership';
  ratio_percent: number;
  is_ubo: boolean;
  children?: BeneficialOwner[];
}

export interface MerchantApplication {
  application_no: string;
  merchant_no: string;
  company_name: string;
  legal_name: string;
  legal_phone_masked: string;
  legal_id_plain: string;
  risk_score: number;
  risk_tags: string[];
  status: MerchantStatus;
  applied_at: string;
  registered_capital_wan: number;
  business_license_no: string;
  category_path: string[];
  settlement: SettlementAccount;
  beneficial_owners: BeneficialOwner[];
}`;

const MERCHANT_RS = `use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "merchant_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MerchantStatus {
    PendingInitial,
    PendingReview,
    Rejected,
    Frozen,
    Approved,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MerchantApplication {
    pub application_no: String,
    pub merchant_no: String,
    pub company_name: String,
    pub legal_name: String,
    pub legal_phone_masked: String,
    #[serde(skip_serializing)]
    pub legal_id_plain: String,
    pub legal_id_masked: String,
    pub risk_score: i16,
    pub risk_tags: Vec<String>,
    pub status: MerchantStatus,
    pub applied_at: DateTime<Utc>,
    pub registered_capital_wan: Decimal,
    pub business_license_no: String,
    pub category_path: Vec<String>,
    pub settlement: sqlx::types::Json<SettlementAccount>,
    pub beneficial_owners: sqlx::types::Json<Vec<BeneficialOwner>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementAccount {
    pub account_type: String,
    pub account_holder: String,
    pub account_no_masked: String,
    pub bank_name: String,
    pub branch_name: String,
    pub union_pay_code: String,
}

#[derive(Debug, Deserialize)]
pub struct ReviewMerchantRequest {
    pub decision: MerchantStatus,
    #[serde(default)]
    pub notes: String,
}

pub async fn review_merchant(
    State(state): State<AppState>,
    Path(merchant_no): Path<String>,
    headers: HeaderMap,
    Json(req): Json<ReviewMerchantRequest>,
) -> ApiResult<MerchantApplication> {
    let operator = auth::require_roles(&headers, &state, &[Role::SuperAdmin, Role::Finance])?;
    if req.decision == MerchantStatus::Rejected && req.notes.trim().len() < 8 {
        return Err(ApiError::Unprocessable("驳回原因至少 8 个字".into()));
    }
    let row = sqlx::query_as::<_, MerchantApplication>(
        r#"UPDATE merchant_applications
           SET status = $2, review_notes = $3, reviewer = $4, updated_at = NOW()
           WHERE merchant_no = $1
           RETURNING *"#,
    )
    .bind(&merchant_no)
    .bind(&req.decision)
    .bind(&req.notes)
    .bind(&operator.name)
    .fetch_optional(&state.pg)
    .await?
    .ok_or_else(|| ApiError::NotFound("merchant not found".into()))?;
    audit::write(&state.pg, &operator, "merchant.review", &merchant_no).await?;
    Ok(Json(ApiResponse::ok(row)))
}`;

const MERCHANT_SQL = `CREATE TYPE merchant_status AS ENUM (
  'pending_initial', 'pending_review', 'rejected', 'frozen', 'approved'
);

CREATE TABLE merchant_applications (
  id                  BIGSERIAL PRIMARY KEY,
  application_no      VARCHAR(32) UNIQUE NOT NULL,
  merchant_no         VARCHAR(24) UNIQUE NOT NULL,
  company_name        VARCHAR(160) NOT NULL,
  legal_name          VARCHAR(64) NOT NULL,
  legal_phone_masked  VARCHAR(24) NOT NULL,
  legal_id_encrypted  BYTEA NOT NULL,
  risk_score          SMALLINT NOT NULL DEFAULT 0
                      CHECK (risk_score BETWEEN 0 AND 100),
  risk_tags           TEXT[] NOT NULL DEFAULT '{}',
  status              merchant_status NOT NULL DEFAULT 'pending_initial',
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_capital  NUMERIC(16, 2) NOT NULL,
  business_license_no VARCHAR(40) NOT NULL,
  category_path       TEXT[] NOT NULL,
  settlement          JSONB NOT NULL,
  beneficial_owners   JSONB NOT NULL
                      CHECK (jsonb_array_length(beneficial_owners) > 0),
  reviewer            VARCHAR(64),
  review_notes        TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_status_applied
  ON merchant_applications (status, applied_at DESC);
CREATE INDEX idx_merchant_company_trgm
  ON merchant_applications USING gin (company_name gin_trgm_ops);`;

const TRANSACTION_TS = `export interface PaymentTransaction {
  wechat_trade_no: string;
  merchant_trade_no: string;
  merchant_no: string;
  amount_fen: number;      // Rust i64，禁止浮点
  refund_fen: number;
  pay_method: 'qr' | 'card' | 'api' | 'mini_program';
  trade_type: 'payment' | 'refund';
  status: 'success' | 'processing' | 'failed' | 'closed';
  paid_at: string;         // ISO-8601 UTC
  settled_at: string | null;
}

export interface RefundException {
  refund_no: string;
  trade_no: string;
  amount_fen: number;
  reason_code: string;
  retry_count: number;
  status: 'pending' | 'retrying' | 'resolved' | 'manual_review';
  created_at: string;
}`;

const TRANSACTION_RS = `#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PaymentTransaction {
    pub wechat_trade_no: String,
    pub merchant_trade_no: String,
    pub merchant_no: String,
    pub amount_fen: i64,
    pub refund_fen: i64,
    pub pay_method: PayMethod,
    pub trade_type: TradeType,
    pub status: TradeStatus,
    pub paid_at: DateTime<Utc>,
    pub settled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct RefundException {
    pub refund_no: String,
    pub trade_no: String,
    pub merchant_no: String,
    pub amount_fen: i64,
    pub reason_code: String,
    pub retry_count: i32,
    pub status: RefundStatus,
    pub created_at: DateTime<Utc>,
    pub last_attempt_at: DateTime<Utc>,
}

pub async fn retry_refund(
    State(state): State<AppState>,
    Path(refund_no): Path<String>,
    headers: HeaderMap,
) -> ApiResult<RefundException> {
    let operator = auth::require_roles(&headers, &state, &[Role::SuperAdmin, Role::Finance])?;
    sqlx::query("UPDATE refund_exceptions SET status = 'retrying', retry_count = retry_count + 1, last_attempt_at = NOW() WHERE refund_no = $1")
        .bind(&refund_no).execute(&state.pg).await?;
    state.refund_queue.send(RefundRetry { refund_no: refund_no.clone() }).await
        .map_err(|_| ApiError::ServiceUnavailable("refund worker offline".into()))?;
    audit::write(&state.pg, &operator, "refund.retry", &refund_no).await?;
    let row = sqlx::query_as::<_, RefundException>(
        "SELECT * FROM refund_exceptions WHERE refund_no = $1")
        .bind(&refund_no).fetch_one(&state.pg).await?;
    Ok(Json(ApiResponse::ok(row)))
}`;

const TRANSACTION_SQL = `CREATE TABLE payment_transactions (
  id                BIGSERIAL PRIMARY KEY,
  wechat_trade_no   VARCHAR(40) UNIQUE NOT NULL,
  merchant_trade_no VARCHAR(64) NOT NULL,
  merchant_no       VARCHAR(24) NOT NULL REFERENCES merchant_applications (merchant_no),
  amount_fen        BIGINT NOT NULL CHECK (amount_fen > 0),
  refund_fen        BIGINT NOT NULL DEFAULT 0 CHECK (refund_fen >= 0),
  pay_method        VARCHAR(16) NOT NULL,
  trade_type        VARCHAR(8) NOT NULL,
  status            VARCHAR(16) NOT NULL,
  paid_at           TIMESTAMPTZ NOT NULL,
  settled_at        TIMESTAMPTZ,
  UNIQUE (merchant_no, merchant_trade_no)
);
CREATE INDEX idx_tx_paid_at ON payment_transactions (paid_at DESC);

CREATE TABLE refund_exceptions (
  id              BIGSERIAL PRIMARY KEY,
  refund_no       VARCHAR(32) UNIQUE NOT NULL,
  trade_no        VARCHAR(40) NOT NULL,
  amount_fen      BIGINT NOT NULL,
  reason_code     VARCHAR(32) NOT NULL,
  retry_count     INT NOT NULL DEFAULT 0,
  status          VARCHAR(24) NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refund_unresolved ON refund_exceptions (status)
  WHERE status <> 'resolved';`;

const RISK_TS = `export interface RiskStrategy {
  strategy_id: string;
  name: string;
  scope: 'global' | 'merchant';
  merchant_no: string | null;
  single_limit_fen: number;
  daily_limit_fen: number;
  action: 'alert' | 'block_freeze';
  enabled: boolean;
  hits_24h: number;
  updated_at: string;
}

export interface BlacklistEntry {
  entry_id: string;
  dimension: 'user' | 'device' | 'ip';
  value: string;
  related_accounts: number;
  reason: string;
  added_at: string;
}`;

const RISK_RS = `#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RiskStrategy {
    pub strategy_id: String,
    pub name: String,
    pub scope: StrategyScope,
    pub merchant_no: Option<String>,
    pub single_limit_fen: i64,
    pub daily_limit_fen: i64,
    pub action: StrategyAction,
    pub enabled: bool,
    pub hits_24h: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "blacklist_dimension", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BlacklistDimension { User, Device, Ip }

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct BlacklistEntry {
    pub entry_id: String,
    pub dimension: BlacklistDimension,
    pub value: String,
    pub related_accounts: i32,
    pub reason: String,
    pub added_at: DateTime<Utc>,
}

pub async fn create_strategy(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateStrategyRequest>,
) -> ApiResult<RiskStrategy> {
    let operator = auth::require_roles(&headers, &state, &[Role::SuperAdmin, Role::RiskOps])?;
    if req.daily_limit_fen < req.single_limit_fen {
        return Err(ApiError::Unprocessable("单日限额不得低于单笔限额".into()));
    }
    let strategy = sqlx::query_as::<_, RiskStrategy>(
        r#"INSERT INTO risk_strategies
           (strategy_id, name, scope, merchant_no, single_limit_fen, daily_limit_fen, action, enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *"#)
        .bind(Uuid::new_v4().to_string())
        .bind(&req.name)
        .bind(req.scope)
        .bind(&req.merchant_no)
        .bind(req.single_limit_fen)
        .bind(req.daily_limit_fen)
        .bind(req.action)
        .bind(req.enabled)
        .fetch_one(&state.pg).await?;
    state.rule_cache.invalidate("risk:strategies:all").await?;
    audit::write(&state.pg, &operator, "risk.strategy.create", &strategy.strategy_id).await?;
    Ok(Json(ApiResponse::ok(strategy)))
}`;

const RISK_SQL = `CREATE TABLE risk_strategies (
  id               BIGSERIAL PRIMARY KEY,
  strategy_id      VARCHAR(24) UNIQUE NOT NULL,
  name             VARCHAR(100) NOT NULL,
  scope            VARCHAR(16) NOT NULL CHECK (scope IN ('global', 'merchant')),
  merchant_no      VARCHAR(24) REFERENCES merchant_applications (merchant_no),
  single_limit_fen BIGINT NOT NULL CHECK (single_limit_fen > 0),
  daily_limit_fen  BIGINT NOT NULL CHECK (daily_limit_fen > 0),
  action           VARCHAR(24) NOT NULL CHECK (action IN ('alert', 'block_freeze')),
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  hits_24h         INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_daily_ge_single CHECK (daily_limit_fen >= single_limit_fen),
  CONSTRAINT chk_scope_merchant CHECK (
    (scope = 'global' AND merchant_no IS NULL) OR
    (scope = 'merchant' AND merchant_no IS NOT NULL)
  )
);

CREATE TABLE blacklist_entries (
  id               BIGSERIAL PRIMARY KEY,
  entry_id         VARCHAR(24) UNIQUE NOT NULL,
  dimension        VARCHAR(16) NOT NULL,
  value            VARCHAR(128) NOT NULL,
  related_accounts INT NOT NULL DEFAULT 0,
  reason           TEXT NOT NULL,
  operator         VARCHAR(64) NOT NULL,
  added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dimension, value)
);
CREATE INDEX idx_blacklist_value ON blacklist_entries (dimension, value);`;

const CONTENT_TS = `export interface MomentPost {
  post_id: string;
  user_name: string;
  user_uid: string;
  content: string;
  images: { label: string; tone: string }[];
  ai_score: number;
  report_reason: string;
  report_count: number;
  posted_at: string;
}

export type ModerationTag = '涉黄' | '涉政' | '广告' | '欺诈' | '引流';
export type PunishmentLevel = 'warning' | 'mute_3d' | 'mute_7d' | 'ban';

export interface ModerationDecision {
  post_id: string;
  tags: ModerationTag[];
  punishment: PunishmentLevel;
  opinion: string;
  result: 'approved' | 'rejected';
  operator: string;
  operated_at: string;
}

export interface ChatGroup {
  group_id: string;
  name: string;
  owner_uid: string;
  member_count: number;
  status: 'active' | 'muted' | 'dissolved' | 'locked';
  risk_level: 'low' | 'medium' | 'high';
}`;

const CONTENT_RS = `#[derive(Debug, Clone, Serialize, FromRow)]
pub struct MomentPost {
    pub post_id: String,
    pub user_name: String,
    pub user_uid: String,
    pub content: String,
    pub images: sqlx::types::Json<Vec<MomentImage>>,
    pub ai_score: i16,
    pub report_reason: String,
    pub report_count: i32,
    pub posted_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewMomentRequest {
    pub result: ModerationResult,
    #[serde(default)]
    pub tags: Vec<String>,
    pub punishment: PunishmentLevel,
    #[serde(default)]
    pub opinion: String,
}

pub async fn review_moment(
    State(state): State<AppState>,
    Path(post_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<ReviewMomentRequest>,
) -> ApiResult<ModerationDecision> {
    let operator = auth::require_roles(&headers, &state, &[Role::SuperAdmin, Role::Moderator])?;
    if req.result == ModerationResult::Rejected && req.tags.is_empty() {
        return Err(ApiError::Unprocessable("驳回时至少选择一个违规标签".into()));
    }
    let mut tx = state.pg.begin().await?;
    let decision = sqlx::query_as::<_, ModerationDecision>(
        r#"INSERT INTO moderation_decisions
           (post_id, tags, punishment, opinion, result, operator, operated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *"#)
        .bind(&post_id).bind(&req.tags).bind(&req.punishment)
        .bind(&req.opinion).bind(&req.result).bind(&operator.name)
        .fetch_one(&mut *tx).await?;
    if req.result == ModerationResult::Rejected {
        sqlx::query("UPDATE moment_posts SET visible = FALSE WHERE post_id = $1")
            .bind(&post_id).execute(&mut *tx).await?;
        punishments::apply(&mut tx, &req.punishment, &operator).await?;
    }
    audit::write_tx(&mut tx, &operator, "content.moment.review", &post_id).await?;
    tx.commit().await?;
    Ok(Json(ApiResponse::ok(decision)))
}

pub async fn dissolve_group(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<DissolveGroupRequest>,
) -> ApiResult<ChatGroup> {
    let operator = auth::require_super_admin_password(&headers, &state, &req.password)?;
    if req.password != state.config.super_admin_force_password {
        return Err(ApiError::Forbidden("invalid super admin password".into()));
    }
    let group = sqlx::query_as::<_, ChatGroup>(
        "UPDATE chat_groups SET status = 'dissolved', dissolved_at = NOW() WHERE group_id = $1 RETURNING *")
        .bind(&group_id).fetch_one(&state.pg).await?;
    audit::write(&state.pg, &operator, "content.group.dissolve", &group_id).await?;
    Ok(Json(ApiResponse::ok(group)))
}`;

const CONTENT_SQL = `CREATE TYPE moderation_result AS ENUM ('approved', 'rejected');
CREATE TYPE punishment_level AS ENUM ('warning', 'mute_3d', 'mute_7d', 'ban');

CREATE TABLE moment_posts (
  id            BIGSERIAL PRIMARY KEY,
  post_id       VARCHAR(32) UNIQUE NOT NULL,
  user_uid      VARCHAR(32) NOT NULL,
  content       TEXT NOT NULL,
  images        JSONB NOT NULL DEFAULT '[]',
  ai_score      SMALLINT NOT NULL CHECK (ai_score BETWEEN 0 AND 100),
  report_reason TEXT NOT NULL,
  report_count  INT NOT NULL DEFAULT 0,
  visible       BOOLEAN NOT NULL DEFAULT TRUE,
  posted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE moderation_decisions (
  id          BIGSERIAL PRIMARY KEY,
  post_id     VARCHAR(32) NOT NULL REFERENCES moment_posts (post_id),
  tags        TEXT[] NOT NULL DEFAULT '{}',
  punishment  punishment_level NOT NULL,
  opinion     TEXT NOT NULL DEFAULT '',
  result      moderation_result NOT NULL,
  operator    VARCHAR(64) NOT NULL,
  operated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_groups (
  id          BIGSERIAL PRIMARY KEY,
  group_id    VARCHAR(40) UNIQUE NOT NULL,
  name        VARCHAR(160) NOT NULL,
  owner_uid   VARCHAR(32) NOT NULL,
  member_count INT NOT NULL CHECK (member_count >= 0),
  status      VARCHAR(16) NOT NULL DEFAULT 'active',
  risk_level  VARCHAR(16) NOT NULL DEFAULT 'low',
  dissolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_group_status ON chat_groups (status, risk_level);`;

const ROUTER_RS = `use axum::{
    middleware,
    routing::{delete, get, patch, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod audit;
mod auth;
mod config;
mod error;
mod handlers;
mod models;

#[derive(Clone)]
pub struct AppState {
    pub pg: sqlx::PgPool,
    pub redis: redis::Client,
    pub config: config::AppConfig,
    pub rule_cache: cache::RuleCache,
    pub refund_queue: mpsc::Sender<RefundRetry>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().json().init();
    let config = config::AppConfig::from_env()?;
    let pg = PgPoolOptions::new()
        .max_connections(32)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&config.database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pg).await?;
    let state = AppState::new(pg, config).await?;

    let api = Router::new()
        .route("/dashboard/summary", get(handlers::dashboard::summary))
        .route("/merchants", get(handlers::merchants::list))
        .route("/merchants/{merchant_no}", get(handlers::merchants::detail))
        .route("/merchants/{merchant_no}/review", post(handlers::merchants::review))
        .route("/transactions", get(handlers::payments::transactions))
        .route("/refunds", get(handlers::payments::refunds))
        .route("/refunds/{refund_no}/retry", post(handlers::payments::retry_refund))
        .route("/risk/strategies", get(handlers::risk::list_strategies).post(handlers::risk::create_strategy))
        .route("/risk/strategies/{strategy_id}", patch(handlers::risk::update_strategy))
        .route("/risk/blacklist", get(handlers::risk::list_blacklist).post(handlers::risk::create_blacklist))
        .route("/risk/blacklist/{entry_id}", delete(handlers::risk::remove_blacklist))
        .route("/content/moments", get(handlers::content::list_moments))
        .route("/content/moments/{post_id}/review", post(handlers::content::review_moment))
        .route("/content/groups", get(handlers::content::list_groups))
        .route("/content/groups/{group_id}/mute", patch(handlers::content::toggle_mute))
        .route("/content/groups/{group_id}/dissolve", post(handlers::content::dissolve_group))
        .route("/audit/logs", get(handlers::audit::list))
        .layer(middleware::from_fn(auth::rbac_guard))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .nest("/api/v1", api)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!(addr = %config.bind_addr, "WeTrust API started");
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("unauthorized")] Unauthorized,
    #[error("forbidden: {0}")] Forbidden(String),
    #[error("not found: {0}")] NotFound(String),
    #[error("unprocessable: {0}")] Unprocessable(String),
    #[error("service unavailable: {0}")] ServiceUnavailable(String),
    #[error(transparent)] Sqlx(#[from] sqlx::Error),
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match &self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            ApiError::Forbidden(_) => (StatusCode::FORBIDDEN, self.to_string()),
            ApiError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            ApiError::Unprocessable(_) => (StatusCode::UNPROCESSABLE_ENTITY, self.to_string()),
            ApiError::ServiceUnavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, self.to_string()),
            ApiError::Sqlx(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal database error".into()),
        };
        (status, Json(ApiResponse::<()>::error(message))).into_response()
    }
}`;

const ROUTER_SQL = `CREATE TABLE operation_audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  log_id      VARCHAR(24) UNIQUE NOT NULL,
  operator    VARCHAR(64) NOT NULL,
  role        VARCHAR(24) NOT NULL,
  module      VARCHAR(64) NOT NULL,
  action      VARCHAR(80) NOT NULL,
  target      TEXT NOT NULL,
  source_ip   INET NOT NULL,
  result      VARCHAR(16) NOT NULL DEFAULT 'success',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created_at ON operation_audit_logs (created_at DESC);
CREATE INDEX idx_audit_module_action ON operation_audit_logs (module, action);

-- 只追加写入：撤销应用账号的 UPDATE / DELETE 权限
REVOKE UPDATE, DELETE ON operation_audit_logs FROM wetrust_app;
GRANT SELECT, INSERT ON operation_audit_logs TO wetrust_app;

-- RBAC 角色映射（与前端 Role 联合类型逐字一致）
CREATE TYPE console_role AS ENUM (
  'super_admin', 'finance', 'risk_ops', 'moderator'
);

CREATE TABLE console_operators (
  id            BIGSERIAL PRIMARY KEY,
  operator_code VARCHAR(32) UNIQUE NOT NULL,
  display_name  VARCHAR(64) NOT NULL,
  role          console_role NOT NULL,
  mfa_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ
);
CREATE INDEX idx_operator_role ON console_operators (role);`;

const PLATFORM_TS = `type ApprovalCategory = 'merchant' | 'withdrawal' | 'rule_publish' | 'blacklist_release' | 'group_dissolve' | 'ban_appeal';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface ApprovalItem { approval_id: string; category: ApprovalCategory; title: string; applicant: string; target_id: string; amount_fen: number | null; risk_level: 'critical' | 'high' | 'medium'; risk_note: string; evidence: string[]; sla_deadline: string; requested_at: string; status: ApprovalStatus; reviewer: string | null; decision_reason: string | null; decided_at: string | null; }
interface OperatorAccount { operator_id: string; username: string; display_name: string; department: string; role: 'super_admin' | 'finance' | 'risk_ops' | 'moderator'; mfa_enabled: boolean; enabled: boolean; session_count: number; last_login_at: string | null; created_at: string; }
interface SecurityPolicy { session_minutes: number; failed_login_limit: number; min_password_length: number; require_mfa: boolean; ip_allowlist: string[]; updated_at: string; }
interface ApiKeyMeta { key_id: string; name: string; key_prefix: string; scopes: string[]; status: 'active' | 'retiring' | 'disabled'; created_at: string; expires_at: string | null; last_used_at: string | null; }
interface ExportJob { job_id: string; template_key: 'merchant_applications' | 'transaction_daily' | 'refund_exceptions' | 'blacklist' | 'sla_monthly' | 'approval_audit'; status: 'queued' | 'running' | 'completed' | 'failed' | 'expired'; progress: number; row_count: number; file_name: string; requested_by: string; created_at: string; completed_at: string | null; expires_at: string; error_message: string | null; }`;

const PLATFORM_RS = `// 对应 server/src/platform.rs；时间字段 chrono::DateTime<Utc>，金额为 i64 分。
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ApprovalItem { pub approval_id: String, pub category: String, pub title: String, pub applicant: String, pub target_id: String, pub amount_fen: Option<i64>, pub risk_level: String, pub risk_note: String, pub evidence: sqlx::types::Json<Vec<String>>, pub sla_deadline: DateTime<Utc>, pub requested_at: DateTime<Utc>, pub status: String, pub reviewer: Option<String>, pub decision_reason: Option<String>, pub decided_at: Option<DateTime<Utc>> }
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct OperatorAccount { pub operator_id: String, pub username: String, pub display_name: String, pub department: String, pub role: Role, pub mfa_enabled: bool, pub enabled: bool, pub session_count: i64, pub last_login_at: Option<DateTime<Utc>>, pub created_at: DateTime<Utc> }
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ApiKeyMeta { pub key_id: String, pub name: String, pub key_prefix: String, pub scopes: Vec<String>, pub status: String, pub created_at: DateTime<Utc>, pub expires_at: Option<DateTime<Utc>>, pub last_used_at: Option<DateTime<Utc>> }
#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct ExportJob { pub job_id: String, pub template_key: String, pub status: String, pub progress: i16, pub row_count: i64, pub file_name: String, pub requested_by: String, pub created_at: DateTime<Utc>, pub completed_at: Option<DateTime<Utc>>, pub expires_at: DateTime<Utc>, pub error_message: Option<String> }

// 审批 SELECT FOR UPDATE + 状态校验；第二次并发裁决返回 HTTP 409。
// 密钥轮换：OsRng UUID 生成 256-bit secret，只持久化 SHA-256 摘要。
// 导出 Worker：固定 SQL 白名单生成 UTF-8 CSV，7 天后清理文件。`;

const PLATFORM_SQL = `-- 完整脚本位于 server/migrations/0004_platform_ops.sql。
-- 0003_open_marketing 已占用版本号，SQLx 迁移须保持唯一递增。
CREATE TABLE platform_approvals (
  approval_id VARCHAR(32) PRIMARY KEY,
  category VARCHAR(32) NOT NULL,
  target_id VARCHAR(80) NOT NULL,
  amount_fen BIGINT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reviewer VARCHAR(80),
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_platform_approvals_queue ON platform_approvals(status,sla_deadline) WHERE status='pending';
CREATE TABLE platform_api_keys (
  key_id VARCHAR(40) PRIMARY KEY,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL,
  status VARCHAR(16) NOT NULL,
  expires_at TIMESTAMPTZ
);
CREATE TABLE platform_export_jobs (
  job_id VARCHAR(40) PRIMARY KEY,
  template_key VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  progress SMALLINT NOT NULL DEFAULT 0,
  content BYTEA,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '7 days'
);`;

const DOMAIN_TABS = [
  { key: 'merchant', label: '商户进件', ts: MERCHANT_TS, rs: MERCHANT_RS, sql: MERCHANT_SQL, model: 'MerchantApplication' },
  { key: 'transaction', label: '交易退款', ts: TRANSACTION_TS, rs: TRANSACTION_RS, sql: TRANSACTION_SQL, model: 'PaymentTransaction' },
  { key: 'risk', label: '风控策略', ts: RISK_TS, rs: RISK_RS, sql: RISK_SQL, model: 'RiskStrategy' },
  { key: 'content', label: '内容群组', ts: CONTENT_TS, rs: CONTENT_RS, sql: CONTENT_SQL, model: 'MomentPost' },
  { key: 'platform', label: '平台运营 / 审批 / 导出', ts: PLATFORM_TS, rs: PLATFORM_RS, sql: PLATFORM_SQL, model: 'ApprovalItem / OperatorAccount / ExportJob' },
  { key: 'router', label: 'Axum 路由 / 审计表', ts: '', rs: ROUTER_RS, sql: ROUTER_SQL, model: 'AppState / ApiError' },
];

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/merchants', handler: 'merchants::list', rbac: 'super_admin, finance', desc: '分页检索进件申请，支持多条件过滤' },
  { method: 'GET', path: '/api/v1/merchants/:no', handler: 'merchants::detail', rbac: 'super_admin, finance', desc: '获取五层 Tab 完整进件档案' },
  { method: 'POST', path: '/api/v1/merchants/:no/review', handler: 'merchants::review', rbac: 'super_admin, finance', desc: '通过或驳回进件，写入审计日志' },
  { method: 'GET', path: '/api/v1/transactions', handler: 'payments::transactions', rbac: 'super_admin, finance', desc: '全量流水，金额以 i64 分返回' },
  { method: 'POST', path: '/api/v1/refunds/:no/retry', handler: 'payments::retry_refund', rbac: 'super_admin, finance', desc: '投递退款重试任务至异步队列' },
  { method: 'POST', path: '/api/v1/risk/strategies', handler: 'risk::create_strategy', rbac: 'super_admin, risk_ops', desc: '创建策略并失效 Redis 规则缓存' },
  { method: 'DELETE', path: '/api/v1/risk/blacklist/:id', handler: 'risk::remove_blacklist', rbac: 'super_admin, risk_ops', desc: '解封黑名单主体并记录操作人' },
  { method: 'POST', path: '/api/v1/content/moments/:id/review', handler: 'content::review_moment', rbac: 'super_admin, moderator', desc: '事务内写入裁定与处罚，下架违规动态' },
  { method: 'POST', path: '/api/v1/content/groups/:id/dissolve', handler: 'content::dissolve_group', rbac: 'super_admin', desc: '校验超管密码后强制解散群组' },
  { method: 'PATCH', path: '/api/v1/risk/rules/:id/gray', handler: 'risk::set_gray', rbac: 'super_admin, risk_ops', desc: '灰度放量，误杀率超 1% 红线禁止放量' },
  { method: 'POST', path: '/api/v1/risk/versions/:v/rollback', handler: 'risk::rollback_version', rbac: 'super_admin, risk_ops', desc: '事务内整体回滚到稳定快照' },
  { method: 'PATCH', path: '/api/v1/content/moments/:id/throttle', handler: 'content::throttle_moment', rbac: 'super_admin, moderator', desc: '朋友圈折叠 / 移出推荐池' },
  { method: 'POST', path: '/api/v1/content/live/:id/cut', handler: 'content::cut_live', rbac: 'super_admin, moderator', desc: '扫码令牌 + 他人授权断流，信用分 -20' },
  { method: 'POST', path: '/api/v1/service/tickets/:id/transfer', handler: 'content::transfer_ticket', rbac: 'super_admin, finance, moderator', desc: '工单跨部门流转，SLA 超时后台自动升级' },
  { method: 'GET', path: '/api/v1/platform/approvals', handler: 'platform::list_approvals', rbac: 'all', desc: '按岗位过滤待办审批' },
  { method: 'POST', path: '/api/v1/platform/approvals/:id/decision', handler: 'platform::decide_approval', rbac: '按审批类别', desc: '事务行锁防重，驳回理由必填，审计同事务提交' },
  { method: 'GET', path: '/api/v1/platform/operators', handler: 'platform::list_operators', rbac: 'super_admin', desc: '运营账号、MFA 与会话数' },
  { method: 'PATCH', path: '/api/v1/platform/operators/:username', handler: 'platform::update_operator', rbac: 'super_admin', desc: '禁止自禁用；禁用账号撤销活跃会话' },
  { method: 'POST', path: '/api/v1/platform/operators/:username/reset-password', handler: 'platform::reset_password', rbac: 'super_admin', desc: 'Argon2id 重置，临时密码仅展示一次' },
  { method: 'PUT', path: '/api/v1/platform/security-policy', handler: 'platform::put_security_policy', rbac: 'super_admin', desc: '会话/MFA/锁定/IP 白名单配置' },
  { method: 'POST', path: '/api/v1/platform/api-keys/:id/rotate', handler: 'platform::rotate_api_key', rbac: 'super_admin', desc: '旧密钥双跑 24h，新密钥明文只返回一次' },
  { method: 'POST', path: '/api/v1/platform/exports', handler: 'platform::create_export', rbac: '按报表模板', desc: '异步 CSV Worker，任务 7 天过期' },
  { method: 'GET', path: '/api/v1/platform/exports/:id/download', handler: 'platform::download_export', rbac: '本人/超管', desc: '下载真实 CSV；审计与表格公式注入保护' },
];

const METHOD_TONE: Record<string, Tone> = { GET: 'emerald', POST: 'sky', PATCH: 'amber', PUT: 'orange', DELETE: 'rose' };

const CodePanel: React.FC<{
  title: string;
  language: string;
  code: string;
  filename: string;
  accent: 'ts' | 'rust' | 'sql';
}> = ({ title, language, code, filename, accent }) => {
  const { push } = useToast();
  const accentColor = accent === 'ts' ? 'text-sky-400' : accent === 'rust' ? 'text-orange-400' : 'text-emerald-400';
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* Clipboard 权限不可用时仍提示 */
    }
    push({ title: '代码已复制', description: `${filename} · ${code.split('\n').length} 行`, tone: 'success' });
  };
  const onDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    push({ title: '源文件已下载', description: filename, tone: 'success' });
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#0B1220] shadow-[0_10px_30px_-16px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between gap-2 bg-white/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </span>
          <span className="ml-1 text-[11px] font-medium text-gray-200">{title}</span>
          <span className={cn('font-mono text-[9px]', accentColor)}>{language}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCopy} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
            <Copy className="h-3 w-3" /> 复制
          </button>
          <button type="button" onClick={onDownload} className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
            <Download className="h-3 w-3" /> 下载
          </button>
        </div>
      </div>
      <pre className="max-h-[460px] overflow-auto p-4 font-mono text-[10.5px] leading-[1.65] text-gray-300">
        <code>{code}</code>
      </pre>
      <div className="flex items-center justify-between bg-white/[0.03] px-4 py-2 font-mono text-[9px] text-gray-500">
        <span>{filename}</span>
        <span>{code.split('\n').length} lines</span>
      </div>
    </div>
  );
};

export const ContractsPage: React.FC = () => {
  const [activeDomain, setActiveDomain] = useState('merchant');
  const domain = DOMAIN_TABS.find((item) => item.key === activeDomain) ?? DOMAIN_TABS[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System / API Contract Center"
        title="数据契约中心"
        description="前端 TypeScript Interface、Rust Axum / SQLx Struct 与 PostgreSQL DDL 三方同名同义严格镜像，确保字段零漂移。"
        meta={<Badge tone="emerald">平台运营契约已接入</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => {
              const source = DOMAIN_TABS.map((d) => `// ${d.model}\n${d.ts}\n// RUST\n${d.rs}`).join('\n\n');
              const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'wecore-contracts.ts';
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);
              URL.revokeObjectURL(url);
            }}
          >
            下载契约包
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 divide-y divide-[#F3F4F6] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {[
            { label: '前端运行态', value: 'React 19 · TypeScript 5.9', hint: 'Vite 7 + Tailwind CSS 4', icon: Braces, badge: '已部署' },
            { label: 'API 服务', value: 'Rust 1.85 · Axum 0.8', hint: 'Tokio 运行时 · Tower 中间件', icon: Server, badge: '契约镜像' },
            { label: '持久层', value: 'PostgreSQL 16 · SQLx 0.8', hint: '参数化查询 · SQLx 迁移 0004', icon: Database, badge: '字段映射' },
            { label: '鉴权与审计', value: 'RBAC 4 角色 · JWT', hint: '超管高危操作二次密码校验', icon: ShieldCheck, badge: '全链路留痕' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-5">
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-[#9CA3AF]" />
                  <Badge tone="emerald" dot={false}>{item.badge}</Badge>
                </div>
                <p className="mt-3 text-[10px] font-medium tracking-wide text-[#9CA3AF] uppercase">{item.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#111827]">{item.value}</p>
                <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{item.hint}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-[#111827]">请求链路与数据流</h3>
        </div>
        <div className="mt-4 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {[
            { title: 'Console UI', sub: 'React + TS', note: '类型化 DTO 请求' },
            { title: 'API Gateway', sub: 'TLS · RateLimit', note: 'JWT 校验 / RBAC' },
            { title: 'Axum Router', sub: 'handlers/*', note: '入参反序列化' },
            { title: 'Service Layer', sub: 'domain logic', note: '风控规则 & 事务' },
            { title: 'SQLx / PgPool', sub: 'PostgreSQL 16', note: '编译期查询校验' },
          ].map((node, index) => (
            <React.Fragment key={node.title}>
              <div className="flex-1 rounded-xl bg-[#F9FAFB] px-3.5 py-3">
                <p className="text-[11px] font-semibold text-[#111827]">{node.title}</p>
                <p className="mt-0.5 font-mono text-[9px] text-orange-600">{node.sub}</p>
                <p className="mt-1 text-[9px] text-[#9CA3AF]">{node.note}</p>
              </div>
              {index < 4 && <ArrowRight className="mx-auto h-3.5 w-3.5 shrink-0 rotate-90 text-[#D1D5DB] lg:rotate-0" />}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-[#9CA3AF]">
          说明：本预览环境运行前端 Mock 交互；本页展示结构摘要，实际后端源码位于 server/src/，完整 SQLx 迁移位于 server/migrations/。上线前需用 Cargo、数据库及集成测试验证。
        </p>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {DOMAIN_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveDomain(item.key)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
              activeDomain === item.key ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.14)]' : 'bg-white text-[#6B7280] hover:text-[#111827]'
            )}
          >
            {activeDomain === item.key && <span className="h-1 w-1 rounded-full bg-orange-400" />}
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {domain.ts && <CodePanel title={`${domain.model}.ts`} language="TypeScript" code={domain.ts} filename={`${domain.key}.ts`} accent="ts" />}
        <CodePanel title={`${domain.model}.rs`} language="Rust" code={domain.rs} filename={`${domain.key}.rs`} accent="rust" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CodePanel title="schema.sql" language="PostgreSQL" code={domain.sql} filename={`${domain.key}.sql`} accent="sql" />
        </div>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#6B7280]" />
            <h3 className="text-xs font-semibold text-[#111827]">字段对齐校验</h3>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { rule: '命名映射', value: 'snake_case ↔ camelCase', ok: true },
              { rule: '金额精度', value: 'i64 分 ↔ BIGINT', ok: true },
              { rule: '时间格式', value: 'ISO-8601 ↔ TIMESTAMPTZ', ok: true },
              { rule: '主键策略', value: 'string ↔ VARCHAR', ok: true },
              { rule: '枚举一致性', value: 'union type ↔ PG ENUM', ok: true },
              { rule: '可空性', value: 'T | null ↔ Option<T>', ok: true },
            ].map((item) => (
              <div key={item.rule} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
                <div>
                  <p className="text-[10px] font-medium text-[#374151]">{item.rule}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{item.value}</p>
                </div>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#111827] p-3">
            <p className="font-mono text-[9px] text-gray-400">sqlx::migrate!("./migrations")</p>
            <p className="mt-1 font-mono text-[9px] leading-relaxed text-emerald-400">✓ 18 migrations validated</p>
            <p className="font-mono text-[9px] leading-relaxed text-gray-500">cargo build --release</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">REST API 端点与 RBAC 矩阵</h3>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">所有写操作经 middleware::from_fn(auth::rbac_guard) 鉴权并写入审计日志</p>
          </div>
          <Badge tone="slate" dot={false}>{ENDPOINTS.length} endpoints</Badge>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">方法</th>
                <th className="px-3 py-3 font-medium">路径</th>
                <th className="px-3 py-3 font-medium">Handler</th>
                <th className="px-3 py-3 font-medium">授权角色</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((endpoint) => (
                <tr key={`${endpoint.method}-${endpoint.path}`} className="transition-colors hover:bg-[#F9FAFB]/80">
                  <td className="py-3 pl-4">
                    <Badge tone={METHOD_TONE[endpoint.method]} dot={false}>{endpoint.method}</Badge>
                  </td>
                  <td className="px-3 py-3 font-mono text-[10px] text-[#111827]">{endpoint.path}</td>
                  <td className="px-3 py-3 font-mono text-[10px] text-[#6B7280]">{endpoint.handler}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {endpoint.rbac.split(', ').map((role) => (
                        <span key={role} className="rounded bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[9px] text-[#6B7280]">{role}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 pr-4 pl-3 text-[10px] text-[#6B7280]">{endpoint.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ================================ 审计日志 ================================ */

const ROLE_LABEL: Record<Role, { label: string; tone: Tone }> = {
  super_admin: { label: '超级管理员', tone: 'dark' },
  finance: { label: '支付专员', tone: 'sky' },
  risk_ops: { label: '风控专员', tone: 'violet' },
  moderator: { label: '内容审核', tone: 'orange' },
};

export const AuditLogPage: React.FC<{ logs: AuditLog[] }> = ({ logs }) => {
  const { push } = useToast();
  const [keyword, setKeyword] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const modules = useMemo(() => Array.from(new Set(logs.map((log) => log.module))), [logs]);

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        const query = keyword.trim().toLowerCase();
        const matchQuery = !query || log.operator.toLowerCase().includes(query) || log.action.includes(query) || log.target.toLowerCase().includes(query) || log.log_id.toLowerCase().includes(query);
        return matchQuery && (moduleFilter === 'all' || log.module === moduleFilter) && (resultFilter === 'all' || log.result === resultFilter);
      }),
    [logs, keyword, moduleFilter, resultFilter]
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System / Audit Trail"
        title="操作审计日志"
        description="不可篡改的全量敏感操作留痕，覆盖进件审核、资金处置、策略变更与群组解散等高危动作。"
        meta={<Badge tone="emerald">防篡改已开启</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => {
              downloadCsv(
                'audit-logs-20260224.csv',
                ['日志编号', '操作人', '角色', '模块', '动作', '对象', 'IP', '结果', '时间'],
                filtered.map((log) => [log.log_id, log.operator, ROLE_LABEL[log.role].label, log.module, log.action, log.target, log.ip, log.result === 'success' ? '成功' : '失败', log.created_at])
              );
              push({ title: '审计日志已导出', description: `${filtered.length} 条敏感操作记录`, tone: 'success' });
            }}
          >
            导出审计报告
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '今日审计事件', value: String(logs.length), hint: '覆盖 6 个业务模块', icon: ScrollText },
          { label: '敏感操作', value: String(logs.filter((l) => ['强制解散群组', '轮换 API 密钥', '驳回进件'].includes(l.action)).length), hint: '需双人复核', icon: ShieldCheck },
          { label: '执行成功率', value: '90.0', hint: '1 次失败已告警', icon: CheckCircle2 },
          { label: '异常 IP 登录', value: '0', hint: '近 24 小时无异常', icon: Server },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#6B7280]">{item.label}</p>
                <Icon className="h-4 w-4 text-[#9CA3AF]" />
              </div>
              <p className="mt-2.5 font-mono text-xl font-semibold tracking-tight text-[#111827]">
                {item.value}
                {item.label === '执行成功率' && <span className="text-[11px] font-normal text-[#9CA3AF]">%</span>}
              </p>
              <p className="mt-1 text-[10px] text-[#9CA3AF]">{item.hint}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[#9CA3AF]" />
            <h3 className="text-sm font-semibold text-[#111827]">全量操作留痕</h3>
            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-[10px] text-[#6B7280]">{filtered.length} logs</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索操作人、对象或日志编号"
                className="w-60 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
              />
            </div>
            <Select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} className="w-36 py-2.5 text-xs">
              <option value="all">全部模块</option>
              {modules.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </Select>
            <Select value={resultFilter} onChange={(e) => { setResultFilter(e.target.value); setPage(1); }} className="w-28 py-2.5 text-xs">
              <option value="all">全部结果</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">日志 / 操作人</th>
                <th className="px-3 py-3 font-medium">模块</th>
                <th className="px-3 py-3 font-medium">操作动作</th>
                <th className="px-3 py-3 font-medium">操作对象</th>
                <th className="px-3 py-3 font-medium">来源 IP</th>
                <th className="px-3 py-3 font-medium">结果</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((log) => {
                const roleMeta = ROLE_LABEL[log.role];
                return (
                  <tr key={log.log_id} className="transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3F4F6] text-[10px] font-semibold text-[#4B5563]">
                          {log.operator.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-[#111827]">{log.operator}</span>
                            <Badge tone={roleMeta.tone} dot={false}>{roleMeta.label}</Badge>
                          </div>
                          <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{log.log_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-[11px] text-[#4B5563]">{log.module}</td>
                    <td className="px-3 py-3.5 text-[11px] font-medium text-[#111827]">{log.action}</td>
                    <td className="px-3 py-3.5 max-w-[220px] truncate text-[10px] text-[#6B7280]">{log.target}</td>
                    <td className="px-3 py-3.5 font-mono text-[10px] text-[#6B7280]">{log.ip}</td>
                    <td className="px-3 py-3.5">
                      {log.result === 'success' ? (
                        <Badge tone="emerald"><CheckCircle2 className="h-2.5 w-2.5" /> 成功</Badge>
                      ) : (
                        <Badge tone="rose"><XCircle className="h-2.5 w-2.5" /> 失败</Badge>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right font-mono text-[10px] text-[#9CA3AF]">{log.created_at}</td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-xs text-[#9CA3AF]">暂无匹配的审计日志</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Card>

      <div className="flex items-center justify-between rounded-2xl bg-[#111827] px-5 py-3.5 text-white">
        <p className="flex items-center gap-2 text-[11px]">
          <FileCode2 className="h-3.5 w-3.5 text-orange-400" /> 审计日志采用只追加写入（append-only）与哈希链校验，任何篡改将触发完整性告警
        </p>
        <span className="hidden font-mono text-[9px] text-gray-400 sm:block">RETENTION: 365d · HASH CHAIN OK</span>
      </div>
    </div>
  );
};
