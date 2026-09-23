import type { ChorusProMetadata } from '../../domain/models.js';
export function validateChorusMetadata(metadata: ChorusProMetadata) {
  const missing = (['publicStructureId', 'contractNumber'] as const).filter((field) => !metadata[field]);
  return { result: missing.length ? 'NEEDS_INFORMATION' as const : 'VALID' as const, missing, metadata };
}
