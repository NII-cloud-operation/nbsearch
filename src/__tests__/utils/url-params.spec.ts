import {
  getSearchParamsFromURL,
  updateURLSearchParams,
  searchQueryToURLParams,
  urlParamsToSearchQuery,
  hasSearchParams
} from '../../utils/url-params';
import { SortOrder } from '../../components/result/results';
import { IndexedColumnId } from '../../components/result/result';

describe('URL Parameters', () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;
    // Mock window.location
    delete (window as any).location;
    (window as any).location = {
      href: 'http://localhost:8889/lab',
      search: '',
      toString: () => window.location.href
    };
    // Mock window.history.replaceState
    window.history.replaceState = jest.fn();
  });

  afterEach(() => {
    // Restore original location
    (window as any).location = originalLocation;
  });

  describe('getSearchParamsFromURL', () => {
    it('should parse solrquery parameter', () => {
      window.location.search = '?solrquery=owner:yazawa';
      const params = getSearchParamsFromURL();
      expect(params.solrquery).toBe('owner:yazawa');
    });

    it('should parse sort parameter', () => {
      window.location.search = '?sort=mtime desc';
      const params = getSearchParamsFromURL();
      expect(params.sort).toBe('mtime desc');
    });

    it('should parse numeric parameters', () => {
      window.location.search = '?start=10&limit=50&size=0&numFound=100';
      const params = getSearchParamsFromURL();
      expect(params.start).toBe(10);
      expect(params.limit).toBe(50);
      expect(params.size).toBe(0);
      expect(params.numFound).toBe(100);
    });

    it('should parse nbsearch parameter', () => {
      window.location.search = '?nbsearch=yes';
      const params = getSearchParamsFromURL();
      expect(params.nbsearch).toBe('yes');
    });

    it('should handle empty parameters', () => {
      window.location.search = '';
      const params = getSearchParamsFromURL();
      expect(params).toEqual({});
    });
  });

  describe('urlParamsToSearchQuery', () => {
    it('should convert solrquery to queryString', () => {
      const query = urlParamsToSearchQuery({
        solrquery: 'owner:yazawa AND source:pandas'
      });
      expect(query.queryString).toBe('owner:yazawa AND source:pandas');
    });

    it('should parse sort format', () => {
      const query = urlParamsToSearchQuery({
        sort: 'mtime desc'
      });
      expect(query.sortQuery).toEqual({
        column: 'mtime',
        order: SortOrder.Descending
      });
    });

    it('should handle pagination parameters', () => {
      const query = urlParamsToSearchQuery({
        start: 20,
        limit: 100
      });
      expect(query.pageQuery).toEqual({
        start: 20,
        limit: 100
      });
    });

    it('should use defaults for missing pagination', () => {
      const query = urlParamsToSearchQuery({});
      expect(query.pageQuery).toBeUndefined();

      const queryWithStart = urlParamsToSearchQuery({ start: 10 });
      expect(queryWithStart.pageQuery).toEqual({
        start: 10,
        limit: 50
      });
    });
  });

  describe('searchQueryToURLParams', () => {
    it('should convert queryString to solrquery', () => {
      const params = searchQueryToURLParams({
        queryString: 'owner:yazawa'
      });
      expect(params.solrquery).toBe('owner:yazawa');
      expect(params.nbsearch).toBe('yes');
    });

    it('should convert sortQuery to sort string', () => {
      const params = searchQueryToURLParams({
        queryString: '_text_:*',
        sortQuery: {
          column: IndexedColumnId.Modified,
          order: SortOrder.Descending
        }
      });
      expect(params.sort).toBe('mtime desc');
    });

    it('should include pagination', () => {
      const params = searchQueryToURLParams({
        queryString: '_text_:*',
        pageQuery: {
          start: 10,
          limit: 25
        }
      });
      expect(params.start).toBe(10);
      expect(params.limit).toBe(25);
    });
  });

  describe('hasSearchParams', () => {
    it('should return true when nbsearch=yes', () => {
      window.location.search = '?nbsearch=yes&solrquery=python';
      expect(hasSearchParams()).toBe(true);
    });

    it('should return false when nbsearch is not yes', () => {
      window.location.search = '?nbsearch=no&solrquery=python';
      expect(hasSearchParams()).toBe(false);
    });

    it('should return false when no nbsearch parameter', () => {
      window.location.search = '?solrquery=python';
      expect(hasSearchParams()).toBe(false);
    });
  });

  describe('updateURLSearchParams', () => {
    it('should update URL with new parameters', () => {
      updateURLSearchParams({
        solrquery: 'owner:yazawa',
        limit: 100,
        nbsearch: 'yes'
      });

      expect(window.history.replaceState).toHaveBeenCalled();
      const call = (window.history.replaceState as jest.Mock).mock.calls[0];
      const url = call[2];
      expect(url).toContain('solrquery=owner%3Ayazawa');
      expect(url).toContain('limit=100');
      expect(url).toContain('nbsearch=yes');
    });

    it('should remove default values', () => {
      window.location.search = '?solrquery=test&limit=50';
      updateURLSearchParams({
        solrquery: '_text_:*'
      });

      const call = (window.history.replaceState as jest.Mock).mock.calls[0];
      const url = call[2];
      expect(url).not.toContain('solrquery');
    });
  });
});