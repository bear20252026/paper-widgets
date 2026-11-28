// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';

// 孩子头像：按 seed 稳定生成 SVG 卡通头像；mE 为隐藏的渐变/钢笔定义。lE/iE 为确定性随机哈希。

function lE(t) {
  let a = 2166136261;
  for (let r = 0; r < t.length; r++) a ^= t.charCodeAt(r), a = Math.imul(a, 16777619);
  return a >>> 0;
}
function iE(t) {
  let a = lE(t);
  return () => {
    a = a + 1831565813 | 0;
    let r = Math.imul(a ^ a >>> 15, 1 | a);
    return r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r, ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
const cE = ["#FFB5C8", "#FFCF9E", "#A9DAF5", "#B5E8C8", "#D3C2F5", "#FFEC99", "#FFD6E0", "#C9F0E4"],
  uE = ["#FFE0C7", "#F9D4B4", "#F2C29B", "#E8B48A", "#FCE6D4"],
  dE = ["#4A3426", "#6B4A35", "#2F2420", "#8C5A3C", "#B07848", "#3D2C24"],
  fE = ["#FF7FA3", "#FF9F43", "#5BB6E8", "#6BCB8B", "#A487E8", "#F5C542"];
function ja({
  seed: t,
  gender: a = "girl",
  size: r = 56,
  adult: l = !1,
  className: i = "",
  ring: c = !0
}) {
  const d = b.useMemo(() => {
      const p = iE(t),
        g = x => x[Math.floor(p() * x.length)];
      return {
        bg: g(cE),
        skin: g(uE),
        hair: g(dE),
        accent: g(fE),
        style: Math.floor(p() * 3),
        acc: Math.floor(p() * 5),
        mouth: Math.floor(p() * 3),
        tilt: (p() - 0.5) * 8
      };
    }, [t]),
    h = a === "girl";
  return m.jsx("svg", {
    viewBox: "0 0 100 100",
    width: r,
    height: r,
    className: i,
    style: {
      transform: `rotate(${d.tilt}deg)`
    },
    "aria-hidden": !0,
    children: m.jsxs("g", {
      filter: "url(#crayon-rough)",
      children: [m.jsx("circle", {
        cx: "50",
        cy: "50",
        r: "47",
        fill: d.bg
      }), c && m.jsx("circle", {
        cx: "50",
        cy: "50",
        r: "46",
        fill: "none",
        stroke: "#4A3426",
        strokeOpacity: "0.25",
        strokeWidth: "2.5"
      }), h && d.style === 0 && m.jsxs(m.Fragment, {
        children: [m.jsx("circle", {
          cx: "22",
          cy: "52",
          r: "11",
          fill: d.hair
        }), m.jsx("circle", {
          cx: "78",
          cy: "52",
          r: "11",
          fill: d.hair
        })]
      }), h && d.style === 1 && m.jsx("path", {
        d: "M22 50 Q20 84 34 86 L66 86 Q80 84 78 50 Z",
        fill: d.hair
      }), h && d.style === 2 && m.jsx("circle", {
        cx: "50",
        cy: "20",
        r: "12",
        fill: d.hair
      }), m.jsx("path", {
        d: "M24 100 Q26 76 50 74 Q74 76 76 100 Z",
        fill: d.accent,
        opacity: "0.9"
      }), l && m.jsx("path", {
        d: "M44 76 L50 86 L56 76",
        fill: "#fff",
        opacity: "0.85"
      }), m.jsx("ellipse", {
        cx: "50",
        cy: "52",
        rx: "24",
        ry: "23",
        fill: d.skin
      }), h ? m.jsx("path", {
        d: "M26 50 Q26 26 50 26 Q74 26 74 50 Q66 38 56 36 Q50 44 36 42 Q30 44 26 50 Z",
        fill: d.hair
      }) : d.style === 0 ? m.jsx("path", {
        d: "M26 48 Q24 26 50 25 Q76 26 74 48 Q72 36 62 34 L58 40 L54 33 L48 40 L44 33 L38 39 Q30 38 26 48 Z",
        fill: d.hair
      }) : d.style === 1 ? m.jsx("path", {
        d: "M25 50 Q24 24 50 24 Q76 24 75 50 Q70 40 50 40 Q30 40 25 50 Z",
        fill: d.hair
      }) : m.jsxs(m.Fragment, {
        children: [m.jsx("circle", {
          cx: "34",
          cy: "34",
          r: "9",
          fill: d.hair
        }), m.jsx("circle", {
          cx: "46",
          cy: "28",
          r: "10",
          fill: d.hair
        }), m.jsx("circle", {
          cx: "58",
          cy: "29",
          r: "10",
          fill: d.hair
        }), m.jsx("circle", {
          cx: "68",
          cy: "36",
          r: "8",
          fill: d.hair
        })]
      }), m.jsx("circle", {
        cx: "41",
        cy: "54",
        r: "3.2",
        fill: "#3A2A20"
      }), m.jsx("circle", {
        cx: "59",
        cy: "54",
        r: "3.2",
        fill: "#3A2A20"
      }), m.jsx("circle", {
        cx: "42",
        cy: "53",
        r: "1",
        fill: "#fff"
      }), m.jsx("circle", {
        cx: "60",
        cy: "53",
        r: "1",
        fill: "#fff"
      }), m.jsx("ellipse", {
        cx: "34",
        cy: "62",
        rx: "5",
        ry: "3",
        fill: "#FF8FA8",
        opacity: "0.55"
      }), m.jsx("ellipse", {
        cx: "66",
        cy: "62",
        rx: "5",
        ry: "3",
        fill: "#FF8FA8",
        opacity: "0.55"
      }), d.mouth === 0 && m.jsx("path", {
        d: "M44 63 Q50 69 56 63",
        stroke: "#3A2A20",
        strokeWidth: "2.2",
        fill: "none",
        strokeLinecap: "round"
      }), d.mouth === 1 && m.jsx("path", {
        d: "M45 63 Q50 70 55 63 Z",
        fill: "#E8604C"
      }), d.mouth === 2 && m.jsx("circle", {
        cx: "50",
        cy: "65",
        r: "2.6",
        fill: "#E8604C"
      }), d.acc === 1 && h && m.jsxs("g", {
        transform: "translate(66 30) rotate(18)",
        children: [m.jsx("path", {
          d: "M0 0 L-9 -6 L-9 6 Z M0 0 L9 -6 L9 6 Z",
          fill: d.accent
        }), m.jsx("circle", {
          r: "2.5",
          fill: d.accent
        })]
      }), d.acc === 1 && !h && m.jsx("path", {
        d: "M28 34 Q50 14 72 34 Q50 28 28 34 Z",
        fill: d.accent
      }), d.acc === 2 && m.jsxs("g", {
        stroke: "#3A2A20",
        strokeWidth: "1.8",
        fill: "none",
        children: [m.jsx("circle", {
          cx: "41",
          cy: "54",
          r: "6.5"
        }), m.jsx("circle", {
          cx: "59",
          cy: "54",
          r: "6.5"
        }), m.jsx("path", {
          d: "M47.5 54 L52.5 54"
        })]
      }), d.acc === 3 && m.jsxs("g", {
        fill: "#C97B43",
        opacity: "0.6",
        children: [m.jsx("circle", {
          cx: "37",
          cy: "58",
          r: "0.9"
        }), m.jsx("circle", {
          cx: "40",
          cy: "60",
          r: "0.9"
        }), m.jsx("circle", {
          cx: "60",
          cy: "60",
          r: "0.9"
        }), m.jsx("circle", {
          cx: "63",
          cy: "58",
          r: "0.9"
        })]
      }), d.acc === 4 && m.jsx("rect", {
        x: "30",
        y: "38",
        width: "10",
        height: "4",
        rx: "2",
        fill: d.accent,
        transform: "rotate(-20 35 40)"
      })]
    })
  });
}
function mE() {
  return m.jsx("svg", {
    width: "0",
    height: "0",
    style: {
      position: "absolute"
    },
    "aria-hidden": !0,
    children: m.jsxs("defs", {
      children: [m.jsxs("filter", {
        id: "crayon-rough",
        x: "-5%",
        y: "-5%",
        width: "110%",
        height: "110%",
        children: [m.jsx("feTurbulence", {
          type: "fractalNoise",
          baseFrequency: "0.9",
          numOctaves: "2",
          seed: "3",
          result: "noise"
        }), m.jsx("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "noise",
          scale: "2.2",
          xChannelSelector: "R",
          yChannelSelector: "G"
        })]
      }), m.jsxs("filter", {
        id: "crayon-grain",
        children: [m.jsx("feTurbulence", {
          type: "fractalNoise",
          baseFrequency: "1.4",
          numOctaves: "2",
          seed: "8",
          result: "grain"
        }), m.jsx("feColorMatrix", {
          in: "grain",
          type: "saturate",
          values: "0",
          result: "mono"
        }), m.jsx("feComponentTransfer", {
          in: "mono",
          result: "alpha",
          children: m.jsx("feFuncA", {
            type: "table",
            tableValues: "0 0 0.25 0.5"
          })
        }), m.jsx("feComposite", {
          in: "SourceGraphic",
          in2: "alpha",
          operator: "out"
        })]
      })]
    })
  });
}
export { lE, iE, cE, uE, dE, fE, ja, mE };
