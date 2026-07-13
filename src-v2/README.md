# SNHS Smart Poster Agent V2

This directory is the isolated V2 implementation boundary. Legacy application entry points remain unchanged until the real Photoshop smoke test succeeds.

Planned boundaries: `main`, `preload`, `renderer`, `shared`, `jobs`, and `storage`. Renderer payloads will contain only validated serializable data; executable automation is owned by the main process.
