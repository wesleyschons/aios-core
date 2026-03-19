'use strict';

/**
 * FrontmatterSerializer — Parse and serialize YAML frontmatter in markdown files.
 *
 * Format:
 *   ---
 *   key: value
 *   ---
 *   Body content here
 */

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

class FrontmatterSerializer {
  /**
   * Parse a markdown string with YAML frontmatter.
   * @param {string} content - Raw markdown content
   * @returns {{frontmatter: object, body: string}}
   */
  parse(content) {
    if (!content || typeof content !== 'string') {
      return { frontmatter: {}, body: '' };
    }

    const trimmed = content.trim();
    const match = trimmed.match(FRONTMATTER_REGEX);

    if (!match) {
      return { frontmatter: {}, body: trimmed };
    }

    const yamlBlock = match[1];
    const body = (match[2] || '').trim();
    const frontmatter = this._parseYaml(yamlBlock);

    return { frontmatter, body };
  }

  /**
   * Serialize frontmatter object and body into markdown with YAML frontmatter.
   * @param {object} frontmatter - Frontmatter fields
   * @param {string} [body=''] - Body content
   * @returns {string} Complete markdown document
   */
  serialize(frontmatter, body = '') {
    if (!frontmatter || typeof frontmatter !== 'object') {
      return body;
    }

    const yaml = this._serializeYaml(frontmatter);
    const parts = ['---', yaml, '---'];

    if (body) {
      parts.push('', body);
    }

    return parts.join('\n');
  }

  /**
   * Extract only frontmatter from content (L1 resolution).
   * @param {string} content
   * @returns {object} Frontmatter object
   */
  extractFrontmatter(content) {
    return this.parse(content).frontmatter;
  }

  /**
   * Extract L0 summary from frontmatter.
   * @param {object} frontmatter
   * @returns {{id: string, type: string, summary: string, status: string, updated: string}}
   */
  toL0(frontmatter) {
    return {
      id: frontmatter.id || '',
      type: frontmatter.type || '',
      summary: frontmatter.summary || '',
      status: frontmatter.status || '',
      updated: frontmatter.updated || frontmatter.date || '',
    };
  }

  /**
   * Recursive YAML parser for frontmatter.
   * Supports: strings, numbers, booleans, arrays, nested objects (multi-level).
   * @param {string} yaml
   * @returns {object}
   * @private
   */
  _parseYaml(yaml) {
    const lines = yaml.split('\n');
    return this._parseBlock(lines, 0, 0).value;
  }

  /**
   * Parse a block of YAML lines at a given indentation level.
   * @private
   */
  _parseBlock(lines, startIdx, indent) {
    const result = {};
    let i = startIdx;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      // Check indentation - if less than expected, this block is done
      const lineIndent = line.search(/\S/);
      if (lineIndent < indent) break;
      if (lineIndent > indent && indent > 0) break;

      // Key: value pair
      const keyMatch = line.match(/^(\s*)([a-zA-Z_][\w_-]*):\s*(.*)$/);
      if (keyMatch) {
        const keyIndent = keyMatch[1].length;
        if (keyIndent !== indent) { i++; continue; }

        const key = keyMatch[2];
        const rawValue = keyMatch[3].trim();

        if (rawValue && rawValue !== '[]') {
          // Inline value
          if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
            result[key] = this._parseInlineArray(rawValue);
          } else {
            result[key] = this._parseValue(rawValue);
          }
          i++;
        } else {
          // Check what follows: array, object, or empty
          const nextLine = lines[i + 1] || '';
          const nextTrimmed = nextLine.trimStart();
          const nextIndent = nextLine.search(/\S/);

          if (nextIndent > indent && nextTrimmed.startsWith('- ')) {
            // Array follows
            const arr = [];
            i++;
            while (i < lines.length) {
              const aLine = lines[i];
              if (!aLine.trim()) { i++; continue; }
              const aIndent = aLine.search(/\S/);
              if (aIndent <= indent) break;
              const arrMatch = aLine.match(/^(\s+)-\s+(.*)$/);
              if (arrMatch && arrMatch[1].length === nextIndent) {
                arr.push(this._parseValue(arrMatch[2].trim()));
                i++;
              } else {
                break;
              }
            }
            result[key] = arr;
          } else if (nextIndent > indent && nextTrimmed.match(/^[a-zA-Z_]/)) {
            // Nested object follows
            const nested = this._parseBlock(lines, i + 1, nextIndent);
            result[key] = nested.value;
            i = nested.endIdx;
          } else {
            result[key] = rawValue === '[]' ? [] : null;
            i++;
          }
        }
      } else {
        i++;
      }
    }

    return { value: result, endIdx: i };
  }

  /**
   * Parse a single YAML value.
   * @param {string} raw
   * @returns {*}
   * @private
   */
  _parseValue(raw) {
    if (raw === '' || raw === 'null' || raw === '~') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // Quoted string
    if ((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }

    // Number
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') return num;

    return raw;
  }

  /**
   * Parse inline YAML array: [a, b, c]
   * @param {string} raw
   * @returns {Array}
   * @private
   */
  _parseInlineArray(raw) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map(item => this._parseValue(item.trim()));
  }

  /**
   * Serialize an object into YAML string.
   * @param {object} obj
   * @param {number} [indent=0]
   * @returns {string}
   * @private
   */
  _serializeYaml(obj, indent = 0) {
    const prefix = ' '.repeat(indent);
    const lines = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;

      if (value === null) {
        lines.push(`${prefix}${key}: null`);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${prefix}${key}: []`);
        } else if (value.every(v => typeof v !== 'object' || v === null)) {
          // Simple array — use block style
          lines.push(`${prefix}${key}:`);
          for (const item of value) {
            lines.push(`${prefix}  - ${this._serializeValue(item)}`);
          }
        } else {
          lines.push(`${prefix}${key}: []`);
        }
      } else if (typeof value === 'object') {
        lines.push(`${prefix}${key}:`);
        lines.push(this._serializeYaml(value, indent + 2));
      } else {
        lines.push(`${prefix}${key}: ${this._serializeValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Serialize a single value for YAML output.
   * @param {*} value
   * @returns {string}
   * @private
   */
  _serializeValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);

    const str = String(value);
    // Quote strings that contain special chars or look like other types
    if (str.includes(':') || str.includes('#') || str.includes('[') ||
        str.includes('{') || str === 'true' || str === 'false' ||
        str === 'null' || str === '' || !isNaN(Number(str))) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }
}

module.exports = { FrontmatterSerializer };
