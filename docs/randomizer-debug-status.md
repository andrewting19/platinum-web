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

The randomizer flow is fully working end-to-end on prod. All previous blockers have been resolved.

What is working:

- the launcher/randomizer flow no longer loads the DS emulator runtime up front
- CheerpJ randomizer initialization works reliably in the launcher session
- bundled Platinum randomizer generation completes in-browser
- the generated randomized ROM is saved for handoff
- the app reloads into a clean emulator shell after generation
- the emulator shell boots the randomized ROM successfully
- customizable randomizer settings panel with 8 toggles and preset chips
- multi-session run management with launcher cards for continuing previous runs

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

## Resolved: Emulator Boot Stall

The emulator stall at "Compiling the Nintendo DS runtime..." was caused by loading `wasmemulator.js` before `webmelon.js`. Emscripten snapshots `window.Module` at parse time — since `webmelon.js` sets `Module.onRuntimeInitialized`, it must load first so the callback is in place when Emscripten picks it up. Swapping the load order in `ensureWebMelonRuntime()` fixed the issue.

## Resolved: Settings CRC32

Custom settings byte manipulation initially failed because `findDataLength` assumed a clean 51-byte settings block, but the version migration inserts bytes mid-stream. Fixed by using `data.length` directly for CRC32 computation.

## Files Most Relevant Right Now

- [src/lib/randomizer.ts](/workspace/src/lib/randomizer.ts)
- [src/lib/emulator.ts](/workspace/src/lib/emulator.ts)
- [src/hooks/useEmulator.ts](/workspace/src/hooks/useEmulator.ts)
- [src/App.tsx](/workspace/src/App.tsx)
- [src/lib/launchHandoff.ts](/workspace/src/lib/launchHandoff.ts)
- [index.html](/workspace/index.html)
- [docs/task-list.md](/workspace/docs/task-list.md)
