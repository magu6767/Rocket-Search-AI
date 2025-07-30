# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "Rocket Search AI" that allows users to select text on web pages and get AI-powered explanations instantly. The project uses a monorepo structure with two main components:

- **Frontend** (Chrome Extension): React + TypeScript application located in `/frontend`
- **Backend** (Cloudflare Workers): API service located in `/request-ai`

## Architecture

### Frontend Chrome Extension (`/frontend`)
- **Popup**: Extension icon click interface (`src/popup/`)
- **Content Script**: Injected into web pages to capture selected text (`src/content/`)
- **Background Script**: Manages communication between content script and backend (`src/background/`)
- Uses Shadow DOM to avoid conflicts with host page styles
- Implements Firebase authentication with Google OAuth2
- Built with Vite + @crxjs/vite-plugin for Chrome extension development

### Backend Cloudflare Workers (`/request-ai`)
- Handles API requests from the Chrome extension
- Integrates with Google Gemini AI for text analysis
- Implements Firebase JWT verification for authentication
- Features rate limiting (20 requests per day per user)
- Streams responses using Server-Sent Events (SSE)

### Communication Flow
1. Content Script captures user-selected text
2. Background Script receives data and forwards to Cloudflare Workers
3. Cloudflare Workers processes request with Gemini AI
4. Response streams back through Background Script to Content Script

## Development Commands

### Frontend (`/frontend`)
- **Package Manager**: pnpm
- **Development**: `pnpm dev` (starts Vite dev server on port 5173)
- **Build**: `pnpm build` (TypeScript compilation + Vite build)
- **Lint**: `pnpm lint` (ESLint)
- **Preview**: `pnpm preview`

### Backend (`/request-ai`)
- **Package Manager**: npm
- **Development**: `npm run dev` or `npm start` (Wrangler dev server)
- **Deploy**: `npm run deploy` (Deploy to Cloudflare Workers)
- **Test**: `npm test` (Vitest)
- **Type Generation**: `npm run cf-typegen`

## Configuration Files

### Frontend
- `vite.config.ts`: Contains Chrome extension manifest configuration
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration
- `eslint.config.js`: ESLint configuration
- Requires `.env` file with Firebase and Google OAuth credentials

### Backend
- `wrangler.toml`: Cloudflare Workers configuration with KV namespaces
- `vitest.config.mts`: Vitest testing configuration
- Environment variables needed: GEMINI_API_KEY, Firebase config

## Key Technologies

### Frontend
- React 19 with TypeScript
- Mantine UI components
- Firebase Authentication (web-extension)
- Chrome Extensions API
- Vite build system with CRXJS plugin

### Backend
- Cloudflare Workers runtime
- Google Generative AI (Gemini 2.0 Flash Lite)
- Firebase Auth verification
- Cloudflare KV for caching and rate limiting
- Vitest for testing

## Development Notes

- The project supports internationalization with message files in `_locales/`
- Authentication tokens are cached in Cloudflare KV for performance
- Rate limiting is implemented per user with 24-hour windows
- All communication uses HTTPS and proper CORS headers
- Privacy policy is served from the Workers endpoint at `/privacy-policy`