import { useRef, useState } from "react";
import { t } from "../i18n";
import { vibrate } from "../store/gameStore";

interface JoystickProps {
  onVector: (x: number, y: number) => void;
  /** normalised dead zone (0–0.3); grows with snake length to calm long-snake steering */
  deadZone?: number;
  haptics?: boolean;
}

/**
 * Mobile steering stick with two feel upgrades:
 *  - dynamic dead zone: ignores micro-jitter near the centre; the zone widens
 *    with the snake's size (long snakes need calmer thumbs).
 *  - rebound haptics: a light tick when the stick hits the rim, and a double
 *    tick when it springs back to centre on release.
 */
export function Joystick({ onVector, deadZone = 0.12, haptics = true }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);
  const rimArmed = useRef(false);
  const lastMag = useRef(0);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [engaged, setEngaged] = useState(false);

  const moveTo = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.33;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const mag = Math.min(1, dist / max);
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }

    if (mag < deadZone) {
      // Inside the dead zone: keep the knob calm and keep the previous heading.
      setKnob({ x: dx * 0.45, y: dy * 0.45 });
      setEngaged(false);
      lastMag.current = mag;
      return;
    }

    setKnob({ x: dx, y: dy });
    setEngaged(true);
    // Re-scale so the first engaged pixel doesn't jump the snake.
    const scaled = (mag - deadZone) / (1 - deadZone);
    onVector((dx / Math.max(1, max)) * scaled * 1.4, (dy / Math.max(1, max)) * scaled * 1.4);

    if (mag > 0.82 && !rimArmed.current) {
      rimArmed.current = true;
      vibrate(9, haptics);
    } else if (mag < 0.6) {
      rimArmed.current = false;
    }
    lastMag.current = mag;
  };

  const end = () => {
    const had = activeRef.current !== null;
    activeRef.current = null;
    const rebounded = lastMag.current > 0.55;
    lastMag.current = 0;
    rimArmed.current = false;
    setKnob({ x: 0, y: 0 });
    setEngaged(false);
    onVector(0, 0);
    if (had && rebounded) vibrate([7, 26, 11], haptics);
  };

  const deadRadius = Math.min(46, 28 + deadZone * 120);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2 select-none">
      <div
        ref={baseRef}
        className={`relative h-[124px] w-[124px] touch-none rounded-full border bg-white/45 shadow-[0_16px_40px_-24px_rgba(23,58,48,0.7)] backdrop-blur-xl transition-colors ${
          engaged ? "border-mintdeep/50" : "border-white/70"
        }`}
        onPointerDown={(e) => {
          e.preventDefault();
          if (activeRef.current !== null) return;
          activeRef.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          moveTo(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activeRef.current !== e.pointerId) return;
          moveTo(e.clientX, e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={(e) => {
          if (activeRef.current === e.pointerId && e.buttons === 0) end();
        }}
        role="slider"
        aria-label={t("移动摇杆")}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round((Math.atan2(knob.y, knob.x) * 180) / Math.PI)}
        tabIndex={-1}
      >
        <div className="absolute inset-[13px] rounded-full border border-dashed border-[#173a30]/16" />
        {/* visualised dynamic dead zone */}
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10 transition-colors ${
            engaged ? "bg-mint/12" : "bg-ink/[0.04]"
          }`}
          style={{ width: deadRadius, height: deadRadius }}
        />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[9px] font-bold tracking-[0.14em] text-ink/35">
          {t("转向")}
        </span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-bold tracking-[0.08em] text-ink/25">
          {t("死区 {n}%", { n: Math.round(deadZone * 100) })}
        </span>
        <div
          className={`absolute left-1/2 top-1/2 flex h-[54px] w-[54px] items-center justify-center rounded-full border shadow-[0_10px_18px_-8px_rgba(23,58,48,0.7)] transition-[border-color,background] duration-100 ${
            engaged ? "border-limelight bg-[#1f4a3c]" : "border-white/90 bg-[#173a30]"
          }`}
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        >
          <div className={`h-4 w-4 rounded-full ${engaged ? "bg-limelight" : "bg-[#d9f27f]/70"}`} />
        </div>
      </div>
      <span className="rounded-full bg-white/60 px-3 py-1 text-[10px] font-bold text-ink/55 backdrop-blur">
        {t("左侧摇杆 · 长蛇自动扩大死区")}
      </span>
    </div>
  );
}
