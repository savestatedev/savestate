/**
 * Migration Orchestrator
 *
 * Coordinates the three-phase migration process:
 * Extract → Transform → Load
 *
 * Features:
 * - Phase checkpoint/resume capability
 * - Progress tracking
 * - Error recovery
 * - Rollback support
 */

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import type {
  Platform,
  MigrationBundle,
  MigrationState,
  MigrationPhase,
  MigrationCheckpoint,
  MigrationOptions,
  CompatibilityReport,
  Extractor,
  Transformer,
  Loader,
  LoadResult,
} from './types.js';

import { getExtractor } from './extractors/registry.js';
import { getTransformer } from './transformers/registry.js';
import { getLoader } from './loaders/registry.js';

// ─── Events ──────────────────────────────────────────────────

export type MigrationEventType =
  | 'phase:start'
  | 'phase:complete'
  | 'phase:error'
  | 'progress'
  | 'checkpoint'
  | 'complete'
  | 'error';

export interface MigrationEvent {
  type: MigrationEventType;
  phase?: MigrationPhase;
  progress?: number;
  message?: string;
  error?: Error;
  data?: unknown;
}

export type MigrationEventHandler = (event: MigrationEvent) => void;

// ─── Orchestrator ────────────────────────────────────────────

export class MigrationOrchestrator {
  private state: MigrationState;
  private bundle: MigrationBundle | null = null;
  private eventHandlers: MigrationEventHandler[] = [];
  private workDir: string;

  constructor(
    source: Platform,
    target: Platform,
    options: MigrationOptions = {},
  ) {
    const id = this.generateId();
    this.workDir = options.workDir ?? join(process.cwd(), '.savestate', 'migrations', id);

    this.state = {
      id,
      phase: 'pending',
      source,
      target,
      startedAt: new Date().toISOString(),
      phaseStartedAt: new Date().toISOString(),
      checkpoints: [],
      progress: 0,
      options,
    };
  }

  // ─── Public API ────────────────────────────────────────────

  /**
   * Run the full migration pipeline.
   */
  async run(): Promise<LoadResult> {
    await this.ensureWorkDir();

    try {
      // Phase 1: Extract
      await this.runExtractPhase();

      // Phase 2: Transform
      await this.runTransformPhase();

      // Phase 3: Load
      const result = await this.runLoadPhase();

      this.state.phase = 'complete';
      this.state.completedAt = new Date().toISOString();
      await this.saveState();

      this.emit({ type: 'complete', data: result });

      return result;
    } catch (error) {
      this.state.phase = 'failed';
      this.state.error = error instanceof Error ? error.message : String(error);
      await this.saveState();

      this.emit({ type: 'error', error: error instanceof Error ? error : new Error(String(error)) });

      throw error;
    }
  }

  /**
   * Run only the extract phase (useful for debugging/inspection).
   */
  async extract(): Promise<MigrationBundle> {
    await this.ensureWorkDir();
    await this.runExtractPhase();
    return this.bundle!;
  }

  /**
   * Generate compatibility report without running full migration.
   */
  async analyze(): Promise<CompatibilityReport> {
    await this.ensureWorkDir();

    // Extract first if we don't have a bundle
    if (!this.bundle) {
      await this.runExtractPhase();
    }

    const transformer = getTransformer(this.state.source, this.state.target);
    if (!transformer) {
      throw new Error(
        `No transformer available for ${this.state.source} → ${this.state.target}`,
      );
    }

    return transformer.analyze(this.bundle!);
  }

  /**
   * Resume a failed or interrupted migration.
   */
  static async resume(migrationId: string, workDir?: string): Promise<MigrationOrchestrator> {
    const baseDir = workDir ?? join(process.cwd(), '.savestate', 'migrations', migrationId);
    const statePath = join(baseDir, 'state.json');

    if (!existsSync(statePath)) {
      throw new Error(`Migration ${migrationId} not found at ${baseDir}`);
    }

    const stateJson = await readFile(statePath, 'utf-8');
    const state = JSON.parse(stateJson) as MigrationState;

    const orchestrator = new MigrationOrchestrator(state.source, state.target, state.options);
    orchestrator.state = state;
    orchestrator.workDir = baseDir;

    // Load bundle if we have one
    if (state.bundlePath && existsSync(state.bundlePath)) {
      const bundleJson = await readFile(state.bundlePath, 'utf-8');
      orchestrator.bundle = JSON.parse(bundleJson) as MigrationBundle;
    }

    return orchestrator;
  }

  /**
   * Resume and continue the migration from where it left off.
   */
  async continue(): Promise<LoadResult> {
    const lastCheckpoint = this.state.checkpoints[this.state.checkpoints.length - 1];

    if (!lastCheckpoint) {
      // No checkpoint, start from beginning
      return this.run();
    }

    // Resume from the phase after the last checkpoint
    switch (lastCheckpoint.phase) {
      case 'extracting':
        // Extract completed, continue with transform
        await this.loadCheckpoint(lastCheckpoint);
        await this.runTransformPhase();
        return this.runLoadPhase();

      case 'transforming':
        // Transform completed, continue with load
        await this.loadCheckpoint(lastCheckpoint);
        return this.runLoadPhase();

      case 'loading':
        // Load was in progress, need to restart it
        await this.loadCheckpoint(lastCheckpoint);
        return this.runLoadPhase();

      default:
        return this.run();
    }
  }

  /**
   * Clean up migration artifacts.
   */
  async cleanup(): Promise<void> {
    if (existsSync(this.workDir)) {
      await rm(this.workDir, { recursive: true, force: true });
    }
  }

  /**
   * Subscribe to migration events.
   */
  on(handler: MigrationEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index >= 0) this.eventHandlers.splice(index, 1);
    };
  }

  /**
   * Get current migration state.
   */
  getState(): MigrationState {
    return { ...this.state };
  }

  /**
   * Get the migration bundle (if extracted).
   */
  getBundle(): MigrationBundle | null {
    return this.bundle;
  }

  // ─── Phase Runners ─────────────────────────────────────────

  private async runExtractPhase(): Promise<void> {
    this.setPhase('extracting');
    this.emit({ type: 'phase:start', phase: 'extracting', message: 'Starting extraction...' });

    const extractor = getExtractor(this.state.source);
    if (!extractor) {
      throw new Error(`No extractor available for ${this.state.source}`);
    }

    const canExtract = await extractor.canExtract();
    if (!canExtract) {
      throw new Error(`Cannot extract from ${this.state.source} - check authentication`);
    }

    this.bundle = await extractor.extract({
      include: this.state.options.include,
      workDir: this.workDir,
      onProgress: (progress, message) => {
        this.state.progress = progress * 0.33; // Extract is 0-33%
        this.emit({ type: 'progress', progress: this.state.progress, message });
      },
    });

    // Save bundle to disk
    const bundlePath = join(this.workDir, 'bundle.json');
    await writeFile(bundlePath, JSON.stringify(this.bundle, null, 2));
    this.state.bundlePath = bundlePath;

    await this.saveCheckpoint('extracting');
    this.emit({ type: 'phase:complete', phase: 'extracting', message: 'Extraction complete' });
  }

  private async runTransformPhase(): Promise<void> {
    if (!this.bundle) {
      throw new Error('No bundle to transform - run extract phase first');
    }

    this.setPhase('transforming');
    this.emit({ type: 'phase:start', phase: 'transforming', message: 'Starting transformation...' });

    const transformer = getTransformer(this.state.source, this.state.target);
    if (!transformer) {
      throw new Error(
        `No transformer available for ${this.state.source} → ${this.state.target}`,
      );
    }

    this.bundle = await transformer.transform(this.bundle, {
      overflowStrategy: 'summarize',
      onProgress: (progress, message) => {
        this.state.progress = 33 + progress * 0.34; // Transform is 33-67%
        this.emit({ type: 'progress', progress: this.state.progress, message });
      },
    });

    // Update bundle on disk
    const bundlePath = join(this.workDir, 'bundle.json');
    await writeFile(bundlePath, JSON.stringify(this.bundle, null, 2));

    await this.saveCheckpoint('transforming');
    this.emit({ type: 'phase:complete', phase: 'transforming', message: 'Transformation complete' });
  }

  private async runLoadPhase(): Promise<LoadResult> {
    if (!this.bundle) {
      throw new Error('No bundle to load - run extract and transform phases first');
    }

    this.setPhase('loading');
    this.emit({ type: 'phase:start', phase: 'loading', message: 'Starting load...' });

    // Handle dry run
    if (this.state.options.dryRun) {
      const dryRunResult: LoadResult = {
        success: true,
        loaded: {
          instructions: !!this.bundle.contents.instructions,
          memories: this.bundle.contents.memories?.count ?? 0,
          files: this.bundle.contents.files?.count ?? 0,
          customBots: this.bundle.contents.customBots?.count ?? 0,
        },
        warnings: ['Dry run - no changes made'],
        errors: [],
      };

      this.emit({ type: 'phase:complete', phase: 'loading', message: 'Dry run complete' });
      return dryRunResult;
    }

    const loader = getLoader(this.state.target);
    if (!loader) {
      throw new Error(`No loader available for ${this.state.target}`);
    }

    const canLoad = await loader.canLoad();
    if (!canLoad) {
      throw new Error(`Cannot load to ${this.state.target} - check authentication`);
    }

    const result = await loader.load(this.bundle, {
      dryRun: false,
      projectName: `Migrated from ${this.state.source} (${new Date().toISOString().split('T')[0]})`,
      onProgress: (progress, message) => {
        this.state.progress = 67 + progress * 0.33; // Load is 67-100%
        this.emit({ type: 'progress', progress: this.state.progress, message });
      },
    });

    await this.saveCheckpoint('loading');
    this.emit({ type: 'phase:complete', phase: 'loading', message: 'Load complete', data: result });

    return result;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private generateId(): string {
    return `mig_${randomBytes(8).toString('hex')}`;
  }

  private async ensureWorkDir(): Promise<void> {
    await mkdir(this.workDir, { recursive: true });
  }

  private setPhase(phase: MigrationPhase): void {
    this.state.phase = phase;
    this.state.phaseStartedAt = new Date().toISOString();
  }

  private async saveState(): Promise<void> {
    const statePath = join(this.workDir, 'state.json');
    await writeFile(statePath, JSON.stringify(this.state, null, 2));
  }

  private async saveCheckpoint(phase: MigrationPhase): Promise<void> {
    const checkpointId = `checkpoint_${phase}_${Date.now()}`;
    const checkpointPath = join(this.workDir, `${checkpointId}.json`);

    const checkpointData = {
      phase,
      bundle: this.bundle,
      state: this.state,
    };

    const dataStr = JSON.stringify(checkpointData);
    await writeFile(checkpointPath, dataStr);

    const checksum = createHash('sha256').update(dataStr).digest('hex');

    const checkpoint: MigrationCheckpoint = {
      phase,
      timestamp: new Date().toISOString(),
      dataPath: checkpointPath,
      checksum,
    };

    this.state.checkpoints.push(checkpoint);
    await this.saveState();

    this.emit({ type: 'checkpoint', phase, message: `Checkpoint saved: ${checkpointId}` });
  }

  private async loadCheckpoint(checkpoint: MigrationCheckpoint): Promise<void> {
    const dataStr = await readFile(checkpoint.dataPath, 'utf-8');

    // Verify checksum
    const actualChecksum = createHash('sha256').update(dataStr).digest('hex');
    if (actualChecksum !== checkpoint.checksum) {
      throw new Error(`Checkpoint corrupted: ${checkpoint.dataPath}`);
    }

    const data = JSON.parse(dataStr);
    this.bundle = data.bundle;
    // Don't overwrite current state - we want to keep progress info
  }

  private emit(event: MigrationEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Don't let handler errors break the migration
      }
    }
  }
}
