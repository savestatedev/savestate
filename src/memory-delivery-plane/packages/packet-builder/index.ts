/**
 * Public package entrypoint for the Memory Delivery Plane packet builder.
 * Keep the package path backed by the typed implementation so consumers get
 * the same filtering, prioritization, and token-budget behavior as the core.
 */
export * from '../../packet-builder/index.js';
export { default } from '../../packet-builder/index.js';
