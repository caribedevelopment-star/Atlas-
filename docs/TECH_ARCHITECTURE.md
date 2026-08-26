# Technical Architecture

## V1 direction

Browser-first static WebGL experience deployed on Vercel.

### Rendering
- Three.js
- WebGL
- procedural / instanced geometry
- custom shader material for malleable entities

### Distribution
- PWA manifest
- service worker
- Vercel static deployment

### Narrative model
- single controlled protagonist
- second narrative entity driven by scene logic
- proximity and contact triggers
- no multiplayer in V1

### Future scenes
Structure new memories as isolated scene modules before connecting them into a continuous experience. Keep reusable systems for entities, camera, particles, audio, transitions and interaction.
