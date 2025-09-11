import {
  parseSolrToComposite,
  compositeToSolr,
  canConvertToStructured,
  simplifySolrQuery,
  expandSimplifiedQuery
} from '../../utils/query-parser';
import { Composition } from '../../components/query/fields';
import { IndexedColumnId } from '../../components/result/result';

describe('Query Parser', () => {
  describe('parseSolrToComposite', () => {
    it('should parse simple text query', () => {
      const result = parseSolrToComposite('python');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.FullText,
          query: 'python'
        }]
      });
    });

    it('should parse _text_ field query', () => {
      const result = parseSolrToComposite('_text_:python');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.FullText,
          query: 'python'
        }]
      });
    });

    it('should parse owner field query', () => {
      const result = parseSolrToComposite('owner:yazawa');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.Owner,
          query: 'yazawa'
        }]
      });
    });

    it('should parse MEME field query', () => {
      const result = parseSolrToComposite('lc_cell_memes:fc68b4b4-2927-11e9-b46c-0242ac110002');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.CellMemes,
          query: 'fc68b4b4-2927-11e9-b46c-0242ac110002'
        }]
      });
    });

    it('should parse AND query with two fields', () => {
      const result = parseSolrToComposite('owner:yazawa AND source:pandas');
      expect(result).toEqual({
        composition: Composition.And,
        fields: [
          {
            target: IndexedColumnId.Owner,
            query: 'yazawa'
          },
          {
            target: IndexedColumnId.Cells,
            query: 'pandas'
          }
        ]
      });
    });

    it('should parse OR query with two fields', () => {
      const result = parseSolrToComposite('owner:yazawa OR source:matplotlib');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [
          {
            target: IndexedColumnId.Owner,
            query: 'yazawa'
          },
          {
            target: IndexedColumnId.Cells,
            query: 'matplotlib'
          }
        ]
      });
    });

    it('should return null for complex nested queries', () => {
      const result = parseSolrToComposite('(owner:yazawa OR owner:tanaka) AND source:pandas');
      expect(result).toBeNull();
    });

    it('should return null for unknown fields', () => {
      const result = parseSolrToComposite('unknown_field:value');
      expect(result).toBeNull();
    });

    it('should parse quoted values', () => {
      const result = parseSolrToComposite('owner:"John Doe"');
      expect(result).toEqual({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.Owner,
          query: 'John Doe'
        }]
      });
    });
  });

  describe('compositeToSolr', () => {
    it('should convert single field to Solr query', () => {
      const result = compositeToSolr({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.FullText,
          query: 'python'
        }]
      });
      expect(result).toBe('_text_:python');
    });

    it('should convert owner field to Solr query', () => {
      const result = compositeToSolr({
        composition: Composition.Or,
        fields: [{
          target: IndexedColumnId.Owner,
          query: 'yazawa'
        }]
      });
      expect(result).toBe('owner:yazawa');
    });

    it('should convert multiple fields with AND', () => {
      const result = compositeToSolr({
        composition: Composition.And,
        fields: [
          {
            target: IndexedColumnId.Owner,
            query: 'yazawa'
          },
          {
            target: IndexedColumnId.Cells,
            query: 'pandas'
          }
        ]
      });
      expect(result).toBe('owner:yazawa AND source:pandas');
    });

    it('should convert multiple fields with OR', () => {
      const result = compositeToSolr({
        composition: Composition.Or,
        fields: [
          {
            target: IndexedColumnId.Owner,
            query: 'yazawa'
          },
          {
            target: IndexedColumnId.Cells,
            query: 'matplotlib'
          }
        ]
      });
      expect(result).toBe('owner:yazawa OR source:matplotlib');
    });

    it('should handle empty fields', () => {
      const result = compositeToSolr({
        composition: Composition.Or,
        fields: []
      });
      expect(result).toBe('_text_:*');
    });
  });

  describe('canConvertToStructured', () => {
    it('should return true for simple queries', () => {
      expect(canConvertToStructured('python')).toBe(true);
      expect(canConvertToStructured('_text_:python')).toBe(true);
      expect(canConvertToStructured('owner:yazawa')).toBe(true);
    });

    it('should return true for simple AND/OR queries', () => {
      expect(canConvertToStructured('owner:yazawa AND source:pandas')).toBe(true);
      expect(canConvertToStructured('owner:yazawa OR source:pandas')).toBe(true);
    });

    it('should return false for complex queries', () => {
      expect(canConvertToStructured('(owner:yazawa OR owner:tanaka) AND source:pandas')).toBe(false);
      expect(canConvertToStructured('unknown_field:value')).toBe(false);
    });
  });

  describe('simplifySolrQuery', () => {
    it('should simplify _text_: prefix for simple queries', () => {
      expect(simplifySolrQuery('_text_:python')).toBe('python');
      expect(simplifySolrQuery('_text_:jupyter')).toBe('jupyter');
    });

    it('should not simplify field queries', () => {
      expect(simplifySolrQuery('owner:yazawa')).toBe('owner:yazawa');
      expect(simplifySolrQuery('source:pandas')).toBe('source:pandas');
    });

    it('should not simplify complex queries with _text_', () => {
      expect(simplifySolrQuery('_text_:python AND owner:yazawa')).toBe('_text_:python AND owner:yazawa');
      expect(simplifySolrQuery('_text_:python OR owner:yazawa')).toBe('_text_:python OR owner:yazawa');
    });
  });

  describe('expandSimplifiedQuery', () => {
    it('should expand simple text to _text_: query', () => {
      expect(expandSimplifiedQuery('python')).toBe('_text_:python');
      expect(expandSimplifiedQuery('jupyter')).toBe('_text_:jupyter');
    });

    it('should not expand field queries', () => {
      expect(expandSimplifiedQuery('owner:yazawa')).toBe('owner:yazawa');
      expect(expandSimplifiedQuery('source:pandas')).toBe('source:pandas');
    });

    it('should not expand wildcard', () => {
      expect(expandSimplifiedQuery('*')).toBe('*');
    });

    it('should not expand already expanded queries', () => {
      expect(expandSimplifiedQuery('_text_:python')).toBe('_text_:python');
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve simple queries', () => {
      const queries = [
        'python',
        '_text_:python',
        'owner:yazawa',
        'lc_cell_memes:abc123',
        'owner:yazawa AND source:pandas',
        'owner:yazawa OR source:matplotlib'
      ];

      queries.forEach(query => {
        const composite = parseSolrToComposite(query);
        if (composite) {
          const solr = compositeToSolr(composite);
          const normalized = expandSimplifiedQuery(query);
          // Compare normalized forms
          expect(solr).toBe(normalized.includes(':') ? normalized : `_text_:${normalized}`);
        }
      });
    });
  });
});