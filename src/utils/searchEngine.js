import natural from 'natural';

/**
 * Search Engine Utilities
 * Provides text indexing and search capabilities for resource integration
 */
class SearchEngine {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.stemmer = natural.PorterStemmer;
  }

  /**
   * Create search index for a collection of documents
   * @param {Array} documents - Documents to index
   * @param {Array} fields - Fields to include in index
   * @returns {Object} - Search index
   */
  createIndex(documents, fields = ['title', 'content']) {
    const index = {
      documents: [],
      terms: new Map(),
      documentCount: 0
    };

    documents.forEach((doc, docIndex) => {
      index.documents.push(doc);
      index.documentCount++;

      const documentTerms = new Set();

      fields.forEach(field => {
        if (doc[field]) {
          const tokens = this.tokenizeText(doc[field]);
          tokens.forEach(token => {
            documentTerms.add(token);
            
            if (!index.terms.has(token)) {
              index.terms.set(token, {
                documentFrequency: 0,
                postings: new Map()
              });
            }

            const termData = index.terms.get(token);
            if (!termData.postings.has(docIndex)) {
              termData.postings.set(docIndex, 0);
              termData.documentFrequency++;
            }
            termData.postings.set(docIndex, termData.postings.get(docIndex) + 1);
          });
        }
      });

      // Store document length for normalization
      doc._searchMetadata = {
        length: documentTerms.size,
        terms: Array.from(documentTerms)
      };
    });

    return index;
  }

  /**
   * Tokenize and normalize text
   * @param {string} text - Text to tokenize
   * @returns {Array} - Tokenized terms
   */
  tokenizeText(text) {
    return this.tokenizer.tokenize(text.toLowerCase())
      .map(token => this.stemmer.stem(token))
      .filter(token => token.length > 2 && !this.isStopWord(token));
  }

  /**
   * Check if word is a stop word
   * @param {string} word - Word to check
   * @returns {boolean} - True if stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
      'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or',
      'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
      'this', 'to', 'was', 'will', 'with'
    ]);
    return stopWords.has(word);
  }

  /**
   * Search index with query
   * @param {Object} index - Search index
   * @param {string} query - Search query
   * @param {Array} documents - Original documents (for reference)
   * @param {number} limit - Maximum results to return
   * @returns {Array} - Search results with scores
   */
  searchIndex(index, query, documents, limit = 10) {
    const queryTerms = this.tokenizeText(query);
    const scores = new Array(index.documentCount).fill(0);

    queryTerms.forEach(term => {
      if (index.terms.has(term)) {
        const termData = index.terms.get(term);
        const idf = Math.log(index.documentCount / (termData.documentFrequency + 1));

        termData.postings.forEach((termFrequency, docIndex) => {
          const tf = termFrequency / documents[docIndex]._searchMetadata.length;
          scores[docIndex] += tf * idf;
        });
      }
    });

    // Create results with scores
    const results = documents.map((doc, index) => ({
      document: doc,
      score: scores[index]
    }));

    // Filter out zero scores and sort by relevance
    return results
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search with filters
   * @param {Object} index - Search index
   * @param {string} query - Search query
   * @param {Array} documents - Documents to search
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered search results
   */
  searchWithFilters(index, query, documents, filters = {}) {
    let results = this.searchIndex(index, query, documents, 100); // Get more results for filtering

    // Apply filters
    if (filters.type) {
      results = results.filter(result => result.document.type === filters.type);
    }

    if (filters.specialty) {
      results = results.filter(result => result.document.specialty === filters.specialty);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(result =>
        filters.tags.some(tag => result.document.tags.includes(tag))
      );
    }

    if (filters.minDate) {
      const minDate = new Date(filters.minDate);
      results = results.filter(result => new Date(result.document.lastUpdated) >= minDate);
    }

    if (filters.maxDate) {
      const maxDate = new Date(filters.maxDate);
      results = results.filter(result => new Date(result.document.lastUpdated) <= maxDate);
    }

    return results.slice(0, filters.limit || 10);
  }

  /**
   * Get search suggestions
   * @param {Object} index - Search index
   * @param {string} prefix - Prefix for suggestions
   * @param {number} limit - Maximum suggestions
   * @returns {Array} - Search suggestions
   */
  getSearchSuggestions(index, prefix, limit = 5) {
    const suggestions = [];
    const prefixLower = prefix.toLowerCase();

    for (const [term, termData] of index.terms) {
      if (term.startsWith(prefixLower) && termData.documentFrequency > 1) {
        suggestions.push({
          term,
          frequency: termData.documentFrequency,
          score: termData.documentFrequency * term.length // Favor longer, more frequent terms
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(suggestion => suggestion.term);
  }

  /**
   * Get related documents
   * @param {Object} index - Search index
   * @param {Object} document - Reference document
   * @param {number} limit - Maximum related documents
   * @returns {Array} - Related documents
   */
  getRelatedDocuments(index, document, limit = 5) {
    if (!document._searchMetadata) {
      return [];
    }

    const documentTerms = document._searchMetadata.terms;
    const scores = new Array(index.documentCount).fill(0);

    documentTerms.forEach(term => {
      if (index.terms.has(term)) {
        const termData = index.terms.get(term);
        termData.postings.forEach((termFrequency, docIndex) => {
          // Don't include the original document
          if (index.documents[docIndex].id !== document.id) {
            scores[docIndex] += termFrequency;
          }
        });
      }
    });

    // Create results with scores
    const results = index.documents.map((doc, index) => ({
      document: doc,
      score: scores[index]
    }));

    return results
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Build autocomplete index
   * @param {Array} documents - Documents to index for autocomplete
   * @param {Array} fields - Fields to include
   * @returns {Object} - Autocomplete index
   */
  buildAutocompleteIndex(documents, fields = ['title', 'tags']) {
    const autocompleteIndex = new Map();

    documents.forEach(doc => {
      fields.forEach(field => {
        if (doc[field]) {
          const values = Array.isArray(doc[field]) ? doc[field] : [doc[field]];
          
          values.forEach(value => {
            if (typeof value === 'string') {
              const tokens = this.tokenizeText(value);
              tokens.forEach(token => {
                if (!autocompleteIndex.has(token)) {
                  autocompleteIndex.set(token, new Set());
                }
                autocompleteIndex.get(token).add(doc.id);
              });
            }
          });
        }
      });
    });

    return autocompleteIndex;
  }

  /**
   * Get autocomplete suggestions
   * @param {Object} autocompleteIndex - Autocomplete index
   * @param {string} prefix - Prefix to complete
   * @returns {Array} - Autocomplete suggestions
   */
  getAutocompleteSuggestions(autocompleteIndex, prefix) {
    const suggestions = [];
    const prefixLower = prefix.toLowerCase();

    for (const [term, documentIds] of autocompleteIndex) {
      if (term.startsWith(prefixLower)) {
        suggestions.push({
          term,
          popularity: documentIds.size,
          documents: Array.from(documentIds)
        });
      }
    }

    return suggestions
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
  }

  /**
   * Calculate search metrics
   * @param {Array} searchResults - Search results
   * @param {Array} relevantDocuments - Known relevant documents
   * @returns {Object} - Search quality metrics
   */
  calculateSearchMetrics(searchResults, relevantDocuments) {
    const relevantIds = new Set(relevantDocuments.map(doc => doc.id));
    const retrievedIds = new Set(searchResults.map(result => result.document.id));

    const truePositives = searchResults.filter(result =>
      relevantIds.has(result.document.id)
    ).length;

    const falsePositives = searchResults.length - truePositives;
    const falseNegatives = relevantDocuments.length - truePositives;

    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      precision: Math.round(precision * 100),
      recall: Math.round(recall * 100),
      f1Score: Math.round(f1Score * 100),
      truePositives,
      falsePositives,
      falseNegatives
    };
  }

  /**
   * Export search index for persistence
   * @param {Object} index - Search index
   * @returns {Object} - Serializable index
   */
  exportIndex(index) {
    const serializableIndex = {
      documents: index.documents,
      terms: Array.from(index.terms.entries()),
      documentCount: index.documentCount
    };

    return JSON.stringify(serializableIndex);
  }

  /**
   * Import search index from serialized data
   * @param {string} serializedIndex - Serialized index data
   * @returns {Object} - Reconstructed search index
   */
  importIndex(serializedIndex) {
    const data = JSON.parse(serializedIndex);
    
    const index = {
      documents: data.documents,
      terms: new Map(data.terms),
      documentCount: data.documentCount
    };

    return index;
  }

  /**
   * Update index with new documents
   * @param {Object} index - Existing search index
   * @param {Array} newDocuments - New documents to add
   * @param {Array} fields - Fields to index
   * @returns {Object} - Updated search index
   */
  updateIndex(index, newDocuments, fields = ['title', 'content']) {
    newDocuments.forEach((doc, offset) => {
      const docIndex = index.documentCount + offset;
      index.documents.push(doc);
      
      const documentTerms = new Set();

      fields.forEach(field => {
        if (doc[field]) {
          const tokens = this.tokenizeText(doc[field]);
          tokens.forEach(token => {
            documentTerms.add(token);
            
            if (!index.terms.has(token)) {
              index.terms.set(token, {
                documentFrequency: 0,
                postings: new Map()
              });
            }

            const termData = index.terms.get(token);
            if (!termData.postings.has(docIndex)) {
              termData.postings.set(docIndex, 0);
              termData.documentFrequency++;
            }
            termData.postings.set(docIndex, termData.postings.get(docIndex) + 1);
          });
        }
      });

      // Store document length for normalization
      doc._searchMetadata = {
        length: documentTerms.size,
        terms: Array.from(documentTerms)
      };
    });

    index.documentCount += newDocuments.length;
    return index;
  }

  /**
   * Remove documents from index
   * @param {Object} index - Search index
   * @param {Array} documentIds - IDs of documents to remove
   * @returns {Object} - Updated search index
   */
  removeFromIndex(index, documentIds) {
    const idsToRemove = new Set(documentIds);
    
    // Remove documents
    index.documents = index.documents.filter((doc, index) => {
      if (idsToRemove.has(doc.id)) {
        // Update term frequencies
        if (doc._searchMetadata) {
          doc._searchMetadata.terms.forEach(term => {
            if (index.terms.has(term)) {
              const termData = index.terms.get(term);
              if (termData.postings.has(index)) {
                termData.postings.delete(index);
                termData.documentFrequency--;
                
                if (termData.documentFrequency === 0) {
                  index.terms.delete(term);
                }
              }
            }
          });
        }
        return false;
      }
      return true;
    });

    // Reindex remaining documents
    const newIndex = this.createIndex(index.documents);
    return newIndex;
  }
}

// Create singleton instance
const searchEngine = new SearchEngine();

// Export utility functions
export function createIndex(documents, fields) {
  return searchEngine.createIndex(documents, fields);
}

export function searchIndex(index, query, documents, limit) {
  return searchEngine.searchIndex(index, query, documents, limit);
}

export function searchWithFilters(index, query, documents, filters) {
  return searchEngine.searchWithFilters(index, query, documents, filters);
}

export function getSearchSuggestions(index, prefix, limit) {
  return searchEngine.getSearchSuggestions(index, prefix, limit);
}

export function getRelatedDocuments(index, document, limit) {
  return searchEngine.getRelatedDocuments(index, document, limit);
}

export function buildAutocompleteIndex(documents, fields) {
  return searchEngine.buildAutocompleteIndex(documents, fields);
}

export function getAutocompleteSuggestions(autocompleteIndex, prefix) {
  return searchEngine.getAutocompleteSuggestions(autocompleteIndex, prefix);
}

export function calculateSearchMetrics(searchResults, relevantDocuments) {
  return searchEngine.calculateSearchMetrics(searchResults, relevantDocuments);
}

export function exportIndex(index) {
  return searchEngine.exportIndex(index);
}

export function importIndex(serializedIndex) {
  return searchEngine.importIndex(serializedIndex);
}

export function updateIndex(index, newDocuments, fields) {
  return searchEngine.updateIndex(index, newDocuments, fields);
}

export function removeFromIndex(index, documentIds) {
  return searchEngine.removeFromIndex(index, documentIds);
}

export default searchEngine;