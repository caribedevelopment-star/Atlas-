# CODEX — START HERE

Work directly on **Al.Kim.ia V05**. Do not produce a planning-only answer. Inspect the repository, run the current experience, read `CODEX_HANDOFF.md`, `PROJECT_STATE.md`, and `docs/VISUAL_DIRECTION_V5.md`, then execute the production pass.

## Primary goal
Make the current browser experience look and feel generationally better while preserving the established narrative chronology. The user does not want to model assets manually. Generate procedural/abstract assets yourself.

## Production priorities, in order
1. **Entity V06** — genuinely unified biomorphic matte sculptures. Prefer SDF/metaballs/marching-cubes or an automated Blender Python + voxel-remesh + GLB pipeline if that clearly improves the result. No assembled primitive look, no humanoid walk cycle.
2. **Rendering architecture** — modularize the runtime enough to support real QA and iteration. TypeScript/R3F is acceptable only if it improves quality/maintainability without losing current behavior.
3. **CinematicCameraDirector** — rails, timelines, control-weight blending, FOV/focus/exposure hooks. Preserve third-person exploration, first-person portal crossing, global ascension shots.
4. **WeatherDirector** — coherent DESERT / WINTER / REBIRTH / SPRING / LAVENDER_GOLDEN_HOUR / ASCENSION_SKY states controlling sky, sun, fog, wind, particles and ambience.
5. **Meadow V06** — clearer foreground/midground/background/horizon, better flower variants and LOD, denser natural lavender masses, visible wind waves, warm suspended spring particles.
6. **Portal V06** — retain real-time secondary-scene rendering; improve parallax, portal membrane, light/wind leakage and crossing without turning it into sci-fi.
7. **TouchDesigner layer** — GPU/flow-field generative behavior in contact, portal, memory tunnel and ascension. Keep it subtle and poetic; no generic glitch/neon visualizer.
8. **Ascension V06** — flower heads disintegrate into particles in spatial waves, entities partially merge, cinematic shot progression moves intimate → field → sky.
9. **Post / lookdev** — restrained selective bloom, DOF only where narratively useful, fine grain, color grading, atmospheric light shafts if affordable.
10. **Visual QA** — capture and inspect CONCERT_WIDE, ENCOUNTER, CONTACT, ROOM, PORTAL, CROSSING, DESERT, WINTER, GREEN, LAVENDER, ASCENSION_FIELD, ASCENSION_SKY. Iterate from screenshots before calling the pass complete.

## Quality gate
If a shot still looks like a Three.js experiment, primitive demo, low-poly meadow, flat sky, glowing sci-fi portal or generic game scene, it is not finished.

## Safety
- Never modify the separate `Atlas` repository/project.
- Never modify `Bobbio-Russian`.
- Never commit commercial Rawayana audio.
- Keep browser/mobile viability.
- Do not ask the user to model anything.

## Finish
Validate build/runtime, perform visual QA where the environment allows, update project docs, commit/push the stable result and deploy to Vercel. Report only major changes, QA performed, remaining issues, commit and deployment links.
