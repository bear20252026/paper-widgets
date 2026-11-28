export type MobileScreen =
  | "chats"
  | "contacts"
  | "discover"
  | "me"
  | "chat"
  | "moments"
  | "moments_post"
  | "profile"
  | "channels"
  | "mini"
  | "wallet"
  | "settings"
  | "favorites"
  | "stickers"
  | "cards"
  | "search"
  | "scan"
  | "pay"
  | "transfer"
  | "redpacket"
  | "call"
  | "reading"
  | "newfriends"
  | "status"
  | "floating"
  | "qrcode";

export type MobilePageMeta = {
  id: MobileScreen;
  title: string;
  english: string;
  caption: string;
  group: "核心" | "关系" | "发现" | "我" | "服务";
  badge?: string;
};

export const MOBILE_PAGES: MobilePageMeta[] = [
  { id: "chats", title: "聊天列表", english: "Chats", caption: "置顶会话、下拉小程序抽屉与消息预览", group: "核心" },
  { id: "chat", title: "聊天详情", english: "Conversation", caption: "图文、语音转文字、红包转账与跨端同步", group: "核心", badge: "SYNC" },
  { id: "floating", title: "浮窗与音乐", english: "Multitask", caption: "微信浮窗任务栏与黑胶音乐播放器", group: "核心", badge: "NEW" },
  { id: "contacts", title: "通讯录", english: "Contacts", caption: "星标朋友、分组与 A–Z 字母索引", group: "关系" },
  { id: "profile", title: "好友资料", english: "Profile", caption: "社交资料、共同群聊与朋友圈预览", group: "关系" },
  { id: "newfriends", title: "新的朋友", english: "New Friends", caption: "好友验证通过与添加来源", group: "关系" },
  { id: "qrcode", title: "二维码名片", english: "QR Card", caption: "可切换样式的个人微信二维码名片", group: "关系", badge: "NEW" },
  { id: "discover", title: "发现", english: "Discover", caption: "朋友圈、视频号、看一看与小程序入口", group: "发现" },
  { id: "moments", title: "朋友圈", english: "Moments", caption: "封面大图、双端同步点赞与实时评论", group: "发现", badge: "SYNC" },
  { id: "moments_post", title: "发表朋友圈", english: "Post Moment", caption: "九宫格配图、所在位置与同步发布", group: "发现", badge: "NEW" },
  { id: "channels", title: "视频号", english: "Channels", caption: "全屏沉浸短视频、弹幕评论与红心赞", group: "发现" },
  { id: "mini", title: "小程序", english: "Mini Programs", caption: "今日精选、附近小程序与常用服务", group: "发现" },
  { id: "search", title: "搜一搜", english: "Search", caption: "全网热搜榜、历史词条与聚合结果", group: "发现" },
  { id: "scan", title: "扫一扫", english: "Scan", caption: "激光扫码线、识物与AR翻译取景器", group: "发现" },
  { id: "reading", title: "公众号文章", english: "Article", caption: "沉浸式排版、划线批注与在看分享", group: "发现" },
  { id: "me", title: "我", english: "Me", caption: "个人主页、微信状态与快捷服务", group: "我" },
  { id: "status", title: "个人状态", english: "Status 8.0", caption: "呼吸感渐变背景与好友同款状态", group: "我", badge: "NEW" },
  { id: "favorites", title: "收藏", english: "Favorites", caption: "笔记、照片、链接与语音备忘", group: "我" },
  { id: "cards", title: "卡包", english: "Cards", caption: "咖啡券、美术馆会员卡与展览门票", group: "我" },
  { id: "stickers", title: "表情商店", english: "Stickers", caption: "自制表情与艺术家联名专辑", group: "我" },
  { id: "settings", title: "设置", english: "Settings", caption: "深浅色外观切换、关怀模式与存储", group: "我" },
  { id: "wallet", title: "服务", english: "Services", caption: "微信支付零钱、生活缴费与账单", group: "服务" },
  { id: "pay", title: "收付款", english: "QR Pay", caption: "动态付款码、条形码与优先扣款方式", group: "服务" },
  { id: "transfer", title: "微信转账", english: "Transfer", caption: "定制数字键盘、转账说明与实时入账", group: "服务", badge: "NEW" },
  { id: "redpacket", title: "微信红包", english: "Red Packet", caption: "烫金红包封面与「開」红包动效", group: "服务" },
  { id: "call", title: "音视频通话", english: "Video Call", caption: "画中画双端镜头、端到端加密与模糊背景", group: "服务" },
];

export type DesktopPageMeta = {
  id: string;
  title: string;
  english: string;
  caption: string;
  badge?: string;
};

export const DESKTOP_PAGES: DesktopPageMeta[] = [
  { id: "chats", title: "聊天", english: "Chats", caption: "三栏效率布局与手机端实时消息同步", badge: "SYNC" },
  { id: "contacts", title: "通讯录", english: "Contacts", caption: "组织架构、星标朋友与详情名片" },
  { id: "favorites", title: "收藏", english: "Favorites", caption: "富文本笔记阅读器与多格式归档" },
  { id: "files", title: "聊天文件", english: "Files", caption: "文件传输助手、分类检索与空间分析" },
  { id: "moments", title: "朋友圈", english: "Moments", caption: "桌面端独立朋友圈信息流与互动", badge: "SYNC" },
  { id: "channels", title: "视频号", english: "Channels", caption: "宽屏精选剧院、直播间与创作者中心" },
  { id: "mini", title: "小程序", english: "Mini Programs", caption: "桌面端小程序矩阵与多任务中心" },
  { id: "search_hub", title: "搜一搜", english: "Search Hub", caption: "聚合搜索、公众号文章与全网热榜", badge: "NEW" },
  { id: "articles", title: "看一看专栏", english: "Read Hub", caption: "桌面端深度长文阅读器与批注卡片", badge: "NEW" },
  { id: "wallet", title: "微信支付", english: "WeChat Pay", caption: "资产总览、月度收支与安全账单" },
  { id: "lock", title: "锁定与安全", english: "Screen Lock", caption: "桌面端离开锁定与手机指纹解锁联动", badge: "NEW" },
  { id: "settings", title: "设置", english: "Settings", caption: "深色外观切换、快捷键与存储清理" },
];
