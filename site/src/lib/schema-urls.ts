/**
 * Canonical machine-readable locations of the published response schemas.
 * `$schema` must resolve to JSON, so these point at the raw files rather than
 * the GitHub blob pages the README and `/llms.txt` link for humans.
 */
const RAW_BASE =
  "https://raw.githubusercontent.com/JoeyHammoth/SolidGround/main/packages/schema/schemas";

export const GATE_SCHEMA_URL = `${RAW_BASE}/gate.schema.json`;
export const VALIDATION_SCHEMA_URL = `${RAW_BASE}/validation.schema.json`;
export const CONTROLS_SCHEMA_URL = `${RAW_BASE}/controls.schema.json`;
