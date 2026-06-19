/**
 * Server-only configuration. Never import this from a "use client" component —
 * API_URL is intentionally not prefixed with NEXT_PUBLIC_ so it never reaches
 * the browser bundle.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:8000";

export const AUTH_COOKIE_NAME = "forge_session";
