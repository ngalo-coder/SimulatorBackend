import crypto from 'crypto';

/**
 * Generates a stable hash for a given filter object.
 */
export function generateFilterContextHash(filters) {
  if (!filters || typeof filters !== 'object' || Object.keys(filters).length === 0) {
    return crypto.createHash('md5').update('').digest('hex');
  }

  const sortedKeys = Object.keys(filters).sort();

  const filterString = sortedKeys
    .map(key => {
      const value = filters[key] == null ? '' : String(filters[key]);
      return `${key}:${value}`;
    })
    .join('|');

  return crypto.createHash('md5').update(filterString).digest('hex');
}
