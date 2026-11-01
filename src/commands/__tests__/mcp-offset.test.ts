import {
  parseMcpExportOffset,
  parseMcpImportOffset,
  selectMcpExportOffsetItems,
  selectMcpImportOffsetItems,
} from '../mcp.js';

describe('MCP passport --offset pagination', () => {
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
});
