# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps + prisma generate + migrate)
npm run setup

# Development server (uses Turbopack)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx

# Reset database
npm run db:reset
```

Tests use Vitest with jsdom and React Testing Library. Test files live in `__tests__` folders co-located with source files.

## Code Style

Use comments sparingly. Only comment complex code.

## Architecture

### Virtual File System (VFS)

The core data model is an **in-memory** file system (`src/lib/file-system.ts`). Generated components exist only in memory—nothing is written to disk. The `VirtualFileSystem` class manages a tree of `FileNode` objects. It serializes to a plain `Record<string, FileNode>` for JSON transport (API requests, Prisma storage).

### Context Layer

Two React contexts coordinate the UI:
- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`): owns the `VirtualFileSystem` instance, exposes CRUD operations, and handles tool call side effects (`handleToolCall`). The `refreshTrigger` counter forces re-renders after mutations.
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`): wraps the Vercel AI SDK `useChat` hook, passes the serialized VFS to each API request, and pipes `onToolCall` events into `FileSystemContext.handleToolCall`.

### AI Integration

`/api/chat` (`src/app/api/chat/route.ts`) is the single API route for generation. It:
1. Prepends a system prompt from `src/lib/prompts/generation.tsx`
2. Reconstructs a `VirtualFileSystem` from the serialized `files` payload
3. Calls `streamText` (Vercel AI SDK) with two tools: `str_replace_editor` and `file_manager`
4. On finish, persists messages + VFS state to the Prisma `Project` if authenticated

**Tools exposed to the model:**
- `str_replace_editor` (`src/lib/tools/str-replace.ts`): view, create, str_replace, insert
- `file_manager` (`src/lib/tools/file-manager.ts`): rename, delete

### Live Preview Pipeline

`PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) renders generated code in a sandboxed `<iframe>` via `srcdoc`. The pipeline:
1. `createImportMap` (`src/lib/transform/jsx-transformer.ts`) — transforms each `.js/.jsx/.ts/.tsx` file with `@babel/standalone`, creates Blob URLs, and builds an ES module import map. Third-party imports are auto-resolved via `https://esm.sh/`. Missing local imports get placeholder modules.
2. `createPreviewHTML` — generates the full HTML document with the import map, collected CSS, and an entry point loader. The preview includes Tailwind CDN and a React ErrorBoundary.

The entry point is looked up in priority order: `/App.jsx`, `/App.tsx`, `/index.jsx`, `/index.tsx`, `/src/App.jsx`, `/src/App.tsx`.

### Authentication

JWT-based sessions via `jose`. `src/lib/auth.ts` handles token creation/verification (server-only). Sessions are stored in an `auth-token` HttpOnly cookie. `src/middleware.ts` protects `/api/projects` and `/api/filesystem`. Anonymous users can use the app without any account.

### Provider / Mock Mode

`src/lib/provider.ts` exports `getLanguageModel()`. When `ANTHROPIC_API_KEY` is absent, it returns a `MockLanguageModel` that streams static multi-step tool calls, demonstrating the UI without API costs. When the key is present, it uses `claude-haiku-4-5` via `@ai-sdk/anthropic`.

### Database

Prisma with SQLite (`prisma/dev.db`). The schema is defined in `prisma/schema.prisma` — reference it whenever you need to understand the structure of data stored in the database. Generated Prisma client lives in `src/generated/prisma/` (do not edit manually).

### Node Compatibility

`node-compat.cjs` is required before Next.js starts (via `NODE_OPTIONS='--require ./node-compat.cjs'`) to polyfill Node.js globals needed at runtime.
