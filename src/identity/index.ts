/**
 * Identity Module (Issue #92)
 *
 * Provides agent identity schema, storage, and versioning.
 */

export {
  // Schema
  AgentIdentity,
  AgentIdentitySchema,
  ToolReference,
  ToolReferenceSchema,
  IDENTITY_SCHEMA_VERSION,
  CORE_IDENTITY_FIELDS,
  CoreIdentityField,
  validateIdentity,
  safeValidateIdentity,
  createIdentity,
  getJsonSchema,
} from './schema.js';

export {
  // Storage
  IDENTITY_FILENAME,
  LOCAL_IDENTITY_PATH,
  IdentityVersion,
  IdentityLoadResult,
  loadIdentityFromArchive,
  storeIdentityInArchive,
  loadIdentityFromFile,
  saveIdentityToFile,
  loadLocalIdentity,
  saveLocalIdentity,
  initializeIdentity,
  updateIdentityField,
  computeIdentityHash,
  identitiesEqual,
  getIdentityVersion,
} from './store.js';
