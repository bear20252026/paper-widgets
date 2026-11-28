// Lamborghini FL3 Procedural 3D Engine Model
// Built to exact proportions: 92 mm bore, 110 mm stroke, 150 mm cylinder spacing, crank axis at origin.
// All geometries, materials, particles, and kinematics generated procedurally in code.

import * as THREE from 'three';

export class FL3EngineModel {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Sub-assemblies for animation and exploded view
    this.parts = {};
    this.movingParts = {
      crankshaft: null,
      conRods: [],
      pistons: [],
      camshaft: null,
      camLobes: [],
      tappets: [],
      pushrods: [],
      rockers: [],
      valves: [],
      springs: [],
      blowerRotor: null,
      pulleys: [],
      starterPinion: null,
      governorLever: null,
      flapperCap: null,
      combustionGlows: []
    };

    // View state
    this.currentView = 'painted'; // 'painted', 'cutaway', 'airflow', 'exploded'
    this.explodedProgress = 0.0;
    this.targetExploded = 0.0;

    // Clipping plane for cutaway mode (slices at x = 0 through cylinder axes, removing negative-X half)
    this.cutawayPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0.0);

    // Colors
    this.colorCelesteEnamel = new THREE.Color(0x3F9DD0); // Deep celeste #3F9DD0
    this.colorCelestePrint = new THREE.Color(0x58AED6);
    this.colorArancio = new THREE.Color(0xE0561C);       // Arancio #E0561C
    this.colorStand = new THREE.Color(0xE0561C);         // Orange test stand
    this.colorCastIron = new THREE.Color(0x282624);
    this.colorSteel = new THREE.Color(0x8C8880);
    this.colorAlloy = new THREE.Color(0xCCCCCC);
    this.colorCopper = new THREE.Color(0xD97236);        // Reddish copper
    this.colorExhaust = new THREE.Color(0x22211F);       // Heat darkened matte exhaust
    this.colorPaperGhost = new THREE.Color(0xDDD8C8);

    // Build procedural textures, materials and assemblies
    this.initMaterials();
    this.buildAssembly();
    this.buildAirflowParticles();
    this.buildSmokeParticles();
  }

  // Procedural canvas textures for name plate, stencilled cowl, and arancio section hatch
  createNameplateTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Brass/alloy plate background
    ctx.fillStyle = '#C8C2B2';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#1C1B19';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 500, 116);

    // Stamped black lettering (no company logo)
    ctx.fillStyle = '#1C1B19';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 32px "Archivo", sans-serif';
    ctx.fillText('MOTORE DIESEL · FL3', 256, 45);

    ctx.font = '600 28px "IBM Plex Mono", monospace';
    ctx.fillText('CV 39 · 2200 g/min', 256, 88);

    // Corner rivet dots
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(20, 20, 6, 0, Math.PI * 2);
    ctx.arc(492, 20, 6, 0, Math.PI * 2);
    ctx.arc(20, 108, 6, 0, Math.PI * 2);
    ctx.arc(492, 108, 6, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  createCowlStencilTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Deep celeste painted sheet metal background
    ctx.fillStyle = '#3F9DD0';
    ctx.fillRect(0, 0, 1024, 256);

    // White/ivory spray stencil
    ctx.fillStyle = '#EEE9DC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 64px "Archivo", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('FL3 · RAFFREDDATO AD ARIA', 512, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }

  createHatchTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#EEE9DC';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#E0561C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = -128; i < 256; i += 16) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
    }
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  initMaterials() {
    // 1. Celeste enamel for cast engine block
    this.matCelesteEnamel = new THREE.MeshStandardMaterial({
      color: this.colorCelesteEnamel,
      roughness: 0.38,
      metalness: 0.15,
      clippingPlanes: []
    });

    // 2. Sheet metal cowl (smoother glossy paint)
    this.matCowl = new THREE.MeshStandardMaterial({
      map: this.createCowlStencilTexture(),
      roughness: 0.28,
      metalness: 0.12,
      clippingPlanes: []
    });

    // 3. Arancio test stand
    this.matStand = new THREE.MeshStandardMaterial({
      color: this.colorStand,
      roughness: 0.42,
      metalness: 0.25
    });

    // 4. Machined cast iron & steel (pistons, crank, con rods - NOT clipped in cutaway)
    this.matSteelInternal = new THREE.MeshStandardMaterial({
      color: this.colorSteel,
      roughness: 0.22,
      metalness: 0.85,
      clippingPlanes: [] // stays whole in cutaway
    });

    this.matAlloyPiston = new THREE.MeshStandardMaterial({
      color: this.colorAlloy,
      roughness: 0.32,
      metalness: 0.75,
      clippingPlanes: [] // stays whole in cutaway
    });

    // 5. External steel & alloy (can be clipped or hidden)
    this.matSteelExternal = new THREE.MeshStandardMaterial({
      color: this.colorSteel,
      roughness: 0.35,
      metalness: 0.70,
      clippingPlanes: []
    });

    this.matCastFins = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x32302E),
      roughness: 0.65,
      metalness: 0.40,
      clippingPlanes: []
    });

    // 6. Polished copper injector lines
    this.matCopper = new THREE.MeshStandardMaterial({
      color: this.colorCopper,
      roughness: 0.18,
      metalness: 0.90,
      clippingPlanes: []
    });

    // 7. Heat-darkened exhaust stack and silencer
    this.matExhaust = new THREE.MeshStandardMaterial({
      color: this.colorExhaust,
      roughness: 0.82,
      metalness: 0.20,
      clippingPlanes: []
    });

    // 8. Name plate
    this.matNameplate = new THREE.MeshStandardMaterial({
      map: this.createNameplateTexture(),
      roughness: 0.3,
      metalness: 0.5
    });

    // 9. Glass sediment pre-cleaner bowl
    this.matGlass = new THREE.MeshPhysicalMaterial({
      color: 0xEAE8E2,
      transmission: 0.85,
      opacity: 0.75,
      transparent: true,
      roughness: 0.1,
      ior: 1.5
    });

    // 10. Cutaway section hatch material (light arancio hatch)
    this.matSectionHatch = new THREE.MeshBasicMaterial({
      map: this.createHatchTexture(),
      side: THREE.DoubleSide
    });
  }

  // Construct complete procedural engine assembly
  buildAssembly() {
    // 1. Arancio Test Stand (Banco di collaudo arancio)
    const stand = new THREE.Group();
    const bedGeo = new THREE.BoxGeometry(0.55, 0.08, 0.95);
    const bedMesh = new THREE.Mesh(bedGeo, this.matStand);
    bedMesh.position.set(0, -0.32, 0);
    bedMesh.castShadow = true;
    bedMesh.receiveShadow = true;
    stand.add(bedMesh);

    // 4 Heavy channel mounting pillars with clamping bolts
    const pillarGeo = new THREE.BoxGeometry(0.08, 0.20, 0.10);
    const pCoords = [
      [-0.18, -0.22, -0.26],
      [0.18, -0.22, -0.26],
      [-0.18, -0.22, 0.26],
      [0.18, -0.22, 0.26]
    ];
    for (const [px, py, pz] of pCoords) {
      const pm = new THREE.Mesh(pillarGeo, this.matStand);
      pm.position.set(px, py, pz);
      stand.add(pm);

      // Clamping bolt
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), this.matSteelExternal);
      bolt.position.set(px, py + 0.11, pz);
      stand.add(bolt);
    }
    this.parts.stand = stand;
    this.root.add(stand);

    // 2. Crankcase (Monoblocco / Basamento celeste)
    const crankcase = new THREE.Group();
    // Main crankcase box with main-bearing ribs
    const caseGeo = new THREE.BoxGeometry(0.28, 0.24, 0.62);
    const caseMesh = new THREE.Mesh(caseGeo, this.matCelesteEnamel);
    caseMesh.position.set(0, -0.04, 0);
    caseMesh.castShadow = true;
    crankcase.add(caseMesh);

    // Main bearing external reinforcing ribs
    const ribGeo = new THREE.BoxGeometry(0.29, 0.18, 0.018);
    for (const rz of [-0.22, -0.07, 0.07, 0.22]) {
      const rib = new THREE.Mesh(ribGeo, this.matCelesteEnamel);
      rib.position.set(0, -0.04, rz);
      crankcase.add(rib);
    }

    // Oil sump underneath
    const sumpGeo = new THREE.BoxGeometry(0.24, 0.08, 0.54);
    const sumpMesh = new THREE.Mesh(sumpGeo, this.matCelesteEnamel);
    sumpMesh.position.set(0, -0.19, 0);
    crankcase.add(sumpMesh);

    // Timing case at front (z = -0.32)
    const timingGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 24);
    timingGeo.rotateX(Math.PI / 2);
    const timingMesh = new THREE.Mesh(timingGeo, this.matCelesteEnamel);
    timingMesh.position.set(0, 0, -0.32);
    crankcase.add(timingMesh);

    // Flywheel rear cover plate (z = +0.32)
    const rearPlateGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 28);
    rearPlateGeo.rotateX(Math.PI / 2);
    const rearPlateMesh = new THREE.Mesh(rearPlateGeo, this.matCelesteEnamel);
    rearPlateMesh.position.set(0, 0, 0.32);
    crankcase.add(rearPlateMesh);

    // Name plate on cold side of crankcase
    const plateGeo = new THREE.PlaneGeometry(0.12, 0.04);
    const plateMesh = new THREE.Mesh(plateGeo, this.matNameplate);
    plateMesh.position.set(0.141, -0.02, 0);
    plateMesh.rotation.y = Math.PI / 2;
    crankcase.add(plateMesh);

    this.parts.crankcase = crankcase;
    this.root.add(crankcase);

    // 3. Crankshaft & Flywheel Assembly (Albero motore e volano)
    const crankAssembly = new THREE.Group();
    const crankShaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.68, 20);
    crankShaftGeo.rotateX(Math.PI / 2);
    const crankShaftMesh = new THREE.Mesh(crankShaftGeo, this.matSteelInternal);
    crankAssembly.add(crankShaftMesh);

    // 3 Crank throws & counterweights (120 deg apart: 0, 240, 120)
    const throwAngles = [0, (240 * Math.PI) / 180, (120 * Math.PI) / 180];
    const cylZ = [-0.15, 0.0, 0.15];
    this.crankPins = [];

    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const ang = throwAngles[i];
      const r = 0.055; // 55 mm crank radius (110 mm stroke / 2)

      const pinGroup = new THREE.Group();
      pinGroup.position.set(0, 0, cz);
      pinGroup.rotation.z = ang;

      // Web counterweight
      const webGeo = new THREE.BoxGeometry(0.045, 0.09, 0.028);
      const web1 = new THREE.Mesh(webGeo, this.matSteelInternal);
      web1.position.set(0, r / 2, -0.022);
      pinGroup.add(web1);

      const web2 = new THREE.Mesh(webGeo, this.matSteelInternal);
      web2.position.set(0, r / 2, 0.022);
      pinGroup.add(web2);

      // Crankpin journal
      const pinGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.042, 16);
      pinGeo.rotateX(Math.PI / 2);
      const pinMesh = new THREE.Mesh(pinGeo, this.matSteelInternal);
      pinMesh.position.set(0, r, 0);
      pinGroup.add(pinMesh);

      crankAssembly.add(pinGroup);
      this.crankPins.push({ group: pinGroup, baseAngle: ang, z: cz });
    }

    // Heavy Cast Flywheel with Ring Gear at rear
    const flywheel = new THREE.Group();
    flywheel.position.set(0, 0, 0.34);

    const fwBody = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 32), this.matSteelInternal);
    fwBody.rotation.x = Math.PI / 2;
    flywheel.add(fwBody);

    // Starter Ring Gear teeth rim
    const ringGear = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.012, 8, 48), this.matSteelInternal);
    flywheel.add(ringGear);

    crankAssembly.add(flywheel);
    this.parts.crankshaft = crankAssembly;
    this.movingParts.crankshaft = crankAssembly;
    this.root.add(crankAssembly);

    // 4. Connecting Rods & Pistons (Bielle e pistoni)
    const rodsPistonsGroup = new THREE.Group();
    this.cylinders = [];

    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];

      // Connecting rod
      const rodGroup = new THREE.Group();
      const rodBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.18, 12), this.matSteelInternal);
      rodGroup.add(rodBody);

      // Piston (92 mm bore = 0.092 m diameter)
      const pistonGroup = new THREE.Group();
      const pistonBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.075, 24), this.matAlloyPiston);
      pistonGroup.add(pistonBody);

      // Toroidal direct-injection combustion bowl in crown
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 16), this.matCastFins);
      bowl.position.set(0, 0.032, 0);
      pistonGroup.add(bowl);

      // Piston rings
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0452, 0.0012, 6, 24), this.matSteelInternal);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.022 - r * 0.01;
        pistonGroup.add(ring);
      }

      // Combustion glow light for cutaway mode
      const glowLight = new THREE.PointLight(0xE0561C, 0, 0.35);
      glowLight.position.set(0, 0.22, cz);
      this.root.add(glowLight);
      this.movingParts.combustionGlows.push(glowLight);

      rodsPistonsGroup.add(rodGroup);
      rodsPistonsGroup.add(pistonGroup);

      this.cylinders.push({
        rod: rodGroup,
        piston: pistonGroup,
        z: cz,
        phaseDeg: [0, 240, 120][i]
      });
    }
    this.parts.pistons = rodsPistonsGroup;
    this.root.add(rodsPistonsGroup);

    // 5. Individual Finned Cylinder Barrels (Cilindri alettati individuali)
    const barrelsGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const barrel = new THREE.Group();
      barrel.position.set(0, 0.13, cz);

      // Cast iron liner tube (bore 92 mm, wall 12 mm)
      const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.17, 24), this.matCastFins);
      barrel.add(liner);

      // Horizontal cooling fins, flattened where neighbours meet
      const numFins = 11;
      for (let f = 0; f < numFins; f++) {
        const finY = -0.07 + (f / (numFins - 1)) * 0.14;
        const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.0035, 24), this.matCastFins);
        fin.position.y = finY;
        fin.scale.set(1.0, 1.0, 0.88); // flattened in Z
        barrel.add(fin);
      }
      barrelsGroup.add(barrel);
    }
    this.parts.barrels = barrelsGroup;
    this.root.add(barrelsGroup);

    // 6. Individual Finned Cylinder Heads (Testate individuali alettate)
    const headsGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const head = new THREE.Group();
      head.position.set(0, 0.235, cz);

      // Main head block
      const headBlock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.07, 0.135), this.matCastFins);
      head.add(headBlock);

      // Horizontal head fins
      for (let hf = 0; hf < 5; hf++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.003, 0.142), this.matCastFins);
        fin.position.y = -0.025 + hf * 0.012;
        head.add(fin);
      }

      // 4 Long Through-Studs with nuts
      const studCoords = [
        [-0.055, -0.055],
        [0.055, -0.055],
        [-0.055, 0.055],
        [0.055, 0.055]
      ];
      for (const [sx, sz] of studCoords) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 8), this.matSteelExternal);
        stud.position.set(sx, -0.02, sz);
        head.add(stud);

        const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 6), this.matSteelExternal);
        nut.position.set(sx, 0.04, sz);
        head.add(nut);
      }

      // Injector seated into head center
      const inj = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 12), this.matSteelExternal);
      inj.position.set(-0.015, 0.045, 0);
      head.add(inj);

      headsGroup.add(head);
    }
    this.parts.heads = headsGroup;
    this.root.add(headsGroup);

    // 7. Rocker Covers (Coperchi bilancieri)
    const rockerCoversGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const rc = new THREE.Group();
      rc.position.set(0, 0.285, cz);

      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.11), this.matAlloyPiston);
      rc.add(cover);

      const acornNut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6), this.matSteelExternal);
      acornNut.position.set(0, 0.025, 0);
      rc.add(acornNut);

      rockerCoversGroup.add(rc);
    }
    this.parts.rockerCovers = rockerCoversGroup;
    this.root.add(rockerCoversGroup);

    // 8. Valve Train: Camshaft, Tappets, Pushrods, Rockers, Valves & Springs
    // Timed at half speed to four-stroke cycle
    const valveTrainGroup = new THREE.Group();
    this.valveTrainParts = [];

    // Camshaft running along hot side inside block (x = -0.075, y = -0.02)
    const camShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 16), this.matSteelInternal);
    camShaft.rotation.x = Math.PI / 2;
    camShaft.position.set(-0.075, -0.02, 0);
    valveTrainGroup.add(camShaft);
    this.movingParts.camshaft = camShaft;

    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      // Cylinder valve components: intake and exhaust
      const cylValves = {
        intake: { tappet: null, pushrod: null, rocker: null, valve: null, spring: null, baseZ: cz - 0.028 },
        exhaust: { tappet: null, pushrod: null, rocker: null, valve: null, spring: null, baseZ: cz + 0.028 },
        phaseDeg: [0, 240, 120][i]
      };

      for (const vType of ['intake', 'exhaust']) {
        const vData = cylValves[vType];
        const vz = vData.baseZ;

        // Cam lobe on camshaft
        const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.012), this.matSteelInternal);
        lobe.position.set(-0.075, -0.02, vz);
        valveTrainGroup.add(lobe);
        this.movingParts.camLobes.push(lobe);

        // Tappet / lifter
        const tappet = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.025, 12), this.matSteelInternal);
        tappet.position.set(-0.075, 0.01, vz);
        valveTrainGroup.add(tappet);
        vData.tappet = tappet;

        // Pushrod running from tappet up to cylinder head
        const pushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 8), this.matSteelInternal);
        pushrod.position.set(-0.075, 0.12, vz);
        valveTrainGroup.add(pushrod);
        vData.pushrod = pushrod;

        // Rocker arm pivoting at head top
        const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), this.matSteelInternal);
        rocker.position.set(-0.045, 0.265, vz);
        valveTrainGroup.add(rocker);
        vData.rocker = rocker;

        // Valve stem & head
        const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.065, 10), this.matSteelInternal);
        valve.position.set(-0.022, 0.235, vz);
        valveTrainGroup.add(valve);
        vData.valve = valve;

        // Compressing valve helical spring
        const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 12), this.matSteelInternal);
        spring.position.set(-0.022, 0.245, vz);
        valveTrainGroup.add(spring);
        vData.spring = spring;
      }

      this.valveTrainParts.push(cylValves);
    }
    this.parts.valveTrain = valveTrainGroup;
    this.root.add(valveTrainGroup);

    // 9. Front Axial Cooling Blower with Stator Vanes & Wire Guard
    const blowerGroup = new THREE.Group();
    blowerGroup.position.set(0.02, 0.14, -0.34);

    // Round housing
    const blowerHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.10, 32), this.matCelesteEnamel);
    blowerHousing.rotation.x = Math.PI / 2;
    blowerGroup.add(blowerHousing);

    // Fixed aerodynamic stator vanes
    for (let sv = 0; sv < 8; sv++) {
      const ang = (sv / 8) * Math.PI * 2;
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.003), this.matAlloyPiston);
      vane.position.set(Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0.035);
      vane.rotation.z = ang - 0.25;
      blowerGroup.add(vane);
    }

    // Spinning rotor with 12 axial blades
    const rotorGroup = new THREE.Group();
    const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 16), this.matAlloyPiston);
    rotorHub.rotation.x = Math.PI / 2;
    rotorGroup.add(rotorHub);

    for (let b = 0; b < 12; b++) {
      const ang = (b / 12) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.004), this.matAlloyPiston);
      blade.position.set(Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, 0);
      blade.rotation.z = ang + 0.35;
      rotorGroup.add(blade);
    }
    blowerGroup.add(rotorGroup);
    this.movingParts.blowerRotor = rotorGroup;

    // Protective wire guard in front
    const guardRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.004, 6, 24), this.matSteelExternal);
    guardRing1.position.z = -0.055;
    blowerGroup.add(guardRing1);

    const guardRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.003, 6, 24), this.matSteelExternal);
    guardRing2.position.z = -0.055;
    blowerGroup.add(guardRing2);

    // Pulley behind blower
    const blowerPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), this.matSteelExternal);
    blowerPulley.rotation.x = Math.PI / 2;
    blowerPulley.position.z = 0.06;
    blowerGroup.add(blowerPulley);

    this.parts.blower = blowerGroup;
    this.root.add(blowerGroup);

    // Crankshaft front V-belt pulley
    const crankPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 24), this.matSteelExternal);
    crankPulley.rotation.x = Math.PI / 2;
    crankPulley.position.set(0, 0, -0.34);
    this.root.add(crankPulley);

    // Dynamo (generatore) on hot side
    const dynamoGroup = new THREE.Group();
    dynamoGroup.position.set(-0.16, 0.02, -0.18);
    const dynamoBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.16, 16), this.matSteelExternal);
    dynamoBody.rotation.x = Math.PI / 2;
    dynamoGroup.add(dynamoBody);

    const dynamoPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 16), this.matSteelExternal);
    dynamoPulley.rotation.x = Math.PI / 2;
    dynamoPulley.position.z = -0.12;
    dynamoGroup.add(dynamoPulley);
    this.parts.dynamo = dynamoGroup;
    this.root.add(dynamoGroup);

    // V-belt running between crank, dynamo and blower pulleys
    const beltCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.34),
      new THREE.Vector3(0.02, 0.14, -0.34),
      new THREE.Vector3(-0.16, 0.02, -0.34)
    ], true);
    const beltGeo = new THREE.TubeGeometry(beltCurve, 32, 0.007, 6, true);
    const beltMesh = new THREE.Mesh(beltGeo, this.matExhaust);
    this.root.add(beltMesh);

    // 10. Sheet-metal Air Cowl (Convogliatore aria lungo il lato freddo)
    const airCowlGroup = new THREE.Group();
    airCowlGroup.position.set(0.11, 0.16, 0);

    const cowlGeo = new THREE.BoxGeometry(0.04, 0.22, 0.58);
    const cowlMesh = new THREE.Mesh(cowlGeo, this.matCowl);
    airCowlGroup.add(cowlMesh);
    this.parts.airCowl = airCowlGroup;
    this.root.add(airCowlGroup);

    // 11. Inline Injection Pump, Filters, and Copper Lines (Pompa iniezione Bosch)
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(-0.16, 0.04, 0.02);

    // Silver inline pump housing with 3 pumping elements
    const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.26), this.matAlloyPiston);
    pumpGroup.add(pumpBody);

    // Mechanical governor housing at rear
    const govHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 16), this.matAlloyPiston);
    govHousing.rotation.x = Math.PI / 2;
    govHousing.position.set(0, 0, 0.16);
    pumpGroup.add(govHousing);

    // Governor throttle lever
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, 0.015), this.matSteelExternal);
    lever.position.set(-0.045, 0.03, 0.16);
    pumpGroup.add(lever);
    this.movingParts.governorLever = lever;

    // Twin canister fuel filters (Filtri carburante doppi)
    const filter1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.10, 16), this.matCelesteEnamel);
    filter1.position.set(-0.03, 0.08, -0.16);
    pumpGroup.add(filter1);

    const filter2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.10, 16), this.matCelesteEnamel);
    filter2.position.set(-0.03, 0.08, -0.23);
    pumpGroup.add(filter2);

    // 3 Copper high-pressure lines leading up to injectors
    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const pipeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.14, 0.09, cz * 0.7),
        new THREE.Vector3(-0.11, 0.18, cz * 0.85),
        new THREE.Vector3(-0.02, 0.28, cz)
      ]);
      const pipeGeo = new THREE.TubeGeometry(pipeCurve, 16, 0.0035, 6, false);
      const pipeMesh = new THREE.Mesh(pipeGeo, this.matCopper);
      this.root.add(pipeMesh);
    }

    // Copper injector leak-off return line along the 3 heads
    const leakCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.02, 0.285, cylZ[2]),
      new THREE.Vector3(-0.02, 0.285, cylZ[1]),
      new THREE.Vector3(-0.02, 0.285, cylZ[0]),
      new THREE.Vector3(-0.12, 0.12, -0.18)
    ]);
    const leakGeo = new THREE.TubeGeometry(leakCurve, 20, 0.002, 6, false);
    const leakMesh = new THREE.Mesh(leakGeo, this.matCopper);
    this.root.add(leakMesh);

    this.parts.injectionPump = pumpGroup;
    this.root.add(pumpGroup);

    // 12. Exhaust Manifold, Silencer, and Flapper Rain Cap (Scarico e silenziatore)
    const exhaustGroup = new THREE.Group();
    exhaustGroup.position.set(-0.13, 0.22, 0);

    const manifoldGeo = new THREE.BoxGeometry(0.05, 0.04, 0.42);
    const manifoldMesh = new THREE.Mesh(manifoldGeo, this.matExhaust);
    exhaustGroup.add(manifoldMesh);

    // Upward riser pipe
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 16), this.matExhaust);
    riser.position.set(-0.02, 0.10, -0.12);
    exhaustGroup.add(riser);

    // Cylindrical silencer body
    const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.24, 20), this.matExhaust);
    silencer.position.set(-0.02, 0.28, -0.12);
    exhaustGroup.add(silencer);

    // Stack pipe exiting silencer
    const stackPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 16), this.matExhaust);
    stackPipe.position.set(-0.02, 0.44, -0.12);
    exhaustGroup.add(stackPipe);

    // Rain cap flapper at top
    const flapperGroup = new THREE.Group();
    flapperGroup.position.set(-0.02, 0.50, -0.12);
    const capPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 16), this.matExhaust);
    capPlate.position.set(0.012, 0, 0);
    flapperGroup.add(capPlate);

    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), this.matExhaust);
    counterweight.position.set(-0.02, 0, 0);
    flapperGroup.add(counterweight);

    exhaustGroup.add(flapperGroup);
    this.movingParts.flapperCap = flapperGroup;

    this.parts.exhaust = exhaustGroup;
    this.root.add(exhaustGroup);

    // 13. Intake Manifold & Oil-Bath Air Cleaner (Filtro aria a bagno d'olio)
    const intakeGroup = new THREE.Group();
    intakeGroup.position.set(0.12, 0.22, 0);

    const intakeManifold = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.42), this.matSteelExternal);
    intakeGroup.add(intakeManifold);

    // Cylindrical oil bath cleaner
    const airCleaner = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.18, 20), this.matCelesteEnamel);
    airCleaner.position.set(0.06, 0.08, -0.14);
    intakeGroup.add(airCleaner);

    // Glass sediment pre-cleaner bowl on top
    const glassBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.06, 16), this.matGlass);
    glassBowl.position.set(0.06, 0.20, -0.14);
    intakeGroup.add(glassBowl);

    this.parts.intake = intakeGroup;
    this.root.add(intakeGroup);

    // 14. Electric Starter Motor (Motorino di avviamento)
    const starterGroup = new THREE.Group();
    starterGroup.position.set(-0.15, -0.08, 0.22);

    const starterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 16), this.matCastIron);
    starterBody.rotation.x = Math.PI / 2;
    starterGroup.add(starterBody);

    // Solenoid on top of starter
    const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12), this.matSteelExternal);
    solenoid.rotation.x = Math.PI / 2;
    solenoid.position.set(0, 0.065, -0.02);
    starterGroup.add(solenoid);

    // Sliding pinion gear engaging flywheel ring gear
    const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.032, 12), this.matSteelExternal);
    pinion.rotation.x = Math.PI / 2;
    pinion.position.set(0, 0, 0.11);
    starterGroup.add(pinion);
    this.movingParts.starterPinion = pinion;

    this.parts.starter = starterGroup;
    this.root.add(starterGroup);

    // 15. Light Arancio Cutaway Section Caps at x = 0 plane
    this.buildCutawaySectionCaps();

    // Setup exploded view target offsets and labels
    this.setupExplodedMetadata();
  }

  // Section caps printed as light arancio hatch where metal is sliced at x = 0
  buildCutawaySectionCaps() {
    this.sectionCaps = new THREE.Group();

    // Crankcase sliced wall caps
    const capCase1 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.60), this.matSectionHatch);
    capCase1.rotation.y = -Math.PI / 2;
    capCase1.position.set(0.001, -0.04, 0);
    this.sectionCaps.add(capCase1);

    // Sliced cylinder barrel wall rings (3 cylinders)
    const cylZ = [-0.15, 0.0, 0.15];
    for (let i = 0; i < 3; i++) {
      const cz = cylZ[i];
      const capBarrel = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.03), this.matSectionHatch);
      capBarrel.rotation.y = -Math.PI / 2;
      capBarrel.position.set(0.001, 0.13, cz);
      this.sectionCaps.add(capBarrel);

      const capHead = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.13), this.matSectionHatch);
      capHead.rotation.y = -Math.PI / 2;
      capHead.position.set(0.001, 0.235, cz);
      this.sectionCaps.add(capHead);
    }

    this.sectionCaps.visible = false;
    this.root.add(this.sectionCaps);
  }

  // Define exploded positions and technical callouts
  setupExplodedMetadata() {
    this.explodedData = [
      {
        part: this.parts.rockerCovers,
        offset: new THREE.Vector3(0, 0.38, 0),
        enName: 'ROCKER COVERS',
        itName: 'Coperchi bilancieri',
        anchor: new THREE.Vector3(0, 0.68, 0)
      },
      {
        part: this.parts.heads,
        offset: new THREE.Vector3(0, 0.22, 0),
        enName: 'CYLINDER HEADS & STUDS',
        itName: 'Testate alettate e prigionieri',
        anchor: new THREE.Vector3(0, 0.46, 0)
      },
      {
        part: this.parts.barrels,
        offset: new THREE.Vector3(0, 0.11, 0),
        enName: 'FINNED CYLINDER BARRELS',
        itName: 'Cilindri singoli alettati',
        anchor: new THREE.Vector3(0, 0.24, 0)
      },
      {
        part: this.parts.pistons,
        offset: new THREE.Vector3(0, 0.05, 0),
        enName: 'PISTONS & CONNECTING RODS',
        itName: 'Pistoni con cavità e bielle',
        anchor: new THREE.Vector3(0, 0.10, -0.15)
      },
      {
        part: this.parts.blower,
        offset: new THREE.Vector3(0, 0, -0.28),
        enName: 'AXIAL COOLING BLOWER',
        itName: 'Ventilatore assiale e pulegge',
        anchor: new THREE.Vector3(0.02, 0.14, -0.62)
      },
      {
        part: this.parts.airCowl,
        offset: new THREE.Vector3(0.24, 0, 0),
        enName: 'AIR COWL (STENCILLED)',
        itName: 'Convogliatore aria lamiera',
        anchor: new THREE.Vector3(0.35, 0.16, 0)
      },
      {
        part: this.parts.injectionPump,
        offset: new THREE.Vector3(-0.24, 0, 0),
        enName: 'BOSCH INJECTION PUMP',
        itName: 'Pompa iniezione in linea',
        anchor: new THREE.Vector3(-0.40, 0.04, 0)
      },
      {
        part: this.parts.exhaust,
        offset: new THREE.Vector3(-0.18, 0.14, 0),
        enName: 'EXHAUST STACK & SILENCER',
        itName: 'Silenziatore e valvola pioggia',
        anchor: new THREE.Vector3(-0.31, 0.52, -0.12)
      },
      {
        part: this.parts.intake,
        offset: new THREE.Vector3(0.18, 0.10, 0),
        enName: 'OIL-BATH AIR CLEANER',
        itName: 'Filtro aria a bagno d\'olio',
        anchor: new THREE.Vector3(0.30, 0.32, -0.14)
      },
      {
        part: this.parts.starter,
        offset: new THREE.Vector3(-0.16, -0.06, 0.12),
        enName: 'STARTER MOTOR',
        itName: 'Motorino d\'avviamento',
        anchor: new THREE.Vector3(-0.31, -0.14, 0.34)
      },
      {
        part: this.parts.crankcase,
        offset: new THREE.Vector3(0, 0, 0),
        enName: 'CRANKCASE (CELESTE)',
        itName: 'Monoblocco in ghisa',
        anchor: new THREE.Vector3(0, -0.04, 0.18)
      },
      {
        part: this.parts.stand,
        offset: new THREE.Vector3(0, -0.08, 0),
        enName: 'TEST STAND (ARANCIO)',
        itName: 'Banco prova arancio',
        anchor: new THREE.Vector3(0, -0.40, 0)
      }
    ];
  }

  // Build Airflow Particle System
  buildAirflowParticles() {
    const particleCount = 280;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    this.airflowData = [];

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      this.airflowData.push({
        t: t,
        speed: 0.25 + Math.random() * 0.45,
        laneY: 0.08 + Math.random() * 0.14,
        cylIndex: Math.floor(Math.random() * 3)
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.014,
      vertexColors: true,
      transparent: true,
      opacity: 0.0
    });

    this.airflowPoints = new THREE.Points(geometry, mat);
    this.root.add(this.airflowPoints);
  }

  // Build Exhaust Smoke Puff Particle System
  buildSmokeParticles() {
    const smokeCount = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(smokeCount * 3);
    const colors = new Float32Array(smokeCount * 3);

    this.smokeData = [];
    const stackTip = new THREE.Vector3(-0.15, 0.72, -0.12);

    for (let i = 0; i < smokeCount; i++) {
      this.smokeData.push({
        active: false,
        age: 1.0,
        maxAge: 0.8 + Math.random() * 0.6,
        pos: stackTip.clone(),
        vel: new THREE.Vector3(0, 0, 0),
        darkness: 0.2
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.024,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.smokePoints = new THREE.Points(geometry, mat);
    this.root.add(this.smokePoints);
  }

  // Trigger dark exhaust smoke puff on misfire / cold catch / idle pop
  emitSmokePuff(isDark = false, intensity = 1.0) {
    const stackTip = new THREE.Vector3(-0.15, 0.72, -0.12);
    let spawned = 0;
    const toSpawn = isDark ? 12 : 3;

    for (let i = 0; i < this.smokeData.length; i++) {
      const p = this.smokeData[i];
      if (!p.active && spawned < toSpawn) {
        p.active = true;
        p.age = 0;
        p.maxAge = 0.6 + Math.random() * 0.5;
        p.pos.copy(stackTip).add(new THREE.Vector3((Math.random() - 0.5) * 0.015, 0, (Math.random() - 0.5) * 0.015));
        p.vel.set(
          (Math.random() - 0.5) * 0.08,
          0.35 + Math.random() * 0.35 * intensity,
          (Math.random() - 0.5) * 0.08
        );
        p.darkness = isDark ? 0.12 + Math.random() * 0.12 : 0.65;
        spawned++;
      }
    }
  }

  // Update Smoke Particles
  updateSmoke(dt) {
    const positions = this.smokePoints.geometry.attributes.position.array;
    const colors = this.smokePoints.geometry.attributes.color.array;

    for (let i = 0; i < this.smokeData.length; i++) {
      const p = this.smokeData[i];
      const idx = i * 3;

      if (p.active) {
        p.age += dt;
        if (p.age >= p.maxAge) {
          p.active = false;
          positions[idx + 1] = -10; // offscreen
          continue;
        }

        p.pos.addScaledVector(p.vel, dt);
        p.vel.x += (Math.random() - 0.5) * 0.02;
        p.vel.z += (Math.random() - 0.5) * 0.02;

        positions[idx] = p.pos.x;
        positions[idx + 1] = p.pos.y;
        positions[idx + 2] = p.pos.z;

        const fade = 1.0 - (p.age / p.maxAge);
        const colVal = p.darkness + (1.0 - fade) * 0.4;
        colors[idx] = colVal;
        colors[idx + 1] = colVal;
        colors[idx + 2] = colVal;
      } else {
        positions[idx + 1] = -10;
      }
    }

    this.smokePoints.geometry.attributes.position.needsUpdate = true;
    this.smokePoints.geometry.attributes.color.needsUpdate = true;
  }

  // Update Airflow Particles
  updateAirflow(dt, sim) {
    if (this.currentView !== 'airflow') {
      this.airflowPoints.material.opacity = 0;
      return;
    }

    this.airflowPoints.material.opacity = Math.min(1.0, (sim.rpm / 600));
    const positions = this.airflowPoints.geometry.attributes.position.array;
    const colors = this.airflowPoints.geometry.attributes.color.array;

    const cylZ = [-0.15, 0.0, 0.15];
    const speedMult = Math.max(0.1, sim.rpm / 2200);

    for (let i = 0; i < this.airflowData.length; i++) {
      const p = this.airflowData[i];
      p.t = (p.t + dt * p.speed * speedMult) % 1.0;

      let x, y, z;
      y = p.laneY;
      const targetZ = cylZ[p.cylIndex];

      if (p.t < 0.25) {
        // Entering blower and turning into cowl
        const seg = p.t / 0.25;
        x = 0.02 + seg * 0.09;
        z = -0.38 + seg * (targetZ + 0.38);
      } else if (p.t < 0.65) {
        // Crossing between finned barrels from cold side (+X) to hot side (-X)
        const seg = (p.t - 0.25) / 0.40;
        x = 0.11 - seg * 0.24;
        z = targetZ;
      } else {
        // Exiting warm on the hot/pump side (-X)
        const seg = (p.t - 0.65) / 0.35;
        x = -0.13 - seg * 0.15;
        z = targetZ + seg * 0.05;
      }

      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      // Color gradient: Cool celeste (entry) -> warm arancio (exit)
      const colorRatio = Math.min(1.0, Math.max(0.0, p.t * 1.2));
      const col = new THREE.Color().lerpColors(this.colorCelestePrint, this.colorArancio, colorRatio);
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }

    this.airflowPoints.geometry.attributes.position.needsUpdate = true;
    this.airflowPoints.geometry.attributes.color.needsUpdate = true;
  }

  // Set visual mode ('painted', 'cutaway', 'airflow', 'exploded')
  setViewMode(mode) {
    this.currentView = mode;

    const isCutaway = mode === 'cutaway';
    const isAirflow = mode === 'airflow';
    const isExploded = mode === 'exploded';

    this.targetExploded = isExploded ? 1.0 : 0.0;

    // Apply or remove clipping plane (slices at x = 0)
    const clipPlanes = isCutaway ? [this.cutawayPlane] : [];
    this.matCelesteEnamel.clippingPlanes = clipPlanes;
    this.matCowl.clippingPlanes = clipPlanes;
    this.matCastFins.clippingPlanes = clipPlanes;
    this.matSteelExternal.clippingPlanes = clipPlanes;

    // In cutaway mode:
    // "parts lying wholly in the removed half (pump, filters, exhaust, starter, pushrods, cam) disappear"
    // "pistons, rods and crank stay whole"
    // "a combustion glow fills each chamber as it fires"
    if (this.parts.injectionPump) this.parts.injectionPump.visible = !isCutaway;
    if (this.parts.exhaust) this.parts.exhaust.visible = !isCutaway;
    if (this.parts.starter) this.parts.starter.visible = !isCutaway;
    if (this.parts.valveTrain) this.parts.valveTrain.visible = !isCutaway;
    if (this.parts.dynamo) this.parts.dynamo.visible = !isCutaway;

    // Section hatch caps
    if (this.sectionCaps) this.sectionCaps.visible = isCutaway;

    // Airflow ghost mode
    if (isAirflow) {
      this.matCelesteEnamel.color.set(this.colorPaperGhost);
      this.matStand.color.set(this.colorPaperGhost);
      this.matCowl.color.set(this.colorPaperGhost);
    } else {
      this.matCelesteEnamel.color.set(this.colorCelesteEnamel);
      this.matStand.color.set(this.colorStand);
      this.matCowl.color.set(0xFFFFFF);
    }
  }

  // Main animation update: crank kinematics, pistons, valve train, blower, flapper, exploded easing
  update(dt, sim) {
    // 1. Exploded view animation easing
    if (Math.abs(this.explodedProgress - this.targetExploded) > 0.001) {
      this.explodedProgress += (this.targetExploded - this.explodedProgress) * Math.min(1.0, dt * 3.5);
      for (const item of this.explodedData) {
        if (item.part) {
          item.part.position.copy(item.offset).multiplyScalar(this.explodedProgress);
        }
      }
    }

    // In exploded view, crank is held still
    const isFrozen = this.explodedProgress > 0.85;
    const crankAngle = isFrozen ? 0 : sim.crankAngle;

    // 2. Crankshaft rotation (clockwise seen from blower end)
    if (this.movingParts.crankshaft) {
      this.movingParts.crankshaft.rotation.z = -crankAngle;
    }

    // 3. Slider-crank kinematics for the 3 pistons and connecting rods
    const r = 0.055; // crank radius (m)
    const l = 0.200; // con rod length (m)

    for (let i = 0; i < 3; i++) {
      const cyl = this.cylinders[i];
      const cylAngle = crankAngle - (cyl.phaseDeg * Math.PI) / 180;

      const sinT = Math.sin(cylAngle);
      const cosT = Math.cos(cylAngle);
      const s = r * (1 - cosT) + l - Math.sqrt(Math.max(0.0001, l * l - r * r * sinT * sinT));

      const pistonY = 0.22 - s;
      cyl.piston.position.set(0, pistonY, cyl.z);

      const pinX = r * Math.sin(cylAngle);
      const pinY = -r * Math.cos(cylAngle);

      const wristY = pistonY - 0.015;
      const midX = pinX / 2;
      const midY = (wristY + pinY) / 2;

      cyl.rod.position.set(midX, midY, cyl.z);
      const rodAngle = Math.atan2(pinX, wristY - pinY);
      cyl.rod.rotation.z = -rodAngle;

      // Combustion glow in cutaway mode
      const glow = this.movingParts.combustionGlows[i];
      if (glow) {
        if (this.currentView === 'cutaway') {
          const deg = (((cylAngle * 180 / Math.PI) % 720) + 720) % 720;
          if (deg >= 0 && deg < 35 && sim.hasCaught) {
            const glowIntensity = Math.sin((deg / 35) * Math.PI) * 4.2;
            glow.intensity = glowIntensity;
          } else {
            glow.intensity = 0;
          }
        } else {
          glow.intensity = 0;
        }
      }
    }

    // 4. Valve train driven by same valve-lift curves as simulation
    if (this.movingParts.camshaft && !isFrozen) {
      // Camshaft turns at half crankshaft speed
      this.movingParts.camshaft.rotation.z = -crankAngle / 2;
    }

    if (!isFrozen) {
      for (let i = 0; i < this.valveTrainParts.length; i++) {
        const vPart = this.valveTrainParts[i];
        const cylDeg = (((crankAngle * 180 / Math.PI) - vPart.phaseDeg) % 720 + 720) % 720;
        const lifts = sim.getValveLifts(cylDeg);

        // Intake valve kinematics
        const inLift = lifts.intake * 0.009; // 9 mm max valve lift
        if (vPart.intake.tappet) vPart.intake.tappet.position.y = 0.01 + inLift;
        if (vPart.intake.pushrod) vPart.intake.pushrod.position.y = 0.12 + inLift;
        if (vPart.intake.rocker) vPart.intake.rocker.rotation.z = inLift * 18.0;
        if (vPart.intake.valve) vPart.intake.valve.position.y = 0.235 - inLift;
        if (vPart.intake.spring) vPart.intake.spring.scale.y = Math.max(0.65, 1.0 - inLift * 25.0);

        // Exhaust valve kinematics
        const exLift = lifts.exhaust * 0.009;
        if (vPart.exhaust.tappet) vPart.exhaust.tappet.position.y = 0.01 + exLift;
        if (vPart.exhaust.pushrod) vPart.exhaust.pushrod.position.y = 0.12 + exLift;
        if (vPart.exhaust.rocker) vPart.exhaust.rocker.rotation.z = exLift * 18.0;
        if (vPart.exhaust.valve) vPart.exhaust.valve.position.y = 0.235 - exLift;
        if (vPart.exhaust.spring) vPart.exhaust.spring.scale.y = Math.max(0.65, 1.0 - exLift * 25.0);
      }
    }

    // 5. Blower rotor spinning (geared 1.4x crank)
    if (this.movingParts.blowerRotor && !isFrozen) {
      this.movingParts.blowerRotor.rotation.z -= sim.omega * dt * 1.4;
    }

    // 6. Governor throttle lever tracks hand throttle
    if (this.movingParts.governorLever) {
      this.movingParts.governorLever.rotation.z = 0.4 * sim.fuelRack;
    }

    // 7. Rain cap flapper lifts on each exhaust pulse at idle
    if (this.movingParts.flapperCap) {
      if (sim.rpm > 120 && sim.rpm < 1200) {
        const pulse = Math.sin(crankAngle * 1.5) * 0.25 + 0.15;
        this.movingParts.flapperCap.rotation.z = Math.max(0, pulse);
      } else if (sim.rpm >= 1200) {
        this.movingParts.flapperCap.rotation.z = 0.45;
      } else {
        this.movingParts.flapperCap.rotation.z = 0;
      }
    }

    // 8. Starter motor pinion slides forward into ring gear while cranking
    if (this.movingParts.starterPinion) {
      const targetPinionZ = sim.keyState === 'cranking' ? 0.14 : 0.11;
      this.movingParts.starterPinion.position.z += (targetPinionZ - this.movingParts.starterPinion.position.z) * 0.25;
    }

    // 9. Life at rest: engine rocks slightly on its mounts against gas torque
    if (sim.rpm > 50 && !isFrozen) {
      const rockAngle = Math.sin(crankAngle * 1.5) * 0.012 * (sim.rpm < 900 ? 1.5 : 0.5);
      this.root.rotation.z = rockAngle;
    } else {
      this.root.rotation.z = 0;
    }

    // 10. Airflow temperature ramp on barrels and heads
    if (this.currentView === 'airflow') {
      const tempRatio = Math.min(1.0, Math.max(0.0, (sim.headTempC - 20) / 155));
      const hotColor = new THREE.Color().lerpColors(this.colorCelesteEnamel, this.colorArancio, tempRatio);
      this.matCastFins.color.copy(hotColor);
    } else if (this.currentView !== 'airflow') {
      this.matCastFins.color.set(0x32302E);
    }

    // 11. Particles: Airflow and Exhaust Smoke
    this.updateAirflow(dt, sim);
    this.updateSmoke(dt);

    // Spawn smoke puff on misfire / caught / idle pulses
    if (sim.smokePuffIntensity > 0.5 && Math.random() < 0.35) {
      this.emitSmokePuff(true, sim.smokePuffIntensity);
    } else if (sim.rpm > 200 && sim.rpm < 1200 && Math.random() < 0.06) {
      this.emitSmokePuff(false, 0.4);
    }
  }
}
