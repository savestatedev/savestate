import {
  formatMcpExportJson,
  formatMcpImportJson,
  parseMcpExportOffset,
  parseMcpImportOffset,
  selectMcpExportOffsetItems,
  selectMcpExportSnapshots,
  selectMcpImportOffsetItems,
} from '../mcp.js';

describe('MCP passport --offset pagination', () => {
  it('reports the requested page in JSON summaries', () => {
    expect(JSON.parse(formatMcpExportJson({
      agent: 'default', output: 'passport.json', memories: 0, snapshots: 2,
      includeSnapshots: true, written: true, offset: 10, limit: 2,
    }))).toMatchObject({ offset: 10, limit: 2 });
    expect(JSON.parse(formatMcpImportJson({
      input: 'passport.json', sourceAgent: 'source', targetAgent: 'target',
      importedMemories: 2, totalMemories: 20, snapshots: 0, merge: false, offset: 10,
    }))).toMatchObject({ offset: 10 });
  });

  it('validates export offsets and skips before the limit is applied', () => {
    expect(parseMcpExportOffset('2')).toBe(2);
    expect(selectMcpExportOffsetItems(['a', 'b', 'c'], 1)).toEqual(['b', 'c']);
    expect(() => parseMcpExportOffset('-1')).toThrow('non-negative integer up to 1000');
    expect(() => parseMcpExportOffset('1001')).toThrow('non-negative integer up to 1000');
    expect(() => parseMcpExportOffset('2x')).toThrow('non-negative integer up to 1000');
  });

  it('validates import offsets and preserves all items when omitted', () => {
    expect(parseMcpImportOffset('1')).toBe(1);
    expect(selectMcpImportOffsetItems(['a', 'b', 'c'], 2)).toEqual(['c']);
    expect(selectMcpImportOffsetItems(['a', 'b'], undefined)).toEqual(['a', 'b']);
    expect(() => parseMcpImportOffset('1001')).toThrow('non-negative integer up to 1000');
  });

  it('keeps snapshots opt-in while preserving export pagination', () => {
    const snapshots = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(selectMcpExportSnapshots(snapshots, undefined, 1, 1)).toEqual([]);
    expect(selectMcpExportSnapshots(snapshots, true, 1, 1)).toEqual([{ id: 'b' }]);
  });
});
