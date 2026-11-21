# Jarvis implementation

## Goal
Build a working local Jarvis voice assistant with the video as visual reference, OpenAI-compatible AI, app tools, and Windows computer control. Preserve existing work and dummy login.

## Phases
1. Reference and architecture — complete
2. Authenticated agent backend and local desktop tools — complete
3. Video-inspired dashboard, voice, integrations, settings, history — complete
4. Functional and browser verification, documentation — complete

## Next Step
Create or copy a Composio **Project API Key** beginning with `ak_`, with Session management (read/write), Connected accounts (read/write), and Session tool execution (write). Save it in Connections, then authenticate an app in the browser popup.

## Follow-up
- AI provider presets/model discovery — complete: automatic /models discovery, explicit manual mode, and safe key scoping per endpoint verified against existing 9router without changing its saved configuration.
- App OAuth — implementation complete: built-in apps use hosted browser authorization and server-side account verification; Custom MCP retains manual endpoint setup. The supplied `ck_` Consumer Key was rejected and removed; a correctly scoped `ak_` Project API Key is required for real account login.
- Voice selection / Edge TTS — complete: integrated the user's sample as online streamed speech with selectable voices, rate/pitch/volume, preview, and explicit browser alternative. Real generation, HTTP streaming, browser playback/stop, seven playback tests, type/lint and production build passed. Saved AI provider was not changed.
- Provider compatibility: explicitly disable upstream streaming and accept SSE fallback, including fragmented tool calls.
- Hardware: Intel i7-8665U, 16 GB RAM, UHD 620; Ollama not installed. Recommend a CPU-friendly model without downloading it unasked.
- Provider parser regression: four tests passed, TypeScript/lint passed, production build passed with JSON and SSE compatibility fix.

## Decisions
- Work inside the existing local Next.js checkout; no hosted deployment needed for local Windows control.
- OpenAI-compatible API selected by user.
- No claim of universal command support or connected accounts without credentials.
