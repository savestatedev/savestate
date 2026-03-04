/**
 * Diff Utilities
 * 
 * Low-level diffing functions for semantic diff module.
 */

import { Change } from '../index.js';

/**
 * Diff array elements
 */
export function diffArrays<T>(oldArr: T[], newArr: T[], basePath: string): any[] {
  const changes: any[] = [];
  
  const oldSet = new Set(oldArr);
  const newSet = new Set(newArr);
  
  // Find added items
  for (const item of newArr) {
    if (!oldSet.has(item)) {
      changes.push({
        type: 'added' as const,
        path: basePath,
        newValue: item,
        description: `Added item: ${item}`,
      });
    }
  }
  
  // Find removed items
  for (const item of oldArr) {
    if (!newSet.has(item)) {
      changes.push({
        type: 'removed' as const,
        path: basePath,
        oldValue: item,
        description: `Removed item: ${item}`,
      });
    }
  }
  
  return changes;
}

/**
 * Diff lines of text
 */
export function diffLines(oldText: string, newText: string): Change[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // Simple line-by-line diff
  const changes: Change[] = [];
  
  const maxLen = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      changes.push({
        type: 'add',
        value: newLine,
      });
    } else if (newLine === undefined) {
      changes.push({
        type: 'remove',
        value: oldLine,
      });
    } else if (oldLine !== newLine) {
      changes.push({
        type: 'remove',
        value: oldLine,
      });
      changes.push({
        type: 'add',
        value: newLine,
      });
    } else {
      changes.push({
        type: 'unchanged',
        value: oldLine,
      });
    }
  }
  
  return changes;
}

/**
 * Compute line-based diff with context
 */
export function computeLineDiff(oldText: string, newText: string): { oldLines: string[]; newLines: string[] } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // Simple LCS-based diff
  const lcs = longestCommonSubsequence(oldLines, newLines);
  
  const resultOld: string[] = [];
  const resultNew: string[] = [];
  
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        // Common line
        resultOld.push(oldLines[oldIdx]);
        resultNew.push(newLines[newIdx]);
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // Added line in new
        resultNew.push(newLines[newIdx]);
        newIdx++;
      }
    } else if (oldIdx < oldLines.length) {
      if (!lcs.includes(oldLines[oldIdx])) {
        resultOld.push(oldLines[oldIdx]);
      }
      oldIdx++;
    }
  }
  
  return { oldLines: resultOld, newLines: resultNew };
}

/**
 * Find longest common subsequence
 */
function longestCommonSubsequence<T>(a: T[], b: T[]): T[] {
  const m = a.length;
  const n = b.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find LCS
  const lcs: T[] = [];
  let i = m, j = n;
  
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

export default {
  diffArrays,
  diffLines,
  computeLineDiff,
};
