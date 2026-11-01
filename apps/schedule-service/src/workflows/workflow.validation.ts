import { BadRequestException } from '../../../common/exceptions/index.js';
import type { WorkflowStepInput } from './dto/workflow.input.js';

export type WorkflowStepDraft = { title: string; description: string };

export function normalizeWorkflowSteps(value: unknown): WorkflowStepDraft[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('Daftar langkah workflow wajib diisi.');
  }
  if (value.length > 50) {
    throw new BadRequestException('Workflow maksimal berisi 50 langkah.');
  }
  return value.map((step: WorkflowStepInput, index) => {
    if (!step || typeof step !== 'object') {
      throw new BadRequestException(`Langkah ke-${index + 1} tidak valid.`);
    }
    const title = typeof step.title === 'string' ? step.title.trim() : '';
    const description =
      step.description === undefined
        ? ''
        : typeof step.description === 'string'
          ? step.description.trim()
          : null;
    if (!title) {
      throw new BadRequestException(`Judul langkah ke-${index + 1} wajib diisi.`);
    }
    if (title.length > 120) {
      throw new BadRequestException(`Judul langkah ke-${index + 1} maksimal 120 karakter.`);
    }
    if (description === null || description.length > 500) {
      throw new BadRequestException(`Deskripsi langkah ke-${index + 1} maksimal 500 karakter.`);
    }
    return { title, description };
  });
}
