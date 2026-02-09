/**
 * Compatibility Report Generator
 *
 * Analyzes source data against target platform capabilities and generates
 * a detailed compatibility report showing what will/won't transfer cleanly.
 *
 * Categories:
 * - ✓ Perfect: Transfers without modification
 * - ⚠ Adapted: Requires adaptation/reformatting
 * - ✗ Incompatible: Cannot be migrated
 */

import type {
  MigrationBundle,
  CompatibilityReport,
  CompatibilityItem,
  CompatibilityStatus,
  Platform,
  PlatformCapabilities,
} from './types.js';
import { PLATFORM_CAPABILITIES } from './capabilities.js';

// ─── Platform Names ──────────────────────────────────────────

const PLATFORM_NAMES: Record<Platform, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copilot: 'Microsoft Copilot',
};

// ─── Incompatible Features ───────────────────────────────────

interface FeatureCompatibility {
  sourceFeature: string;
  targetPlatforms: Partial<Record<Platform, 'compatible' | 'adapted' | 'incompatible'>>;
  adaptationNote?: string;
  alternatives?: Partial<Record<Platform, string>>;
}

const FEATURE_COMPATIBILITY: FeatureCompatibility[] = [
  {
    sourceFeature: 'dalle',
    targetPlatforms: {
      claude: 'incompatible',
      gemini: 'adapted',
      copilot: 'adapted',
    },
    alternatives: {
      claude: 'Use MCP image generation tools',
      gemini: 'Use Imagen integration',
      copilot: 'Use DALL-E via Bing',
    },
  },
  {
    sourceFeature: 'code_interpreter',
    targetPlatforms: {
      claude: 'adapted',
      gemini: 'incompatible',
      copilot: 'incompatible',
    },
    adaptationNote: 'Claude uses Artifacts for code execution',
    alternatives: {
      claude: 'Use Claude Artifacts',
    },
  },
  {
    sourceFeature: 'browsing',
    targetPlatforms: {
      claude: 'adapted',
      gemini: 'compatible',
      copilot: 'compatible',
    },
    adaptationNote: 'Claude web browsing works differently',
  },
  {
    sourceFeature: 'plugins',
    targetPlatforms: {
      claude: 'adapted',
      gemini: 'incompatible',
      copilot: 'incompatible',
    },
    adaptationNote: 'Claude uses MCP for external integrations',
    alternatives: {
      claude: 'See Claude MCP alternatives',
    },
  },
];

// ─── Types ───────────────────────────────────────────────────

export interface CompatibilityReportOptions {
  /** Output format */
  format?: 'cli' | 'json';
  /** Include detailed item breakdown */
  detailed?: boolean;
}

// ─── Compatibility Analyzer Class ────────────────────────────

export class CompatibilityAnalyzer {
  private readonly source: Platform;
  private readonly target: Platform;
  private readonly sourceCapabilities: PlatformCapabilities;
  private readonly targetCapabilities: PlatformCapabilities;

  constructor(source: Platform, target: Platform) {
    this.source = source;
    this.target = target;
    this.sourceCapabilities = PLATFORM_CAPABILITIES[source];
    this.targetCapabilities = PLATFORM_CAPABILITIES[target];
  }

  /**
   * Analyze a migration bundle and generate a compatibility report.
   */
  async analyze(bundle: MigrationBundle): Promise<CompatibilityReport> {
    const items: CompatibilityItem[] = [];

    // Analyze each content type
    if (bundle.contents.instructions) {
      items.push(...this.analyzeInstructions(bundle.contents.instructions));
    }

    if (bundle.contents.memories) {
      items.push(...this.analyzeMemories(bundle.contents.memories));
    }

    if (bundle.contents.conversations) {
      items.push(...this.analyzeConversations(bundle.contents.conversations));
    }

    if (bundle.contents.files) {
      items.push(...this.analyzeFiles(bundle.contents.files));
    }

    if (bundle.contents.customBots) {
      items.push(...this.analyzeCustomBots(bundle.contents.customBots));
    }

    // Calculate summary
    const summary = {
      perfect: items.filter((i) => i.status === 'perfect').length,
      adapted: items.filter((i) => i.status === 'adapted').length,
      incompatible: items.filter((i) => i.status === 'incompatible').length,
      total: items.length,
    };

    // Generate recommendations
    const recommendations = generateRecommendations(items, this.source, this.target);

    // Determine feasibility
    const feasibility = this.calculateFeasibility(summary);

    return {
      source: this.source,
      target: this.target,
      generatedAt: new Date().toISOString(),
      summary,
      items,
      recommendations,
      feasibility,
    };
  }

  private analyzeInstructions(
    instructions: NonNullable<MigrationBundle['contents']['instructions']>
  ): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];

    const targetLimit = this.targetCapabilities.instructionLimit;

    if (instructions.length <= targetLimit) {
      items.push({
        type: 'instructions',
        name: 'Custom Instructions',
        status: 'perfect',
        reason: 'Will transfer without modification',
        sourceRef: 'instructions',
      });
    } else {
      items.push({
        type: 'instructions',
        name: 'Custom Instructions',
        status: 'adapted',
        reason: `Content exceeds ${PLATFORM_NAMES[this.target]} limit (${instructions.length}/${targetLimit} chars)`,
        action: 'Content will be summarized or split',
        sourceRef: 'instructions',
      });
    }

    // Check for platform-specific formatting
    if (this.target === 'claude' && instructions.content.includes('```')) {
      // Claude prefers XML for structured instructions
      items.push({
        type: 'instructions',
        name: 'Response Format Rules',
        status: 'adapted',
        reason: 'Claude uses XML tags for structured formatting',
        action: 'Markdown blocks will be converted to XML format',
      });
    }

    return items;
  }

  private analyzeMemories(
    memories: NonNullable<MigrationBundle['contents']['memories']>
  ): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];

    if (memories.count === 0) {
      return items;
    }

    // Claude doesn't have explicit memories - uses project knowledge
    if (this.target === 'claude') {
      items.push({
        type: 'memory',
        name: `Memory Entries (${memories.count} entries)`,
        status: 'adapted',
        reason: 'Claude uses project knowledge instead of explicit memories',
        action: 'Memories will be converted to project knowledge files',
        sourceRef: 'memories',
      });
    } else if (this.targetCapabilities.hasMemory) {
      const targetLimit = this.targetCapabilities.memoryLimit || Infinity;
      if (memories.count <= targetLimit) {
        items.push({
          type: 'memory',
          name: `Memory Entries (${memories.count} entries)`,
          status: 'perfect',
          reason: 'Will transfer as native memories',
          sourceRef: 'memories',
        });
      } else {
        items.push({
          type: 'memory',
          name: `Memory Entries (${memories.count} entries)`,
          status: 'adapted',
          reason: `Exceeds memory limit (${memories.count}/${targetLimit})`,
          action: 'Oldest memories will be consolidated',
          sourceRef: 'memories',
        });
      }
    } else {
      items.push({
        type: 'memory',
        name: `Memory Entries (${memories.count} entries)`,
        status: 'adapted',
        reason: `${PLATFORM_NAMES[this.target]} doesn't support explicit memories`,
        action: 'Memories will be included in system instructions',
        sourceRef: 'memories',
      });
    }

    return items;
  }

  private analyzeConversations(
    conversations: NonNullable<MigrationBundle['contents']['conversations']>
  ): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];

    if (conversations.count === 0) {
      return items;
    }

    // Conversations generally can't be imported, only preserved
    items.push({
      type: 'conversation',
      name: `Conversations (${conversations.count} chats, ${conversations.messageCount} messages)`,
      status: 'adapted',
      reason: 'Conversation history is preserved but cannot be imported as active chats',
      action: 'Conversations will be archived in your snapshot',
      sourceRef: 'conversations',
    });

    return items;
  }

  private analyzeFiles(
    files: NonNullable<MigrationBundle['contents']['files']>
  ): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];

    if (files.count === 0) {
      return items;
    }

    const targetLimit = this.targetCapabilities.fileSizeLimit || Infinity;

    for (const file of files.files) {
      if (file.size > targetLimit) {
        items.push({
          type: 'file',
          name: file.filename,
          status: file.size > targetLimit * 2 ? 'incompatible' : 'adapted',
          reason: `File size (${formatBytes(file.size)}) exceeds ${PLATFORM_NAMES[this.target]} limit (${formatBytes(targetLimit)})`,
          action: file.size > targetLimit * 2 ? 'File cannot be migrated' : 'File may need to be compressed or split',
          sourceRef: `files/${file.id}`,
        });
      } else {
        items.push({
          type: 'file',
          name: file.filename,
          status: 'perfect',
          reason: 'Will transfer without modification',
          sourceRef: `files/${file.id}`,
        });
      }
    }

    return items;
  }

  private analyzeCustomBots(
    customBots: NonNullable<MigrationBundle['contents']['customBots']>
  ): CompatibilityItem[] {
    const items: CompatibilityItem[] = [];

    for (const bot of customBots.bots) {
      // Analyze bot instructions
      if (bot.instructions.length <= this.targetCapabilities.instructionLimit) {
        items.push({
          type: 'customBot',
          name: bot.name,
          status: 'perfect',
          reason: 'Bot configuration will transfer',
          sourceRef: `customBots/${bot.id}`,
        });
      } else {
        items.push({
          type: 'customBot',
          name: bot.name,
          status: 'adapted',
          reason: 'Bot instructions exceed target limit',
          action: 'Instructions will be summarized',
          sourceRef: `customBots/${bot.id}`,
        });
      }

      // Analyze capabilities
      if (bot.capabilities) {
        for (const capability of bot.capabilities) {
          const featureCompat = FEATURE_COMPATIBILITY.find(
            (f) => f.sourceFeature === capability
          );

          if (featureCompat) {
            const status = featureCompat.targetPlatforms[this.target] || 'incompatible';
            const featureName = capability === 'dalle' ? 'DALL-E Integration' : 
                               capability === 'code_interpreter' ? 'Code Interpreter' :
                               capability === 'browsing' ? 'Web Browsing' :
                               capability === 'plugins' ? 'ChatGPT Plugins' : capability;

            items.push({
              type: 'feature',
              name: featureName,
              status: status as CompatibilityStatus,
              reason: status === 'incompatible'
                ? `Not available in ${PLATFORM_NAMES[this.target]}`
                : featureCompat.adaptationNote || 'Works differently in target',
              action: featureCompat.alternatives?.[this.target],
              sourceRef: `customBots/${bot.id}/capabilities/${capability}`,
            });
          }
        }
      }
    }

    return items;
  }

  private calculateFeasibility(summary: CompatibilityReport['summary']): CompatibilityReport['feasibility'] {
    if (summary.total === 0) {
      return 'easy';
    }

    const perfectRatio = summary.perfect / summary.total;
    const incompatibleRatio = summary.incompatible / summary.total;

    if (incompatibleRatio > 0.3) {
      return 'partial';
    }
    if (incompatibleRatio > 0.1 || perfectRatio < 0.5) {
      return 'complex';
    }
    if (perfectRatio > 0.8) {
      return 'easy';
    }
    return 'moderate';
  }
}

// ─── Recommendations Engine ──────────────────────────────────

export function generateRecommendations(
  items: CompatibilityItem[],
  source: Platform,
  target: Platform
): string[] {
  const recommendations: string[] = [];
  const adaptedItems = items.filter((i) => i.status === 'adapted');
  const incompatibleItems = items.filter((i) => i.status === 'incompatible');

  // General recommendations
  if (adaptedItems.length > 0) {
    recommendations.push('Review adapted items before finalizing migration');
  }

  // Plugin/capability recommendations
  const hasPluginIssues = items.some(
    (i) => i.type === 'feature' && 
    (i.name.toLowerCase().includes('plugin') || i.name.toLowerCase().includes('dall-e'))
  );
  if (hasPluginIssues && target === 'claude') {
    recommendations.push('Your ChatGPT plugins won\'t transfer - see Claude MCP alternatives');
  }

  // Memory recommendations
  const memoryItem = items.find((i) => i.type === 'memory');
  if (memoryItem?.status === 'adapted' && target === 'claude') {
    recommendations.push('Memories will be converted to project knowledge - review the mapping');
  }

  // Instruction recommendations
  const instructionItem = items.find((i) => i.type === 'instructions');
  if (instructionItem?.status === 'adapted') {
    recommendations.push('Review and approve the instruction reformatting');
  }

  // File recommendations
  const largeFiles = items.filter((i) => i.type === 'file' && i.status !== 'perfect');
  if (largeFiles.length > 0) {
    recommendations.push(`${largeFiles.length} file(s) may need manual handling due to size limits`);
  }

  // Incompatible feature recommendations
  if (incompatibleItems.length > 0) {
    const alternatives = incompatibleItems
      .filter((i) => i.action)
      .map((i) => i.action as string);
    
    if (alternatives.length > 0) {
      recommendations.push(...new Set(alternatives)); // Deduplicate
    }
  }

  return recommendations;
}

// ─── Report Formatters ───────────────────────────────────────

export function formatReport(report: CompatibilityReport): string {
  const lines: string[] = [];
  const sourceName = PLATFORM_NAMES[report.source] || report.source;
  const targetName = PLATFORM_NAMES[report.target] || report.target;

  // Header
  lines.push('╭─────────────────────────────────────────────────────────────╮');
  lines.push(`│  Migration: ${sourceName} → ${targetName}`.padEnd(62) + '│');
  lines.push('├─────────────────────────────────────────────────────────────┤');
  lines.push(`│  ✓ ${report.summary.perfect} items will transfer perfectly`.padEnd(62) + '│');
  lines.push(`│  ⚠ ${report.summary.adapted} items require adaptation`.padEnd(62) + '│');
  lines.push(`│  ✗ ${report.summary.incompatible} items cannot be migrated`.padEnd(62) + '│');
  lines.push('╰─────────────────────────────────────────────────────────────╯');
  lines.push('');

  // Group items by type
  const groupedItems = groupItemsByType(report.items);

  for (const [type, items] of Object.entries(groupedItems)) {
    const typeName = formatTypeName(type);
    lines.push(typeName);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isLast = i === items.length - 1;
      const prefix = isLast ? '  └─' : '  ├─';
      const symbol = getStatusSymbol(item.status);

      lines.push(`${prefix} ${symbol} ${item.name} (${item.reason})`);
    }

    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('Recommendations:');
    report.recommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
    lines.push('');
  }

  // Feasibility
  lines.push(`Feasibility: ${formatFeasibility(report.feasibility)}`);

  return lines.join('\n');
}

export function formatReportJson(report: CompatibilityReport): string {
  return JSON.stringify(report, null, 2);
}

// ─── Convenience Function ────────────────────────────────────

export async function analyzeCompatibility(
  bundle: MigrationBundle,
  target: Platform,
  options?: CompatibilityReportOptions
): Promise<CompatibilityReport> {
  const source = bundle.source.platform;
  const analyzer = new CompatibilityAnalyzer(source, target);
  return analyzer.analyze(bundle);
}

// ─── Helper Functions ────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getStatusSymbol(status: CompatibilityStatus): string {
  switch (status) {
    case 'perfect':
      return '✓';
    case 'adapted':
      return '⚠';
    case 'incompatible':
      return '✗';
  }
}

function formatTypeName(type: string): string {
  const names: Record<string, string> = {
    instructions: 'Custom Instructions',
    memory: 'Memories',
    conversation: 'Conversations',
    file: 'Files',
    customBot: 'Custom Bots/GPTs',
    feature: 'Features/Capabilities',
  };
  return names[type] || type;
}

function formatFeasibility(feasibility: CompatibilityReport['feasibility']): string {
  switch (feasibility) {
    case 'easy':
      return '✓ Easy - Most items transfer cleanly';
    case 'moderate':
      return '⚠ Moderate - Some items need adaptation';
    case 'complex':
      return '⚠ Complex - Significant adaptation required';
    case 'partial':
      return '✗ Partial - Some items cannot be migrated';
  }
}

function groupItemsByType(items: CompatibilityItem[]): Record<string, CompatibilityItem[]> {
  return items.reduce((groups, item) => {
    const type = item.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(item);
    return groups;
  }, {} as Record<string, CompatibilityItem[]>);
}

// ─── CLI Command Handler ─────────────────────────────────────

export interface CompatibilityCommandOptions {
  from?: string;
  to?: string;
  json?: boolean;
  dryRun?: boolean;
}

export async function compatibilityCommand(options: CompatibilityCommandOptions): Promise<void> {
  // This would be integrated with the CLI framework
  // For now, we export it for integration
  console.log('Compatibility analysis command');
  console.log('Options:', options);
}
