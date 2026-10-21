# Web Audio scheduling and SVG notation

## Sound clock and picture clock

The pad sound is placed on the audio clock, a little ahead of the current moment, so the browser can start each hit on time. The moving highlight is a separate picture clock. It looks at which hit has already come due and only then paints the current note. Mixing those two clocks keeps the sticks even when the picture redraws late.

Grace notes for flams, drags, and ruffs are ordinary hits scheduled a few milliseconds before the main note. The gap shrinks a little as the tempo rises so the grace notes stay attached to the beat. A diddle is a second hit inside the same written note. A buzz is a short row of soft hits across that note.

Every hit builds a short tone and a noise burst, then disconnects both when the sound ends. Stopping or leaving the page stops the leftover sounds first, then closes the audio engine. Copy the stop list before walking it, because disconnecting a sound removes it from that list.

## Notation in React

The staff is one drawing made from the rudiment itself. Note positions, beams, grace notes, accents, ghost parentheses, diddle slashes, and sticking are all derived while drawing. The current note is just a number passed in. The drawing does not talk to the audio engine.

Beams are grouped by beat. A quarter note gets a stem only. Shorter notes share a beam, and the shortest notes get an extra beam or a flag when they sit alone.

## Page memory

With the current Next.js caching setup, a page stays in memory when you open another page. Effects stop, then start again when you come back. The practice clock must only cancel its ticker in that pause. It must not reset the saved time. The gauntlet must stop sound in that same pause so a hidden page does not keep playing.
