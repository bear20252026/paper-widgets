import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BellOff,
  CheckCircle2,
  Download,
  Flag,
  Image as ImageIcon,
  Lock,
  MapPin,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  ThumbsUp,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CopyButton,
  FormField,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TextInput,
  Textarea,
  Tone,
  cn,
  downloadCsv,
} from '../components/ui';
import type {
  ChatGroup,
  GroupStatus,
  ModerationDecision,
  ModerationTag,
  MomentPost,
  PunishmentLevel,
} from '../lib/types';

const TAG_OPTIONS: { tag: ModerationTag; tone: Tone; hint: string }[] = [
  { tag: '涉黄', tone: 'rose', hint: '色情低俗内容' },
  { tag: '涉政', tone: 'violet', hint: '敏感政治信息' },
  { tag: '广告', tone: 'amber', hint: '营销导流广告' },
  { tag: '欺诈', tone: 'rose', hint: '诈骗与虚假返利' },
  { tag: '引流', tone: 'sky', hint: '外部账号导流' },
];

const PUNISHMENT_OPTIONS: { level: PunishmentLevel; label: string; description: string; tone: Tone }[] = [
  { level: 'warning', label: '仅警告', description: '发送系统警告，不限制账号', tone: 'slate' },
  { level: 'mute_3d', label: '禁言 3 天', description: '限制朋友圈发布 72 小时', tone: 'amber' },
  { level: 'mute_7d', label: '禁言 7 天', description: '限制朋友圈发布 168 小时', tone: 'orange' },
  { level: 'ban', label: '永久封号', description: '冻结账号并保留申诉入口', tone: 'rose' },
];

const PUNISHMENT_LABEL: Record<PunishmentLevel, string> = {
  warning: '仅警告',
  mute_3d: '禁言 3 天',
  mute_7d: '禁言 7 天',
  ban: '永久封号',
};

interface AuditProps {
  posts: MomentPost[];
  onNotify: (title: string, description?: string) => void;
}

export const ContentAuditPage: React.FC<AuditProps> = ({ posts, onNotify }) => {
  const [queueFilter, setQueueFilter] = useState<'all' | 'high' | 'normal'>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTags, setSelectedTags] = useState<ModerationTag[]>([]);
  const [punishment, setPunishment] = useState<PunishmentLevel>('mute_7d');
  const [opinion, setOpinion] = useState('');
  const [validation, setValidation] = useState('');
  const [decisions, setDecisions] = useState<Record<string, ModerationDecision>>({});

  const queue = useMemo(
    () => posts.filter((post) => queueFilter === 'all' || post.queue === queueFilter),
    [posts, queueFilter]
  );
  const activePost = queue[Math.min(activeIndex, Math.max(0, queue.length - 1))] ?? posts[0];
  const decision = decisions[activePost.post_id];

  const toggleTag = (tag: ModerationTag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setValidation('');
  };

  const resetForm = () => {
    setSelectedTags([]);
    setPunishment('mute_7d');
    setOpinion('');
    setValidation('');
  };

  const pickNext = () => {
    const nextIndex = queue.findIndex((post, index) => index > activeIndex && !decisions[post.post_id]);
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex);
      resetForm();
      return;
    }
    const firstPending = queue.findIndex((post) => !decisions[post.post_id]);
    if (firstPending >= 0) {
      setActiveIndex(firstPending);
      resetForm();
    }
  };

  const submit = (result: 'approved' | 'rejected') => {
    if (result === 'rejected' && selectedTags.length === 0) {
      setValidation('执行驳回前，请至少选择一个违规标签');
      return;
    }
    if (result === 'approved' && selectedTags.length > 0) {
      setValidation('已选择违规标签，请使用「驳回」完成处罚裁定');
      return;
    }
    const record: ModerationDecision = {
      post_id: activePost.post_id,
      tags: selectedTags,
      punishment: result === 'approved' ? 'warning' : punishment,
      opinion: opinion.trim() || (result === 'approved' ? '人工复核未发现违规事实，予以通过。' : '经人工复核确认命中违规规则。'),
      result,
      operator: 'root（超级管理员）',
      operated_at: '2026-02-24 15:22:41',
    };
    setDecisions((prev) => ({ ...prev, [activePost.post_id]: record }));
    onNotify(
      result === 'approved' ? '审核已通过，动态正常展示' : '审核已驳回，动态已下架',
      `${activePost.post_id} · ${result === 'approved' ? '无违规' : `${selectedTags.join('、')} · ${PUNISHMENT_LABEL[punishment]}`}`
    );
    pickNext();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Content Domain / Audit Workbench"
        title="图文审核工作台"
        description="朋友圈多模态内容人工复审，AI 机审结果与举报工单聚合呈现，支持违规标签与分档处罚留痕。"
        meta={<Badge tone="rose">{posts.filter((p) => !decisions[p.post_id]).length} 条待审</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />}
              onClick={() => {
                downloadCsv(
                  'moderation-decisions-20260224.csv',
                  ['动态编号', '用户', 'UID', '违规标签', '处罚等级', '裁定结果', '审核意见', '操作人', '操作时间'],
                  Object.values(decisions).map((item) => {
                    const post = posts.find((p) => p.post_id === item.post_id);
                    return [
                      item.post_id,
                      post?.user_name ?? '',
                      post?.user_uid ?? '',
                      item.tags.join(' / '),
                      PUNISHMENT_LABEL[item.punishment],
                      item.result === 'approved' ? '通过' : '驳回',
                      item.opinion,
                      item.operator,
                      item.operated_at,
                    ];
                  })
                );
                onNotify('审核记录已导出', `共 ${Object.keys(decisions).length} 条裁定记录`);
              }}
            >
              导出审核记录
            </Button>
            <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              {[
                { key: 'all' as const, label: '全部队列' },
                { key: 'high' as const, label: '高危' },
                { key: 'normal' as const, label: '常规' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setQueueFilter(item.key);
                    setActiveIndex(0);
                  }}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
                    queueFilter === item.key ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:text-[#111827]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {queue.map((post, index) => {
          const handled = decisions[post.post_id];
          return (
            <button
              key={post.post_id}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setSelectedTags(handled?.tags ?? []);
                setOpinion(handled?.opinion ?? '');
                setPunishment(handled?.punishment === 'warning' ? 'mute_7d' : handled?.punishment ?? 'mute_7d');
                setValidation('');
              }}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 text-left transition-all',
                post.post_id === activePost.post_id
                  ? 'shadow-[0_0_0_2px_#111827,0_12px_30px_-18px_rgba(15,23,42,0.25)]'
                  : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.2)]'
              )}
            >
              <Avatar name={post.user_name} tone={post.avatar_tone} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-[#111827]">{post.user_name}</span>
                  {handled ? (
                    <Badge tone={handled.result === 'approved' ? 'emerald' : 'rose'}>{handled.result === 'approved' ? '已通过' : '已驳回'}</Badge>
                  ) : (
                    <Badge tone={post.ai_score > 90 ? 'rose' : 'amber'}>AI {post.ai_score}</Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 text-[10px] text-[#9CA3AF]">{post.content}</p>
                <p className="mt-1 font-mono text-[9px] text-[#C0C6CF]">{post.post_id}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* 左 60% 手机模型 */}
        <div className="w-full xl:w-[60%]">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-[#6B7280]">
                <Smartphone className="h-3.5 w-3.5 text-[#111827]" /> 客户端朋友圈原貌预览
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={activePost.queue === 'high' ? 'rose' : 'slate'}>{activePost.queue === 'high' ? '高危队列' : '常规队列'}</Badge>
                <span className="font-mono text-[10px] text-[#9CA3AF]">{activePost.post_id}</span>
              </div>
            </div>

            <div className="mx-auto max-w-[420px] rounded-[2rem] bg-[#111827] p-2 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.4)]">
              <div className="overflow-hidden rounded-[1.6rem] bg-[#F7F7F7]">
                <div className="flex items-center justify-between bg-white px-4 pt-2.5 pb-2">
                  <span className="font-mono text-[10px] font-semibold text-[#111827]">14:28</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                    <span className="h-1 w-1 rounded-full bg-[#111827]" />
                    <span className="font-mono">5G</span>
                    <span className="ml-1 flex h-2.5 w-5 items-center rounded-[2px] border border-[#9CA3AF] p-0.5">
                      <span className="h-full w-3/4 rounded-[1px] bg-[#111827]" />
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white px-4 py-2.5">
                  <ArrowLeft className="h-4 w-4 text-[#374151]" />
                  <span className="text-xs font-semibold text-[#111827]">朋友圈</span>
                  <MoreHorizontal className="h-4 w-4 text-[#374151]" />
                </div>

                <div className="max-h-[560px] overflow-y-auto">
                  <div className="relative h-24 bg-[linear-gradient(130deg,#1f2937_0%,#334155_55%,#0f172a_100%)]">
                    <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,#94a3b8_0,transparent_40%),radial-gradient(circle_at_80%_70%,#f97316_0,transparent_35%)]" />
                    <div className="absolute right-3 -bottom-5">
                      <Avatar name={activePost.user_name} tone={activePost.avatar_tone} size="lg" />
                    </div>
                  </div>

                  <div className="bg-white px-4 pt-7 pb-3">
                    <p className="text-sm font-semibold text-[#3B5B8C]">{activePost.user_name}</p>
                    <p className="mt-2 text-[13px] leading-[1.7] whitespace-pre-wrap text-[#111827]">{activePost.content}</p>

                    <div
                      className={cn(
                        'mt-3 grid gap-1.5',
                        activePost.images.length <= 1 ? 'grid-cols-1' : activePost.images.length === 4 ? 'grid-cols-2' : 'grid-cols-3'
                      )}
                    >
                      {activePost.images.map((image, index) => (
                        <div
                          key={image.label}
                          className={cn(
                            'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-md bg-gradient-to-br',
                            image.tone
                          )}
                        >
                          <ImageIcon className="h-4 w-4 text-white/80" />
                          <span className="mt-1 px-1 text-center text-[8px] leading-tight font-medium text-white/90">{image.label}</span>
                          <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-black/25 font-mono text-[7px] text-white">
                            {index + 1}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-[#9CA3AF]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> {activePost.location}
                      </span>
                      <span className="font-mono">{activePost.posted_at.slice(5, 16)}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-md bg-[#F7F7F7] px-2.5 py-1.5">
                      <span className="flex items-center gap-3 text-[10px] text-[#576B95]">
                        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {activePost.likes}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {activePost.comments}</span>
                      </span>
                      <span className="flex h-5 w-6 items-center justify-center rounded bg-white text-[#576B95] shadow-xs">
                        <MoreHorizontal className="h-3 w-3" />
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5 rounded-md bg-[#F7F7F7] px-2.5 py-2">
                      <p className="text-[10px] leading-relaxed text-[#576B95]">
                        <span className="font-medium">陆屿科技 王工：</span>这类返利都是套路，大家千万别加
                      </p>
                      <p className="text-[10px] leading-relaxed text-[#576B95]">
                        <span className="font-medium">沈知微：</span>已举报，请平台核实处理
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#F0F0F0] bg-white px-4 py-3">
                    <p className="text-[9px] font-medium text-[#9CA3AF]">相关推荐</p>
                    <div className="mt-2 flex gap-2">
                      <div className="h-12 w-12 rounded-md bg-gradient-to-br from-slate-200 to-slate-100" />
                      <div className="flex-1 space-y-1.5 py-1">
                        <div className="h-1.5 w-4/5 rounded-full bg-[#F0F0F0]" />
                        <div className="h-1.5 w-3/5 rounded-full bg-[#F5F5F5]" />
                        <div className="h-1.5 w-2/5 rounded-full bg-[#F5F5F5]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50/70 p-3.5">
              <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <div>
                <p className="text-[11px] font-semibold text-rose-800">举报原因 · 累计 {activePost.report_count} 次</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-rose-700">{activePost.report_reason}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* 右 40% 审核操作区 */}
        <div className="w-full space-y-4 xl:w-[40%]">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-[#111827]">AI 机审研判</h3>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-[#9CA3AF]">
                  多模态模型命中 OCR 文字导流、二维码识别与虚假收益图像特征
                </p>
              </div>
              <div className="relative h-14 w-14 shrink-0">
                <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#F3F4F6" strokeWidth="4" />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke={activePost.ai_score > 80 ? '#F43F5E' : '#F59E0B'}
                    strokeWidth="4"
                    strokeDasharray={`${(activePost.ai_score / 100) * 100.5} 100.5`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('font-mono text-sm font-semibold', activePost.ai_score > 80 ? 'text-rose-600' : 'text-amber-600')}>
                    {activePost.ai_score}
                  </span>
                  <span className="text-[8px] text-[#9CA3AF]">RISK</span>
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activePost.ai_tags.map((tag) => (
                <Badge key={tag} tone="rose">{tag}</Badge>
              ))}
              <Badge tone="slate">OCR 命中 3 个微信号</Badge>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">审核裁定</h3>
              {decision && (
                <Badge tone={decision.result === 'approved' ? 'emerald' : 'rose'}>
                  {decision.result === 'approved' ? '已通过' : '已驳回'}
                </Badge>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[#374151]">
                  违规标签 <span className="font-normal text-[#9CA3AF]">（可多选）</span>
                </p>
                <span className="font-mono text-[10px] text-[#9CA3AF]">{selectedTags.length} selected</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((item) => {
                  const active = selectedTags.includes(item.tag);
                  return (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => toggleTag(item.tag)}
                      title={item.hint}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-all',
                        active ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.16)]' : 'bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]'
                      )}
                    >
                      {active && <CheckCircle2 className="h-3 w-3" />}
                      {item.tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-[#374151]">处罚等级</p>
              <div className="mt-2 space-y-1.5">
                {PUNISHMENT_OPTIONS.map((item) => {
                  const active = punishment === item.level;
                  return (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => setPunishment(item.level)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all',
                        active ? 'bg-white shadow-[0_0_0_1.5px_#111827]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                      )}
                    >
                      <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full', active ? 'bg-[#111827]' : 'bg-[#E5E7EB]')}>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[11px] font-medium text-[#111827]">{item.label}</span>
                        <span className="mt-0.5 block text-[9px] text-[#9CA3AF]">{item.description}</span>
                      </span>
                      <Badge tone={item.tone} dot={false}>{item.level.toUpperCase()}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField label="审核意见" className="mt-4" error={validation || undefined} hint="将同步给用户申诉入口">
              <Textarea
                rows={3}
                value={opinion}
                onChange={(e) => {
                  setOpinion(e.target.value);
                  if (validation) setValidation('');
                }}
                placeholder="请填写具体违规事实与判决依据，如：正文包含外部微信号并承诺高额返利..."
              />
            </FormField>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Button
                variant="success"
                icon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => submit('approved')}
                className="py-3"
              >
                通过
              </Button>
              <Button
                variant="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => submit('rejected')}
                className="py-3"
              >
                驳回
              </Button>
            </div>

            {decision && (
              <div className="mt-3 rounded-xl bg-[#F9FAFB] p-3.5">
                <p className="text-[10px] font-medium text-[#374151]">最近裁定记录</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[#6B7280]">{decision.opinion}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {decision.tags.map((tag) => (
                    <Badge key={tag} tone="rose" dot={false}>{tag}</Badge>
                  ))}
                  <span className="ml-auto font-mono text-[9px] text-[#9CA3AF]">{decision.operated_at.slice(11)}</span>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[10px] leading-relaxed text-[#6B7280]">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              审核结果将实时同步至用户端与处罚中心，重大违规需同步固证材料至合规归档库。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

/* ================================ 群组管理 ================================ */

const GROUP_STATUS_META: Record<GroupStatus, { label: string; tone: Tone }> = {
  active: { label: '正常', tone: 'emerald' },
  muted: { label: '全员禁言', tone: 'amber' },
  dissolved: { label: '已解散', tone: 'slate' },
  locked: { label: '风控锁定', tone: 'rose' },
};

const RISK_META: Record<ChatGroup['risk_level'], { label: string; tone: Tone }> = {
  low: { label: '低风险', tone: 'emerald' },
  medium: { label: '中风险', tone: 'amber' },
  high: { label: '高风险', tone: 'rose' },
};

const SUPER_ADMIN_PASSWORD = 'admin@2026';

interface GroupsProps {
  groups: ChatGroup[];
  onToggleMute: (groupId: string) => void;
  onDissolve: (groupId: string) => void;
  onNotify: (title: string, description?: string) => void;
}

export const GroupManagementPage: React.FC<GroupsProps> = ({ groups, onToggleMute, onDissolve, onNotify }) => {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dissolveTarget, setDissolveTarget] = useState<ChatGroup | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [detail, setDetail] = useState<ChatGroup | null>(null);
  const pageSize = 8;

  const filtered = useMemo(
    () =>
      groups.filter((group) => {
        const query = keyword.trim().toLowerCase();
        const matchKeyword =
          !query ||
          group.name.toLowerCase().includes(query) ||
          group.owner_uid.toLowerCase().includes(query) ||
          group.group_id.toLowerCase().includes(query);
        return matchKeyword && (statusFilter === 'all' || group.status === statusFilter);
      }),
    [groups, keyword, statusFilter]
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const counts = {
    total: groups.length,
    active: groups.filter((g) => g.status === 'active').length,
    muted: groups.filter((g) => g.status === 'muted').length,
    high: groups.filter((g) => g.risk_level === 'high').length,
  };

  const confirmDissolve = () => {
    if (!dissolveTarget) return;
    if (password !== SUPER_ADMIN_PASSWORD) {
      setPasswordError('超级管理员密码不正确，请重新输入');
      return;
    }
    onDissolve(dissolveTarget.group_id);
    onNotify('群组已强制解散', `${dissolveTarget.group_id} · 全体成员将收到解散通知，聊天记录保留 15 天备查`);
    setDissolveTarget(null);
    setPassword('');
    setPasswordError('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Content Domain / Group Governance"
        title="群组管理"
        description="巡检微信生态群聊规模、活跃度与风险等级，支持全员禁言与高危群组强制解散处置。"
        meta={<Badge tone="amber">{counts.muted + counts.high} 个群组需关注</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />}
              onClick={() => {
                downloadCsv(
                  'chat-groups-20260224.csv',
                  ['群组编号', '群名称', '群主 UID', '群人数', '容量', '状态', '风险等级', '今日消息', '创建时间'],
                  filtered.map((group) => [
                    group.group_id,
                    group.name,
                    group.owner_uid,
                    String(group.member_count),
                    String(group.max_members),
                    GROUP_STATUS_META[group.status].label,
                    RISK_META[group.risk_level].label,
                    String(group.messages_today),
                    group.created_at,
                  ])
                );
                onNotify('群组清单已导出', `共 ${filtered.length} 个群组，含风险等级与活跃数据`);
              }}
            >
              导出群组
            </Button>
            <Button
              variant="primary"
              icon={<MessagesSquare className="h-3.5 w-3.5" />}
              onClick={() => onNotify('群组巡检任务已下发', '已对高风险群组启动近 7 日消息内容回溯扫描')}
            >
              启动巡检
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '群组总数', value: counts.total, hint: '已纳管标准群与会员群', icon: Users },
          { label: '正常活跃', value: counts.active, hint: '近 24h 有消息产生', icon: Volume2 },
          { label: '全员禁言', value: counts.muted, hint: '限制成员发言', icon: VolumeX },
          { label: '高风险群组', value: counts.high, hint: '命中涉诈/导流模型', icon: ShieldAlert },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#6B7280]">{item.label}</p>
                <Icon className="h-4 w-4 text-[#9CA3AF]" />
              </div>
              <p className="mt-2.5 font-mono text-xl font-semibold tracking-tight text-[#111827]">{String(item.value).padStart(2, '0')}</p>
              <p className="mt-1 text-[10px] text-[#9CA3AF]">{item.hint}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#111827]">群组列表</h3>
            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-[10px] text-[#6B7280]">{filtered.length} groups</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索群名称、群主 UID、群编号"
                className="w-64 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-32 py-2.5 text-xs"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="muted">全员禁言</option>
              <option value="locked">风控锁定</option>
              <option value="dissolved">已解散</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">群组 / 群主</th>
                <th className="px-3 py-3 font-medium">群人数</th>
                <th className="px-3 py-3 font-medium">今日消息</th>
                <th className="px-3 py-3 font-medium">状态</th>
                <th className="px-3 py-3 font-medium">风险等级</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((group) => {
                const statusMeta = GROUP_STATUS_META[group.status];
                const riskMeta = RISK_META[group.risk_level];
                const dissolved = group.status === 'dissolved';
                return (
                  <tr key={group.group_id} className="group transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280]">
                          <MessagesSquare className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[230px] truncate text-xs font-medium text-[#111827]">{group.name}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-[#9CA3AF]">{group.owner_uid}</span>
                            <CopyButton value={group.group_id} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-medium text-[#111827]">{group.member_count}</span>
                        <span className="font-mono text-[10px] text-[#9CA3AF]">/ {group.max_members}</span>
                      </div>
                      <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-[#F3F4F6]">
                        <div
                          className={cn('h-full rounded-full', group.member_count === group.max_members ? 'bg-rose-400' : 'bg-[#111827]')}
                          style={{ width: `${(group.member_count / group.max_members) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-mono text-[11px] text-[#374151]">{group.messages_today.toLocaleString('zh-CN')}</p>
                      <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{group.category}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={riskMeta.tone}>{riskMeta.label}</Badge>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={dissolved}
                          onClick={() => {
                            onToggleMute(group.group_id);
                            onNotify(
                              group.status === 'muted' ? '已解除全员禁言' : '已设置全员禁言',
                              `${group.name} · 仅群主与管理员可发言`
                            );
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 text-[10px] font-medium text-[#4B5563] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {group.status === 'muted' ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                          {group.status === 'muted' ? '解除禁言' : '全员禁言'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetail(group)}
                          className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          disabled={dissolved}
                          onClick={() => {
                            setDissolveTarget(group);
                            setPassword('');
                            setPasswordError('');
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Ban className="h-3 w-3" /> 解散
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-[#9CA3AF]">
                    暂无匹配的群组记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Card>

      <Modal
        open={Boolean(dissolveTarget)}
        onClose={() => setDissolveTarget(null)}
        title="强制解散群组"
        subtitle="这是最高危的社区处置动作，解散后群聊即刻失效且不可恢复"
        icon={<Lock className="h-4 w-4 text-rose-500" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDissolveTarget(null)}>
              取消
            </Button>
            <Button variant="danger" icon={<Ban className="h-3.5 w-3.5" />} onClick={confirmDissolve}>
              确认强制解散
            </Button>
          </>
        }
      >
        {dissolveTarget && (
          <div className="space-y-3.5">
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-[10px] text-[#9CA3AF]">目标群组</p>
              <p className="mt-1 text-xs font-medium text-[#111827]">{dissolveTarget.name}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                <span className="text-[#9CA3AF]">群编号 <b className="font-mono text-[#374151]">{dissolveTarget.group_id.slice(-8)}</b></span>
                <span className="text-[#9CA3AF]">群成员 <b className="font-mono text-[#374151]">{dissolveTarget.member_count} 人</b></span>
                <span className="text-[#9CA3AF]">群主 <b className="font-mono text-[#374151]">{dissolveTarget.owner_uid}</b></span>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3.5 text-[11px] leading-relaxed text-rose-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>解散后所有成员将被移出群聊，历史消息保留 15 天用于司法备查。请确保已固定违规证据并完成风险单归档。</span>
            </div>
            <FormField
              label="超级管理员密码"
              required
              hint="高危操作二次确认"
              error={passwordError || undefined}
            >
              <TextInput
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="请输入超管密码"
                autoComplete="new-password"
              />
            </FormField>
            <p className="text-[10px] text-[#9CA3AF]">演示环境密码：admin@2026</p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="群组详情"
        subtitle={detail ? `${detail.group_id} · 创建于 ${detail.created_at}` : ''}
        icon={<Users className="h-4 w-4" />}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              关闭
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!detail) return;
                onNotify('群公告已下发', `${detail.name} · 全体成员将收到群公告提醒`);
                setDetail(null);
              }}
            >
              下发群公告
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-white">
                <MessagesSquare className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-[#111827]">{detail.name}</p>
                <p className="mt-1 font-mono text-[10px] text-[#9CA3AF]">{detail.group_id}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={GROUP_STATUS_META[detail.status].tone}>{GROUP_STATUS_META[detail.status].label}</Badge>
                  <Badge tone={RISK_META[detail.risk_level].tone}>{RISK_META[detail.risk_level].label}</Badge>
                  <Badge tone="slate" dot={false}>{detail.category}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '群主 UID', value: detail.owner_uid },
                { label: '成员规模', value: `${detail.member_count} / ${detail.max_members}` },
                { label: '今日消息量', value: `${detail.messages_today.toLocaleString('zh-CN')} 条` },
                { label: '创建时间', value: detail.created_at },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#F9FAFB] px-4 py-3">
                  <p className="text-[10px] text-[#9CA3AF]">{item.label}</p>
                  <p className="mt-1 font-mono text-[11px] text-[#111827]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-[#6B7280]">
                <BellOff className="h-3 w-3" /> 当前群公告
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#374151]">{detail.notice}</p>
            </div>
            <div className="rounded-xl bg-white p-1">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 px-3 py-2 text-[10px] text-amber-800">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> 近 24 小时该群命中 2 条高危导流内容，建议持续观察并保留处置记录。
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="flex items-center gap-2 text-[11px] text-[#6B7280]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 群组操作全程留痕，高危处置需超级管理员二次鉴权
        </p>
        <p className="hidden items-center gap-1.5 text-[10px] text-[#9CA3AF] sm:flex">
          <Flag className="h-3 w-3" /> 举报工单自动关联至图文审核工作台
        </p>
      </div>
    </div>
  );
};

export const GROUP_META = GROUP_STATUS_META;
