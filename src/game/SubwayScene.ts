import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ATMOSPHERE_PRESETS, LANE_X } from './constants';
import { SubwayGameEngine } from './engine';
import {
  CHUNK_LENGTH,
  createBarrierMesh,
  createCoinGeometry,
  createPowerupMesh,
  createRunnerRig,
  createSharedMaterials,
  createTrackChunk,
  createTrainMesh,
  type RunnerRig,
  type SharedMaterials,
} from './models';
import { ParticleSystem } from './particles';
import { SubwayAudio } from './audio';
import {
  buildAtmosphereEnvMap,
  createProceduralTextureSet,
  createSkyDomeTexture,
  type ProceduralTextureSet,
} from './textures';
import type {
  AtmospherePreset,
  GraphicsSettings,
  HudSnapshot,
  ObstacleEntity,
  PowerupEntity,
} from './types';

const BEST_SCORE_STORAGE_KEY = 'metro_rush_3d_best_score_v1';
const CHUNK_COUNT = 7;
const MAX_COIN_INSTANCES = 260;

const _dummy = new THREE.Object3D();
const _camTarget = new THREE.Vector3();
const _camDesiredPos = new THREE.Vector3();
const _lookCurrent = new THREE.Vector3(0, 1.8, -14);

const SpeedCinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedFactor: { value: 0.0 },
    uStumble: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSpeedFactor;
    uniform float uStumble;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      float chroma = (0.0012 + uSpeedFactor * 0.0045 + uStumble * 0.005) * dist;
      float r = texture2D(tDiffuse, vUv + centered * chroma).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - centered * chroma).b;
      vec3 col = vec3(r, g, b);

      // Subtle cinematic edge vignette + red warning pulse when stumbled
      float vig = smoothstep(0.95, 0.36, dist);
      col *= mix(0.72, 1.0, vig);
      col.r += uStumble * smoothstep(0.35, 0.85, dist) * 0.32;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class SubwaySceneController {
  public readonly engine: SubwayGameEngine;
  public readonly audio = new SubwayAudio();
  public readonly isSoftwareGl: boolean;

  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private speedPass: ShaderPass | null = null;

  private textures: ProceduralTextureSet;
  private materials: SharedMaterials;
  private envMap: THREE.Texture | null = null;
  private skyDome: THREE.Mesh;
  private skyTexture: THREE.CanvasTexture | null = null;

  // Lighting rig (warm key + cool hemisphere + rim + dynamic runner accent light)
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private playerAccentLight: THREE.PointLight;
  private fog: THREE.FogExp2;

  // World entities
  private trackChunks: THREE.Group[] = [];
  private runner: RunnerRig;
  private obstacleMeshes = new Map<number, THREE.Object3D>();
  private powerupMeshes = new Map<number, THREE.Object3D>();
  private coinMesh: THREE.InstancedMesh;
  private particles: ParticleSystem;

  // State & Loop
  private graphics: GraphicsSettings;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private frameId = 0;
  private destroyed = false;
  private lastTimestamp = 0;
  private totalTime = 0;
  private hudSyncTimer = 0;
  private lastReportedPhase = '';
  private lastReportedCoins = -1;
  private resizeObserver: ResizeObserver;
  private contextLost = false;

  constructor(
    container: HTMLElement,
    initialGraphics: GraphicsSettings,
    onHudUpdate: (snap: HudSnapshot) => void,
    autostart: boolean,
  ) {
    this.container = container;
    this.graphics = { ...initialGraphics };
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();

    let savedBest = 0;
    try {
      savedBest = Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || '0') || 0;
    } catch {
      savedBest = 0;
    }

    this.engine = new SubwayGameEngine(Date.now() & 0xfffffff, savedBest);

    // 1. Renderer setup with ACES Filmic & Software-WebGL guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Handle WebGL context loss/restoration gracefully
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // 2. Scene, Fog & Camera
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x3b2c38, 0.0072);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.25, 290);
    this.camera.position.set(4.5, 4.2, 8.2);
    this.camera.lookAt(0, 1.8, -12);

    // 3. Procedural PBR Textures & Shared Materials
    this.textures = createProceduralTextureSet(this.renderer);
    this.materials = createSharedMaterials(this.textures);

    // 4. Panoramic Sky Dome following the player
    const skyGeo = new THREE.SphereGeometry(240, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // 5. Studio / Outdoor Warm-Cool 3-Point Lighting Rig
    this.sunLight = new THREE.DirectionalLight(0xffb366, 3.1);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 140;
    const d = 24;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.hemiLight = new THREE.HemisphereLight(0x5c7fb8, 0x2b1d1a, 1.05);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0x4ca8ff, 1.4);
    this.rimLight.position.set(-18, 14, 24);
    this.scene.add(this.rimLight);

    // Subtle dynamic accent light under runner (illuminates wet rails/hoverboard glow!)
    this.playerAccentLight = new THREE.PointLight(0xffa73b, 1.6, 12, 1.8);
    this.scene.add(this.playerAccentLight);

    // 6. Infinite Recyclable Track Chunks
    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunk = createTrackChunk(this.materials);
      chunk.position.z = -i * CHUNK_LENGTH + CHUNK_LENGTH * 0.5;
      this.scene.add(chunk);
      this.trackChunks.push(chunk);
    }

    // 7. Hero Composite Runner Rig
    this.runner = createRunnerRig(this.materials);
    this.scene.add(this.runner.root);

    // 8. Instanced Gold Coins
    this.coinMesh = new THREE.InstancedMesh(
      createCoinGeometry(),
      this.materials.coinGold,
      MAX_COIN_INSTANCES,
    );
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);

    // 9. Advanced Pooled Particle System
    this.particles = new ParticleSystem(this.textures.smokeSpriteMap);
    this.scene.add(this.particles.group);

    // 10. Post-Processing Composer (GPU only; bypassed on software WebGL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(width * 0.5), Math.floor(height * 0.5)),
        0.48, // refined bloom strength
        0.38, // radius
        0.82, // threshold (only highlights, headlights, lamps, coins & sparks bloom)
      );
      this.composer.addPass(this.bloomPass);

      this.speedPass = new ShaderPass(SpeedCinematicShader);
      this.composer.addPass(this.speedPass);
    }

    // Apply initial atmosphere & graphics settings
    this.applyAtmosphere(this.graphics.atmosphere);
    this.applyGraphicsSettings(this.graphics);

    if (autostart) {
      this.startRun();
    } else {
      this.syncEntitiesToScene();
      this.emitHudSnapshot(true);
    }

    // Pre-compile shaders on GPU to eliminate first-frame stutter
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Paint the opening 3D frame immediately at t=0ms (zero black startup frame)
    this.updateLightingAndSky();
    this.updateRunnerVisuals(0);
    this.renderer.render(this.scene, this.camera);

    // Responsive ResizeObserver
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Start render/simulation loop
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.applyAtmosphere(this.graphics.atmosphere);
  };

  public applyAtmosphere(preset: AtmospherePreset): void {
    const pal = ATMOSPHERE_PRESETS[preset];
    this.graphics.atmosphere = preset;

    this.fog.color.setHex(pal.fogColor);
    this.fog.density = pal.fogDensity;
    this.scene.background = new THREE.Color(pal.fogColor);

    this.sunLight.color.setHex(pal.sunColor);
    this.sunLight.intensity = pal.sunIntensity;
    this.hemiLight.color.setHex(pal.hemiSky);
    this.hemiLight.groundColor.setHex(pal.hemiGround);
    this.hemiLight.intensity = pal.hemiIntensity;
    this.rimLight.color.setHex(pal.rimColor);
    this.rimLight.intensity = pal.rimIntensity;
    this.renderer.toneMappingExposure = pal.exposure;

    this.materials.volumetricRay.uniforms.uColor.value.setHex(pal.beamColor);
    this.materials.volumetricRay.uniforms.uOpacity.value = pal.beamOpacity;
    this.materials.lampEmissive.emissive.setHex(pal.lampColor);
    this.materials.ballast.roughness = 1.15 - pal.wetness * 0.25;

    // Update sky dome texture
    if (this.skyTexture) this.skyTexture.dispose();
    this.skyTexture = createSkyDomeTexture(preset);
    const skyMat = this.skyDome.material as THREE.MeshBasicMaterial;
    skyMat.map = this.skyTexture;
    skyMat.needsUpdate = true;

    // Rebuild dynamic PBR reflection environment map
    if (this.envMap) this.envMap.dispose();
    this.envMap = buildAtmosphereEnvMap(this.renderer, preset);
    this.scene.environment = this.graphics.dynamicReflections ? this.envMap : null;

    this.particles.setAtmosphereMode(pal.rain, pal.beamColor);
  }

  public applyGraphicsSettings(next: GraphicsSettings): void {
    const atmosphereChanged = next.atmosphere !== this.graphics.atmosphere;
    this.graphics = { ...next };

    if (atmosphereChanged) {
      this.applyAtmosphere(next.atmosphere);
    }

    this.scene.environment = next.dynamicReflections ? this.envMap : null;
    this.materials.ballast.metalness = next.dynamicReflections ? 0.16 : 0.02;
    this.materials.railSteel.envMapIntensity = next.dynamicReflections ? 1.5 : 0.35;
    this.materials.trainBodies.forEach((m) => {
      m.envMapIntensity = next.dynamicReflections ? 1.35 : 0.35;
    });

    this.particles.enabled = next.particles;
    if (this.bloomPass) {
      this.bloomPass.enabled = next.bloom;
    }

    // Toggle volumetric meshes cleanly
    this.scene.traverse((obj) => {
      if (obj.userData?.isVolumetric) {
        obj.visible = next.volumetricLights;
      }
    });
  }

  public startRun(): void {
    this.audio.unlock();
    this.clearDynamicMeshes();
    this.engine.startRun(Date.now() & 0xfffffff);
    this.syncEntitiesToScene();
    this.emitHudSnapshot(true);
  }

  public returnToTitle(): void {
    this.clearDynamicMeshes();
    this.engine.resetWorld(Date.now() & 0xfffffff);
    this.engine.setPhase('title');
    this.audio.updateAmbience(false, 0, false);
    this.syncEntitiesToScene();
    this.emitHudSnapshot(true);
  }

  public togglePause(): void {
    this.engine.togglePause();
    if (this.engine.phase === 'paused') {
      this.audio.updateAmbience(false, 0, false);
    }
    this.emitHudSnapshot(true);
  }

  public toggleMute(): boolean {
    this.audio.unlock();
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    return next;
  }

  public moveLane(delta: -1 | 1): void {
    this.audio.unlock();
    this.engine.moveLane(delta);
  }

  public jump(): void {
    this.audio.unlock();
    this.engine.requestJump();
  }

  public roll(): void {
    this.audio.unlock();
    this.engine.requestRoll();
  }

  public activateHoverboard(): void {
    this.audio.unlock();
    if (this.engine.activateHoverboard()) {
      this.emitHudSnapshot(true);
    }
  }

  private clearDynamicMeshes(): void {
    for (const obj of this.obstacleMeshes.values()) {
      this.scene.remove(obj);
    }
    this.obstacleMeshes.clear();
    for (const obj of this.powerupMeshes.values()) {
      this.scene.remove(obj);
    }
    this.powerupMeshes.clear();
  }

  private handleResize(): void {
    if (this.destroyed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(Math.floor(width * 0.5), Math.floor(height * 0.5));
    }
  }

  private scheduleNextFrame(): void {
    if (this.destroyed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  /**
   * Software-WebGL pacing helper per threejs skill: waits for GPU sync fence
   * to complete and yields 80ms so headless Chromium never starves UI/snapshots.
   */
  private afterDraw(cb: () => void): void {
    if (this.destroyed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.destroyed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick(): void {
    if (this.destroyed) return;

    const now = performance.now();
    const rawDt = Math.min((now - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = now;
    this.totalTime += rawDt;

    if (!this.contextLost) {
      // Advance game simulation
      const events = this.engine.step(rawDt);

      // Process events -> Audio + Particles + Persist best score
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        this.audio.playEvent(ev);
        if (ev.type === 'coin') {
          this.particles.emitSparkBurst(ev.x, ev.y, ev.z, 7, 0xffd43b, 6.5);
        } else if (ev.type === 'powerup' || ev.type === 'hoverboard_on') {
          this.particles.emitSparkBurst(ev.x, ev.y + 0.8, ev.z, 18, 0x38bdf8, 10.5);
        } else if (ev.type === 'land') {
          this.particles.emitSmoke(
            ev.x,
            ev.y + 0.12,
            ev.z,
            0,
            0.9,
            1.4,
            0.42,
            0.45,
            1.5,
            0xb8b2a6,
            0.35,
          );
        } else if (ev.type === 'stumble') {
          this.particles.emitSparkBurst(ev.x, ev.y, ev.z, 22, 0xff922b, 12);
        } else if (ev.type === 'shield_break') {
          this.particles.emitSparkBurst(ev.x, ev.y, ev.z, 34, 0x38bdf8, 16);
          this.particles.emitSmoke(ev.x, ev.y, ev.z, 0, 1.8, 0, 0.7, 1.2, 4.2, 0x7dd3fc, 0.55);
        } else if (ev.type === 'crash') {
          this.particles.emitSparkBurst(ev.x, ev.y, ev.z, 36, 0xff6b35, 14);
          this.particles.emitSmoke(ev.x, ev.y, ev.z, 0, 1.5, 0, 0.9, 1.0, 4.0, 0x94a3b8, 0.55);
          try {
            localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(this.engine.bestScore));
          } catch {
            // ignore storage errors
          }
        }
      }

      // Update continuous wind/rail audio ambience
      this.audio.updateAmbience(
        this.engine.phase === 'playing',
        this.engine.speed,
        this.engine.player.jetpackTimer > 0,
      );

      // Update shaders, world chunks, entities, runner kinematics, particles & camera
      this.materials.volumetricRay.uniforms.uTime.value = this.totalTime;
      this.materials.headlightBeam.uniforms.uTime.value = this.totalTime;

      this.updateTrackChunks();
      this.syncEntitiesToScene();
      this.updateRunnerVisuals(rawDt);
      this.updateLightingAndSky();

      const p = this.engine.player;
      this.particles.update(
        rawDt,
        p.x,
        p.y,
        p.z,
        this.engine.phase === 'playing' ? this.engine.speed : 14,
        p.jetpackTimer > 0,
        p.hoverboardTimer > 0,
        p.rolling,
      );

      this.updateCamera(rawDt);

      // Update cinematic speed shader uniforms on GPU
      if (this.speedPass) {
        const speedNorm =
          this.engine.phase === 'playing'
            ? Math.max(0, Math.min(1, (this.engine.speed - 24) / 32))
            : 0;
        this.speedPass.uniforms.uSpeedFactor.value =
          p.jetpackTimer > 0 ? 1.0 : speedNorm;
        this.speedPass.uniforms.uStumble.value =
          p.stumbleCount > 0 && p.stumbleTimer > 0
            ? Math.min(1, p.stumbleTimer / 3.0) * 0.85
            : 0;
      }

      // Render frame
      if (this.composer && !this.isSoftwareGl) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      // Throttled HUD sync (<= 10Hz or immediately on discrete changes)
      this.hudSyncTimer += rawDt;
      const discreteChanged =
        this.engine.phase !== this.lastReportedPhase ||
        this.engine.coinsCollected !== this.lastReportedCoins ||
        events.length > 0;
      if (discreteChanged || this.hudSyncTimer >= 0.1) {
        this.emitHudSnapshot(false);
        this.hudSyncTimer = 0;
      }
    }

    this.scheduleNextFrame();
  }

  private emitHudSnapshot(force: boolean): void {
    const snap = this.engine.getHudSnapshot();
    if (
      !force &&
      snap.phase === this.lastReportedPhase &&
      snap.phase === 'paused'
    ) {
      return;
    }
    this.lastReportedPhase = snap.phase;
    this.lastReportedCoins = snap.coins;
    this.onHudUpdate(snap);
  }

  private updateTrackChunks(): void {
    const playerZ = this.engine.player.z;
    for (let i = 0; i < this.trackChunks.length; i++) {
      const chunk = this.trackChunks[i];
      if (chunk.position.z - CHUNK_LENGTH * 0.5 > playerZ + 22) {
        chunk.position.z -= CHUNK_COUNT * CHUNK_LENGTH;
      }
    }
  }

  private syncEntitiesToScene(): void {
    // 1. Obstacles
    const activeObsIds = new Set<number>();
    const obstacles = this.engine.obstacles;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      activeObsIds.add(obs.id);
      let mesh = this.obstacleMeshes.get(obs.id);
      if (!mesh) {
        mesh = this.buildObstacleObject(obs);
        this.obstacleMeshes.set(obs.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(LANE_X[obs.lane], 0, obs.z);
    }
    for (const [id, mesh] of this.obstacleMeshes.entries()) {
      if (!activeObsIds.has(id)) {
        this.scene.remove(mesh);
        this.obstacleMeshes.delete(id);
      }
    }

    // 2. Power-ups
    const activePuIds = new Set<number>();
    const powerups = this.engine.powerups;
    for (let i = 0; i < powerups.length; i++) {
      const pu = powerups[i];
      if (pu.collected) continue;
      activePuIds.add(pu.id);
      let mesh = this.powerupMeshes.get(pu.id);
      if (!mesh) {
        mesh = this.buildPowerupObject(pu);
        this.powerupMeshes.set(pu.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(
        LANE_X[pu.lane],
        pu.y + Math.sin(this.totalTime * 3.8 + pu.id) * 0.16,
        pu.z,
      );
      mesh.rotation.y = this.totalTime * 2.4 + pu.id;
    }
    for (const [id, mesh] of this.powerupMeshes.entries()) {
      if (!activePuIds.has(id)) {
        this.scene.remove(mesh);
        this.powerupMeshes.delete(id);
      }
    }

    // 3. Instanced Spinning Gold Coins
    const coins = this.engine.coins;
    let count = 0;
    for (let i = 0; i < coins.length && count < MAX_COIN_INSTANCES; i++) {
      const c = coins[i];
      if (c.collected) continue;
      _dummy.position.set(c.x, c.y + Math.sin(this.totalTime * 4.2 + c.z * 0.35) * 0.08, c.z);
      _dummy.rotation.set(0, this.totalTime * 3.4 + c.z * 0.25, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      this.coinMesh.setMatrixAt(count++, _dummy.matrix);
    }
    this.coinMesh.count = count;
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  private buildObstacleObject(obs: ObstacleEntity): THREE.Object3D {
    let group: THREE.Group;
    if (
      obs.kind === 'train_parked' ||
      obs.kind === 'train_ramp' ||
      obs.kind === 'train_oncoming'
    ) {
      group = createTrainMesh(obs.kind, obs.variant, this.materials);
    } else {
      group = createBarrierMesh(obs.kind, this.materials);
    }
    group.traverse((child) => {
      if (child.userData?.isVolumetric) {
        child.visible = this.graphics.volumetricLights;
      }
    });
    return group;
  }

  private buildPowerupObject(pu: PowerupEntity): THREE.Object3D {
    return createPowerupMesh(pu.kind, this.materials);
  }

  private updateRunnerVisuals(dt: number): void {
    const p = this.engine.player;
    const r = this.runner;

    r.root.position.set(p.x, p.y, p.z);

    // Contact shadow stays glued to actual ground/roof surface below runner!
    const heightAboveGround = Math.max(0, p.y - p.groundY);
    r.contactShadow.position.y = -heightAboveGround + 0.025;
    const shadowScale = Math.max(0.35, 1 - heightAboveGround * 0.14);
    r.contactShadow.scale.set(shadowScale, shadowScale, 1);

    // Toggle accessories cleanly
    const hoverOn = p.hoverboardTimer > 0;
    const jetOn = p.jetpackTimer > 0;
    r.hoverboard.visible = hoverOn;
    r.shieldAura.visible = hoverOn;
    r.jetpack.visible = jetOn;

    // Squash & stretch + banking lean
    r.bodyGroup.scale.set(p.squashX, p.squashY, p.squashX);
    r.bodyGroup.rotation.z = p.tiltZ;

    if (this.engine.phase === 'title') {
      // Ready parkour idle stance on the tracks
      const breath = Math.sin(this.totalTime * 2.6) * 0.035;
      r.bodyGroup.position.y = 0;
      r.torso.rotation.x = 0.08 + breath;
      r.leftLeg.rotation.x = -0.12;
      r.rightLeg.rotation.x = 0.14;
      r.leftArm.rotation.x = 0.18 + breath;
      r.rightArm.rotation.x = -0.15 - breath;
      r.headGroup.rotation.y = Math.sin(this.totalTime * 0.9) * 0.18;
      return;
    }

    if (jetOn) {
      // Horizontal superhero jetpack flight pose
      r.bodyGroup.position.y = Math.sin(this.totalTime * 8) * 0.08;
      r.torso.rotation.x = -0.58;
      r.leftLeg.rotation.x = 0.45;
      r.rightLeg.rotation.x = 0.35;
      r.leftArm.rotation.x = -0.45;
      r.rightArm.rotation.x = -0.45;
    } else if (hoverOn) {
      // Sideways surfing stance on Hoverboard
      r.bodyGroup.position.y = 0.24 + Math.sin(this.totalTime * 6.5) * 0.06;
      r.torso.rotation.y = 0.55;
      r.torso.rotation.x = -0.12;
      r.leftLeg.rotation.x = 0.18;
      r.rightLeg.rotation.x = -0.18;
      r.leftArm.rotation.z = 0.45;
      r.rightArm.rotation.z = -0.45;
      r.shieldAura.rotation.y += dt * 1.8;
    } else if (p.rolling) {
      // Compact tucked parkour roll
      r.torso.rotation.y = 0;
      r.bodyGroup.position.y = -0.34;
      r.torso.rotation.x = -1.15;
      r.leftLeg.rotation.x = -0.85;
      r.rightLeg.rotation.x = -0.85;
      r.leftArm.rotation.x = -0.9;
      r.rightArm.rotation.x = -0.9;
    } else if (!p.grounded) {
      // Dynamic mid-air leap posture
      r.torso.rotation.y = 0;
      r.bodyGroup.position.y = 0;
      r.torso.rotation.x = -0.18;
      r.leftLeg.rotation.x = -0.62;
      r.rightLeg.rotation.x = 0.48;
      r.leftArm.rotation.x = -0.78;
      r.rightArm.rotation.x = 0.65;
    } else {
      // Distance-synced high-energy sprint cycle
      const stride = Math.sin(p.runCycle);
      const bounce = Math.abs(Math.cos(p.runCycle)) * 0.11;
      r.torso.rotation.y = 0;
      r.bodyGroup.position.y = bounce;
      r.torso.rotation.x = -0.22;
      r.leftArm.rotation.z = 0;
      r.rightArm.rotation.z = 0;
      r.leftLeg.rotation.x = stride * 0.92;
      r.rightLeg.rotation.x = -stride * 0.92;
      r.leftArm.rotation.x = -stride * 0.82;
      r.rightArm.rotation.x = stride * 0.82;
      r.headGroup.rotation.y = 0;
    }
  }

  private updateLightingAndSky(): void {
    const p = this.engine.player;
    const pal = ATMOSPHERE_PRESETS[this.graphics.atmosphere];

    // Keep sky dome & tight shadow frustum centered on runner!
    this.skyDome.position.set(0, 0, p.z);
    this.sunLight.position.set(
      p.x + pal.sunPos[0],
      pal.sunPos[1],
      p.z + pal.sunPos[2],
    );
    this.sunLight.target.position.set(p.x, 0, p.z - 22);
    this.sunLight.target.updateMatrixWorld();

    // Accent point light colors dynamically with Hoverboard / Jetpack
    this.playerAccentLight.position.set(p.x, p.y + 1.25, p.z + 0.8);
    if (p.hoverboardTimer > 0) {
      this.playerAccentLight.color.setHex(0x38bdf8);
      this.playerAccentLight.intensity = 2.8;
    } else if (p.jetpackTimer > 0) {
      this.playerAccentLight.color.setHex(0xff8c24);
      this.playerAccentLight.intensity = 3.2;
    } else {
      this.playerAccentLight.color.setHex(pal.lampColor);
      this.playerAccentLight.intensity = 1.4;
    }
  }

  private updateCamera(dt: number): void {
    const p = this.engine.player;
    const dampPos = 1 - Math.exp(-9.5 * dt);
    const dampLook = 1 - Math.exp(-12.0 * dt);

    if (this.engine.phase === 'title') {
      // Live cinematic hero showcase glide on the gleaming golden-hour subway tracks
      const t = this.totalTime * 0.35;
      _camDesiredPos.set(
        2.9 + Math.sin(t) * 1.4,
        2.75 + Math.cos(t * 0.7) * 0.35,
        5.8 + Math.cos(t * 0.5) * 0.6,
      );
      _camTarget.set(-0.6, 1.9, -22);
      this.camera.position.lerp(_camDesiredPos, 1 - Math.exp(-4.5 * dt));
      _lookCurrent.lerp(_camTarget, 1 - Math.exp(-5.0 * dt));
      this.camera.lookAt(_lookCurrent);
      this.camera.fov += (58 - this.camera.fov) * dampPos;
      this.camera.updateProjectionMatrix();
      return;
    }

    // Active gameplay / gameover chase rig
    const speedRatio = Math.max(0, Math.min(1, (this.engine.speed - 24) / 32));
    const jetBonusY = p.jetpackTimer > 0 ? 1.4 : 0;
    const rollDropY = p.rolling ? -0.45 : 0;

    _camDesiredPos.set(
      p.x * 0.64,
      p.y + 4.25 + jetBonusY + rollDropY,
      p.z + 7.45 + speedRatio * 0.8,
    );

    _camTarget.set(p.x * 0.48, p.y + 1.85 + jetBonusY * 0.35, p.z - 16);

    this.camera.position.lerp(_camDesiredPos, dampPos);
    _lookCurrent.lerp(_camTarget, dampLook);

    // Trauma-squared rotational + positional camera shake on impacts & stumbles
    const shake = this.engine.trauma * this.engine.trauma;
    if (shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.75;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.55;
    }

    this.camera.lookAt(_lookCurrent);
    // Subtle Dutch banking roll synced to runner lane switches
    this.camera.rotation.z += p.tiltZ * 0.16;

    // Dynamic FOV widening with speed + Jetpack thrill
    const targetFov = 62 + speedRatio * 12 + (p.jetpackTimer > 0 ? 6 : 0);
    if (Math.abs(targetFov - this.camera.fov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5.5 * dt));
      this.camera.updateProjectionMatrix();
    }
  }

  public dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.audio.dispose();
    this.particles.dispose();
    this.textures.dispose();
    this.materials.dispose();
    if (this.envMap) this.envMap.dispose();
    if (this.skyTexture) this.skyTexture.dispose();
    this.composer?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
