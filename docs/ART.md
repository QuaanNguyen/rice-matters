# Swapping Rice's art

The current Rice is a placeholder. Replacing it does not require touching the
renderer, ASSAY, or the event schema — but the new art has to keep four things,
or the behaviour silently stops working.

Everything lives in two files:

| File                  | What it holds                                             |
|-----------------------|-----------------------------------------------------------|
| `pet/src/index.html`  | the body — bowl, heap, arms, steam. Static SVG.           |
| `pet/src/rice.js`     | the faces — one function per state, returning SVG markup. |

## The four things that must survive

**1. `<g id="face">`**
The renderer replaces this group's `innerHTML` on every state change. It must
exist inside the SVG, positioned wherever the face belongs on the new body.
Move the group; don't move the coordinates inside `rice.js`.

**2. `class="grain"` on the animated group**
Every body animation in `styles.css` targets `.grain` — bob, hop, shake,
wobble, glitch, lean, snooze. Whatever should move goes inside it; whatever
should stay put (if anything) goes outside. It needs `transform-box: fill-box`
and a sensible `transform-origin`, which the stylesheet already sets.

**3. `<g class="eyes">` around the eyes, in every face**
Blinking and glancing are CSS on `.eyes` — a `scaleY` and a `translateX`. A
face that draws eyes outside this wrapper will never blink. Use the `eyes()`
helper at the top of `rice.js` and this is automatic.

**4. All sixteen state keys in `FACES`**
`calm hover drag thinking watching checking allowed suspicious refused
proving rejecting celebrating error sleeping asking offline`

A missing key silently falls back to `calm`, so the pet keeps working and you
never find out. `node test/run-tests.js` has a test that fails if ASSAY emits
a state Rice cannot draw — that catches the reverse mistake, not this one.
`node test/visual.js` renders all sixteen; look at the contact sheet.

## Optional, but free if you keep them

Prop animation classes, applied to any `<g>` in a face:

| Class           | Does                                    | Used by            |
|-----------------|-----------------------------------------|--------------------|
| `prop-pop`      | scales in with a bounce                 | tick, shield       |
| `prop-stamp`    | slams down from above                   | NOT VERIFIED stamp |
| `prop-tilt`     | rocks gently, forever                   | receipt            |
| `prop-scan`     | sweeps left and back                    | magnifier          |
| `prop-antenna`  | pulses vertically                       | thinking antenna   |
| `prop-wave`     | rotates back and forth                  | waving hand        |
| `prop-z1/z2`    | drifts up and fades                     | sleeping z's       |

Body-level hooks in `styles.css` you can reuse or ignore: `.steam` (shown only
in `calm`, `hover`, `allowed`, `celebrating`) and `.arm` / `.arm-l` / `.arm-r`
(rotated per state — wave, cheer, hold).

## Working on it without running anything else

    cd pet && npm run start:demo     # replays a canned sequence, no ASSAY needed

That is the main loop: edit, restart, look. `test/visual.js` renders every
state to a contact sheet, but it needs Playwright, which is deliberately not a
dependency of this project — it will tell you how to enable it and otherwise
skip. You do not need it.

And in the running app's devtools:

    __rice.setState('refused')
    __rice.setInteraction('hover')
    __rice.say('line', 'sub', 99999)

Rice can be resized (`Ctrl`+wheel, or `Ctrl+Alt+=`), so check your art at 0.6x
as well as 2x. The silhouette is what survives at small sizes — that is why the
current heap has grains breaking its outline.

## One thing that will bite

`rice.js` and `renderer.js` are both classic scripts sharing one global scope.
`rice.js` is wrapped in an IIFE for exactly this reason — a bare top-level
`const` in it collides with the renderer and kills the whole pet with a console
error you will not see unless devtools are open. Keep the wrapper.

## Colour

The palette is CSS custom properties at the top of `styles.css`, one per state.
The speech bubble's left edge, the aura behind Rice, and the mood label all
read from `--accent`, which each `.state-*` rule sets. Change a colour there
and it changes everywhere, consistently.
