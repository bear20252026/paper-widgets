/**
 * 3D-Anchored Volumetric Powder Plumes, Backlit Coldsmoke Rooster-Tails,
 * Slab Avalanche Billowing Front Clouds, Ridgeline Spindrift & Driving Alpine Snow (Wave 4).
 */
import * as THREE from 'three';

export class AlpineParticleSystem {
  constructor(puffTex, maxPuffs = 1800, maxFlakes = 2600) {
    this.group = new THREE.Group();

    // --- 1. Volumetric Coldsmoke / Powder Spray / Avalanche Clouds ---
    this.maxPuffs = maxPuffs;
    this.cursor = 0;
    this.pos = new Float32Array(maxPuffs * 3);
    this.vel = new Float32Array(maxPuffs * 3);
    this.size = new Float32Array(maxPuffs);
    this.expand = new Float32Array(maxPuffs);
    this.age = new Float32Array(maxPuffs);
    this.life = new Float32Array(maxPuffs);
    this.rot = new Float32Array(maxPuffs);
    this.peakAlpha = new Float32Array(maxPuffs);
    this.opacity = new Float32Array(maxPuffs);
    this.kind = new Float32Array(maxPuffs); // 0=powder carve, 1=avalanche cloud, 2=spindrift
    this.life.fill(-1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.opacity, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1));

    this.puffUniforms = {
      uMap: { value: puffTex },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
      uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
      uShadowColor: { value: new THREE.Color(0.32, 0.50, 0.78) },
      uFocalScale: { value: 650.0 },
      uStorm: { value: 0.0 },
    };

    const puffMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: this.puffUniforms,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        attribute float aRot;
        attribute float aKind;
        uniform float uFocalScale;
        uniform vec3 uCamPos;
        varying float vAlpha;
        varying float vRot;
        varying float vKind;
        varying vec3 vWorldPos;
        void main() {
          vRot = aRot;
          vKind = aKind;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vec4 mv = viewMatrix * wp;
          float camDist = length(wp.xyz - uCamPos);
          // Smooth near-camera proximity fade so billowing spray never blasts solid white discs across the lens!
          float nearStart = aKind > 0.5 ? 2.2 : 0.95;
          float nearEnd   = aKind > 0.5 ? 5.0 : 2.35;
          float nearFade  = smoothstep(nearStart, nearEnd, camDist) * smoothstep(0.65, 1.95, -mv.z);
          vAlpha = aAlpha * nearFade;
          float dist = max(0.35, -mv.z);
          float maxPx = aKind > 0.5 ? 280.0 : 160.0;
          gl_PointSize = clamp((aSize * uFocalScale) / dist, 1.0, maxPx);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uCamPos;
        uniform vec3 uSunDir;
        uniform vec3 uShadowColor;
        uniform vec3 uSunColor;
        uniform float uStorm;
        varying float vAlpha;
        varying float vRot;
        varying float vKind;
        varying vec3 vWorldPos;
        void main() {
          if (vAlpha <= 0.004) discard;
          vec2 uv = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          uv = mat2(c, -s, s, c) * uv + 0.5;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          vec4 tex = texture2D(uMap, uv);
          float a = tex.a * vAlpha;
          if (a < 0.008) discard;

          // Directional Mie forward scattering (warm golden silver-lining halo when backlit by Chamonix sun!)
          vec3 viewDir = normalize(vWorldPos - uCamPos);
          float fwdScatter = pow(max(0.0, dot(viewDir, normalize(uSunDir))), 3.0) * (1.0 - uStorm * 0.85);
          // Volumetric puff top-to-bottom shading (upper crest catches warm sun, underbelly rests in cobalt shadow)
          float topMask = clamp(1.0 - gl_PointCoord.y, 0.0, 1.0);
          float lit = clamp(tex.g * 0.52 + topMask * 0.42 + 0.08 * (1.0 - tex.b), 0.0, 1.0);

          // Sculpted belly-to-crest shading: richer shadowed cobalt underside on churning avalanche billows!
          vec3 belly = mix(uShadowColor * 1.02, uShadowColor * 0.68, step(0.5, vKind));
          vec3 crest = vec3(0.96, 0.98, 1.0) * mix(vec3(0.84, 0.88, 0.94), uSunColor * 1.32, 1.0 - uStorm * 0.72);
          vec3 col = mix(belly, crest, lit);
          // Luminous silver-lining rim around wispy outer edges of coldsmoke / avalanche billows!
          float rimEdge = (1.0 - tex.b) * smoothstep(0.02, 0.45, tex.a);
          col += uSunColor * rimEdge * (0.36 + 0.85 * fwdScatter) * (1.0 - uStorm * 0.8);
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.94));
        }
      `,
    });
    this.puffMesh = new THREE.Points(geo, puffMat);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.renderOrder = 5;
    this.group.add(this.puffMesh);

    // --- 2. Ambient Alpine Blowing Snow / Diamond Dust / Storm Flakes ---
    this.maxFlakes = maxFlakes;
    this.flakeBase = new Float32Array(maxFlakes * 3);
    this.flakeSeed = new Float32Array(maxFlakes);
    for (let i = 0; i < maxFlakes; i++) {
      this.flakeBase[i * 3]     = (Math.random() - 0.5) * 44.0;
      this.flakeBase[i * 3 + 1] = (Math.random() - 0.5) * 26.0;
      this.flakeBase[i * 3 + 2] = (Math.random() - 0.5) * 44.0;
      this.flakeSeed[i] = Math.random();
    }
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.BufferAttribute(this.flakeBase, 3));
    fGeo.setAttribute('aSeed', new THREE.BufferAttribute(this.flakeSeed, 1));
    this.flakeUniforms = {
      uCamPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uRate: { value: 0.12 },
      uStorm: { value: 0.0 },
      uWind: { value: new THREE.Vector3(6.5, -2.4, 3.2) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
      uSunColor: { value: new THREE.Color(1.0, 0.96, 0.90) },
      uFocalScale: { value: 650.0 },
    };
    const fMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: this.flakeUniforms,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform vec3 uCamPos;
        uniform float uTime;
        uniform float uRate;
        uniform float uStorm;
        uniform vec3 uWind;
        uniform vec3 uSunDir;
        uniform float uFocalScale;
        varying float vAlpha;
        varying float vSpark;
        varying float vDiamond;
        varying float vPhase;
        void main() {
          vec3 box = vec3(44.0, 26.0, 44.0);
          float isDiamond = step(0.86, aSeed) * (1.0 - uStorm * 0.92);
          vec3 wind = mix(uWind, uWind * 0.22 + vec3(0.6, -0.35, 0.3), isDiamond);
          vec3 p = position + wind * (uTime * (0.55 + aSeed * 0.95));
          p.x += sin(uTime * 1.9 + aSeed * 30.0) * mix(1.25, 0.45, isDiamond);
          p.z += cos(uTime * 1.5 + aSeed * 25.0) * mix(1.25, 0.45, isDiamond);
          vec3 rel = mod(p - uCamPos + box * 0.5, box) - box * 0.5;
          // Concentrate airborne diamond dust smoothly inside closer 1.2–16m sparkling volume!
          vec3 wp = uCamPos + mix(rel, rel * 0.44, isDiamond);
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          float dist = max(0.3, -mv.z);

          float activeSnow = step(aSeed, uRate);
          float isActive = max(activeSnow, isDiamond);
          vec3 viewDir = normalize(wp - uCamPos);
          float fwdSun = pow(max(0.0, dot(viewDir, normalize(uSunDir))), 2.2);

          // Twinkling prismatic diamond-dust glint (smoothly blinks in & out as crystal tumbles in sunlight!)
          float twinkle = pow(0.5 + 0.5 * sin(uTime * (4.2 + fract(aSeed * 37.0) * 5.0) + aSeed * 190.0), 4.0);
          float snowA = activeSnow * smoothstep(2.2, 4.5, dist) * (1.0 - smoothstep(14.0, 22.0, dist)) * (0.30 + 0.52 * uRate);
          float diamA = isDiamond * smoothstep(1.8, 3.6, dist) * (1.0 - smoothstep(9.0, 17.0, dist)) * (0.10 + 0.85 * twinkle) * (0.32 + 0.68 * fwdSun) * 0.68;

          vAlpha = max(snowA, diamA);
          vSpark = step(0.84, aSeed);
          vDiamond = isDiamond * (0.35 + 0.65 * twinkle) * (0.55 + 0.95 * fwdSun);
          vPhase = fract(aSeed * 71.3);

          float szSnow = mix(0.05, 0.11, fract(aSeed * 13.7)) * (0.75 + 0.85 * uRate);
          float szDiam = mix(0.015, 0.032, fract(aSeed * 29.1)) * (0.75 + 0.65 * twinkle);
          float sz = mix(szSnow, szDiam, isDiamond);
          gl_PointSize = clamp((sz * uFocalScale) / dist, 1.2, isDiamond > 0.5 ? 4.4 : 8.5) * isActive;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunColor;
        varying float vAlpha;
        varying float vSpark;
        varying float vDiamond;
        varying float vPhase;
        void main() {
          if (vAlpha <= 0.005) discard;
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          float soft = smoothstep(0.25, 0.02, r2);
          float star = vDiamond > 0.1 ? exp(-abs(d.x) * 18.0 - abs(d.y) * 4.5) + exp(-abs(d.y) * 18.0 - abs(d.x) * 4.5) : 0.0;
          vec3 prism = mix(vec3(1.22, 0.96, 0.72), vec3(0.76, 0.98, 1.26), vPhase);
          vec3 baseCol = mix(vec3(0.95, 0.98, 1.02), uSunColor * 1.85, vSpark * 0.65);
          // Delicate HDR prismatic diamond-dust twinkle (soft, subtle ice motes in bloom!)
          vec3 diamCol = prism * (uSunColor * 1.15 + vec3(0.55)) * (1.5 + star * 1.4);
          vec3 col = mix(baseCol, diamCol, clamp(vDiamond, 0.0, 1.0));
          gl_FragColor = vec4(col, clamp((soft + star * 0.35 * vDiamond) * vAlpha, 0.0, 0.95));
        }
      `,
    });
    this.flakeMesh = new THREE.Points(fGeo, fMat);
    this.flakeMesh.frustumCulled = false;
    this.flakeMesh.renderOrder = 6;
    this.group.add(this.flakeMesh);

    this._avyAccum = 0;
    this.bannerUniforms = null;
  }

  // Chamonix Signature Backlit Summit Snow Banners (wind-blown translucent plumes streaming off knife-edge arêtes!)
  addRidgeSnowBanners(peaks) {
    if (!peaks || !peaks.length) return;
    const bannerPeaks = peaks.filter((pk) => pk.elev >= 3650);
    if (!bannerPeaks.length) return;

    this.bannerUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
      uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
      uShadowColor: { value: new THREE.Color(0.32, 0.50, 0.78) },
      uFogColor: { value: new THREE.Color(0.42, 0.57, 0.78) },
      uFogDensity: { value: 0.000046 },
      uCamPos: { value: new THREE.Vector3() },
      uStorm: { value: 0.0 },
    };

    const bMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: this.bannerUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uShadowColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform vec3 uCamPos;
        uniform float uStorm;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.52;
          for (int i = 0; i < 4; i++) {
            v += a * vnoise(p);
            p = p * 2.08 + vec2(9.2, -5.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // u=0 right at summit crest -> u=1 fading out downwind along snow banner!
          float u = vUv.x;
          float v = vUv.y;
          float arch = 0.42 + u * 0.14 - u * u * 0.22;
          float spread = mix(0.14, 0.46, pow(u, 0.65));
          float dy = abs(v - arch) / spread;
          float envY = exp(-dy * dy * 2.6) * smoothstep(1.0, 0.70, dy);
          float envX = smoothstep(0.0, 0.09, u) * pow(1.0 - u, 1.55);

          vec2 flow = vec2(u * 3.8 - uTime * 0.14, (v - arch) * 5.2 + sin(u * 4.5 - uTime * 0.3) * 0.25);
          float wisp = fbm(flow);
          float wisp2 = fbm(flow * 2.2 + vec2(-uTime * 0.12, 3.1));
          float dens = smoothstep(0.28, 0.78, wisp * 0.65 + wisp2 * 0.35) * envX * envY;
          float dist = length(vWorldPos - uCamPos);
          // Fade out if camera gets very close so giant billboards never cross lens harshly
          float prox = smoothstep(260.0, 950.0, dist);
          float a = dens * (0.42 + 0.16 * uStorm) * prox;
          if (a < 0.008) discard;

          vec3 viewDir = normalize(vWorldPos - uCamPos);
          float backLit = pow(max(0.0, dot(viewDir, normalize(uSunDir))), 2.4) * (1.0 - uStorm * 0.85);
          vec3 col = mix(uShadowColor * 1.35, vec3(0.95, 0.97, 1.0) * (0.85 + 0.45 * uSunColor), 0.55 + 0.35 * v);
          col += uSunColor * (0.45 + 1.35 * backLit) * (1.0 - uStorm * 0.82);
          float fog = clamp(1.0 - exp(-dist * uFogDensity * 0.55), 0.0, 0.78);
          col = mix(col, uFogColor, fog * 0.5);
          gl_FragColor = vec4(col, clamp(a * (1.0 - fog * 0.4), 0.0, 0.62));
        }
      `,
    });

    // Prevailing NW/W Foehn alpine jetstream blowing ESE (+0.85, +0.08, +0.52) across Mont Blanc summits!
    const windDir = new THREE.Vector3(0.86, 0.04, 0.51).normalize();
    const bannerGeo = new THREE.PlaneGeometry(1, 1, 6, 1);
    bannerGeo.translate(0.5, 0.0, 0.0); // pivot at summit crest (u=0)

    for (const pk of bannerPeaks) {
      const len = pk.elev > 4400 ? 1150 : (pk.elev > 4000 ? 880 : 620);
      const height = len * 0.32;
      for (let layer = 0; layer < 2; layer++) {
        const m = new THREE.Mesh(bannerGeo, bMat);
        m.position.set(pk.x, pk.elev + 15 + layer * 18, pk.z);
        m.scale.set(len, height, 1);
        const yaw = -Math.atan2(windDir.z, windDir.x) + (layer === 1 ? 0.34 : 0.0);
        m.rotation.set(layer === 1 ? 0.24 : -0.10, yaw, 0.04);
        m.frustumCulled = false;
        m.renderOrder = 4;
        this.group.add(m);
      }
    }
  }

  emitPuff(x, y, z, vx, vy, vz, sizeStart = 1.2, lifeSec = 1.9, alpha = 0.65, expandRate = 1.75, kind = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.maxPuffs;
    const k = i * 3;
    this.pos[k] = x;
    this.pos[k + 1] = y;
    this.pos[k + 2] = z;
    this.vel[k] = vx;
    this.vel[k + 1] = vy;
    this.vel[k + 2] = vz;
    this.size[i] = sizeStart;
    this.expand[i] = expandRate;
    this.age[i] = 0;
    this.life[i] = lifeSec;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.peakAlpha[i] = alpha;
    this.opacity[i] = alpha * 0.25;
    this.kind[i] = kind;
  }

  emitBurst(x, y, z, count, spreadVel, sizeMin, sizeMax, lifeSec, alpha = 0.72, expandRate = 2.0, kind = 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.7) * spreadVel;
      this.emitPuff(
        x + (Math.random() - 0.5) * 1.1,
        y + Math.random() * 0.45,
        z + (Math.random() - 0.5) * 1.1,
        Math.cos(a) * r,
        0.35 + Math.random() * Math.min(2.2, spreadVel * 0.30),
        Math.sin(a) * r,
        sizeMin + Math.random() * (sizeMax - sizeMin),
        lifeSec * (0.72 + Math.random() * 0.55),
        alpha,
        expandRate,
        kind
      );
    }
  }

  // Sculpted backlit Chamonix coldsmoke rooster-tail billowing cleanly waist-high off & behind downhill carving edge!
  emitCarveRoosterTail(ev) {
    const intensity = Math.min(2.2, ev.rate);
    const n = intensity > 1.25 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const puffSz = (0.55 + Math.random() * 0.55) * (0.76 + 0.32 * intensity);
      const life = 0.95 + Math.random() * 0.72;
      this.emitPuff(
        ev.x + (Math.random() - 0.5) * 0.42,
        ev.y + 0.08 + Math.random() * 0.18,
        ev.z + (Math.random() - 0.5) * 0.42,
        ev.vx + (Math.random() - 0.5) * 1.8,
        ev.vy * 0.62 + Math.random() * 0.45,
        ev.vz + (Math.random() - 0.5) * 1.8,
        puffSz,
        life,
        0.30 + Math.min(0.20, intensity * 0.10),
        0.82 + Math.random() * 0.35,
        0
      );
    }
  }

  // Advancing Slab Avalanche churning powder front wave (4.5–9.5 m turbulent rolling clouds!)
  emitAvalancheWave(avy, terrainData, dt) {
    if (!avy || !avy.active || avy.strength < 0.05) return;
    this._avyAccum += dt * (38 + avy.speed * 1.5);
    const count = Math.min(18, Math.floor(this._avyAccum));
    if (count <= 0) return;
    this._avyAccum -= count;

    const sideX = -avy.dirZ;
    const sideZ = avy.dirX;
    for (let i = 0; i < count; i++) {
      // Cluster densely along leading boiling front + trailing turbulent cloud deck
      const isFront = Math.random() < 0.72;
      const along = isFront
        ? avy.frontDist - Math.random() * 10.0
        : Math.max(2.0, avy.frontDist - 8.0 - Math.random() * Math.min(avy.frontDist, 42.0));
      const across = (Math.random() - 0.5) * 2.0 * avy.width * (isFront ? 0.92 : 0.78);
      const wx = avy.originX + avy.dirX * along + sideX * across;
      const wz = avy.originZ + avy.dirZ * along + sideZ * across;
      const gy = terrainData.sampleHeight(wx, wz);

      const sz = isFront ? (4.2 + Math.random() * 5.2) : (3.4 + Math.random() * 4.4);
      const spd = avy.speed * (isFront ? 0.75 : 0.35);
      this.emitPuff(
        wx, gy + (isFront ? 1.4 + Math.random() * 2.6 : 1.0 + Math.random() * 2.2), wz,
        avy.dirX * spd + (Math.random() - 0.5) * 4.5,
        (isFront ? 3.2 : 1.4) + Math.random() * 3.8,
        avy.dirZ * spd + (Math.random() - 0.5) * 4.5,
        sz,
        isFront ? (2.2 + Math.random() * 1.6) : (2.6 + Math.random() * 1.6),
        (isFront ? 0.84 : 0.62) * avy.strength,
        isFront ? 3.2 : 2.1,
        1
      );
    }
  }

  clearAvalanchePuffs() {
    for (let i = 0; i < this.maxPuffs; i++) {
      if (this.kind[i] === 1) {
        this.life[i] = -1;
        this.opacity[i] = 0;
      }
    }
    this._avyAccum = 0;
    this.puffMesh.geometry.attributes.aAlpha.needsUpdate = true;
  }

  update(dt, cameraPos, viewportH, fovDeg, preset, sunDir, time) {
    const focalScale = (viewportH * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    this.puffUniforms.uFocalScale.value = focalScale;
    this.puffUniforms.uCamPos.value.copy(cameraPos);
    this.puffUniforms.uSunDir.value.copy(sunDir);
    this.puffUniforms.uSunColor.value.copy(preset.sunColor);
    this.puffUniforms.uShadowColor.value.copy(preset.shadowSkyColor);
    this.puffUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;

    const windX = preset.id === 'storm' ? 9.5 : 3.4;
    const windZ = preset.id === 'storm' ? 4.2 : 1.5;
    for (let i = 0; i < this.maxPuffs; i++) {
      if (this.life[i] <= 0) {
        this.opacity[i] = 0;
        continue;
      }
      if (dt > 0) {
        this.age[i] += dt;
        const u = this.age[i] / this.life[i];
        if (u >= 1.0) {
          this.life[i] = -1;
          this.opacity[i] = 0;
          continue;
        }
        const k = i * 3;
        const drag = Math.exp(-dt * (this.kind[i] > 0.5 ? 1.35 : 1.85));
        this.vel[k] = this.vel[k] * drag + windX * (1 - drag) * 0.45;
        this.vel[k + 1] = this.vel[k + 1] * drag - (this.kind[i] > 0.5 ? 1.4 : 2.3) * dt;
        this.vel[k + 2] = this.vel[k + 2] * drag + windZ * (1 - drag) * 0.45;
        this.pos[k] += this.vel[k] * dt;
        this.pos[k + 1] += this.vel[k + 1] * dt;
        this.pos[k + 2] += this.vel[k + 2] * dt;
        // Billowing volumetric expansion
        this.size[i] += dt * this.expand[i] * (0.55 + (1 - u) * 0.85);
        this.rot[i] += dt * (this.kind[i] > 0.5 ? 0.72 : 0.45) * ((i % 2) ? 1 : -1);
        const env = Math.sin(Math.min(1, u * 5.2) * Math.PI * 0.5) * Math.pow(1.0 - u, 1.38);
        this.opacity[i] = env * this.peakAlpha[i];
      } else {
        const u = Math.min(0.99, this.age[i] / Math.max(0.001, this.life[i]));
        const env = Math.sin(Math.min(1, Math.max(0.25, u * 5.2)) * Math.PI * 0.5) * Math.pow(1.0 - u, 1.38);
        this.opacity[i] = env * this.peakAlpha[i];
      }
    }
    this.puffMesh.geometry.attributes.position.needsUpdate = true;
    this.puffMesh.geometry.attributes.aSize.needsUpdate = true;
    this.puffMesh.geometry.attributes.aAlpha.needsUpdate = true;
    this.puffMesh.geometry.attributes.aRot.needsUpdate = true;
    this.puffMesh.geometry.attributes.aKind.needsUpdate = true;

    this.flakeUniforms.uCamPos.value.copy(cameraPos);
    this.flakeUniforms.uTime.value = time;
    this.flakeUniforms.uRate.value = preset.snowfallRate;
    this.flakeUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;
    this.flakeUniforms.uSunDir.value.copy(sunDir);
    this.flakeUniforms.uSunColor.value.copy(preset.sunColor);
    this.flakeUniforms.uFocalScale.value = focalScale;
    this.flakeUniforms.uWind.value.set(
      preset.id === 'storm' ? 16.5 : 4.2,
      preset.id === 'storm' ? -5.4 : -1.5,
      preset.id === 'storm' ? 7.8 : 1.8
    );

    if (this.bannerUniforms) {
      this.bannerUniforms.uTime.value = time;
      this.bannerUniforms.uSunDir.value.copy(sunDir);
      this.bannerUniforms.uSunColor.value.copy(preset.sunColor);
      this.bannerUniforms.uShadowColor.value.copy(preset.shadowSkyColor);
      this.bannerUniforms.uFogColor.value.copy(preset.fogColor);
      this.bannerUniforms.uFogDensity.value = preset.fogDensity;
      this.bannerUniforms.uCamPos.value.copy(cameraPos);
      this.bannerUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;
    }
  }
}
