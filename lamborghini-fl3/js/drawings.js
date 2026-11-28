// Lamborghini FL3 Diazo Blueline Live Technical Drawings
// Real orthographic projections of the running engine:
// 1. Front View (vista anteriore)
// 2. Right Side View (vista fianco dx)
// 3. Plan View (vista dall'alto)
// 4. Section A-A (sezione A-A attraverso cilindro 1 con pistone mobile, valvole e quote Ø 92, 110)

export class FL3Drawings {
  constructor() {
    this.gridColor = 'rgba(88, 174, 214, 0.22)';
    this.lineBlue = '#2B6B92';
    this.fillBlue = 'rgba(88, 174, 214, 0.15)';
    this.hatchArancio = '#E0561C';
    this.paperBg = '#EEE9DC';
  }

  // Draw diazo paper background and faint metric grid
  drawDiazoPaper(ctx, w, h) {
    ctx.fillStyle = this.paperBg;
    ctx.fillRect(0, 0, w, h);

    // Faint 10px blueprint grid
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 10) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 10) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Sheet margin border
    ctx.strokeStyle = '#2B6B92';
    ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }

  // Draw standard engineering centre line (dash-dot)
  drawCentreLine(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.setLineDash([8, 3, 2, 3]);
    ctx.strokeStyle = '#58AED6';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw 45° arancio sectional hatch lines
  drawHatchRect(ctx, x, y, w, h, step = 5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = this.hatchArancio;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const diag = w + h;
    for (let d = -diag; d < diag * 2; d += step) {
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw 45° celeste screentone shading
  drawScreentoneRect(ctx, x, y, w, h, step = 4) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(88, 174, 214, 0.28)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const diag = w + h;
    for (let d = -diag; d < diag * 2; d += step) {
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 1. FRONT VIEW (Vista anteriore - looking at blower, V-belt, pulleys, exhaust stack)
  drawFrontView(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.drawDiazoPaper(ctx, w, h);

    const cx = w / 2;
    const cy = h * 0.58;

    ctx.save();

    // Vertical centre line
    this.drawCentreLine(ctx, cx, 10, cx, h - 10);

    // Arancio test stand bed
    ctx.fillStyle = '#EFE9DE';
    ctx.strokeStyle = this.lineBlue;
    ctx.lineWidth = 1.2;
    ctx.fillRect(cx - 50, cy + 32, 100, 18);
    ctx.strokeRect(cx - 50, cy + 32, 100, 18);
    this.drawScreentoneRect(ctx, cx - 50, cy + 32, 100, 18);

    // Crankcase front face
    ctx.fillStyle = this.fillBlue;
    ctx.beginPath();
    ctx.rect(cx - 36, cy - 25, 72, 57);
    ctx.fill();
    ctx.stroke();
    this.drawScreentoneRect(ctx, cx - 36, cy - 25, 72, 57);

    // Crankshaft pulley (spinning)
    const crankRot = sim.crankAngle;
    ctx.beginPath();
    ctx.arc(cx, cy + 12, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#DDD8C8';
    ctx.fill();
    ctx.stroke();

    // Pulley spokes
    ctx.save();
    ctx.translate(cx, cy + 12);
    ctx.rotate(crankRot);
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
    ctx.moveTo(0, -12); ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();

    // Dynamo pulley (left / hot side)
    const dynamoX = cx - 38;
    const dynamoY = cy - 2;
    ctx.beginPath();
    ctx.arc(dynamoX, dynamoY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#DDD8C8';
    ctx.fill();
    ctx.stroke();

    // Blower housing & rotor (upper centre / cold side)
    const blowerX = cx + 2;
    const blowerY = cy - 35;
    const blowerR = 24;

    ctx.beginPath();
    ctx.arc(blowerX, blowerY, blowerR, 0, Math.PI * 2);
    ctx.fillStyle = this.fillBlue;
    ctx.fill();
    ctx.stroke();

    // Fixed stator vanes
    for (let sv = 0; sv < 8; sv++) {
      const ang = (sv / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(blowerX + Math.cos(ang) * 8, blowerY + Math.sin(ang) * 8);
      ctx.lineTo(blowerX + Math.cos(ang) * 20, blowerY + Math.sin(ang) * 20);
      ctx.strokeStyle = 'rgba(43, 107, 146, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Blower rotor blades (spinning clockwise)
    ctx.save();
    ctx.translate(blowerX, blowerY);
    ctx.rotate(crankRot * 1.4);
    for (let b = 0; b < 12; b++) {
      const ang = (b / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 5, Math.sin(ang) * 5);
      ctx.lineTo(Math.cos(ang) * 22, Math.sin(ang) * 22);
      ctx.strokeStyle = this.lineBlue;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Wire guard concentric rings
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // V-belt running between crank, dynamo, and blower pulleys
    ctx.beginPath();
    ctx.moveTo(cx + 12, cy + 12);
    ctx.lineTo(blowerX + 20, blowerY);
    ctx.lineTo(dynamoX + 7, dynamoY - 4);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.closePath();
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Exhaust vertical stack (left / hot side)
    const stackX = cx - 28;
    const stackTopY = 16;
    ctx.fillStyle = '#DDD8C8';
    ctx.fillRect(stackX - 4, stackTopY + 12, 8, cy - 35 - stackTopY);
    ctx.strokeRect(stackX - 4, stackTopY + 12, 8, cy - 35 - stackTopY);

    // Silencer barrel
    ctx.fillRect(stackX - 8, stackTopY + 22, 16, 26);
    ctx.strokeRect(stackX - 8, stackTopY + 22, 16, 26);
    this.drawScreentoneRect(ctx, stackX - 8, stackTopY + 22, 16, 26);

    // Rain cap flapper at top (lifts on exhaust pulse at idle)
    const capLift = sim.rpm > 100 ? (sim.rpm < 1200 ? Math.sin(crankRot * 1.5) * 0.25 + 0.15 : 0.45) : 0;
    ctx.save();
    ctx.translate(stackX - 4, stackTopY + 12);
    ctx.rotate(-capLift);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(12, -2);
    ctx.strokeStyle = '#E0561C';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    // Cylinder heads & barrels visible behind blower
    ctx.strokeRect(cx - 24, cy - 62, 48, 22);

    // Title & annotation
    ctx.font = '700 8px "Archivo", sans-serif';
    ctx.fillStyle = this.lineBlue;
    ctx.textAlign = 'left';
    ctx.fillText('VISTA ANTERIORE · FRONT', 8, 14);

    ctx.font = 'italic 400 7.5px "Bodoni Moda", serif';
    ctx.fillText('Ventilatore assiale e trasmissione', 8, 24);

    ctx.restore();
  }

  // 2. RIGHT SIDE VIEW (Vista fianco dx - cold side / air cowl / blower intake)
  drawRightSideView(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.drawDiazoPaper(ctx, w, h);

    const cx = w * 0.48;
    const cy = h * 0.58;

    ctx.save();

    // 3 Cylinder centre lines
    const cylSpacing = 36;
    const cylX = [cx - cylSpacing, cx, cx + cylSpacing];
    for (let i = 0; i < 3; i++) {
      this.drawCentreLine(ctx, cylX[i], 18, cylX[i], cy + 28);
      ctx.font = '600 7px "IBM Plex Mono", monospace';
      ctx.fillStyle = this.lineBlue;
      ctx.textAlign = 'center';
      ctx.fillText(`N. ${i + 1}`, cylX[i], 16);
    }

    // Crankcase
    ctx.fillStyle = this.fillBlue;
    ctx.fillRect(cx - 58, cy - 10, 116, 42);
    ctx.strokeStyle = this.lineBlue;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(cx - 58, cy - 10, 116, 42);
    this.drawScreentoneRect(ctx, cx - 58, cy - 10, 116, 42);

    // Flywheel at rear (right side in this projection)
    ctx.fillStyle = '#DDD8C8';
    ctx.fillRect(cx + 56, cy - 18, 12, 54);
    ctx.strokeRect(cx + 56, cy - 18, 12, 54);

    // Air cowl covering cold side of the 3 cylinders
    ctx.fillStyle = 'rgba(88, 174, 214, 0.25)';
    ctx.beginPath();
    ctx.rect(cx - 54, cy - 58, 108, 48);
    ctx.fill();
    ctx.stroke();

    // Factory stencil on air cowl
    ctx.font = '600 6.5px "Archivo", sans-serif';
    ctx.fillStyle = '#1C1B19';
    ctx.textAlign = 'center';
    ctx.fillText('FL3 · RAFFREDDATO AD ARIA', cx, cy - 32);

    // Blower housing at front (left)
    ctx.fillStyle = this.fillBlue;
    ctx.beginPath();
    ctx.arc(cx - 58, cy - 12, 18, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.font = '700 8px "Archivo", sans-serif';
    ctx.fillStyle = this.lineBlue;
    ctx.textAlign = 'left';
    ctx.fillText('FIANCO DX · RIGHT (COLD SIDE)', 8, 14);

    ctx.font = 'italic 400 7.5px "Bodoni Moda", serif';
    ctx.fillText('Convogliatore aria e volano', 8, 24);

    ctx.restore();
  }

  // 3. PLAN VIEW (Vista dall'alto - top view showing 3 finned heads & rocker covers)
  drawPlanView(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.drawDiazoPaper(ctx, w, h);

    const cx = w * 0.48;
    const cy = h * 0.52;

    ctx.save();

    // Longitudinal centre line
    this.drawCentreLine(ctx, 12, cy, w - 12, cy);

    // Cylinders 1, 2, 3 transverse centre lines
    const cylSpacing = 36;
    const cylX = [cx - cylSpacing, cx, cx + cylSpacing];
    for (let i = 0; i < 3; i++) {
      this.drawCentreLine(ctx, cylX[i], 12, cylX[i], h - 12);
    }

    // 3 Individual Finned Heads (flattened where neighbours meet)
    for (let i = 0; i < 3; i++) {
      const x = cylX[i];

      // Finned perimeter
      ctx.fillStyle = this.fillBlue;
      ctx.strokeStyle = this.lineBlue;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(x - 16, cy - 28, 32, 56, 3);
      ctx.fill();
      ctx.stroke();
      this.drawScreentoneRect(ctx, x - 16, cy - 28, 32, 56);

      // Rocker cover in centre
      ctx.fillStyle = '#EEE9DC';
      ctx.strokeRect(x - 10, cy - 16, 20, 32);

      // 4 head through-stud nuts
      const nutR = 2;
      const studs = [
        { sx: x - 12, sy: cy - 22 },
        { sx: x + 12, sy: cy - 22 },
        { sx: x - 12, sy: cy + 22 },
        { sx: x + 12, sy: cy + 22 }
      ];
      for (const s of studs) {
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, nutR, 0, Math.PI * 2);
        ctx.fillStyle = '#1C1B19';
        ctx.fill();
      }
    }

    // Blower at front (left)
    ctx.beginPath();
    ctx.arc(cx - 56, cy, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Flywheel at rear (right)
    ctx.strokeRect(cx + 56, cy - 22, 10, 44);

    // Title
    ctx.font = '700 8px "Archivo", sans-serif';
    ctx.fillStyle = this.lineBlue;
    ctx.textAlign = 'left';
    ctx.fillText('PIANTA · PLAN VIEW', 8, 14);

    ctx.font = 'italic 400 7.5px "Bodoni Moda", serif';
    ctx.fillText('Tre testate alettate individuali', 8, 24);

    ctx.restore();
  }

  // 4. SECTION A-A (Sezione A-A attraverso cilindro 1 con pistone mobile, valvole e quote Ø 92, 110)
  drawSectionAA(canvas, sim) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.drawDiazoPaper(ctx, w, h);

    const cx = w * 0.44;
    const crankY = h * 0.72; // crank axis
    const tdcY = h * 0.28;   // Top Dead Centre (PMS)
    const strokePixels = 48; // corresponds to 110 mm stroke
    const bdcY = tdcY + strokePixels; // Bottom Dead Centre (PMI)

    // Calculate live piston position for cylinder 1 from slider-crank kinematics
    const crankAngle = sim.crankAngle;
    const r = 24;  // crank radius in pixels (55 mm)
    const l = 88;  // rod length in pixels (200 mm)
    const sinT = Math.sin(crankAngle);
    const cosT = Math.cos(crankAngle);
    const s = r * (1 - cosT) + l - Math.sqrt(Math.max(1, l * l - r * r * sinT * sinT));
    const pistonY = tdcY + (s / (2 * r)) * strokePixels;

    // Cylinder 1 degrees in 720 cycle
    const cyl1Deg = ((crankAngle * 180 / Math.PI) % 720 + 720) % 720;
    const valveLifts = sim.getValveLifts(cyl1Deg);

    ctx.save();

    // Cylinder 1 Centre line (dash-dot blue)
    this.drawCentreLine(ctx, cx, 12, cx, h - 8);

    // Section cut hatching for cylinder 1 barrel walls (45° arancio hatch)
    const boreWidthPixels = 40; // corresponds to 92 mm bore
    const barrelWall = 10;
    const barrelL = cx - boreWidthPixels / 2 - barrelWall;
    const barrelR = cx + boreWidthPixels / 2;
    const barrelTop = tdcY - 14;
    const barrelHeight = strokePixels + 28;

    // Left wall hatch
    this.drawHatchRect(ctx, barrelL, barrelTop, barrelWall, barrelHeight);
    ctx.strokeStyle = this.lineBlue;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(barrelL, barrelTop, barrelWall, barrelHeight);

    // Right wall hatch
    this.drawHatchRect(ctx, barrelR, barrelTop, barrelWall, barrelHeight);
    ctx.strokeRect(barrelR, barrelTop, barrelWall, barrelHeight);

    // Cast horizontal cooling fins along barrel walls
    for (let finY = barrelTop + 4; finY < barrelTop + barrelHeight; finY += 6) {
      ctx.beginPath();
      ctx.moveTo(barrelL - 8, finY);
      ctx.lineTo(barrelL, finY);
      ctx.moveTo(barrelR + barrelWall, finY);
      ctx.lineTo(barrelR + barrelWall + 8, finY);
      ctx.stroke();
    }

    // Cylinder head section (top)
    this.drawHatchRect(ctx, barrelL - 6, barrelTop - 12, boreWidthPixels + barrelWall * 2 + 12, 12);
    ctx.strokeRect(barrelL - 6, barrelTop - 12, boreWidthPixels + barrelWall * 2 + 12, 12);

    // LIVE VALVES in cylinder head (Intake left, Exhaust right)
    const inValveLift = valveLifts.intake * 6.5; // pixels
    const exValveLift = valveLifts.exhaust * 6.5;

    // Intake valve (left, x = cx - 11)
    const inVx = cx - 11;
    ctx.beginPath();
    ctx.moveTo(inVx, barrelTop - 18);
    ctx.lineTo(inVx, barrelTop + inValveLift);
    ctx.moveTo(inVx - 5, barrelTop + inValveLift);
    ctx.lineTo(inVx + 5, barrelTop + inValveLift);
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Exhaust valve (right, x = cx + 11)
    const exVx = cx + 11;
    ctx.beginPath();
    ctx.moveTo(exVx, barrelTop - 18);
    ctx.lineTo(exVx, barrelTop + exValveLift);
    ctx.moveTo(exVx - 5, barrelTop + exValveLift);
    ctx.lineTo(exVx + 5, barrelTop + exValveLift);
    ctx.stroke();

    // Injector nozzle in head centre
    ctx.fillStyle = '#E0561C';
    ctx.fillRect(cx - 2, barrelTop - 12, 4, 14);

    // PISTON (moving in real time)
    const pistonH = 32;
    const pistonW = boreWidthPixels - 1.5;
    const pinY = pistonY + pistonH * 0.55;

    ctx.fillStyle = '#EEE9DC';
    ctx.strokeStyle = this.lineBlue;
    ctx.lineWidth = 1.2;

    // Piston crown with direct-injection combustion bowl (cavità toroide)
    ctx.beginPath();
    ctx.moveTo(cx - pistonW / 2, pistonY);
    ctx.lineTo(cx - 8, pistonY);
    ctx.arc(cx, pistonY + 3, 8, Math.PI, 0, true);
    ctx.lineTo(cx + pistonW / 2, pistonY);
    ctx.lineTo(cx + pistonW / 2, pistonY + pistonH);
    ctx.lineTo(cx - pistonW / 2, pistonY + pistonH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Piston rings (3 compression rings + 1 oil scraper ring)
    for (let ring = 3; ring <= 15; ring += 4) {
      ctx.beginPath();
      ctx.moveTo(cx - pistonW / 2, pistonY + ring);
      ctx.lineTo(cx - pistonW / 2 + 3, pistonY + ring);
      ctx.moveTo(cx + pistonW / 2 - 3, pistonY + ring);
      ctx.lineTo(cx + pistonW / 2, pistonY + ring);
      ctx.stroke();
    }

    // Gudgeon pin (piston wrist pin)
    ctx.beginPath();
    ctx.arc(cx, pinY, 4, 0, Math.PI * 2);
    ctx.stroke();

    // CRANKSHAFT JOURNAL (rotating clockwise)
    const crankPinX = cx + Math.sin(crankAngle) * r;
    const crankPinY = crankY - Math.cos(crankAngle) * r;

    // Connecting Rod
    ctx.beginPath();
    ctx.moveTo(cx, pinY);
    ctx.lineTo(crankPinX, crankPinY);
    ctx.strokeStyle = this.lineBlue;
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Rod big end
    ctx.beginPath();
    ctx.arc(crankPinX, crankPinY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#EEE9DC';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crankshaft main journal & counterweight
    ctx.beginPath();
    ctx.arc(cx, crankY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#DDD8C8';
    ctx.fill();
    ctx.stroke();

    // PMS (Top Dead Centre) line
    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = '#E0561C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 30, tdcY);
    ctx.lineTo(cx + 30, tdcY);
    ctx.stroke();

    ctx.font = '600 7px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#E0561C';
    ctx.textAlign = 'right';
    ctx.fillText('PMS (TDC)', cx - 32, tdcY + 2);

    // PMI (Bottom Dead Centre) line
    ctx.beginPath();
    ctx.moveTo(cx - 30, bdcY);
    ctx.lineTo(cx + 30, bdcY);
    ctx.stroke();
    ctx.fillText('PMI (BDC)', cx - 32, bdcY + 2);
    ctx.setLineDash([]);

    // DIMENSIONS (Only published facts: Ø 92 bore, 110 stroke)
    // 1. Bore dimension: Ø 92 (top)
    const dimY = barrelTop - 22;
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 0.8;

    // Extension lines
    ctx.beginPath();
    ctx.moveTo(cx - boreWidthPixels / 2, barrelTop - 4);
    ctx.lineTo(cx - boreWidthPixels / 2, dimY - 4);
    ctx.moveTo(cx + boreWidthPixels / 2, barrelTop - 4);
    ctx.lineTo(cx + boreWidthPixels / 2, dimY - 4);
    ctx.stroke();

    // Dimension line with arrows
    ctx.beginPath();
    ctx.moveTo(cx - boreWidthPixels / 2, dimY);
    ctx.lineTo(cx + boreWidthPixels / 2, dimY);
    ctx.stroke();

    // Arrowheads
    ctx.fillStyle = '#1C1B19';
    ctx.beginPath();
    ctx.moveTo(cx - boreWidthPixels / 2, dimY);
    ctx.lineTo(cx - boreWidthPixels / 2 + 4, dimY - 2);
    ctx.lineTo(cx - boreWidthPixels / 2 + 4, dimY + 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + boreWidthPixels / 2, dimY);
    ctx.lineTo(cx + boreWidthPixels / 2 - 4, dimY - 2);
    ctx.lineTo(cx + boreWidthPixels / 2 - 4, dimY + 2);
    ctx.fill();

    ctx.font = '600 8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Ø 92', cx, dimY - 3);

    // 2. Stroke dimension: 110 (right side between PMS and PMI)
    const strokeDimX = cx + boreWidthPixels / 2 + barrelWall + 18;
    ctx.beginPath();
    ctx.moveTo(cx + 25, tdcY);
    ctx.lineTo(strokeDimX + 4, tdcY);
    ctx.moveTo(cx + 25, bdcY);
    ctx.lineTo(strokeDimX + 4, bdcY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(strokeDimX, tdcY);
    ctx.lineTo(strokeDimX, bdcY);
    ctx.stroke();

    // Arrowheads
    ctx.beginPath();
    ctx.moveTo(strokeDimX, tdcY);
    ctx.lineTo(strokeDimX - 2, tdcY + 4);
    ctx.lineTo(strokeDimX + 2, tdcY + 4);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(strokeDimX, bdcY);
    ctx.lineTo(strokeDimX - 2, bdcY - 4);
    ctx.lineTo(strokeDimX + 2, bdcY - 4);
    ctx.fill();

    ctx.save();
    ctx.translate(strokeDimX + 11, (tdcY + bdcY) / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('110', 0, 0);
    ctx.restore();

    // Title
    ctx.font = '700 8px "Archivo", sans-serif';
    ctx.fillStyle = this.lineBlue;
    ctx.textAlign = 'left';
    ctx.fillText('SEZIONE A-A · CYLINDER 1', 8, 14);

    ctx.font = 'italic 400 7.5px "Bodoni Moda", serif';
    ctx.fillText('Corsa 110 mm · Alesaggio Ø 92 mm', 8, 24);

    ctx.restore();
  }
}
