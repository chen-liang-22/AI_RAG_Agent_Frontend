import type { KnowledgeUploadOptionsResponse } from './api'

export const DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS: KnowledgeUploadOptionsResponse = {
  allowed_file_types: ['txt', 'pdf', 'docx', 'md', 'markdown', 'csv', 'pptx'],
  accept: '.txt,.pdf,.docx,.md,.markdown,.csv,.pptx',
  display_text: 'TXT / PDF / DOCX / MD / MARKDOWN / CSV / PPTX',
  max_file_size_bytes: null,
}

export function normalizeKnowledgeUploadOptions(
  options: KnowledgeUploadOptionsResponse | null | undefined,
): KnowledgeUploadOptionsResponse {
  if (!options) return DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS
  return {
    allowed_file_types: options.allowed_file_types?.length
      ? options.allowed_file_types
      : DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS.allowed_file_types,
    accept: options.accept || DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS.accept,
    display_text: options.display_text || DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS.display_text,
    max_file_size_bytes: options.max_file_size_bytes ?? DEFAULT_KNOWLEDGE_UPLOAD_OPTIONS.max_file_size_bytes,
  }
}
