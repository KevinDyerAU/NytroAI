/**
 * Format a string by removing underscores and capitalizing each word
 * Example: 'knowledge_evidence' -> 'Knowledge Evidence'
 */
export function formatDisplayText(text: string): string {
  if (!text) return '';
  
  return text
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
