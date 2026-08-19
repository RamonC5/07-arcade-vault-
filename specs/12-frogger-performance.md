# SPEC 12 — Performance de Frogger

> **Estado:** Aprobado
> **Depende de:** game-jam/frogger/01-frogger-core
> **Fecha:** 2026-08-19
> **Objetivo:** Mejorar el frame rate de Frogger extrayendo su loop a un hook
> reutilizable y reduciendo las escrituras de `shadowBlur` del skin Neon, y
> pausar el fondo animado global (`.av-bg`/`.av-noise`) en todas las rutas
> `*/play` para que no compita por rendimiento con el canvas del juego.

---

## Por qué existe este spec

El usuario reportó FPS bajos / animación entrecortada en Frogger, presente
desde siempre (no es una regresión reciente). Investigación con exploración
en paralelo (Frogger específico + resto de juegos y capas compartidas) más
lectura directa de `app/layout.tsx`, `app/globals.css` y el loop de
`FroggerGame.tsx` identificó tres causas concretas:

1. **Fondo animado global siempre activo** (`app/layout.tsx:20-21`,
   `app/globals.css:60-125`): `<div className="av-bg" />` y
   `<div className="av-noise" />` se renderizan sin condición en el
   `RootLayout`, en todas las rutas. `.av-bg::before` corre una animación
   CSS perpetua (`gridscroll 8s linear infinite`, transform
   `perspective`+`rotateX`) y `.av-noise` es una capa fija con filtro SVG
   `feTurbulence`. Ambas compiten por tiempo de compositor/GPU con el
   canvas de Frogger, que ya pinta a 60fps vía `requestAnimationFrame`. Es
   la única causa realmente compartida entre todos los juegos, porque es
   el mismo código, montado siempre, sin importar qué juego esté activo.
2. **`shadowBlur`/`shadowColor` del skin "Neon"** se activan y desactivan
   decenas de veces por frame en `FroggerGame.tsx` (`applyGlow`/
   `clearGlow`, líneas 185-193, invocado desde `drawGoals` 432-457,
   `drawRoadEntities` 459-514, `drawRiverEntities` 516-574 y `drawFrog`
   576-624 — unos 60-75 toggles/frame). `shadowBlur` es una de las
   operaciones más caras de Canvas2D. Solo afecta a quien juega con el
   skin Neon.
3. Ruido menor de GC: `drawRoadEntities` (línea ~486) crea un array de 2
   elementos y una closure `forEach` por cada coche, cada frame.

Se descartó como causa el loop de Frogger en sí: está bien construido
(estado en `useRef`, no en `useState` → el componente no re-renderiza por
frame; delta-time real vía `performance.now()` con clamp a 50ms; un único
listener `keydown` con cleanup correcto; colisiones O(n) triviales; sin
`setInterval`, sin audio, sin sprites). No hay fugas de listeners ni
`setInterval` apilándose, y el manejo de `devicePixelRatio`/resize
(ausente) es una convención existente en todo el repo, no una regresión.

---

## Scope

**In:**

- Nuevo hook `lib/games/useGameLoop.ts` (RAF loop reutilizable:
  delta-time clamp a 50ms, pausable, cleanup en unmount) portando tal
  cual la lógica ya probada del loop de Frogger.
- `components/games/FroggerGame.tsx`: migrar su loop inline (líneas
  858-872) a `useGameLoop`.
- `components/games/FroggerGame.tsx`: optimizar `applyGlow`/`clearGlow`
  (líneas 185-193) y sus call sites en `drawGoals`, `drawRoadEntities`,
  `drawRiverEntities` y `drawFrog` para deduplicar escrituras de
  `shadowBlur`/`shadowColor`, manteniendo el aspecto visual del skin
  Neon.
- `components/games/FroggerGame.tsx`: limpiar la asignación de
  array/closure por frame en `drawRoadEntities` (línea ~486).
- Nuevo componente cliente `components/AnimatedBackground.tsx` que
  encapsula `.av-bg`/`.av-noise` y usa `usePathname()` para no
  renderizarlas cuando la ruta termina en `/play`.
- `app/layout.tsx`: sustituir el markup estático de `.av-bg`/`.av-noise`
  por `<AnimatedBackground />`.

**Out of scope (for future specs):**

- Migrar Snake/Tetris/Arkanoid/Asteroids al hook `useGameLoop`.
- Optimizar el patrón `shadowBlur` del skin Neon en los otros 4 juegos
  (mismo patrón detectado, pero fuera de alcance aquí).
- Cacheo de líneas de grid en Snake/Tetris (no aplica a Frogger).
- Manejo de `devicePixelRatio`/resize (convención existente en todo el
  repo, no es una regresión de Frogger).
- Rediseño visual del skin Neon o de `.av-bg`/`.av-noise`.
- `.game-arena`/`.grid-floor` de `app/games/[id]/play/page.tsx` (maqueta
  decorativa de la ruta dinámica genérica; no se usa en la ruta real de
  Frogger).

---

## Data model

Esta feature no introduce estructuras de datos persistidas nuevas (no toca
Supabase ni localStorage).

Sí introduce el contrato del nuevo hook compartido:

```ts
// lib/games/useGameLoop.ts
type UseGameLoopCallbacks = {
  update: (dt: number) => void;      // dt en ms, ya clamped a 50ms máx.
  draw: () => void;                  // se llama siempre, incluso en pausa
  isPaused: () => boolean;           // se consulta cada frame
  shouldContinue: () => boolean;     // false detiene el loop (ej. game over)
};

function useGameLoop(callbacks: UseGameLoopCallbacks): void;
```

Comportamiento interno (portado tal cual del loop actual de Frogger):
`dt = Math.min(now - lastTime, 50)` → si `!isPaused()` se llama
`update(dt)` → siempre se llama `draw()` → si `!shouldContinue()` se
detiene el loop, si no se agenda el siguiente `requestAnimationFrame`.
`cancelAnimationFrame` se ejecuta en el cleanup del `useEffect` que llama
al hook.

---

## Implementation plan

1. Crear `lib/games/useGameLoop.ts` con el hook `useGameLoop` (contrato ya
   definido en Data model). No se usa todavía en ningún juego — el sistema
   sigue funcionando exactamente igual que antes.
2. Migrar `components/games/FroggerGame.tsx` para usar `useGameLoop` en vez
   de su `useEffect` con loop inline (líneas 858-900), pasando
   `isPaused: () => pausedRef.current` y
   `shouldContinue: () => !stateRef.current.gameOver`.
   Prueba manual: jugar una ronda de Frogger en skin classic y confirmar que
   se comporta igual que antes (movimiento, pausa, game over).
3. Optimizar `applyGlow`/`clearGlow` en `FroggerGame.tsx` para deduplicar
   escrituras de `shadowBlur`/`shadowColor` (rastrear el último valor
   aplicado y solo reescribir cuando cambia).
   Prueba manual: cambiar a skin Neon y confirmar visualmente que el glow
   se ve igual que antes.
4. Limpiar la asignación de array/closure por frame en `drawRoadEntities`
   (línea ~486), sustituyendo el `[x+8, x+w-8].forEach(...)` por un `for`
   simple con los offsets ya calculados.
   Prueba manual: confirmar que los coches se siguen dibujando igual.
5. Crear `components/AnimatedBackground.tsx` (client component) que
   renderiza `.av-bg`/`.av-noise` salvo cuando `usePathname()` termina en
   `/play`. Todavía no se integra en `app/layout.tsx` — el sistema sigue
   igual que antes.
6. Integrar `<AnimatedBackground />` en `app/layout.tsx`, reemplazando el
   markup estático de `.av-bg`/`.av-noise`.
   Prueba manual: navegar a `/`, `/about`, `/games`, `/hall-of-fame` y
   confirmar que el fondo sigue apareciendo; navegar a
   `/games/frogger/play` (y a `/games/snake/play`, `/games/tetris/play`,
   etc.) y confirmar que el fondo desaparece.

---

## Acceptance criteria

- [ ] `lib/games/useGameLoop.ts` existe y exporta el hook `useGameLoop` con el contrato definido en Data model.
- [ ] `components/games/FroggerGame.tsx` no contiene ningún `requestAnimationFrame`/`cancelAnimationFrame` inline; su loop pasa por `useGameLoop`.
- [ ] Jugando Frogger con skin classic, el movimiento del frog, la pausa (congela movimiento, sigue dibujando), las colisiones y el game over se comportan igual que antes del cambio.
- [ ] Jugando Frogger con skin Neon, el glow sigue siendo visible en rana, vehículos, troncos y metas.
- [ ] `.av-bg` y `.av-noise` no están presentes en el DOM en `/games/frogger/play`, `/games/snake/play`, `/games/tetris/play` y `/games/arkanoid/play`.
- [ ] `.av-bg` y `.av-noise` sí están presentes en `/`, `/about`, `/games`, `/games/frogger` y `/hall-of-fame`.
- [ ] El gamepad móvil (táctil) de Frogger sigue moviendo al frog correctamente tras el cambio.
- [ ] No aparecen errores ni warnings nuevos en la consola del navegador al jugar Frogger.
- [ ] El diff de la implementación no modifica `SnakeGame.tsx`, `TetrisGame.tsx`, `ArkanoidGame.tsx` ni `AsteroidsGame.tsx`.

---

## Decisiones

- **Sí:** alcance limitado a Frogger + las dos piezas de infraestructura
  compartida (hook `useGameLoop` y pausa del fondo animado), en vez de un
  spec transversal a los 5 juegos. Reduce riesgo y entrega la ganancia de
  mayor impacto ahora.
- **Sí:** extraer `lib/games/useGameLoop.ts` como hook reutilizable, pero
  solo Frogger se migra a él en este spec. Migrar Snake/Tetris/Arkanoid/
  Asteroids se difiere a un spec futuro para mantener este cambio
  revisable.
- **Sí:** pausar/ocultar `.av-bg`/`.av-noise` en TODAS las rutas `*/play`
  (no solo `/games/frogger/play`). El código vive en `app/layout.tsx`
  (infraestructura compartida) y condicionarlo por ruta específica de un
  juego añadiría complejidad sin beneficio; el resto de juegos se
  benefician como efecto colateral aprobado, sin tocar sus archivos.
- **Sí:** optimizar el glow del skin Neon deduplicando escrituras de
  `shadowBlur`, en vez de eliminarlo. El efecto visual debe conservarse.
- **No:** spec transversal tocando el patrón `shadowBlur` y el grid
  cacheado en los 5 juegos — se prefirió acotar a Frogger primero.
- **No:** condicionar la pausa del fondo solo a `/games/frogger/play` — se
  prefirió la regla simple `*/play`.
- **No:** abordar `devicePixelRatio`/resize en este spec — es una
  convención existente en todo el repo, no una regresión de Frogger.

---

## Risks

| Riesgo                                                                                                    | Mitigación                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Portar el loop al hook altera sutilmente el timing de delta/pausa                                          | Copiar literal la lógica de clamp (`Math.min(now - lastTime, 50)`) y de pausa existente; verificar con el playtest manual del paso 2. |
| Ocultar `.av-bg`/`.av-noise` en todas las rutas `*/play` cambia el aspecto visual de las páginas de juego de Snake/Tetris/Arkanoid/Asteroids sin tocar su código | Es un efecto colateral aprobado explícitamente (ver Decisiones); queda documentado aquí para que no sorprenda en revisión. |
| Deduplicar `shadowBlur` altera el aspecto del glow si no se hace con cuidado (ej. no resetear `shadowColor`) | Verificación visual del skin Neon tras el cambio (paso 3 del plan de implementación).                            |

---

## Notas de implementación

Decisiones técnicas tomadas durante los pasos 1-6, no explícitas en el
resto del spec:

- **Paso 1 (`useGameLoop`):** los callbacks (`update`/`draw`/`isPaused`/
  `shouldContinue`) se leen desde un `ref` que se reasigna en cada
  render, y el `requestAnimationFrame` vive en un único `useEffect`
  interno del hook con deps `[]`. Así el hook se puede llamar desde el
  nivel superior de un componente (no anidado en un único efecto de
  montaje) sin reiniciar el loop cada vez que cambian las identidades de
  las funciones recibidas.
- **Paso 2 (migración del loop de Frogger):** `update`/`draw` siguen
  definidas dentro del `useEffect` original de setup (el que crea `ctx`,
  el listener de teclado, `killFrog`, `resolveLanding`, etc.) — no se
  reestructuró ese efecto. En vez de eso, se agregaron `updateRef`/
  `drawRef` que ese efecto rellena, y `useGameLoop(...)` se llama justo
  después de dicho efecto en el cuerpo del componente. Esto funciona
  porque React ejecuta los `useEffect` de un componente en orden de
  declaración tras el commit: el efecto de setup rellena las refs antes
  de que el efecto interno de `useGameLoop` dispare el primer
  `requestAnimationFrame`.
- **Paso 3 (dedupe de `shadowBlur`/`shadowColor`):** implementado con un
  `WeakMap<CanvasRenderingContext2D, { color, blur }>` a nivel de
  módulo (no una variable simple), para que cada `ctx` tenga su propio
  "último valor aplicado" y un remount de `FroggerGame` no herede
  estado de una instancia anterior ya desmontada. No hizo falta tocar
  la firma de `applyGlow`/`clearGlow` ni ninguno de sus 4 call sites
  (`drawGoals`, `drawRoadEntities`, `drawRiverEntities`, `drawFrog`).
- **Paso 4 (`drawRoadEntities`):** el `[x + 8, x + w - 8].forEach(...)`
  se reemplazó por un `for` sobre dos offsets precalculados
  (`wheelXLeft`/`wheelXRight`), tal como pedía el plan — sin tocar los
  otros `forEach` del archivo (`GOAL_STARTS.forEach`,
  `lane.entities.forEach`), que iteran sobre arrays ya existentes y no
  crean uno nuevo por frame.
- **Pasos 5-6 (`AnimatedBackground`):** la detección de ruta reutiliza
  el patrón `pathname.endsWith('/play')` ya existente en
  `components/Nav.tsx` (`isPlayPage`) en vez de introducir una
  convención nueva.

---

## What is **not** in this spec

- Migrar Snake/Tetris/Arkanoid/Asteroids al hook `useGameLoop`.
- Optimizar el patrón `shadowBlur` del skin Neon en los otros 4 juegos.
- Cacheo de líneas de grid en Snake/Tetris.
- Manejo de `devicePixelRatio`/resize en ningún juego.
- Rediseño visual del skin Neon o de `.av-bg`/`.av-noise`.
- Cambios en `.game-arena`/`.grid-floor` de `app/games/[id]/play/page.tsx`.

Cada uno de estos, si se aborda, va en su propio spec.
