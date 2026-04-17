---
name: Auth stack and design system
description: LeetCode Patterns uses Supabase GitHub OAuth, React 19, plain CSS with BEM-style class names for auth components
type: project
---

Auth stack: Supabase Auth with GitHub OAuth provider, session managed via `useAuth` hook in `src/hooks/useAuth.js`.

**Why:** The app syncs LeetCode problem-solving progress to a Cloudflare Worker backend; auth is the gating mechanism for cloud sync.

**How to apply:** Any auth UI changes must preserve the Supabase signInWithOAuth / signOut flow. The `useSync` hook depends on `user`, `session`, and `session.access_token` being passed through. CSS uses plain CSS custom properties (no Tailwind, no CSS modules), with a light/dark theme toggle via `[data-theme="dark"]` attribute on `<html>`.
