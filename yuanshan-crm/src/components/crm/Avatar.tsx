import { useState } from "react";
import { cn, initialOf } from "@/lib/utils";

export function Avatar({
  src,
  name,
  size = 28,
  color = "#1E3A32",
  className,
}: {
  src?: string;
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = initialOf(name);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white",
        className,
      )}
      style={{ width: size, height: size, background: src && !failed ? "#EEE" : color }}
      title={name}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-medium text-white" style={{ fontSize: size * 0.42 }}>
          {initial}
        </span>
      )}
    </span>
  );
}
