# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Install dependencies
```bash
npm install
```

### Run development server
```bash
npm run dev        # Run Electron app in dev mode
npm run dev:web    # Run web-only version
```

### Build commands
```bash
npm run build:win     # Build for Windows
npm run build:mac     # Build for macOS
npm run build:linux   # Build for Linux
npm run build:web     # Build web version
```

### Code quality
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
npm run typecheck     # Run TypeScript type checking (both node and web)
npm run format        # Format code with Prettier
```

### Translation extraction
```bash
npm run extract-translations  # Extract i18n strings
```

## Architecture Overview

This is an Electron + React application for an AI VTuber system with Live2D integration. The architecture consists of:

### Main Process (`src/main/`)
- **index.ts**: Entry point, sets up IPC handlers for window management, mouse events, and screen capture
- **window-manager.ts**: Manages window state, modes (window/pet), and window properties
- **menu-manager.ts**: Handles system tray and context menus

### Renderer Process (`src/renderer/src/`)
- **App.tsx**: Root component that sets up providers and renders the main layout
- **Two display modes**:
  - **Window mode**: Full UI with sidebar, footer, and Live2D canvas
  - **Pet mode**: Minimal overlay with just Live2D and input subtitle

### Core Services
- **WebSocket Handler** (`services/websocket-handler.tsx`): Central communication hub that:
  - Manages WebSocket connection to backend server
  - Handles incoming messages (audio, control, model updates, chat history)
  - Coordinates state updates across multiple contexts
  - Manages audio playback queue

### Context Providers (State Management)
The app uses React Context for state management with multiple specialized contexts:
- **AiStateContext**: AI conversation state (idle, thinking, speaking, listening)
- **Live2DConfigContext**: Live2D model configuration and loading
- **ChatHistoryContext**: Conversation history and messages
- **VADContext**: Voice Activity Detection for microphone control
- **WebSocketContext**: WebSocket connection state and messaging
- **SubtitleContext**: Subtitle display management
- **GroupContext**: Multi-user group session management

### Live2D Integration
- Uses Cubism SDK (WebSDK folder) for Live2D model rendering
- **live2d.tsx**: Main Live2D component handling model loading, animation, and lip sync
- Supports model switching, expressions, and motion playback
- Audio-driven lip sync with volume-based animation

### Key Features
- Real-time voice interaction with VAD (Voice Activity Detection)
- WebSocket-based communication with backend AI server
- Live2D character animation with expressions and lip sync
- Multi-language support (i18n)
- Group/collaborative sessions
- Screen capture support
- Customizable backgrounds and UI themes

## Important Notes
- The app requires a backend server connection (WebSocket) for AI functionality
- Live2D models are loaded from URLs provided by the backend
- Audio is streamed as base64-encoded data with volume arrays for lip sync
- The app uses Chakra UI v3 for the component library
- ESLint is configured with relaxed rules (many checks disabled in .eslintrc.js)

## Hermes UI Gateway Plugin Workflow
- Source-of-truth plugin copy: `plugins/hermes_ui/`
- Live installed plugin target: `/Users/bread/.hermes/plugins/hermes_ui/`
- Always make plugin changes in `plugins/hermes_ui/` first, then copy/deploy them to `/Users/bread/.hermes/plugins/hermes_ui/`.
- Deploy command from repo root:
  ```bash
  rsync -a --delete --exclude '__pycache__/' --exclude '*.pyc' plugins/hermes_ui/ /Users/bread/.hermes/plugins/hermes_ui/
  ```
- Verify both copies:
  ```bash
  /Users/bread/.hermes/hermes-agent/venv/bin/python -m py_compile plugins/hermes_ui/adapter.py
  /Users/bread/.hermes/hermes-agent/venv/bin/python -m py_compile /Users/bread/.hermes/plugins/hermes_ui/adapter.py
  ```
- Restart Hermes gateway after deploying plugin code changes:
  ```bash
  /Users/bread/.hermes/hermes-agent/venv/bin/hermes gateway restart
  ```