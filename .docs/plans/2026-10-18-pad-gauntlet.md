# Pad Gauntlet

status: complete

No SessionStart hook context was present. No other plan with status in-progress existed, so this plan started fresh.

## For everyday use

The practice page keeps its own clock. Pad Gauntlet lets you pick a rudiment, hear a pad sound, read the sticking, and run a speed workout. The clock and the gauntlet do not control each other. Leaving the gauntlet stops the sound. Coming back to the clock continues from the saved time.

## Milestone 1. App shell

- [x] Keep the Next.js 16 app shell, strict TypeScript, and token-based styling
- [x] Add a practice page with an isolated clock
- [x] Add navigation to Pad Gauntlet without coupling it to that clock

## Milestone 2. Rudiment data and timing

- [x] Add the typed rudiment database and selectors
- [x] Add pure timing helpers for beats, grace notes, and note onsets
- [x] Add unit tests for complete beats, sticking, and timing math

## Milestone 3. Sound and notation

- [x] Add a lookahead Web Audio scheduler with pad voices, grace notes, and metronome clicks
- [x] Stop and disconnect audio nodes when playback stops or the page hides
- [x] Draw one-line percussion notation, sticking, and the active note

## Milestone 4. Practice controls and workout

- [x] Add play, tempo, tap tempo, metronome, and loop controls
- [x] Add speed builder and continuous rudiment queue workouts
- [x] Show the current bar, repetition, and the next tempo or rudiment

## Milestone 5. Check

- [x] Review indexed access, design tokens, and audio cleanup
- [x] Run typecheck, lint, build, and tests
- [x] Record what we learned about scheduling and notation

## Review notes

- Array lookups are checked before use. The strict index setting is on, and the type check passed.
- Colors in the screens live in the theme tokens. No palette colors were added in the screens.
- Stopping playback copies the live sounds, stops them, and disconnects them. Leaving the page closes the audio engine.
- Nothing is stored in a database, so no database rules were added.
- The repetition count now advances when the pattern starts again, not when the last note is scheduled.
