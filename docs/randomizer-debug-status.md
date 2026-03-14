# Randomizer Debug Status

## End Goal

Ship a bundled, zero-friction Platinum randomizer flow that works on the live site:

1. User taps a randomizer preset.
2. The app downloads bundled `Pokemon Platinum`.
3. The browser randomizer generates a fresh randomized ROM locally.
4. The app reloads into a clean emulator session.
5. The randomized ROM boots and becomes playable.

The intended UX is:

- no user-supplied ROM
- no server-side randomization
- no Nuzlocke rule enforcement in the UI
- presets only, not the full UPR settings surface

## Current Status

The project is materially further along than before.

What is now working:

- the launcher/randomizer flow no longer loads the DS emulator runtime up front
- CheerpJ randomizer initialization works reliably in the launcher session
- bundled Platinum randomizer generation completes in-browser
- the generated randomized ROM is saved for handoff
- the app reloads into a clean emulator shell after generation
- the emulator shell detects the pending randomized ROM and starts the boot path

What is still failing:

- after the reload into the emulator shell, the app gets stuck on:
  `Compiling the Nintendo DS runtime...`

This is the current blocker seen both by the user on prod and in local verification.

## What Was Fixed

### 1. Randomizer / Emulator Memory Conflict

Originally the app loaded the emulator runtime directly from [index.html](/workspace/index.html), which meant the launcher page carried the WebMelon / Emscripten heap even while running CheerpJ.

That caused:

- heap collisions
- severe memory pressure
- renderer crashes during ROM staging

This was fixed by:

- removing the emulator scripts from [index.html](/workspace/index.html)
- loading the emulator runtime lazily from [src/lib/emulator.ts](/workspace/src/lib/emulator.ts)
- bootstrapping that runtime only inside [src/hooks/useEmulator.ts](/workspace/src/hooks/useEmulator.ts)

### 2. Randomizer ROM Staging

The browser randomizer now uses CheerpJ library mode in [src/lib/randomizer.ts](/workspace/src/lib/randomizer.ts), and the working ROM file is staged correctly for Java-side reads.

Important confirmed milestones:

- staged Platinum header is valid
- `Gen4RomHandler.loadRom(...)` succeeds
- preset settings parse successfully
- randomizer construction succeeds
- `Randomizer.randomize(...)` completes
- randomized ROM bytes are read back successfully

### 3. Clean Reload Handoff

Randomized ROM handoff now goes through [src/lib/launchHandoff.ts](/workspace/src/lib/launchHandoff.ts) and is orchestrated from [src/App.tsx](/workspace/src/App.tsx).

That means:

- randomization happens in the lightweight launcher session
- the generated ROM is stored in IndexedDB
- the page reloads
- the emulator shell resumes from the pending randomized ROM

## Current Verification State

Verified locally:

- `npm run lint` passes
- `npm run build` passes
- browser-side randomized ROM generation completes in the built preview app
- the app reloads into the emulator shell after randomization

Not yet verified:

- successful transition from `Compiling the Nintendo DS runtime...` into live gameplay for the randomized boot path
- whether this remaining stall is unique to randomized boot or a broader runtime-loader regression in the lazily loaded emulator path

## Current Hypothesis

The randomizer is no longer the main issue.

The active problem is now in the emulator runtime boot path after lazy loading. The most likely area is:

- script load / runtime ready signaling in [src/lib/emulator.ts](/workspace/src/lib/emulator.ts) and [src/hooks/useEmulator.ts](/workspace/src/hooks/useEmulator.ts)
- or a difference between the old eager script boot and the new lazy script boot sequence

In short:

- randomizer generation is green
- emulator startup after reload is the remaining blocker

## Next Debugging Targets

1. Compare lazy runtime boot versus the old eager `index.html` boot path.
2. Confirm whether vanilla boot also stalls under the same lazy-loader path in real browser testing.
3. Add runtime boot instrumentation around:
   - script load completion
   - WebMelon assembly listener registration
   - wasm-loaded signal
   - storage prep start / finish
4. Determine whether the compile stall is:
   - a real wasm compile hang
   - a missed ready callback
   - or a UI status that never advances even though the runtime has moved on

## Files Most Relevant Right Now

- [src/lib/randomizer.ts](/workspace/src/lib/randomizer.ts)
- [src/lib/emulator.ts](/workspace/src/lib/emulator.ts)
- [src/hooks/useEmulator.ts](/workspace/src/hooks/useEmulator.ts)
- [src/App.tsx](/workspace/src/App.tsx)
- [src/lib/launchHandoff.ts](/workspace/src/lib/launchHandoff.ts)
- [index.html](/workspace/index.html)
- [docs/task-list.md](/workspace/docs/task-list.md)
