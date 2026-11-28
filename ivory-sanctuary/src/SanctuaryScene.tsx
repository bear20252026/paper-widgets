import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type SanctuarySceneProps = {
  entered: boolean;
  onReady: (ready: boolean) => void;
};

type StoneMaterial = THREE.MeshStandardMaterial;

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function makeStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const random = seededRandom(42);
  context.fillStyle = '#f4f0e8';
  context.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3800; i += 1) {
    const shade = Math.floor(170 + random() * 70);
    context.fillStyle = `rgba(${shade}, ${shade - 5}, ${shade - 12}, ${random() * 0.08})`;
    const size = random() * 2 + 0.2;
    context.fillRect(random() * 512, random() * 512, size, size);
  }

  for (let i = 0; i < 20; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + 45, y + 15, x + 90, y - 20, x + 175, y + 25);
    context.strokeStyle = `rgba(153, 140, 124, ${0.025 + random() * 0.035})`;
    context.lineWidth = random() * 1.3 + 0.3;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  const image = new Image();
  image.onload = () => {
    context.globalAlpha = 0.5;
    context.drawImage(image, 0, 0, 512, 512);
    context.globalAlpha = 1;
    texture.needsUpdate = true;
  };
  image.src = './images/ivory-stone.jpg';
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 3, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 244, 210, 0.8)');
  gradient.addColorStop(0.25, 'rgba(255, 224, 166, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 221, 167, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(128, 128, 4, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  gradient.addColorStop(0.35, 'rgba(245, 246, 244, 0.18)');
  gradient.addColorStop(1, 'rgba(242, 246, 249, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function makeCloudWispTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  const image = new Image();
  image.onload = () => {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const brightness = pixels.data[i] / 255;
      pixels.data[i] = 255;
      pixels.data[i + 1] = 255;
      pixels.data[i + 2] = 255;
      pixels.data[i + 3] = Math.pow(brightness, 1.35) * 220;
    }
    context.putImageData(pixels, 0, 0);
    texture.needsUpdate = true;
  };
  image.src = './images/cloud-wisp.jpg';
  return texture;
}

function makeDoorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const base = context.createLinearGradient(0, 0, 256, 0);
  base.addColorStop(0, '#c69261');
  base.addColorStop(0.18, '#f1cea0');
  base.addColorStop(0.5, '#fff7db');
  base.addColorStop(0.82, '#f1cea0');
  base.addColorStop(1, '#c69261');
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 512);
  const light = context.createRadialGradient(128, 335, 8, 128, 335, 260);
  light.addColorStop(0, 'rgba(255, 255, 244, 0.95)');
  light.addColorStop(0.48, 'rgba(255, 244, 216, 0.38)');
  light.addColorStop(1, 'rgba(255, 221, 172, 0)');
  context.fillStyle = light;
  context.fillRect(0, 0, 256, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function archShape(radius: number, spring: number, bottom = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, bottom);
  shape.lineTo(-radius, spring);
  shape.absarc(0, spring, radius, Math.PI, 0, true);
  shape.lineTo(radius, bottom);
  shape.closePath();
  return shape;
}

function archRing(inner: number, outer: number, spring: number) {
  const shape = archShape(outer, spring);
  const hole = new THREE.Path();
  hole.moveTo(-inner, 0.015);
  hole.lineTo(-inner, spring);
  hole.absarc(0, spring, inner, Math.PI, 0, true);
  hole.lineTo(inner, 0.015);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function makeFlutedGeometry(radius: number, height: number) {
  const geometry = new THREE.CylinderGeometry(radius * 0.9, radius, height, 96, 1);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const distance = Math.sqrt(x * x + z * z);
    if (distance > radius * 0.5) {
      const angle = Math.atan2(z, x);
      const inset = 1 - 0.035 * (0.5 + 0.5 * Math.cos(angle * 20));
      positions.setX(i, x * inset);
      positions.setZ(i, z * inset);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createSanctuary(scene: THREE.Scene) {
  const random = seededRandom(1948);
  const stoneTexture = makeStoneTexture();
  const glowTexture = makeGlowTexture();
  const cloudTexture = makeCloudTexture();
  const cloudWispTexture = makeCloudWispTexture();
  const doorTexture = makeDoorTexture();

  const ivory = new THREE.MeshStandardMaterial({
    color: 0xe8e0d0,
    map: stoneTexture,
    bumpMap: stoneTexture,
    bumpScale: 0.025,
    roughness: 0.92,
  });
  const paleStone = new THREE.MeshStandardMaterial({
    color: 0xf3ebdc,
    map: stoneTexture,
    bumpMap: stoneTexture,
    bumpScale: 0.025,
    roughness: 0.88,
  });
  const shadedStone = new THREE.MeshStandardMaterial({
    color: 0xc7bba9,
    map: stoneTexture,
    roughness: 1,
  });
  const jointStone = new THREE.MeshStandardMaterial({
    color: 0xd0c7b8,
    roughness: 1,
  });
  const recess = new THREE.MeshStandardMaterial({
    color: 0x9d968b,
    roughness: 1,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc5a67b,
    metalness: 0.48,
    roughness: 0.48,
  });

  const architecture = new THREE.Group();
  scene.add(architecture);

  const box = (
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: StoneMaterial = ivory,
    parent: THREE.Object3D = architecture,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const cylinder = (
    top: number,
    bottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    material: StoneMaterial = ivory,
    segments = 32,
  ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    architecture.add(mesh);
    return mesh;
  };

  const addExtrudedShape = (
    shape: THREE.Shape,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 }),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    architecture.add(mesh);
    return mesh;
  };

  const column = (x: number, z: number, floor: number, height: number, radius: number) => {
    box(radius * 3.0, 0.18, radius * 3.0, x, floor + 0.09, z, paleStone);
    box(radius * 2.45, 0.18, radius * 2.45, x, floor + 0.27, z, ivory);
    cylinder(radius * 1.12, radius * 1.2, 0.2, x, floor + 0.46, z, paleStone);
    const shaftHeight = height - 1.03;
    const shaft = new THREE.Mesh(makeFlutedGeometry(radius, shaftHeight), paleStone);
    shaft.position.set(x, floor + 0.56 + shaftHeight / 2, z);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    architecture.add(shaft);
    cylinder(radius * 1.14, radius * 0.96, 0.2, x, floor + height - 0.36, z, paleStone);
    box(radius * 2.45, 0.2, radius * 2.45, x, floor + height - 0.16, z, ivory);
    box(radius * 2.9, 0.14, radius * 2.9, x, floor + height + 0.01, z, paleStone);
  };

  // A carved, layered foundation disappears into the cloud sea below.
  box(27.15, 1.9, 13.4, 0, 2.35, -2, shadedStone);
  box(27.45, 0.16, 13.65, 0, 1.43, -2, paleStone);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i += 1) {
      const x = side * (5.05 + i * 1.48);
      box(1.21, 0.94, 0.1, x, 2.35, 4.73, jointStone);
      box(1.07, 0.8, 0.12, x, 2.35, 4.8, ivory);
    }
  }

  // The approach is made from individually modeled stair treads.
  box(28.4, 0.65, 14.5, 0, 3.65, -2, shadedStone);
  box(29.0, 0.24, 14.9, 0, 4.09, -2, paleStone);
  box(28.1, 0.28, 14.2, 0, 4.35, -2, ivory);
  box(27.3, 0.18, 13.7, 0, 4.58, -2, paleStone);

  const stepCount = 43;
  const nearZ = 24.5;
  const stepDepth = 0.46;
  const stepRise = 0.132;
  for (let i = 0; i < stepCount; i += 1) {
    const y = -0.97 + i * stepRise;
    const z = nearZ - i * stepDepth;
    box(7.85, stepRise + 0.025, stepDepth + 0.035, 0, y, z, i % 7 === 0 ? paleStone : ivory);
    box(7.87, 0.025, 0.04, 0, y + stepRise / 2 + 0.015, z + stepDepth / 2, paleStone);
  }

  const stairLength = stepDepth * (stepCount - 1);
  const stairHeight = stepRise * (stepCount - 1);
  const angle = Math.atan2(stairHeight, stairLength);
  const railLength = Math.sqrt(stairLength ** 2 + stairHeight ** 2);
  const railCenterZ = nearZ - stairLength / 2;
  const railCenterY = -0.97 + stairHeight / 2;
  for (const side of [-1, 1]) {
    const baseRail = box(0.45, 0.45, railLength, side * 4.18, railCenterY + 0.12, railCenterZ, shadedStone);
    baseRail.rotation.x = angle;
    const upperRail = box(0.26, 0.17, railLength, side * 4.18, railCenterY + 1.05, railCenterZ, paleStone);
    upperRail.rotation.x = angle;
    for (let i = 0; i <= 12; i += 1) {
      const ratio = i / 12;
      const y = -0.97 + stairHeight * ratio;
      const z = nearZ - stairLength * ratio;
      cylinder(0.115, 0.16, 0.84, side * 4.18, y + 0.59, z, paleStone, 16);
      box(0.36, 0.1, 0.36, side * 4.18, y + 1.01, z, ivory);
    }
    for (const end of [0, 1]) {
      const y = -0.97 + stairHeight * end;
      const z = nearZ - stairLength * end;
      box(0.78, 1.45, 0.78, side * 4.18, y + 0.65, z, ivory);
      box(0.95, 0.16, 0.95, side * 4.18, y + 1.43, z, paleStone);
      cylinder(0.2, 0.3, 0.32, side * 4.18, y + 1.68, z, paleStone);
    }
  }

  const floor = 4.7;

  // The central facade is extruded around a genuine arched opening.
  const facade = new THREE.Shape();
  facade.moveTo(-5.15, 0);
  facade.lineTo(5.15, 0);
  facade.lineTo(5.15, 14.05);
  facade.lineTo(-5.15, 14.05);
  facade.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-2.08, 0.04);
  opening.lineTo(-2.08, 8.25);
  opening.absarc(0, 8.25, 2.08, Math.PI, 0, true);
  opening.lineTo(2.08, 0.04);
  opening.closePath();
  facade.holes.push(opening);
  addExtrudedShape(facade, 2.0, 0, floor, -2.8, ivory);

  const doorGeometry = new THREE.ShapeGeometry(archShape(2.07, 8.25), 48);
  const doorPositions = doorGeometry.getAttribute('position');
  const doorUV = doorGeometry.getAttribute('uv');
  for (let i = 0; i < doorPositions.count; i += 1) {
    doorUV.setXY(i, (doorPositions.getX(i) + 2.07) / 4.14, doorPositions.getY(i) / 10.32);
  }
  const door = new THREE.Mesh(
    doorGeometry,
    new THREE.MeshBasicMaterial({ map: doorTexture, color: 0xfff5df, toneMapped: false }),
  );
  door.position.set(0, floor + 0.03, -2.72);
  architecture.add(door);

  addExtrudedShape(archRing(2.09, 2.27, 8.25), 0.12, 0, floor, -0.77, shadedStone);
  addExtrudedShape(archRing(2.28, 2.45, 8.25), 0.15, 0, floor, -0.72, paleStone);
  addExtrudedShape(archRing(2.46, 2.52, 8.25), 0.17, 0, floor, -0.68, brass);
  addExtrudedShape(archRing(2.53, 2.72, 8.25), 0.14, 0, floor, -0.7, paleStone);

  // Individual voussoirs, masonry joints, and a carved frieze add scale to the portal.
  for (let i = 0; i < 15; i += 1) {
    const start = (i / 15) * Math.PI + 0.008;
    const end = ((i + 1) / 15) * Math.PI - 0.008;
    const inner = 2.75;
    const outer = i === 7 ? 3.12 : 3.0;
    const wedge = new THREE.Shape();
    wedge.moveTo(Math.cos(start) * inner, Math.sin(start) * inner);
    wedge.lineTo(Math.cos(start) * outer, Math.sin(start) * outer);
    wedge.absarc(0, 0, outer, start, end, false);
    wedge.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    wedge.absarc(0, 0, inner, end, start, true);
    wedge.closePath();
    addExtrudedShape(wedge, 0.12, 0, floor + 8.25, -0.67, paleStone);
  }
  for (let row = 1; row <= 15; row += 1) {
    const y = floor + row * 0.86;
    if (y < floor + 11.2) {
      box(2.12, 0.018, 0.018, -4.03, y, -0.785, jointStone);
      box(2.12, 0.018, 0.018, 4.03, y, -0.785, jointStone);
    } else {
      box(9.95, 0.018, 0.018, 0, y, -0.785, jointStone);
    }
  }
  for (const side of [-1, 1]) {
    box(0.12, 13.55, 0.13, side * 4.95, floor + 6.77, -0.73, paleStone);
  }
  box(5.18, 1.04, 0.12, 0, floor + 11.95, -0.72, shadedStone);
  box(4.98, 0.84, 0.15, 0, floor + 11.95, -0.64, ivory);
  box(3.8, 0.035, 0.05, 0, floor + 11.95, -0.54, paleStone);
  const frieze = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 10, 40), paleStone);
  frieze.position.set(0, floor + 11.95, -0.5);
  architecture.add(frieze);
  const friezeCenter = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), brass);
  friezeCenter.position.set(0, floor + 11.95, -0.49);
  architecture.add(friezeCenter);

  for (const side of [-1, 1]) {
    column(side * 3.75, -0.18, floor, 10.5, 0.43);
    box(1.25, 0.22, 1.0, side * 3.75, floor + 10.62, -0.17, paleStone);
    const medallion = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.055, 10, 48), paleStone);
    medallion.position.set(side * 3.7, floor + 12.35, -0.72);
    architecture.add(medallion);
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.25, 32), shadedStone);
    center.position.set(side * 3.7, floor + 12.35, -0.7);
    architecture.add(center);
  }

  // Entablature and a ribbed, lathed dome crown the central sanctuary.
  box(10.6, 0.26, 2.55, 0, 18.82, -1.75, paleStone);
  box(11.0, 0.28, 2.8, 0, 19.09, -1.75, ivory);
  box(11.4, 0.18, 3.05, 0, 19.32, -1.75, paleStone);
  for (let i = 0; i < 31; i += 1) {
    box(0.19, 0.13, 0.18, -5.05 + i * 0.337, 18.69, -0.43, paleStone);
  }
  box(9.35, 0.35, 4.1, 0, 19.58, -2.35, ivory);
  cylinder(3.65, 3.8, 0.24, 0, 19.9, -2.35, paleStone, 64);
  cylinder(3.38, 3.52, 1.35, 0, 20.65, -2.35, ivory, 64);
  cylinder(3.63, 3.48, 0.24, 0, 21.43, -2.35, paleStone, 64);
  cylinder(3.75, 3.64, 0.15, 0, 21.62, -2.35, ivory, 64);
  for (let i = 0; i < 24; i += 1) {
    const theta = (i / 24) * Math.PI * 2;
    const detail = box(0.1, 1.0, 0.12, Math.cos(theta) * 3.41, 20.65, Math.sin(theta) * 3.41 - 2.35, paleStone);
    detail.rotation.y = -theta;
  }

  const domeProfile = [
    [3.5, 0], [3.58, 0.25], [3.5, 0.7], [3.3, 1.25],
    [2.96, 1.85], [2.55, 2.4], [2.05, 2.9], [1.45, 3.34],
    [0.85, 3.67], [0.34, 3.88], [0.1, 4.04],
  ];
  const domeGeometry = new THREE.LatheGeometry(
    domeProfile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    96,
  );
  const dome = new THREE.Mesh(domeGeometry, paleStone);
  dome.position.set(0, 21.68, -2.35);
  dome.castShadow = true;
  dome.receiveShadow = true;
  architecture.add(dome);
  for (let i = 0; i < 16; i += 1) {
    const theta = (i / 16) * Math.PI * 2;
    const points = domeProfile.slice(1, -1).map(([radius, y]) =>
      new THREE.Vector3(Math.cos(theta) * (radius + 0.015), y + 21.68, Math.sin(theta) * (radius + 0.015) - 2.35),
    );
    const rib = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.028, 6, false),
      ivory,
    );
    architecture.add(rib);
  }
  cylinder(0.14, 0.28, 0.35, 0, 25.85, -2.35, brass, 24);
  cylinder(0.035, 0.11, 0.85, 0, 26.42, -2.35, brass, 24);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), brass);
  finial.position.set(0, 26.92, -2.35);
  architecture.add(finial);

  // Recessed arched bays and fluted colonnades extend the sanctuary to each side.
  for (const side of [-1, 1]) {
    const centerX = side * 9.32;
    box(8.25, 7.9, 1.15, centerX, floor + 3.95, -3.4, ivory);
    box(8.7, 0.27, 3.2, centerX, 12.77, -2.05, paleStone);
    box(8.85, 0.35, 3.5, centerX, 13.07, -2.05, ivory);
    box(9.15, 0.2, 3.75, centerX, 13.35, -2.05, paleStone);
    box(8.85, 0.13, 3.5, centerX, 13.55, -2.05, shadedStone);
    for (let i = 0; i < 20; i += 1) {
      box(0.15, 0.12, 0.16, side * (5.3 + i * 0.41), 12.62, -0.42, paleStone);
    }

    for (let i = 0; i < 4; i += 1) {
      const x = side * (6.2 + i * 2.02);
      const window = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.62, 3.25), 24), recess);
      window.position.set(x, floor + 0.58, -2.815);
      architecture.add(window);
      addExtrudedShape(archRing(0.65, 0.77, 3.25), 0.08, x, floor + 0.58, -2.78, paleStone);
      box(1.36, 0.12, 0.25, x, floor + 0.58, -2.72, paleStone);
      box(0.045, 3.15, 0.055, x, floor + 2.18, -2.71, brass);
      for (let j = 0; j < 3; j += 1) {
        box(1.1, 0.035, 0.05, x, floor + 1.35 + j * 0.8, -2.7, brass);
      }
    }

    for (let i = 0; i < 5; i += 1) {
      column(side * (5.3 + i * 2.03), -0.85, floor, 7.7, 0.28);
    }

    // A fine balustrade breaks up the long roof line.
    box(8.7, 0.13, 0.25, centerX, 14.47, -0.5, paleStone);
    for (let i = 0; i <= 12; i += 1) {
      const x = side * (5.3 + i * 0.67);
      cylinder(0.07, 0.1, 0.72, x, 14.07, -0.5, paleStone, 12);
    }

    // End pavilions make the silhouette monumental rather than a flat facade.
    const towerX = side * 13.65;
    box(2.25, 9.2, 3.3, towerX, floor + 4.6, -2.1, ivory);
    box(2.45, 0.22, 3.5, towerX, 14.02, -2.1, paleStone);
    box(2.7, 0.24, 3.8, towerX, 14.25, -2.1, ivory);
    cylinder(1.06, 1.18, 0.28, towerX, 14.53, -2.1, paleStone, 40);
    const littleDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      paleStone,
    );
    littleDome.position.set(towerX, 14.68, -2.1);
    littleDome.castShadow = true;
    architecture.add(littleDome);
    cylinder(0.06, 0.13, 0.42, towerX, 15.88, -2.1, brass, 16);
    const niche = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.54, 3.1), 24), recess);
    niche.position.set(towerX, floor + 1.2, -0.435);
    architecture.add(niche);
    addExtrudedShape(archRing(0.57, 0.7, 3.1), 0.08, towerX, floor + 1.2, -0.4, paleStone);
  }

  const portalGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffdfaa,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  portalGlow.position.set(0, floor + 5.0, -0.22);
  portalGlow.scale.set(7.0, 13.0, 1);
  architecture.add(portalGlow);

  const portalLight = new THREE.PointLight(0xffcb83, 24, 14, 2);
  portalLight.position.set(0, floor + 4.8, 1.0);
  scene.add(portalLight);

  // The architecture is static, so combining its meshes keeps interaction smooth.
  architecture.updateMatrixWorld(true);
  const stoneMaterials = new Set<THREE.Material>([ivory, paleStone, shadedStone, jointStone, recess, brass]);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  architecture.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material) && stoneMaterials.has(object.material)) {
      const batch = batches.get(object.material) ?? [];
      batch.push(object);
      batches.set(object.material, batch);
    }
  });
  batches.forEach((meshes, material) => {
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      return geometry;
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    });
    const combined = new THREE.Mesh(merged, material);
    combined.castShadow = true;
    combined.receiveShadow = true;
    architecture.add(combined);
  });

  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 30; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.25 + random() * 0.15,
      depthWrite: false,
      color: i % 3 === 0 ? 0xfff3e0 : 0xeaf1f7,
    });
    const cloud = new THREE.Sprite(material);
    const side = i % 2 === 0 ? -1 : 1;
    cloud.position.set(side * (6 + random() * 14), -3.5 + random() * 5.2, 2 + random() * 8);
    const size = 4 + random() * 7;
    cloud.scale.set(size * 1.8, size * 0.65, 1);
    scene.add(cloud);
    clouds.push(cloud);
  }

  for (let i = 0; i < 8; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudWispTexture,
      transparent: true,
      opacity: 0.36 + random() * 0.15,
      depthWrite: false,
      color: i % 2 === 0 ? 0xfff6e9 : 0xe8f1fa,
    });
    const cloud = new THREE.Sprite(material);
    const side = i % 2 === 0 ? -1 : 1;
    cloud.position.set(side * (9 + random() * 4), -2.5 + random() * 4, 8 + random() * 4);
    cloud.scale.set(12 + random() * 5, 4 + random() * 2, 1);
    scene.add(cloud);
    clouds.push(cloud);
  }

  return { clouds, portalGlow, textures: [stoneTexture, glowTexture, cloudTexture, cloudWispTexture, doorTexture] };
}

export default function SanctuaryScene({ entered, onReady }: SanctuarySceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(entered);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    enteredRef.current = entered;
  }, [entered]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onReadyRef.current(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.setAttribute('aria-label', 'An interactive 3D ivory sanctuary above the clouds. Drag or use the arrow keys to look around. Press Home to reset the view.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 200);
    const mobile = () => container.clientWidth < 700;
    camera.position.set(0, 6.5, mobile() ? 74 : 44);
    camera.lookAt(mobile() ? 0 : -4.5, 11, 0);

    const ambient = new THREE.HemisphereLight(0xe6f1ff, 0x9d9b96, 1.7);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffdfad, 3.2);
    sun.position.set(-28, 23, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 38;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7ddff, 0.9);
    fill.position.set(20, 15, 10);
    scene.add(fill);

    const { clouds, portalGlow, textures } = createSanctuary(scene);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const drag = { active: false, x: 0, y: 0, lastX: 0, lastY: 0 };
    const target = new THREE.Vector3();
    const lookTarget = new THREE.Vector3(mobile() ? 0 : -4.5, 11, 0);
    const desiredLook = new THREE.Vector3();
    let frame = 0;
    const started = performance.now();
    let previousFrame = started;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      drag.active = true;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.classList.add('is-dragging');
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag.active) return;
      drag.x = THREE.MathUtils.clamp(drag.x - (event.clientX - drag.lastX) * 0.035, -8, 8);
      drag.y = THREE.MathUtils.clamp(drag.y + (event.clientY - drag.lastY) * 0.025, -3, 5);
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    };
    const onPointerUp = () => {
      drag.active = false;
      renderer.domElement.classList.remove('is-dragging');
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const movement = 1.1;
      if (event.key === 'ArrowLeft') drag.x = THREE.MathUtils.clamp(drag.x - movement, -8, 8);
      else if (event.key === 'ArrowRight') drag.x = THREE.MathUtils.clamp(drag.x + movement, -8, 8);
      else if (event.key === 'ArrowUp') drag.y = THREE.MathUtils.clamp(drag.y + movement, -3, 5);
      else if (event.key === 'ArrowDown') drag.y = THREE.MathUtils.clamp(drag.y - movement, -3, 5);
      else if (event.key === 'Home') { drag.x = 0; drag.y = 0; }
      else return;
      event.preventDefault();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('keydown', onKeyDown);

    const onResize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    const animate = (time: number) => {
      const elapsed = (time - started) / 1000;
      const delta = Math.min((time - previousFrame) / 1000, 0.5);
      previousFrame = time;
      const isMobile = mobile();
      const isEntered = enteredRef.current;
      const baseZ = isMobile ? (isEntered ? 48 : 74) : (isEntered ? 25 : 44);
      const drift = reduceMotion ? 0 : Math.sin(elapsed * 0.18) * 0.2;
      target.set(drag.x + drift, 6.5 + drag.y, baseZ);
      const ease = 1 - Math.exp(-(reduceMotion ? 8 : 2.4) * delta);
      camera.position.lerp(target, ease);
      desiredLook.set(isMobile || isEntered ? 0 : -4.5, isMobile ? 12 : 11, -0.5);
      lookTarget.lerp(desiredLook, ease);
      camera.lookAt(lookTarget);
      if (!reduceMotion) {
        portalGlow.material.opacity = 0.42 + Math.sin(elapsed * 0.8) * 0.055;
        clouds.forEach((cloud, index) => {
          cloud.position.x += Math.sin(elapsed * 0.2 + index) * 0.0015;
        });
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    onReadyRef.current(true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('keydown', onKeyDown);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        } else if (object instanceof THREE.Sprite) {
          object.material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="scene-canvas" ref={containerRef} />;
}
