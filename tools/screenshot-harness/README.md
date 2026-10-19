# Screenshot harness (dev only, not served, not part of `npm test`)

Runs the real `public/index.html` signed in with sample data and **no Firebase**: `stubs/fb.js` replaces the Firebase SDK
(it does not enforce security rules). Used to take screenshots (English/Arabic, light/dark) and to check what the app writes.

```
node tools/screenshot-harness/run.cjs public tools/screenshot-harness 5071     # restart after editing public/index.html
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless --disable-gpu --hide-scrollbars \
  --screenshot=out.png --window-size=500,900 --virtual-time-budget=14000 "http://localhost:5071/?theme=light&go=friends"
```

- Edge headless is at least 500 px wide; port 5060 is blocked by Edge (use 5071).
- `run.cjs` rebuilds `index.html` only when it starts, so restart it after every change to `public/index.html`.
- Query parameters: `theme=light|dark`, `lang=ar`, `acc=<accent>`, `friends=1` (sample friends, requests, a block), `ch=1`
  (sample challenges), `mine=1` (my profile exists), `fresh=1|2` (no days/workouts; `2` also no profile), `gym=[...]` (equipment ids),
  `reauth=fail`, `failat=items|account` (forced failures for the delete flow).
- `go=` drives the page after load: `profile`, `find:<q>`, `friends`, `friend:<uid>[:report|:send]`, `ffind:<q>`, `days:edit|all`,
  `gym`, `jr:<tokens>` (journey click-through, e.g. `jr:goal:muscle,next,family:ppl,next,days:3,next,gym:basic,next,exp:beginner,next`),
  `delete:idle|confirm|run`, `ch:list|open|fin|new|create|accept|leave|delete`.
- The stub logs what the app does (`set:`, `update:`, `delete:`, `list:`, `reauth`, `terminate`, ...) into `localStorage.__calls`; the
  driver copies it to `document.body` attribute `data-calls` after 6 s, so
  `msedge --dump-dom <url> | grep -o 'data-calls="[^"]*"'` shows the write order of a flow.
- Generated files (`index.html`, `shots/`) are git-ignored.
