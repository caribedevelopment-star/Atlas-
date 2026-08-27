# CODEX HANDOFF — AL.KIM.IA V05

## Mission
Take the current V05 browser prototype and turn it into a maintainable cinematic real-time production. Do not reinterpret the story. Improve the execution.

## Non-negotiable visual direction
- adult, intimate, melancholic, abstract, cinematic
- atmosphere > features
- almost-black matte biomorphic entities, not humanoids
- Unreal-like spatial quality: climate, depth, light, scale, camera
- TouchDesigner-like behavior only as a subtle generative layer: flow fields, feedback logic, particles, vector motion
- no generic game HUD, fantasy bloom, neon cyberpunk or cheap low-poly look
- AL.KIM.IA is the only project title

## Current scene chronology
1. THE ENCOUNTER — monumental abstract concert, crowd, RAWA stage, giant sphere, Ale finds Kim, material contact
2. THE ROOM — quiet mineral architecture
3. THE PORTAL — real-time meadow visible inside portal, gradual cinematic takeover
4. MEMORY TUNNEL — fragments of concert/orb/RAWA/entity matter/lavender
5. THE MEADOW — desert → winter → green → lavender, controlled by movement/proximity
6. THE ASCENSION — flowers disintegrate into particles, entities rise, camera becomes cinematic

## What already exists in V05
- procedural biomorphic entity class based on a dominant lathed body + shader deformation
- portal WebGLRenderTarget with a second live scene/camera
- procedural sky dome with seasonal climate palettes, sun and cloud noise
- spatial wind field with gusts
- non-flat meadow terrain
- lavender system made from separate stems and clustered dodecahedral flower heads
- TouchDesigner-inspired portal flow field and generative particle behavior
- memory tunnel without torus rings
- flower-particle ascension system
- cinematic portal and ascension camera logic

## Highest-value next work
### 1. Refactor architecture
The single-file runtime is still a prototype. Migrate only if it improves iteration speed and quality. Preferred target:
- TypeScript
- Three.js or R3F depending on the least risky path
- modules for scenes/entities/weather/camera/audio/VFX
- deterministic scene state machine

### 2. Entity quality pass
The new lathed bodies are a better base but should become genuinely unified sculptural surfaces. Evaluate:
- SDF/metaballs/marching cubes
- Blender Python generator + voxel/remesh + GLB export
- custom normal/roughness variation
- contact deformation
Do not ask the user to model anything.

### 3. CinematicCameraDirector
Replace remaining camera logic with rails/timelines:
FREE_EXPLORE, DISCOVERY, CONTACT, ROOM_REVEAL, PORTAL_APPROACH, CROSSING, MEADOW_REVEAL, ASCENSION_INTIMATE, ASCENSION_GLOBAL, ASCENSION_SKY.

### 4. WeatherDirector
Centralize sky, sun, fog, exposure, wind, particles and ambience into DESERT / WINTER / REBIRTH / SPRING / LAVENDER_GOLDEN_HOUR / ASCENSION_SKY.

### 5. Rendering
Add restrained post-processing if performance allows: selective bloom, depth of field only for cinematics, color grading, subtle light shafts, fine grain. Do not use effects to hide weak geometry.

### 6. QA loop
Run the project and capture at least:
CONCERT_WIDE, ENCOUNTER, CONTACT, ROOM, PORTAL, CROSSING, DESERT, WINTER, GREEN, LAVENDER, ASCENSION_FIELD, ASCENSION_SKY.
Iterate from images instead of waiting for user feedback.

## Next narrative scene after quality stabilizes
THE FALL / THE STORM. Ale fractures away from the joined form and falls into a psychological storm. Do not build it until the current six beats meet the quality bar.

## Safety rails
- never touch the separate Atlas repo/project
- never touch Bobbio-Russian
- do not commit commercial Rawayana audio
- preserve mobile viability
- quality over scene count
