import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AtmospherePreset } from './types';
import { ATMOSPHERE_PRESETS } from './constants';

export interface ProceduralTextureSet {
  ballastMap: THREE.CanvasTexture;
  ballastBump: THREE.CanvasTexture;
  ballastRoughness: THREE.CanvasTexture;
  trainMetalMaps: THREE.CanvasTexture[];
  trainMetalBump: THREE.CanvasTexture;
  trainMetalRoughness: THREE.CanvasTexture;
  concreteMap: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  concreteRoughness: THREE.CanvasTexture;
  hazardMap: THREE.CanvasTexture;
  buildingMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  smokeSpriteMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeSeededNoise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates high-resolution procedural PBR maps (albedo, bump, roughness)
 * with zero external files and rich micro-detail.
 */
export function createProceduralTextureSet(
  renderer: THREE.WebGLRenderer,
): ProceduralTextureSet {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
  const rand = makeSeededNoise(90210);

  // ------------------------------------------------------------------
  // 1. Wet Crushed Basalt Ballast + Deep Mirror Rain Puddles (1024x1024)
  // ------------------------------------------------------------------
  const ballastSize = 1024;
  const [bColC, bCol] = createCanvas(ballastSize);
  const [bBmpC, bBmp] = createCanvas(ballastSize);
  const [bRghC, bRgh] = createCanvas(ballastSize);

  bCol.fillStyle = '#191c22';
  bCol.fillRect(0, 0, ballastSize, ballastSize);
  bBmp.fillStyle = '#555555';
  bBmp.fillRect(0, 0, ballastSize, ballastSize);
  bRgh.fillStyle = '#e0e0e0'; // Dry crushed basalt (~0.88)
  bRgh.fillRect(0, 0, ballastSize, ballastSize);

  // Fine dense crushed basalt/granite micro-gravel (24,000 fine stones)
  for (let i = 0; i < 24000; i++) {
    const x = rand() * ballastSize;
    const y = rand() * ballastSize;
    const r = 1.1 + rand() * 3.1;
    const v = Math.floor(24 + rand() * 38);
    const warmShift = Math.floor((rand() - 0.5) * 9);
    bCol.fillStyle = `rgb(${v + warmShift}, ${v + 1}, ${v + 5})`;
    bCol.fillRect(x, y, r * 1.3, r);

    const bv = Math.floor(85 + rand() * 145);
    bBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
    bBmp.fillRect(x, y, r, r);
  }

  // Dark oil & grease tracks down the 3 rail beds
  for (let lane = 0; lane < 3; lane++) {
    const cx = ballastSize * ((lane + 0.5) / 3);
    const grad = bCol.createLinearGradient(cx - 115, 0, cx + 115, 0);
    grad.addColorStop(0, 'rgba(6,8,12,0)');
    grad.addColorStop(0.5, 'rgba(5,7,11,0.68)');
    grad.addColorStop(1, 'rgba(6,8,12,0)');
    bCol.fillStyle = grad;
    bCol.fillRect(cx - 115, 0, 230, ballastSize);
  }

  // Deep dark mirror rainwater puddles (dark wet albedo + very low roughness for crisp specular reflections!)
  for (let p = 0; p < 14; p++) {
    const px = rand() * ballastSize;
    const py = rand() * ballastSize;
    const rx = 38 + rand() * 72;
    const ry = 85 + rand() * 150;

    // Low roughness mirror core (0.04) blending to damp rim
    const rGrad = bRgh.createRadialGradient(px, py, rx * 0.15, px, py, Math.max(rx, ry));
    rGrad.addColorStop(0, 'rgb(10,10,10)');
    rGrad.addColorStop(0.55, 'rgb(26,26,26)');
    rGrad.addColorStop(1, 'rgba(224,224,224,0)');
    bRgh.fillStyle = rGrad;
    bRgh.beginPath();
    bRgh.ellipse(px, py, rx, ry, (rand() - 0.5) * 0.25, 0, Math.PI * 2);
    bRgh.fill();

    // Smooth water surface inside puddle (zero gravel bump)
    const bmpFlat = bBmp.createRadialGradient(px, py, rx * 0.12, px, py, Math.max(rx, ry));
    bmpFlat.addColorStop(0, 'rgba(128,128,128,0.96)');
    bmpFlat.addColorStop(0.7, 'rgba(128,128,128,0.6)');
    bmpFlat.addColorStop(1, 'rgba(128,128,128,0)');
    bBmp.fillStyle = bmpFlat;
    bBmp.beginPath();
    bBmp.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    bBmp.fill();

    // Deep dark wet water tint so puddles reflect bright lights & sky dramatically instead of looking milky
    const colWet = bCol.createRadialGradient(px, py, rx * 0.1, px, py, Math.max(rx, ry));
    colWet.addColorStop(0, 'rgba(4,7,14,0.88)');
    colWet.addColorStop(0.65, 'rgba(7,11,19,0.62)');
    colWet.addColorStop(1, 'rgba(7,11,19,0)');
    bCol.fillStyle = colWet;
    bCol.beginPath();
    bCol.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    bCol.fill();
  }

  const ballastMap = finalizeTexture(bColC, maxAniso, true, 1, 4);
  const ballastBump = finalizeTexture(bBmpC, maxAniso, false, 1, 4);
  const ballastRoughness = finalizeTexture(bRghC, maxAniso, false, 1, 4);

  // ------------------------------------------------------------------
  // 2. Corrugated Brushed Stainless Steel Metro Liveries (512x512)
  // ------------------------------------------------------------------
  const tSize = 512;
  const [tBmpC, tBmp] = createCanvas(tSize);
  const [tRghC, tRgh] = createCanvas(tSize);

  tBmp.fillStyle = '#808080';
  tBmp.fillRect(0, 0, tSize, tSize);
  tRgh.fillStyle = '#424242';
  tRgh.fillRect(0, 0, tSize, tSize);

  for (let y = 260; y < 480; y += 14) {
    const grad = tBmp.createLinearGradient(0, y, 0, y + 14);
    grad.addColorStop(0, '#383838');
    grad.addColorStop(0.5, '#eaeaea');
    grad.addColorStop(1, '#303030');
    tBmp.fillStyle = grad;
    tBmp.fillRect(0, y, tSize, 12);
  }

  for (let x = 0; x < tSize; x += 128) {
    tBmp.fillStyle = '#1c1c1c';
    tBmp.fillRect(x, 0, 3, tSize);
    tRgh.fillStyle = '#b4b4b4';
    tRgh.fillRect(x, 0, 4, tSize);
    for (let y = 16; y < tSize; y += 28) {
      tBmp.fillStyle = '#dcdcdc';
      tBmp.fillRect(x + 8, y, 3, 3);
    }
  }

  for (let i = 0; i < 650; i++) {
    const y = rand() * tSize;
    const alpha = 0.05 + rand() * 0.14;
    tRgh.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(18,18,18,${alpha})`;
    tRgh.fillRect(0, y, tSize, 1.5);
  }
  const grimeRgh = tRgh.createLinearGradient(0, 400, 0, tSize);
  grimeRgh.addColorStop(0, 'rgba(180,180,180,0)');
  grimeRgh.addColorStop(1, 'rgba(225,225,225,0.88)');
  tRgh.fillStyle = grimeRgh;
  tRgh.fillRect(0, 400, tSize, 112);

  const trainMetalBump = finalizeTexture(tBmpC, maxAniso, false, 2, 1);
  const trainMetalRoughness = finalizeTexture(tRghC, maxAniso, false, 2, 1);

  const liveries = [
    { base: '#cfd7e3', stripe: '#1d4ed8', accent: '#f59e0b', skirt: '#263040' },
    { base: '#d8dee6', stripe: '#b91c1c', accent: '#fbbf24', skirt: '#232328' },
    { base: '#aeb8c6', stripe: '#0f766e', accent: '#f97316', skirt: '#1a2433' },
  ];

  const trainMetalMaps = liveries.map((liv) => {
    const [c, ctx] = createCanvas(tSize);
    const bg = ctx.createLinearGradient(0, 0, 0, tSize);
    bg.addColorStop(0, '#e5ebf2');
    bg.addColorStop(0.55, liv.base);
    bg.addColorStop(1, liv.skirt);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, tSize, tSize);

    ctx.fillStyle = liv.stripe;
    ctx.fillRect(0, 212, tSize, 58);
    ctx.fillStyle = liv.accent;
    ctx.fillRect(0, 274, tSize, 10);

    for (let y = 290; y < 476; y += 14) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, y, tSize, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, y + 7, tSize, 5);
    }

    for (let x = 0; x < tSize; x += 128) {
      ctx.fillStyle = 'rgba(15,23,42,0.48)';
      ctx.fillRect(x, 0, 3, tSize);
    }
    const grime = ctx.createLinearGradient(0, 410, 0, tSize);
    grime.addColorStop(0, 'rgba(20,18,16,0)');
    grime.addColorStop(1, 'rgba(14,12,11,0.72)');
    ctx.fillStyle = grime;
    ctx.fillRect(0, 410, tSize, 102);

    return finalizeTexture(c, maxAniso, true, 2, 1);
  });

  // ------------------------------------------------------------------
  // 3. Architectural Weathered Station Concrete & Subway Wall Panels (512x512)
  // ------------------------------------------------------------------
  const [cColC, cCol] = createCanvas(512);
  const [cBmpC, cBmp] = createCanvas(512);
  const [cRghC, cRgh] = createCanvas(512);

  cCol.fillStyle = '#3b414c';
  cCol.fillRect(0, 0, 512, 512);
  cBmp.fillStyle = '#808080';
  cBmp.fillRect(0, 0, 512, 512);
  cRgh.fillStyle = '#c4c4c4';
  cRgh.fillRect(0, 0, 512, 512);

  // Subtle weathered concrete speckles
  for (let i = 0; i < 6000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const s = 1 + rand() * 3.2;
    const d = Math.floor(46 + rand() * 38);
    cCol.fillStyle = `rgb(${d},${d + 3},${d + 7})`;
    cCol.fillRect(x, y, s, s);
    const bv = Math.floor(95 + rand() * 70);
    cBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
    cBmp.fillRect(x, y, s, s);
  }

  // Architectural precast concrete panels + vertical water drainage streaks
  cCol.strokeStyle = 'rgba(14,18,24,0.68)';
  cCol.lineWidth = 3;
  cBmp.strokeStyle = '#1e1e1e';
  cBmp.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    cCol.beginPath();
    cCol.moveTo(i, 0);
    cCol.lineTo(i, 512);
    cCol.stroke();
    cCol.beginPath();
    cCol.moveTo(0, i);
    cCol.lineTo(512, i);
    cCol.stroke();

    cBmp.beginPath();
    cBmp.moveTo(i, 0);
    cBmp.lineTo(i, 512);
    cBmp.stroke();
    cBmp.beginPath();
    cBmp.moveTo(0, i);
    cBmp.lineTo(512, i);
    cBmp.stroke();

    // Formwork tie-rod holes in precast concrete slabs
    for (let j = 32; j < 512; j += 128) {
      cCol.fillStyle = 'rgba(12,15,20,0.65)';
      cCol.beginPath();
      cCol.arc(i + 24, j, 3, 0, Math.PI * 2);
      cCol.arc(i + 104, j, 3, 0, Math.PI * 2);
      cCol.fill();
    }
  }

  // Subtle vertical rain stains & damp reflective streaks
  for (let p = 0; p < 14; p++) {
    const x = rand() * 512;
    const w = 8 + rand() * 24;
    const h = 140 + rand() * 260;
    const g = cCol.createLinearGradient(x, 0, x, h);
    g.addColorStop(0, 'rgba(10,13,18,0.42)');
    g.addColorStop(1, 'rgba(10,13,18,0)');
    cCol.fillStyle = g;
    cCol.fillRect(x, 0, w, h);

    cRgh.fillStyle = 'rgba(35,35,35,0.45)';
    cRgh.fillRect(x, 0, w, h);
  }

  // Subtle transit line graphic accent stripe across mid concrete
  cCol.fillStyle = 'rgba(245, 158, 11, 0.22)';
  cCol.fillRect(0, 248, 512, 10);

  const concreteMap = finalizeTexture(cColC, maxAniso, true, 2, 2);
  const concreteBump = finalizeTexture(cBmpC, maxAniso, false, 2, 2);
  const concreteRoughness = finalizeTexture(cRghC, maxAniso, false, 2, 2);

  // ------------------------------------------------------------------
  // 4. Industrial Hazard Chevron Stripe Map (512x256)
  // ------------------------------------------------------------------
  const [hC, hCtx] = createCanvas(512);
  hCtx.fillStyle = '#eab308';
  hCtx.fillRect(0, 0, 512, 512);
  hCtx.fillStyle = '#18181b';
  for (let i = -512; i < 1024; i += 96) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 48, 0);
    hCtx.lineTo(i - 208, 512);
    hCtx.lineTo(i - 256, 512);
    hCtx.closePath();
    hCtx.fill();
  }
  // Scuffed urban grime specks
  for (let i = 0; i < 650; i++) {
    hCtx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.22)';
    hCtx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 6, 2 + rand() * 3);
  }
  const hazardMap = finalizeTexture(hC, maxAniso, true, 2, 1);

  // ------------------------------------------------------------------
  // 5. Distant Urban Skyscraper Facade Texture (512x512)
  // ------------------------------------------------------------------
  const [bldC, bld] = createCanvas(512);
  bld.fillStyle = '#161b26';
  bld.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 28; row++) {
    for (let col = 0; col < 16; col++) {
      const lit = rand();
      if (lit < 0.36) {
        const warm = rand() < 0.65;
        bld.fillStyle = warm
          ? `rgba(255, ${185 + Math.floor(rand() * 50)}, 115, ${0.45 + rand() * 0.55})`
          : `rgba(145, 210, 255, ${0.35 + rand() * 0.5})`;
      } else {
        bld.fillStyle = 'rgba(28, 36, 52, 0.7)';
      }
      bld.fillRect(col * 32 + 5, row * 18 + 4, 20, 11);
    }
  }
  const buildingMap = finalizeTexture(bldC, maxAniso, true, 1, 2);

  // ------------------------------------------------------------------
  // 6. Soft Radial Contact Shadow + Volumetric Smoke Sprite
  // ------------------------------------------------------------------
  const [shC, shCtx] = createCanvas(256);
  const shGrad = shCtx.createRadialGradient(128, 128, 12, 128, 128, 124);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.88)');
  shGrad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 256, 256);
  const contactShadowMap = new THREE.CanvasTexture(shC);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;

  const [smC, smCtx] = createCanvas(256);
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const ox = 128 + Math.cos(angle) * (i === 0 ? 0 : 28);
    const oy = 128 + Math.sin(angle) * (i === 0 ? 0 : 28);
    const rad = i === 0 ? 96 : 68;
    const sg = smCtx.createRadialGradient(ox, oy, 6, ox, oy, rad);
    sg.addColorStop(0, 'rgba(255,255,255,0.42)');
    sg.addColorStop(0.5, 'rgba(235,240,250,0.18)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    smCtx.fillStyle = sg;
    smCtx.beginPath();
    smCtx.arc(ox, oy, rad, 0, Math.PI * 2);
    smCtx.fill();
  }
  const smokeSpriteMap = new THREE.CanvasTexture(smC);
  smokeSpriteMap.colorSpace = THREE.SRGBColorSpace;

  return {
    ballastMap,
    ballastBump,
    ballastRoughness,
    trainMetalMaps,
    trainMetalBump,
    trainMetalRoughness,
    concreteMap,
    concreteBump,
    concreteRoughness,
    hazardMap,
    buildingMap,
    contactShadowMap,
    smokeSpriteMap,
    dispose() {
      ballastMap.dispose();
      ballastBump.dispose();
      ballastRoughness.dispose();
      trainMetalMaps.forEach((t) => t.dispose());
      trainMetalBump.dispose();
      trainMetalRoughness.dispose();
      concreteMap.dispose();
      concreteBump.dispose();
      concreteRoughness.dispose();
      hazardMap.dispose();
      buildingMap.dispose();
      contactShadowMap.dispose();
      smokeSpriteMap.dispose();
    },
  };
}

/**
 * Generates an atmosphere-calibrated studio + urban reflection environment map
 * via RoomEnvironment + PMREMGenerator so metallic trains, rails, and wet puddles
 * reflect crisp warm/cool sky bands and overhead station light strips.
 */
export function buildAtmosphereEnvMap(
  renderer: THREE.WebGLRenderer,
  preset: AtmospherePreset,
): THREE.Texture {
  const pal = ATMOSPHERE_PRESETS[preset];
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();

  // Add warm/cool horizon and overhead station light strips to RoomEnvironment
  const stripGeo = new THREE.PlaneGeometry(16, 2.2);
  const sunStripMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(pal.sunColor).multiplyScalar(2.4),
    side: THREE.DoubleSide,
  });
  const skyStripMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(pal.rimColor).multiplyScalar(1.9),
    side: THREE.DoubleSide,
  });

  const strip1 = new THREE.Mesh(stripGeo, sunStripMat);
  strip1.position.set(10, 7, -12);
  strip1.lookAt(0, 0, 0);
  envScene.add(strip1);

  const strip2 = new THREE.Mesh(stripGeo, skyStripMat);
  strip2.position.set(-10, 6, -8);
  strip2.lookAt(0, 0, 0);
  envScene.add(strip2);

  const envRT = pmrem.fromScene(envScene, 0.035);
  stripGeo.dispose();
  sunStripMat.dispose();
  skyStripMat.dispose();
  envScene.dispose();
  pmrem.dispose();

  return envRT.texture;
}

/**
 * Creates a procedural panoramic sky dome gradient canvas texture
 * matched to the active atmosphere preset.
 */
export function createSkyDomeTexture(preset: AtmospherePreset): THREE.CanvasTexture {
  const pal = ATMOSPHERE_PRESETS[preset];
  const [c, ctx] = createCanvas(512);
  const top = new THREE.Color(pal.skyTop);
  const hor = new THREE.Color(pal.skyHorizon);
  const fog = new THREE.Color(pal.fogColor);

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(0.45, `#${top.clone().lerp(hor, 0.45).getHexString()}`);
  grad.addColorStop(0.56, `#${hor.getHexString()}`);
  grad.addColorStop(0.7, `#${fog.getHexString()}`);
  grad.addColorStop(1, `#${fog.clone().multiplyScalar(0.5).getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle glowing solar/lunar disc on the horizon
  const sunX = preset === 'golden' ? 310 : preset === 'dawn' ? 190 : 256;
  const sunY = 262;
  const sunRad = preset === 'rainy' ? 75 : 130;
  const sGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunRad);
  const sunHex = new THREE.Color(pal.sunColor).getHexString();
  sGrad.addColorStop(0, `#${sunHex}`);
  sGrad.addColorStop(0.35, preset === 'rainy' ? 'rgba(124,184,255,0.28)' : 'rgba(255,180,100,0.45)');
  sGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sGrad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
