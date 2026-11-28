import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ------------------------------------------------------------------ *
 *  QR CAT — the blocks of the QR code are the blocks of the cat.
 *
 *  Flat state : a real, scannable QR code lying on the ground.
 *  Cat state  : the same dark modules lift off and reassemble into a
 *               voxel cat. Voxel size === module size, always.
 *
 *  Anatomy trick: the three finder patterns (the big corner squares,
 *  the most recognisable structures in any QR) become the two ears
 *  and the base of the tail.
 * ------------------------------------------------------------------ */

/* Two colour worlds, and they never mix:

   FLAT — a printed card. Ink on cream, maximum contrast, nothing else in
   the scene. These are the only colours a scanner ever sees.

   SCENE — where the animal lives. The rug, its fringe and the floor all
   fade in with the morph, so none of them can touch scannability.

   The ground is the code's own slab, nothing else — the litter tray's
   wall out-shouted the cat, the fringe out-shouted the slab, and both
   were removed. What remains is Mangano's answer: the bare slab.      */
const PAL = {
  paper   : 0xF6F1E7,
  tile    : 0xE8E0CD,  // light modules, FLAT
  dark    : 0x3A2E22,  // dark modules, FLAT

  fur     : 0xE09A4E,  // ginger
  furDark : 0xC57C33,  // tail
  ear     : 0xF0B98A,  // inner ear
  face    : 0xF7E6CD,  // muzzle / chin patch
  eye     : 0x2E2822,
  nose    : 0xE4879A,

  sun       : 0xFFE7B8, // SCENE: the patch of window light
};

/* The room, in two skins.

   Note what is NOT in here: the printed card. In dark mode the code is
   still dark ink on cream — a lit sheet of paper in a dark room. Many
   scanners refuse an inverted QR, so the one surface that has to be read
   never changes colour, whatever the rest of the scene does. */
/* Lighting is deliberately unassuming: the hemisphere light carries the
   scene and the key adds only a gentle shadow. The earlier warm spotlight
   plus additive beam tinted every coat amber and put fog blobs on the
   background — "unnatural" was the right word for it. */
const SKINS = {
  light:{ bg:0xF6F1E7, key:0xFFFBF2, keyI:1.05,
          sky:0xFFFFFF, grd:0xDAD2C2, hemiI:1.75, shadow:0.10 },
  dark: { bg:0x141416, key:0xFFF3E0, keyI:0.85,
          sky:0xAAB0BC, grd:0x2A2A2E, hemiI:1.05, shadow:0.13 },
          /* shadow was 0.28 — on the near-black ground the slab's own
             shadow fused into a heavy dark ring around the code, the
             kind of edge the light theme never had */
};
let SKIN = SKINS.light;

/* The ground is the code's slab and nothing more — same colour family
   as the printed card, `pat` keeping the code as a whisper. The fringe
   and the litter tray both proved to be borders the picture didn't
   need; Mangano's original floats the bare slab and it was right.     */
const GROUNDCOL = {
  /* pat carries the code while the pet is up — a breath above the base,
     the woven version the ink deepens back into on the way home */
  light:{ base:0xF2ECDD, pat:0xE3D9C2, spare:0xD9C9A9 },
  dark :{ base:0x232327, pat:0x2E2E35, spare:0x8F8570 },
};
let themeKey = 'light';
let GROUND = {...GROUNDCOL.light};

/* Coats. A colour and a pattern, chosen independently — except calico,
   which is its own tricolour law and ignores the colour picker the way
   real calicos ignore everything. */
const COLORS = {
  ginger:{ base:0xE09A4E, dark:0xBE762F, ear:0xF0B98A },
  black :{ base:0x4C433C, dark:0x38312B, ear:0x8A7060 },
  grey  :{ base:0x9FA2AA, dark:0x80838D, ear:0xC9B6B2 },
  cream :{ base:0xF8F4EC, dark:0xE2D9C9, ear:0xEECDBC },   // an actually-white white cat
};
/* The dog is a shiba, and shibas come in exactly four coats: 赤 red,
   黑 black-and-tan, 胡麻 sesame, 白 cream. Same swatch keys as the cat,
   different paint. Every one of them wears urajiro — the cream muzzle,
   chest and paws — which is why the cat's pattern row doesn't apply:
   the urajiro IS the shiba's pattern. */
const COLORS_DOG = {
  ginger:{ base:0xDF8E4F, dark:0xC17436, ear:0xD08344, belly:0xF6EBD7 },  // 赤
  black :{ base:0x35302B, dark:0x262220, ear:0x2E2A26, belly:0xE9DCC4 },  // 黑
  grey  :{ base:0x94582F, dark:0x6B3F22, ear:0x85502B, belly:0xF2E9D5 },  // 胡麻: deep red ground, black-ticked — a clear step below 赤
  cream :{ base:0xF4EDDE, dark:0xE3D8C2, ear:0xEBDFC9, belly:0xFAF5E9 },  // 白
};
const coat = { color:'ginger', pattern:'tabby' };

const ihash = (x,y,z) => {
  let n = (x*73856093 ^ y*19349663 ^ z*83492791) >>> 0;
  n = (n ^ (n>>13)) * 1274126177 >>> 0;
  return (n % 4096) / 4096;
};

/* Per-voxel fur colour, decided at build time from the coat and the
   voxel's position in unit cat space. */
/* Real fur is never one flat colour: every body voxel breathes a few
   percent around its coat via position hash, and the print inherits it —
   the pet's footprint on the card reads as wool, not paint. */
function furTone(hex, v){
  const t = ihash(Math.round((v.x+0.5)*44), Math.round(v.y*44), Math.round((v.z+0.5)*44));
  const f = 1 + (t-0.5)*0.10;
  return (Math.min(255,Math.round(((hex>>16)&255)*f))<<16) |
         (Math.min(255,Math.round(((hex>>8)&255)*f))<<8)   |
          Math.min(255,Math.round((hex&255)*f));
}

/* Urajiro as a REGION, not a plane: a chest-hugging ellipsoid per pose
   (throat wide at the chest, tapering up and down and never reaching
   the shoulders) with a hash-ragged edge — a straight z-wall read as a
   painted-on bib. */
function uraBib(v){
  const h = ihash(Math.round((v.x+0.5)*30), Math.round(v.y*30), Math.round((v.z+0.5)*30));
  const j = 1 + (h-0.5)*0.34;                        // ragged organic edge
  const pk = poseKeyOf(state.pose);
  if (pk==='sit')
    return ellip([v.x,v.y,v.z], 0,0.30,0.30, 0.135*j,0.40*j,0.26*j)
        || (v.y<0.13 && v.z>0.12);                   // paw fronts
  if (pk==='stretch')
    return ellip([v.x,v.y,v.z], 0,0.16,0.34, 0.145*j,0.24*j,0.30*j)
        || (v.y<0.12 && v.z>0.30);
  // curl: the tucked belly by the chin
  return ellip([v.x,v.y,v.z], -0.04,0.10,0.16, 0.17*j,0.15*j,0.24*j);
}

function coatOf(part, v){
  if (state.animal === 'dog'){
    const C = COLORS_DOG[coat.color];
    if (part===PART.EYE)
      return coat.color==='black' ? 0xC79A55 : 0x33251C;
    if (part===PART.NOSE) return 0x2B2119;           // black leather, never pink
    if (part===PART.EAR_L || part===PART.EAR_R) return C.ear;
    if (part===PART.FACE) return furTone(C.belly, v); // the muzzle is urajiro
    let base = part===PART.TAIL ? C.dark : C.base;
    if (part===PART.BODY && uraBib(v)) base = C.belly;
    /* sesame is defined by its ticking: scattered black-tipped hairs
       over the dark-red ground (never inside the urajiro) */
    else if (coat.color==='grey' && (part===PART.BODY || part===PART.TAIL)){
      const tk = ihash(Math.round((v.x+0.5)*23), Math.round(v.y*23), Math.round((v.z+0.5)*23));
      if (tk < 0.24) base = mixSRGB(base, 0x2B241E, 0.5);
    }
    return furTone(base, v);
  }
  const C = COLORS[coat.color];
  if (part===PART.EYE)
    return coat.color==='black' ? 0xE0B04D          // amber, or they vanish
         : coat.color==='cream' ? 0x54483C
         : 0x2E2822;
  if (part===PART.NOSE) return coat.color==='black' ? 0x9E6B70 : 0xE4879A;
  if (part===PART.EAR_L || part===PART.EAR_R) return C.ear;
  if (part===PART.FACE)
    return coat.color==='cream' ? 0xF9F1E3 : 0xF7E6CD;

  let base = part===PART.TAIL ? C.dark : C.base;
  if (coat.pattern==='tabby'){
    if (part===PART.TAIL){
      if (Math.sin(v.y*34 + v.z*20) > 0) base = C.dark;   // ringed tail
    } else if (v.y > 0.10 && Math.sin((v.y*2.1 + v.z*0.7)*24) > 0.42){
      base = C.dark;                                      // body stripes
    }
  } else if (coat.pattern==='tuxedo'){
    const white = 0xF2EADB;
    if (v.y < 0.10) base = white;                          // socks
    else if (v.z > 0.10 && v.y > 0.14 && v.y < 0.62) base = white;  // bib
    if (part===PART.TAIL && v.y > 0.30) base = white;      // dipped tail tip
  } else if (coat.pattern==='calico'){
    /* two scales of patch: a coarse field decides the region, a fine
       one frays its edge — one coarse hash alone cut the cat into a
       few giant slabs that read as a colouring mistake, not a coat */
    const big  = ihash(Math.floor((v.x+0.5)*6), Math.floor(v.y*6), Math.floor((v.z+0.5)*6));
    const fine = ihash(Math.floor((v.x+0.5)*13), Math.floor(v.y*13), Math.floor((v.z+0.5)*13));
    const h = 0.68*big + 0.32*fine;
    base = h < 0.34 ? 0xE09A4E : h < 0.54 ? 0x453B34 : 0xF0E8D8;
  }
  return furTone(base, v);
}

// ---------------------------------------------------------------- scene

const stage = document.getElementById('stage');
// preserveDrawingBuffer so the flat state can be read back — both for the
// "save / share image" feature and to verify it still decodes
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(SKIN.bg, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const fallbackEl = document.getElementById('fallback');
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  fallbackEl?.classList.remove('hidden');
});

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const key = new THREE.DirectionalLight(SKIN.key, SKIN.keyI);   // window light
key.position.set(2.2, 4.4, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(1024,1024);
const sc = key.shadow.camera;
sc.left=-1.6; sc.right=1.6; sc.top=1.6; sc.bottom=-1.6; sc.near=0.5; sc.far=12;
key.shadow.bias = -0.0012;
scene.add(key, key.target);
const fill = new THREE.HemisphereLight(SKIN.sky, SKIN.grd, SKIN.hemiI);
scene.add(fill);
/* A neutral room around the scene: only the standard-material knots
   listen to it (the plates are Lambert and ignore it), so it adds the
   velvet without touching the printed card. Intensity follows the theme. */
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

/* The room. Fades in with the morph — in the flat state there is no
   scene at all, just a printed card on paper. */
/* The room floor is invisible — a ShadowMaterial catches the slab's soft
   shadow and nothing else, so the backdrop is the same paper colour in
   both views. (A painted floor plane read as "the background got darker"
   the moment the cat stood up.) */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(14,14),
  new THREE.ShadowMaterial({opacity:0})
);
floor.rotation.x = -Math.PI/2;
floor.position.y = -0.014;
floor.receiveShadow = true;
scene.add(floor);

/* Two stacked plates:
   `plate`   — the rug: the code woven tone on tone, seen once the blocks
               have lifted off it.
   `plateQR` — the complete printed code, laid over the top. It is what a
               scanner reads in the flat state, and it fades out the
               instant the blocks lift off. */
/* The slab: rug weave on the top face only. The sides are a solid cut
   in the weave's dark tone — the box UVs smeared the whole rug across
   them, which read as a stack of QR layers. */
const plateTopMat  = new THREE.MeshLambertMaterial({color:0xffffff});
const plateSideMat = new THREE.MeshLambertMaterial({color:0xD8CBAD});
const plate = new THREE.Mesh(
  new THREE.BoxGeometry(1,1,1),
  [plateSideMat, plateSideMat, plateTopMat, plateSideMat, plateSideMat, plateSideMat]
);
plate.receiveShadow = true;
scene.add(plate);

const plateQR = new THREE.Mesh(
  new THREE.PlaneGeometry(1,1),
  new THREE.MeshBasicMaterial({transparent:true, depthWrite:false})
);
plateQR.rotation.x = -Math.PI/2;
scene.add(plateQR);

/* While you type, the code changes many times a second of settling —
   snapping between prints looked like a glitch. The OLD print lingers
   on this overlay for a third of a second and dissolves into the new
   one. Only build() arms it; the theme tween repaints in place. */
const plateQRPrev = new THREE.Mesh(
  new THREE.PlaneGeometry(1,1),
  new THREE.MeshBasicMaterial({transparent:true, depthWrite:false, opacity:0})
);
plateQRPrev.rotation.x = -Math.PI/2;
plateQRPrev.position.y = 0.0012;     // just above the fresh print
plateQRPrev.visible = false;
scene.add(plateQRPrev);

// one InstancedMesh holds every module / voxel — they are the same objects
const CUBE = new THREE.BoxGeometry(1,1,1);

/* A shared nap texture: white ground, soft directional strokes.
   Multiplied by each instance's colour it reads as fur at knot scale —
   the blocks stay perfect cubes, the surface just stops being plastic. */
const FURTEX = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0,0,64,64);
  let s = 7; const rnd = () => (s = s*48271 % 2147483647) / 2147483647;
  for (let i=0;i<320;i++){
    const x=rnd()*64, y=rnd()*64, L=4+rnd()*9, a=(rnd()-0.5)*1.1 + Math.PI/2;
    const tone = 165 + Math.floor(rnd()*90);
    g.strokeStyle = `rgba(${tone},${tone},${tone},${0.30+rnd()*0.35})`;
    g.lineWidth = 0.7 + rnd()*1.0;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*L, y+Math.sin(a)*L); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
let blocks = null;

// ---------------------------------------------------------------- qr

// qrcode-generator truncates non-ASCII to single bytes by default —
// a link with Chinese in it would encode as garbage without this
if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8'])
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

function buildQR(text){
  const qr = qrcode(0, 'M');          // auto version, ECC level M
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const dark = [];
  for (let r=0;r<n;r++) for (let c=0;c<n;c++) if (qr.isDark(r,c)) dark.push({r,c});
  return {n, dark, isDark:(r,c)=>qr.isDark(r,c)};
}

// which finder pattern (if any) does a module belong to?
//  0 = top-left  -> left ear
//  1 = top-right -> right ear
//  2 = bottom-left -> tail
function finderOf(r,c,n){
  if (r<7 && c<7)       return 0;
  if (r<7 && c>=n-7)    return 1;
  if (r>=n-7 && c<7)    return 2;
  return -1;
}

// ---------------------------------------------------------------- cat

/* The cat lives in a unit box: x,z in [-.5,.5], y in [0,1], facing +z.
   Everything is an ellipsoid or a swept capsule, so proportions are
   a handful of numbers rather than a mesh to model.                */

function ellip(p, cx,cy,cz, rx,ry,rz){
  const x=(p[0]-cx)/rx, y=(p[1]-cy)/ry, z=(p[2]-cz)/rz;
  return x*x+y*y+z*z <= 1;
}
function segDist(p, a, b){
  const abx=b[0]-a[0], aby=b[1]-a[1], abz=b[2]-a[2];
  const apx=p[0]-a[0], apy=p[1]-a[1], apz=p[2]-a[2];
  const t = Math.max(0, Math.min(1, (apx*abx+apy*aby+apz*abz)/(abx*abx+aby*aby+abz*abz)));
  const dx=apx-abx*t, dy=apy-aby*t, dz=apz-abz*t;
  return Math.hypot(dx,dy,dz);
}

// tail: leaves from behind, sweeps around the cat's right side to the
// front and lifts its tip — the classic sitting-cat curl
function tailPoint(t){
  return [ 0.03 + 0.33*Math.sin(2.3*t),
           0.05 + 0.30*t*t*t,
          -0.26 + 0.54*t ];
}
const TAIL = Array.from({length:30},(_,i)=>tailPoint(i/29));

// part tags route the finder patterns to specific body parts, and give
// the face its own colours
const PART = {BODY:0, EAR_L:1, EAR_R:2, TAIL:3, FACE:4, EYE:5, NOSE:6, GRAIN:7, YARN:8};

// tapered capsule
function cone(p, a, b, ra, rb){
  const abx=b[0]-a[0], aby=b[1]-a[1], abz=b[2]-a[2];
  const apx=p[0]-a[0], apy=p[1]-a[1], apz=p[2]-a[2];
  const L2 = abx*abx+aby*aby+abz*abz;
  const t = Math.max(0, Math.min(1, (apx*abx+apy*aby+apz*abz)/L2));
  const dx=apx-abx*t, dy=apy-aby*t, dz=apz-abz*t;
  return Math.hypot(dx,dy,dz) <= ra + (rb-ra)*t;
}

function catPart(p){
  const [x,y,z] = p;

  // --- face details first: they win over the head they sit on ---
  // eyes
  for (const sx of [-1,1])
    if (ellip(p, sx*0.074,0.779,0.180, 0.035,0.036,0.046)) return PART.EYE;
  // nose
  if (ellip(p, 0,0.719,0.203, 0.030,0.025,0.048)) return PART.NOSE;
  // muzzle — kept small and tucked in, or it reads as a bandage
  if (ellip(p, 0,0.690,0.178, 0.074,0.048,0.056)) return PART.FACE;

  /* Ears: cones rooted well inside the head. A narrow base leaves a notch
     between ear and skull and they read as two posts, so the base is wide
     and they sit close in. */
  if (cone(p, [ 0.082,0.795,0.055], [ 0.132,0.985,0.025], 0.088,0.016)) return PART.EAR_R;
  if (cone(p, [-0.082,0.795,0.055], [-0.132,0.985,0.025], 0.088,0.016)) return PART.EAR_L;

  // --- tail ---
  for (let i=0;i<TAIL.length-1;i++){
    const t = i/(TAIL.length-1);
    if (segDist(p, TAIL[i], TAIL[i+1]) < 0.060*(1-0.32*t)) return PART.TAIL;
  }

  // --- head (wider than the chest, so a neck reads) ---
  if (ellip(p, 0,0.740,0.070, 0.172,0.158,0.158)) return PART.BODY;
  // chest
  if (ellip(p, 0,0.420,0.060, 0.150,0.185,0.165)) return PART.BODY;
  // haunches
  if (ellip(p, 0,0.200,-0.030, 0.250,0.225,0.280)) return PART.BODY;
  // front legs + paws
  for (const sx of [-1,1]){
    if (cone(p,[sx*0.100,0.040,0.190],[sx*0.100,0.270,0.150], 0.052,0.048)) return PART.BODY;
    if (ellip(p, sx*0.100,0.038,0.235, 0.060,0.038,0.080)) return PART.BODY;
  }
  return -1;
}

/* Voxelise at grid height G, keep only the shell (a surface voxel has at
   least one empty 6-neighbour). Returns tagged voxel centres in unit space. */
/* ---- the other poses --------------------------------------------------
   Each pose is its own small sculpture in the same unit box, voxelized by
   the same machinery. Switching poses sends the cat back through the
   code: fold flat, re-knit into the new shape — every change in this
   toy passes through the QR, that is the whole idea. */

// stretch: paws thrown forward, chest to the ground, tail up — the
// full wake-up stretch
function tailPointStretch(t){
  return [ 0.035*Math.sin(3*t),
           0.585 + 0.34*t - 0.06*t*t,
          -0.365 - 0.10*t + 0.17*t*t ];   // rises clear of the haunches, hooks forward
}
const TAIL_S = Array.from({length:24},(_,i)=>tailPointStretch(i/23));

function catPartStretch(q){
  /* The stretch runs nose-to-tail longer than the sampling box, and
     anything outside the box simply never voxelises — which silently
     amputated the face (EYE count: zero). This affine fits the whole
     pose into the box at a ~9% front-to-back squeeze. */
  const p = [ q[0], q[1], q[2]*1.09 + 0.094 ];
  const [x,y,z] = p;

  /* face details, low and forward over the outstretched paws — same
     proportions as the sitting face, pushed clear of the head surface
     so the shell keeps them (buried features cull to slivers) */
  for (const sx of [-1,1])
    if (ellip(p, sx*0.066,0.347,0.536, 0.036,0.037,0.042)) return PART.EYE;
  if (ellip(p, 0,0.302,0.556, 0.030,0.026,0.044)) return PART.NOSE;
  if (ellip(p, 0,0.284,0.535, 0.070,0.046,0.052)) return PART.FACE;

  // ears swept back on the lowered head
  if (cone(p, [ 0.072,0.395,0.395], [ 0.118,0.545,0.355], 0.068,0.015)) return PART.EAR_R;
  if (cone(p, [-0.072,0.395,0.395], [-0.118,0.545,0.355], 0.068,0.015)) return PART.EAR_L;

  // tail: a raised question mark over the high haunches
  for (let i=0;i<TAIL_S.length-1;i++){
    const t = i/(TAIL_S.length-1);
    if (segDist(p, TAIL_S[i], TAIL_S[i+1]) < 0.055*(1-0.32*t)) return PART.TAIL;
  }

  // head, low and forward
  if (ellip(p, 0,0.315,0.435, 0.150,0.135,0.135)) return PART.BODY;
  // chest dropped to the ground
  if (ellip(p, 0,0.205,0.290, 0.160,0.145,0.180)) return PART.BODY;
  // spine rising from chest to haunches
  if (cone(p, [0,0.205,0.180], [0,0.435,-0.200], 0.150,0.185)) return PART.BODY;
  // haunches, high
  if (ellip(p, 0,0.435,-0.270, 0.195,0.215,0.195)) return PART.BODY;
  // hind legs, standing
  for (const sx of [-1,1]){
    if (cone(p, [sx*0.100,0.050,-0.290],[sx*0.100,0.330,-0.280], 0.055,0.060)) return PART.BODY;
    if (ellip(p, sx*0.100,0.045,-0.240, 0.056,0.040,0.075)) return PART.BODY;
  }
  // front legs, thrown out along the ground
  for (const sx of [-1,1]){
    if (cone(p, [sx*0.090,0.215,0.240],[sx*0.100,0.048,0.470], 0.052,0.046)) return PART.BODY;
    if (ellip(p, sx*0.100,0.042,0.500, 0.055,0.040,0.075)) return PART.BODY;
  }
  return -1;
}

// curl: wound into a loaf, but a CAT-shaped loaf — you can tell which
// end is the rump and which is the head, it is not a coiled snake.
// The body is an open C: a tall haunch mound at one end, the back
// sweeping round, and the head resting in the C's opening.
const BODY_CU = [
  [-0.09, 0.135, -0.17],
  [ 0.08, 0.135, -0.21],
  [ 0.21, 0.130, -0.06],
  [ 0.19, 0.125,  0.13],
  [ 0.04, 0.120,  0.24],
];
const TAIL_CU = Array.from({length:28},(_,i)=>{
  const t = i/27, a = 4.15 - 2.35*t;           // around the open left side…
  const r = 0.345 - 0.075*t;                   // …outside the body, tip curving in
  return [ r*Math.cos(a), 0.052, r*Math.sin(a) ];
});

function catPartCurl(p){
  // face on the head resting in the opening — eyes are slits, asleep
  for (const sx of [-1,1])
    if (ellip(p, -0.13+sx*0.058,0.210,0.315, 0.030,0.020,0.038)) return PART.EYE;
  if (ellip(p, -0.13,0.183,0.327, 0.026,0.024,0.036)) return PART.NOSE;
  if (ellip(p, -0.13,0.164,0.315, 0.055,0.036,0.045)) return PART.FACE;

  // ears folded back along the sleeping head
  if (cone(p, [-0.065,0.265,0.130], [-0.030,0.348,0.095], 0.050,0.013)) return PART.EAR_R;
  if (cone(p, [-0.190,0.262,0.140], [-0.228,0.342,0.105], 0.050,0.013)) return PART.EAR_L;

  // tail along the open side, tip tucked up by the cheek
  for (let i=0;i<TAIL_CU.length-1;i++){
    const t = i/(TAIL_CU.length-1);
    if (segDist(p, TAIL_CU[i], TAIL_CU[i+1]) < 0.046*(1-0.25*t)) return PART.TAIL;
  }

  // the head, distinctly its own lump at the front-left
  if (ellip(p, -0.130,0.175,0.200, 0.145,0.130,0.135)) return PART.BODY;
  // the rump: one taller mound — the other end you can point at
  if (ellip(p, -0.090,0.170,-0.150, 0.205,0.170,0.205)) return PART.BODY;
  // the back, sweeping round the right side, thinning toward the shoulder
  for (let i=0;i<BODY_CU.length-1;i++){
    const t = i/(BODY_CU.length-1);
    if (segDist(p, BODY_CU[i], BODY_CU[i+1]) < 0.155 - 0.043*t) return PART.BODY;
  }
  /* No centre fill: the middle stays open, so from above you can see the
     body is WOUND — a curled cat, not a solid bun. The dip between the
     head and the rump is the proof of the curl. */
  return -1;
}

/* ---- the dog ----------------------------------------------------------
   A shiba: prick triangular ears that never fold, a cream muzzle with a
   black nose, and the tail rolled up over the back like a cinnamon bun —
   the three things that say "shiba" even at knot resolution. */

// the tail: a tight curl in the y/z plane, flopped to the right side
const TAIL_D = Array.from({length:22},(_,i)=>{
  const t = i/21, a = -1.4 + 4.4*t, r = 0.115 - 0.030*t;
  return [ 0.085 + 0.02*Math.sin(a), 0.500 + r*Math.sin(a), -0.290 + r*Math.cos(a) ];
});

function dogPart(p){
  /* The pixel-shiba face law (from reference sprites): round head nearly
     as wide as the body, SMALL eyes high up, and the muzzle is a wide
     SHORT cream bulge on the lower half of the face — a beak-length
     snout reads wrong instantly. */
  for (const sx of [-1,1])
    if (ellip(p, sx*0.062,0.772,0.195, 0.028,0.030,0.036)) return PART.EYE;
  if (ellip(p, 0,0.702,0.252, 0.032,0.026,0.034)) return PART.NOSE;
  if (ellip(p, 0,0.676,0.150, 0.118,0.078,0.100)) return PART.FACE;
  // small triangular prick ears
  if (cone(p, [ 0.092,0.805,0.050],[ 0.140,0.918,0.058], 0.078,0.018)) return PART.EAR_R;
  if (cone(p, [-0.092,0.805,0.050],[-0.140,0.918,0.058], 0.078,0.018)) return PART.EAR_L;
  // the rolled tail
  for (let i=0;i<TAIL_D.length-1;i++){
    const t = i/(TAIL_D.length-1);
    if (segDist(p, TAIL_D[i], TAIL_D[i+1]) < 0.055*(1-0.22*t)) return PART.TAIL;
  }
  if (ellip(p, 0,0.740,0.060, 0.178,0.148,0.148)) return PART.BODY;   // round head
  if (ellip(p, 0,0.415,0.070, 0.165,0.190,0.170)) return PART.BODY;   // chest
  if (ellip(p, 0,0.195,-0.030, 0.245,0.220,0.275)) return PART.BODY;  // haunches
  for (const sx of [-1,1]){
    if (cone(p,[sx*0.105,0.040,0.185],[sx*0.105,0.280,0.150], 0.052,0.048)) return PART.BODY;
    if (ellip(p, sx*0.105,0.038,0.230, 0.058,0.038,0.078)) return PART.BODY;
  }
  return -1;
}

// stretch, for a dog, is the play bow — same skeleton as the cat's
// stretch (same affine squeeze), but the ears stay pricked: that IS the shiba
function dogPartStretch(q){
  const p = [ q[0], q[1], q[2]*1.09 + 0.094 ];
  for (const sx of [-1,1])
    if (ellip(p, sx*0.058,0.360,0.520, 0.028,0.030,0.036)) return PART.EYE;
  if (ellip(p, 0,0.295,0.575, 0.030,0.024,0.032)) return PART.NOSE;
  // the same short wide muzzle, dropped low over the paws
  if (ellip(p, 0,0.272,0.480, 0.110,0.072,0.095)) return PART.FACE;
  if (cone(p, [ 0.080,0.408,0.392],[ 0.125,0.512,0.418], 0.070,0.016)) return PART.EAR_R;
  if (cone(p, [-0.080,0.408,0.392],[-0.125,0.512,0.418], 0.070,0.016)) return PART.EAR_L;
  // the tail keeps the cat-stretch flag pose: up and wagging is right here
  for (let i=0;i<TAIL_S.length-1;i++){
    const t = i/(TAIL_S.length-1);
    if (segDist(p, TAIL_S[i], TAIL_S[i+1]) < 0.052*(1-0.28*t)) return PART.TAIL;
  }
  if (ellip(p, 0,0.320,0.430, 0.148,0.132,0.132)) return PART.BODY;   // head, low
  if (ellip(p, 0,0.205,0.290, 0.160,0.145,0.180)) return PART.BODY;   // chest down
  if (cone(p, [0,0.205,0.180],[0,0.435,-0.200], 0.150,0.185)) return PART.BODY;
  if (ellip(p, 0,0.435,-0.270, 0.195,0.215,0.195)) return PART.BODY;  // rump high
  for (const sx of [-1,1]){
    if (cone(p, [sx*0.100,0.050,-0.290],[sx*0.100,0.330,-0.280], 0.055,0.060)) return PART.BODY;
    if (ellip(p, sx*0.100,0.045,-0.240, 0.056,0.040,0.075)) return PART.BODY;
    if (cone(p, [sx*0.090,0.215,0.240],[sx*0.100,0.048,0.470], 0.052,0.046)) return PART.BODY;
    if (ellip(p, sx*0.100,0.042,0.500, 0.055,0.040,0.075)) return PART.BODY;
  }
  return -1;
}

// curled up for the sigh — the cat's open-C body, but the ears stand
// even in sleep and the muzzle rests on the rim of the curl
function dogPartCurl(p){
  for (const sx of [-1,1])
    if (ellip(p, -0.13+sx*0.055,0.212,0.320, 0.026,0.018,0.032)) return PART.EYE;
  if (ellip(p, -0.13,0.190,0.365, 0.028,0.023,0.030)) return PART.NOSE;
  if (ellip(p, -0.13,0.172,0.295, 0.095,0.060,0.080)) return PART.FACE;
  if (cone(p, [-0.068,0.262,0.128],[-0.030,0.372,0.110], 0.046,0.014)) return PART.EAR_R;
  if (cone(p, [-0.192,0.260,0.138],[-0.232,0.368,0.128], 0.046,0.014)) return PART.EAR_L;
  for (let i=0;i<TAIL_CU.length-1;i++){
    const t = i/(TAIL_CU.length-1);
    if (segDist(p, TAIL_CU[i], TAIL_CU[i+1]) < 0.050*(1-0.20*t)) return PART.TAIL;
  }
  if (ellip(p, -0.130,0.175,0.205, 0.145,0.130,0.135)) return PART.BODY;
  if (ellip(p, -0.090,0.170,-0.150, 0.205,0.170,0.205)) return PART.BODY;
  for (let i=0;i<BODY_CU.length-1;i++){
    const t = i/(BODY_CU.length-1);
    if (segDist(p, BODY_CU[i], BODY_CU[i+1]) < 0.155 - 0.043*t) return PART.BODY;
  }
  return -1;
}

const POSE_FN = {
  cat: { sit:catPart, tilt:catPart, stretch:catPartStretch, curl:catPartCurl },
  dog: { sit:dogPart, tilt:dogPart, stretch:dogPartStretch, curl:dogPartCurl },
};
// tilt shares sit's geometry — it is sit plus a runtime head rotation
const poseKeyOf = pose => (pose === 'tilt' ? 'sit' : pose);

const voxCache = new Map();   // shell voxels depend only on animal + pose + G

function catVoxels(G, poseKey){
  const key = state.animal + ':' + poseKey + ':' + G;
  const hit = voxCache.get(key);
  if (hit) return hit;
  const out = catVoxelsRaw(G, POSE_FN[state.animal][poseKey]);
  voxCache.set(key, out);
  return out;
}

function catVoxelsRaw(G, partFn){
  const s = 1/G;                       // voxel edge in unit space
  const NX = Math.ceil(1/s), NZ = NX;
  const idx = (i,j,k)=> (j*NZ + k)*NX + i;
  const solid = new Int8Array(NX*G*NZ).fill(-1);

  for (let j=0;j<G;j++){
    const y = (j+0.5)*s;
    for (let k=0;k<NZ;k++){
      const z = -0.5 + (k+0.5)*s;
      for (let i=0;i<NX;i++){
        const x = -0.5 + (i+0.5)*s;
        solid[idx(i,j,k)] = partFn([x,y,z]);
      }
    }
  }
  const get=(i,j,k)=> (i<0||j<0||k<0||i>=NX||j>=G||k>=NZ) ? -1 : solid[idx(i,j,k)];

  const out=[];
  for (let j=0;j<G;j++) for (let k=0;k<NZ;k++) for (let i=0;i<NX;i++){
    const p = get(i,j,k);
    if (p<0) continue;
    const shell = get(i+1,j,k)<0||get(i-1,j,k)<0||get(i,j+1,k)<0||
                  get(i,j-1,k)<0||get(i,j,k+1)<0||get(i,j,k-1)<0;
    if (!shell) continue;
    out.push({ x:-0.5+(i+0.5)*s, y:(j+0.5)*s, z:-0.5+(k+0.5)*s, part:p });
  }
  return out;
}

/* SUB: each dark module shatters into SUB×SUB knots when it lifts off,
   so the voxel edge is a third of a module and the cat is finely carved —
   full-module voxels read as chunky. The law survives intact, it just
   conserves area instead of identity: one module = nine knots, and flat
   they tile the module's footprint exactly.                           */
const SUB = 3;

/* The cat's height is still decided by how many blocks the QR gives us —
   now dark modules × SUB². Aim a little UNDER that count: overshooting
   leaves holes in the cat, undershooting leaves spare tufts on the
   floor, and the tufts should exist for every link, not most of them.

   Shell count grows ~G², so start from the analytic estimate and walk —
   a linear scan from small G re-voxelises dozens of grids for nothing. */
function fitCat(target, poseKey){
  const want = target * 0.91;   // the unused 9% is yarn — the cat's toys
  let G = Math.max(14, Math.round(Math.sqrt(want/1.18)));
  let v = catVoxels(G, poseKey);
  while (v.length > target && G > 10){ G--; v = catVoxels(G, poseKey); }
  while (G < 72){
    const nv = catVoxels(G+1, poseKey);
    if (nv.length > target) break;            // never more blocks than the code has
    if (Math.abs(nv.length-want) >= Math.abs(v.length-want)) break;
    G++; v = nv;
  }
  return {G, v};
}

// ---------------------------------------------------------------- pairing

/* Modules rise more or less straight up: each voxel takes the nearest
   still-free module in top-down projection. Finder patterns are routed
   to the ears and the tail first.                                     */
function assign(qr, voxels, catScale, catY){
  const n = qr.n, s = 1/n;
  // each dark module contributes SUB×SUB knots, tiling its footprint
  const mods = [];
  for (const {r,c} of qr.dark){
    const bx = (c - (n-1)/2)*s, bz = (r - (n-1)/2)*s;
    const f  = finderOf(r,c,n);
    for (let oi=0; oi<SUB; oi++) for (let oj=0; oj<SUB; oj++){
      mods.push({
        mid: mods.length,          // stable identity across rebuilds of the same code
        r, c,                      // kept so the card can be painted per module
        x: bx + (oi - (SUB-1)/2) * s/SUB,
        z: bz + (oj - (SUB-1)/2) * s/SUB,
        finder: f, used: false
      });
    }
  }

  /* Voxel unit-space -> world, re-centred on the cat's bounding box —
     the tail curls to one side and pulled the whole silhouette ~1.5
     modules off centre until this was measured. */
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;
  for (const v of voxels){
    if (v.x<mnx)mnx=v.x; if (v.x>mxx)mxx=v.x;
    if (v.z<mnz)mnz=v.z; if (v.z>mxz)mxz=v.z;
  }
  const ox=(mnx+mxx)/2, oz=(mnz+mxz)/2;
  const W = v => ({ x:(v.x-ox)*catScale, y: catY + v.y*catScale, z:(v.z-oz)*catScale });

  // how far the cat spreads in plan view — balls must stay outside this
  let catR = 0;
  for (const v of voxels){
    const w = W(v);
    catR = Math.max(catR, Math.hypot(w.x, w.z));
  }

  const byPart = p => voxels.filter(v=>v.part===p);
  const pairs  = [];

  const nearest = (w, pool) => {
    let bi=-1, bd=Infinity;
    for (let i=0;i<pool.length;i++){
      const m = pool[i];
      if (m.used) continue;
      const d = (m.x-w.x)**2 + (m.z-w.z)**2;
      if (d<bd){ bd=d; bi=i; }
    }
    return bi<0 ? null : pool[bi];
  };

  // greedy nearest in projection, tallest voxels first (they read as the
  // silhouette, so they get first pick). `pool` is the preferred source;
  // anything it cannot cover falls back to the general pool.
  const take = (vlist, pool) => {
    vlist.sort((a,b)=>b.y-a.y);
    const spill = [];
    for (const v of vlist){
      const w = W(v);
      let m = nearest(w, pool) || nearest(w, mods);
      if (!m){ spill.push(v); continue; }
      m.used = true;
      pairs.push({m, v, w});
    }
    return spill;
  };

  // finder pattern -> body part
  const F = k => mods.filter(m=>m.finder===k);
  take(byPart(PART.EAR_L), F(0));
  take(byPart(PART.EAR_R), F(1));
  take(byPart(PART.TAIL ), F(2));
  // everything else — body, face, eyes, nose — from the general pool
  const routed = new Set([PART.EAR_L, PART.EAR_R, PART.TAIL]);
  take(voxels.filter(v=>!routed.has(v.part)), mods);

  const leftover = mods.filter(m=>!m.used);
  return {pairs, leftover, catR};
}

// ---------------------------------------------------------------- build

const state = {
  flat:true, t:0, target:0,   // 0 = QR, 1 = cat
  items:[], plateSize:1, ready:false, fovBoost:0,
  spin:0, spinVel:0, dragging:false, spun:false,
  themeMix:0, themeTarget:0, qr:null,
  // where the pointer is (normalised, stage-centred) and where the cat
  // is actually looking — the gaze trails the pointer like a real cat,
  // interested but never hurried
  animal:'cat', pose:'sit', tiltCur:0, poseT:1, cam:0, shadowF:0.1
};
window.__cat = state;   // prototype: lets us scrub the morph from the console
window.__vox = (G,pk)=>catVoxels(G,pk);  // and census the sculpts (module scope)
window.__PART = PART;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
      _e = new THREE.Euler(),  _p = new THREE.Vector3(),
      _s = new THREE.Vector3(), _c = new THREE.Color(),
      _cA= new THREE.Color(),  _cB= new THREE.Color();

let lastText = '';

/* `prevByMid` carries each sub-module's previous resting place and
   colour into the new build: pose switches hand it in, so the blocks
   glide from the old pose to the new one instead of teleporting. */
function build(text, prevByMid){
  lastText = text;
  const qr = buildQR(text);
  const n  = qr.n, s = 1/n;               // plate normalised to width 1
  const sv = s/SUB;                       // knot edge: a third of a module
  const fit = fitCat(qr.dark.length * SUB*SUB, poseKeyOf(state.pose));
  const catScale = fit.G * sv;            // <- voxel edge === knot edge
  const {pairs, leftover, catR} = assign(qr, fit.v, catScale, 0);

  if (blocks){ scene.remove(blocks); blocks.dispose(); }
  const total = pairs.length + leftover.length;
  /* The C finish (looks lab, user's pick): a standard material under the
     room environment — a whisper of velvet specular on every knot, no
     baked occlusion. Lambert read as plastic beside it. */
  blocks = new THREE.InstancedMesh(
    CUBE, new THREE.MeshStandardMaterial({map:FURTEX, roughness:0.9, metalness:0}), total
  );
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total*3),3);
  blocks.castShadow = blocks.receiveShadow = true;
  blocks.frustumCulled = false;
  scene.add(blocks);

  // deterministic per-code randomness, so a link always gets the same cat
  let seed = (qr.dark.length*2654435761 ^ n*40503) % 2147483647 || 12345;
  const rnd = () => (seed = seed*48271 % 2147483647) / 2147483647;

  const items = [];
  const push = (m, w, part, sxz1, sy1, dest) => {
    const pv = prevByMid && prevByMid.get(m.mid);
    items.push({
      mid: m.mid, ir: m.r, ic: m.c,   // home module, for the scatter-back
      fx: pv?.x, fy: pv?.y, fz: pv?.z, fdisp: pv?.disp,
      // Flat pose. Keep it genuinely flat: any real height makes each
      // block's top face drift outward under perspective, which shears
      // the module grid and stops the code decoding.
      x0:m.x, y0: sv*0.06, z0:m.z, sy0: sv*0.12,
      x1:w.x, y1:w.y, z1:w.z, sy1, sxz1,
      spin: rnd()*Math.PI*2, part, dest,
      /* fur: each settled block leans a few degrees its own way and
         swells a touch — the silhouette stops being machine-cut. All of
         it scales with the growth factor, so the flat grid stays exact. */
      jx:(rnd()-0.5)*0.24, jy:(rnd()-0.5)*0.24, jz:(rnd()-0.5)*0.24,
      js: 1 + rnd()*0.16,
      delay: 0, arc: 0
    });
  };

  for (const {m,w,v} of pairs) push(m, w, v.part, 0.93, sv*0.95, coatOf(v.part, v));

  /* The blocks the cat had no use for roll up into balls of yarn — the
     cat's toys are made of the same code as the cat. More leftover code
     means more balls; the first ball also unwinds a strand across the
     floor, and only the last few knots are loose tufts. */
  const YARN = [0x87A7C4, 0xD9909F, 0x9DAF8E];   // mist blue, rose, sage
  const half = 0.5;                  // the rug ends where the code ends
  const rem  = leftover.slice();
  const takeNearest = (x,z) => {
    let bi=0, bd=Infinity;
    for (let i=0;i<rem.length;i++){
      const d = (rem[i].x-x)**2 + (rem[i].z-z)**2;
      if (d<bd){ bd=d; bi=i; }
    }
    return rem.splice(bi,1)[0];
  };
  const ballShell = Rk => {
    const out=[], R=Math.ceil(Rk);
    for (let i=-R;i<=R;i++) for (let j=-R;j<=R;j++) for (let k=-R;k<=R;k++){
      const d = Math.hypot(i,j,k);
      if (d <= Rk+0.1 && d >= Rk-1.05) out.push([i,j,k]);
    }
    return out;
  };

  /* A ball is not decoration parked beside the scene — it stands where
     its own modules are. The centre is the densest cluster of leftover
     code outside the cat's footprint, so seen from above the ball covers
     the very patch that forms it, the knots rise almost straight up, and
     in the code state that patch already shows the ball's colour. An
     orthographic relationship, not a prop. */
  const densestCentre = (minR, placed) => {
    let best = null, bestScore = -1;
    for (const m of rem){
      const rr = Math.hypot(m.x, m.z);
      if (rr < minR) continue;
      if (placed.some(p => Math.hypot(p.x-m.x, p.z-m.z) < p.keep)) continue;
      let score = 0;
      for (const o of rem){
        const d = (o.x-m.x)**2 + (o.z-m.z)**2;
        if (d < 0.0050) score++;
      }
      if (score > bestScore){ bestScore = score; best = m; }
    }
    return best;
  };

  let balls = 0, first = null;
  const placed = [];
  for (const Rk of [3.4, 2.6, 2.0]){
    const pts = ballShell(Rk);
    if (pts.length > rem.length) continue;
    const centre = densestCentre(catR + Rk*sv + 0.02, placed);
    if (!centre) break;
    const cx = centre.x, cz = centre.z, cy = Rk*sv*0.95;
    for (const [i,j,k] of pts){
      const m = takeNearest(cx, cz);
      push(m, {x:cx+i*sv, y:cy+j*sv, z:cz+k*sv}, PART.YARN, 0.92, sv*0.92, YARN[balls%3]);
    }
    placed.push({x:cx, z:cz, keep: Rk*sv*2 + 0.05});
    if (!first) first = {cx, cz, a: Math.atan2(cz, cx), Rk};
    balls++;
    if (balls>=3 || rem.length < 16) break;
  }
  if (first && rem.length > 4){
    // a comma of unwound yarn trailing off the first ball, not an orbit
    const count = Math.min(rem.length, 44);
    for (let t=0;t<count;t++){
      const u  = t/Math.max(1,count-1);
      const r2 = first.Rk*sv + u*0.20;
      const th = first.a + 2.2 + u*1.3;
      const x = first.cx + Math.cos(th)*r2, z = first.cz + Math.sin(th)*r2;
      push(takeNearest(x,z), {x, y:sv*0.45, z}, PART.YARN, 0.6, sv*0.5, YARN[0]);
    }
  }
  const tufts = rem.length;
  while (rem.length){
    const m = rem.pop();
    const ang = Math.atan2(m.z, m.x) + (rnd()-0.5)*0.8;
    const rad = half + s*(0.8 + 3.0*rnd()*rnd());
    push(m, {x:Math.cos(ang)*rad, y:floor.position.y + sv*0.30, z:Math.sin(ang)*rad},
         PART.GRAIN, 0.62, sv*0.55, null);   // dest resolved live from GROUND
  }

  /* Growth is one shared spring (no per-block choreography), but the
     way BACK is a scatter: the cat loosens from the head down and rains
     onto the modules it came from. Each block gets its departure slot —
     higher first, with a grain of jitter. */
  let maxY = 0;
  for (const it of items) maxY = Math.max(maxY, it.y1);
  for (const it of items){
    it.dd = 0.30 * (1 - Math.max(0, it.y1)/(maxY||1))
          + 0.10 * (it.spin / (Math.PI*2));
    it.delay = 0; it.arc = 0;
  }

  /* True orthographic colour: each module is printed as whatever stands
     ABOVE it in the cat view — the topmost knot over that cell. The cat's
     footprint appears as a ginger patch in the middle of the code, the
     yarn balls as small colour spots where they rest, and everything
     else stays plain ink. Colours never travel. */
  const modTop = new Map();
  for (const it of items){
    const ci = Math.round(it.x1*n + (n-1)/2);
    const ri = Math.round(it.z1*n + (n-1)/2);
    if (ri<0 || ci<0 || ri>=n || ci>=n) continue;
    const key = ri + '_' + ci;
    const cur = modTop.get(key);
    if (!cur || it.y1 > cur.y)
      modTop.set(key, { y: it.y1, dest: it.part===PART.GRAIN ? GROUND.spare : it.dest });
  }
  state.modTop = modTop;       // must land before paintPlate reads it
  state.items = items;         // and before recolorItems runs

  // hold the outgoing print for the crossfade before the repaint replaces it
  if (state.ready && plateQR.material.map){
    if (plateQRPrev.material.map) plateQRPrev.material.map.dispose();
    plateQRPrev.material.map = plateQR.material.map;
    plateQRPrev.scale.copy(plateQR.scale);
    plateQRPrev.material.opacity = 1;
    plateQRPrev.visible = true;
    state.cardFade = 0;
  }
  paintPlate(qr, n);
  recolorItems();

  state.items = items;
  state.plateSize = 1;
  state.n = n;
  state.qr = qr;                      // kept so theme tweens can repaint the plates
  state.mod = sv;                     // block cross-section: the knot, not the module
  state.headMin = 0.56 * catScale;    // knots above this are "the head"
  state.headPiv = 0.63 * catScale;    // and tilt about this height
  state.ready = true;
  // build numbers live here if ever needed again:
  // v{(n-17)/4} · {n}×{n} · dark {qr.dark.length} · knots {fit.v.length}/{fit.G} · balls {balls} · tufts {tufts}
}

/* ONE colour pipeline for code and creature. `cardTone` is the whole
   palette law: light theme pulls a colour down to scanner-safe darkness,
   dark theme lifts it to scanner-safe brightness, themeMix blends. The
   printed modules AND the standing blocks both go through it, so what
   you see from above is what stands up — the 3D look comes from light,
   never from re-rendered colour. Plain sRGB byte math (THREE.Color is
   linear-space under colour management and silently defeats the clamp). */
function cardTone(v, m){
  const r=(v>>16)&255, g=(v>>8)&255, b=v&255;
  const L=(0.299*r + 0.587*g + 0.114*b)/255;
  /* Pale coats earn a lighter print: a white cat clamped to L .40 read
     as a grey stain that didn't match the white animal standing on it.
     Up to L .53 for near-whites — decode-verified against the .95 card
     ground; darker coats keep the deep .40 ink. */
  /* The ceiling is set by the worst case: an all-cream shiba, where
     every one of ~80 footprint cells is pale at once. .48 and .46 both
     failed it once the chroma floor landed; .44 holds across the full
     matrix (2 animals × 4 coats × solid/tabby × 2 poses × 2 themes). */
  const tgt = 0.40 + 0.04 * Math.max(0, Math.min(1, (L - 0.75) / 0.20));
  const k=Math.min(1, tgt/Math.max(L,0.01));
  const t=L>=0.80 ? 0.05 : Math.min(0.94, (0.80-L)/(0.90-L));
  /* Keep the coat's IDENTITY in the print. Darkening a near-white coat
     by scaling leaves an anonymous grey, the same grey the grey coat
     prints — so the footprint gets a chroma floor: its own hue pushed
     back up at the same luminance (cream → warm sand, grey → slate).
     The dark theme lifts toward neutral white for the same reason. */
  const dark  = chromaFloor(r*k, g*k, b*k, 36);
  const light = chromaFloor(r+(250-r)*t, g+(250-g)*t, b+(250-b)*t, 24);
  const mx=(a,c)=>Math.round(a+(c-a)*m);
  return (mx(dark[0], light[0])<<16) | (mx(dark[1], light[1])<<8) | mx(dark[2], light[2]);
}
function chromaFloor(r,g,b,minC){
  const c = Math.max(r,g,b) - Math.min(r,g,b);
  if (c >= minC || c < 0.5) return [Math.round(r),Math.round(g),Math.round(b)];
  const Y = 0.299*r + 0.587*g + 0.114*b, f = minC/c;
  let R = Y+(r-Y)*f, G = Y+(g-Y)*f, B = Y+(b-Y)*f;
  const Y2 = 0.299*R + 0.587*G + 0.114*B, s = Y/Math.max(Y2,1);   // hold the luminance
  const cl = x => Math.max(0, Math.min(255, Math.round(x*s)));
  return [cl(R), cl(G), cl(B)];
}

/* Blocks display cardTone(dest) lifted 55% back toward the true coat.
   Strict equality with the card made every pale coat the same taupe — a
   white cat cannot be white at scanner-dark luminance, so the standing
   blocks get to be brighter than their print while staying in its
   family. Recomputed only when the theme mix or the build changes. */
const mixSRGB = (a,b,t) => {
  const f = (sa,sb)=>Math.round(sa+(sb-sa)*t);
  return (f((a>>16)&255,(b>>16)&255)<<16) |
         (f((a>>8)&255,(b>>8)&255)<<8)   |
          f(a&255,b&255);
};
function recolorItems(){
  for (const it of state.items){
    const base = it.part === PART.GRAIN ? GROUND.spare : it.dest;
    /* Pale coats need MORE of their true colour back or they all land on
       the same taupe — a white cat has to be white. The lift grows with
       the coat's own brightness: ginger ~0.6, white ~0.9. */
    const L = (0.299*((base>>16)&255) + 0.587*((base>>8)&255) + 0.114*(base&255)) / 255;
    const lift = Math.min(0.92, 0.55 + 0.37 * Math.max(0, L - 0.60) / 0.30);
    it.disp = mixSRGB(cardTone(base, state.themeMix), base, lift);
  }
}

/* The whole code — light AND dark — is baked into the plate texture, so
   the flat state is a genuinely printed QR with no geometry over it: no
   seams, no block sides, no contact shadows. The 3D blocks are simply
   hidden until the morph starts, and they first appear exactly where the
   painted dark modules already are. Scannability is then structural
   rather than something to tune. */
const hex = v => '#'+v.toString(16).padStart(6,'0');

/* Fur nap for one printed module: a dozen short strokes in the ink's
   own family, ±18% luminance, deterministic per cell so every repaint
   lays the same coat. The variation stays far inside the binariser's
   dark/light margin — the furry footprint still scans. */
function drawFur(g, x, y, px, ink){
  let s = Math.abs((x*2654435761 ^ y*40503) % 2147483647) || 7;
  const rnd = () => (s = s*48271 % 2147483647) / 2147483647;
  const r0=(ink>>16)&255, g0=(ink>>8)&255, b0=ink&255;
  g.save();
  // the nap may fuzz one pixel past its module and no further — loose
  // whiskers on the pale ground read as dirt, not fur
  g.beginPath(); g.rect(x-1, y-1, px+2, px+2); g.clip();
  for (let i=0;i<12;i++){
    /* nap strokes only ever DARKEN the module: a lighter stroke under a
       module-centre sample flips the bit, and on a busy coat (sesame:
       ticking + urajiro + fur) enough flips beat the error correction */
    const f = 0.78 + rnd()*0.24;
    g.strokeStyle = `rgba(${Math.min(255,r0*f|0)},${Math.min(255,g0*f|0)},${Math.min(255,b0*f|0)},0.85)`;
    g.lineWidth = px*0.10;
    const sx=x+rnd()*px, sy=y+rnd()*px;
    const a=(rnd()-0.5)*1.1 + Math.PI/2, L=px*(0.25+rnd()*0.35);
    g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx+Math.cos(a)*L, sy+Math.sin(a)*L); g.stroke();
  }
  g.restore();
}

function paintPlate(qr, n){
  const Q = 4;                       // quiet zone, in modules
  const N = n + Q*2, px = 24;
  const tex = cv => {
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const sheet = margin => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = (n + margin*2)*px;
    return [cv, cv.getContext('2d')];
  };

  /* FLAT: the printed code, with a 4-module quiet zone.
     Light theme: ink on cream. Dark theme: the card inverts — cream
     modules on near-black, so no white slab glares out of a dark page.
     (User's call, knowing the trade-off: a minority of scanners refuse
     inverted codes.) Colours follow themeMix so the card crossfades with
     the rest of the scene instead of snapping; mid-fade it is briefly
     unscannable, which a half-finished transition is allowed to be.   */
  const m = state.themeMix;
  /* The quiet zone is printed in the ROOM's own colour: any difference
     shows up as a ring around the code (invisible in light where the
     two tones nearly matched, a visible band in dark where they
     didn't). The scanner only needs the zone quiet, not white. */
  const cardBg   = hex(mixHex(0xF6F1E7, 0x141416, m));
  const cardCell = hex(mixHex(PAL.tile, 0x232326, m));
  // warm dark brown, not near-black — the projection card is mostly
  // plain ink now, and full-strength ink read as "the code got darker"
  const cardInk  = hex(mixHex(0x54463A, 0xE9E2D2, m));

  /* The card is the top view, literally: a dark module under the cat is
     printed in the colour standing above it (scanner-toned); everything
     outside the footprint is plain ink. The colours stay where the
     things are — switching views moves nothing sideways. */
  const inkFor = (r,c) => {
    const top = state.modTop && state.modTop.get(r+'_'+c);
    return top ? hex(cardTone(top.dest, m)) : cardInk;
  };

  const [qv, qg] = sheet(Q);
  qg.fillStyle = cardBg;
  qg.fillRect(0,0,qv.width,qv.height);
  const shimmerList = [];
  const inkMap = new Map();
  for (let r=0;r<n;r++) for (let c=0;c<n;c++){
    if (qr.isDark(r,c)){
      const ink = inkFor(r,c);
      qg.fillStyle = ink;
      inkMap.set(r+'_'+c, parseInt(ink.slice(1),16));
      /* The pet's footprint is printed as fur, so those cells sit out
         the shimmer (a repaint would wipe the nap every frame). The
         finder patterns are sacred to the scanner and stay crisp even
         where an ear or the tail stands over them. */
      if (!(state.modTop && state.modTop.has(r+'_'+c)) || finderOf(r,c,n) >= 0)
        shimmerList.push({r, c, ink: parseInt(ink.slice(1),16), ph: (r*3.1 + c*1.7) % 6.283});
    } else {
      qg.fillStyle = cardCell;
    }
    qg.fillRect((c+Q)*px,(r+Q)*px,px,px);
  }
  /* Second pass: nap strokes over the footprint, after every cell is
     filled — so the fuzz can spill a hair over its module's edge in all
     directions without being painted over. */
  if (state.modTop)
    for (const key of state.modTop.keys()){
      const [r,c] = key.split('_').map(Number);
      if (r>=0 && c>=0 && r<n && c<n && qr.isDark(r,c) && finderOf(r,c,n) < 0)
        drawFur(qg, (c+Q)*px, (r+Q)*px, px, inkMap.get(key));
    }
  const cardT = tex(qv);
  plateQR.material.map = cardT;
  plateQR.material.needsUpdate = true;
  state.cardCanvas = qv;   // ground truth for scannability checks
  state.cardTex = cardT;   // the shimmer repaints through these
  state.cardPx = px; state.cardQ = Q; state.cardMods = shimmerList;
  // landing colours: a returning block fades into the ink printed at its
  // home module, so touchdown is seamless
  state.cardInkByRC = inkMap;

  /* SCENE: the ground — the exact footprint of the CODE, no quiet-zone
     ring. The white border belongs to the printed card (a scanner needs
     it); the rug is the woven thing under the modules and ends where
     they end. The code stays as a whisper: dark cells a few percent off
     the base. */
  const R = 0;                       // rug = code, edge to edge
  const [rv, rg] = sheet(R);
  rg.fillStyle = hex(GROUND.base);
  rg.fillRect(0,0,rv.width,rv.height);
  rg.fillStyle = hex(GROUND.pat);
  for (let r=0;r<n;r++) for (let c=0;c<n;c++)
    if (qr.isDark(r,c)) rg.fillRect((c+R)*px,(r+R)*px,px,px);
  plateTopMat.map = tex(rv);
  plateTopMat.needsUpdate = true;
  plateSideMat.color.setHex(GROUND.pat);   // the weave's own dark tone

  const wq = (n + Q*2)/n, wr = (n + R*2)/n;
  plate.scale.set(wr, 0.014, wr);
  plate.position.y = -0.007;         // top face lands exactly on y = 0
  plateQR.scale.set(wq, wq, 1);
  plateQR.position.y = 0.0006;
}

/* (The sunbeam dust is gone with the sunbeam: light theme had already
   washed it out to nothing, and in dark it read as stray sparks over
   the code — the room is calmer empty.) */

// ---------------------------------------------------------------- anim

const easeInOut = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

/* ---- theme crossfade ------------------------------------------------
   The panel gets CSS transitions; the scene gets this. One mix value
   drives every 3D colour, light and texture, so light↔dark is a single
   half-second dissolve instead of a snap. */
const _tc1 = new THREE.Color(), _tc2 = new THREE.Color();
const mixHex = (a,b,m) => _tc1.setHex(a).lerp(_tc2.setHex(b), m).getHex();
const mixNum = (a,b,m) => a + (b-a)*m;

function mixedGround(m){
  const g = GROUNDCOL;
  return {
    base :mixHex(g.light.base,  g.dark.base,  m),
    pat  :mixHex(g.light.pat,   g.dark.pat,   m),
    spare:mixHex(g.light.spare, g.dark.spare, m),
  };
}

function applySceneTheme(m){
  const L = SKINS.light, D = SKINS.dark;
  renderer.setClearColor(mixHex(L.bg, D.bg, m), 1);
  state.shadowF = mixNum(L.shadow, D.shadow, m);
  key.color.setHex(mixHex(L.key, D.key, m));
  key.intensity = mixNum(L.keyI, D.keyI, m);
  fill.color.setHex(mixHex(L.sky, D.sky, m));
  fill.groundColor.setHex(mixHex(L.grd, D.grd, m));
  fill.intensity = mixNum(L.hemiI, D.hemiI, m);
  scene.environmentIntensity = mixNum(0.35, 0.16, m);   // the room light dims with the room
  GROUND = mixedGround(m);
  if (state.qr) paintPlate(state.qr, state.n);   // card + rug follow the mix
  recolorItems();                                // and so do the blocks
}

/* The grow clock and the camera clock. */
const MORPH_SECONDS = 1.25;
/* One spring for the whole cat: every block shares this factor, so at
   any instant the screen shows a complete miniature cat mid-growth —
   a kitten becoming the cat, one motion, zero granularity.

   The curve is drawn like a cartoon arc, not a physics sim: velocity is
   zero at BOTH ends (smootherstep entry), it swells past full size once
   (~5%) and glides back in the same stroke — no separate "boing" event,
   which is what made the damped-cosine version feel deliberate. */
const springG = t => {
  const s  = t*t*t*(t*(t*6 - 15) + 10);      // smootherstep: silky ends
  const c1 = 0.85, c3 = c1 + 1;              // one soft overshoot (~4%)
  return 1 + c3*Math.pow(s-1,3) + c1*Math.pow(s-1,2);
};
const CAM_SECONDS   = 1.15;
let prev = 0;

function frame(now){
  requestAnimationFrame(frame);
  if (!state.ready) return;

  // time-based, so the morph takes the same wall-clock time at any fps
  // clamp both ends: a long stall gives a huge dt, and a clock that is
  // not monotonic (tab restore, manual driving) can give a negative one
  const dt = prev ? Math.max(0, Math.min((now-prev)/1000, 0.1)) : 0;
  prev = now;
  const step = dt / MORPH_SECONDS;
  if (state.target > state.t) state.t = Math.min(state.target, state.t + step);
  else                        state.t = Math.max(state.target, state.t - step);

  // the camera follows on its own, slower clock
  const cstep = dt / CAM_SECONDS;
  if (state.target > state.cam) state.cam = Math.min(state.target, state.cam + cstep);
  else                          state.cam = Math.max(state.target, state.cam - cstep);

  // pose-to-pose glide, ~1 second of it
  if (state.poseT < 1) state.poseT = Math.min(1, state.poseT + dt/1.05);


  // advance the theme crossfade
  /* fixed 0.35s, same clock as the dashboard's CSS transitions — the
     exponential version trailed the panel by its long tail */
  const dm = state.themeTarget - state.themeMix;
  if (dm !== 0){
    const stepT = dt / 0.35;
    state.themeMix = Math.abs(dm) <= stepT ? state.themeTarget : state.themeMix + Math.sign(dm)*stepT;
    applySceneTheme(state.themeMix);
  }

  const T = state.t;
  const time = now*0.001;

  /* While the pet is up, the full-ink print gives way to the woven rug
     beneath it — the code stays readable on the ground but pale, and
     the slab grows real thickness. Folding back runs it in reverse:
     the pixels lay down and the ink deepens under them as they land.
     At T = 0 the print is whole again, so the scan state is untouched. */
  /* The ink's clock follows the BLOCKS' clock, which is asymmetric:
     rising, they leave the ground at once, so the print gives way
     early; falling, they only touch down in the last stretch of the
     morph — the ink deepening any sooner ran ahead of the pixels
     being laid, so it now waits for the landing window. */
  const inkT = state.target === 0
    ? easeInOut(Math.min(1, T / 0.35))
    : easeInOut(Math.min(1, T * 1.45));
  plateQR.material.opacity = 1 - inkT;
  plateQR.visible = inkT < 0.999;
  const slabTh = 0.014 + 0.022*inkT;   // a mat, not a butcher's block
  plate.scale.y = slabTh;
  plate.position.y = -slabTh/2;          // top face pinned at y = 0

  // the lingering old print dissolving into the new one
  if (plateQRPrev.visible){
    state.cardFade = Math.min(1, (state.cardFade ?? 1) + dt/0.22);
    plateQRPrev.material.opacity = (1 - easeInOut(state.cardFade)) * plateQR.material.opacity;
    if (state.cardFade >= 1){
      plateQRPrev.visible = false;
      if (plateQRPrev.material.map){ plateQRPrev.material.map.dispose(); plateQRPrev.material.map = null; }
    }
  }

  /* Mosaic shimmer: each printed module breathes ±4% around its own
     colour, out of phase with its neighbours — the code is alive while
     it waits. Amplitude is far inside the binariser's margin (decode-
     verified) and the repaint is throttled to ~12fps. */
  if (plateQR.visible && state.cardMods && time - (state.lastShimmer||0) > 0.08){
    state.lastShimmer = time;
    const g = state.cardCanvas.getContext('2d');
    const px = state.cardPx, Q = state.cardQ;
    for (const md of state.cardMods){
      const f = 1 + 0.04*Math.sin(time*2.0 + md.ph);
      const r = Math.min(255, Math.round(((md.ink>>16)&255)*f));
      const gg= Math.min(255, Math.round(((md.ink>>8)&255)*f));
      const b = Math.min(255, Math.round((md.ink&255)*f));
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect((md.c+Q)*px, (md.r+Q)*px, px, px);
    }
    state.cardTex.needsUpdate = true;
  }
  blocks.visible  = T > 0.0005;
  blocks.castShadow = T > 0.02;
  const drawBlocks = blocks.visible;

  // the room belongs to the scene, not to the code
  const scenery = easeInOut(THREE.MathUtils.clamp((state.cam-0.05)/0.55, 0, 1));
  floor.material.opacity = scenery * (state.shadowF ?? 0.1);
  floor.visible = scenery > 0.001;

  /* Small life, only once a block has settled: the chest rises and falls,
     the tail swings, and the eyes track the pointer. All of it is offsets
     on top of the resting pose, so the morph itself is untouched. */
  const breath = Math.sin(time*1.4) * 0.007;
  const sway   = Math.sin(time*1.6);
  // the tilt is a chosen pose, eased in and out — not a hover reaction
  state.tiltCur += ((state.pose === 'tilt' ? 0.22 : 0) - state.tiltCur) * (1 - Math.exp(-dt*5));
  const tilt = state.tiltCur;

  // every few seconds, one ear flicks — the classic proof a cat is awake
  // …and every few seconds a dog wags instead: same clock, other end
  if (!state.flick && T > 0.9 && time > (state.nextFlick || 5))
    state.flick = state.animal === 'dog'
      ? { side: PART.TAIL, t0: time, dur: 1.4 }
      : { side: Math.random() < 0.5 ? PART.EAR_L : PART.EAR_R, t0: time, dur: 0.3 };
  if (state.flick && time - state.flick.t0 > state.flick.dur){
    state.flick = null;
    state.nextFlick = time + 3.5 + Math.random()*5;
  }

  const PE = easeInOut(state.poseT);
  const poseHop = Math.sin(Math.PI * PE) * 0.05;   // a small jump between poses

  // the one shared growth factor — the whole cat scales about the
  // centre of the slab, anchored to the ground
  const g = T <= 0 ? 0 : T >= 1 ? 1 : springG(T);
  // going up is growth; coming down is the scatter home
  const descending = state.target === 0 && T < 1;

  for (let i=0; drawBlocks && i<state.items.length; i++){
    const it = state.items[i];

    // during a pose glide, the destination itself is in motion
    let tx = it.x1, ty = it.y1, tz = it.z1;
    if (state.poseT < 1 && it.fx !== undefined){
      tx = it.fx + (it.x1 - it.fx) * PE;
      ty = it.fy + (it.y1 - it.fy) * PE + poseHop;
      tz = it.fz + (it.z1 - it.fz) * PE;
    }

    let x, y, z, sy, sx, scatE = 0;
    if (!descending){
      x = tx * g; z = tz * g; y = ty * g;
      sy = it.sy1 * g;
      sx = state.mod * it.sxz1 * g;
    } else {
      /* scatter home: from its place in the cat back onto its own
         module, with a little rain-arc and a tumble on the way */
      const D  = 1 - T;
      const ud = THREE.MathUtils.clamp((D - it.dd) / (1 - it.dd), 0, 1);
      const e  = easeInOut(ud);
      scatE = e;
      x = tx + (it.x0 - tx) * e;
      z = tz + (it.z0 - tz) * e;
      y = ty + (it.y0 - ty) * e + Math.sin(Math.PI*e) * (0.04 + 0.16*it.y1);
      sy = it.sy1 + (it.sy0 - it.sy1) * e;
      sx = state.mod * (it.sxz1 + (1 - it.sxz1) * e);
    }

    let headRoll = 0;
    if (!descending && T > 0.995 && it.part <= PART.NOSE){
      y += it.y1 * breath;                                   // breathing
      if (tilt !== 0 && it.y1 > state.headMin){
        /* A real head tilt is a rotation about the neck, not a shear:
           positions orbit the pivot and each block rolls by the same
           angle, so the head stays a rigid shape at an angle. */
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const px = x, py = y - state.headPiv;
        x = px*ct - py*st;
        y = state.headPiv + px*st + py*ct;
        headRoll = tilt;
      }
      if (it.part === PART.TAIL){
        const k = Math.max(0, it.y1*2.2);                    // free end moves most
        x += sway * k * state.mod * 0.55;
        if (state.flick && state.flick.side === PART.TAIL){  // the wag: a fast
          const p   = Math.min(1, (time-state.flick.t0)/state.flick.dur);
          const env = Math.sin(p*Math.PI);                   // swells in, dies out
          x += Math.sin(time*15) * env * k * state.mod * 1.4;
        }
      }
      if (state.flick && it.part === state.flick.side && it.part !== PART.TAIL){   // ear flick
        const f = Math.sin(Math.min(1,(time-state.flick.t0)/state.flick.dur)*Math.PI);
        y -= f * state.mod * 1.3;
        x += f * state.mod * 0.4 * (it.part===PART.EAR_L ? -1 : 1);
      }
    }

    // the fur lean-and-swell, present only as far as the block has risen
    const jf = (descending ? 1 - scatE : g) * (it.jx !== undefined ? 1 : 0);
    if (jf > 0){
      const sw = 1 + (it.js - 1)*jf;
      sx *= sw; sy *= sw;
    }
    _p.set(x,y,z);
    _s.set(sx, sy, sx);
    if (scatE > 0 && scatE < 1){
      const tumble = Math.sin(Math.PI*scatE) * 0.4;
      _e.set(tumble*Math.sin(it.spin), it.spin*scatE*0.5, tumble*Math.cos(it.spin));
      _q.setFromEuler(_e);
    } else if (jf > 0.001 || headRoll !== 0){
      _e.set((it.jx||0)*jf, (it.jy||0)*jf, headRoll + (it.jz||0)*jf);
      _q.setFromEuler(_e);
    } else _q.identity();
    _m.compose(_p,_q,_s);
    blocks.setMatrixAt(i,_m);

    /* One colour per block — cardTone(dest) lifted, precomputed in
       recolorItems; a pose glide crossfades roles, and a scattering
       block fades into the ink printed at its home module, so it lands
       already BEING the code. */
    let col = state.poseT < 1 && it.fdisp !== undefined
      ? mixSRGB(it.fdisp, it.disp, PE) : it.disp;
    if (scatE > 0){
      const home = state.cardInkByRC && state.cardInkByRC.get(it.ir + '_' + it.ic);
      if (home !== undefined) col = mixSRGB(col, home, scatE);
    }
    _c.setHex(col);
    blocks.setColorAt(i,_c);
  }
  blocks.instanceMatrix.needsUpdate = true;
  blocks.instanceColor.needsUpdate  = true;

  /* Camera. The QR state uses a very long lens from far away — close
     enough to orthographic that the code stays a true square grid; the
     cat state dollies in to a normal lens for depth. Framing is held
     constant while the fov changes, so it reads as one move.          */
  const cu = easeInOut(THREE.MathUtils.clamp(state.cam,0,1));
  const fov = (7 + 27*cu) + state.fovBoost;
  camera.fov = fov;
  camera.updateProjectionMatrix();

  /* Fit the content to whichever axis is tighter. The scene is wider than
     it is tall, so on a narrow or portrait viewport the width is what
     decides the distance — otherwise the ground runs off the sides. */
  /* Framed with ~20% more air than the content strictly needs — the
     object should sit in the room like a keepsake, not fill the shelf. */
  const air   = state.fovBoost ? 0.84 : 1;   // a phone has no room to spare
  const needH = (0.95 - 0.03*cu) * air;
  const needW = (0.90 + 0.28*cu) * air;      // the rug is widest across its diagonal
  /* Typing mode on a phone: the link card covers the bottom `inset` of
     the stage. Rather than resizing the canvas (a blank flash per
     frame of transition), zoom out to fit the visible band and slide
     the image up to centre in it — all per-frame, all smooth. */
  state.inset = (state.inset || 0) + ((state.insetTarget || 0) - (state.inset || 0)) * (1 - Math.exp(-dt*9));
  if (state.inset < 0.002 && !state.insetTarget) state.inset = 0;
  const vis = 1 - state.inset;
  const frameHalf = Math.max(needH / vis, needW / camera.aspect);
  const dist = frameHalf / Math.tan(fov*Math.PI/360);
  {
    const W = renderer.domElement.width, H = renderer.domElement.height;
    if (state.inset > 0) camera.setViewOffset(W, H, 0, state.inset*H/2, W, H);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }
  const ang  = -Math.PI/2 + cu * (Math.PI/2 - 0.60);   // elevation

  /* Drag spins the scene, but only in the animal state: the spin is
     scaled by `cu`, so returning to the code always unwinds to dead
     top-down. A tilted QR is a QR that will not scan. */
  if (!state.dragging){
    state.spin += state.spinVel * dt;
    state.spinVel *= Math.pow(0.02, dt);
  }
  const idle = state.spun ? 0 : Math.sin(time*0.25)*0.02;
  const yaw  = cu * (0.30 + state.spin + idle);
  camera.position.set(
    Math.cos(ang)*Math.sin(yaw)*dist,
    -Math.sin(ang)*dist,
    Math.cos(ang)*Math.cos(yaw)*dist
  );
  camera.lookAt(0, cu*0.30, 0);
  key.target.position.set(0, cu*0.3, 0);

  renderer.render(scene,camera);
  fallbackEl?.classList.add('hidden');
}
requestAnimationFrame(frame);

// prototype: drive one frame at a chosen morph value, so the scannability
// check can run without a compositing window
// drive the loop with a supplied timestamp, so the morph's pacing can be
// checked without depending on a real animation frame
window.__cat.tick = now => frame(now);
window.__cat.step = v => {
  state.t = state.target = state.cam = v;
  setView(v > 0.5 ? 1 : 0);
  frame(performance.now());
};

// ---------------------------------------------------------------- ui

function resize(){
  // the canvas fills the stage, which is the window minus the dashboard
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  state.fovBoost = w < 520 ? 6 : 0;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(stage);
resize();

/* The canvas is a display area now — every control lives in the panel.
   Tapping the scene still flips it, so the view segment is the single
   source of truth and both routes go through setView. */
const viewSeg = document.getElementById('view');

function setView(v){
  if (v === 0 && state.target === 1 && state.t > 0.3) SOUND.scatter();
  /* the voice belongs to the moment of birth: it starts as the growth
     starts, so the spring's landing bounce falls on the tail of the
     meow — the beat the ear expects */
  if (v === 1 && state.target === 0) playPose();
  state.target = v;
  viewSeg.querySelectorAll('button').forEach(b=>
    b.setAttribute('aria-pressed', String(+b.dataset.view === v)));
}
const toggle = () => setView(state.target > 0.5 ? 0 : 1);

/* One gesture, two meanings: a tap flips between the code and the cat,
   a horizontal drag turns the scene. They are told apart by how far the
   pointer travelled, so neither needs its own control. */
const TAP_SLOP = 9;                       // px
let down = null;

const cv = renderer.domElement;
cv.addEventListener('pointerdown', e=>{
  const now = performance.now();
  down = {x:e.clientX, y:e.clientY, t:now, moved:0, last:e.clientX, lastT:now};
  state.dragging = true;
  state.spinVel = 0;
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e=>{
  if (!down) return;
  const now = performance.now();
  const dx = e.clientX - down.last, dt = Math.max(4, now - down.lastT)/1000;
  down.last = e.clientX; down.lastT = now;
  down.moved = Math.max(down.moved, Math.hypot(e.clientX-down.x, e.clientY-down.y));
  if (down.moved > TAP_SLOP){
    const k = dx / stage.clientWidth * 3.4;   // a full-width drag turns ~195°
    state.spin += k;
    state.spinVel = k / dt;            // carried into the flick
    state.spun = true;                 // stop the idle sway once turned by hand
  }
});
const release = e=>{
  if (!down) return;
  const tap = down.moved <= TAP_SLOP && performance.now()-down.t < 400;
  down = null;
  state.dragging = false;
  if (tap){ state.spinVel = 0; toggle(); }
};
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);


/* ---- hash-unique pet ---------------------------------------------------
   The link decides the pet. Its text is hashed (FNV-1a, then mixed per
   pick) into animal, coat, pattern and pose — deterministic, so a link
   always summons the same companion, on every machine, for everyone
   you send it to. Manual choices override until the link changes. */
function petOfLink(text){
  let h = 2166136261 >>> 0;
  for (let i=0;i<text.length;i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const pick = n => {
    h = Math.imul(h ^ (h>>>13), 2246822519) >>> 0;
    h = (h ^ (h>>>16)) >>> 0;        // second stir — near-identical links must diverge
    return h % n;
  };
  return {
    animal : pick(2) ? 'dog' : 'cat',
    color  : ['ginger','black','grey','cream'][pick(4)],
    pattern: ['solid','tabby','tuxedo','calico'][pick(4)],
    pose   : ['sit','tilt','stretch','curl'][pick(4)],
  };
}
const pressSeg = (id, key, val) =>
  document.querySelectorAll('#'+id+' button').forEach(b=>
    b.setAttribute('aria-pressed', String(b.dataset[key]===val)));
/* A dimension the user has touched belongs to the user: the link's
   hash only fills the choices nobody has made. Editing the URL no
   longer confiscates a hand-picked coat. (Reload returns it to fate.) */
const pinned = { animal:false, color:false, pattern:false, pose:false };
function applyLinkPet(text){
  const p = petOfLink(text);          // full pick chain runs regardless — determinism
  if (!pinned.animal){ state.animal = p.animal; pressSeg('animals','animal',p.animal); }
  if (!pinned.pose)  { state.pose   = p.pose;   pressSeg('poses','pose',p.pose); }
  if (!pinned.color) { coat.color   = p.color;  pressSeg('coatColor','color',p.color); }
  if (!pinned.pattern){ coat.pattern = p.pattern; pressSeg('coatPattern','pattern',p.pattern); }
  applyCoatUI(); applyFavicon();
}

const input = document.getElementById('url');
function grow(){
  const text = input.value.trim() || 'https://bear20252026.github.io/';
  applyLinkPet(text);               // the link decides who lives in it
  build(text);
  state.t = 0; state.cam = 0;
  state.spin = 0; state.spinVel = 0; state.spun = false;
  setView(0);                       // a fresh link always lands on the code
}

/* The code follows the typing. Every edit rebuilds after a beat — the
   current view is kept, so you can watch the cat itself re-knit while
   you type. (catVoxels is cached per grid size, so a rebuild is cheap
   after the first one.) */
/* Two clocks while typing. The CODE follows every keystroke after a
   short beat — cheap, and it is what the reference toys do. The PET is
   only re-summoned after a real pause (or when you leave the field):
   re-rolling animal and pose on every character made the whole
   creature convulse under your thumbs. */
let liveTimer = null, petTimer = null, petDue = false;
const currentText = () => input.value.trim() || 'https://bear20252026.github.io/';
function rebuildKeepingView(text){
  const t = state.t, target = state.target;
  build(text);
  state.t = t; state.target = target;
}
function summonPet(){
  clearTimeout(petTimer); petTimer = null;
  if (!petDue) return;
  petDue = false;
  applyLinkPet(lastText);
  rebuildKeepingView(lastText);
}
input.addEventListener('input', ()=>{
  clearTimeout(liveTimer);
  liveTimer = setTimeout(()=>{
    const text = currentText();
    if (text === lastText) return;
    rebuildKeepingView(text);       // the code, right away
    petDue = true;                  // the pet, once you pause
    clearTimeout(petTimer);
    petTimer = setTimeout(summonPet, 900);
  }, 120);
});
input.addEventListener('blur', summonPet);

/* Typing mode on a phone: the input rides just above the keyboard, the
   scene keeps everything else. visualViewport is the only honest source
   for the keyboard's height — the layout viewport does not shrink. */
const isPhone = () => matchMedia('(max-width: 860px)').matches;
const rootStyle = document.documentElement.style;
function layoutTyping(){
  if (!document.body.classList.contains('typing')) return;
  const vv = window.visualViewport;
  const panelH = document.getElementById('panel').offsetHeight || 120;
  const kb = vv ? Math.max(0, innerHeight - vv.height) : 0;
  /* Before the keyboard reports in, assume it will take the lower half
     (a touch generous, so the card is never under it — iOS would scroll
     the page). Once visualViewport knows, use the real edge. */
  const avail = kb > 0 ? vv.height : Math.round(innerHeight * 0.52);
  const cardTop = Math.max(120, avail - panelH);
  rootStyle.setProperty('--stageH', cardTop + 'px');
  // how much of the stage the card now covers — the camera tweens toward it
  state.insetTarget = Math.max(0, 1 - cardTop / Math.max(1, stage.clientHeight));
  if (window.scrollY || (vv && vv.pageTop)) window.scrollTo(0, 0);   // undo any scroll iOS still did
}
input.addEventListener('focus', ()=>{
  if (!isPhone()) return;
  document.body.classList.add('typing');
  layoutTyping();
  setTimeout(layoutTyping, 400);   // the keyboard animates in; measure again when it lands
  setTimeout(layoutTyping, 800);
});
input.addEventListener('blur', ()=>{
  document.body.classList.remove('typing');
  rootStyle.removeProperty('--stageH');
  state.insetTarget = 0;
});
if (window.visualViewport){
  visualViewport.addEventListener('resize', layoutTyping);
  visualViewport.addEventListener('scroll', layoutTyping);
}

/* Rebuild in place: same link, same morph position, new colours. Used by
   both the theme switch and the ground switch, so neither of them yanks
   the cat back to the flat state while you are looking at it. */
function restyle(){
  const t = state.t, target = state.target;
  build(lastText);
  state.t = t; state.target = target;
}

// segmented controls: one pressed at a time
function segment(id, onPick){
  const root = document.getElementById(id);
  root.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', ()=>{
      if (b.disabled) return;
      root.querySelectorAll('button')
          .forEach(o=>o.setAttribute('aria-pressed', String(o===b)));
      onPick(b.dataset);
    });
  });
}
document.getElementById('heart').addEventListener('click', function(){
  this.classList.toggle('loved');
});

/* Quick actions. They share the ENCODED link for now; once this is
   deployed, swap in the app's own ?q= URL so the shares open the toy. */
/* ---- sound ----------------------------------------------------------
   Everything is synthesised in WebAudio — no files, no licences, and a
   cartoon voice suits a voxel cat better than a field recording would.
   Four pose voices (meow / mrrp / yawn-meow / purr), a scatter hush,
   and a soft tick on buttons. No hover sounds, on purpose. */
let AC = null, masterGain = null;
state.muted = false;

function audio(){
  if (!AC){
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(AC.destination);
    } catch(e){ return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

/* one voiced note: oscillator + pitch moves + envelope, optional trill
   (amplitude modulation) — enough vocabulary for a cartoon cat */
function voice({f0, moves=[], type='triangle', dur=0.4, peak=0.2,
                attack=0.02, trill=0, lp=2400}){
  const ac = audio(); if (!ac || state.muted) return;
  const t0 = ac.currentTime;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  for (const [dt, f] of moves) o.frequency.exponentialRampToValueAtTime(f, t0 + dt);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (trill){
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = trill;
    lg.gain.value = peak * 0.45;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur);
  }
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = lp;
  o.connect(f); f.connect(g); g.connect(masterGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noiseBurst({dur=0.5, peak=0.1, attack=0.05, type='lowpass', freq=800, q=1, am=0}){
  const ac = audio(); if (!ac || state.muted) return;
  const t0 = ac.currentTime;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (am){
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = am; lg.gain.value = peak * 0.6;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur);
  }
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start(t0);
}

/* UI sounds stay synthesised; the CAT speaks with real recordings —
   public-domain files from Wikimedia Commons (see sounds/). The synth
   voices remain only as a fallback if a file fails to load or decode. */
const SOUND = {
  scatter: () => noiseBurst({dur:0.7, peak:0.09, attack:0.06, type:'bandpass', freq:1100, q:0.8}),
  tick:    () => noiseBurst({dur:0.035, peak:0.07, attack:0.004, type:'highpass', freq:3000}),
};
const SYNTH = {
  cat: {
    sit:     () => voice({f0:520, moves:[[0.10,920],[0.42,400]], dur:0.46, peak:0.22}),
    tilt:    () => voice({f0:380, moves:[[0.26,760]], dur:0.30, peak:0.20, trill:30}),
    stretch: () => voice({f0:330, moves:[[0.22,640],[0.88,250]], dur:0.95, peak:0.18, attack:0.12}),
    curl:    () => noiseBurst({dur:2.6, peak:0.15, attack:0.45, freq:240, am:25}),
  },
  dog: {
    sit:     () => voice({f0:240, moves:[[0.05,170],[0.13,110]], dur:0.15, peak:0.24}),
    tilt:    () => voice({f0:520, moves:[[0.30,900]], dur:0.38, peak:0.16}),
    stretch: () => voice({f0:300, moves:[[0.25,560],[0.90,210]], dur:1.0, peak:0.16, attack:0.14}),
    curl:    () => noiseBurst({dur:1.3, peak:0.12, attack:0.30, freq:420}),
  },
};
/* `start` picks the best single vocalisation out of each recording —
   chosen by RMS-envelope (and zero-crossing) analysis, not by ear.
   The dog is voiced by four CC0 Freesound recordings, each a file whose
   ENTIRE content is the one named sound — mining segments out of long
   field recordings kept picking the wrong event (a shake for a yawn,
   the owner's word for a bark), so single-purpose files only. */
const SAMPLES = {
  cat: {
    sit:     { url:'sounds/meow-pleading.oga',  gain:0.9, start:3.72,  max:1.10 },
    tilt:    { url:'sounds/meow-impatient.ogg', gain:0.9, start:4.58,  max:0.85 },
    // same cat as sit, its long final call — the previous stretch clip
    // turned out to contain the owner's voice, not the cat's
    stretch: { url:'sounds/meow-pleading.oga',  gain:0.85, start:10.18, max:1.30 },
    curl:    { url:'sounds/purr-cat.oga',       gain:0.8, start:0.60,  max:3.40, fade:0.9 },
  },
  dog: {
    sit:     { url:'sounds/bark-single.mp3',   gain:0.8, start:0,     max:0.45 },
    // one clean loud questioning whine, same recordist as the yawn so
    // the two voices share a room
    tilt:    { url:'sounds/whine-malinois.mp3', gain:0.65, start:2.60, max:0.70 },
    stretch: { url:'sounds/yawn-squeaky.mp3',  gain:0.75, start:0,    max:1.00 },
    curl:    { url:'sounds/sigh-puppy.mp3',    gain:3.2, start:0,     max:1.40, fade:0.5 },
  },
};
const sampleBufs = new Map();          // keyed by URL — poses may share a file
async function loadSample(url){
  if (sampleBufs.has(url)) return sampleBufs.get(url);
  const ac = audio(); if (!ac) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) throw 0;
    const b = await ac.decodeAudioData(await r.arrayBuffer());
    sampleBufs.set(url, b);
    return b;
  } catch(e){ sampleBufs.set(url, null); return null; }
}
async function playPose(){
  if (state.muted) return;
  const T = SAMPLES[state.animal] || SAMPLES.cat;
  const k = state.pose in T ? state.pose : 'sit';
  const ac = audio(); if (!ac) return;
  const sp = T[k];
  const b = await loadSample(sp.url);
  if (!b){ const S = SYNTH[state.animal] || SYNTH.cat; (S[k] || S.sit)(); return; }
  const t0 = ac.currentTime;
  const off = Math.min(sp.start || 0, Math.max(0, b.duration - 0.2));
  const dur = Math.min(sp.max, b.duration - off);
  const fade = Math.min(sp.fade ?? 0.15, dur*0.5);
  const src = ac.createBufferSource(); src.buffer = b;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(sp.gain, t0 + 0.03);
  g.gain.setValueAtTime(sp.gain, t0 + dur - fade);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g); g.connect(masterGain);
  src.start(t0, off); src.stop(t0 + dur + 0.05);
}

// a soft tick for every button in the panel — clicks only, never hover
document.getElementById('panel').addEventListener('click', e => {
  if (e.target.closest('button')) SOUND.tick();
});

// two splits on a phone: the scene shrinks, the controls get room
document.getElementById('grip').addEventListener('click', ()=>{
  const big = document.body.classList.toggle('big');
  document.getElementById('grip').setAttribute('aria-label', big ? 'More room for the scene' : 'More room for the controls');
});

const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', ()=>{
  state.muted = !state.muted;
  muteBtn.innerHTML = `<i data-lucide="${state.muted ? 'volume-x' : 'volume-2'}"></i>`;
  if (window.lucide) lucide.createIcons();
});

const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove('on'), 1600);
}

const flash = btn => { btn.classList.add('done'); setTimeout(()=>btn.classList.remove('done'), 900); };
document.getElementById('shCopy').addEventListener('click', async function(){
  try {
    await navigator.clipboard.writeText(lastText);
    flash(this); showToast('Link copied');
  } catch(e){ showToast('Copy failed — try again'); }
});
document.getElementById('shDl').addEventListener('click', function(){
  frame(performance.now());               // make sure the buffer holds a fresh frame
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = state.animal === 'dog' ? 'qr-dog.png' : 'qr-cat.png';
  a.click();
  flash(this); showToast('Image saved');
});
document.getElementById('shX').addEventListener('click', ()=>{
  window.open('https://twitter.com/intent/tweet?text=' +
    encodeURIComponent(state.animal === 'dog' ? 'My link became a dog 🐕' : 'My link became a cat 🐈') +
    '&url=' + encodeURIComponent(lastText), '_blank', 'noopener');
});
document.getElementById('shIn').addEventListener('click', ()=>{
  window.open('https://www.linkedin.com/sharing/share-offsite/?url=' +
    encodeURIComponent(lastText), '_blank', 'noopener');
});

segment('view',    d => setView(+d.view));
/* The coat card wears the selected animal's own palette: the four dots
   repaint (cat coats vs 赤/黑/胡麻/白), and the pattern row hides for
   the dog — a shiba's pattern is its urajiro, on every coat. */
const DOT_HEX = {
  cat: { ginger:'#E09A4E', black:'#4C433C', grey:'#9FA2AA', cream:'#F8F4EC' },
  dog: { ginger:'#DF8E4F', black:'#35302B', grey:'#94582F', cream:'#F4EDDE' },
};
function applyCoatUI(){
  const hexes = DOT_HEX[state.animal];
  document.querySelectorAll('#coatColor button').forEach(b=>{
    b.querySelector('.dot').style.background = hexes[b.dataset.color];
  });
  document.getElementById('coatPattern').style.display =
    state.animal === 'dog' ? 'none' : '';
}
/* Cat ↔ dog is the same move as a pose switch: every block glides from
   where it rests on one animal to its place on the other. The tab icon
   changes species with it. */
segment('animals', d => {
  pinned.animal = true;
  if (d.animal === state.animal) return;
  state.animal = d.animal;
  applyFavicon();
  applyCoatUI();
  if (state.t > 0.5) playPose();
  const carry = new Map();
  for (const it of state.items)
    if (it.mid !== undefined)
      carry.set(it.mid, {x:it.x1, y:it.y1, z:it.z1, disp:it.disp});
  const t = state.t, target = state.target;
  build(lastText, carry);
  state.t = t; state.target = target;
  state.poseT = 0;
});
/* Poses are chosen, not hovered. sit↔tilt is a runtime rotation; any
   other switch morphs pose-to-pose in place: every block glides from
   where it rests to where the new pose wants it, colour included. */
segment('poses', d => {
  pinned.pose = true;
  const prev = state.pose;
  state.pose = d.pose;
  if (state.t > 0.5) playPose();                       // voice as the move begins
  if (poseKeyOf(d.pose) === poseKeyOf(prev)) return;   // tilt only
  const carry = new Map();
  for (const it of state.items)
    if (it.mid !== undefined)
      carry.set(it.mid, {x:it.x1, y:it.y1, z:it.z1, disp:it.disp});
  const t = state.t, target = state.target;
  build(lastText, carry);
  state.t = t; state.target = target;
  state.poseT = 0;                                     // …and glide
});
segment('coatColor',   d => { pinned.color   = true; coat.color   = d.color;   restyle(); });
segment('coatPattern', d => { pinned.pattern = true; coat.pattern = d.pattern; restyle(); });

/* Light / dark. The CSS side transitions on its own; the scene side is
   the themeMix tween in frame(). Nothing rebuilds — the same cat just
   dissolves into the other room. */
const themeBtn = document.getElementById('themeBtn');
/* The tab icon says the whole product in 64px: a scanner's viewfinder
   corners around a pixel pet face. It changes species with the ANIMAL
   segment and keeps its ink readable in both themes. */
function applyFavicon(){
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const ink = themeKey === 'dark' ? '#E9E2D2' : '#54463A';

  // the four scan-frame corners everyone knows from their camera app
  g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round';
  const L = 14, M = 4;
  for (const [cx,cy,sx,sy] of [[M,M,1,1],[64-M,M,-1,1],[M,64-M,1,-1],[64-M,64-M,-1,-1]]){
    g.beginPath();
    g.moveTo(cx, cy+sy*L); g.lineTo(cx, cy); g.lineTo(cx+sx*L, cy);
    g.stroke();
  }

  // pixel face on a 4px grid, centred in the frame
  const P = (x,y,w,h,c)=>{ g.fillStyle=c; g.fillRect(16+x*4, 16+y*4, w*4, h*4); };
  if (state.animal === 'dog'){
    const coatC = '#DF8E4F';
    P(0,0,2,2,coatC); P(6,0,2,2,coatC);       // prick ears
    P(0,2,8,6,coatC);                          // head
    P(2,5,4,3,'#F6EBD7');                      // urajiro muzzle
    P(2,3,1,1,'#2B2119'); P(5,3,1,1,'#2B2119');// eyes
    P(3,6,2,1,'#2B2119');                      // black nose
  } else {
    const coatC = '#E8934A';
    P(0,0,2,2,coatC); P(6,0,2,2,coatC);        // pointed ears
    P(0,2,8,6,coatC);                           // head
    P(2,4,1,1,'#2E2822'); P(5,4,1,1,'#2E2822'); // eyes
    P(3,5,2,1,'#E4879A');                       // pink nose
  }

  let link = document.querySelector('link[rel="icon"]');
  if (!link){
    link = document.createElement('link');
    link.rel = 'icon'; link.type = 'image/png';
    document.head.appendChild(link);
  }
  link.href = cv.toDataURL('image/png');
}

function applyTheme(name, instant){
  themeKey = name;
  applyFavicon();
  state.themeTarget = name === 'dark' ? 1 : 0;
  document.documentElement.dataset.theme = name;
  // shows where the click goes
  themeBtn.innerHTML = `<i data-lucide="${name === 'dark' ? 'sun' : 'moon'}"></i>`;
  if (window.lucide) lucide.createIcons();
  if (instant){
    state.themeMix = state.themeTarget;
    applySceneTheme(state.themeMix);
  }
}
themeBtn.addEventListener('click', ()=> applyTheme(themeKey==='dark'?'light':'dark'));
applyTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', true);
applyCoatUI();
input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ input.blur(); grow(); }});

grow();
