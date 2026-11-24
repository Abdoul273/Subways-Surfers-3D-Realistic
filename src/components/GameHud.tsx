import React from 'react';
import { ATMOSPHERE_PRESETS } from '../game/constants';
import type { AtmospherePreset, GraphicsSettings, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  graphics: GraphicsSettings;
  muted: boolean;
  graphicsPanelOpen: boolean;
  onStart: () => void;
  onPauseToggle: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onToggleMute: () => void;
  onToggleGraphicsPanel: () => void;
  onUpdateGraphics: (next: Partial<GraphicsSettings>) => void;
  onActivateHoverboard: () => void;
}

const ATMOSPHERE_KEYS: AtmospherePreset[] = ['golden', 'rainy', 'dawn'];

function CoinIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#92400e" stroke="#0b0f17" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="8" fill="#f59e0b" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#fef3c7" strokeWidth="1.4" />
      <path d="M12 8.2v7.6M9.6 10.5l2.4-2.3 2.4 2.3" stroke="#78350f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function ShieldBoardIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5 14.5c2-4.5 12-4.5 14 0l-1.5 2.6c-2.5-1.2-8.5-1.2-11 0L5 14.5z"
        fill="#0284c7"
        stroke="#e0f2fe"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.5 11.2h7" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="17.5" r="1.4" fill="#38bdf8" />
      <circle cx="15" cy="17.5" r="1.4" fill="#38bdf8" />
    </svg>
  );
}

function TitleEmblem() {
  return (
    <svg
      viewBox="0 0 460 118"
      className="w-[340px] sm:w-[440px] h-auto drop-shadow-[0_10px_28px_rgba(0,0,0,0.85)]"
      role="img"
      aria-label="METRO RUSH 3D"
    >
      <defs>
        <linearGradient id="mrSteel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="52%" stopColor="#dbe4f0" />
          <stop offset="100%" stopColor="#8fa1b8" />
        </linearGradient>
        <linearGradient id="mrAmber" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {/* Transit Track Rail Accent Bars */}
      <path d="M10 18 L188 18 L178 24 L4 24 Z" fill="url(#mrAmber)" />
      <path d="M196 18 L244 18 L238 24 L190 24 Z" fill="#38bdf8" />

      {/* Main Kinetic Display Wordmark */}
      <text
        x="8"
        y="76"
        fill="url(#mrSteel)"
        stroke="#0a0e16"
        strokeWidth="5"
        paintOrder="stroke fill"
        fontFamily="Oxanium, sans-serif"
        fontWeight="800"
        fontSize="60"
        letterSpacing="2"
      >
        METRO
      </text>
      <text
        x="234"
        y="76"
        fill="url(#mrAmber)"
        stroke="#0a0e16"
        strokeWidth="5"
        paintOrder="stroke fill"
        fontFamily="Oxanium, sans-serif"
        fontWeight="800"
        fontSize="60"
        letterSpacing="2"
      >
        RUSH
      </text>

      {/* Bottom Metro Line Track */}
      <path d="M8 94 L420 94 L408 100 L8 100 Z" fill="#1e293b" />
      <path d="M8 94 L165 94 L158 100 L8 100 Z" fill="#f59e0b" />
      <text
        x="10"
        y="114"
        fill="#cbd5e1"
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="600"
        fontSize="13"
        letterSpacing="3.4"
      >
        EXPRESS URBAIN 3D · ÉDITION PC
      </text>
    </svg>
  );
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  graphics,
  muted,
  graphicsPanelOpen,
  onStart,
  onPauseToggle,
  onRestart,
  onReturnTitle,
  onToggleMute,
  onToggleGraphicsPanel,
  onUpdateGraphics,
  onActivateHoverboard,
}) => {
  const isTitle = hud.phase === 'title';
  const isPlaying = hud.phase === 'playing';
  const isPaused = hud.phase === 'paused';
  const isGameOver = hud.phase === 'gameover';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* ================================================================= */}
      {/* TITLE SCREEN OVERLAY (Asymmetric Left-Third Negative Space)       */}
      {/* ================================================================= */}
      {isTitle && (
        <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-10">
          {/* Subtle top-left & bottom readability scrims (no backdrop-filter over WebGL) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, rgba(7,10,16,0.80) 0%, rgba(7,10,16,0.34) 44%, rgba(7,10,16,0.0) 72%), linear-gradient(to top, rgba(7,10,16,0.78) 0%, rgba(7,10,16,0.0) 16%)',
            }}
          />

          {/* Top-Left Title Emblem & Primary CTA */}
          <div className="relative z-10 mt-6 sm:mt-12 max-w-lg flex flex-col items-start gap-6">
            <TitleEmblem />

            <p className="text-sm sm:text-base text-slate-200/90 max-w-md leading-relaxed hud-label">
              Foncez sur les voies mouillées du métro urbain sous un éclairage volumétrique dynamique.
              Enchaînez les toits de rames, esquivez les trains lancés à pleine vitesse et maîtrisez l&apos;Hoverboard.
            </p>

            {/* Primary Start Action + Atmosphere Switcher (<= 3 menu actions) */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onStart();
                }}
                className="font-display cursor-pointer px-8 py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-extrabold text-lg tracking-wider shadow-[0_10px_28px_rgba(245,158,11,0.38)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0"
              >
                JOUER
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleGraphicsPanel();
                }}
                aria-expanded={graphicsPanelOpen}
                className="cursor-pointer px-5 py-3.5 rounded-md bg-[rgba(12,17,27,0.86)] hover:bg-[rgba(22,30,46,0.94)] border border-white/15 text-slate-100 font-semibold text-sm tracking-wide transition-colors whitespace-nowrap shrink-0"
              >
                Graphismes · {ATMOSPHERE_PRESETS[graphics.atmosphere].label}
              </button>
            </div>

            {hud.bestScore > 0 && (
              <div className="flex items-center gap-3 text-sm text-slate-300 hud-label">
                <span>Record personnel</span>
                <span aria-hidden="true">·</span>
                <span className="hud-num text-amber-400 font-bold text-base">
                  {hud.bestScore.toLocaleString('fr-FR')}
                </span>
              </div>
            )}
          </div>

          {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
          <div className="relative z-10 flex items-center justify-between gap-4 text-xs sm:text-sm text-slate-200/85 hud-label">
            <div className="truncate">
              A/D ou ←/→ Voies · Espace ou ↑ Sauter · S ou ↓ Rouler / Piquer · E Hoverboard · Échap Pause
            </div>
            <div className="hidden md:block text-slate-300/80 whitespace-nowrap shrink-0">
              Entrée ou Espace pour démarrer
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ACTIVE PLAYING HUD (Perimeter Corners Only — >88% Clear Center)   */}
      {/* ================================================================= */}
      {(isPlaying || isPaused) && (
        <>
          <div className="w-full flex items-start justify-between p-4 sm:p-6">
            {/* Top-Left Cluster: Hero Score, Multiplier, Coins, Active Power-ups */}
            <div className="flex flex-col gap-3">
              <div className="bg-[rgba(9,13,22,0.82)] border border-white/12 rounded-lg px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                <div className="flex items-baseline gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
                      Score
                    </div>
                    <div
                      data-testid="hud-score"
                      className="hud-num text-3xl sm:text-4xl font-extrabold text-white leading-none"
                    >
                      {hud.score.toLocaleString('fr-FR')}
                    </div>
                  </div>
                  <div className="border-l border-white/15 pl-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-amber-400/90 font-semibold">
                      Mult
                    </div>
                    <div className="hud-num text-xl font-bold text-amber-400 leading-none">
                      x{hud.multiplier}
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CoinIcon className="w-4 h-4 shrink-0" />
                    <span data-testid="hud-coins" className="hud-num font-bold text-amber-300">
                      {hud.coins}
                    </span>
                  </div>
                  <span className="text-slate-600" aria-hidden="true">
                    /
                  </span>
                  <div className="text-slate-300 hud-num font-semibold">
                    {hud.distance} m
                  </div>
                </div>
              </div>

              {/* Hoverboard Ready / Active Action Slot */}
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onActivateHoverboard();
                  }}
                  disabled={hud.hoverboardCharges <= 0 && !hud.hoverboardActive}
                  aria-label="Activer l'Hoverboard (touche E)"
                  className={`cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                    hud.hoverboardActive
                      ? 'bg-[rgba(2,132,199,0.88)] border-sky-300/60 text-white'
                      : hud.hoverboardCharges > 0
                        ? 'bg-[rgba(9,13,22,0.84)] hover:bg-[rgba(18,26,42,0.94)] border-white/15 text-slate-100'
                        : 'bg-[rgba(9,13,22,0.55)] border-white/8 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <ShieldBoardIcon className="w-5 h-5 shrink-0" />
                  <div className="leading-tight">
                    <div className="text-xs font-bold whitespace-nowrap">
                      Hoverboard [E]
                    </div>
                    <div className="text-[11px] text-slate-300 hud-num">
                      {hud.hoverboardActive
                        ? 'Bouclier actif'
                        : `${hud.hoverboardCharges} dispo`}
                    </div>
                  </div>
                </button>
              </div>

              {/* Active Power-Up Depleting Timers */}
              <div className="flex flex-col gap-1.5 w-48">
                {hud.hoverboardRatio > 0 && (
                  <PowerBar label="Hoverboard" ratio={hud.hoverboardRatio} color="#38bdf8" />
                )}
                {hud.jetpackRatio > 0 && (
                  <PowerBar label="Jetpack Turbo" ratio={hud.jetpackRatio} color="#f97316" />
                )}
                {hud.magnetRatio > 0 && (
                  <PowerBar label="Aimant Pièces" ratio={hud.magnetRatio} color="#ef4444" />
                )}
                {hud.sneakersRatio > 0 && (
                  <PowerBar label="Super Baskets" ratio={hud.sneakersRatio} color="#22c55e" />
                )}
              </div>
            </div>

            {/* Top-Right Cluster: Speed Readout + Utility Icon Buttons */}
            <div className="flex flex-col items-end gap-2.5">
              <div className="pointer-events-auto flex items-center gap-2">
                <div className="bg-[rgba(9,13,22,0.82)] border border-white/12 rounded-lg px-3.5 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
                    Vitesse
                  </div>
                  <div className="hud-num text-xl font-extrabold text-sky-300 leading-none">
                    {hud.speedKmh} <span className="text-xs font-semibold text-slate-400">km/h</span>
                  </div>
                </div>

                <IconUtilityButton
                  label="Réglages graphiques (G)"
                  active={graphicsPanelOpen}
                  onClick={onToggleGraphicsPanel}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" strokeLinecap="round" />
                  </svg>
                </IconUtilityButton>

                <IconUtilityButton
                  label={muted ? 'Activer le son (M)' : 'Couper le son (M)'}
                  active={false}
                  onClick={onToggleMute}
                >
                  {muted ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </IconUtilityButton>

                <IconUtilityButton
                  label="Pause (P ou Échap)"
                  active={isPaused}
                  onClick={onPauseToggle}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <rect x="6.5" y="5" width="4" height="14" rx="1" />
                    <rect x="13.5" y="5" width="4" height="14" rx="1" />
                  </svg>
                </IconUtilityButton>

                <IconUtilityButton
                  label="Recommencer (R)"
                  active={false}
                  onClick={onRestart}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12a8 8 0 102.3-5.6L4 8.5M4 4v4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </IconUtilityButton>
              </div>

              {hud.stumbleWarning && (
                <div className="bg-[rgba(185,28,28,0.88)] border border-red-400/50 rounded-md px-3 py-1 text-xs font-bold tracking-wide text-white">
                  Alerte · Contrôleur juste derrière !
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* COLLAPSIBLE BOTTOM GRAPHICS DOCK (Zero side-panel occlusion)      */}
      {/* ================================================================= */}
      {graphicsPanelOpen && !isGameOver && (
        <div className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[min(940px,95vw)] bg-[rgba(10,14,23,0.95)] border border-white/15 rounded-xl px-5 py-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.76)]">
          <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-white/10">
            <div className="text-sm font-bold text-white tracking-wide whitespace-nowrap">
              Rendu Graphique PC &amp; Ambiance
            </div>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleGraphicsPanel();
              }}
              className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded bg-white/8 hover:bg-white/14 transition-colors whitespace-nowrap shrink-0"
            >
              Fermer [G]
            </button>
          </div>

          <div className="mt-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
            {/* Atmosphere Lighting Selector */}
            <div className="flex items-center gap-1.5 shrink-0">
              {ATMOSPHERE_KEYS.map((key) => {
                const active = graphics.atmosphere === key;
                return (
                  <button
                    key={key}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onUpdateGraphics({ atmosphere: key });
                    }}
                    className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-white/8 text-slate-200 hover:bg-white/14'
                    }`}
                  >
                    {ATMOSPHERE_PRESETS[key].label}
                  </button>
                );
              })}
            </div>

            {/* Shader / Effect Toggles */}
            <div className="flex items-center gap-1.5 shrink-0">
              <GraphicsToggle
                label="Volumétrique"
                checked={graphics.volumetricLights}
                onChange={(v) => onUpdateGraphics({ volumetricLights: v })}
              />
              <GraphicsToggle
                label="Reflets PBR"
                checked={graphics.dynamicReflections}
                onChange={(v) => onUpdateGraphics({ dynamicReflections: v })}
              />
              <GraphicsToggle
                label="Particules"
                checked={graphics.particles}
                onChange={(v) => onUpdateGraphics({ particles: v })}
              />
              <GraphicsToggle
                label="Bloom"
                checked={graphics.bloom}
                onChange={(v) => onUpdateGraphics({ bloom: v })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* PAUSE MODAL                                                       */}
      {/* ================================================================= */}
      {isPaused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jeu en pause"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,15,0.68)] p-4"
        >
          <div className="w-full max-w-md bg-[rgba(12,17,28,0.96)] border border-white/15 rounded-xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
            <h2 className="font-display text-3xl font-extrabold text-white tracking-wide">
              PAUSE
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Course suspendue · {hud.distance} m parcourus
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatTile label="Score" value={hud.score.toLocaleString('fr-FR')} />
              <StatTile label="Pièces" value={String(hud.coins)} accent="text-amber-300" />
              <StatTile label="Vitesse" value={`${hud.speedKmh} km/h`} accent="text-sky-300" />
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseToggle();
                }}
                className="font-display cursor-pointer w-full py-3 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base tracking-wider transition-colors"
              >
                REPRENDRE
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onRestart();
                  }}
                  className="cursor-pointer py-2.5 rounded-md bg-white/10 hover:bg-white/16 text-slate-100 font-semibold text-sm transition-colors"
                >
                  Recommencer
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onReturnTitle();
                  }}
                  className="cursor-pointer py-2.5 rounded-md bg-white/8 hover:bg-white/14 text-slate-300 font-semibold text-sm transition-colors"
                >
                  Menu principal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* GAME OVER MODAL                                                   */}
      {/* ================================================================= */}
      {isGameOver && hud.runSummary && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fin de partie"
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(6,9,15,0.74)] p-4"
        >
          <div className="w-full max-w-md bg-[rgba(12,17,28,0.97)] border border-white/15 rounded-xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.82)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-3xl font-extrabold text-white tracking-wide">
                FIN DE COURSE
              </h2>
              {hud.runSummary.isNewBest && (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Nouveau Record
                </span>
              )}
            </div>

            <div className="mt-4 bg-[rgba(7,10,18,0.8)] border border-white/10 rounded-lg p-4 flex items-baseline justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
                  Score Final
                </div>
                <div className="hud-num text-4xl font-extrabold text-amber-400">
                  {hud.runSummary.score.toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
                  Record
                </div>
                <div className="hud-num text-xl font-bold text-slate-200">
                  {hud.runSummary.bestScore.toLocaleString('fr-FR')}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <StatTile label="Distance" value={`${hud.runSummary.distance} m`} />
              <StatTile label="Pièces" value={String(hud.runSummary.coins)} accent="text-amber-300" />
              <StatTile
                label="Vitesse Max"
                value={`${hud.runSummary.maxSpeedKmh} km/h`}
                accent="text-sky-300"
              />
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRestart();
                }}
                className="font-display cursor-pointer w-full py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base tracking-wider transition-colors"
              >
                REJOUER
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onReturnTitle();
                }}
                className="cursor-pointer w-full py-2.5 rounded-md bg-white/8 hover:bg-white/14 text-slate-300 font-semibold text-sm transition-colors"
              >
                Retour au menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function PowerBar({ label, ratio, color }: { label: string; ratio: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="bg-[rgba(9,13,22,0.82)] border border-white/12 rounded-md px-2.5 py-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
        <span>{label}</span>
        <span className="hud-num text-slate-400">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-transform duration-75 origin-left"
          style={{
            backgroundColor: color,
            transform: `scaleX(${Math.max(0.02, Math.min(1, ratio))})`,
          }}
        />
      </div>
    </div>
  );
}

function IconUtilityButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      className={`cursor-pointer w-11 h-11 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
        active
          ? 'bg-amber-500 border-amber-400 text-slate-950'
          : 'bg-[rgba(9,13,22,0.84)] hover:bg-[rgba(20,28,44,0.94)] border-white/15 text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function GraphicsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={checked}
      onClick={(e) => {
        e.currentTarget.blur();
        onChange(!checked);
      }}
      className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
        checked
          ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
          : 'bg-white/5 border-white/12 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label} · {checked ? 'ON' : 'OFF'}
    </button>
  );
}

function StatTile({
  label,
  value,
  accent = 'text-white',
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-[rgba(7,10,18,0.75)] border border-white/10 rounded-lg px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-semibold">
        {label}
      </div>
      <div className={`hud-num text-lg font-bold mt-0.5 ${accent}`}>{value}</div>
    </div>
  );
}
