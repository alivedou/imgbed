# PERSISTENT INSTRUCTIONS FOR AI CODING AGENTS

Please read this file before performing any modifications. You MUST follow all architectural rules, semantic boundaries, and security schemas below.

## 1. Project Paradigm
- **Full-stack Next.js**: App router running primarily on the Cloudflare Edge Runtime (`export const runtime = 'edge'`).
- **No Refactoring**: Keep files inside `src/app/`, `src/lib/`, and `src/components/` as they are. Never rewrite or rename existing components or delete active features.
- **Incremental Expansion**: Always implement requested changes by appending modular files under `src/components/` or non-overlapping controllers instead of swelling the monolithic files or routes.

## 2. Strict Role-Based Permission Layer (Enforced in Middleware)
You MUST respect the 3 identities defined and enforced in `/src/middleware.js`. Any write or upload endpoint must be guarded:
- **Visitor (Guest, `session === null`)**:
  - Must ONLY be allowed to make read (`GET`) operations.
  - No database insertion, no file deletions, no telegram broadcast uploads. 
  - Any mutating actions (`POST`, `PUT`, `DELETE`) from guests MUST be blocked by the global middleware (which intercepts `/api/:path*` requests) returning a clear `401` JSON payload.
- **User (Authenticated, `session !== null`)**: 
  - Allowed normal system write operations (e.g. uploading images, submitting tags) subject to quota constraints.
- **Admin (`session.user.role === 'admin'`)**:
  - Exclusive access to the `/admin` path and `/api/admin/*` management APIs.

## 3. Tech Stack Requirements & Coding Guidelines
- **Import Statements**: Always use named imports at the top-level. 
- **Icons**: Use exclusively Lucide Icons (`lucide-react`). Do not add manual SVG designs.
- **State Preservation**: Ensure standard client-side reactivity and secure serverside caching where possible.
- **Edge Runtime Declarations**: Ensure API files in `src/app/api/...` maintain the correct `export const runtime = 'edge';` declaration, and NextAuth endpoints also maintain it to prevent runtime compilation discrepancies.
- **No Technology Larping**: Do not add telemetry UI panels, visual port logs (like displaying PORT: 3000), ping monitors, or online indicators unless specifically requested.

Always follow the structural conventions specified in `/docs/architecture.md`.
