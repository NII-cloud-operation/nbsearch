import { MarkdownCell } from '@jupyterlab/cells';
import { nbsearchIcon } from '../widgets/icons';

export interface ISearchHandler {
  performSearch: (query: string, timestamp: number) => void;
}

enum SearchType {
  HASHTAG = 'hashtag',
  HEADING = 'heading'
}

export class MarkdownIntervention {
  private searchHandler: ISearchHandler | null = null;
  private cellConnections = new WeakMap<MarkdownCell, void>();

  constructor() {}

  setSearchHandler(handler: ISearchHandler): void {
    this.searchHandler = handler;
  }

  initMarkdownCell(cell: MarkdownCell): void {
    // Skip if already connected
    if (this.cellConnections.has(cell)) {
      return;
    }

    // Mark as connected
    this.cellConnections.set(cell, undefined);

    // Wait for cell to be ready, then process it
    cell.ready.then(() => {
      if (cell.rendered) {
        this.processMarkdownCell(cell);
      }
    });

    // Connect to renderedChanged signal for future updates
    cell.renderedChanged.connect((sender, rendered) => {
      if (rendered) {
        this.processMarkdownCell(cell);
      }
    });

    // Clean up when cell is disposed
    cell.disposed.connect(() => {
      this.cellConnections.delete(cell);
    });
  }

  private processMarkdownCell(cell: MarkdownCell): void {
    const source = cell.model.sharedModel.source;

    // Check if intervention is needed (has hashtags or headings)
    const hasHashtags = /#[^\s#]+/g.test(source);
    const hasHeadings = /^#{1,6}\s+/m.test(source);

    if (!hasHashtags && !hasHeadings) {
      return;
    }

    // Check immediately if already rendered with content
    const existingOutput = cell.node.querySelector('.jp-MarkdownOutput');

    if (existingOutput && existingOutput.innerHTML.trim().length > 0) {
      // Clean up any existing intervention elements before processing
      const existingLinks = existingOutput.querySelectorAll(
        '.nbsearch-heading-link, .nbsearch-hashtag-link'
      );
      existingLinks.forEach(el => el.remove());

      this.processRenderedContent(cell, hasHashtags, hasHeadings);
      return;
    }

    // Set up observer to wait for content
    const observer = new MutationObserver(mutations => {
      const markdownOutput = cell.node.querySelector('.jp-MarkdownOutput');
      if (markdownOutput && markdownOutput.innerHTML.trim().length > 0) {
        // Disconnect first to prevent any additional callbacks
        observer.disconnect();
        // Clean up any existing intervention elements before processing
        const existingLinks = markdownOutput.querySelectorAll(
          '.nbsearch-heading-link, .nbsearch-hashtag-link'
        );
        existingLinks.forEach(el => el.remove());

        this.processRenderedContent(cell, hasHashtags, hasHeadings);
      }
    });

    // Start observing
    observer.observe(cell.node, {
      childList: true,
      subtree: true,
      attributes: false
    });

    // Clean up observer when cell is disposed
    cell.disposed.connect(() => {
      observer.disconnect();
    });
  }

  private processRenderedContent(
    cell: MarkdownCell,
    hasHashtags: boolean,
    hasHeadings: boolean
  ): void {
    const renderedNode = cell.node.querySelector('.jp-MarkdownOutput');
    if (!renderedNode) {
      return;
    }

    if (hasHeadings) {
      this.processHeadings(renderedNode);
    }

    if (hasHashtags) {
      this.processHashtags(renderedNode);
    }
  }

  private processHeadings(renderedNode: Element): void {
    const headers = renderedNode.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headers.forEach((header: Element) => {
      // Skip if already processed
      if (header.querySelector('.nbsearch-heading-link')) {
        return;
      }

      // Get clean heading text (without the ¶ anchor)
      const existingAnchor = header.querySelector('.jp-InternalAnchorLink');
      const headingText = Array.from(header.childNodes)
        .filter(node => !node.isSameNode(existingAnchor))
        .map(node => node.textContent)
        .join('')
        .trim();

      if (!headingText) {
        return;
      }

      // Create search link with SVG icon
      const searchLink = document.createElement('a');
      searchLink.className = 'nbsearch-heading-link';
      searchLink.href = '#';
      searchLink.innerHTML = nbsearchIcon;
      searchLink.style.marginLeft = '0.5em';
      searchLink.style.display = 'inline-block';
      searchLink.style.width = '1em';
      searchLink.style.height = '1em';
      searchLink.style.verticalAlign = 'baseline';
      searchLink.style.textDecoration = 'none';
      searchLink.style.cursor = 'pointer';
      searchLink.style.opacity = '0.5';
      searchLink.title = `Search for: ${headingText}`;

      // Add hover effect
      searchLink.onmouseenter = () => {
        searchLink.style.opacity = '1';
      };
      searchLink.onmouseleave = () => {
        searchLink.style.opacity = '0.5';
      };

      // Add click handler
      searchLink.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerSearch(headingText, SearchType.HEADING);
      };

      // Insert before JupyterLab's anchor or at the end
      if (existingAnchor) {
        header.insertBefore(searchLink, existingAnchor);
      } else {
        header.appendChild(searchLink);
      }
    });
  }

  private processHashtags(renderedNode: Element): void {
    // Process all text nodes to find hashtags
    const walker = document.createTreeWalker(
      renderedNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node => {
          // Skip if parent is already a link or code
          const parent = node.parentElement;
          if (
            parent?.tagName === 'A' ||
            parent?.tagName === 'CODE' ||
            parent?.closest('pre')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          // Check if node contains hashtag
          if (node.textContent && /#[^\s#]+/.test(node.textContent)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodesToProcess: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      nodesToProcess.push(node as Text);
    }

    // Process each text node
    nodesToProcess.forEach(textNode => {
      const text = textNode.textContent || '';
      const parent = textNode.parentElement;
      if (!parent) {
        return;
      }

      // Skip if already processed
      if (parent.querySelector('.nbsearch-hashtag-link')) {
        return;
      }

      // Split text by hashtags and create new elements
      const parts = text.split(/(#[^\s#]+)/g);
      const fragment = document.createDocumentFragment();

      parts.forEach(part => {
        if (part.startsWith('#') && part.length > 1) {
          // Create hashtag text (not clickable)
          const hashtagSpan = document.createElement('span');
          hashtagSpan.textContent = part;
          hashtagSpan.style.color = '#1976d2';
          hashtagSpan.style.fontWeight = '500';
          fragment.appendChild(hashtagSpan);

          // Create search icon with SVG
          const searchLink = document.createElement('span');
          searchLink.className = 'nbsearch-hashtag-link';
          searchLink.innerHTML = nbsearchIcon;
          searchLink.style.marginLeft = '0.25em';
          searchLink.style.display = 'inline-block';
          searchLink.style.width = '1.2em';
          searchLink.style.height = '1.2em';
          searchLink.style.verticalAlign = 'middle';
          searchLink.style.overflow = 'visible';
          searchLink.style.cursor = 'pointer';
          searchLink.style.opacity = '0.5';
          searchLink.title = `Search for: ${part}`;

          // Add hover effect
          searchLink.onmouseenter = () => {
            searchLink.style.opacity = '1';
          };
          searchLink.onmouseleave = () => {
            searchLink.style.opacity = '0.5';
          };

          // Add click handler
          searchLink.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            this.triggerSearch(part, SearchType.HASHTAG);
          };

          fragment.appendChild(searchLink);
        } else if (part) {
          // Regular text
          fragment.appendChild(document.createTextNode(part));
        }
      });

      // Replace the original text node
      parent.replaceChild(fragment, textNode);
    });
  }

  private triggerSearch(query: string, searchType: SearchType): void {
    if (!this.searchHandler) {
      console.warn('No search handler configured');
      // Fallback: try to find and focus the search panel
      this.fallbackSearch(query);
      return;
    }

    // Format queries based on type
    let formattedQuery = query;
    switch (searchType) {
      case SearchType.HASHTAG:
        formattedQuery = `source__markdown__hashtags:"${query}"`;
        break;
      case SearchType.HEADING:
        formattedQuery = `source__markdown__heading:"${query}"`;
        break;
    }

    this.searchHandler.performSearch(formattedQuery, Date.now());
  }

  private fallbackSearch(query: string): void {
    // Try to find and activate the search widget
    const searchWidget = document.querySelector('#nbsearch\\:\\:cellsearch');
    if (searchWidget) {
      // Try to find the search input
      const searchInput = searchWidget.querySelector(
        'input[type="text"], input[type="search"]'
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.focus();

        // Try to trigger search by simulating Enter key
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        });
        searchInput.dispatchEvent(enterEvent);
      }
    } else {
      // Show alert if search widget not found
      console.log(`Search for: ${query}`);
      alert(
        `Search functionality will search for: "${query}"\n\nPlease ensure the search panel is open.`
      );
    }
  }
}
