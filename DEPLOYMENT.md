# Deployment

## Current target
Vercel, browser-first static deployment.

## Git integration
Once the repository is renamed to `Al-Kim-ia`, connect it to the Vercel project from Vercel Project Settings → Git. After that, pushes to `main` can auto-deploy.

## Vercel settings
Framework preset: Other / Static
Build command: none
Output directory: repository root
Install command: none

## PWA
`manifest.webmanifest` and `sw.js` are included. Service worker is configured for network-first updates with cache fallback.

## Audio
Do not deploy copyrighted commercial audio from the repository. For private testing, use a lawful local file at `/audio/rawayana.mp3` or later integrate a licensed/authorized playback source.
