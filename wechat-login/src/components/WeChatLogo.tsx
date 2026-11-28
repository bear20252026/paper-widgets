type Props = {
  size?: number;
  className?: string;
  mono?: boolean;
};

// WeChat classic green: #07C160
export function WeChatLogo({ size = 64, className = "", mono = false }: Props) {
  const bg = mono ? "currentColor" : "#07C160";
  const eyeColor = mono ? "#07C160" : "#07C160";
  const eyeFill = mono ? "currentColor" : "#ffffff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WeChat"
    >
      <rect width="64" height="64" rx="16" fill={mono ? "transparent" : "#07C160"} />
      {/* Two chat bubbles */}
      <path
        d="M24.8 14C15.5 14 8 20.4 8 28.2c0 4.4 2.4 8.3 6.2 11 .2.1.3.4.3.6l-.7 2.6c-.1.3.2.5.5.3l3.3-1.8c.2-.1.4-.1.6 0 1.9.8 4.1 1.2 6.4 1.2.5 0 1 0 1.5-.1-.3-1-.5-2-.5-3.1 0-7.4 7-13.4 15.7-13.4.5 0 1 0 1.5.1C41 18.5 33.5 14 24.8 14Z"
        fill={mono ? bg : "#ffffff"}
      />
      {/* Eyes */}
      <circle cx="18" cy="27" r="2" fill={eyeColor} />
      <circle cx="31" cy="27" r="2" fill={eyeColor} />

      <path
        d="M56 39.3c0-6.4-6.3-11.6-14-11.6s-14 5.2-14 11.6c0 6.5 6.3 11.6 14 11.6 1.7 0 3.4-.3 4.9-.8.2-.1.4-.1.5 0l2.7 1.4c.2.1.5 0 .4-.3l-.6-2.2c0-.2.1-.4.2-.5 3.6-2.2 5.9-5.5 5.9-9.2Z"
        fill={mono ? bg : "#ffffff"}
      />
      <circle cx="36.5" cy="38.2" r="1.7" fill={mono ? eyeFill : "#07C160"} />
      <circle cx="47.5" cy="38.2" r="1.7" fill={mono ? eyeFill : "#07C160"} />
    </svg>
  );
}

export function WeChatLogoText({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 20" className={className} xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="16"
        fontFamily="-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
        fontSize="18"
        fontWeight="500"
        fill="currentColor"
      >
        WeChat
      </text>
    </svg>
  );
}
