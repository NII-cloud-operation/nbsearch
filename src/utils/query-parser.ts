import {
  parse,
  LiqeQuery,
  ParserAst,
  TagToken,
  LogicalExpressionToken,
  LiteralExpressionToken,
  FieldToken,
  ImplicitFieldToken
} from 'liqe';
import { CompositeQuery, Composition, ALL_FIELDS } from '../components/query/fields';
import { IndexedColumnId } from '../components/result/result';

// Create a set of supported field names for quick lookup
// These are the fields that can be converted between Solr query and structured query
const SUPPORTED_FIELD_NAMES = new Set(ALL_FIELDS.map(field => field.id));

// Check if a field name is supported in the Search by fields UI
function isSupportedField(fieldName: string): fieldName is IndexedColumnId {
  return SUPPORTED_FIELD_NAMES.has(fieldName as IndexedColumnId);
}

/**
 * Parse a Solr query string and convert it to a CompositeQuery if possible
 * @param solrQuery The Solr query string
 * @returns CompositeQuery if the query can be structured, null otherwise
 */
export function parseSolrToComposite(solrQuery: string): CompositeQuery | null {
  try {
    // Parse using liqe
    const ast = parse(solrQuery);

    // Try to convert AST to CompositeQuery
    return astToComposite(ast);
  } catch (error) {
    console.warn('[Query Parser] Failed to parse Solr query:', error);
    return null;
  }
}

/**
 * Convert a liqe AST to CompositeQuery
 */
function astToComposite(ast: ParserAst | LiqeQuery): CompositeQuery | null {
  // Handle simple field query
  if (ast.type === 'Tag') {
    const tagAst = ast as TagToken;
    const field = tagAst.field as FieldToken | ImplicitFieldToken;
    // Use '_text_' for implicit fields (no field specified)
    const fieldName = field.type === 'Field' ? field.name : '_text_';

    // Check if this field is supported in the Search by fields UI
    if (!isSupportedField(fieldName)) {
      // Unknown or unsupported field, cannot convert to structured query
      return null;
    }

    // Get the value from the expression
    let value = '';
    if (tagAst.expression.type === 'LiteralExpression') {
      const expr = tagAst.expression as LiteralExpressionToken;
      // Preserve quotes for exact match
      if (expr.quoted) {
        value = `"${String(expr.value)}"`;
      } else {
        value = String(expr.value);
      }
    } else if (tagAst.expression.type === 'EmptyExpression') {
      value = '*';
    }

    return {
      composition: Composition.Or,
      fields: [{
        target: fieldName as IndexedColumnId,
        query: value
      }]
    };
  }

  // Handle logical expressions (AND/OR)
  if (ast.type === 'LogicalExpression') {
    const logicalAst = ast as LogicalExpressionToken;
    const operator = logicalAst.operator.operator;
    const composition = operator === 'AND' ? Composition.And : Composition.Or;

    // Collect all field queries
    const fields = [];

    for (const operand of [logicalAst.left, logicalAst.right]) {
      const subComposite = astToComposite(operand);
      if (!subComposite) {
        // If any part cannot be converted, bail out
        return null;
      }

      // Check if compositions match
      if (subComposite.composition !== composition && subComposite.fields.length > 1) {
        // Mixed compositions, cannot represent in simple CompositeQuery
        return null;
      }

      fields.push(...subComposite.fields);
    }

    return {
      composition,
      fields
    };
  }

  // Handle parenthesized expressions
  if (ast.type === 'ParenthesizedExpression') {
    // For now, we don't support complex parenthesized expressions
    return null;
  }

  // Handle unary operators (NOT, -)
  if (ast.type === 'UnaryOperator') {
    // For now, we don't support NOT operators
    return null;
  }

  // Cannot convert complex queries
  return null;
}

/**
 * Convert a CompositeQuery to a Solr query string
 */
export function compositeToSolr(composite: CompositeQuery): string {
  if (composite.fields.length === 0) {
    return '_text_:*';
  }

  if (composite.fields.length === 1) {
    const field = composite.fields[0];
    // field.target is already the Solr field name (IndexedColumnId value)
    return `${field.target}:${field.query}`;
  }

  // Multiple fields
  const operator = composite.composition === Composition.And ? ' AND ' : ' OR ';
  const parts = composite.fields.map(field => {
    // field.target is already the Solr field name (IndexedColumnId value)
    return `${field.target}:${field.query}`;
  });

  return parts.join(operator);
}

/**
 * Check if a Solr query can be represented as a structured query
 */
export function canConvertToStructured(solrQuery: string): boolean {
  return parseSolrToComposite(solrQuery) !== null;
}

/**
 * Simplify a Solr query for URL storage
 * Remove unnecessary _text_: prefix for simple queries
 */
export function simplifySolrQuery(solrQuery: string): string {
  // Simple _text_: queries can be simplified
  if (solrQuery.startsWith('_text_:') && !solrQuery.includes(' AND ') && !solrQuery.includes(' OR ')) {
    return solrQuery.substring(7); // Remove "_text_:"
  }
  return solrQuery;
}

/**
 * Expand a simplified query back to full Solr format
 */
export function expandSimplifiedQuery(query: string): string {
  // If it doesn't contain a field specifier and isn't already a Solr query
  if (!query.includes(':') && query !== '*') {
    return `_text_:${query}`;
  }
  return query;
}