import { describe, expect, it } from 'vitest';
import { formatScheduleStatusJson, type ScheduleStatus } from '../schedule.js';

const status: ScheduleStatus = {
  enabled: true,
  running: true,
  supported: true,
  platform: 'darwin',
  intervalHours: 6,
  job: 'dev.savestate.autobackup',
  path: '/Users/fixture/Library/LaunchAgents/dev.savestate.autobackup.plist',
};

describe('savestate schedule --json', () => {
  it('prints schedule status as JSON', () => {
    const parsed = JSON.parse(formatScheduleStatusJson(status)) as ScheduleStatus;
    expect(parsed.enabled).toBe(true);
    expect(parsed.running).toBe(true);
    expect(parsed.supported).toBe(true);
    expect(parsed.platform).toBe('darwin');
    expect(parsed.intervalHours).toBe(6);
    expect(parsed.job).toBe('dev.savestate.autobackup');
    expect(parsed.path).toBe('/Users/fixture/Library/LaunchAgents/dev.savestate.autobackup.plist');
  });

  it('records a disabled schedule', () => {
    const parsed = JSON.parse(
      formatScheduleStatusJson({
        ...status,
        enabled: false,
        running: false,
        intervalHours: null,
        path: null,
      }),
    ) as ScheduleStatus;
    expect(parsed.enabled).toBe(false);
    expect(parsed.running).toBe(false);
    expect(parsed.intervalHours).toBeNull();
    expect(parsed.path).toBeNull();
  });
});
