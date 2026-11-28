import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { releases, wrapIndex } from "../data/releases";
import { createDiscCanvas, type Artwork } from "../lib/artwork";

type Props = {
  artwork: Artwork;
  selected: number;
  opening: boolean;
  active: boolean;
  onSelect: (index: number) => void;
  onBrowse: (direction: number) => void;
  onOpen: () => void;
  onOpenComplete: () => void;
};

const ease = (value: number) =>
  1 - Math.pow(1 - THREE.MathUtils.clamp(value, 0, 1), 3);

function texture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return map;
}

function strobeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "#c2c3bb");
  gradient.addColorStop(0.26, "#b3b4ad");
  gradient.addColorStop(0.75, "#a6a8a0");
  gradient.addColorStop(1, "#d4d4cb");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4096, 128);
  for (let row = 0; row < 3; row++) {
    for (let x = -16; x < 4112; x += 19) {
      ctx.fillStyle = "#31332f";
      ctx.fillRect(x + (row % 2 ? 9 : 0), 19 + row * 36, 10, 8);
      ctx.fillStyle = "#ffffff75";
      ctx.fillRect(x + (row % 2 ? 9 : 0), 27 + row * 36, 10, 2);
    }
  }
  return canvas;
}

export default function ArchiveScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(22, 1, 0.008, 100);
    const cameraStart = new THREE.Vector3(0, 4.02, 14);
    const cameraTarget = new THREE.Vector3(0, 1.5, 1.35);
    camera.position.copy(cameraStart);
    camera.lookAt(cameraTarget);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff9ed, 0.5);
    key.position.set(-4, 9, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -13,
      right: 13,
      top: 8,
      bottom: -6,
      near: 0.5,
      far: 40,
    });
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0001;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe0e6f3, 0.2);
    fill.position.set(7, 4, -2);
    scene.add(fill);

    const maps: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    const coverMaps = props.artwork.covers.map((item) =>
      texture(item, renderer),
    );
    const spineMaps = props.artwork.spines.map((item) =>
      texture(item, renderer),
    );
    const backMaps = props.artwork.backs.map((item) => texture(item, renderer));
    maps.push(...coverMaps, ...spineMaps, ...backMaps);
    const edgeMaterial = new THREE.MeshLambertMaterial({ color: "#9b9e94" });
    materials.push(edgeMaterial);

    const frontMaterials: THREE.MeshBasicMaterial[] = [];
    const sleeveMaterials = releases.map((_, index) => {
      const front = new THREE.MeshBasicMaterial({ map: coverMaps[index] });
      const spine = new THREE.MeshBasicMaterial({
        map: spineMaps[index],
        color: "#eeeee6",
      });
      const back = new THREE.MeshBasicMaterial({
        map: backMaps[index],
        color: "#c3c5b9",
      });
      frontMaterials.push(front);
      materials.push(front, spine, back);
      return [spine, spine, edgeMaterial, edgeMaterial, front, back];
    });
    const sleeveGeometry = new THREE.BoxGeometry(3.28, 3.3, 0.355);
    geometries.push(sleeveGeometry);
    const sleeves: THREE.Mesh<THREE.BoxGeometry, THREE.Material[]>[] = [];
    for (let slot = 0; slot < releases.length * 2; slot++) {
      const sleeve = new THREE.Mesh(
        sleeveGeometry,
        sleeveMaterials[wrapIndex(slot)],
      );
      sleeve.castShadow = true;
      sleeve.receiveShadow = true;
      sleeve.userData.release = wrapIndex(slot);
      sleeve.userData.slot = slot;
      scene.add(sleeve);
      sleeves.push(sleeve);
    }

    const deck = new THREE.Group();
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: "#92968c",
      roughness: 0.68,
      metalness: 0.2,
      envMapIntensity: 0.2,
    });
    const deckGeometry = new THREE.RingGeometry(
      13.4,
      17,
      256,
      1,
      -Math.PI / 2 - 0.72,
      1.44,
    );
    const deckTop = new THREE.Mesh(deckGeometry, deckMaterial);
    deckTop.rotation.x = -Math.PI / 2;
    deckTop.position.set(0, -0.025, -13.8);
    deckTop.receiveShadow = true;
    deck.add(deckTop);
    const strobeMap = texture(strobeCanvas(), renderer);
    strobeMap.wrapS = THREE.RepeatWrapping;
    maps.push(strobeMap);
    const rimMaterial = new THREE.MeshBasicMaterial({
      map: strobeMap,
      color: "#dedfd6",
    });
    const rimGeometry = new THREE.CylinderGeometry(
      17,
      17,
      0.185,
      256,
      1,
      true,
      -0.72,
      1.44,
    );
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.position.set(0, -0.125, -13.8);
    deck.add(rim);
    materials.push(deckMaterial, rimMaterial);
    geometries.push(deckGeometry, rimGeometry);

    [-0.025, -0.223].forEach((height) => {
      const points = Array.from({ length: 180 }, (_, i) => {
        const angle = -0.72 + (i / 179) * 1.44;
        return new THREE.Vector3(
          Math.sin(angle) * 17,
          height,
          -13.8 + Math.cos(angle) * 17,
        );
      });
      const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        180,
        0.014,
        5,
        false,
      );
      const material = new THREE.MeshBasicMaterial({
        color: height > -0.1 ? "#c3c6bc" : "#858c7e",
      });
      geometries.push(geometry);
      materials.push(material);
      deck.add(new THREE.Mesh(geometry, material));
    });
    scene.add(deck);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const shadowCtx = shadowCanvas.getContext("2d")!;
    const shadowGradient = shadowCtx.createRadialGradient(
      128,
      128,
      20,
      128,
      128,
      128,
    );
    shadowGradient.addColorStop(0, "#3a3c3633");
    shadowGradient.addColorStop(0.6, "#3a3c3613");
    shadowGradient.addColorStop(1, "#3a3c3600");
    shadowCtx.fillStyle = shadowGradient;
    shadowCtx.fillRect(0, 0, 256, 256);
    const shadowMap = texture(shadowCanvas, renderer);
    maps.push(shadowMap);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
    });
    const shadowGeometry = new THREE.PlaneGeometry(25, 5.5);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.26, 1);
    scene.add(shadow);
    materials.push(shadowMaterial);
    geometries.push(shadowGeometry);

    const disc = new THREE.Group();
    const discMap = texture(
      createDiscCanvas(releases[wrapIndex(props.selected)]),
      renderer,
    );
    maps.push(discMap);
    const discMaterial = new THREE.MeshStandardMaterial({
      map: discMap,
      metalness: 0.75,
      roughness: 0.24,
      side: THREE.DoubleSide,
      envMapIntensity: 0.85,
    });
    const discGeometry = new THREE.RingGeometry(0.105, 1.49, 160);
    const discFace = new THREE.Mesh(discGeometry, discMaterial);
    disc.add(discFace);
    const discEdgeGeometry = new THREE.TorusGeometry(1.49, 0.009, 6, 160);
    const discEdgeMaterial = new THREE.MeshStandardMaterial({
      color: "#b8bec0",
      metalness: 0.85,
      roughness: 0.2,
    });
    disc.add(new THREE.Mesh(discEdgeGeometry, discEdgeMaterial));
    disc.position.set(0, 1.66, 2.65);
    disc.visible = false;
    scene.add(disc);
    materials.push(discMaterial, discEdgeMaterial);
    geometries.push(discGeometry, discEdgeGeometry);

    let current = props.selected;
    let hovered: number | null = null;
    let openingStart: number | null = null;
    let openingSlot = 0;
    let completed = false;
    let discRelease = wrapIndex(props.selected);
    let animation = 0;
    let previousTime = performance.now();
    const startTime = previousTime;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let pointerDown: {
      x: number;
      y: number;
      lastX: number;
      dragged: boolean;
    } | null = null;
    let lastWheel = 0;
    let pointerX = 0;
    let pointerY = 0;

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = width < 600 ? 29 : 22;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const hitAt = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(
        sleeves.filter((sleeve) => sleeve.visible),
        false,
      )[0];
    };
    const onPointerDown = (event: PointerEvent) => {
      if (propsRef.current.opening) return;
      pointerDown = {
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        dragged: false,
      };
      host.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (propsRef.current.opening) return;
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (pointerDown) {
        const delta = event.clientX - pointerDown.lastX;
        if (Math.abs(event.clientX - pointerDown.x) > 8)
          pointerDown.dragged = true;
        if (Math.abs(delta) > (rect.width < 600 ? 45 : 62)) {
          propsRef.current.onBrowse(delta < 0 ? 1 : -1);
          pointerDown.lastX = event.clientX;
        }
        host.style.cursor = "grabbing";
      } else {
        const hit = hitAt(event);
        hovered = hit ? (hit.object.userData.slot as number) : null;
        host.style.cursor = hit ? "pointer" : "grab";
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerDown && !pointerDown.dragged && !propsRef.current.opening) {
        const hit = hitAt(event);
        if (hit) {
          const release = hit.object.userData.release as number;
          if (release === wrapIndex(propsRef.current.selected))
            propsRef.current.onOpen();
          else propsRef.current.onSelect(release);
        }
      }
      pointerDown = null;
      host.style.cursor = "grab";
    };
    const onPointerLeave = () => {
      hovered = null;
      pointerX = 0;
      pointerY = 0;
    };
    const onWheel = (event: WheelEvent) => {
      if (!propsRef.current.active || propsRef.current.opening) return;
      event.preventDefault();
      if (
        performance.now() - lastWheel > 380 &&
        Math.abs(event.deltaX) + Math.abs(event.deltaY) > 8
      ) {
        propsRef.current.onBrowse(event.deltaX + event.deltaY > 0 ? 1 : -1);
        lastWheel = performance.now();
      }
    };
    const onCancel = () => {
      pointerDown = null;
    };
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onCancel);
    host.addEventListener("pointerleave", onPointerLeave);
    host.addEventListener("wheel", onWheel, { passive: false });

    const animate = (time: number) => {
      animation = requestAnimationFrame(animate);
      const delta = THREE.MathUtils.clamp((time - previousTime) / 1000, 0, 0.5);
      previousTime = time;
      const { selected, opening, active } = propsRef.current;
      if (!active || !host.clientHeight) return;
      current = reducedMotion
        ? selected
        : THREE.MathUtils.damp(current, selected, 6.5, delta);
      const settled = Math.abs(current - selected) < 0.025 ? "true" : "false";
      if (host.dataset.settled !== settled) host.dataset.settled = settled;
      const elapsed = (time - startTime) / 1000;
      strobeMap.offset.x =
        -current * 0.028 + (reducedMotion ? 0 : elapsed * 0.002);

      if (opening && openingStart === null) {
        current = selected;
        openingStart = time;
        openingSlot = ((Math.round(selected) % 32) + 32) % 32;
        discRelease = wrapIndex(selected);
        discMap.image = createDiscCanvas(releases[discRelease]);
        discMap.needsUpdate = true;
      }
      if (!opening && openingStart !== null) {
        openingStart = null;
        completed = false;
        disc.visible = false;
      }
      const openTime = openingStart === null ? 0 : (time - openingStart) / 1000;

      sleeves.forEach((sleeve, slot) => {
        const distance = ((((slot - current + 16) % 32) + 32) % 32) - 16;
        const absolute = Math.abs(distance);
        sleeve.visible = absolute < 10.8;
        if (!sleeve.visible) return;
        const sign = Math.sign(distance);
        const turn = Math.min(1, absolute);
        frontMaterials[wrapIndex(slot)].color.setScalar(1 - ease(turn) * 0.28);
        const x =
          sign *
          (absolute <= 1 ? absolute * 2.13 : 2.13 + (absolute - 1) * 0.54);
        const z = THREE.MathUtils.lerp(2.76, 0.96 - (x * x) / 34, ease(turn));
        const entrance = reducedMotion
          ? 1
          : ease(elapsed * 1.3 - Math.min(absolute, 8) * 0.045);
        sleeve.position.set(
          x,
          1.65 - (1 - entrance) * 0.4,
          z - (1 - entrance) * 0.7,
        );
        sleeve.rotation.set(0, -sign * ease(turn) * 1.405, 0);
        if (hovered === slot && !opening) sleeve.position.y += 0.035;
        if (opening && slot === openingSlot) {
          sleeve.position.x -= ease(openTime / 1.0) * 0.82;
          sleeve.rotation.y -= ease(openTime / 1.0) * 0.14;
          if (openTime > 1)
            sleeve.position.x -= ease((openTime - 1) / 0.9) * 3.6;
        }
      });

      if (opening) {
        disc.visible = true;
        const roll = ease(openTime / 0.95);
        const centre = ease((openTime - 0.95) / 0.7);
        disc.position.set(
          2.55 * roll * (1 - centre),
          1.66,
          2.68 + centre * 1.05,
        );
        disc.rotation.z = -roll * 2.9 - centre * 0.5;
        disc.rotation.y = (1 - centre) * -0.08;
        const dive = THREE.MathUtils.clamp((openTime - 1.45) / 1.6, 0, 1);
        const approach = Math.pow(1 - dive, 3.7);
        camera.position.set(
          disc.position.x * centre,
          1.66 + (cameraStart.y - 1.66) * (1 - centre),
          disc.position.z + 10.3 * approach + 0.012,
        );
        camera.lookAt(disc.position.x, 1.66, disc.position.z);
        if (openTime > 3.07 && !completed) {
          completed = true;
          propsRef.current.onOpenComplete();
        }
      } else {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          reducedMotion ? 0 : pointerX * 0.12,
          2.5,
          delta,
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          cameraStart.y - (reducedMotion ? 0 : pointerY * 0.04),
          2.5,
          delta,
        );
        camera.position.z = cameraStart.z;
        camera.lookAt(cameraTarget);
      }
      renderer.render(scene, camera);
    };
    animation = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animation);
      observer.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onCancel);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("wheel", onWheel);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      maps.forEach((map) => map.dispose());
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.artwork]);

  useEffect(() => {
    if (hostRef.current) hostRef.current.dataset.settled = "false";
  }, [props.selected]);

  useEffect(() => {
    if (!failed || !props.opening) return;
    const timeout = window.setTimeout(props.onOpenComplete, 1300);
    return () => window.clearTimeout(timeout);
  }, [failed, props.opening, props.onOpenComplete]);

  return (
    <div
      className={`scene-host ${failed ? "scene-fallback" : ""}`}
      ref={hostRef}
      role="img"
      aria-label="Interactive 3D shelf of Sable releases. Drag to browse, or click the selected sleeve to open it."
    >
      {failed && (
        <div
          className={`fallback-shelf ${props.opening ? "fallback-opening" : ""}`}
        >
          {Array.from({ length: 11 }, (_, slot) => {
            const distance = slot - 5;
            const index = wrapIndex(props.selected + distance);
            return (
              <button
                key={slot}
                className={
                  distance === 0 ? "fallback-selected" : "fallback-spine"
                }
                style={{
                  background: releases[index].color,
                  color: releases[index].ink,
                }}
                onClick={() =>
                  distance === 0 ? props.onOpen() : props.onSelect(index)
                }
                aria-label={`Open ${releases[index].title}`}
              >
                {distance === 0 ? (
                  <img
                    src={props.artwork.images[index]}
                    alt={`${releases[index].title} cover`}
                  />
                ) : (
                  <span>{releases[index].title}</span>
                )}
              </button>
            );
          })}
          <div className="fallback-platter" />
        </div>
      )}
    </div>
  );
}
