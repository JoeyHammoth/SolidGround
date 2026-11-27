import { SCHEMA_BASE } from "@solid-ground/smoke/status";

/**
 * Canonical machine-readable locations of the published response schemas.
 * `$schema` must resolve to JSON, so these point at the raw files rather than
 * the GitHub blob pages the README and `/llms.txt` link for humans. The base
 * lives in the smoke package because the fixture writer needs it too; ADR 0006
 * records why this is not the `$id` domain yet.
 */
export const GATE_SCHEMA_URL = `${SCHEMA_BASE}/gate.schema.json`;
export const VALIDATION_SCHEMA_URL = `${SCHEMA_BASE}/validation.schema.json`;
export const CONTROLS_SCHEMA_URL = `${SCHEMA_BASE}/controls.schema.json`;
