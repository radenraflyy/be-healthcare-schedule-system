import { describe, expect, it } from 'vitest';

import { normalizeWorkflowSteps } from '../../src/workflows/workflow.validation.js';

describe('normalizeWorkflowSteps', () => {
  it('trims and preserves step order with optional descriptions', () => {
    expect(
      normalizeWorkflowSteps([
        { title: '  Registrasi ', description: ' Verifikasi data ' },
        { title: 'Pemeriksaan' },
      ]),
    ).toEqual([
      { title: 'Registrasi', description: 'Verifikasi data' },
      { title: 'Pemeriksaan', description: '' },
    ]);
  });

  it('rejects blank titles and more than 50 steps', () => {
    expect(() => normalizeWorkflowSteps([{ title: '  ' }])).toThrow(
      'Judul langkah ke-1 wajib diisi.',
    );
    expect(() =>
      normalizeWorkflowSteps(
        Array.from({ length: 51 }, (_, index) => ({ title: `Step ${index}` })),
      ),
    ).toThrow('Workflow maksimal berisi 50 langkah.');
  });
});
