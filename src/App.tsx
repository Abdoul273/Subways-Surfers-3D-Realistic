import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { SubwaySceneController } from './game/SubwayScene';
import type { GraphicsSettings, HudSnapshot } from './game/types';

const INITIAL_GRAPHICS: GraphicsSettings = {
  atmosphere: 'golden',
  volumetricLights: true,
  particles: true,
  bloom: true,
  dynamicReflections: true,
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  bestScore: 0,
  coins: 0,
  distance: 0,
  speedKmh: 88,
  multiplier: 1,
  hoverboardCharges: 2,
  hoverboardActive: false,
  magnetRatio: 0,
  jetpackRatio: 0,
  sneakersRatio: 0,
  hoverboardRatio: 0,
  stumbleWarning: false,
  runSummary: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SubwaySceneController | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [graphics, setGraphics] = useState<GraphicsSettings>(INITIAL_GRAPHICS);
  const [muted, setMuted] = useState(false);
  const [graphicsPanelOpen, setGraphicsPanelOpen] = useState(false);

  // Sync game state to document.body.dataset.state for accessibility & automated verification
  useEffect(() => {
    document.body.dataset.state = hud.phase;
  }, [hud.phase]);

  // Mount Three.js WebGL controller ONCE in isolated container ref
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';

    const ctrl = new SubwaySceneController(
      mount,
      INITIAL_GRAPHICS,
      (snap) => setHud(snap),
      autostart,
    );
    controllerRef.current = ctrl;

    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    setGraphicsPanelOpen(false);
    document.body.dataset.state = 'playing';
    controllerRef.current?.startRun();
  }, []);

  const handleRestart = useCallback(() => {
    setGraphicsPanelOpen(false);
    document.body.dataset.state = 'playing';
    controllerRef.current?.startRun();
  }, []);

  const handlePauseToggle = useCallback(() => {
    controllerRef.current?.togglePause();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setGraphicsPanelOpen(false);
    controllerRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!controllerRef.current) return;
    setMuted(controllerRef.current.toggleMute());
  }, []);

  const handleUpdateGraphics = useCallback((partial: Partial<GraphicsSettings>) => {
    setGraphics((prev) => {
      const next = { ...prev, ...partial };
      controllerRef.current?.applyGraphicsSettings(next);
      return next;
    });
  }, []);

  const handleActivateHoverboard = useCallback(() => {
    controllerRef.current?.activateHoverboard();
  }, []);

  // Unified PC Keyboard & Pointer Swipe Input Hub (edge-triggered, zero stuck keys)
  useEffect(() => {
    let swipeStartX = 0;
    let swipeStartY = 0;
    let pointerActive = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const ctrl = controllerRef.current;
      if (!ctrl) return;

      const phase = ctrl.engine.phase;
      const code = e.code;

      if (phase === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleStart();
        } else if (code === 'KeyG') {
          setGraphicsPanelOpen((o) => !o);
        }
        return;
      }

      if (phase === 'gameover') {
        if (code === 'Enter' || code === 'Space' || code === 'KeyR') {
          e.preventDefault();
          handleRestart();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        ctrl.togglePause();
        return;
      }

      if (code === 'KeyM') {
        setMuted(ctrl.toggleMute());
        return;
      }

      if (code === 'KeyG') {
        setGraphicsPanelOpen((o) => !o);
        return;
      }

      if (code === 'KeyR' && (phase === 'playing' || phase === 'paused')) {
        e.preventDefault();
        handleRestart();
        return;
      }

      if (phase !== 'playing') return;

      // Support both QWERTY (WASD) and French AZERTY (ZQSD) + Arrow keys!
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') {
        e.preventDefault();
        ctrl.moveLane(-1);
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        e.preventDefault();
        ctrl.moveLane(1);
      } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ' || code === 'Space') {
        e.preventDefault();
        ctrl.jump();
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        ctrl.roll();
      } else if (code === 'KeyE' || code === 'KeyF' || code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        ctrl.activateHoverboard();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('button')) return;
      pointerActive = true;
      swipeStartX = e.clientX;
      swipeStartY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerActive) return;
      pointerActive = false;
      const ctrl = controllerRef.current;
      if (!ctrl || ctrl.engine.phase !== 'playing') return;

      const dx = e.clientX - swipeStartX;
      const dy = e.clientY - swipeStartY;
      if (Math.hypot(dx, dy) < 28) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        ctrl.moveLane(dx > 0 ? 1 : -1);
      } else if (dy < 0) {
        ctrl.jump();
      } else {
        ctrl.roll();
      }
    };

    const onBlur = () => {
      pointerActive = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleRestart, handleStart]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090c12]">
      {/* Isolated Full-Bleed WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        className="w-full h-full"
      />

      {/* Semantic React HUD & Game Shell Overlay */}
      <GameHud
        hud={hud}
        graphics={graphics}
        muted={muted}
        graphicsPanelOpen={graphicsPanelOpen}
        onStart={handleStart}
        onPauseToggle={handlePauseToggle}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
        onToggleMute={handleToggleMute}
        onToggleGraphicsPanel={() => setGraphicsPanelOpen((o) => !o)}
        onUpdateGraphics={handleUpdateGraphics}
        onActivateHoverboard={handleActivateHoverboard}
      />
    </main>
  );
}
