const AZIMUTH = 45;
const ELEVATION = 30;
const SHADES = 4;
const RADIANS = Math.PI / 180;
const UNIT = Math.sqrt(1.6);
function cameraOf({ scale, azimuth = AZIMUTH, elevation = ELEVATION }) {
    const a = azimuth * RADIANS;
    const e = elevation * RADIANS;
    return { sinA: Math.sin(a), cosA: Math.cos(a), sinE: Math.sin(e), cosE: Math.cos(e), k: scale * UNIT };
}
function iso([x, y, z], projection) {
    const { origin } = projection;
    const { sinA, cosA, sinE, cosE, k } = cameraOf(projection);
    return [origin[0] + (x * sinA - y * cosA) * k, origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k];
}
function towardViewer(projection) {
    const { sinA, cosA } = cameraOf(projection);
    return [cosA, sinA];
}
function depthOf([x, y, z], projection) {
    const { sinA, cosA, sinE, cosE } = cameraOf(projection);
    return (x * cosA + y * sinA) * cosE + z * sinE;
}
const tenth = (value) => {
    const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
    return text === "-0" ? "0" : text;
};
function pathOf(points, closed = false) {
    if (!points.length)
        return "";
    return points.map(([x, y], at) => `${at ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");
}
const joinPaths = (paths) => paths.filter(Boolean).join("");
function roundedPlan({ x, y, w, d, r }, steps = 8) {
    const radius = Math.max(0, Math.min(r, w / 2, d / 2));
    const corners = [
        [x + w - radius, y + radius, -90],
        [x + w - radius, y + d - radius, 0],
        [x + radius, y + d - radius, 90],
        [x + radius, y + radius, 180],
    ];
    const out = [];
    for (const [cx, cy, start] of corners) {
        const count = radius > 0 ? steps : 0;
        for (let step = 0; step <= count; step++) {
            const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
            out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
    }
    return out;
}
function signedArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
        const [ax, ay] = points[index];
        const [bx, by] = points[(index + 1) % points.length];
        area += ax * by - bx * ay;
    }
    return area / 2;
}
const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);
function convexHull(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sorted.length < 3)
        return sorted;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
            lower.pop();
        lower.push(point);
    }
    const upper = [];
    for (let index = sorted.length - 1; index >= 0; index--) {
        const point = sorted[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
            upper.pop();
        upper.push(point);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function runsOf(flags, want) {
    const count = flags.length;
    const runs = [];
    const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
    if (start < 0)
        return flags[0] === want ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
    let run = null;
    for (let step = 0; step < count; step++) {
        const index = (start + step) % count;
        if (flags[index] === want) {
            if (!run)
                run = [index];
            run.push((index + 1) % count);
        }
        else if (run) {
            runs.push(run);
            run = null;
        }
    }
    if (run)
        runs.push(run);
    return runs;
}
function extrude(ring, z, height, projection, options = {}) {
    const convex = options.convex ?? true;
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const { sinA, cosA } = cameraOf(projection);
    const normals = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy) || 1;
        return (counter ? [dy / length, -dx / length] : [-dy / length, dx / length]);
    });
    const facing = normals.map(([nx, ny]) => nx * vx + ny * vy > 1e-9);
    const top = ring.map(([x, y]) => iso([x, y, z + height], projection));
    const bottom = ring.map(([x, y]) => iso([x, y, z], projection));
    const outline = [];
    const crease = [];
    for (const run of runsOf(facing, false))
        outline.push(pathOf(run.map((index) => top[index])));
    for (const run of runsOf(facing, true)) {
        crease.push(pathOf(run.map((index) => top[index])));
        if (height > 0)
            outline.push(pathOf(run.map((index) => bottom[index])));
    }
    if (height > 0) {
        for (let index = 0; index < count; index++) {
            if (facing[(index + count - 1) % count] !== facing[index])
                outline.push(pathOf([top[index], bottom[index]]));
        }
    }
    let fill;
    if (convex) {
        fill = pathOf(convexHull([...top, ...bottom]), true);
    }
    else {
        const parts = [pathOf(oriented(top), true), pathOf(oriented(bottom), true)];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const next = (index + 1) % count;
            parts.push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
        fill = parts.join("");
    }
    const buckets = Array.from({ length: SHADES }, () => []);
    if (height > 0) {
        const [lx, ly] = [-sinA, cosA];
        for (let index = 0; index < count; index++) {
            if (!facing[index])
                continue;
            const [nx, ny] = normals[index];
            const lit = (nx * lx + ny * ly + 1) / 2;
            const shade = Math.min(SHADES - 1, Math.max(0, Math.floor(lit * SHADES)));
            const next = (index + 1) % count;
            buckets[shade].push(pathOf(oriented([top[index], top[next], bottom[next], bottom[index]]), true));
        }
    }
    let bevel;
    if (options.bevel && options.bevel > 0) {
        const by = options.bevel;
        const inset = ring.map(([x, y], index) => {
            const [ax, ay] = normals[(index + count - 1) % count];
            const [bx, by2] = normals[index];
            const mx = ax + bx;
            const my = ay + by2;
            const length = Math.hypot(mx, my) || 1;
            return [x - (mx / length) * by, y - (my / length) * by];
        });
        const insetTop = inset.map(([x, y]) => iso([x, y, z + height], projection));
        bevel = runsOf(facing, true)
            .map((run) => pathOf([top[run[0]], ...run.slice(1, -1).map((index) => insetTop[index]), top[run[run.length - 1]]]))
            .join("");
    }
    return {
        fill,
        outline: outline.join(""),
        crease: crease.join(""),
        top: pathOf(oriented(top), true),
        shades: buckets.map((paths) => paths.join("")),
        bevel,
    };
}
const ringOf = (plan, steps = 8) => roundedPlan(plan, steps);
function slabOf(plan, z, height, projection, steps = 8, bevel = 0) {
    return extrude(ringOf(plan, steps), z, height, projection, { convex: true, bevel });
}
function circleRing(cx, cy, radius, steps = 40) {
    return Array.from({ length: steps }, (_, step) => {
        const angle = (step / steps) * Math.PI * 2;
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
}
function cylinder(cx, cy, radius, z, height, projection, steps = 32, bevel = 0) {
    return extrude(circleRing(cx, cy, radius, steps), z, height, projection, { convex: true, bevel });
}
const insetPlan = ({ x, y, w, d, r }, by) => ({ x: x + by, y: y + by, w: w - by * 2, d: d - by * 2, r: Math.max(0, r - by) });
function onTop(points, z, projection, closed = false) {
    return pathOf(points.map(([x, y]) => iso([x, y, z], projection)), closed);
}
const planOutline = (plan, z, projection, steps = 8) => onTop(ringOf(plan, steps), z, projection, true);
const lineOnTop = (from, to, z, projection) => onTop([from, to], z, projection);
const segment = (from, to, projection) => pathOf([iso(from, projection), iso(to, projection)]);
const rise = (at, from, to, projection) => segment([at[0], at[1], from], [at[0], at[1], to], projection);
const ring = (cx, cy, radius, z, projection, steps = 40) => onTop(circleRing(cx, cy, radius, steps), z, projection, true);
const pointsAt = (points, projection) => points.map((point) => iso(point, projection));
function dotGrid(x, y, columns, rows, gap, z, projection) {
    const dots = [];
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++)
            dots.push(iso([x + column * gap, y + row * gap, z], projection));
    }
    return dots;
}
function corners({ x, y, w, d }, inset = 0) {
    return [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + inset, y + d - inset],
        [x + w - inset, y + d - inset],
    ];
}
function boxCorners({ x, y, w, d }, z0, z1) {
    const out = [];
    for (const px of [x, x + w])
        for (const py of [y, y + d])
            for (const z of [z0, z1])
                out.push([px, py, z]);
    return out;
}
function knurl(cx, cy, radius, z0, z1, count, projection, inset = 0.4) {
    const [vx, vy] = towardViewer(projection);
    const lines = [];
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        if (nx * vx + ny * vy < 0.15)
            continue;
        lines.push(segment([cx + radius * nx, cy + radius * ny, z0 + inset], [cx + radius * nx, cy + radius * ny, z1 - inset], projection));
    }
    return lines.join("");
}
function sideArc(cx, cy, radius, z, projection, steps = 24) {
    const [vx, vy] = towardViewer(projection);
    const facing = Math.atan2(vy, vx);
    const points = [];
    for (let step = 0; step <= steps; step++) {
        const angle = facing - Math.PI / 2 + (step / steps) * Math.PI;
        points.push(iso([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), z], projection));
    }
    return pathOf(points);
}
function ringSeam(ring, z, projection) {
    const count = ring.length;
    const counter = signedArea(ring) > 0;
    const [vx, vy] = towardViewer(projection);
    const facing = ring.map(([ax, ay], index) => {
        const [bx, by] = ring[(index + 1) % count];
        const dx = bx - ax;
        const dy = by - ay;
        const [nx, ny] = counter ? [dy, -dx] : [-dy, dx];
        return nx * vx + ny * vy > 1e-9;
    });
    return runsOf(facing, true).map((run) => pathOf(run.map((index) => iso([ring[index][0], ring[index][1], z], projection)))).join("");
}
const sideSeam = (plan, z, projection, steps = 8) => ringSeam(ringOf(plan, steps), z, projection);
function sideRing(center, radius, axis, projection, steps = 20) {
    const [px, py, pz] = center;
    const points = [];
    for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        points.push(iso(axis === "x" ? [px, py + u, pz + v] : [px + u, py, pz + v], projection));
    }
    return pathOf(points, true);
}
function coil(from, to, center, radius, turns, axis, projection, perTurn = 16) {
    const count = Math.max(1, Math.round(turns * perTurn));
    const back = [];
    const front = [];
    let run = [];
    let near = null;
    for (let index = 0; index <= count; index++) {
        const share = index / count;
        const angle = share * turns * Math.PI * 2;
        const u = radius * Math.cos(angle);
        const v = radius * Math.sin(angle);
        const along = from + (to - from) * share;
        const point = axis === "x" ? [along, center[0] + u, center[1] + v] : [center[0] + u, along, center[1] + v];
        const normal = axis === "x" ? [0, Math.cos(angle), Math.sin(angle)] : [Math.cos(angle), 0, Math.sin(angle)];
        const facing = depthOf(normal, projection) > 0;
        const flat = iso(point, projection);
        if (near === null)
            near = facing;
        if (facing !== near) {
            run.push(flat);
            (near ? front : back).push(pathOf(run));
            run = [flat];
            near = facing;
            continue;
        }
        run.push(flat);
    }
    if (run.length > 1)
        (near ? front : back).push(pathOf(run));
    return { back: back.join(""), front: front.join("") };
}
function topTicks(from, to, step, every, edge, z, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, edge] : [edge, at];
        const b = axis === "x" ? [at, edge + length] : [edge + length, at];
        (big ? major : minor).push(lineOnTop(a, b, z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function sideTicks(from, to, step, every, face, top, lengths, projection, axis = "x") {
    const minor = [];
    const major = [];
    const first = Math.ceil(from / step) * step;
    for (let at = first, index = Math.round(first / step); at <= to + 1e-9; at += step, index++) {
        const big = index % every === 0;
        const length = big ? lengths[1] : lengths[0];
        const a = axis === "x" ? [at, face, top] : [face, at, top];
        const b = axis === "x" ? [at, face, top - length] : [face, at, top - length];
        (big ? major : minor).push(segment(a, b, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
function radialTicks(cx, cy, radius, count, every, z, lengths, projection, from = 0, span = Math.PI * 2) {
    const minor = [];
    const major = [];
    const closed = Math.abs(span - Math.PI * 2) < 1e-9;
    const steps = closed ? count : count + 1;
    for (let index = 0; index < steps; index++) {
        const angle = from + (index / count) * span;
        const big = index % every === 0;
        const inner = radius - (big ? lengths[1] : lengths[0]);
        const sx = Math.sin(angle);
        const sy = -Math.cos(angle);
        (big ? major : minor).push(lineOnTop([cx + sx * inner, cy + sy * inner], [cx + sx * radius, cy + sy * radius], z, projection));
    }
    return { minor: minor.join(""), major: major.join("") };
}
const haloOf = (plan, z, height, projection) => slabOf(plan, z, height, projection).fill;
function axisVector(projection, [dx, dy, dz]) {
    const origin = iso([0, 0, 0], projection);
    const moved = iso([dx, dy, dz], projection);
    return [moved[0] - origin[0], moved[1] - origin[1]];
}
const fine = (value) => Math.round(value * 100) / 100;
function translateAlong(projection, by) {
    const [x, y] = axisVector(projection, by);
    return `translate(${fine(x)} ${fine(y)})`;
}
const thousandth = (value) => Math.round(value * 1000) / 1000;
function axesAt(at, z, projection) {
    const origin = iso([at[0], at[1], z], projection);
    const along = (point) => {
        const [px, py] = iso(point, projection);
        return [px - origin[0], py - origin[1]];
    };
    return { origin, x: along([at[0] + 1, at[1], z]), y: along([at[0], at[1] + 1, z]), z: along([at[0], at[1], z + 1]) };
}
const matrixOf = (u, v, origin) => `matrix(${thousandth(u[0])} ${thousandth(u[1])} ${thousandth(v[0])} ${thousandth(v[1])} ${thousandth(origin[0])} ${thousandth(origin[1])})`;
function holdStill(element, [dx, dy]) {
    const text = dx || dy ? `translate(${-dx} ${-dy})` : "";
    element.querySelectorAll("[data-hold]").forEach((node) => (text ? node.setAttribute("transform", text) : node.removeAttribute("transform")));
}
function topMatrix(at, z, projection, along = "x") {
    const { origin, x, y } = axesAt(at, z, projection);
    return along === "x" ? matrixOf(x, y, origin) : matrixOf([-y[0], -y[1]], x, origin);
}
function sideMatrix(at, z, projection, face) {
    const { origin, x, y, z: up } = axesAt(at, z, projection);
    const down = [-up[0], -up[1]];
    return face === "left" ? matrixOf(x, down, origin) : matrixOf([-y[0], -y[1]], down, origin);
}
function screenRise(height, projection) {
    const { cosE, k } = cameraOf(projection);
    return height * cosE * k;
}
function fitProjection(points, width, height, { pad = 24, headroom = 0, azimuth = AZIMUTH, elevation = ELEVATION } = {}) {
    const unit = { origin: [0, 0], scale: 1, azimuth, elevation };
    const flat = points.map((point) => iso(point, unit));
    const xs = flat.map(([x]) => x);
    const ys = flat.map(([, y]) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const up = Math.min(...ys);
    const down = Math.max(...ys);
    const scale = Math.min((width - pad * 2) / (right - left), (height - pad * 2 - headroom) / (down - up));
    return {
        origin: [width / 2 - ((left + right) / 2) * scale, headroom + (height - headroom) / 2 - ((up + down) / 2) * scale],
        scale,
        azimuth,
        elevation,
    };
}
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attrs = (pairs) => Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => ` ${key}="${escape(String(value))}"`)
    .join("");
function solidSvg(paths, { tone = "hi", crease = "faint", halo = false, lit = false, flat = false, className, inner = "" } = {}) {
    const parts = [];
    if (halo)
        parts.push(`<path class="iso-halo" d="${paths.fill}"/>`);
    parts.push(`<path class="iso-fill" d="${paths.fill}"/>`);
    if (!flat) {
        paths.shades.forEach((d, shade) => {
            if (d)
                parts.push(`<path class="iso-shade" data-shade="${shade}" d="${d}"/>`);
        });
        parts.push(`<path class="iso-top" d="${paths.top}"/>`);
    }
    if (crease !== "none" && paths.crease)
        parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${paths.crease}"/>`);
    if (crease !== "none" && paths.bevel)
        parts.push(`<path class="iso-line iso-bevel" data-tone="${crease}" d="${paths.bevel}"/>`);
    if (inner)
        parts.push(inner);
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${paths.outline}"/>`);
    return `<g${attrs({ class: className ? `iso-solid ${className}` : "iso-solid", "data-lit": lit ? "" : undefined, "data-seamless": paths.seamless ? "" : undefined })}>${parts.join("")}</g>`;
}
function lineSvg(d, { tone = "lo", dotted = false, dashed = false, flow = false, className, free } = {}) {
    if (!d)
        return "";
    return `<path${attrs({
        class: className ? `iso-line ${className}` : "iso-line",
        "data-tone": tone,
        "data-free": free === true ? "" : free || undefined,
        "data-dotted": dotted ? "" : undefined,
        "data-dashed": dashed ? "" : undefined,
        "data-flow": flow ? "" : undefined,
        d,
    })}/>`;
}
function dotsSvg(points, { size = 0.5, tone = "mid", pulse = false } = {}) {
    const dots = points
        .map(([x, y, alpha], index) => `<circle cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"${alpha !== undefined && alpha < 1 ? ` fill-opacity="${Math.max(0, alpha).toFixed(2)}"` : ""}${pulse ? ` data-pulse="" style="--pulse-at:${(index * 137) % 1600}ms"` : ""}/>`)
        .join("");
    return `<g class="iso-dots" data-tone="${tone}">${dots}</g>`;
}
function fadedSvg(list, style = {}) {
    const groups = new Map();
    for (const entry of list) {
        const [d, alpha] = Array.isArray(entry) ? entry : [entry.d, entry.alpha];
        if (!d || !(alpha > 0.02))
            continue;
        const level = Math.min(1, Math.round(alpha * 20) / 20);
        groups.set(level, (groups.get(level) ?? "") + d);
    }
    return [...groups].map(([alpha, d]) => (alpha >= 1 ? lineSvg(d, style) : `<g opacity="${alpha.toFixed(2)}">${lineSvg(d, style)}</g>`)).join("");
}
function fadeLineSvg(points, { fade = [0, 0], tone = "lo", className, stops = 6 } = {}) {
    if (points.length < 2)
        return "";
    const ease = (t) => t * t * (3 - 2 * t);
    const hashOf = (text) => {
        let hash = 2166136261;
        for (let index = 0; index < text.length; index++)
            hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        return (hash >>> 0).toString(36);
    };
    const lengths = [0];
    for (let index = 1; index < points.length; index++)
        lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
    const at = (length) => {
        let index = 1;
        while (index < points.length - 1 && lengths[index] < length)
            index++;
        const span = lengths[index] - lengths[index - 1] || 1;
        const t = Math.max(0, Math.min(1, (length - lengths[index - 1]) / span));
        return [points[index - 1][0] + (points[index][0] - points[index - 1][0]) * t, points[index - 1][1] + (points[index][1] - points[index - 1][1]) * t];
    };
    const pieceOf = (from, to) => [at(from), ...points.filter((_, index) => lengths[index] > from + 1e-6 && lengths[index] < to - 1e-6), at(to)];
    const total = lengths[lengths.length - 1];
    if (total < 1e-6)
        return "";
    let [start, end] = Array.isArray(fade) ? fade : [fade, fade];
    if (start + end > total) {
        const share = total / (start + end);
        start *= share;
        end *= share;
    }
    const paint = `var(--anatomy-${tone})`;
    const ramp = (piece, rising) => {
        const d = pathOf(piece);
        const [x1, y1] = piece[0];
        const [x2, y2] = piece[piece.length - 1];
        const id = `iso-fade-${hashOf(`${d}|${tone}|${rising}`)}`;
        const marks = Array.from({ length: stops + 1 }, (_, index) => {
            const t = index / stops;
            const alpha = ease(rising ? t : 1 - t);
            return `<stop offset="${t.toFixed(3)}" stop-opacity="${alpha.toFixed(3)}" style="stop-color:${paint}"/>`;
        }).join("");
        const gradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${tenth(x1)}" y1="${tenth(y1)}" x2="${tenth(x2)}" y2="${tenth(y2)}">${marks}</linearGradient>`;
        return `<defs>${gradient}</defs><path${attrs({ class: className ? `iso-line ${className}` : "iso-line", "data-tone": tone, "data-free": rising ? "start" : "end", d, style: `stroke:url(#${id})` })}/>`;
    };
    const parts = [];
    if (start > 0.05)
        parts.push(ramp(pieceOf(0, start), true));
    if (total - end - start > 0.05)
        parts.push(lineSvg(pathOf(pieceOf(start, total - end)), { tone, className }));
    if (end > 0.05)
        parts.push(ramp(pieceOf(total - end, total), false));
    return `<g class="iso-fade">${parts.join("")}</g>`;
}
function wireSvg(from, to, { via = [], tone = "lo", dotted = false, dashed = false, flow = false, ends = "both", size = 1.2 } = {}) {
    const d = pathOf([from, ...via, to]);
    const end = ([x, y]) => `<circle class="iso-wire-end" cx="${tenth(x)}" cy="${tenth(y)}" r="${size}"/>`;
    return `<g class="iso-wire" data-tone="${tone}">${lineSvg(d, { tone, dotted, dashed, flow })}${ends === "both" || ends === "from" ? end(from) : ""}${ends === "both" || ends === "to" ? end(to) : ""}</g>`;
}
function faceTextSvg(transform, text, { size = 3, tone = "mid", anchor = "start" } = {}) {
    return `<text class="iso-face-text" data-tone="${tone}" transform="${transform}" font-size="${size}" text-anchor="${anchor}">${escape(text)}</text>`;
}
function groupSvg(children, extra = {}) {
    return `<g${attrs(extra)}>${Array.isArray(children) ? children.join("") : children}</g>`;
}
function figureSvg({ width, height, label, body, standalone = false, className }) {
    const style = standalone ? `<style>${ISO_CSS}</style>` : "";
    return `<svg${attrs({
        xmlns: "http://www.w3.org/2000/svg",
        class: `iso-svg${standalone ? " iso" : ""}${className ? ` ${className}` : ""}`,
        "data-theme": standalone || undefined,
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": label,
    })}>${style}${Array.isArray(body) ? body.join("") : body}</svg>`;
}
function swatchSvg(mark) {
    if (mark === "raised" || mark === "flat" || mark === "lit") {
        const body = mark === "flat" ? "M2 6.5 8 3.5 14 6.5 8 9.5Z" : "M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z";
        const crease = mark === "flat" ? "" : `<path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/>`;
        return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="${body}"/>${crease}</svg>`;
    }
    return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
}
function plateHtml({ fig, title, hint, readout = "", keys = [], caption, body }) {
    const corner = (name, text, extra = "") => `<span class="iso-plate-corner" data-corner="${name}"${extra}>${escape(text)}</span>`;
    const legend = keys.length || caption
        ? `<figcaption class="iso-legend">${keys.length ? `<span class="iso-keys">${keys.map((key) => `<span class="iso-key">${swatchSvg(key.mark)}${escape(key.label)}</span>`).join("")}</span>` : ""}${caption ? `<span class="iso-caption">${escape(caption)}</span>` : ""}</figcaption>`
        : "";
    return `<figure class="iso-figure"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true">${corner("fig", fig)}${title ? corner("title", title) : ""}${hint ? corner("hint", hint) : ""}${corner("readout", readout, " data-readout")}</div>${body}</div>${legend}</figure>`;
}
function pageHtml({ title, theme = "dark", body, script = "", width = 650 }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${ISO_CSS}${PAGE_CSS.replace("__WIDTH__", String(width))}</style></head><body class="iso" data-theme="${theme}"><main class="iso-page">${body}</main>${script ? `<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}<\/script>` : ""}</body></html>`;
}
const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:dark}
body[data-theme="light"]{color-scheme:light}
body{margin:0;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(__WIDTH__px,100% - 32px);margin:64px auto 96px}
`;
const ISO_CSS = `
.iso{
  --anatomy-page:#0b0b0b;--anatomy-card:#131313;--anatomy-text:#a3a3a3;--anatomy-strong:#e6e6e6;--anatomy-muted:#6e6e6e;
  --anatomy-paper:#131313;--anatomy-face:#1b1b1b;--anatomy-top:#1c1c1c;
  --anatomy-shade-0:#0f0f0f;--anatomy-shade-1:#121212;--anatomy-shade-2:#151515;--anatomy-shade-3:#181818;
  --anatomy-lit-top:#262626;--anatomy-lit-shade:#1d1d1d;
  --anatomy-hi:#d4d4d4;--anatomy-mid:#6a6a6a;--anatomy-lo:#3e3e3e;--anatomy-faint:#2a2a2a;--anatomy-lit:#ffffff;
  --anatomy-halo:#050505;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;
  --anatomy-red:#ff6b6b;--anatomy-green:#6be0a0;--anatomy-blue:#6b9bff;
  --anatomy-weight:.6px;--anatomy-ease:cubic-bezier(.32,.72,0,1);
  --anatomy-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --anatomy-lift:inset 0 1px 0 0 #ffffff0a,inset 0 0 0 1px #ffffff06,0 0 0 1px #00000026,0 1px 1px -.5px #00000014,0 3px 3px -1.5px #00000014,0 6px 6px -3px #00000014,0 12px 12px -6px #00000014;
}
.iso[data-theme="light"]{
  --anatomy-page:#f2f2ef;--anatomy-card:#fbfbfa;--anatomy-text:#57575a;--anatomy-strong:#18181a;--anatomy-muted:#8c8c90;
  --anatomy-paper:#fbfbfa;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1;
  --anatomy-lit-top:#ffffff;--anatomy-lit-shade:#eeeeeb;
  --anatomy-hi:#26262a;--anatomy-mid:#8a8a8f;--anatomy-lo:#b4b4b8;--anatomy-faint:#d4d4d6;--anatomy-lit:#000000;
  --anatomy-halo:#8a8a80;--anatomy-halo-opacity:.32;--anatomy-dot:#3a3a3e;
  --anatomy-red:#e5484d;--anatomy-green:#30a46c;--anatomy-blue:#3e63dd;
  --anatomy-lift:inset 0 1px 0 0 #ffffff,0 0 0 1px #0000000f,0 1px 1px -.5px #0000000a,0 3px 3px -1.5px #0000000a,0 6px 6px -3px #0000000a,0 12px 12px -6px #0000000a;
}
.iso-svg{display:block;width:100%;height:auto;overflow:visible}
.iso-svg path,.iso-svg circle{vector-effect:non-scaling-stroke}
.iso-fill{fill:var(--anatomy-paper);stroke:none}
.iso-solid[data-lit]>.iso-fill{fill:var(--anatomy-face)}
.iso-shade,.iso-top{stroke:none}
.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-0)}
.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-1)}
.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-2)}
.iso-shade[data-shade="3"]{fill:var(--anatomy-shade-3)}
.iso-top{fill:var(--anatomy-top)}
.iso-solid[data-lit]>.iso-top{fill:var(--anatomy-lit-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--anatomy-lit-shade)}
.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:.4;stroke-linejoin:round}
.iso-solid[data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--anatomy-shade-0)}
.iso-solid[data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--anatomy-shade-1)}
.iso-solid[data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--anatomy-shade-2)}
.iso-solid[data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--anatomy-shade-3)}
.iso-solid[data-seamless]>.iso-top{stroke:var(--anatomy-top)}
.iso-solid[data-seamless][data-lit]>.iso-top{stroke:var(--anatomy-lit-top)}
.iso-solid[data-seamless][data-lit]>.iso-shade{stroke:var(--anatomy-lit-shade)}
.iso-solid[data-lit]>.iso-edge{stroke:var(--anatomy-lit)}
.iso-halo{fill:var(--anatomy-halo);stroke:none;filter:blur(9px);opacity:var(--anatomy-halo-opacity);transform:translateY(3px)}
.iso-line{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);stroke-linecap:round;stroke-linejoin:round}
.iso-line[data-tone="hi"]{stroke:var(--anatomy-hi)}
.iso-line[data-tone="mid"]{stroke:var(--anatomy-mid)}
.iso-line[data-tone="lo"]{stroke:var(--anatomy-lo)}
.iso-line[data-tone="faint"]{stroke:var(--anatomy-faint)}
.iso-line[data-tone="lit"]{stroke:var(--anatomy-lit)}
.iso-line[data-tone="red"]{stroke:var(--anatomy-red)}
.iso-line[data-tone="green"]{stroke:var(--anatomy-green)}
.iso-line[data-tone="blue"]{stroke:var(--anatomy-blue)}
.iso-line[data-dotted]{stroke-dasharray:.01 3.5;stroke-width:1}
.iso-line[data-dashed]{stroke-dasharray:3 3}
.iso-line[data-flow]{stroke-dasharray:2 6}
.iso-wire-end{fill:var(--anatomy-paper);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight)}
.iso-wire[data-tone="hi"] .iso-wire-end{stroke:var(--anatomy-hi)}
.iso-wire[data-tone="mid"] .iso-wire-end{stroke:var(--anatomy-mid)}
.iso-wire[data-tone="faint"] .iso-wire-end{stroke:var(--anatomy-faint)}
.iso-wire[data-tone="lit"] .iso-wire-end{stroke:var(--anatomy-lit)}
.iso-dots circle{fill:var(--anatomy-dot);stroke:none;opacity:.32}
.iso-dots[data-tone="hi"] circle{opacity:.85}
.iso-dots[data-tone="mid"] circle{opacity:.45}
.iso-dots[data-tone="lo"] circle{opacity:.22}
.iso-dots[data-tone="faint"] circle{opacity:.12}
.iso-face-text{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);letter-spacing:.04em}
.iso-face-text[data-tone="hi"]{fill:var(--anatomy-hi)}
.iso-face-text[data-tone="lo"]{fill:var(--anatomy-lo)}
.iso-face-text[data-tone="faint"]{fill:var(--anatomy-faint)}
.tb-body{fill:var(--anatomy-shade-2);stroke:none}
.tb-shine{fill:var(--anatomy-top);stroke:none}
.tb-shade{fill:var(--anatomy-shade-0);stroke:none}
.tb-ring{fill:none;stroke:var(--anatomy-lo);stroke-width:.45;stroke-linecap:butt;stroke-linejoin:round}
.tb-ring[data-tone="mid"]{stroke:var(--anatomy-mid)}
.tb-ring[data-tone="faint"]{stroke:var(--anatomy-faint)}
.tb-ring[data-tone="hi"]{stroke:var(--anatomy-hi)}
@keyframes iso-flow{to{stroke-dashoffset:-32}}
@keyframes iso-pulse{0%,100%{opacity:.18}12%{opacity:1}40%{opacity:.18}}
.iso-line[data-flow]{animation:iso-flow 1600ms linear infinite}
.iso-dots circle[data-pulse]{animation:iso-pulse 1600ms steps(1,end) infinite;animation-delay:var(--pulse-at,0ms)}
.iso-figure{margin:32px 0 36px}
.iso-plate{position:relative;padding:52px 24px;border-radius:0;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-mid);--anatomy-paper:var(--anatomy-card)}
.iso-plate-corners{position:absolute;inset:18px 20px;pointer-events:none}
.iso-plate-corner{position:absolute;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:10.5px;line-height:1;letter-spacing:.04em;white-space:nowrap}
.iso-plate-corner[data-corner="fig"]{top:0;left:0;color:var(--anatomy-text)}
.iso-plate-corner[data-corner="title"]{top:0;right:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="hint"]{bottom:0;left:0;text-transform:uppercase;letter-spacing:.1em}
.iso-plate-corner[data-corner="readout"]{right:0;bottom:0;color:var(--anatomy-text);font-variant-numeric:tabular-nums}
.iso-plate .iso-svg{margin:0 auto}
.iso-legend{display:grid;gap:8px;margin-top:12px;color:var(--anatomy-muted);font-size:13px;line-height:1.55}
.iso-keys{display:flex;flex-wrap:wrap;gap:6px 18px}
.iso-key{display:inline-flex;align-items:center;gap:7px}
.iso-swatch{width:16px;height:10px;flex:none;overflow:visible}
.iso-swatch path{fill:none;stroke:var(--anatomy-hi);stroke-width:1;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.iso-swatch[data-mark="raised"] path,.iso-swatch[data-mark="flat"] path{stroke:var(--anatomy-mid)}
.iso-swatch[data-mark="lit"] path{stroke:var(--anatomy-lit)}
.iso-swatch[data-mark="dim"] path{stroke:var(--anatomy-lo)}
.iso-swatch[data-mark="dotted"] path{stroke-dasharray:.01 3;stroke-width:1.4}
.iso-swatch[data-mark="dashed"] path{stroke-dasharray:3 2.5}
.iso-swatch[data-mark="red"] path{stroke:var(--anatomy-red)}
.iso-swatch[data-mark="green"] path{stroke:var(--anatomy-green)}
.iso-swatch[data-mark="blue"] path{stroke:var(--anatomy-blue)}
.iso-swatch-crease{stroke:var(--anatomy-lo)!important}
@media (max-width:560px){.iso-plate{padding:48px 12px 70px}.iso-plate-corner[data-corner="hint"]{bottom:18px}}
@media (prefers-reduced-motion:reduce){.iso-line[data-flow],.iso-dots circle[data-pulse]{animation:none}}
`;
const G = (() => {

const TAU = Math.PI * 2;
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a) => {
  const length = len3(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function viewOf(P) {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return [cosA * cosE, sinA * cosE, sinE];
}

function lightOf(P) {
  const { sinA, cosA } = cameraOf(P);
  return unit3([-sinA, cosA, LIGHT_UP]);
}

const scaleOf = (P) => cameraOf(P).k;

function bandOf(score) {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
}

const toneOf = (normal, P) => bandOf(dot3(unit3(normal), lightOf(P)));

function frameAlong(o, a) {
  const axis = unit3(a);
  const helper = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3(cross3(helper, axis));
  const v = cross3(axis, u);
  return { o, a: axis, u, v };
}

const frameOf = (o, a, u, v) => ({ o, a, u, v });

function pointOf(F, s, r, angle) {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [
    F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]),
    F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]),
    F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]),
  ];
}

const radialOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [c * F.u[0] + n * F.v[0], c * F.u[1] + n * F.v[1], c * F.u[2] + n * F.v[2]];
};

const tangentOf = (F, angle) => {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [-n * F.u[0] + c * F.v[0], -n * F.u[1] + c * F.v[1], -n * F.u[2] + c * F.v[2]];
};

const angleToward = (F, direction) => Math.atan2(dot3(direction, F.v), dot3(direction, F.u));

function hullTagged(points) {
  const sorted = [...points].sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a.p[0] - o.p[0]) * (b.p[1] - o.p[1]) - (a.p[1] - o.p[1]) * (b.p[0] - o.p[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-9) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-9) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const hullOf = (points) => hullTagged(points.map((p) => ({ p }))).map(({ p }) => p);

function runsOf(flags) {
  const count = flags.length;
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count]);
  if (start < 0) return flags[0] ? [Array.from({ length: count + 1 }, (_, index) => index % count)] : [];
  const runs = [];
  let run = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    if (flags[index]) {
      if (!run) run = [index];
      run.push((index + 1) % count);
    } else if (run) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  return runs;
}

function groupsOf(keys) {
  const count = keys.length;
  const out = [];
  const start = keys.findIndex((key, index) => key !== keys[(index + count - 1) % count]);
  if (start < 0) {
    if (keys[0] !== null) out.push({ key: keys[0], run: Array.from({ length: count + 1 }, (_, index) => index % count) });
    return out;
  }
  let current = null;
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const key = keys[index];
    if (current && current.key === key) {
      current.run.push((index + 1) % count);
      continue;
    }
    if (current && current.key !== null) out.push(current);
    current = { key, run: [index, (index + 1) % count] };
  }
  if (current && current.key !== null) out.push(current);
  return out;
}

const stepsFor = (radius, least = 16, most = 112, scale = 0) => Math.max(least, Math.min(most, scale ? Math.ceil((TAU * radius * scale) / 3) : Math.round((radius * 1.3) / 4) * 4));

function chains(edges) {
  const out = [];
  let current = null;
  for (const [a, b, keep] of edges) {
    if (!keep) {
      if (current) out.push(current);
      current = null;
      continue;
    }
    if (!current) current = [a];
    current.push(b);
  }
  if (current) out.push(current);
  if (out.length > 1 && edges[0][2] && edges[edges.length - 1][2]) {
    const last = out.pop();
    out[0] = [...last, ...out[0].slice(1)];
  }
  return out;
}

function labelledArcs(nr, na, view, light, gr = nr, ga = na) {
  const cuts = [];
  if (Math.abs(gr) > 1e-9) {
    const visibleCut = -(ga * view.a) / (gr * view.flat);
    if (visibleCut > -1 && visibleCut < 1) {
      const d = Math.acos(visibleCut);
      cuts.push(view.phi - d, view.phi + d);
    }
  }
  if (Math.abs(nr) > 1e-9) {
    for (const threshold of BANDS) {
      const c = (threshold - na * light.a) / (nr * light.flat);
      if (c > -1 && c < 1) {
        const d = Math.acos(c);
        cuts.push(light.phi - d, light.phi + d);
      }
    }
  }
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const sorted = [...new Set(cuts.map((angle) => Math.round(wrap(angle) * 1e9) / 1e9))].sort((a, b) => a - b);
  const label = (angle) => {
    const facing = gr * view.flat * Math.cos(angle - view.phi) + ga * view.a;
    if (facing <= 1e-9) return -1;
    return bandOf(nr * light.flat * Math.cos(angle - light.phi) + na * light.a);
  };
  if (!sorted.length) {
    const tone = label(0);
    return tone < 0 ? [] : [{ tone, from: 0, to: TAU, full: true }];
  }
  const arcs = sorted.map((from, index) => {
    const to = index + 1 < sorted.length ? sorted[index + 1] : sorted[0] + TAU;
    return { tone: label((from + to) / 2), from, to };
  });
  const merged = [];
  for (const arc of arcs) {
    const last = merged[merged.length - 1];
    if (last && last.tone === arc.tone && Math.abs(last.to - arc.from) < 1e-9) last.to = arc.to;
    else merged.push({ ...arc });
  }
  if (merged.length > 1 && merged[0].tone === merged[merged.length - 1].tone && Math.abs(merged[merged.length - 1].to - TAU - merged[0].from) < 1e-9) {
    const last = merged.pop();
    merged[0].from = last.from - TAU;
  }
  return merged.filter((arc) => arc.tone >= 0);
}

function hermiteSlopes(run) {
  const n = run.length - 1;
  const h = Array.from({ length: n }, (_, j) => run[j + 1][0] - run[j][0]);
  const delta = h.map((value, j) => (run[j + 1][1] - run[j][1]) / value);
  const d = new Array(n + 1).fill(0);
  const end = (h0, h1, d0, d1) => {
    let value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(value) !== Math.sign(d0)) value = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > Math.abs(3 * d0)) value = 3 * d0;
    return value;
  };
  if (n === 1) d[0] = d[1] = delta[0];
  else {
    d[0] = end(h[0], h[1], delta[0], delta[1]);
    d[n] = end(h[n - 1], h[n - 2], delta[n - 1], delta[n - 2]);
  }
  for (let k = 1; k < n; k++) {
    if (delta[k - 1] * delta[k] <= 0) continue;
    const w1 = 2 * h[k] + h[k - 1];
    const w2 = h[k] + 2 * h[k - 1];
    d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
  }
  return d;
}

function curveRuns(meridian) {
  const m = meridian.length;
  const segments = new Array(m - 1).fill(null);
  let start = 0;
  while (start < m - 1) {
    let end = start + 1;
    while (end < m - 1 && meridian[end][2] && Math.abs(meridian[end + 1][0] - meridian[end][0]) > 1e-9 && Math.abs(meridian[end][0] - meridian[end - 1][0]) > 1e-9) end++;
    const run = meridian.slice(start, end + 1);
    const n = run.length - 1;
    if (n >= 2 && run.every((point, j) => j === 0 || Math.abs(point[0] - run[j - 1][0]) > 1e-9)) {
      const d = hermiteSlopes(run);
      for (let j = 0; j < n; j++) {
        const [s0, r0] = run[j];
        const [s1, r1] = run[j + 1];
        const hj = s1 - s0;
        const d0 = d[j];
        const d1 = d[j + 1];
        const radius = (s) => {
          const t = (s - s0) / hj;
          return (2 * t ** 3 - 3 * t ** 2 + 1) * r0 + (t ** 3 - 2 * t ** 2 + t) * hj * d0 + (-2 * t ** 3 + 3 * t ** 2) * r1 + (t ** 3 - t ** 2) * hj * d1;
        };
        const slope = (s) => {
          const t = (s - s0) / hj;
          return ((6 * t ** 2 - 6 * t) * r0 + (6 * t - 6 * t ** 2) * r1) / hj + (3 * t ** 2 - 4 * t + 1) * d0 + (3 * t ** 2 - 2 * t) * d1;
        };
        segments[start + j] = { radius, slope };
      }
    }
    start = end;
  }
  return segments;
}

function curved(meridian, P, segments, { error = 0.2, depth = 6 } = {}) {
  const k = scaleOf(P);
  const out = [meridian[0]];
  for (let i = 0; i < meridian.length - 1; i++) {
    const curve = segments[i];
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    if (curve) {
      const split = (a, b, level) => {
        const mid = (a + b) / 2;
        const chord = (curve.radius(a) + curve.radius(b)) / 2;
        if (level < depth && Math.abs(curve.radius(mid) - chord) * k > error) {
          split(a, mid, level + 1);
          out.push([mid, curve.radius(mid), 1]);
          split(mid, b, level + 1);
        }
      };
      split(s0, s1, 0);
    }
    out.push(meridian[i + 1]);
  }
  return out;
}

function smoothRows(meridian, F, P, { rows = 6, slope = null, radius = null, steps = 48, error = 0.35, depth: deepest = 8, fineness = 0.1 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const view = { a: dot3(F.a, V), flat: Math.hypot(dot3(F.u, V), dot3(F.v, V)), phi: Math.atan2(dot3(F.v, V), dot3(F.u, V)) };
  const light = { a: dot3(F.a, L), flat: Math.hypot(dot3(F.u, L), dot3(F.v, L)), phi: Math.atan2(dot3(F.v, L), dot3(F.u, L)) };
  const m = meridian.length;
  const faces = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr) || 1;
    faces.push([ds / length, -dr / length]);
  }
  const splines = slope ? null : curveRuns(meridian);
  const vertexNormal = (k, own) => {
    if (k <= 0 || k >= m - 1 || !meridian[k][2]) return own;
    const a = faces[k - 1];
    const b = faces[k];
    const x = a[0] + b[0];
    const y = a[1] + b[1];
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const normalAt = (i, u) => {
    const [s0] = meridian[i];
    const [s1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    const sign = Math.sign(s1 - s0) || 1;
    const g = slope ? slope(s) : splines[i] ? splines[i].slope(s) : null;
    if (g !== null) {
      const length = Math.hypot(1, g);
      return [sign / length, (-sign * g) / length];
    }
    const a = vertexNormal(i, faces[i]);
    const b = vertexNormal(i + 1, faces[i]);
    const x = a[0] + (b[0] - a[0]) * u;
    const y = a[1] + (b[1] - a[1]) * u;
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const pointAt = (i, u, angle) => {
    const [s0, r0] = meridian[i];
    const [s1, r1] = meridian[i + 1];
    const s = s0 + (s1 - s0) * u;
    return iso(pointOf(F, s, radius ? radius(s) : splines && splines[i] ? splines[i].radius(s) : r0 + (r1 - r0) * u, angle), P);
  };
  const buckets = [[], [], [], [], []];
  const fine = TAU / Math.max(24, Math.min(192, steps * 1.5));
  const arcPoints = (i, u, from, to) => {
    const count = Math.max(1, Math.ceil((to - from) / fine));
    return Array.from({ length: count + 1 }, (_, index) => pointAt(i, u, from + ((to - from) * index) / count));
  };
  const centreOf = (arc, reference) => {
    let mid = (arc.from + arc.to) / 2 - reference;
    mid = ((mid % TAU) + TAU) % TAU;
    return mid;
  };
  const levelOf = (i, u) => {
    const [nr, na] = normalAt(i, u);
    const groups = new Map();
    for (const arc of labelledArcs(nr, na, view, light, faces[i][0], faces[i][1])) {
      if (!groups.has(arc.tone)) groups.set(arc.tone, []);
      groups.get(arc.tone).push(arc);
    }
    for (const list of groups.values()) list.sort((x, y) => centreOf(x, light.phi) - centreOf(y, light.phi));
    return { i, u, groups };
  };
  const same = (x, y) => {
    if (x.groups.size !== y.groups.size) return false;
    for (const [tone, list] of x.groups) if ((y.groups.get(tone) ?? []).length !== list.length) return false;
    return true;
  };
  const align = (reference, arc) => {
    const out = { ...arc };
    const centre = (reference.from + reference.to) / 2;
    while ((out.from + out.to) / 2 - centre > Math.PI) {
      out.from -= TAU;
      out.to -= TAU;
    }
    while (centre - (out.from + out.to) / 2 > Math.PI) {
      out.from += TAU;
      out.to += TAU;
    }
    return out;
  };
  const strayOf = (i, a, mid, b) => {
    let worst = 0;
    for (const [tone, list] of mid.groups) {
      list.forEach((arc, index) => {
        const lo = align(arc, a.groups.get(tone)[index]);
        const hi = align(arc, b.groups.get(tone)[index]);
        for (const key of ["from", "to"]) {
          const p = pointAt(i, mid.u, arc[key]);
          const p0 = pointAt(i, a.u, lo[key]);
          const p1 = pointAt(i, b.u, hi[key]);
          worst = Math.max(worst, Math.hypot(p[0] - (p0[0] + p1[0]) / 2, p[1] - (p0[1] + p1[1]) / 2));
        }
      });
    }
    return worst;
  };
  const sheet = (tone, levels) => {
    levels[0].groups.get(tone).forEach((arc, index) => {
      const chain = [arc];
      for (let k = 1; k < levels.length; k++) chain.push(align(chain[k - 1], levels[k].groups.get(tone)[index]));
      const last = levels.length - 1;
      const points = [...arcPoints(levels[0].i, levels[0].u, chain[0].from, chain[0].to)];
      for (let k = 1; k < last; k++) points.push(pointAt(levels[k].i, levels[k].u, chain[k].to));
      points.push(...arcPoints(levels[last].i, levels[last].u, chain[last].from, chain[last].to).reverse());
      for (let k = last - 1; k >= 1; k--) points.push(pointAt(levels[k].i, levels[k].u, chain[k].from));
      buckets[tone].push(pathOf(oriented(points), true));
    });
  };
  const overlap = (x, y) => Math.min(x.to, y.to) - Math.max(x.from, y.from);
  const strip = (tone, a, b) => {
    const below = a.groups.get(tone) ?? [];
    const above = (b.groups.get(tone) ?? []).map((arc) => ({ arc, used: false }));
    const quad = (lo, hi) => {
      const points = [...arcPoints(a.i, a.u, lo.from, lo.to), ...arcPoints(b.i, b.u, hi.from, hi.to).reverse()];
      buckets[tone].push(pathOf(oriented(points), true));
    };
    for (const arc of below) {
      let best = null;
      let score = -Infinity;
      for (const entry of above) {
        if (entry.used) continue;
        const aligned = align(arc, entry.arc);
        const value = overlap(arc, aligned);
        if (value > score) (score = value), (best = entry);
      }
      if (best && score > -0.05) {
        best.used = true;
        quad(arc, align(arc, best.arc));
      } else {
        const centre = (arc.from + arc.to) / 2;
        quad(arc, { from: centre, to: centre });
      }
    }
    for (const entry of above) {
      if (entry.used) continue;
      const centre = (entry.arc.from + entry.arc.to) / 2;
      quad({ from: centre, to: centre }, entry.arc);
    }
  };
  const k = scaleOf(P);
  let run = [];
  const flush = () => {
    const tones = [...new Set(run.flatMap((level) => [...level.groups.keys()]))].sort((x, y) => x - y);
    for (const tone of tones) {
      const countOf = (level) => (level.groups.get(tone) ?? []).length;
      let start = 0;
      for (let at = 1; at <= run.length; at++) {
        if (at < run.length && countOf(run[at - 1]) === countOf(run[at])) continue;
        if (at - 1 > start && countOf(run[start])) sheet(tone, run.slice(start, at));
        if (at < run.length) strip(tone, run[at - 1], run[at]);
        start = at;
      }
    }
    run = [];
  };
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    if (Math.abs(ds) < 1e-9) {
      flush();
      continue;
    }
    const count = Math.max(1, rows);
    const reach = (Math.hypot(ds, meridian[i + 1][1] - meridian[i][1]) * k) / count;
    const limit = Math.max(1, Math.min(deepest, Math.ceil(Math.log2(Math.max(2, reach / fineness)))));
    const coarse = Array.from({ length: count + 1 }, (_, index) => levelOf(i, index / count));
    run.push(coarse[0]);
    const refine = (a, b, depth) => {
      const mid = levelOf(i, (a.u + b.u) / 2);
      const split = depth < limit && (!same(a, b) || !same(a, mid) || (depth < 6 && strayOf(i, a, mid, b) > error));
      if (!split) {
        run.push(b);
        return;
      }
      refine(a, mid, depth + 1);
      refine(mid, b, depth + 1);
    };
    for (let index = 1; index <= count; index++) refine(coarse[index - 1], coarse[index], 0);
  }
  flush();
  return buckets;
}

function sideOf(meridian) {
  const m = meridian.length;
  let first = 0;
  let last = m - 1;
  if (meridian[0][1] <= 1e-9) first = 1;
  if (meridian[m - 1][1] <= 1e-9) last = m - 2;
  const side = meridian.slice(first, last + 1);
  for (let index = 1; index < side.length; index++) if (side[index][0] - side[index - 1][0] <= 1e-9) return null;
  return side.length >= 3 ? side : null;
}

function surfaceOf(side, F, P, rims, { samples = 96, slope = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const facing = Math.atan2(dot3(F.v, V), dot3(F.u, V));
  const [left, right] = silhouettePoints(side, F, P, { samples, slope });
  if (left.length <= samples || right.length <= samples) return null;
  const s0 = side[0][0];
  const s1 = side[side.length - 1][0];
  const angleOf = (point) => angleToward(F, sub3(point, add3(F.o, mul3(F.a, dot3(sub3(point, F.o), F.a)))));
  const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
  const arc = (s, r, from, to, through) => {
    let sweep = wrap(to - from);
    if (wrap(through - from) > sweep) sweep -= TAU;
    const count = Math.max(4, Math.ceil(Math.abs(sweep) / (TAU / 96)), Math.ceil((Math.abs(sweep) * r * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, index) => iso(pointOf(F, s, r, from + (sweep * index) / count), P));
  };
  const r0 = side[0][1];
  const r1 = side[side.length - 1][1];
  const bottom = -aV > 0 ? facing + Math.PI : facing;
  const top = aV > 0 ? facing + Math.PI : facing;
  const L = left.map((point) => iso(point, P));
  const R = right.map((point) => iso(point, P));
  const topArc = arc(s1, r1, angleOf(left[left.length - 1]), angleOf(right[right.length - 1]), top);
  const bottomArc = arc(s0, r0, angleOf(right[0]), angleOf(left[0]), bottom);
  const keepFirst = rims === "all" || rims === "first" || rims === "ends";
  const keepLast = rims === "all" || rims === "last" || rims === "ends";
  const fill = pathOf([...L, ...topArc, ...[...R].reverse(), ...bottomArc], true);
  const outline = [pathOf(L), pathOf(R), keepLast ? pathOf(topArc) : "", keepFirst ? pathOf(bottomArc) : ""].join("");
  const hull = hullOf([...arc(s0, r0, 0, TAU - 1e-6, Math.PI), ...arc(s1, r1, 0, TAU - 1e-6, Math.PI), ...L, ...R]);
  let gap = 0;
  for (const p of [...L, ...R]) {
    let best = Infinity;
    for (let index = 0; index < hull.length; index++) {
      const a = hull[index];
      const b = hull[(index + 1) % hull.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t));
    }
    gap = Math.max(gap, best);
  }
  return { fill, outline, gap };
}

const softOf = (meridian) => meridian.some((point) => Boolean(point[2]));

function lathe(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, bevel = 0, rims = "all", smooth: asked = "auto", waist = 0.5 } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const V = viewOf(P);
  const L = lightOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const aL = dot3(F.a, L);
  const uL = dot3(F.u, L);
  const vL = dot3(F.v, L);
  const n = steps;
  const m = meridian.length;
  const rings = meridian.map(([s, r]) => Array.from({ length: n }, (_, j) => iso(pointOf(F, s, r, (j / n) * TAU), P)));
  const midC = [];
  const midS = [];
  for (let j = 0; j < n; j++) {
    const t = ((j + 0.5) / n) * TAU;
    midC.push(Math.cos(t));
    midS.push(Math.sin(t));
  }
  const seen = [];
  const tones = [];
  for (let i = 0; i < m - 1; i++) {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    const length = Math.hypot(ds, dr);
    const row = [];
    const toneRow = [];
    for (let j = 0; j < n; j++) {
      if (length < 1e-9) {
        row.push(false);
        toneRow.push(0);
        continue;
      }
      const facing = ds * (midC[j] * uV + midS[j] * vV) - dr * aV;
      const lit = (ds * (midC[j] * uL + midS[j] * vL) - dr * aL) / length;
      row.push(facing > 1e-6 * length);
      toneRow.push(bandOf(lit));
    }
    seen.push(row);
    tones.push(toneRow);
  }
  const buckets = [[], [], [], [], []];
  const all = [];
  const smoothed = smooth ? smoothRows(meridian, F, P, { steps, ...(smooth === true ? {} : smooth) }) : null;
  if (smoothed) smoothed.forEach((list, tone) => list.forEach((d) => (buckets[tone].push(d), all.push(d))));
  for (let i = 0; i < m - 1; i++) {
    if (smoothed && Math.abs(meridian[i + 1][0] - meridian[i][0]) > 1e-9) continue;
    const keys = seen[i].map((visible, j) => (visible ? tones[i][j] : null));
    for (const { key, run } of groupsOf(keys)) {
      const a = run.map((j) => rings[i][j]);
      const b = run.map((j) => rings[i + 1][j]).reverse();
      const d = pathOf(oriented([...a, ...b]), true);
      buckets[key].push(d);
      all.push(d);
    }
  }
  const phi = Math.atan2(vV, uV);
  const flatV = Math.hypot(uV, vV);
  const rangeOf = (i) => {
    const ds = meridian[i + 1][0] - meridian[i][0];
    const dr = meridian[i + 1][1] - meridian[i][1];
    if (Math.hypot(ds, dr) < 1e-9) return null;
    if (Math.abs(ds) < 1e-9 || flatV < 1e-9) return -dr * aV > 1e-9 ? [-1, 1] : null;
    const c = (dr * aV) / (ds * flatV);
    return ds > 0 ? [Math.max(-1, c), 1] : [-1, Math.min(1, c)];
  };
  const arcsOf = (ranges) => {
    if (ranges.some((range) => !range)) return [];
    const lo = Math.max(...ranges.map(([x]) => x));
    const hi = Math.min(...ranges.map(([, x]) => x));
    if (lo >= hi - 1e-9) return [];
    const near = Math.acos(Math.min(1, hi));
    const far = Math.acos(Math.max(-1, lo));
    if (hi >= 1 && lo <= -1) return [[phi, phi + TAU]];
    if (hi >= 1) return [[phi - far, phi + far]];
    if (lo <= -1) return [[phi + near, phi + TAU - near]];
    return [[phi + near, phi + far], [phi - far, phi - near]];
  };
  const along = (s, r, [from, to]) => {
    const count = Math.max(2, Math.ceil(((to - from) * Math.max(r, 1e-6) * scaleOf(P)) / 1.5));
    return Array.from({ length: count + 1 }, (_, j) => iso(pointOf(F, s, r, from + ((to - from) * j) / count), P));
  };
  const creases = [];
  for (let i = 1; i < m - 1; i++) {
    if (meridian[i][2] || meridian[i][1] <= 1e-9) continue;
    for (const arc of arcsOf([rangeOf(i - 1), rangeOf(i)])) creases.push(pathOf(along(meridian[i][0], meridian[i][1], arc)));
  }
  let bevelPath = "";
  if (bevel > 0 && m > 2) {
    const ends = [];
    if (meridian[0][1] <= 1e-9) ends.push([0, 1, 1]);
    if (meridian[m - 1][1] <= 1e-9) ends.push([m - 2, m - 2, m - 3]);
    for (const [cap, rim, side] of ends) {
      const [s, r] = meridian[rim];
      for (const arc of arcsOf([rangeOf(cap), rangeOf(side)])) {
        const inset = along(s, Math.max(0, r - bevel), arc);
        const edge = along(s, r, arc);
        bevelPath += pathOf([edge[0], ...inset.slice(1, -1), edge[edge.length - 1]]);
      }
    }
  }
  const { fill: fillPath, outline } = outlineOf(meridian, F, P, { steps: n, fill, hole, rims, smooth, waist, all });
  return {
    fill: fillPath,
    outline,
    crease: creases.join(""),
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    bevel: bevelPath || undefined,
    seamless: Boolean(smoothed),
  };
}

function shapeOf(meridian, P, smooth) {
  if (smooth && smooth.radius) {
    const segments = meridian.slice(0, -1).map(([s0], index) => (Math.abs(meridian[index + 1][0] - s0) > 1e-9 ? { radius: smooth.radius, slope: smooth.slope } : null));
    return curved(meridian, P, segments);
  }
  const curves = smooth && !smooth.slope ? curveRuns(meridian) : null;
  return curves && curves.some(Boolean) ? curved(meridian, P, curves) : meridian;
}

function outlineOf(meridian, F, P, { steps = stepsFor(Math.max(...meridian.map(([, r]) => r)), 32, 160, scaleOf(P)), fill = "auto", hole = null, rims = "all", smooth: asked = "auto", waist = 0.5, all = null } = {}) {
  const smooth = asked === "auto" ? softOf(meridian) : asked;
  const n = steps;
  let fillPath;
  let outline;
  const shape = shapeOf(meridian, P, smooth);
  const side = fill === "auto" || fill === "surface" ? sideOf(shape) : null;
  const surface = side && !hole ? surfaceOf(side, F, P, rims, { slope: smooth && smooth.slope ? smooth.slope : null }) : null;
  if (surface && (fill === "surface" || surface.gap > waist)) {
    fillPath = surface.fill;
    outline = surface.outline;
  } else if (fill === "hull" || fill === "auto" || fill === "surface") {
    const most = Math.max(...shape.map(([, r]) => r));
    const around = Math.min(320, Math.max(n, Math.ceil((TAU * most * scaleOf(P)) / 1.5)));
    const tagged = [];
    shape.forEach(([s, r], index) => {
      for (let j = 0; j < around; j++) tagged.push({ p: iso(pointOf(F, s, r, (j / around) * TAU), P), ring: index });
    });
    const hull = hullTagged(tagged);
    const holePath = hole ? pathOf(Array.from({ length: around }, (_, j) => iso(pointOf(F, hole[0], hole[1], (j / around) * TAU), P)), true) : "";
    fillPath = pathOf(hull.map(({ p }) => p), true) + holePath;
    if (rims === "all") {
      outline = pathOf(hull.map(({ p }) => p), true) + holePath;
    } else {
      const keepFirst = rims === "first" || rims === "ends";
      const keepLast = rims === "last" || rims === "ends";
      const edges = hull.map((a, index) => {
        const b = hull[(index + 1) % hull.length];
        const same = a.ring === b.ring;
        const keep = !same || (a.ring !== 0 && a.ring !== shape.length - 1) || (keepFirst && a.ring === 0) || (keepLast && a.ring === shape.length - 1);
        return [a.p, b.p, keep];
      });
      outline = chains(edges).map((points) => pathOf(points)).join("") + holePath;
    }
  } else {
    fillPath = all ? all.join("") : (({ shades, top }) => [...shades, top].join(""))(lathe(meridian, F, P, { steps: n, fill: "auto", hole, rims, smooth, waist }));
    outline = "";
  }
  return { fill: fillPath, outline };
}

const signedArea = (points) => points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);

const oriented = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);

const saddleStart = (R, a, angle) => Math.sqrt(Math.max(0, R * R - a * a * Math.cos(angle) ** 2));

function saddleOf(F, a, start, s1, P, { steps = stepsFor(a, 24) } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const n = steps;
  const angle = (j) => (j / n) * TAU;
  const from = typeof start === "function" ? start : (t) => saddleStart(start, a, t);
  const low = Array.from({ length: n }, (_, j) => iso(pointOf(F, from(angle(j)), a, angle(j)), P));
  const high = Array.from({ length: n }, (_, j) => iso(pointOf(F, s1, a, angle(j)), P));
  const seen = [];
  const tones = [];
  for (let j = 0; j < n; j++) {
    const normal = radialOf(F, angle(j + 0.5));
    seen.push(dot3(normal, V) > 1e-6);
    tones.push(bandOf(dot3(normal, L)));
  }
  const buckets = [[], [], [], [], []];
  const fills = [];
  const keys = seen.map((visible, j) => (visible ? tones[j] : null));
  for (const { key, run } of groupsOf(keys)) {
    const d = pathOf(oriented([...run.map((j) => low[j]), ...run.map((j) => high[j]).reverse()]), true);
    buckets[key].push(d);
    fills.push(d);
  }
  const capSeen = dot3(F.a, V) > 1e-6;
  if (capSeen) {
    const d = pathOf(oriented(high), true);
    buckets[bandOf(dot3(F.a, L))].push(d);
    fills.push(d);
  }
  const front = runsOf(seen);
  const back = runsOf(seen.map((visible) => !visible));
  const edges = [];
  for (const run of front) {
    edges.push(pathOf(run.map((j) => low[j])));
    edges.push(pathOf([low[run[0]], high[run[0]]]), pathOf([low[run[run.length - 1]], high[run[run.length - 1]]]));
  }
  for (const run of capSeen ? back : front) edges.push(pathOf(run.map((j) => high[j])));
  return {
    fill: fills.join(""),
    outline: edges.join(""),
    crease: capSeen ? front.map((run) => pathOf(run.map((j) => high[j]))).join("") : "",
    top: buckets[4].join(""),
    shades: buckets.slice(0, 4).map((list) => list.join("")),
    seamless: true,
  };
}

function prismOf(F, polygon, s0, s1, P) {
  const V = viewOf(P);
  const L = lightOf(P);
  const ring = oriented(polygon.map(([x, y]) => [x, y]));
  const n = ring.length;
  const at = (s, [x, y]) => [F.o[0] + F.a[0] * s + F.u[0] * x + F.v[0] * y, F.o[1] + F.a[1] * s + F.u[1] * x + F.v[1] * y, F.o[2] + F.a[2] * s + F.u[2] * x + F.v[2] * y];
  const low = ring.map((point) => iso(at(s0, point), P));
  const high = ring.map((point) => iso(at(s1, point), P));
  const buckets = [[], [], [], [], []];
  const seen = [];
  for (let j = 0; j < n; j++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[(j + 1) % n];
    const normal = unit3(add3(mul3(F.u, y1 - y0), mul3(F.v, -(x1 - x0))));
    const visible = dot3(normal, V) > 1e-6;
    seen.push(visible);
    if (visible) buckets[bandOf(dot3(normal, L))].push(pathOf([low[j], low[(j + 1) % n], high[(j + 1) % n], high[j]], true));
  }
  const ends = [[s0, low, mul3(F.a, -1)], [s1, high, F.a]];
  const capSeen = ends.map(([, , normal]) => dot3(normal, V) > 1e-6);
  ends.forEach(([, points, normal], index) => capSeen[index] && buckets[bandOf(dot3(normal, L))].push(pathOf(points, true)));
  const hull = hullOf([...low, ...high]);
  const creases = [];
  for (let j = 0; j < n; j++) {
    const prev = (j - 1 + n) % n;
    const a = [ring[j][0] - ring[prev][0], ring[j][1] - ring[prev][1]];
    const b = [ring[(j + 1) % n][0] - ring[j][0], ring[(j + 1) % n][1] - ring[j][1]];
    const sharp = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]) || 1) < Math.cos(0.35);
    if (sharp && seen[j] && seen[prev]) creases.push(pathOf([low[j], high[j]]));
    ends.forEach(([, points], index) => capSeen[index] && seen[j] && creases.push(pathOf([points[j], points[(j + 1) % n]])));
  }
  return { fill: pathOf(hull, true), outline: pathOf(hull, true), crease: creases.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

function stadium(r0, r1, offset, steps = 32) {
  const circle = (cx, r) => Array.from({ length: steps }, (_, index) => [cx + r * Math.cos((index / steps) * TAU), r * Math.sin((index / steps) * TAU)]);
  return hullOf([...circle(0, r0), ...circle(offset, r1)]);
}

function sphereOf(centre, r, P, { steps = 48 } = {}) {
  const V = viewOf(P);
  const L = lightOf(P);
  const F = frameAlong(centre, V);
  const flat = (p) => iso(p, P);
  const rim = Array.from({ length: steps }, (_, index) => pointOf(F, 0, r, (index / steps) * TAU));
  const outline = pathOf(rim.map(flat), true);
  const capOf = (threshold) => {
    const points = rim.filter((p) => dot3(sub3(p, centre), L) / r >= threshold).map(flat);
    const c = dot3(L, V);
    const LF = frameAlong(add3(centre, mul3(L, r * threshold)), L);
    const radius = r * Math.sqrt(Math.max(0, 1 - threshold * threshold));
    for (let index = 0; index < steps; index++) {
      const p = pointOf(LF, 0, radius, (index / steps) * TAU);
      if (dot3(sub3(p, centre), V) >= -1e-9) points.push(flat(p));
    }
    if (c > threshold) points.push(flat(add3(centre, mul3(V, r))));
    return points.length > 2 ? pathOf(hullOf(points), true) : "";
  };
  const shades = [outline, capOf(BANDS[1]), capOf(BANDS[2]), capOf(BANDS[3])];
  return { fill: outline, outline, crease: "", top: "", shades, seamless: true };
}

const disc = (s0, s1, r, F, P, options = {}) =>
  lathe(
    [
      [s0, 0],
      [s0, r],
      [s1, r],
      [s1, 0],
    ],
    F,
    P,
    { steps: stepsFor(r, 32, 160, scaleOf(P)), ...options },
  );

const ringBand = (s0, s1, rIn, rOut, F, P, options = {}) =>
  lathe(
    [
      [s0, rIn],
      [s0, rOut],
      [s1, rOut],
      [s1, rIn],
    ],
    F,
    P,
    { steps: stepsFor(rOut, 32, 160, scaleOf(P)), hole: null, ...options },
  );

function solidOf(profile, F, P, options = {}) {
  const first = profile[0];
  const last = profile[profile.length - 1];
  const meridian = [[first[0], 0], ...profile, [last[0], 0]];
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(meridian, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function bandOfProfile(profile, F, P, options = {}) {
  const most = Math.max(...profile.map(([, r]) => r));
  return lathe(profile, F, P, { steps: stepsFor(most, 32, 160, scaleOf(P)), ...options });
}

function silhouettePoints(profile, F, P, { samples = 72, slope: given = null, radius = null } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const facing = Math.atan2(vV, uV);
  const flat = Math.hypot(uV, vV) || 1e-9;
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const radiusAt = radius ?? ((s) => {
    let index = 1;
    while (index < profile.length - 1 && profile[index][0] < s) index++;
    const [sa, ra] = profile[index - 1];
    const [sb, rb] = profile[index];
    return ra + ((rb - ra) * (s - sa)) / (sb - sa || 1);
  });
  const side = (sign) => {
    const points = [];
    for (let step = 0; step <= samples; step++) {
      const s = s0 + ((s1 - s0) * step) / samples;
      const h = (s1 - s0) / samples / 2 || 0.01;
      const slope = given ? given(s) : (radiusAt(Math.min(s1, s + h)) - radiusAt(Math.max(s0, s - h))) / (Math.min(s1, s + h) - Math.max(s0, s - h) || 1);
      const c = (slope * aV) / flat;
      if (Math.abs(c) > 1) continue;
      points.push(pointOf(F, s, radiusAt(s), facing + sign * Math.acos(c)));
    }
    return points;
  };
  return [side(1), side(-1)];
}

const silhouetteOf = (profile, F, P, options = {}) =>
  silhouettePoints(profile, F, P, options)
    .map((points) => pathOf(points.map((point) => iso(point, P))))
    .join("");

function profileCurve(profile, { slope = null, radius = null } = {}) {
  for (let index = 1; index < profile.length; index++) if (profile[index][0] - profile[index - 1][0] <= 1e-9) throw new Error(`profileCurve: s must rise along the profile (point ${index} at s = ${profile[index][0]})`);
  const segments = curveRuns(profile);
  const s0 = profile[0][0];
  const s1 = profile[profile.length - 1][0];
  const find = (s) => {
    let lo = 0;
    let hi = profile.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (profile[mid][0] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const linear = (index, s) => {
    const [sa, ra] = profile[index];
    const [sb, rb] = profile[index + 1];
    return [ra + ((rb - ra) * (s - sa)) / (sb - sa), (rb - ra) / (sb - sa)];
  };
  const radiusAt = radius ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].radius(at) : linear(index, at)[0];
  });
  const slopeAt = slope ?? ((s) => {
    const at = Math.max(s0, Math.min(s1, s));
    const index = find(at);
    return segments[index] ? segments[index].slope(at) : linear(index, at)[1];
  });
  return { s0, s1, radius: radiusAt, slope: slopeAt, analytic: Boolean(slope && radius) };
}

function bandsOf(profile, cuts, F, P, { slope = null, radius = null, steps, rows = 6, rims = "none", fill = "auto", samples = 72 } = {}) {
  const curve = profileCurve(profile, { slope, radius });
  const { s0, s1 } = curve;
  const stops = [s0, ...[...new Set(cuts)].filter((s) => s > s0 + 1e-6 && s < s1 - 1e-6).sort((a, b) => a - b), s1];
  const most = Math.max(...profile.map(([, r]) => r), ...stops.map((s) => curve.radius(s)));
  const n = steps ?? stepsFor(most, 32, 160, scaleOf(P));
  const knot = (s, soft) => (soft ? [s, curve.radius(s), 1] : [s, curve.radius(s)]);
  const meridianOf = (a, b) => [knot(a), ...profile.filter(([s]) => s > a + 1e-9 && s < b - 1e-9).map(([s, , soft]) => knot(s, soft)), knot(b)];
  const shading = { slope: curve.slope, radius: curve.radius, rows };
  const bands = stops.slice(0, -1).map((a, index) => {
    const b = stops[index + 1];
    const meridian = meridianOf(a, b);
    const paths = lathe(meridian, F, P, { steps: n, rims, fill, smooth: shading });
    const seam = index < stops.length - 2 ? arcOf(F, b, curve.radius(b), P, { slope: curve.slope(b) }) : "";
    return { s0: a, s1: b, profile: meridian, paths: { ...paths, outline: "" }, outline: paths.outline, seam };
  });
  const sidesOf = (from = s0, to = s1, { ends = false, count = samples } = {}) => {
    const span = [Math.max(s0, from), Math.min(s1, to)];
    const dense = Array.from({ length: count + 1 }, (_, index) => knot(span[0] + ((span[1] - span[0]) * index) / count, true));
    const points = silhouettePoints(dense, F, P, { samples: count, slope: curve.slope, radius: curve.radius });
    const rim = (s) => arcOf(F, s, curve.radius(s), P, { slope: curve.slope(s) });
    const rimsAt = ends === true ? span : ends === "first" ? [span[0]] : ends === "last" ? [span[1]] : [];
    return { d: points.map((list) => pathOf(list.map((point) => iso(point, P)))).join("") + rimsAt.map(rim).join(""), points };
  };
  return { bands, sidesOf, radius: curve.radius, slope: curve.slope, steps: n, s0, s1 };
}

function arcOf(F, s, r, P, { slope = 0, steps = 0, least = 0.02, inward = false, from = 0, to = TAU, trim = 0.3 } = {}) {
  const V = viewOf(P);
  const aV = dot3(F.a, V);
  const uV = dot3(F.u, V);
  const vV = dot3(F.v, V);
  const flat = Math.hypot(uV, vV);
  const phi = Math.atan2(vV, uV);
  const norm = Math.hypot(1, slope);
  const full = Math.abs(to - from - TAU) < 1e-9;
  let visible;
  if (flat < 1e-9) visible = (inward ? slope * aV / norm > least : -slope * aV / norm > least) ? [[phi, phi + TAU]] : [];
  else if (inward) {
    const c = (slope * aV - least * norm) / flat;
    visible = c <= -1 ? [] : c >= 1 ? [[phi, phi + TAU]] : [[phi + Math.acos(c), phi + TAU - Math.acos(c)]];
  } else {
    const c = (least * norm + slope * aV) / flat;
    visible = c >= 1 ? [] : c <= -1 ? [[phi, phi + TAU]] : [[phi - Math.acos(c), phi + Math.acos(c)]];
  }
  const at = (t) => iso(pointOf(F, s, r, t), P);
  const speed = (t) => {
    const a = at(t - 1e-3);
    const b = at(t + 1e-3);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 2e-3;
  };
  const count = (span) => Math.max(2, Math.ceil(((steps || stepsFor(r, 24, 112)) * span) / TAU), Math.ceil((span * r * scaleOf(P)) / 1.5));
  const out = [];
  for (const [a, b] of visible) {
    if (b - a >= TAU - 1e-9 && full) {
      const n = count(TAU);
      out.push(pathOf(Array.from({ length: n }, (_, j) => at(from + (j / n) * TAU)), true));
      continue;
    }
    const pieces = full ? [[a, b, true, true]] : [];
    if (!full)
      for (let turn = -2; turn <= 2; turn++) {
        const lo = Math.max(a + turn * TAU, from);
        const hi = Math.min(b + turn * TAU, to);
        if (hi - lo > 1e-6) pieces.push([lo, hi, lo > from + 1e-9, hi < to - 1e-9]);
      }
    for (const [lo, hi, limb0, limb1] of pieces) {
      const span = hi - lo;
      const cut0 = limb0 && trim > 0 ? Math.min(span * 0.25, trim / (speed(lo) || 1)) : 0;
      const cut1 = limb1 && trim > 0 ? Math.min(span * 0.25, trim / (speed(hi) || 1)) : 0;
      const t0 = lo + cut0;
      const t1 = hi - cut1;
      const n = count(t1 - t0);
      out.push(pathOf(Array.from({ length: n + 1 }, (_, j) => at(t0 + ((t1 - t0) * j) / n))));
    }
  }
  return out.join("");
}

function circleOf(F, s, r, P, steps = 0) {
  const count = steps || stepsFor(r, 24, 112);
  return pathOf(
    Array.from({ length: count }, (_, j) => iso(pointOf(F, s, r, (j / count) * TAU), P)),
    true,
  );
}

function spokesOf(F, s, r0, r1, count, P, { phase = 0, sweep = 0, from = 0, to = TAU } = {}) {
  const lines = [];
  for (let index = 0; index < count; index++) {
    const t = phase + from + (index / count) * (to - from);
    lines.push(pathOf([iso(pointOf(F, s, r0, t), P), iso(pointOf(F, s, r1, t + sweep), P)]));
  }
  return lines.join("");
}

const fadeOf = (value, [lo, hi]) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo || 1e-9)));
  return t * t * (3 - 2 * t);
};

function ribsOf(F, s0, s1, r, count, P, { phase = 0, twist = 0, least = 0.12, r1 = r, fade = null, seams = false } = {}) {
  const V = viewOf(P);
  const lines = [];
  const slope = (r1 - r) / (s1 - s0 || 1);
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    const radial = radialOf(F, t + twist / 2);
    const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
    const facing = dot3(normal, V);
    const d = pathOf([iso(pointOf(F, s0, r, t), P), iso(pointOf(F, s1, r1, t + twist), P)]);
    if (fade) {
      const alpha = fadeOf(facing, fade);
      if (alpha > 0.02) lines.push({ d, alpha });
      continue;
    }
    if (facing < least) continue;
    lines.push(d);
  }
  const ends = seams ? [seams === "last" ? "" : arcOf(F, s0, r, P, { slope }), seams === "first" ? "" : arcOf(F, s1, r1, P, { slope })].filter(Boolean) : [];
  if (fade) return [...lines, ...ends.map((d) => ({ d, alpha: 1 }))];
  return [...lines, ...ends].join("");
}

function rodOut(F, from, to, r, P, { stroke = 0, ...options } = {}) {
  const pad = 0.35 / scaleOf(P);
  const ring = (s) => Array.from({ length: 48 }, (_, index) => iso(pointOf(F, s, r + pad, (index / 48) * TAU), P));
  return {
    paths: disc(from - stroke, to, r, F, P, options),
    clip: pathOf(hullOf([...ring(from), ...ring(to + stroke)]), true),
    from,
    to,
    stroke,
    reach: to + stroke,
  };
}

function dotsOf(F, s, r, count, P, { phase = 0, slope = 0, least = 0.08, all = false, fade = null } = {}) {
  const V = viewOf(P);
  const out = [];
  for (let index = 0; index < count; index++) {
    const t = phase + (index / count) * TAU;
    let alpha = 1;
    if (!all) {
      const radial = radialOf(F, t);
      const normal = unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]);
      const facing = dot3(normal, V);
      if (fade) alpha = fadeOf(facing, fade);
      else if (facing < least) continue;
      if (alpha <= 0.02) continue;
    }
    const [x, y] = iso(pointOf(F, s, r, t), P);
    out.push(alpha < 1 ? [x, y, alpha] : [x, y]);
  }
  return out;
}

function facingOf(F, angle, P, slope = 0) {
  const radial = radialOf(F, angle);
  return dot3(unit3([radial[0] - slope * F.a[0], radial[1] - slope * F.a[1], radial[2] - slope * F.a[2]]), viewOf(P));
}

function fillet(points, radius, perArc = 7, { P = null, tube = 0, margin = 1.3 } = {}) {
  if (points.length < 3) return points.map((p) => [...p]);
  const V = P && tube ? viewOf(P) : null;
  const out = [[...points[0]]];
  for (let index = 1; index < points.length - 1; index++) {
    const prev = points[index - 1];
    const here = points[index];
    const next = points[index + 1];
    const into = unit3(sub3(here, prev));
    const outOf = unit3(sub3(next, here));
    const cosTurn = Math.max(-1, Math.min(1, dot3(into, outOf)));
    const turn = Math.acos(cosTurn);
    if (turn < 1e-3) {
      out.push([...here]);
      continue;
    }
    const room = Math.min(len3(sub3(here, prev)), len3(sub3(next, here))) * 0.48;
    const facing = V ? Math.abs(dot3(unit3(cross3(into, outOf)), V)) : 1;
    const bend = V ? Math.max(radius, (margin * tube) / (0.7 * Math.max(0.05, facing) ** 2)) : radius;
    const cut = Math.min(bend * Math.tan(turn / 2), room);
    const a = sub3(here, mul3(into, cut));
    const b = add3(here, mul3(outOf, cut));
    const count = Math.max(2, Math.ceil((perArc * turn) / (Math.PI / 2)));
    for (let step = 0; step <= count; step++) {
      const t = step / count;
      const p0 = lerp3(a, here, t);
      const p1 = lerp3(here, b, t);
      out.push(lerp3(p0, p1, t));
    }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

function resample(points, spacing) {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + len3(sub3(points[index], points[index - 1])));
  const total = lengths[lengths.length - 1];
  const count = Math.max(1, Math.round(total / spacing));
  const out = [];
  let segment = 1;
  for (let step = 0; step <= count; step++) {
    const at = (total * step) / count;
    while (segment < points.length - 1 && lengths[segment] < at) segment++;
    const a = points[segment - 1];
    const b = points[segment];
    const span = lengths[segment] - lengths[segment - 1] || 1;
    out.push(lerp3(a, b, Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span))));
  }
  return out;
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index++) total += len3(sub3(points[index], points[index - 1]));
  return total;
}

function cut(points, from, to) {
  const out = [];
  let walked = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const length = len3(sub3(b, a));
    const start = walked;
    const end = walked + length;
    if (end >= from && start <= to) {
      const t0 = Math.max(0, (from - start) / (length || 1));
      const t1 = Math.min(1, (to - start) / (length || 1));
      if (!out.length) out.push(lerp3(a, b, t0));
      out.push(lerp3(a, b, t1));
    }
    walked = end;
  }
  return out;
}

const pointAlong = (points, at) => {
  const piece = cut(points, at, at + 0.01);
  return piece[0] ?? points[points.length - 1];
};

function tangentAlong(points, at) {
  const total = pathLength(points);
  const a = pointAlong(points, Math.max(0, at - 0.6));
  const b = pointAlong(points, Math.min(total, at + 0.6));
  return unit3(sub3(b, a));
}

function spiral(F, s, r0, r1, a0, a1, steps = 28) {
  const out = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    out.push(pointOf(F, s, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t));
  }
  return out;
}

function arcPoints(F, s, r, a0, a1, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, index) => pointOf(F, s, r, a0 + ((a1 - a0) * index) / steps));
}

return { viewOf, scaleOf, frameAlong, frameOf, pointOf, disc, sphereOf, prismOf, circleOf, arcOf, solidOf, ringBand, ribsOf, dot3, add3, sub3, mul3, unit3, cross3, len3, lightOf, toneOf, radialOf, angleToward };})();
// Parts that move or change shape, built the same way by the build (for the
// static picture and the audit) and by the page (each frame): the portafilter,
// which travels from grinder to tamping stand to group and twists to lock,
// the E61 lever, and the coffee in the basket.
function makeParts(k, G, P) {
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const depth = (p) => G.dot3(p, V);
  const Z = [0, 0, 1];
  const f1 = (v) => Math.round(v * 10) / 10;

  // Portafilter geometry, all relative to the lip's top centre c, axis up.
  // A 51 mm portafilter, as on a Dedica.
  const PF = {
    lip: [-2, 0, 11.6, 14.4],     // s0, s1, inner, outer
    bowl: [[-14.4, 0], [-14.4, 7.4], [-13.4, 9.7], [-10.9, 12], [-2, 13.3]],
    neck: [-18, -14.4, 3.1],
    bar: [-20, -18],
    nozzle: [-25, -20, 1.4],
    nozzleAt: 4.6,
    handleZ: -9,
    handle: [12, 19.5, 3],        // neck s0, s1, r
    grip: [19.5, 58],
    cap: [58, 60.2, 4.1],
    lug: [13.6, 17.2, 3.8],       // r0, r1, half width
    bed: 11.3,
  };
  const gripR = (s) => 4.1 + 1.1 * Math.sin((Math.PI * (s - PF.grip[0])) / (PF.grip[1] - PF.grip[0]));
  const gripSlope = (s) => ((1.1 * Math.PI) / (PF.grip[1] - PF.grip[0])) * Math.cos((Math.PI * (s - PF.grip[0])) / (PF.grip[1] - PF.grip[0]));
  const gripProfile = Array.from({ length: 13 }, (_, i) => {
    const s = PF.grip[0] + ((PF.grip[1] - PF.grip[0]) * i) / 12;
    return [s, gripR(s)];
  });
  const handleDir = (theta) => [Math.sin(theta), Math.cos(theta), 0];
  const axisFrame = (c, theta) => {
    const h = handleDir(theta);
    return G.frameOf(c, Z, h, G.cross3(Z, h));
  };

  // A clip that hides whatever sits below the plane of a round opening but
  // outside it: the opening's ellipse plus everything above its centre line.
  function openingClip(c, r) {
    const F = G.frameOf(c, Z, [1, 0, 0], [0, 1, 0]);
    const ring = Array.from({ length: 48 }, (_, i) => at(G.pointOf(F, 0, r, (i / 48) * Math.PI * 2)));
    const [cx, cy] = at(c);
    const box = `M${f1(cx - 400)} ${f1(cy - 400)}H${f1(cx + 400)}V${f1(cy)}H${f1(cx - 400)}Z`;
    return box + k.pathOf(ring, true);
  }

  function bedSvg(c, F, { level = -4, mound = 0, crumbs = true, alpha = 1, clumps = 0 } = {}) {
    // level: the coffee's surface below the lip top (s); mound: dome height above the lip.
    if (level === null) return "";
    const voidRing = G.circleOf(F, 0, PF.lip[2], P, 48);
    let out = `<path class="es-void" d="${voidRing}"/>`;
    out += Ln(G.arcOf(F, 0, PF.lip[2], P, { inward: true, least: -1 }), { tone: "faint" });
    let grounds = "";
    if (level > -16 && alpha > 0.01) {
      const r = Math.min(PF.bed, PF.lip[2] - 0.2);
      grounds += `<path class="es-grounds" d="${G.circleOf(F, level, r, P, 48)}"/>`;
      if (crumbs) {
        const dots = [];
        for (let i = 0; i < 26; i++) {
          const a = i * 2.39996;
          const rr = r * Math.sqrt((i + 0.5) / 26) * 0.92;
          dots.push(at(G.pointOf(F, level, rr, a)));
        }
        grounds += k.dotsSvg(dots, { size: 0.32, tone: "lo" });
      }
    }
    out += alpha < 0.999 ? `<g opacity="${alpha.toFixed(3)}">${grounds}</g>` : grounds;
    if (mound > 0.05) {
      // a dome of loose grounds: rim ellipse below, a raised half-ellipse above
      const [cx, cy] = at(c);
      const rx = Math.abs(at(G.pointOf(F, 0, PF.lip[2] - 0.6, 0))[0] - cx);
      const e = P.elevation ?? 30;
      const ry = rx * Math.sin((e * Math.PI) / 180);
      const up = ry + mound * Math.cos((e * Math.PI) / 180) * G.scaleOf(P);
      const ring = [];
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI * (i / 24);
        ring.push([cx - rx * Math.cos(t), cy + ry * Math.sin(t)]);
      }
      for (let i = 0; i <= 24; i++) {
        const t = Math.PI * (i / 24);
        ring.push([cx + rx * Math.cos(t), cy - up * Math.sin(t)]);
      }
      out += `<path class="es-grounds es-mound" d="${k.pathOf(ring, true)}"/>`;
      const dots = [];
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39996;
        const q = Math.sqrt((i + 0.5) / 18) * 0.86;
        dots.push([cx + rx * q * Math.cos(a), cy + ((Math.sin(a) > 0 ? ry : -up) * q * Math.abs(Math.sin(a))) * 0.9]);
      }
      out += k.dotsSvg(dots, { size: 0.32, tone: "lo" });
      if (clumps > 0.02) {
        // clumps of grounds sitting on the dome: what the WDT needles break up
        const lumps = [[0.1, -0.35, 1.1], [-0.45, -0.1, 0.9], [0.5, 0.05, 0.8], [-0.15, 0.3, 0.75], [0.3, -0.6, 0.7], [-0.55, -0.45, 0.65], [0.62, -0.32, 0.6]];
        out += `<g class="es-clumps" opacity="${clumps.toFixed(3)}">` + lumps.map(([u, v, s]) => `<ellipse cx="${f1(cx + u * rx)}" cy="${f1(cy + (v < 0 ? v * up : v * ry))}" rx="${f1(s * 1.3 * G.scaleOf(P))}" ry="${f1(s * 0.9 * G.scaleOf(P))}"/>`).join("") + `</g>`;
      }
    }
    return `<clipPath id="es-void-clip"><path d="${voidRing}"/></clipPath><g clip-path="url(#es-void-clip)">${out}</g>` + "";
  }

  // Each piece carries a tag, so the portafilter can be drawn in two depth
  // slots where it sits inside something: at the group the basket is inside
  // the collar while the handle passes in front of it; in the grinder's fork
  // the near lug rests on the near prong, which passes in front of the basket.
  const ALL = ["spout", "bowl", "handle", "lip", "lugFar", "lugNear", "bed"];
  const lugPoly = [[PF.lug[0], -PF.lug[2]], [PF.lug[1], -PF.lug[2] + 0.8], [PF.lug[1], PF.lug[2] - 0.8], [PF.lug[0], PF.lug[2]]];
  const barPoly = [[-1.6, -PF.nozzleAt - 2.2], [1.6, -PF.nozzleAt - 2.2], [1.6, PF.nozzleAt + 2.2], [-1.6, PF.nozzleAt + 2.2]];
  const lugFrames = (c, h) => [-1, 1].map((sgn) => {
    const radial = G.mul3(G.cross3(Z, h), sgn);
    return { F: G.frameOf(c, Z, radial, G.cross3(Z, radial)), near: G.dot3(radial, V) > 0 };
  });
  function portafilter(c, theta = 0, { level = -4, mound = 0, lit = false, spoutClip = "", only = ALL, bedAlpha = 1, clumps = 0 } = {}) {
    const want = new Set(only);
    const clipped = (s) => (spoutClip ? `<g clip-path="${spoutClip}">${s}</g>` : s);
    const F = axisFrame(c, theta);
    const h = handleDir(theta);
    const parts = [];
    const tone = { tone: "hi", lit };
    if (want.has("spout")) {
      const side = G.cross3(Z, h);
      for (const sgn of [-1, 1]) {
        const o = G.add3(c, G.mul3(side, sgn * PF.nozzleAt));
        const NF = G.frameOf(o, Z, h, side);
        parts.push({ d: depth(G.add3(o, [0, 0, PF.nozzle[0]])) - 30, svg: clipped(S(G.disc(PF.nozzle[0], PF.nozzle[1], PF.nozzle[2], NF, P, { steps: 20 }), { tone: "mid" })) });
      }
      parts.push({ d: depth(G.add3(c, [0, 0, PF.bar[0]])) - 20, svg: clipped(S(G.prismOf(F, barPoly, PF.bar[0], PF.bar[1], P), { tone: "mid" })) });
      parts.push({ d: depth(G.add3(c, [0, 0, PF.neck[0]])) - 19, svg: clipped(S(G.disc(PF.neck[0], PF.neck[1], PF.neck[2], F, P, { steps: 24 }), { tone: "mid" })) });
    }
    if (want.has("bowl")) parts.push({ d: depth(G.add3(c, [0, 0, -9])) - 10, svg: S(G.solidOf(PF.bowl, F, P, { steps: 64 }), { ...tone, inner: Ln(G.arcOf(F, -8, 12.42, P, { slope: 0.146 }), { tone: "faint" }) }) });
    if (want.has("handle")) {
      const HF = G.frameAlong(G.add3(c, [0, 0, PF.handleZ]), h);
      const toward = G.dot3(h, V) > 0;
      const handle =
        S(G.disc(PF.handle[0], PF.handle[1], PF.handle[2], HF, P, { steps: 24 }), { tone: "mid" }) +
        S(G.solidOf(gripProfile, HF, P, { steps: 40, smooth: { slope: gripSlope, radius: gripR } }), { tone: "lo", inner: Ln(G.arcOf(HF, PF.grip[0] + 3, gripR(PF.grip[0] + 3), P, { slope: gripSlope(PF.grip[0] + 3) }), { tone: "faint" }) }) +
        S(G.disc(PF.cap[0], PF.cap[1], PF.cap[2], HF, P, { steps: 28, bevel: 0.3 }), { tone: "mid" });
      parts.push({ d: depth(c) + (toward ? 5 : -15), svg: handle });
    }
    if (want.has("lip")) parts.push({ d: depth(c) - 1, svg: S(G.ringBand(PF.lip[0], PF.lip[1], PF.lip[2], PF.lip[3], F, P, { steps: 72 }), { ...tone, inner: "" }) });
    for (const { F: LF, near } of lugFrames(c, h)) {
      if (!want.has(near ? "lugNear" : "lugFar")) continue;
      parts.push({ d: depth(c) + (near ? 0.5 : -2), svg: S(G.prismOf(LF, lugPoly, PF.lip[0], PF.lip[1] - 0.3, P), { tone: "mid" }) });
    }
    if (want.has("bed")) parts.push({ d: depth(c) + 1, svg: `<g data-part="bed">${bedSvg(c, F, { level, mound, alpha: bedAlpha, clumps })}</g>` });
    parts.sort((a, b) => a.d - b.d);
    return parts.map((p) => p.svg).join("");
  }

  // Shapes for the audit, in the same places, with the same tags.
  function portafilterShapes(A, c, theta, name, { only = ALL } = {}) {
    const want = new Set(only);
    const F = axisFrame(c, theta);
    const h = handleDir(theta);
    const HF = G.frameAlong(G.add3(c, [0, 0, PF.handleZ]), h);
    const own = { owner: "pf" };
    const out = [];
    if (want.has("lip")) out.push(A.ring(F, PF.lip[0], PF.lip[1], PF.lip[2], PF.lip[3], { name: `${name}.lip`, ...own }));
    if (want.has("handle")) {
      out.push(A.disc(HF, PF.handle[0], PF.handle[1], PF.handle[2], { name: `${name}.neck`, ...own }));
      out.push(A.solid(HF, gripProfile, { name: `${name}.grip`, radius: gripR, ...own }));
      out.push(A.disc(HF, PF.cap[0], PF.cap[1], PF.cap[2], { name: `${name}.cap`, ...own }));
    }
    for (const { F: LF, near } of lugFrames(c, h)) if (want.has(near ? "lugNear" : "lugFar")) out.push(A.prism(LF, lugPoly, PF.lip[0], PF.lip[1] - 0.3, { name: `${name}.lug`, ...own }));
    if (want.has("bowl")) out.push(A.solid(F, PF.bowl, { name: `${name}.bowl`, ...own }));
    if (want.has("spout")) {
      out.push(A.disc(F, PF.neck[0], PF.neck[1], PF.neck[2], { name: `${name}.spout`, ...own }));
      out.push(A.prism(F, barPoly, PF.bar[0], PF.bar[1], { name: `${name}.bar`, ...own }));
      const side = G.cross3(Z, h);
      for (const sgn of [-1, 1]) {
        const o = G.add3(c, G.mul3(side, sgn * PF.nozzleAt));
        out.push(A.disc(G.frameOf(o, Z, h, side), PF.nozzle[0], PF.nozzle[1], PF.nozzle[2], { name: `${name}.nozzle`, ...own }));
      }
    }
    return out;
  }

  // Where the two spout tips are, for the stream.
  function spoutTips(c, theta) {
    const side = G.cross3(Z, handleDir(theta));
    return [-1, 1].map((sgn) => G.add3(G.add3(c, G.mul3(side, sgn * PF.nozzleAt)), [0, 0, PF.nozzle[0]]));
  }

  // The E61 lever: an arm in the plane in front of the group, turning about y.
  const LEVER = { boss: [0, 5.4, 3.6], arm: [3, 33, 1.5], knob: 36.4, knobR: 4.2, plane: 2.7 };
  function leverDir(alpha) {
    return [Math.cos(alpha), 0, Math.sin(alpha)];
  }
  // pivot: the centre of the hub's face; the lever's boss turns on a pin along +y
  const leverPlane = (pivot) => G.add3(pivot, [0, LEVER.plane, 0]);
  function lever(pivot, alpha, { lit = false } = {}) {
    const d = leverDir(alpha);
    const o = leverPlane(pivot);
    const F = G.frameAlong(o, d);
    const B = G.frameOf(pivot, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const boss = S(G.disc(LEVER.boss[0], LEVER.boss[1], LEVER.boss[2], B, P, { steps: 28, bevel: 0.3 }), { tone: "mid" });
    const arm = S(G.disc(LEVER.arm[0], LEVER.arm[1], LEVER.arm[2], F, P, { steps: 18 }), { tone: "hi", lit });
    const knob = S(G.sphereOf(G.add3(o, G.mul3(d, LEVER.knob)), LEVER.knobR, P, { steps: 40 }), { tone: "lo", lit });
    const pin = Ln(G.circleOf(B, LEVER.boss[1], 1.2, P, 16), { tone: "lo" });
    // the arm leaves the boss toward the viewer's side when it is raised
    return G.dot3(d, V) > 0 ? boss + pin + arm + knob : arm + knob + boss + pin;
  }
  function leverShapes(A, pivot, alpha) {
    const d = leverDir(alpha);
    const o = leverPlane(pivot);
    const F = G.frameAlong(o, d);
    const B = G.frameOf(pivot, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    return [
      A.disc(B, LEVER.boss[0], LEVER.boss[1], LEVER.boss[2], { name: "lever.boss", owner: "lever" }),
      A.disc(F, LEVER.arm[0], LEVER.arm[1], LEVER.arm[2], { name: "lever.arm", owner: "lever" }),
      A.ball(G.add3(o, G.mul3(d, LEVER.knob)), LEVER.knobR, { name: "lever.knob", owner: "lever" }),
    ];
  }

  // The tamper: a 58.5 mm flat base on a turned handle, standing on its base.
  const TAMPER = { base: [0, 4, 11.3], collar: [4, 6.2, 8.4], grip: [6.2, 30], top: 30 };
  const tamperR = (s) => 6.6 + 1.9 * Math.sin((Math.PI * (s - TAMPER.grip[0])) / (TAMPER.grip[1] - TAMPER.grip[0])) ** 1;
  const tamperSlope = (s) => ((1.9 * Math.PI) / (TAMPER.grip[1] - TAMPER.grip[0])) * Math.cos((Math.PI * (s - TAMPER.grip[0])) / (TAMPER.grip[1] - TAMPER.grip[0]));
  const tamperProfile = Array.from({ length: 13 }, (_, i) => {
    const s = TAMPER.grip[0] + ((TAMPER.grip[1] - TAMPER.grip[0]) * i) / 12;
    return [s, tamperR(s)];
  });
  function tamper(o, { lit = false } = {}) {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return (
      S(G.disc(TAMPER.base[0], TAMPER.base[1], TAMPER.base[2], F, P, { steps: 72, bevel: 0.4 }), { tone: "hi", lit, inner: Ln(G.arcOf(F, 1.4, TAMPER.base[2], P), { tone: "faint" }) }) +
      S(G.disc(TAMPER.collar[0], TAMPER.collar[1], TAMPER.collar[2], F, P, { steps: 48 }), { tone: "mid" }) +
      S(G.solidOf(tamperProfile, F, P, { steps: 48, smooth: { slope: tamperSlope, radius: tamperR } }), { tone: "lo" }) +
      Ln(G.circleOf(F, TAMPER.top, 3.2, P, 24), { tone: "faint" })
    );
  }
  function tamperShapes(A, o, name = "tamper") {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return [
      A.disc(F, TAMPER.base[0], TAMPER.base[1], TAMPER.base[2], { name: `${name}.base`, owner: name }),
      A.disc(F, TAMPER.collar[0], TAMPER.collar[1], TAMPER.collar[2], { name: `${name}.collar`, owner: name }),
      A.solid(F, tamperProfile, { name: `${name}.grip`, radius: tamperR, owner: name }),
    ];
  }

  // The WDT tool: a turned handle on a hub, with a ring of fine needles below it.
  // o is the centre of the hub's underside, where the needles start.
  const WDT = { hub: [0, 3, 4], grip: [3, 30], cap: [30, 32, 3.4], needles: 15, ring: [0, 1.6, 3] };
  const wdtR = (s) => 2.8 + 0.7 * Math.sin((Math.PI * (s - WDT.grip[0])) / (WDT.grip[1] - WDT.grip[0]));
  const wdtSlope = (s) => ((0.7 * Math.PI) / (WDT.grip[1] - WDT.grip[0])) * Math.cos((Math.PI * (s - WDT.grip[0])) / (WDT.grip[1] - WDT.grip[0]));
  const wdtProfile = Array.from({ length: 11 }, (_, i) => {
    const s = WDT.grip[0] + ((WDT.grip[1] - WDT.grip[0]) * i) / 10;
    return [s, wdtR(s)];
  });
  function wdt(o, { lit = false } = {}) {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return (
      S(G.disc(WDT.hub[0], WDT.hub[1], WDT.hub[2], F, P, { steps: 32, bevel: 0.3 }), { tone: "mid", lit }) +
      S(G.solidOf(wdtProfile, F, P, { steps: 32, smooth: { slope: wdtSlope, radius: wdtR } }), { tone: "lo", lit }) +
      S(G.disc(WDT.cap[0], WDT.cap[1], WDT.cap[2], F, P, { steps: 28, bevel: 0.3 }), { tone: "hi", lit })
    );
  }
  // needle tips: the ring of needle roots, each running down to its tip or to the
  // surface it is pushed into, whichever is higher
  function wdtNeedles(o, floor = -Infinity, length = 15) {
    const roots = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [1.6 * Math.cos((i * Math.PI) / 3), 1.6 * Math.sin((i * Math.PI) / 3)]), ...Array.from({ length: 8 }, (_, i) => [3 * Math.cos((i * Math.PI) / 4 + 0.4), 3 * Math.sin((i * Math.PI) / 4 + 0.4)])];
    return roots
      .map(([dx, dy]) => {
        const top = [o[0] + dx, o[1] + dy, o[2]];
        const tip = Math.max(o[2] - length, typeof floor === "function" ? floor(top) : floor);
        return tip < o[2] - 0.2 ? k.pathOf([at(top), at([top[0], top[1], tip])]) : "";
      })
      .join("");
  }
  function wdtShapes(A, o, name = "wdt") {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return [
      A.disc(F, WDT.hub[0], WDT.hub[1], WDT.hub[2], { name: `${name}.hub`, owner: name }),
      A.solid(F, wdtProfile, { name: `${name}.grip`, radius: wdtR, owner: name }),
      A.disc(F, WDT.cap[0], WDT.cap[1], WDT.cap[2], { name: `${name}.cap`, owner: name }),
    ];
  }

  // The distributor: a body that sits on the basket's rim and a knurled cap
  // whose blades sweep the grounds flat as it turns. o is the centre of its underside.
  const DIST = { body: [0, 6, 15], cap: [6, 12.4, 12.2] };
  function distributorBody(o, { lit = false } = {}) {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return (
      S(G.disc(DIST.body[0], DIST.body[1], DIST.body[2], F, P, { steps: 80, bevel: 0.4 }), { tone: "hi", lit, inner: Ln(G.arcOf(F, 2, DIST.body[2], P), { tone: "faint" }) }) +
      S(G.disc(DIST.cap[0], DIST.cap[1], DIST.cap[2], F, P, { steps: 72, bevel: 0.4 }), { tone: "mid", lit })
    );
  }
  // the cap's knurl and its index mark, at a turn angle
  function distributorTurn(o, angle) {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    const ribs = G.ribsOf(F, DIST.cap[0], DIST.cap[1], DIST.cap[2], 48, P, { phase: angle, fade: [0.1, 0.55] });
    const mark = Ln(k.pathOf([at(G.pointOf(F, DIST.cap[1], 3, angle)), at(G.pointOf(F, DIST.cap[1], DIST.cap[2] - 1.6, angle))]), { tone: "hi", free: true });
    return k.fadedSvg(ribs, { tone: "lo" }) + Ln(G.circleOf(F, DIST.cap[1], DIST.cap[2] - 1.2, P, 48), { tone: "faint" }) + mark;
  }
  function distributorShapes(A, o, name = "distributor") {
    const F = G.frameOf(o, Z, [1, 0, 0], [0, 1, 0]);
    return [
      A.disc(F, DIST.body[0], DIST.body[1], DIST.body[2], { name: `${name}.body`, owner: name }),
      A.disc(F, DIST.cap[0], DIST.cap[1], DIST.cap[2], { name: `${name}.cap`, owner: name }),
    ];
  }

  return { PF, ALL, WDT, DIST, wdt, wdtNeedles, wdtShapes, distributorBody, distributorTurn, distributorShapes, LEVER, TAMPER, portafilter, portafilterShapes, spoutTips, openingClip, lever, leverShapes, leverDir, tamper, tamperShapes, handleDir };
}
const M = (() => {// The espresso model. Everything the figure shows (collar setting, gauge needle,
// scale digits, stream, cup level and the verdict) is read from these functions.
//
// Grind: the collar setting s sets the median particle size d = 100 + 25·s µm,
// so setting 8 is 300 µm, about fine table salt.
// Puck: Darcy's law, Q = k·A·ΔP / (μ·L). Kozeny–Carman makes the permeability k
// grow with d², so the puck's conductance is C = C0·(d/300)² mL/s per bar.
// Pump: a vibration pump behind an over-pressure valve. Its curve falls from
// 12 bar at no flow toward 6 mL/s, and the valve clips it at 9 bar, so a coarse
// puck that lets water through too easily can't be held at 9 bar.
// Extraction: the share of the dose dissolved grows with the water passed and
// with the surface the grind exposes (finer means more surface), toward a
// ceiling of 28 %. The window that tastes balanced is 18–22 %.

const DOSE = 14;            // g of ground coffee in a 51 mm double basket
const TARGET = 28;          // g in the cup: a 1:2 brew ratio
const BREW_C = 93;          // °C at the group
const STEAM_BAR = 1.2;      // boiler pressure, about 122 °C
const TAMP_KG = 15;         // tamping force
const GRIND_RATE = 1.6;     // g/s from the conical burrs at an espresso setting
const SETTINGS = [2, 20];   // collar range in the figure
const IDEAL = 8;
const LIMIT = 60;           // s: a choked shot is abandoned here

const micronsOf = (s) => 100 + 25 * s;
const C0 = 0.14;                  // mL/s/bar at 300 µm
const OPV = 9;
const PUMP_MAX = 12;
const PUMP_FLOW = 6;
const HEADSPACE = 6;               // mL above the puck in the group and basket
const ABSORB = 1.0;                // g of water a gram of dry coffee takes up before it drips

const conductanceOf = (d) => C0 * (d / 300) ** 2;
const pressureOf = (C) => Math.min(OPV, PUMP_MAX / (1 + (PUMP_MAX * C) / PUMP_FLOW));
const extractionOf = (out, d) => 28 * (1 - Math.exp(-0.6 * (out / DOSE) * (300 / d) ** 1.3));

// One shot, sampled every dt seconds until the cup holds TARGET or LIMIT passes.
function simulate(s, dt = 0.05) {
  const d = micronsOf(s);
  const C = conductanceOf(d);
  const Pss = pressureOf(C);
  const fill = 4.0 * Math.sqrt(d / 300);   // mL/s through the pre-infusion chamber before the puck is wet
  const need = HEADSPACE + ABSORB * DOSE;
  let t = 0, P = 0, wet = 0, out = 0, sat = null;
  const rows = [];
  while (true) {
    if (sat === null) {
      P += (2 * 1 - P) * (1 - Math.exp(-dt / 0.8));
      wet += fill * dt;
      if (wet >= need) sat = t;
    } else {
      P += (Pss - P) * (1 - Math.exp(-dt / 1.0));
    }
    const q = sat === null ? 0 : C * P * (1 + 0.012 * (t - sat));
    rows.push({ t, P, q, out, ey: extractionOf(out, d) });
    if (out >= TARGET || t >= LIMIT) break;
    out = Math.min(TARGET, out + q * dt);
    t += dt;
  }
  const last = rows[rows.length - 1];
  return { s, d, C, Pss, firstDrop: sat, time: last.t, out: last.out, ey: last.ey, tds: (last.ey * DOSE) / Math.max(1, last.out), rows, dt };
}

// The shot at time t, interpolated from the samples.
function sampleAt(shot, t) {
  const rows = shot.rows;
  const i = Math.max(0, Math.min(rows.length - 2, Math.floor(t / shot.dt)));
  const a = rows[i], b = rows[i + 1] ?? a;
  const f = Math.max(0, Math.min(1, (t - a.t) / shot.dt));
  const mix = (key) => a[key] + (b[key] - a[key]) * f;
  return { t: Math.min(t, shot.time), P: mix("P"), q: mix("q"), out: mix("out"), ey: mix("ey") };
}

function verdictOf(shot) {
  const choked = shot.out < TARGET - 0.05;
  if (choked) return { word: "choked", taste: "bitter, ashy, stopped at " + LIMIT + " s", band: "over" };
  if (shot.ey < 18) return { word: "under-extracted", taste: "sour, thin, salty", band: "under" };
  if (shot.ey > 22) return { word: "over-extracted", taste: "bitter, dry", band: "over" };
  return { word: "balanced", taste: "sweet, syrupy", band: "good" };
}

return { DOSE, TARGET, IDEAL, SETTINGS, GRIND_RATE, TAMP_KG, STEAM_BAR, LIMIT, BREW_C, micronsOf, simulate, sampleAt, verdictOf };})();
const D = {"P":{"origin":[456.05825242718447,304.2940510851299],"scale":1.0637604941503855,"azimuth":45,"elevation":30},"PF_AT":{"grinder":[-150,114,62],"stand":[-98,168,35.79],"group":[0,86,96]},"THETA":{"grinder":0,"stand":-0.5235987755982988,"group":0},"CHUTE":{"x":-150,"y":112,"z":88},"CUP":{"x":0,"y":86,"z0":25,"rim":49,"inner":13.4},"TAMP_PARK":[-56,186,2.2],"KNOCK":{"x":14,"y":168,"top":26},"WDT_PARK":[-42,158,18],"DIST_PARK":[-68,148,2.2],"GR":{"x":-150,"y":62,"r":22.4,"z":142},"GROUP_Z":90,"ROUTES":["wand","cup.handle","hose.tank","hose.pump","pipe.thermo","pipe.group","pipe.steam","cable.pump","cable.heater"],"M":{"DOSE":14,"TARGET":28,"IDEAL":8,"SETTINGS":[2,20],"GRIND_RATE":1.6,"TAMP_KG":15,"STEAM_BAR":1.2,"LIMIT":60}};
const P = D.P;
const K = { iso, pathOf, solidSvg, lineSvg, dotsSvg, fadedSvg, radialTicks };
const PARTS = makeParts(K, G, P);
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const $$ = (sel) => [...svg.querySelectorAll(sel)];
const at = (p) => iso(p, P);
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const KS = G.scaleOf(P);
const RATE = 2; // the grind and the shot play at twice real time
const SVGNS = "http://www.w3.org/2000/svg";

const el = {
  fly: $('[data-part="fly"]'),
  slots: Object.fromEntries($$("[data-slot]").map((g) => [g.dataset.slot, g])),
  ticks: $('[data-part="collar-ticks"]'),
  stream: $('[data-part="stream"]'),
  grounds: $('[data-part="grounds"]'),
  coffee: $('[data-part="coffee"]'),
  pucks: $('[data-part="pucks"]'),
  brewButton: $('[data-part="button.two"]'),
  pump: $('[data-part="pump"]'),
  water: [1, 2, 3].map((n) => $$(`[data-water="${n}"]`)),
};

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEG = Math.PI / 180;

// ── colours of the coffee, read from the theme's tokens ──
function rgbOf(name) {
  const v = getComputedStyle(stage).getPropertyValue(name).trim();
  const h = v.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
let INK = null;
const readInk = () => (INK = { dark: rgbOf("--es-dark"), crema: rgbOf("--es-crema"), blonde: rgbOf("--es-blonde") });
readInk();
const themed = stage.closest(".iso");
if (themed) new MutationObserver(() => { readInk(); lastPf = ""; draw(wall); }).observe(themed, { attributes: true, attributeFilter: ["data-theme"] });
const mixRgb = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;
function coffeeColour(share) {
  // first drops are dark, the body is hazel and tiger-striped, the end goes blonde
  if (share < 0.25) return mixRgb(INK.dark, INK.crema, smoothstep(0, 0.25, share));
  return mixRgb(INK.crema, INK.blonde, smoothstep(0.55, 1, share));
}

// ── where the portafilter travels ──
const A_ = D.PF_AT;
const T_ = D.THETA;
const GX = A_.grinder;
const ST = A_.stand;
const GP = A_.group;
const KN = D.KNOCK;
const UNDER = GP[2] - 10; // lip height while it passes under the group
const seg = (to, th, dur, layer, opts = {}) => ({ to, th, dur, layer, ...opts });
const TRACKS = {
  out: [
    seg([GX[0], GX[1] + 26, GX[2]], T_.grinder, 0.5, "grinder"),
    seg([GX[0], GX[1] + 26, GX[2] + 12], T_.grinder, 0.4, "fly"),
    seg([ST[0], ST[1], ST[2] + 24], T_.stand, 0.9, "fly"),
    seg(ST, T_.stand, 0.55, "stand", { clip: true }),
  ],
  lock: [
    seg([ST[0], ST[1], ST[2] + 24], T_.stand, 0.5, "stand", { clip: true }),
    seg([GP[0] - 6, GP[1] + 44, UNDER], -40 * DEG, 1.0, "fly"),
    seg([GP[0], GP[1], UNDER], -40 * DEG, 0.55, "fly"),
    seg([GP[0], GP[1], GP[2]], -40 * DEG, 0.45, "group"),
    seg(GP, 0, 0.55, "group"),
  ],
  knock: [
    seg(GP, -40 * DEG, 0.45, "group"),
    seg([GP[0], GP[1], UNDER], -40 * DEG, 0.4, "group"),
    seg([GP[0] - 6, GP[1] + 44, UNDER], -40 * DEG, 0.5, "fly"),
    seg([KN.x, KN.y + 2, KN.top + 34], 50 * DEG, 1.0, "fly"),
    seg([KN.x, KN.y + 2, KN.top + 25], 50 * DEG, 0.16, "fly", { knock: true }),
    seg([KN.x, KN.y + 2, KN.top + 34], 50 * DEG, 0.45, "fly"),
    seg([GX[0], GX[1] + 26, GX[2] + 12], T_.grinder, 1.0, "fly"),
    seg([GX[0], GX[1] + 26, GX[2]], T_.grinder, 0.35, "grinder"),
    seg(GX, T_.grinder, 0.5, "grinder"),
  ],
};
const durationOf = (track) => track.reduce((s, x) => s + x.dur, 0);
function poseAlong(track, from, t) {
  let c = from.c, th = from.th, time = t;
  for (const s of track) {
    if (time <= s.dur) {
      const e = smoothstep(0, 1, time / s.dur);
      return { c: lerp3(c, s.to, e), th: lerp(th, s.th, e), layer: s.layer, clip: !!s.clip, knock: !!s.knock, share: e };
    }
    time -= s.dur;
    c = s.to;
    th = s.th;
  }
  const last = track[track.length - 1];
  return { c: last.to, th: last.th, layer: last.layer, clip: !!last.clip, done: true };
}

// ── the hand tools: each leaves its place on the mat, works over the basket, and returns ──
const LIP = ST[2];
const LEVEL = { loose: { level: 0, mound: 5.4 }, stirred: { level: 0, mound: 3.6 }, flat: { level: -0.8, mound: 0 }, tamped: { level: -3.4, mound: 0 } };
// a tool path: [to, dur, layer, extra] with to as the tool's own reference point
function toolTrack(park, over, down, work) {
  return [
    { to: [park[0], park[1], park[2] + 40], dur: 0.45, layer: "fly" },
    { to: [over[0], over[1], over[2]], dur: 0.75, layer: "fly" },
    { to: down, dur: 0.6, layer: "stand", work: "in" },
    ...work,
    { to: over, dur: 0.45, layer: "stand" },
    { to: [park[0], park[1], park[2] + 40], dur: 0.75, layer: "fly" },
    { to: park, dur: 0.4, layer: "home" },
  ];
}
const WDT_DOWN = [ST[0], ST[1], LIP + 4];
const STIR = Array.from({ length: 24 }, (_, i) => {
  const a = ((i + 1) / 24) * Math.PI * 2 * 3;
  const r = 4.4 * Math.sin(Math.PI * ((i + 1) / 24)) + 0.6;
  return { to: [ST[0] + r * Math.cos(a), ST[1] + r * Math.sin(a), LIP + 4], dur: 0.1, layer: "stand", work: "stir", share: (i + 1) / 24 };
});
const TOOLS = {
  wdt: { park: D.WDT_PARK, el: $('[data-part="wdt-park"]'), track: toolTrack(D.WDT_PARK, [ST[0], ST[1], LIP + 18], WDT_DOWN, [...STIR, { to: WDT_DOWN, dur: 0.15, layer: "stand", work: "stir", share: 1 }]) },
  level: { park: D.DIST_PARK, el: $('[data-part="dist-park"]'), track: toolTrack(D.DIST_PARK, [ST[0], ST[1], LIP + 12], [ST[0], ST[1], LIP], [{ to: [ST[0], ST[1], LIP], dur: 2.2, layer: "stand", work: "turn" }]) },
  tamp: { park: D.TAMP_PARK, el: $('[data-part="tamper-park"]'), track: toolTrack(D.TAMP_PARK, [ST[0], ST[1], LIP + 9], [ST[0], ST[1], LIP + LEVEL.tamped.level], [{ to: [ST[0], ST[1], LIP + LEVEL.tamped.level], dur: 0.5, layer: "stand", work: "press" }]) },
};
// the tamper presses from the top of the bed, so its first downward leg starts the squeeze
TOOLS.tamp.track[2].work = "press";
for (const tool of Object.values(TOOLS)) {
  tool.home = tool.el.parentNode;
  // the clip lives on a still wrapper, so it doesn't travel with the tool's translate
  tool.wrap = document.createElementNS(SVGNS, "g");
  tool.home.insertBefore(tool.wrap, tool.el);
  tool.wrap.appendChild(tool.el);
  tool.pose = { at: tool.park, layer: "home", work: null };
  tool.last = "";
}
const needles = document.createElementNS(SVGNS, "path");
needles.setAttribute("class", "iso-line es-needles");
needles.setAttribute("data-tone", "mid");
needles.setAttribute("data-free", "end");
TOOLS.wdt.wrap.insertBefore(needles, TOOLS.wdt.el);
const distTurn = TOOLS.level.el.querySelector('[data-part="dist-turn"]');
function poseTool(tool, t) {
  let c = tool.park;
  for (const s of tool.track) {
    if (t <= s.dur) return { at: lerp3(c, s.to, smoothstep(0, 1, t / s.dur)), layer: s.layer, work: s.work ?? null, e: t / s.dur, seg: s };
    t -= s.dur;
    c = s.to;
  }
  return null;
}

// ── state ──
const state = {
  phase: "ready",
  clock: 0,
  setting: D.M.IDEAL,
  shot: M.simulate(D.M.IDEAL),
  pose: { c: GX, th: T_.grinder, layer: "grinder", clip: false },
  bed: { level: -16, mound: 0, spent: false, clumps: 0 },
  dose: 0,
  turn: 0,
  out: 0,
  shotT: 0,
  q: 0,
  cupAlpha: 0,
  pucks: 0,
  step: 0,
  stepDone: true,
  holdClock: 0,
  auto: !still.matches,
};

// ── drawing ──
const pf = document.createElementNS(SVGNS, "g");
pf.setAttribute("data-part", "pf");
const pfFront = document.createElementNS(SVGNS, "g");
pfFront.setAttribute("data-part", "pf-front");
for (const slot of Object.values(el.slots)) slot.textContent = "";
el.slots.grinder.appendChild(pf);
let lastPf = "";
const FRONT = { grinder: ["lugNear"], group: ["handle"] };
function drawPf() {
  const { c, th, layer, clip } = state.pose;
  const alpha = state.bedAlpha ?? 1;
  const b = state.bed;
  const key = [c.map((v) => v.toFixed(2)).join(","), th.toFixed(4), b.level.toFixed(2), b.mound.toFixed(2), b.clumps.toFixed(2), b.spent, layer, clip, alpha.toFixed(3), state.step].join("|");
  if (key === lastPf) return;
  lastPf = key;
  const front = FRONT[layer] ?? [];
  const home = layer === "fly" ? el.fly : el.slots[layer];
  const frontHome = front.length ? el.slots[`${layer}-front`] : home;
  if (pf.parentNode !== home) home.insertBefore(pf, home.firstChild);
  if (pfFront.parentNode !== frontHome) frontHome.appendChild(pfFront);
  const lit = state.step === 5;
  const opts = { level: b.level, mound: b.mound, clumps: b.clumps, lit, spoutClip: clip ? "url(#es-stand-clip)" : "", bedAlpha: alpha };
  pf.innerHTML = PARTS.portafilter(c, th, { ...opts, only: PARTS.ALL.filter((t) => !front.includes(t)) });
  pfFront.innerHTML = front.length ? PARTS.portafilter(c, th, { ...opts, only: front }) : "";
  pf.toggleAttribute("data-spent", b.spent);
  // a tool working in the basket is drawn just after the portafilter
  const stand = el.slots.stand;
  for (const tool of Object.values(TOOLS)) if (tool.wrap.parentNode === stand) stand.appendChild(tool.wrap);
}
function drawTools() {
  const active = { 2: "wdt", 3: "level", 4: "tamp" }[state.step];
  for (const [name, tool] of Object.entries(TOOLS)) {
    const { at: o, layer, work } = tool.pose;
    const inside = layer === "stand" && (name === "wdt" || (name === "tamp" && o[2] < LIP + 0.5));
    const key = o.map((v) => v.toFixed(2)).join(",") + layer + inside + (name === "level" ? state.turn.toFixed(3) : "") + (name === "wdt" ? state.bed.mound.toFixed(2) : "") + (active === name);
    if (key === tool.last) continue;
    tool.last = key;
    const home = layer === "fly" ? el.fly : layer === "stand" ? el.slots.stand : tool.home;
    if (tool.wrap.parentNode !== home) home.appendChild(tool.wrap);
    tool.el.setAttribute("transform", translateAlong(P, [o[0] - tool.park[0], o[1] - tool.park[1], o[2] - tool.park[2]]));
    if (inside) tool.wrap.setAttribute("clip-path", "url(#es-tamp-clip)");
    else tool.wrap.removeAttribute("clip-path");
    tool.el.toggleAttribute("data-on", active === name);
    if (name === "wdt") {
      // the needles run down from the hub to their tips, or to the grounds they're pushed into
      const surface = layer === "stand" ? LIP + state.bed.level + state.bed.mound * 0.85 : layer === "home" ? tool.park[2] : -Infinity;
      needles.setAttribute("d", PARTS.wdtNeedles(o, surface));
    }
    if (name === "level") distTurn.innerHTML = PARTS.distributorTurn(tool.park, state.turn);
  }
}
let lastTicks = NaN;
function drawCollar() {
  if (Math.abs(state.setting - lastTicks) < 1e-3) return;
  lastTicks = state.setting;
  const t = radialTicks(D.GR.x, D.GR.y, D.GR.r, 40, 5, D.GR.z, [1.6, 3.4], P, -state.setting * ((Math.PI * 2) / 40));
  el.ticks.innerHTML = lineSvg(t.minor, { tone: "lo" }) + lineSvg(t.major, { tone: "mid" });
}
function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}
const cupInner = (z) => {
  const s = z - D.CUP.z0;
  const outer = s < 1.6 ? 10.8 : s < 14 ? lerp(10.8, 13.6, (s - 1.6) / 12.4) : lerp(13.6, 15, (s - 14) / 10);
  return outer - 1.6;
};
const coffeeZ = (g) => D.CUP.z0 + 1.6 + 13.4 * Math.pow(clamp(g / D.M.TARGET, 0, 1.2), 0.85);
function drawCup() {
  const g = state.out;
  if (g < 0.05 || state.cupAlpha <= 0.001) {
    if (el.coffee.innerHTML) el.coffee.innerHTML = "";
    return;
  }
  const z = coffeeZ(g);
  const F = G.frameOf([D.CUP.x, D.CUP.y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const r = cupInner(z);
  const crema = coffeeColour(clamp(g / D.M.TARGET, 0, 1) * 0.7);
  const deep = coffeeColour(0.05);
  let out = `<g opacity="${state.cupAlpha.toFixed(3)}"><path class="es-crema" style="fill:${deep}" d="${G.circleOf(F, 0, r, P, 48)}"/>`;
  out += `<path class="es-crema" style="fill:${crema}" d="${G.circleOf(F, 0.02, r * 0.86, P, 48)}"/>`;
  if (state.phase === "brew" && state.q > 0) {
    // where the two streams land the crema is darker and stirred
    for (const tip of PARTS.spoutTips(state.pose.c, state.pose.th)) {
      const L = G.frameOf([tip[0], tip[1], z + 0.04], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
      out += `<path class="es-crema" style="fill:${deep};opacity:.55" d="${G.circleOf(L, 0, 1.6 + state.q, P, 20)}"/>`;
    }
  }
  out += `</g>`;
  el.coffee.innerHTML = out;
}
// steam off the cup: three wisps that rise, sway and fade, stronger as the cup fills
function steamSvg(time) {
  const strength = state.cupAlpha * smoothstep(6, 30, state.out);
  if (strength < 0.02 || still.matches) return "";
  const z0 = coffeeZ(state.out) + 1;
  let out = "";
  for (let i = 0; i < 3; i++) {
    const age = (time * 0.32 + i / 3) % 1;
    const env = Math.sin(Math.PI * age) * strength;
    const lift = age * 14;
    const pts = [];
    for (let j = 0; j <= 16; j++) {
      const f = j / 16;
      const z = z0 + lift + f * 30;
      const sway = Math.sin(f * 5.2 + time * 1.3 + i * 2.1) * (1.2 + f * 3.4) + (i - 1) * 4.2;
      pts.push(at([D.CUP.x + sway, D.CUP.y + (i - 1) * 2, z]));
    }
    const a = pts[0], b = pts[pts.length - 1];
    out += `<linearGradient id="es-steam-${i}" gradientUnits="userSpaceOnUse" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"><stop offset="0" stop-opacity="0" style="stop-color:var(--anatomy-mid)"/><stop offset=".3" stop-opacity="${(0.75 * env).toFixed(3)}" style="stop-color:var(--anatomy-mid)"/><stop offset="1" stop-opacity="0" style="stop-color:var(--anatomy-mid)"/></linearGradient>`;
    out += `<path class="es-steam" stroke="url(#es-steam-${i})" d="${pathOf(pts)}"/>`;
  }
  return out;
}
function drawStream(time) {
  const steam = steamSvg(time);
  if (state.phase !== "brew" || state.shotT <= 0) {
    if (el.stream.innerHTML !== steam) el.stream.innerHTML = steam;
    return;
  }
  const tips = PARTS.spoutTips(state.pose.c, state.pose.th);
  const z = coffeeZ(state.out);
  const share = clamp(state.out / D.M.TARGET, 0, 1);
  const fill = coffeeColour(share);
  let out = "";
  const each = state.q / 2;
  for (const [i, tip] of tips.entries()) {
    const top = at(tip);
    const bottom = at([tip[0], tip[1], z]);
    if (each < 0.16) {
      // drips: drops leave the spout at a rate set by the flow
      if (each <= 0.002) continue;
      const period = clamp(0.12 / each, 0.25, 1.4);
      const fall = Math.sqrt((2 * (tip[2] - z) * 0.002) / 9.81) * 1.0;
      for (let n = 0; n < 3; n++) {
        const age = ((time + i * 0.37) / period - n) % 3;
        const tt = (age * period) / Math.max(0.05, fall * 3);
        if (tt < 0 || tt > 1) continue;
        const y = lerp(top[1], bottom[1], tt * tt);
        out += `<ellipse class="es-drop" style="fill:${fill}" cx="${top[0].toFixed(2)}" cy="${y.toFixed(2)}" rx="${(0.55 * KS).toFixed(2)}" ry="${(0.75 * KS).toFixed(2)}"/>`;
      }
      out += `<ellipse class="es-drop" style="fill:${fill}" cx="${top[0].toFixed(2)}" cy="${(top[1] + 0.5 * KS).toFixed(2)}" rx="${(0.6 * KS).toFixed(2)}" ry="${(0.5 * KS).toFixed(2)}"/>`;
      continue;
    }
    const r0 = (0.4 + 0.5 * Math.sqrt(each)) * KS;
    const r1 = r0 * 0.72;
    const wob = Math.sin(time * 9 + i) * 0.12 * KS;
    const mid = (top[1] + bottom[1]) / 2;
    out += `<path class="es-stream" style="fill:${fill}" d="M${(top[0] - r0).toFixed(2)} ${top[1].toFixed(2)}Q${(top[0] - r1 * 1.1 + wob).toFixed(2)} ${mid.toFixed(2)} ${(top[0] - r1 + wob).toFixed(2)} ${bottom[1].toFixed(2)}L${(top[0] + r1 + wob).toFixed(2)} ${bottom[1].toFixed(2)}Q${(top[0] + r1 * 1.1 + wob).toFixed(2)} ${mid.toFixed(2)} ${(top[0] + r0).toFixed(2)} ${top[1].toFixed(2)}Z"/>`;
    // tiger stripes: darker bands running down the stream
    const stripe = coffeeColour(Math.max(0, share - 0.3));
    const phase = (time * 46) % 6;
    let bands = "";
    for (let y = top[1] + phase; y < bottom[1] - 1; y += 6) bands += `M${(top[0] - r1 * 0.5 + wob).toFixed(2)} ${y.toFixed(2)}v2.2`;
    if (share > 0.08 && share < 0.85) out += `<path d="${bands}" style="stroke:${stripe};stroke-width:${(r1 * 0.7).toFixed(2)};opacity:.7;fill:none" stroke-linecap="round"/>`;
  }
  el.stream.innerHTML = out + steam;
}
// grounds falling from the chute while the burrs turn
const GRAINS = Array.from({ length: 34 }, (_, i) => ({ seed: (i * 0.618) % 1, dx: ((i * 37) % 11) / 11 - 0.5, dy: ((i * 53) % 7) / 7 - 0.5 }));
function drawGrounds(time) {
  if (state.phase !== "grind") {
    if (el.grounds.innerHTML) el.grounds.innerHTML = "";
    return;
  }
  const c = state.pose.c;
  const from = [D.CHUTE.x, D.CHUTE.y, D.CHUTE.z];
  const to = c[2] + state.bed.level + state.bed.mound;
  const ramp = smoothstep(0, 0.35, state.clock) * (1 - smoothstep(0, 0.3, state.clock - (durationGrind() - 0.3)));
  const pts = [];
  for (const g of GRAINS) {
    const t = (g.seed + time * 1.7) % 1;
    const z = lerp(from[2], to, t * t);
    const spread = 1.4 + t * 2.2;
    pts.push([...at([from[0] + g.dx * spread, from[1] + g.dy * spread, z]), ramp * 0.95]);
  }
  el.grounds.innerHTML = dotsSvg(pts, { size: 0.42 * KS, tone: "hi" }).replace('class="iso-dots"', 'class="iso-dots es-fall"');
}
let lastPucks = "";
function drawPucks() {
  const n = Math.min(state.pucks, 6);
  const a = state.puckAlpha ?? 1;
  const key = n + "|" + a.toFixed(3);
  if (key === lastPucks) return;
  lastPucks = key;
  if (!n) {
    el.pucks.innerHTML = "";
    return;
  }
  const disc = (m, o) => `<path class="es-grounds" style="fill:var(--es-bean-bed)${o < 1 ? `;opacity:${o.toFixed(3)}` : ""}" d="${G.circleOf(G.frameOf([KN.x, KN.y, 6 + m * 1.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 11, P, 40)}"/>`;
  el.pucks.innerHTML = (n > 1 ? disc(n - 1, 1) : "") + disc(n, a);
}
function drawMachine(time) {
  const brewing = state.phase === "brew";
  const flowing = brewing && state.shotT > 0;
  el.water.forEach((list, i) => {
    const on = flowing && state.shotT > i * 0.6;
    for (const node of list) node.toggleAttribute("data-hot", on);
  });
  el.brewButton.toggleAttribute("data-on", brewing);
  // the vibration pump hums while it runs
  if (flowing && !still.matches) el.pump.setAttribute("transform", `translate(${(Math.sin(time * 310) * 0.22).toFixed(2)} ${(Math.cos(time * 290) * 0.18).toFixed(2)})`);
  else el.pump.removeAttribute("transform");
  const on = new Set(STEP_PARTS[state.step] ?? []);
  for (const node of el.marked) node.toggleAttribute("data-on", on.has(node.dataset.name));
}
function draw(time) {
  drawPf();
  drawTools();
  drawCollar();
  drawCup();
  drawStream(time);
  drawGrounds(time);
  drawPucks();
  drawMachine(time);
  setText(readout, readoutText());
  drawSteps();
}

// ── the sequence ──
const durationGrind = () => D.M.DOSE / D.M.GRIND_RATE / RATE;
const BREW_LEAD = 0.6;
function hold(text) {
  state.phase = "hold";
  state.holdText = text;
  state.stepDone = true;
}
function readoutText() {
  switch (state.phase) {
    case "ready":
      return "fresh roasted beans";
    case "hold":
      return state.holdText;
    case "grind":
      return "grinding";
    case "out":
      return "to the tamping mat";
    case "wdt":
      return "stirring out the clumps";
    case "level":
      return "levelling the top";
    case "tamp":
      return "pressing a firm puck";
    case "lock":
      return "locking in";
    case "brew": {
      if (state.shotT <= 0) return "button pressed · pump on";
      if (state.shotT < state.shot.firstDrop) return "soaking the coffee";
      return state.out < state.shot.out * 0.25 ? "first dark drops" : "a steady, honey-coloured stream";
    }
    case "done":
      return "ready to drink";
    case "knock":
      return "knocking out the used puck";
  }
  return "";
}
function announce(text) {
  if (status.textContent !== text) status.textContent = text;
}
function go(phase) {
  state.phase = phase;
  state.clock = 0;
  if (phase === "grind") {
    state.dose = 0;
    state.bed = { level: -16, mound: 0, spent: false, clumps: 0 };
  }
  if (phase === "brew") state.bed.spent = true;
}
function runTool(name) {
  const tool = TOOLS[name];
  const pose = poseTool(tool, state.clock);
  if (!pose) {
    tool.pose = { at: tool.park, layer: "home", work: null };
    return true;
  }
  tool.pose = pose;
  const b = state.bed;
  if (name === "wdt" && pose.work === "stir") {
    // the needles break the clumps and settle the dome
    const share = pose.seg.share ?? 1;
    const f = share - (1 - pose.e) / 24;
    b.clumps = 1 - smoothstep(0, 0.8, f);
    b.mound = lerp(LEVEL.loose.mound, LEVEL.stirred.mound, smoothstep(0, 1, f));
  }
  if (name === "level" && pose.work === "turn") {
    // three turns of the cap sweep the dome flat
    state.turn = smoothstep(0, 1, pose.e) * Math.PI * 6;
    b.mound = lerp(LEVEL.stirred.mound, 0, smoothstep(0, 0.7, pose.e));
    b.level = lerp(LEVEL.stirred.level, LEVEL.flat.level, smoothstep(0, 0.7, pose.e));
  }
  if (name === "tamp" && pose.work === "press") {
    const top = pose.at[2] - LIP;
    if (top < b.level + b.mound) {
      b.mound = Math.max(0, top - b.level);
      b.level = Math.min(b.level, Math.max(LEVEL.tamped.level, top));
    }
  }
  return false;
}
function step(dt) {
  state.clock += dt;
  switch (state.phase) {
    case "grind": {
      const T = durationGrind();
      const t = Math.min(state.clock, T);
      state.dose = Math.min(D.M.DOSE, D.M.GRIND_RATE * t * RATE);
      const f = state.dose / D.M.DOSE;
      state.bed.level = -16 + 16 * Math.min(1, f / 0.7);
      state.bed.mound = Math.max(0, (f - 0.7) / 0.3) * LEVEL.loose.mound;
      state.bed.clumps = smoothstep(0.5, 1, f);
      if (state.clock >= T + 0.35) go("out");
      break;
    }
    case "out":
    case "lock":
    case "knock": {
      const track = TRACKS[state.phase];
      const from = state.phase === "out" ? { c: GX, th: T_.grinder } : state.phase === "lock" ? { c: ST, th: T_.stand } : { c: GP, th: T_.group };
      const pose = poseAlong(track, from, state.clock);
      state.pose = pose;
      if (state.phase === "knock" && pose.knock && pose.share > 0.6 && !state.knocked) {
        state.knocked = true;
        state.knockAt = state.clock;
        state.pucks += 1;
      }
      if (state.knocked) {
        // the puck leaves the basket for the box over a third of a second
        const f = smoothstep(0, 0.35, state.clock - state.knockAt);
        state.bedAlpha = 1 - f;
        state.puckAlpha = f;
        if (f >= 1) {
          state.bed = { level: -16, mound: 0, spent: false, clumps: 0 };
          state.bedAlpha = 1;
        }
      }
      if (pose.done) {
        state.knocked = false;
        if (state.phase === "out") hold("dosed and on the mat");
        else if (state.phase === "lock") hold("locked in, ready to brew");
        else {
          go("ready");
          state.stepDone = true;
        }
      }
      break;
    }
    case "wdt":
    case "level":
    case "tamp":
      if (runTool(state.phase)) hold({ wdt: "clumps gone", level: "flat and even", tamp: "a firm, level puck" }[state.phase]);
      break;
    case "brew": {
      const t = state.clock;
      const shotT = Math.max(0, (t - BREW_LEAD) * RATE);
      const end = state.shot.time;
      if (shotT < end) {
        const row = M.sampleAt(state.shot, shotT);
        state.shotT = shotT;
        state.out = row.out;
        state.q = row.q;
        state.cupAlpha = 1;
      } else {
        state.shotT = end;
        state.out = state.shot.out;
        state.q = 0;
        if (t - BREW_LEAD - end / RATE > 0.5) {
          go("done");
          state.stepDone = true;
        }
      }
      break;
    }
  }
  // a fresh cup: the last shot's coffee fades as the next one is ground
  if ((state.phase === "grind" || state.phase === "knock") && state.cupAlpha > 0) state.cupAlpha = Math.max(0, state.cupAlpha - dt / 0.8);
  if ((state.phase === "grind" || state.phase === "knock") && state.cupAlpha === 0) state.out = 0;
}

// ── the walkthrough: eight steps, each plays and then holds ──
const STEPS = [
  { title: "Start with good beans", text: "Coffee begins as green seeds (left dish). Roasting turns them brown and fragrant. Keep them whole in the grinder's hopper until you brew." },
  { title: "Grind just before brewing", text: "The grinder crushes the beans into a powder about as fine as table salt, straight into the portafilter's basket." },
  { title: "Stir out the clumps", text: "A WDT tool, a handle with very thin needles, stirs the grounds so there are no clumps or air pockets left." },
  { title: "Level the top", text: "The distributor sits on the basket and spins, sweeping the grounds into a flat, even bed." },
  { title: "Press it firm", text: "The tamper squeezes the grounds into a firm, level puck, so the water has to pass through all of it evenly." },
  { title: "Lock it in", text: "The portafilter slides up under the machine and twists until it seals tight." },
  { title: "Brew", text: "Press the button. The pump draws water from the tank, the thermoblock heats it in seconds, and it's pushed through the coffee: a few dark drops, then a smooth stream." },
  { title: "Stop and enjoy", text: "Stop when the cup holds about twice as much as the coffee you started with. A good shot tastes sweet and rich, never sour or bitter." },
];
const STEP_PARTS = {
  0: ["hopper", "dish.green", "dish.roasted"],
  1: ["collar", "hopper.throat"],
  2: ["stand.ring"],
  3: ["stand.ring"],
  4: ["stand.ring"],
  6: ["button.two", "tank", "pump.coil", "thermoblock"],
  7: ["cup", "saucer"],
};
el.marked = $$(".it[data-name]").filter((node) => Object.values(STEP_PARTS).some((list) => list.includes(node.dataset.name)));
const HOLD = [4.4, 2.2, 2, 2, 2, 2, 1.6, 5.4];

function setPose(where, th) {
  state.pose = { c: A_[where], th, layer: where, clip: false };
}
function snapshot(k) {
  state.knocked = false;
  state.bedAlpha = 1;
  state.puckAlpha = 1;
  state.q = 0;
  state.turn = 0;
  for (const tool of Object.values(TOOLS)) tool.pose = { at: tool.park, layer: "home", work: null };
  const bedFor = [null, null, LEVEL.loose, LEVEL.stirred, LEVEL.flat, LEVEL.tamped, LEVEL.tamped, LEVEL.tamped][k];
  state.bed = bedFor ? { ...bedFor, spent: k >= 6, clumps: k === 2 ? 1 : 0 } : { level: -16, mound: 0, spent: false, clumps: 0 };
  state.dose = k >= 2 ? D.M.DOSE : 0;
  if (k <= 1) setPose("grinder", T_.grinder);
  else if (k <= 5) setPose("stand", T_.stand);
  else setPose("group", T_.group);
  if (k <= 6) {
    state.out = 0;
    state.shotT = 0;
    state.cupAlpha = 0;
  }
}
function enterStep(k, { fromEnd = false } = {}) {
  state.step = k;
  state.stepDone = false;
  state.holdClock = 0;
  if (k === 0 && fromEnd) go("knock"); // knock the puck out and take the portafilter back to the grinder
  else {
    snapshot(k);
    if (k === 0) {
      go("ready");
      state.stepDone = true;
    } else if (k === 1) go("grind");
    else if (k === 2) go("wdt");
    else if (k === 3) go("level");
    else if (k === 4) go("tamp");
    else if (k === 5) go("lock");
    else if (k === 6) go("brew");
    else if (k === 7) {
      state.out = state.shot.out;
      state.shotT = state.shot.time;
      state.cupAlpha = 1;
      go("done");
      state.stepDone = true;
    }
  }
  lastPf = "";
  for (const tool of Object.values(TOOLS)) tool.last = "";
  if (still.matches) for (let i = 0; i < 4000 && !state.stepDone; i++) step(1 / 30);
  run();
}
function next(manual) {
  if (manual) state.auto = false;
  if (state.step === STEPS.length - 1) enterStep(0, { fromEnd: true });
  else enterStep(state.step + 1);
}
function prev() {
  state.auto = false;
  enterStep(Math.max(0, state.step - 1));
}

// ── the step card and timeline ──
const nodes = [...document.querySelectorAll(".es-track [data-step]")];
const lineFill = document.querySelector(".es-line-fill");
const numEl = document.querySelector('[data-part="step-num"]');
const titleEl = document.querySelector('[data-part="step-title"]');
const textEl = document.querySelector('[data-part="step-text"]');
const card = document.querySelector(".es-card-main");
const playBtn = document.querySelector('[data-act="play"]');
const toolT = (name) => TOOLS[name].track.reduce((s, x) => s + x.dur, 0);
function stepShare() {
  if (state.stepDone) return 1;
  const k = state.step;
  if (k === 1) return state.phase === "grind" ? clamp(state.clock / (durationGrind() + 0.35), 0, 1) * 0.7 : 0.7 + 0.3 * clamp(state.clock / durationOf(TRACKS.out), 0, 1);
  if (k >= 2 && k <= 4) return clamp(state.clock / toolT(["wdt", "level", "tamp"][k - 2]), 0, 1);
  if (k === 5) return clamp(state.clock / durationOf(TRACKS.lock), 0, 1);
  if (k === 6) return clamp(state.clock / (BREW_LEAD + state.shot.time / RATE + 0.5), 0, 1);
  if (k === 0) return clamp(state.clock / durationOf(TRACKS.knock), 0, 1);
  return 1;
}
let shownStep = -1, shownAuto = null;
function drawSteps() {
  const n = STEPS.length;
  const share = stepShare();
  lineFill.style.transform = `scaleX(${((state.step + share) / n).toFixed(4)})`;
  if (shownStep !== state.step) {
    shownStep = state.step;
    nodes.forEach((d, i) => {
      d.dataset.state = i < state.step ? "done" : i === state.step ? "now" : "next";
      if (i === state.step) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    });
    setText(numEl, String(state.step + 1).padStart(2, "0"));
    setText(titleEl, STEPS[state.step].title);
    setText(textEl, STEPS[state.step].text);
    card.classList.remove("es-in");
    void card.offsetWidth;
    card.classList.add("es-in");
    announce(`Step ${state.step + 1} of ${n}: ${STEPS[state.step].title}. ${STEPS[state.step].text}`);
  }
  if (shownAuto !== state.auto) {
    shownAuto = state.auto;
    playBtn.setAttribute("aria-pressed", String(state.auto));
    playBtn.querySelector("span").textContent = state.auto ? "Pause" : "Play";
    playBtn.dataset.state = state.auto ? "playing" : "paused";
  }
}

let frame = 0, last = 0, visible = false, wall = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  wall += dt;
  if (!still.matches && !state.stepDone) step(dt);
  if (state.stepDone) state.holdClock += dt;
  if (state.auto && state.stepDone && state.holdClock > HOLD[state.step]) next(false);
  draw(wall);
  const steaming = state.cupAlpha > 0 && state.out > 6 && !still.matches;
  frame = visible && (!state.stepDone || state.auto || steaming) ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

const plate = stage.closest(".iso-plate");
plate.addEventListener("keydown", (event) => {
  if (event.target.closest("button") && (event.key === " " || event.key === "Enter")) return;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next(true);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") prev();
  else if (event.key === "Home") {
    state.auto = false;
    enterStep(0);
  } else if (event.key === "End") {
    state.auto = false;
    enterStep(STEPS.length - 1);
  } else if (event.key === " ") {
    state.auto = !state.auto;
    run();
  } else return;
  event.preventDefault();
});
document.querySelector('[data-act="prev"]').addEventListener("click", prev);
document.querySelector('[data-act="next"]').addEventListener("click", () => next(true));
nodes.forEach((d) => d.addEventListener("click", () => {
  state.auto = false;
  enterStep(Number(d.dataset.step));
}));
playBtn.addEventListener("click", () => {
  state.auto = !state.auto;
  if (state.auto && state.stepDone) state.holdClock = HOLD[state.step];
  run();
});
stage.addEventListener("click", () => next(true));
enterStep(0);
draw(0);
