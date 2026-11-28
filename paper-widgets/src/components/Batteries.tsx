import { useCallback, useRef, type CSSProperties } from "react";
import { useFrame } from "../lib/clock";
import { BATTERIES } from "../lib/content";
import { out, seg } from "../lib/motion";
import {
  BATTERY_FILL,
  BATTERY_STAGGER,
  BOLT_BASE,
  BOLT_FROM,
  BOLT_PULSE,
  BOLT_SPEED,
  CHARGE_FROM,
  CHARGE_RATE,
  SHIMMER_FROM,
  SHIMMER_SPAN,
  SHIMMER_SPEED,
} from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import { Bolt, Buds, Phone, Watch } from "./icons";
import styles from "./Batteries.module.css";

const ICONS = { phone: Phone, watch: Watch, buds: Buds };

/** Three devices: each bar fills in turn; the charging phone creeps up, shimmers and pulses its bolt. */
export function Batteries() {
  const levels = useRef<(HTMLDivElement | null)[]>([]);
  const fills = useRef<(HTMLDivElement | null)[]>([]);
  const shimmers = useRef<(HTMLDivElement | null)[]>([]);
  const bolts = useRef<(HTMLDivElement | null)[]>([]);

  useFrame(
    useCallback((t: number) => {
      BATTERIES.devices.forEach((device, i) => {
        const level = levels.current[i];
        const fill = fills.current[i];
        const shimmer = shimmers.current[i];
        const bolt = bolts.current[i];
        if (!level || !fill) return;
        let lv = device.level * seg(t, BATTERY_FILL[0] + i * BATTERY_STAGGER, BATTERY_FILL[1] + i * BATTERY_STAGGER, out);
        if (device.charging) lv += t > CHARGE_FROM ? (t - CHARGE_FROM) * CHARGE_RATE : 0;
        fill.style.width = lv * 100 + "%";
        level.textContent = Math.round(lv * 100) + "%";
        if (shimmer) {
          const k = (t * SHIMMER_SPEED) % 1;
          shimmer.style.left = k * SHIMMER_SPAN + SHIMMER_FROM + "%";
          shimmer.style.opacity = t > CHARGE_FROM ? "1" : "0";
        }
        if (bolt) {
          bolt.style.opacity = String(t > BOLT_FROM ? BOLT_BASE + BOLT_PULSE * Math.sin(t * BOLT_SPEED) : 0);
        }
      });
    }, []),
  );

  return (
    <Tile index={4} col={2} row={1}>
      <Label>{BATTERIES.label}</Label>
      {BATTERIES.devices.map((device, i) => {
        const Icon = ICONS[device.icon];
        return (
          <div key={device.name} className={styles.row} style={{ "--i": i } as CSSProperties}>
            <div className={styles.well}>
              <Icon size={18} />
            </div>
            <div className={styles.name}>{device.name}</div>
            <div
              ref={(el) => {
                levels.current[i] = el;
              }}
              className={styles.level}
            />
            <div className={styles.bar}>
              <div
                ref={(el) => {
                  fills.current[i] = el;
                }}
                className={`${styles.fill} ${device.charging ? styles.charging : ""}`}
              >
                {device.charging && (
                  <div
                    ref={(el) => {
                      shimmers.current[i] = el;
                    }}
                    className={styles.shimmer}
                  />
                )}
              </div>
            </div>
            {device.charging && (
              <div
                ref={(el) => {
                  bolts.current[i] = el;
                }}
                className={styles.bolt}
              >
                <Bolt size={13} />
              </div>
            )}
          </div>
        );
      })}
    </Tile>
  );
}
