// Lamborghini FL3 Live Instruments (Canvas 2D, ink on paper style)
// 1. Tachometer (period Italian dial with rolling tenths hour meter)
// 2. The Cycle (720° wheel, 3 rings, firing order 1-2-3 offset 240°)
// 3. Indicator Diagram (live P-V loop for cylinder 1, dashed full-load reference)
// 4. Chart Recorder (scrolling chart paper with rpm pen and power pen)

export class FL3Instruments {
  constructor() {
    this.history = [];
    this.maxHistory = 180;
    this.hourCounter = 214.3; // tractor engine operating hours
    this.fireFlash = [0, 0, 0]; // flash decay timers for cylinders 1, 2, 3
  }

  // Flash indicator on cylinder firing
  onFire(cyl) {
    if (cyl >= 1 && cyl <= 3) {
      this.fireFlash[cyl - 1] = 1.0;
    }
  }

  update(dt, sim) {
    // Accumulate hour meter if running
    if (sim.rpm > 100) {
      this.hourCounter += (dt * (sim.rpm / 2200)) / 3600;
    }

    // Decay firing flash
    for (let i = 0; i < 3; i++) {
      if (this.fireFlash[i] > 0) {
        this.fireFlash[i] = Math.max(0, this.fireFlash[i] - dt * 4.0);
      }
    }

    // Chart recorder buffer
    this.history.push({
      rpm: sim.rpm,
      hp: sim.brakePowerHp
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  // 1. TACHOMETER
  drawTachometer(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 6;
    const radius = Math.min(w, h) * 0.44;

    // Dial background paper plate
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#EEE9DC';
    ctx.fill();
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner subtle ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.94, 0, Math.PI * 2);
    ctx.strokeStyle = '#D8D2C2';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Angle range: 0 at 225 deg (135 deg from top-left), 25 at -45 deg (top-right)
    // Total sweep 270 degrees: from 135° to 405° (or 0.75*PI to 2.25*PI)
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const sweep = endAngle - startAngle;

    // Arancio danger / overspeed arc from 2200 to 2500 rpm (22 to 25 x100)
    const overspeedStart = startAngle + sweep * (22 / 25);
    const overspeedEnd = endAngle;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, overspeedStart, overspeedEnd);
    ctx.strokeStyle = '#E0561C';
    ctx.lineWidth = radius * 0.12;
    ctx.stroke();

    // Rated speed tick mark at 22 (2,200 rpm)
    const ratedAng = startAngle + sweep * (22 / 25);
    const rIn = radius * 0.68;
    const rOut = radius * 0.88;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ratedAng) * rIn, cy + Math.sin(ratedAng) * rIn);
    ctx.lineTo(cx + Math.cos(ratedAng) * rOut, cy + Math.sin(ratedAng) * rOut);
    ctx.strokeStyle = '#E0561C';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Ticks & numbers 0 to 25
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1C1B19';

    for (let i = 0; i <= 25; i++) {
      const ang = startAngle + sweep * (i / 25);
      const isMajor = i % 5 === 0;
      const isMedium = i % 1 === 0;
      const tLen = isMajor ? radius * 0.14 : radius * 0.08;
      const tR1 = radius * 0.88;
      const tR2 = tR1 - tLen;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * tR1, cy + Math.sin(ang) * tR1);
      ctx.lineTo(cx + Math.cos(ang) * tR2, cy + Math.sin(ang) * tR2);
      ctx.strokeStyle = isMajor && i >= 22 ? '#E0561C' : '#1C1B19';
      ctx.lineWidth = isMajor ? 2.0 : 1.0;
      ctx.stroke();

      if (isMajor) {
        const numR = radius * 0.62;
        const nx = cx + Math.cos(ang) * numR;
        const ny = cy + Math.sin(ang) * numR;
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillStyle = i >= 22 ? '#E0561C' : '#1C1B19';
        ctx.fillText(i.toString(), nx, ny);
      }
    }

    // Dial lettering
    ctx.fillStyle = '#1C1B19';
    ctx.font = '700 8.5px "Archivo", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('GIRI AL MINUTO', cx, cy - radius * 0.32);

    ctx.font = 'italic 400 8px "Bodoni Moda", serif';
    ctx.fillStyle = '#E0561C';
    ctx.fillText('x 100', cx, cy - radius * 0.20);

    // Factory badge text
    ctx.font = '600 7px "Archivo", sans-serif';
    ctx.fillStyle = '#58AED6';
    ctx.fillText('BANCO PROVA · FL3', cx, cy + radius * 0.24);

    // Mechanical Hour Meter drum window
    const hw = radius * 0.65;
    const hh = radius * 0.22;
    const hx = cx - hw / 2;
    const hy = cy + radius * 0.38;

    ctx.fillStyle = '#1C1B19';
    ctx.fillRect(hx, hy, hw, hh);
    ctx.strokeStyle = '#8A857D';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, hw, hh);

    // Format hours: 5 digits black background, tenths white with red/orange ink
    const wholeHours = Math.floor(this.hourCounter);
    const tenths = Math.floor((this.hourCounter % 1) * 10);
    const hoursStr = wholeHours.toString().padStart(5, '0');

    ctx.font = '600 9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const digitW = hw / 6;

    for (let d = 0; d < 5; d++) {
      ctx.fillStyle = '#EEE9DC';
      ctx.fillText(hoursStr[d], hx + digitW * (d + 0.5), hy + hh / 2 + 0.5);
    }
    // Tenths drum (orange with black text)
    ctx.fillStyle = '#E0561C';
    ctx.fillRect(hx + digitW * 5, hy, digitW, hh);
    ctx.fillStyle = '#EEE9DC';
    ctx.fillText(tenths.toString(), hx + digitW * 5.5, hy + hh / 2 + 0.5);

    // Needle pointer
    const needleRpm = Math.max(0, Math.min(2500, sim.rpm));
    const needleAng = startAngle + sweep * (needleRpm / 2500);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(needleAng);

    ctx.beginPath();
    ctx.moveTo(-radius * 0.12, -2.5);
    ctx.lineTo(radius * 0.85, 0);
    ctx.lineTo(-radius * 0.12, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#1C1B19';
    ctx.fill();

    // Center brass cap
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#E0561C';
    ctx.fill();
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  // 2. THE CYCLE (720° wheel with 3 concentric rings)
  drawCycleWheel(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 4;
    const maxR = Math.min(w, h) * 0.44;
    const ringThick = maxR * 0.18;

    ctx.save();

    // 4 Strokes over 720 degrees:
    // 0..180: Expansion (Power) -> Arancio #E0561C
    // 180..360: Exhaust -> Grey #8A857D
    // 360..540: Intake -> Celeste #58AED6
    // 540..720: Compression -> Hatched near-black on cream

    const cylOffsets = [0, 240, 480]; // degrees
    const cylNames = ['CYL 1', 'CYL 2', 'CYL 3'];

    for (let c = 0; c < 3; c++) {
      const rOut = maxR - c * (ringThick + 2.5);
      const rIn = rOut - ringThick;
      const offsetDeg = cylOffsets[c];

      // Draw the 4 stroke sectors for this cylinder
      const strokes = [
        { start: 0, end: 180, color: '#E0561C', name: 'EXP' },
        { start: 180, end: 360, color: '#8A857D', name: 'SCA' },
        { start: 360, end: 540, color: '#58AED6', name: 'ASP' },
        { start: 540, end: 720, color: '#C8C2B2', name: 'COM', hatch: true }
      ];

      for (const stroke of strokes) {
        // Map 0..720 deg to 0..2*PI radians
        const a1 = (((stroke.start + offsetDeg) % 720) / 720) * Math.PI * 2 - Math.PI / 2;
        const a2 = (((stroke.end + offsetDeg) % 720) / 720) * Math.PI * 2 - Math.PI / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, rOut, a1, a2, false);
        ctx.arc(cx, cy, rIn, a2, a1, true);
        ctx.closePath();
        ctx.fillStyle = stroke.color;
        ctx.fill();
        ctx.strokeStyle = '#EEE9DC';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Hatched lines for compression stroke
        if (stroke.hatch) {
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = '#1C1B19';
          ctx.lineWidth = 1.0;
          for (let step = -maxR; step < maxR * 2; step += 4) {
            ctx.beginPath();
            ctx.moveTo(cx - maxR + step, cy - maxR);
            ctx.lineTo(cx - maxR + step + maxR, cy + maxR);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Cylinder firing flash dot
      if (this.fireFlash[c] > 0) {
        const fireAngle = ((offsetDeg % 720) / 720) * Math.PI * 2 - Math.PI / 2;
        const dotR = (rIn + rOut) / 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(fireAngle) * dotR, cy + Math.sin(fireAngle) * dotR, 4.5 * this.fireFlash[c], 0, Math.PI * 2);
        ctx.fillStyle = '#E0561C';
        ctx.fill();
        ctx.strokeStyle = '#1C1B19';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Degree markings around outer wheel (0, 180, 360, 540)
    ctx.font = '600 7.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1C1B19';
    const markers = [
      { deg: 0, label: '0° PMS' },
      { deg: 180, label: '180° PMI' },
      { deg: 360, label: '360° PMS' },
      { deg: 540, label: '540° PMI' }
    ];
    for (const m of markers) {
      const rad = (m.deg / 720) * Math.PI * 2 - Math.PI / 2;
      const lx = cx + Math.cos(rad) * (maxR + 10);
      const ly = cy + Math.sin(rad) * (maxR + 10);
      ctx.fillText(m.label, lx, ly);
    }

    // Central crank pointer
    const currentDeg = ((sim.crankAngle * 180 / Math.PI) % 720 + 720) % 720;
    const pointerRad = (currentDeg / 720) * Math.PI * 2 - Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pointerRad);

    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(maxR + 4, 0);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fillStyle = '#1C1B19';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#E0561C';
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Title label
    ctx.font = '700 8.5px "Archivo", sans-serif';
    ctx.fillStyle = '#1C1B19';
    ctx.fillText('CICLO 720° · 1-2-3', cx, cy - maxR * 0.15);

    ctx.restore();
  }

  // 3. INDICATOR DIAGRAM (P-V Loop for Cylinder 1)
  drawPvDiagram(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 36;
    const padR = 18;
    const padT = 24;
    const padB = 28;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    ctx.save();

    // Grid paper lines
    ctx.strokeStyle = '#DDD7C7';
    ctx.lineWidth = 0.8;
    for (let p = 0; p <= 80; p += 20) {
      const y = padT + graphH - (p / 80) * graphH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + graphW, y);
      ctx.stroke();

      ctx.font = '500 8px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#1C1B19';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.toString(), padL - 4, y);
    }

    // Volume ticks (Vc ~45 cc to Vbdc ~775 cc)
    const vMin = 40;
    const vMax = 800;
    for (let v = 200; v <= 800; v += 200) {
      const x = padL + ((v - vMin) / (vMax - vMin)) * graphW;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + graphH);
      ctx.stroke();

      ctx.font = '500 8px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#1C1B19';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(v.toString(), x, padT + graphH + 3);
    }

    // Axis labels
    ctx.font = '700 8px "Archivo", sans-serif';
    ctx.fillStyle = '#1C1B19';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('P (bar)', padL - 10, padT - 6);

    ctx.textAlign = 'right';
    ctx.fillText('V (cm³)', padL + graphW, padT + graphH + 20);

    // Reference Full Load Loop (dashed celeste)
    if (sim.pvLoopReference && sim.pvLoopReference.length > 0) {
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#58AED6';
      ctx.lineWidth = 1.2;

      for (let i = 0; i < sim.pvLoopReference.length; i++) {
        const pt = sim.pvLoopReference[i];
        const x = padL + ((pt.V - vMin) / (vMax - vMin)) * graphW;
        const y = padT + graphH - (pt.P / 80) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Live P-V Loop for Cylinder 1
    if (sim.pvLoopData && sim.pvLoopData.length > 2) {
      ctx.beginPath();
      ctx.strokeStyle = '#1C1B19';
      ctx.lineWidth = 1.8;

      for (let i = 0; i < sim.pvLoopData.length; i++) {
        const pt = sim.pvLoopData[i];
        const x = padL + Math.max(0, Math.min(graphW, ((pt.V - vMin) / (vMax - vMin)) * graphW));
        const y = padT + graphH - Math.max(0, Math.min(graphH, (pt.P / 80) * graphH));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Live state dot
    const curV = sim.cylVolumes[0] * 1e6;
    const curP = sim.cylPressures[0];
    const curX = padL + ((curV - vMin) / (vMax - vMin)) * graphW;
    const curY = padT + graphH - (curP / 80) * graphH;

    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#E0561C';
    ctx.fill();
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Peak pressure callout
    const peakP = sim.recentPeakPressure || 1.0;
    ctx.font = '600 9px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#E0561C';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Pmax = ${peakP.toFixed(1)} bar`, padL + graphW - 4, padT + 2);

    ctx.restore();
  }

  // 4. CHART RECORDER (scrolling chart paper with rpm pen & power pen)
  drawChartRecorder(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const padL = 32;
    const padR = 14;
    const padT = 20;
    const padB = 22;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    ctx.save();

    // Chart paper faint green/celeste grid
    ctx.strokeStyle = '#DDD8C8';
    ctx.lineWidth = 0.8;

    // Horizontal grid lines (0 to 2500 rpm)
    for (let r = 0; r <= 2500; r += 500) {
      const y = padT + graphH - (r / 2500) * graphH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + graphW, y);
      ctx.stroke();

      ctx.font = '500 7.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#1C1B19';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText((r / 100).toString(), padL - 3, y);
    }

    // Vertical time grid lines
    const tSteps = 6;
    for (let s = 0; s <= tSteps; s++) {
      const x = padL + (s / tSteps) * graphW;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + graphH);
      ctx.stroke();
    }

    // Legend
    ctx.font = '700 7.5px "Archivo", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#1C1B19';
    ctx.fillText('RPM (nero)', padL + 4, padT - 14);

    ctx.fillStyle = '#E0561C';
    ctx.fillText('CV (arancio)', padL + 75, padT - 14);

    // Plot RPM curve (Black pen)
    if (this.history.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#1C1B19';
      ctx.lineWidth = 1.6;

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const x = padL + (i / (this.maxHistory - 1)) * graphW;
        const y = padT + graphH - (pt.rpm / 2500) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Plot Power curve (Arancio pen, 0 to 45 hp)
      ctx.beginPath();
      ctx.strokeStyle = '#E0561C';
      ctx.lineWidth = 1.6;

      for (let i = 0; i < this.history.length; i++) {
        const pt = this.history[i];
        const x = padL + (i / (this.maxHistory - 1)) * graphW;
        const y = padT + graphH - (Math.max(0, pt.hp) / 45) * graphH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
