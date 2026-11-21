# Jarvis local assistant

## Start

Use Node.js 22 or newer. Run `npm install` and `npm run dev`. Open http://localhost:3000/login.
The development dummy account is `demo@jarvis.local` / `Jarvis123!`.

## AI

In **Assistant**, choose 9router, OpenAI, OpenRouter, Groq, DeepSeek, Ollama, LM Studio, or Custom OpenAI-compatible. Presets fill the editable base URL. The model list is fetched automatically from /models using the current unsaved endpoint/key, with Cek model for refresh and Isi manual when discovery is unsupported. Existing model aliases are preserved. Save, then use **Uji koneksi tersimpan**. Saved secrets are reused only for the same endpoint; changing providers never forwards the old key. Local servers may operate without a key if they permit it.
For OpenAI use `https://api.openai.com/v1`; other providers must implement `/chat/completions` and OpenAI function calling.
Choose a vision-capable model for screenshot-based computer tasks. Provider configuration is persisted locally, encrypted with AES-256-GCM; keys are never returned by the state API.
Alternatively provide `JARVIS_API_BASE_URL`, `JARVIS_API_KEY`, and `JARVIS_MODEL` in `.env.local` before the first settings save.

## Small local AI provider

For the inspected i7-8665U / 16 GB RAM / Intel UHD 620 laptop, start with Ollama and `qwen3.5:2b-q4_K_M` (about 1.9 GB model download). It supports tools and image input; CPU performance and visual-task reliability still need a local benchmark. `qwen3.5:4b-q4_K_M` is a larger alternative (about 3.3 GB download).

After installing Ollama, run `ollama pull qwen3.5:2b-q4_K_M`.
In Assistant set Base URL `http://localhost:11434/v1`, API key `ollama` (placeholder ignored by local Ollama), and model `qwen3.5:2b-q4_K_M`. Save and test the provider. This changes the LLM provider; browser speech recognition is a separate service and is not made offline by selecting a local LLM.

Upstream completions explicitly request `stream:false`. Compatibility gateways returning SSE anyway are accepted, including fragmented function-call arguments. `node --test scripts/test-provider-response.mjs` covers the parser regression.

References: https://ollama.com/library/qwen3.5:2b-q4_K_M and https://docs.ollama.com/api/openai-compatibility.

## Voice interaction

In **Assistant → Voice & language**, choose **Browser** or **Edge Neural**. Both support voice selection, speed, volume, and an unsaved text preview. Edge additionally supports pitch in Hz. **Preset Jarvis · Ardi** selects Indonesian male Ardi at +8% speed and -5 Hz pitch; **Natural · Gadis** selects Indonesian female Gadis at neutral speed/pitch. Preview the voice, then save settings to use it for replies. Existing installations keep Browser as their default and retain their AI provider credentials.

Edge installation: Python 3.10+ and `npm run setup:tts`. This creates an isolated ignored `.venv-tts` and installs the pinned `scripts/requirements-tts.txt`. Set `JARVIS_SETUP_PYTHON` to select the setup interpreter; `JARVIS_TTS_PYTHON` can override the runtime interpreter. Restart the app after changing environment variables. No API key is required for this online TTS provider.

Edge reply text is sent to Microsoft's online speech service via the third-party [edge-tts](https://github.com/rany2/edge-tts) package. It requires internet and should not be treated as an offline engine or a guaranteed managed speech API. Browser remains an explicit alternative if the service is unavailable; the app does not silently change the chosen voice engine.

Audio is piped directly from the Python synthesizer to an authenticated MP3 response, with no temporary audio file or FFmpeg step. A short-lived per-user ticket keeps the reply text out of the audio URL. Playback begins from the streaming URL, rather than downloading the entire MP3 to a blob first. Stop cancels queued requests, pauses audio, and terminates synthesis. Preview does not save the voice or alter the AI provider.

Measured on this machine for one short Indonesian sentence: first Python audio bytes ~2.1 s for Ardi and ~4.2 s for Gadis. An authenticated streaming endpoint test received the first chunk in ~2.3 s, with server synthesis first-byte timing ~2.2 s. These are individual network-dependent measurements, not a guarantee of browser audible latency or a benchmark against browser voices.

Additional checks: `node --test scripts/test-edge-playback.mjs scripts/test-speech-playback.mjs`. These cover sequential playback, cancellation, stale response cleanup, local/browser voice selection, and autoplay/server error handling.

Open the app in Chrome or Edge, allow the microphone, select Indonesian or English in **Assistant**, then tap the microphone or neural core. Final speech becomes a command. Browser speech synthesis reads replies when enabled. Tap the voice control to interrupt speech; the stop square cancels a running request. Browser speech recognition may use the browser vendor's online service. Text input works independently.

## Windows computer control

Enable **Computer control** in **Assistant**, then save. Control runs on the Windows machine hosting `npm run dev`, not on a remote visitor's device. The API accepts authenticated loopback requests and verifies the origin on writes.

Implemented actions:
- Inspect open window titles, process IDs, and virtual screen bounds.
- Capture the virtual desktop for a vision-capable model.
- Open Notepad, Calculator, Explorer, Edge, Chrome, VS Code, Paint, Terminal, Spotify (when installed).
- Open HTTP/HTTPS URLs; focus windows; move/click the pointer; type literal Unicode text without changing the clipboard; press predefined shortcuts.
- Open the Windows Start menu with the WIN key tool to search and launch other installed applications through the normal UI.
- Create, list, and read `.txt`/`.md` notes in the current user's isolated notes directory.

There is no arbitrary shell execution tool. Desktop control is disabled in production. A loop has a maximum of eight tool rounds; stop cancels future steps and outstanding abortable calls, but cannot undo actions already completed. Keep Jarvis on localhost.

Example commands without an API key: `jam berapa`, `lihat catatan`, `status komputer`, `buka kalkulator`.
General natural language, multi-step commands, and visual automation require the configured model. The model must ground clicks in the screenshot and screen bounds. Windows foreground focus restrictions and the elevation level of the target application still apply.

## App connections

Built-in account services use browser-based authorization through Composio. In **Connections → Pengaturan koneksi OAuth**, save a Composio **Project API Key** (`ak_...`) once, or set COMPOSIO_API_KEY in .env.local. A `ck_...` Consumer Key is for Composio Connect/MCP and cannot create Jarvis OAuth sessions. This key is separate from the AI provider key, stored encrypted, and never returned to the browser. Enable Session management and Session tool execution permissions for the key; account-read/revoke permissions are also needed for verification and disconnect.

Choose Google Drive, Gmail, Calendar, GitHub, or another listed service, then click **Hubungkan … lewat browser**. Jarvis opens a popup to the hosted authorization page. You log in and approve the provider's permissions yourself. If popups are blocked, use **Buka halaman login**. The app polls status; a local callback also verifies completion. A closed popup alone never means connected.

Before showing Connected, the backend verifies the active account ID, toolkit and owning user when returned, pins that account to the user-scoped session (the provider validates ownership), and loads available tool schemas. OAuth access/refresh tokens stay with Composio. Session identifiers/project credentials are protected in local encrypted state. Each session is restricted to the selected toolkit and explicit connected account, with instant paid accounts and remote workbench disabled. Disconnect revokes the account and removes the local connection.

Some providers or projects require additional auth-config setup in Composio, and some toolkits use a hosted API-key form rather than OAuth. No account is presented as connected without successful verification. Real login cannot be tested until a valid project key and user consent are supplied. Do not paste the project key into chat.

**Custom MCP** retains the advanced Remote MCP URL and optional bearer-token form. It supports Streamable HTTP MCP, not legacy SSE-only or stdio transport. Existing manually configured connections remain intact. Large catalogs are paginated (up to 200 tools per connection), with schema search and execution through the same agent runtime.

References: https://docs.composio.dev/reference/api-reference/tool-router and https://docs.composio.dev/reference/api-reference/connected-accounts.

## Notes, workflows, history

Files supports creating, importing, editing, and saving text/Markdown notes. Workflows save a named instruction and run it through the same agent. Conversation history and actual successful/failed actions persist across page reloads. Export user conversations, activities, and workflows through Account. It excludes credentials. State is capped at 100 conversations and 200 activities; deleting a conversation or workflow is explicit.

Back up `.jarvis/` as a unit: it includes the encryption key and encrypted user state. Do not commit or share it. Files/notes themselves are stored as text inside each user's local directory. Protect the folder with your Windows account permissions.

## Verification

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `node scripts/test-desktop.mjs` opens a dedicated scratch Notepad window, verifies native focus/click/Unicode input/shortcut/file contents/screenshot, closes that window, and restores the pointer position. Run with an interactive Windows desktop.
- `node scripts/test-fixtures.mjs` starts isolated OpenAI/MCP contract fixtures on port 4318 for manual API/browser verification. These are test services, not application integrations. Remove fixture connections and restore real provider settings after testing.

## Reference and upstream research

Visual reference: [Jarvis video](https://www.youtube.com/watch?v=YCkVtEoWYU8), Network/Features Demo. This is an independent implementation; it does not include the creator's separately sold final source. Similarity is based on observed frames, not a verified pixel comparison across the entire video.

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), MIT — used directly for remote tool discovery/execution.
- [Composio](https://github.com/ComposioHQ/composio) — reviewed for authenticated multi-app connections; interoperates through remote MCP.
- [LiveKit Agents](https://github.com/livekit/agents) — reviewed for realtime voice architecture; current implementation uses browser speech APIs to avoid requiring another hosted voice service.

Local Inter font: Google Fonts, SIL Open Font License (see `public/fonts/OFL.txt`). App icons: the existing react-icons and Lucide dependencies.
