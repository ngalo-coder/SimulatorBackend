import crypto from 'crypto';

/**
 * Generates a stable hash for a given filter object.
 * The hash is created by sorting the filter keys, concatenating key-value pairs,
 * and then generating an MD5 hash of the resulting string.
 * Null or undefined values for filters are treated as empty strings for consistency.
 *
 * @param {object} filters - The filter object (e.g., { program_area: "Cardiology", difficulty: "Hard" }).
 * @returns {string} An MD5 hash string representing the filter context.
 */
export function generateFilterContextHash(filters) {
  if (!filters || typeof filters !== 'object' || Object.keys(filters).length === 0) {
    // Handle empty or invalid filters by returning a default hash or throwing an error
    // For now, returning a hash of an empty string for empty/null filters.
    // Consider if a specific "no_filters_applied" constant string should be hashed.
    return crypto.createHash('md5').update('').digest('hex');
  }

  const sortedKeys = Object.keys(filters).sort();

  const filterString = sortedKeys
    .map(key => {
      const value = filters[key] === null || typeof filters[key] === 'undefined' ? '' : String(filters[key]);
      return `${key}:${value}`;
    })
    .join('|'); // Use a delimiter

  return crypto.createHash('md5').update(filterString).digest('hex');
}

// Other helper functions related to queue logic and UserCaseProgressModel
// can be added here as needed. For example:
// - Functions to fetch user progress
// - Functions to update user progress

// For now, the primary utility is the hash generation.
// More complex database interactions will likely be co-located with controller logic
// or further broken down into specific service functions as the controllers are built.
