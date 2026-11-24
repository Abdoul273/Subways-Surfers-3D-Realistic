import * as THREE from 'three';
import {
  BARRIER_FULL_HEIGHT,
  BARRIER_HIGH_CLEARANCE,
  BARRIER_HIGH_TOP,
  BARRIER_LOW_HEIGHT,
  LANE_WIDTH,
  LANE_X,
  TRAIN_HEIGHT,
  TRAIN_PARKED_LENGTH,
  TRAIN_RAMP_LENGTH,
  TRAIN_RAMP_SLOPE_LEN,
} from './constants';
import type { ObstacleKind, PowerupKind } from './types';
import type { ProceduralTextureSet } from './textures';

export interface SharedMaterials {
  ballast: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  railSteel: THREE.MeshStandardMaterial;
  sleeperConcrete: THREE.MeshStandardMaterial;
  gantrySteel: THREE.MeshStandardMaterial;
  trainBodies: THREE.MeshPhysicalMaterial[];
  trainDarkGlass: THREE.MeshPhysicalMaterial;
  trainRoof: THREE.MeshStandardMaterial;
  trainBogie: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
  tactileYellow: THREE.MeshStandardMaterial;
  headlightEmissive: THREE.MeshStandardMaterial;
  taillightEmissive: THREE.MeshStandardMaterial;
  amberBeacon: THREE.MeshStandardMaterial;
  lampEmissive: THREE.MeshStandardMaterial;
  buildingFacade: THREE.MeshStandardMaterial;
  coinGold: THREE.MeshPhysicalMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  volumetricRay: THREE.ShaderMaterial;
  headlightBeam: THREE.ShaderMaterial;
  dispose: () => void;
}

/**
 * Custom GLSL volumetric light shaft shader with Fresnel edge softening,
 * smooth vertical falloff, and subtle animated atmospheric dust shimmer.
 */
export function createVolumetricShaderMaterial(
  colorHex: number,
  opacity: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      void main() {
        float dist = length(vViewPos);
        // Smooth distance attenuation prevents distant additive shafts from blowing out at the horizon
        float distFade = smoothstep(105.0, 22.0, dist) * smoothstep(3.5, 9.5, dist);
        vec3 viewDir = normalize(vViewPos);
        float edgeFade = pow(abs(dot(normalize(vNormalView), viewDir)), 1.9);
        float verticalFade = smoothstep(0.0, 0.38, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        float dustWave = 0.86 + 0.14 * sin(vUv.y * 14.0 - uTime * 1.4 + vUv.x * 6.2831);
        float alpha = edgeFade * verticalFade * distFade * dustWave * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createSharedMaterials(
  textures: ProceduralTextureSet,
): SharedMaterials {
  const ballast = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.ballastMap,
    bumpMap: textures.ballastBump,
    bumpScale: 0.16,
    roughnessMap: textures.ballastRoughness,
    roughness: 1.0,
    metalness: 0.12,
  });

  const concrete = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteMap,
    bumpMap: textures.concreteBump,
    bumpScale: 0.08,
    roughnessMap: textures.concreteRoughness,
    roughness: 0.92,
    metalness: 0.08,
  });

  const railSteel = new THREE.MeshStandardMaterial({
    color: 0xd0d8e4,
    roughness: 0.16,
    metalness: 0.96,
  });

  const sleeperConcrete = new THREE.MeshStandardMaterial({
    color: 0x555c68,
    roughness: 0.86,
    metalness: 0.08,
  });

  const gantrySteel = new THREE.MeshStandardMaterial({
    color: 0x262f3d,
    roughness: 0.44,
    metalness: 0.78,
  });

  const trainBodies = textures.trainMetalMaps.map(
    (map) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        bumpMap: textures.trainMetalBump,
        bumpScale: 0.055,
        roughnessMap: textures.trainMetalRoughness,
        roughness: 0.42,
        metalness: 0.78,
        clearcoat: 0.65,
        clearcoatRoughness: 0.2,
      }),
  );

  const trainDarkGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0b1322,
    roughness: 0.06,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 1.0,
  });

  const trainRoof = new THREE.MeshStandardMaterial({
    color: 0x454e5d,
    roughness: 0.68,
    metalness: 0.42,
  });

  const trainBogie = new THREE.MeshStandardMaterial({
    color: 0x1b2029,
    roughness: 0.58,
    metalness: 0.72,
  });

  const hazard = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.hazardMap,
    roughness: 0.46,
    metalness: 0.18,
  });

  const tactileYellow = new THREE.MeshStandardMaterial({
    color: 0xf5b31a,
    roughness: 0.62,
    metalness: 0.05,
  });

  const headlightEmissive = new THREE.MeshStandardMaterial({
    color: 0xfff7e0,
    emissive: 0xffe49e,
    emissiveIntensity: 3.4,
    roughness: 0.1,
    metalness: 0.1,
  });

  const taillightEmissive = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xff1e1e,
    emissiveIntensity: 2.6,
    roughness: 0.15,
    metalness: 0.1,
  });

  const amberBeacon = new THREE.MeshStandardMaterial({
    color: 0xffa726,
    emissive: 0xff8f00,
    emissiveIntensity: 2.8,
    roughness: 0.2,
    metalness: 0.1,
  });

  const lampEmissive = new THREE.MeshStandardMaterial({
    color: 0xffe8c2,
    emissive: 0xffbe66,
    emissiveIntensity: 3.2,
    roughness: 0.12,
    metalness: 0.05,
  });

  const buildingFacade = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.buildingMap,
    emissive: 0xffc680,
    emissiveMap: textures.buildingMap,
    emissiveIntensity: 0.42,
    roughness: 0.74,
    metalness: 0.25,
  });

  const coinGold = new THREE.MeshPhysicalMaterial({
    color: 0xffc93c,
    emissive: 0x6b3e00,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.96,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.56,
  });

  const volumetricRay = createVolumetricShaderMaterial(0xffc680, 0.16);
  const headlightBeam = createVolumetricShaderMaterial(0xfff1cc, 0.28);

  return {
    ballast,
    concrete,
    railSteel,
    sleeperConcrete,
    gantrySteel,
    trainBodies,
    trainDarkGlass,
    trainRoof,
    trainBogie,
    hazard,
    tactileYellow,
    headlightEmissive,
    taillightEmissive,
    amberBeacon,
    lampEmissive,
    buildingFacade,
    coinGold,
    contactShadow,
    volumetricRay,
    headlightBeam,
    dispose() {
      ballast.dispose();
      concrete.dispose();
      railSteel.dispose();
      sleeperConcrete.dispose();
      gantrySteel.dispose();
      trainBodies.forEach((m) => m.dispose());
      trainDarkGlass.dispose();
      trainRoof.dispose();
      trainBogie.dispose();
      hazard.dispose();
      tactileYellow.dispose();
      headlightEmissive.dispose();
      taillightEmissive.dispose();
      amberBeacon.dispose();
      lampEmissive.dispose();
      buildingFacade.dispose();
      coinGold.dispose();
      contactShadow.dispose();
      volumetricRay.dispose();
      headlightBeam.dispose();
    },
  };
}

// ============================================================================
// 1. COMPOSITE HERO RUNNER RIG (12+ Articulated Parts + Hoverboard + Jetpack)
// ============================================================================
export interface RunnerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hoverboard: THREE.Group;
  jetpack: THREE.Group;
  shieldAura: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export function createRunnerRig(mats: SharedMaterials): RunnerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Materials with strong roughness/metalness contrast across adjacent parts
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0xe63946, // Technical crimson parkour windbreaker
    roughness: 0.62,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x161b24, // Matte charcoal inner vest / pants
    roughness: 0.84,
    metalness: 0.06,
  });
  const reflectiveMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.6,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd9a07b,
    roughness: 0.68,
    metalness: 0.02,
  });
  const sneakerMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.32,
    metalness: 0.12,
  });
  const packMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.34,
    metalness: 0.74,
  });

  // Grounded contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.68, 24);
  const contactShadow = new THREE.Mesh(shadowGeo, mats.contactShadow);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Torso group pivoted around pelvis (y = 0.92)
  const torso = new THREE.Group();
  torso.position.y = 0.94;
  bodyGroup.add(torso);

  // Sculpted upper jacket chest
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.56, 0.29), jacketMat);
  chest.position.y = 0.28;
  chest.castShadow = true;
  torso.add(chest);

  // Shoulder yoke accent
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.31), trimMat);
  yoke.position.y = 0.51;
  yoke.castShadow = true;
  torso.add(yoke);

  // Hoodie collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.12, 12), trimMat);
  collar.position.y = 0.6;
  torso.add(collar);

  // Urban tech backpack + glowing kinetic strip (what the PC player sees most!)
  const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.18), packMetalMat);
  packBody.position.set(0, 0.31, 0.21);
  packBody.castShadow = true;
  torso.add(packBody);

  const packAccent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.03), reflectiveMat);
  packAccent.position.set(0, 0.4, 0.31);
  torso.add(packAccent);

  const packPocket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), trimMat);
  packPocket.position.set(0, 0.18, 0.31);
  torso.add(packPocket);

  // Head + backward streetwear cap + headphones
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.68;
  torso.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), skinMat);
  head.position.y = 0.12;
  head.castShadow = true;
  headGroup.add(head);

  const capDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    trimMat,
  );
  capDome.position.y = 0.14;
  capDome.castShadow = true;
  headGroup.add(capDome);

  // Backward cap brim facing camera (+Z)
  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.18), jacketMat);
  capBrim.position.set(0, 0.14, 0.16);
  capBrim.rotation.x = 0.14;
  headGroup.add(capBrim);

  // Metallic studio headphones around neck/ears
  const headphoneArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.022, 8, 16, Math.PI),
    packMetalMat,
  );
  headphoneArc.position.y = 0.13;
  headGroup.add(headphoneArc);

  // Articulated Arms
  const makeArm = (side: -1 | 1): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.33, 0.49, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 6, 10), jacketMat);
    upper.position.y = -0.15;
    upper.castShadow = true;
    arm.add(upper);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.056, 0.16, 10), trimMat);
    cuff.position.y = -0.34;
    arm.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 10), skinMat);
    hand.position.y = -0.45;
    arm.add(hand);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  // Articulated Legs with detailed high-top sneakers
  const makeLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.145, 0.92, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.32, 6, 10), trimMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.3, 6, 10), trimMat);
    shin.position.y = -0.56;
    shin.castShadow = true;
    leg.add(shin);

    // High-top Sneaker (upper + glowing sole)
    const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.13, 0.32), sneakerMat);
    shoeUpper.position.set(0, -0.82, -0.05);
    shoeUpper.castShadow = true;
    leg.add(shoeUpper);

    const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.045, 0.34), reflectiveMat);
    shoeSole.position.set(0, -0.89, -0.05);
    leg.add(shoeSole);

    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyGroup.add(leftLeg, rightLeg);

  // Deployable Futuristic Hoverboard (6 composite parts)
  const hoverboard = new THREE.Group();
  hoverboard.visible = false;
  const boardShape = new THREE.Shape();
  boardShape.moveTo(-0.34, -0.75);
  boardShape.quadraticCurveTo(0, -0.98, 0.34, -0.75);
  boardShape.lineTo(0.32, 0.72);
  boardShape.quadraticCurveTo(0, 0.95, -0.32, 0.72);
  boardShape.closePath();

  const boardGeo = new THREE.ExtrudeGeometry(boardShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  boardGeo.rotateX(Math.PI / 2);

  const boardMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.18,
    metalness: 0.85,
    clearcoat: 1.0,
  });
  const boardDeck = new THREE.Mesh(boardGeo, boardMat);
  boardDeck.position.y = 0.22;
  boardDeck.castShadow = true;
  hoverboard.add(boardDeck);

  const boardRailMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 3.0,
    roughness: 0.15,
  });
  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.38), boardRailMat);
  railLeft.position.set(-0.32, 0.18, 0);
  const railRight = railLeft.clone();
  railRight.position.x = 0.32;
  hoverboard.add(railLeft, railRight);

  const thrusterGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.24, 12);
  thrusterGeo.rotateX(Math.PI / 2);
  const thrusterL = new THREE.Mesh(thrusterGeo, mats.railSteel);
  thrusterL.position.set(-0.16, 0.14, 0.75);
  const thrusterR = thrusterL.clone();
  thrusterR.position.x = 0.16;
  hoverboard.add(thrusterL, thrusterR);
  bodyGroup.add(hoverboard);

  // Hoverboard Protective Fresnel Rim Aura (clear center so runner stays 100% sharp!)
  const shieldAura = new THREE.Mesh(
    new THREE.SphereGeometry(1.16, 22, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x38bdf8) },
      },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          vNormalView = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormalView;
        varying vec3 vViewPos;
        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewPos))), 2.6);
          gl_FragColor = vec4(uColor, fresnel * 0.58);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  shieldAura.position.y = 1.0;
  shieldAura.visible = false;
  bodyGroup.add(shieldAura);

  // Deployable Twin-Canister Jetpack
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 0.32, 0.34);
  jetpack.visible = false;
  const tankGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.56, 14);
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: 0xd97706,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.8,
  });
  const tankL = new THREE.Mesh(tankGeo, tankMat);
  tankL.position.x = -0.13;
  const tankR = tankL.clone();
  tankR.position.x = 0.13;
  const nozzleGeo = new THREE.ConeGeometry(0.11, 0.2, 12, 1, true);
  const nozzleL = new THREE.Mesh(nozzleGeo, mats.gantrySteel);
  nozzleL.position.set(-0.13, -0.34, 0);
  const nozzleR = nozzleL.clone();
  nozzleR.position.x = 0.13;
  jetpack.add(tankL, tankR, nozzleL, nozzleR);
  torso.add(jetpack);

  return {
    root,
    bodyGroup,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hoverboard,
    jetpack,
    shieldAura,
    contactShadow,
  };
}

// ============================================================================
// 2. COMPOSITE SUBWAY TRAINS (12+ Parts: Parked, Ramp-Front, Oncoming)
// ============================================================================
export function createTrainMesh(
  kind: 'train_parked' | 'train_ramp' | 'train_oncoming',
  variant: number,
  mats: SharedMaterials,
): THREE.Group {
  const group = new THREE.Group();
  const isRamp = kind === 'train_ramp';
  const isOncoming = kind === 'train_oncoming';

  const totalLength = isRamp ? TRAIN_RAMP_LENGTH : TRAIN_PARKED_LENGTH;
  const bodyLength = isRamp ? totalLength - TRAIN_RAMP_SLOPE_LEN : totalLength;
  const bodyZOffset = isRamp ? -TRAIN_RAMP_SLOPE_LEN * 0.5 : 0;

  const bodyMat = mats.trainBodies[variant % mats.trainBodies.length];
  const width = 2.48;
  const bodyHeight = 2.95;
  const undercarriageH = 0.6;

  // Ground contact shadow beneath train
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.9, totalLength + 1.2),
    mats.contactShadow,
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // 1. Primary Sculpted Hull with chamfered roof corners (ExtrudeGeometry)
  const hullShape = new THREE.Shape();
  const hw = width * 0.5;
  hullShape.moveTo(-hw + 0.12, 0);
  hullShape.lineTo(hw - 0.12, 0);
  hullShape.lineTo(hw, 0.25);
  hullShape.lineTo(hw, bodyHeight - 0.34);
  hullShape.lineTo(hw - 0.26, bodyHeight);
  hullShape.lineTo(-hw + 0.26, bodyHeight);
  hullShape.lineTo(-hw, bodyHeight - 0.34);
  hullShape.lineTo(-hw, 0.25);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: bodyLength,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.center();
  const hull = new THREE.Mesh(hullGeo, bodyMat);
  hull.position.set(0, undercarriageH + bodyHeight * 0.5, bodyZOffset);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // 2. Dark Clearcoat Side Window Band (left & right recessed glazing)
  const winBandGeo = new THREE.BoxGeometry(width + 0.05, 0.92, bodyLength - 1.4);
  const winBand = new THREE.Mesh(winBandGeo, mats.trainDarkGlass);
  winBand.position.set(0, undercarriageH + 1.92, bodyZOffset);
  group.add(winBand);

  // 3. Window mullions (vertical metallic dividers along sides)
  const mullionGeo = new THREE.BoxGeometry(width + 0.09, 0.96, 0.18);
  const mullionCount = 5;
  for (let i = 0; i < mullionCount; i++) {
    const mz =
      bodyZOffset - (bodyLength - 3.2) * 0.5 + (i / (mullionCount - 1)) * (bodyLength - 3.2);
    const mullion = new THREE.Mesh(mullionGeo, mats.trainRoof);
    mullion.position.set(0, undercarriageH + 1.92, mz);
    group.add(mullion);
  }

  // 4. Front Panoramic Cab Windshield (+Z faces the player!)
  const frontZ = bodyZOffset + bodyLength * 0.5 + 0.12;
  const cabGlass = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.44, 1.05, 0.14),
    mats.trainDarkGlass,
  );
  cabGlass.position.set(0, undercarriageH + 1.92, frontZ);
  group.add(cabGlass);

  // 5. Glowing LED Destination Matrix above windshield
  const ledSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.2, 0.12),
    mats.amberBeacon,
  );
  ledSign.position.set(0, undercarriageH + 2.6, frontZ + 0.01);
  group.add(ledSign);

  // 6. Roof HVAC Units & Ribbed Walkway (gives crisp visual detail when running on roofs!)
  const hvacGeo = new THREE.BoxGeometry(1.42, 0.18, 2.8);
  for (const offset of [-3.6, 3.2]) {
    const hvac = new THREE.Mesh(hvacGeo, mats.trainRoof);
    hvac.position.set(0, TRAIN_HEIGHT + 0.06, bodyZOffset + offset);
    hvac.castShadow = true;
    hvac.receiveShadow = true;
    group.add(hvac);
  }

  // 7. Steel Undercarriage Bogies & Wheels resting flush on the steel rails
  const bogieGeo = new THREE.BoxGeometry(width - 0.34, 0.52, 3.2);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12);
  wheelGeo.rotateZ(Math.PI / 2);

  for (const bz of [-bodyLength * 0.32, bodyLength * 0.32]) {
    const bogie = new THREE.Mesh(bogieGeo, mats.trainBogie);
    bogie.position.set(0, 0.36, bodyZOffset + bz);
    group.add(bogie);

    for (const wx of [-0.74, 0.74]) {
      for (const wz of [-0.95, 0.95]) {
        const wheel = new THREE.Mesh(wheelGeo, mats.railSteel);
        wheel.position.set(wx, 0.32, bodyZOffset + bz + wz);
        group.add(wheel);
      }
    }
  }

  // 8. Front Bumpers & Coupler
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.16, 0.32, 0.32),
    mats.trainBogie,
  );
  bumper.position.set(0, 0.76, frontZ + 0.06);
  group.add(bumper);

  // 9. Twin Headlights (brighter + volumetric light cones on oncoming trains!)
  const lampGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.12, 12);
  lampGeo.rotateX(Math.PI / 2);
  const lightMat = isOncoming ? mats.headlightEmissive : mats.taillightEmissive;

  for (const lx of [-0.76, 0.76]) {
    const lamp = new THREE.Mesh(lampGeo, lightMat);
    lamp.position.set(lx, 1.24, frontZ + 0.06);
    group.add(lamp);

    if (isOncoming) {
      const coneGeo = new THREE.ConeGeometry(1.7, 13.5, 16, 1, true);
      coneGeo.translate(0, -6.75, 0);
      coneGeo.rotateX(-Math.PI / 2);
      const beam = new THREE.Mesh(coneGeo, mats.headlightBeam);
      beam.position.set(lx, 1.24, frontZ + 0.15);
      beam.userData.isVolumetric = true;
      group.add(beam);
    }
  }

  // 10. Climbable Steel Boarding Ramp (train_ramp variant)
  if (isRamp) {
    const rampLen = TRAIN_RAMP_SLOPE_LEN;
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(rampLen, 0);
    rampShape.lineTo(0, TRAIN_HEIGHT);
    rampShape.closePath();

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, {
      depth: width - 0.14,
      bevelEnabled: false,
    });
    rampGeo.translate(0, 0, -(width - 0.14) * 0.5);
    rampGeo.rotateY(-Math.PI / 2);

    const rampMesh = new THREE.Mesh(rampGeo, mats.gantrySteel);
    rampMesh.position.set(0, 0.04, frontZ - 0.08);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    // High-visibility hazard safety rails along the ramp edges
    const hyp = Math.hypot(rampLen, TRAIN_HEIGHT);
    const slopeAngle = Math.atan2(TRAIN_HEIGHT, rampLen);
    const railGeo = new THREE.BoxGeometry(0.14, 0.16, hyp);
    for (const rx of [-(width * 0.5 - 0.1), width * 0.5 - 0.1]) {
      const sideRail = new THREE.Mesh(railGeo, mats.hazard);
      sideRail.position.set(rx, TRAIN_HEIGHT * 0.5 + 0.12, frontZ + rampLen * 0.5 - 0.08);
      sideRail.rotation.x = slopeAngle;
      group.add(sideRail);
    }
  }

  return group;
}

// ============================================================================
// 3. COMPOSITE TRACK BARRIERS (Low Jump, High Slide Gantry, Full Construction)
// ============================================================================
export function createBarrierMesh(
  kind: Extract<ObstacleKind, 'barrier_low' | 'barrier_high' | 'barrier_full'>,
  mats: SharedMaterials,
): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), mats.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  if (kind === 'barrier_low') {
    // Concrete footings + steel legs + hazard plank + twin amber beacons
    for (const sx of [-1.05, 1.05]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.72), mats.concrete);
      foot.position.set(sx, 0.12, 0);
      foot.castShadow = true;
      group.add(foot);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, BARRIER_LOW_HEIGHT, 0.14), mats.gantrySteel);
      post.position.set(sx, BARRIER_LOW_HEIGHT * 0.5, 0);
      post.castShadow = true;
      group.add(post);

      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.15, 10), mats.amberBeacon);
      beacon.position.set(sx, BARRIER_LOW_HEIGHT + 0.07, 0);
      group.add(beacon);
    }

    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.44, 0.18), mats.hazard);
    plank.position.set(0, BARRIER_LOW_HEIGHT - 0.26, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  } else if (kind === 'barrier_high') {
    // Tall steel side posts + high overhead hazard gantry (roll underneath!)
    for (const sx of [-1.18, 1.18]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.56), mats.concrete);
      base.position.set(sx, 0.13, 0);
      group.add(base);

      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, BARRIER_HIGH_TOP, 0.18), mats.gantrySteel);
      leg.position.set(sx, BARRIER_HIGH_TOP * 0.5, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    const beamHeight = BARRIER_HIGH_TOP - BARRIER_HIGH_CLEARANCE - 0.12;
    const overheadPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.56, beamHeight * 0.58, 0.26),
      mats.hazard,
    );
    overheadPanel.position.set(0, BARRIER_HIGH_CLEARANCE + beamHeight * 0.42, 0);
    overheadPanel.castShadow = true;
    group.add(overheadPanel);

    const topCap = new THREE.Mesh(
      new THREE.BoxGeometry(2.68, 0.22, 0.34),
      mats.gantrySteel,
    );
    topCap.position.set(0, BARRIER_HIGH_TOP - 0.12, 0);
    group.add(topCap);

    // Warning light strip along underside so roll clearance is instantly readable
    const underStrip = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.07, 0.28),
      mats.amberBeacon,
    );
    underStrip.position.set(0, BARRIER_HIGH_CLEARANCE + 0.1, 0);
    group.add(underStrip);
  } else {
    // Full-height reinforced construction barricade
    const jerseyBase = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.1, 0.85), mats.concrete);
    jerseyBase.position.y = 0.55;
    jerseyBase.castShadow = true;
    jerseyBase.receiveShadow = true;
    group.add(jerseyBase);

    const upperWall = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, BARRIER_FULL_HEIGHT - 1.1, 0.24),
      mats.hazard,
    );
    upperWall.position.y = 1.1 + (BARRIER_FULL_HEIGHT - 1.1) * 0.5;
    upperWall.castShadow = true;
    group.add(upperWall);

    for (const sx of [-1.14, 0, 1.14]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, BARRIER_FULL_HEIGHT + 0.12, 0.3),
        mats.gantrySteel,
      );
      strut.position.set(sx, BARRIER_FULL_HEIGHT * 0.5, 0);
      group.add(strut);
    }
  }

  return group;
}

// ============================================================================
// 4. COLLECTIBLES (Chamfered Gold Coins & Composite 3D Power-Ups)
// ============================================================================
export function createCoinGeometry(): THREE.BufferGeometry {
  // Lathe/extruded beveled metallic token
  const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.11, 18);
  geo.rotateX(Math.PI / 2);
  return geo;
}

export function createPowerupMesh(
  kind: PowerupKind,
  mats: SharedMaterials,
): THREE.Group {
  const group = new THREE.Group();

  // Outer energy ring for unmistakable pickup readability
  const ringColors: Record<PowerupKind, number> = {
    magnet: 0xef4444,
    jetpack: 0xf97316,
    sneakers: 0x22c55e,
    hoverboard: 0x38bdf8,
  };
  const ringMat = new THREE.MeshStandardMaterial({
    color: ringColors[kind],
    emissive: ringColors[kind],
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.5,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 24), ringMat);
  group.add(halo);

  if (kind === 'magnet') {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      roughness: 0.22,
      metalness: 0.65,
      clearcoat: 0.9,
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 10, 16, Math.PI), redMat);
    arc.position.y = 0.04;
    group.add(arc);
    for (const sx of [-0.28, 0.28]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), mats.railSteel);
      tip.position.set(sx, -0.07, 0);
      group.add(tip);
    }
  } else if (kind === 'jetpack') {
    const tankMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.85,
      clearcoat: 0.8,
    });
    for (const sx of [-0.15, 0.15]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.52, 12), tankMat);
      tank.position.x = sx;
      group.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 12), mats.gantrySteel);
      cap.position.set(sx, -0.32, 0);
      group.add(cap);
    }
  } else if (kind === 'sneakers') {
    const greenMat = new THREE.MeshPhysicalMaterial({
      color: 0x16a34a,
      roughness: 0.3,
      metalness: 0.25,
      clearcoat: 0.6,
    });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.56), mats.tactileYellow);
    sole.position.y = -0.14;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.44), greenMat);
    body.position.set(0, 0.01, -0.02);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.2), mats.headlightEmissive);
    cuff.position.set(0, 0.16, 0.1);
    group.add(sole, body, cuff);
  } else {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.86), mats.gantrySteel);
    deck.rotation.z = 0.25;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.78), ringMat);
    edge.rotation.z = 0.25;
    group.add(deck, edge);
  }

  return group;
}

// ============================================================================
// 5. RECYCLABLE METROPOLITAN VIADUCT TRACK CHUNK (44m with Volumetric Shafts)
// ============================================================================
export const CHUNK_LENGTH = 44;

export function createTrackChunk(mats: SharedMaterials): THREE.Group {
  const chunk = new THREE.Group();

  // 1. Wet Gravel Ballast & Puddle Ground Bed
  const trackBedWidth = LANE_WIDTH * 3 + 2.4;
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(trackBedWidth, CHUNK_LENGTH),
    mats.ballast,
  );
  bed.rotation.x = -Math.PI / 2;
  bed.receiveShadow = true;
  chunk.add(bed);

  // Extended urban viaduct under-deck on outer flanks so there is never an empty void
  const outerDeckGeo = new THREE.PlaneGeometry(58, CHUNK_LENGTH);
  const outerDeck = new THREE.Mesh(outerDeckGeo, mats.gantrySteel);
  outerDeck.rotation.x = -Math.PI / 2;
  outerDeck.position.y = -0.25;
  chunk.add(outerDeck);

  // 2. Instanced Concrete Sleepers across all 3 lanes (3 lanes * 22 sleepers = 66 instances)
  const sleeperGeo = new THREE.BoxGeometry(2.12, 0.11, 0.28);
  const sleepersPerLane = 22;
  const sleeperInst = new THREE.InstancedMesh(
    sleeperGeo,
    mats.sleeperConcrete,
    sleepersPerLane * 3,
  );
  sleeperInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (const lane of [-1, 0, 1] as const) {
    const lx = LANE_X[lane];
    for (let s = 0; s < sleepersPerLane; s++) {
      const sz = -CHUNK_LENGTH * 0.5 + (s + 0.5) * (CHUNK_LENGTH / sleepersPerLane);
      dummy.position.set(lx, 0.04, sz);
      dummy.updateMatrix();
      sleeperInst.setMatrixAt(idx++, dummy.matrix);
    }
  }
  sleeperInst.instanceMatrix.needsUpdate = true;
  sleeperInst.computeBoundingSphere();
  chunk.add(sleeperInst);

  // 3. 6 Gleaming Metallic Steel Rails (2 per lane)
  const railGeo = new THREE.BoxGeometry(0.11, 0.14, CHUNK_LENGTH);
  for (const lane of [-1, 0, 1] as const) {
    const lx = LANE_X[lane];
    for (const ro of [-0.74, 0.74]) {
      const rail = new THREE.Mesh(railGeo, mats.railSteel);
      rail.position.set(lx + ro, 0.14, 0);
      rail.receiveShadow = true;
      chunk.add(rail);
    }
  }

  // 4. Side Concrete Metro Platforms + Yellow Tactile Edge Strips + Retaining Walls
  const platGeo = new THREE.BoxGeometry(4.2, 1.15, CHUNK_LENGTH);
  const tactileGeo = new THREE.BoxGeometry(0.28, 0.05, CHUNK_LENGTH);
  const wallGeo = new THREE.BoxGeometry(0.85, 6.2, CHUNK_LENGTH);

  for (const side of [-1, 1] as const) {
    const platX = side * (trackBedWidth * 0.5 + 1.9);
    const platform = new THREE.Mesh(platGeo, mats.concrete);
    platform.position.set(platX, 0.56, 0);
    platform.receiveShadow = true;
    platform.castShadow = true;
    chunk.add(platform);

    const tactile = new THREE.Mesh(tactileGeo, mats.tactileYellow);
    tactile.position.set(side * (trackBedWidth * 0.5 + 0.06), 1.16, 0);
    chunk.add(tactile);

    // Architectural concrete viaduct parapet wall + top coping ledge
    const wall = new THREE.Mesh(wallGeo, mats.concrete);
    wall.position.set(side * (trackBedWidth * 0.5 + 4.2), 3.1, 0);
    wall.receiveShadow = true;
    chunk.add(wall);

    const coping = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.34, CHUNK_LENGTH),
      mats.gantrySteel,
    );
    coping.position.set(side * (trackBedWidth * 0.5 + 4.12), 6.26, 0);
    chunk.add(coping);

    // Repeating architectural concrete pilasters + glowing platform wall sconces
    for (const pz of [-CHUNK_LENGTH * 0.375, -CHUNK_LENGTH * 0.125, CHUNK_LENGTH * 0.125, CHUNK_LENGTH * 0.375]) {
      const pilaster = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 6.2, 0.72),
        mats.gantrySteel,
      );
      pilaster.position.set(side * (trackBedWidth * 0.5 + 3.68), 3.1, pz);
      pilaster.castShadow = true;
      chunk.add(pilaster);
    }

    // Trackside railway signal post with glowing emerald/amber transit signal
    const sigPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 3.8, 0.16),
      mats.gantrySteel,
    );
    sigPost.position.set(side * (trackBedWidth * 0.5 + 0.55), 2.9, -CHUNK_LENGTH * 0.15);
    chunk.add(sigPost);

    const sigBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.78, 0.28),
      mats.trainBogie,
    );
    sigBox.position.set(side * (trackBedWidth * 0.5 + 0.55), 4.65, -CHUNK_LENGTH * 0.15);
    chunk.add(sigBox);

    const sigLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 12),
      side === -1 ? mats.amberBeacon : mats.taillightEmissive,
    );
    sigLens.position.set(side * (trackBedWidth * 0.5 + 0.55), 4.78, -CHUNK_LENGTH * 0.15 + 0.15);
    chunk.add(sigLens);
  }

  // 5. Steel Arched Overhead Catenary Gantries + Truss Braces + Volumetric Lamp Cones
  const colGeo = new THREE.BoxGeometry(0.46, 9.6, 0.46);
  const crossBeamGeo = new THREE.BoxGeometry(trackBedWidth + 3.2, 0.38, 0.42);
  const topTrussGeo = new THREE.BoxGeometry(trackBedWidth + 3.2, 0.18, 0.24);
  const braceGeo = new THREE.BoxGeometry(0.18, 2.2, 0.18);
  const lampHousingGeo = new THREE.BoxGeometry(1.5, 0.16, 0.46);
  const lampLensGeo = new THREE.PlaneGeometry(1.32, 0.34);
  const lampConeGeo = new THREE.ConeGeometry(3.8, 8.8, 16, 1, true);
  lampConeGeo.translate(0, -4.4, 0);

  for (const gz of [-CHUNK_LENGTH * 0.25, CHUNK_LENGTH * 0.25]) {
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, gz);

    for (const side of [-1, 1] as const) {
      const col = new THREE.Mesh(colGeo, mats.gantrySteel);
      col.position.set(side * (trackBedWidth * 0.5 + 1.1), 4.8, 0);
      col.castShadow = true;
      gantry.add(col);

      // Angled structural gusset knee brace
      const brace = new THREE.Mesh(braceGeo, mats.gantrySteel);
      brace.position.set(side * (trackBedWidth * 0.5 + 0.4), 8.5, 0);
      brace.rotation.z = side * 0.72;
      gantry.add(brace);
    }

    const cross = new THREE.Mesh(crossBeamGeo, mats.gantrySteel);
    cross.position.set(0, 9.35, 0);
    cross.castShadow = true;
    gantry.add(cross);

    const upperChord = new THREE.Mesh(topTrussGeo, mats.gantrySteel);
    upperChord.position.set(0, 10.15, 0);
    gantry.add(upperChord);

    // Overhead metro station lamp housings + volumetric cones
    for (const lx of [-LANE_WIDTH, LANE_WIDTH]) {
      const housing = new THREE.Mesh(lampHousingGeo, mats.gantrySteel);
      housing.position.set(lx, 9.08, 0);
      gantry.add(housing);

      const lens = new THREE.Mesh(lampLensGeo, mats.lampEmissive);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, 8.99, 0);
      gantry.add(lens);

      const cone = new THREE.Mesh(lampConeGeo, mats.volumetricRay);
      cone.position.set(lx, 8.98, 0);
      cone.userData.isVolumetric = true;
      gantry.add(cone);
    }

    chunk.add(gantry);
  }

  // 6. Angled Volumetric Sunbeam God-Ray Shaft slicing through the viaduct gantries
  const sunShaftGeo = new THREE.CylinderGeometry(1.4, 3.6, 21, 16, 1, true);
  const sunShaft = new THREE.Mesh(sunShaftGeo, mats.volumetricRay);
  sunShaft.position.set(1.2, 9.0, 2);
  sunShaft.rotation.z = 0.44;
  sunShaft.rotation.x = 0.14;
  sunShaft.userData.isVolumetric = true;
  sunShaft.userData.isSunShaft = true;
  chunk.add(sunShaft);

  // 7. Overhead Catenary Power Wires spanning chunk length
  const wireGeo = new THREE.CylinderGeometry(0.025, 0.025, CHUNK_LENGTH, 6);
  wireGeo.rotateX(Math.PI / 2);
  for (const lane of [-1, 0, 1] as const) {
    const wire = new THREE.Mesh(wireGeo, mats.gantrySteel);
    wire.position.set(LANE_X[lane], 8.65, 0);
    chunk.add(wire);
  }

  // 8. Distant Urban Cityscape Towers flanking the viaduct (open horizon skyline)
  const towerSpecs = [
    { side: -1, xOff: 15.5, zOff: -12, w: 9, h: 28, d: 11 },
    { side: -1, xOff: 19.0, zOff: 9, w: 12, h: 38, d: 13 },
    { side: 1, xOff: 16.0, zOff: -8, w: 10, h: 34, d: 12 },
    { side: 1, xOff: 18.5, zOff: 13, w: 11, h: 24, d: 10 },
  ];
  for (const spec of towerSpecs) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w, spec.h, spec.d),
      mats.buildingFacade,
    );
    tower.position.set(spec.side * spec.xOff, spec.h * 0.5 - 2, spec.zOff);
    chunk.add(tower);
  }

  return chunk;
}
