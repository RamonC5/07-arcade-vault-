---
name: spec-impl-game
description: Implementa un spec de juego aprobado (mismo flujo que /spec-impl: valida estado Aprobado, crea rama, implementa paso a paso) y, tras confirmar que los criterios de aceptación pasan, encadena automáticamente skin-designer y luego mobile-porter, en secuencia estricta, sobre el juego recién implementado.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer of approved game specs + skins + mobile

This is `/spec-impl` (see `.claude/skills/spec-impl/SKILL.md`) with the exact same Phases 1–4, plus a new Phase 5 that automatically chains the `skin-designer` and `mobile-porter` agents — in that order, never in parallel — once the user confirms the spec's acceptance criteria pass.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase if the previous one did not complete correctly.**

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name (`01-mvp-arkanoid`), only the number (`01`), only the slug (`mvp-arkanoid`), or a path under `specs/game-jam/<game-id>/`. Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the file of the spec you found:
!`cat specs/$ARGUMENTS.md 2>/dev/null || echo "FILE_NOT_FOUND"`

In the file's contents, look for the line that contains the spec's state. The header label is typically `**Status:**` (English) or `**Estado:**` (Spanish), but it may use any language. Match by position (status line near the top of the spec) and by the surrounding state machine, not by the exact label.

**Absolute rule:** You can only continue if the state **means "Approved"** — regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the **Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, Propuesto, or any unrecognized value) means **stop** and show the error message below.

| State category                            | Examples (any language)                           | Action                                                                     |
| ------------------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft / Propuesto                         | `Draft`, `Borrador`, `Propuesto`, …               | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want". The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

1. Derive the branch name from the spec file's full name, without the extension. Format: `spec-NN-slug`. Examples:

   - `01-mvp-arkanoid.md` → branch `spec-01-mvp-arkanoid`
   - `game-jam/frogger/01-frogger-core.md` → branch `spec-frogger-core` (drop the `game-jam/` prefix, keep the meaningful slug)

2. Check whether the branch already exists:

   - If it **does not exist**: create it with `git checkout -b spec-NN-slug`.
   - If it **already exists**: inform the user that the branch already existed (it may mean previous work is being resumed).
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and confirm the change was successful before continuing.

3. Visually confirm to the user that the branch was created and that you are on it:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)
   State:  Approved   (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` / `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps — `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist — `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be authored in any language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do not start without it.

Once confirmed, follow these rules during the entire implementation:

**One rule above all:** implement what the spec says. If something in the spec looks suboptimal to you, mention it as an observation but implement what was agreed. Changes to the spec go into the spec, not into the code by surprise.

**Work rhythm:**

- Implement one step of the plan.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step**, unlike plain `/spec-impl`, do not just remind the user to verify acceptance criteria — also tell them what happens next in Phase 5:

```
✅ Todos los pasos del plan de implementación están completos.

Siguiente paso: verifica los criterios de aceptación del spec uno por uno.

Cuando confirmes que todos pasan (y hayas actualizado el estado del spec a "Implementado"
o equivalente), continuaré automáticamente con:
  1. skin-designer  → aplica los skins classic/retro/neon a <juego>
  2. mobile-porter  → añade controles táctiles mobile a <juego>

En secuencia, uno después del otro — nunca en paralelo.

¿Confirmas que los criterios de aceptación pasan y seguimos?
```

Wait for explicit confirmation before moving to Phase 5. Do not advance without it.

---

### Phase 5 — Encadenar skin-designer → mobile-porter

Se ejecuta **solo** tras la confirmación explícita del usuario, al final de la Fase 4, de que los criterios de aceptación pasan.

**Regla dura: nunca invoques skin-designer y mobile-porter en paralelo ni en la misma respuesta.** Son dos invocaciones del tool Agent separadas y secuenciales — espera el reporte final completo de la primera antes de lanzar la segunda.

1. **Determina el juego objetivo** sin volver a preguntar al usuario si es posible:
   - Ejecuta `git status --short` (ya autorizado) y localiza el archivo nuevo/modificado bajo `components/games/` creado durante la Fase 4.
   - Deriva `<Game>` (nombre del componente, ej. `Frogger`) y `<juego-id>` (slug de ruta usado en `app/games/<juego-id>/`, tomado del INSERT SQL del Data model del spec o de la carpeta creada bajo `app/games/`).
   - Si no puedes determinarlo sin ambigüedad (por ejemplo, el spec no creó ningún archivo en `components/games/`), detente y pregúntale al usuario el nombre exacto del juego antes de continuar — nunca lo adivines.

2. **Invoca skin-designer primero.** Usa el tool Agent con `subagent_type: "skin-designer"` y `run_in_background: false` (debe ejecutarse de forma bloqueante — necesitas su resultado antes de continuar). En el prompt, indica explícitamente el juego objetivo, por ejemplo:

   > "Aplica los 3 skins canónicos (classic, retro, neon) al juego `<juego-id>` (componente `components/games/<Game>.tsx`) que se acaba de implementar."

   Anuncia al usuario: "Lanzando skin-designer para `<juego-id>`…"

3. **Espera el reporte final de skin-designer antes de continuar.** No invoques mobile-porter hasta haber recibido la respuesta completa del agente anterior. Relay al usuario un resumen breve de lo que hizo (skins añadidos, paleta clave).

4. **Invoca mobile-porter después**, nunca antes ni junto al anterior. Mismo mecanismo: tool Agent, `subagent_type: "mobile-porter"`, `run_in_background: false`, prompt explícito:

   > "Porta el juego `<juego-id>` a mobile añadiendo controles táctiles (spec 10) en `app/games/<juego-id>/play/page.tsx`."

   Anuncia: "skin-designer terminó. Lanzando mobile-porter para `<juego-id>`…"

5. **Espera su reporte final** y relay al usuario un resumen breve (keyMap aplicado, notas si el juego carecía de skin system).

6. **Cierre.** Muestra un resumen final combinando: juego implementado, spec usado, rama git, skins aplicados (colores clave), y notas de mobile-porter. Recuerda al usuario hacer commit/merge de la rama cuando esté conforme.

Un solo juego por invocación de `/spec-impl-game` — igual que las reglas propias de `skin-designer` y `mobile-porter`.

---

## Summary of expected behavior

```
/spec-impl-game game-jam/frogger/01-frogger-core

  Phase 1  →  Finds specs/game-jam/frogger/01-frogger-core.md
  Phase 2  →  Reads the state → "Aprobado" → ✅ continues
  Phase 3  →  git checkout -b spec-frogger-core → git checkout spec-frogger-core
              Shows objective, scope, plan and criteria
  Phase 4  →  Implements step by step with pauses
              Ends by asking the user to confirm acceptance criteria pass
  Phase 5  →  On confirmation: Agent(skin-designer, frogger) → wait for report
              → Agent(mobile-porter, frogger) → wait for report → final summary

/spec-impl-game 02-powerups  (state: Draft / Borrador)

  Phase 1  →  Finds specs/02-powerups.md
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code, does not reach Phase 5
```
