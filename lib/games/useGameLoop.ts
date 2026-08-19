import { useEffect, useRef } from 'react';

export type UseGameLoopCallbacks = {
  /** dt en ms, ya clamped a 50ms máx. */
  update: (dt: number) => void;
  /** Se llama siempre, incluso en pausa. */
  draw: () => void;
  /** Se consulta cada frame. */
  isPaused: () => boolean;
  /** false detiene el loop (ej. game over). */
  shouldContinue: () => boolean;
};

/**
 * Loop de juego reutilizable basado en requestAnimationFrame.
 *
 * Porta tal cual la lógica ya probada del loop de Frogger: delta-time
 * clamped a 50ms, pausable vía `isPaused`, y detenible vía
 * `shouldContinue`. `draw` se invoca siempre (incluso en pausa) para que
 * la escena no se congele en un frame parcial.
 *
 * Los callbacks se leen desde un ref actualizado en cada render, así que
 * el efecto que arranca el loop se monta una única vez (cleanup ejecuta
 * `cancelAnimationFrame`) sin necesidad de reiniciarlo cuando cambian las
 * identidades de las funciones recibidas.
 */
export function useGameLoop(callbacks: UseGameLoopCallbacks): void {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    function loop(now: number) {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      const { update, draw, isPaused, shouldContinue } = callbacksRef.current;
      if (!isPaused()) update(dt);
      draw();
      if (shouldContinue()) {
        rafId = requestAnimationFrame(loop);
      }
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
