#!/usr/bin/env node
/**
 * Zero-dependency CLI validator for Contact Form 7 + CF7 Pro Suite markup.
 *
 * Usage:
 *   node validate-cf7.js --skill
 *   node validate-cf7.js --skill --path file.md
 *   node validate-cf7.js --file form.html
 *   echo "..." | node validate-cf7.js
 */

const fs = require('fs');
const path = require('path');

const CF7_TAG_RE = /\[([a-zA-Z0-9_-]+\*?)(?:\s+([^\]]*))?\]/g;
const CF7_SKIP_NAMES = new Set(['submit', 'acceptance']);
const CALC_FUNCS = new Set(['round', 'min', 'max']);

function extractCf7Fields(markup) {
  const fields = new Set();
  let hasSubmit = false;
  let match;

  while ((match = CF7_TAG_RE.exec(markup)) !== null) {
    const rawType = match[1];
    const baseType = rawType.replace('*', '');
    const rest = (match[2] || '').trim();

    if (baseType === 'submit') {
      hasSubmit = true;
      continue;
    }

    const firstToken = rest.split(/\s+/)[0];
    if (firstToken && !firstToken.startsWith('"') && !firstToken.includes(':')) {
      fields.add(firstToken);
    }
  }
  return { fields, hasSubmit };
}

function validateHtmlBalance(markup, errors) {
  const voidTags = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
  const stack = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\/?>/g;
  let match;

  while ((match = tagRe.exec(markup)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    if (voidTags.has(tag) || full.endsWith('/>')) continue;

    if (full.startsWith('</')) {
      if (stack.length === 0 || stack[stack.length - 1] !== tag) {
        errors.push(`Unmatched closing tag </${tag}>`);
      } else {
        stack.pop();
      }
    } else {
      stack.push(tag);
    }
  }

  if (stack.length > 0) {
    errors.push(`Unclosed HTML tag(s): ${stack.map(t => `<${t}>`).join(', ')}`);
  }
}

function validateCf7Markup(markup, label) {
  const errors = [];
  const warnings = [];

  validateHtmlBalance(markup, errors);

  const { fields, hasSubmit } = extractCf7Fields(markup);
  if (!hasSubmit) {
    errors.push('Missing [submit ...] button tag in CF7 form');
  }

  // Validate data-cf7p-show-if / data-cf7p-hide-if field references
  const condRe = /data-cf7p-(?:show|hide)-if="([^"]+)"/g;
  let m;
  while ((m = condRe.exec(markup)) !== null) {
    const expr = m[1];
    const parts = expr.split(/&&|\|\|/);
    for (const part of parts) {
      const condMatch = part.trim().match(/^([a-zA-Z0-9_-]+)\s*(!=|>=|<=|\*=|=|>|<)\s*(.+)$/);
      if (!condMatch) {
        errors.push(`Malformed condition expression: "${part.trim()}"`);
        continue;
      }
      const fieldName = condMatch[1];
      if (!fields.has(fieldName)) {
        errors.push(`Condition references unknown CF7 field "${fieldName}"`);
      }
    }
  }

  // Validate data-cf7p-calc formulas and data-cf7p-target-input
  const calcRe = /data-cf7p-calc="([^"]+)"/g;
  while ((m = calcRe.exec(markup)) !== null) {
    const formula = m[1];
    const ids = formula.match(/[a-zA-Z_][a-zA-Z0-9_-]*/g) || [];
    for (const id of ids) {
      if (CALC_FUNCS.has(id)) continue;
      if (!fields.has(id)) {
        errors.push(`Calculator formula "${formula}" references unknown CF7 field "${id}"`);
      }
    }
  }

  const targetRe = /data-cf7p-target-input="([^"]+)"/g;
  while ((m = targetRe.exec(markup)) !== null) {
    const target = m[1];
    if (!fields.has(target)) {
      errors.push(`data-cf7p-target-input="${target}" does not match any [hidden ${target}] or input field`);
    }
  }

  // Warn if steps exist but fewer than 2
  const stepMatches = markup.match(/data-cf7p-step="/g) || [];
  if (stepMatches.length === 1) {
    warnings.push('Only 1 data-cf7p-step found; multi-step wizard requires at least 2 steps');
  }

  return { label, fieldsCount: fields.size, stepsCount: stepMatches.length, errors, warnings };
}

function extractCodeBlocks(markdown) {
  const re = /```(?:html|cf7)\r?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  let idx = 0;
  while ((match = re.exec(markdown)) !== null) {
    idx++;
    const lineNum = markdown.substring(0, match.index).split('\n').length;
    blocks.push({ code: match[1], index: idx, lineNum });
  }
  return blocks;
}

function resolveDefaultSkillPath() {
  const candidates = [
    path.join(__dirname, '..', 'SKILL.md'),
    path.join(__dirname, 'SKILL.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const args = process.argv.slice(2);

if (args.includes('--skill')) {
  const pathIdx = args.indexOf('--path');
  const skillPath = pathIdx !== -1 && args[pathIdx + 1] ? args[pathIdx + 1] : resolveDefaultSkillPath();
  const md = fs.readFileSync(skillPath, 'utf8');
  const blocks = extractCodeBlocks(md);

  console.log(`=== CF7 Pro Markup Validation (${path.basename(skillPath)}) ===\n`);
  let totalForms = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const { code, index, lineNum } of blocks) {
    if (!code.includes('[submit')) continue;
    totalForms++;
    const res = validateCf7Markup(code, `Code block #${index} (line ${lineNum})`);
    totalErrors += res.errors.length;
    totalWarnings += res.warnings.length;
    if (res.errors.length > 0) {
      console.log(`✗ ${res.label}:`);
      res.errors.forEach(e => console.log(`  - ${e}`));
    }
    res.warnings.forEach(w => console.log(`⚠ ${res.label}: ${w}`));
  }

  if (totalErrors === 0) {
    console.log(`PASSED: All ${totalForms} CF7 Pro form(s) valid (0 errors, ${totalWarnings} warnings)`);
  }
  process.exit(totalErrors > 0 ? 1 : 0);

} else if (args.includes('--file')) {
  const filePath = args[args.indexOf('--file') + 1];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const res = validateCf7Markup(fs.readFileSync(filePath, 'utf8'), filePath);
  printSingle(res);
  process.exit(res.errors.length > 0 ? 1 : 0);

} else {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    if (!input.trim()) {
      console.log('Usage: node validate-cf7.js [--skill [--path file.md] | --file form.html]');
      process.exit(0);
    }
    const res = validateCf7Markup(input, 'stdin');
    printSingle(res);
    process.exit(res.errors.length > 0 ? 1 : 0);
  });
}

function printSingle(res) {
  console.log(`=== CF7 Pro Markup Validation ===\nSource: ${res.label}\nFields: ${res.fieldsCount}, Steps: ${res.stepsCount}`);
  if (res.errors.length === 0) {
    console.log('\nPASSED: CF7 Pro form is valid');
  } else {
    console.log(`\nErrors (${res.errors.length}):`);
    res.errors.forEach(e => console.log(`  ✗ ${e}`));
  }
  res.warnings.forEach(w => console.log(`  ⚠ ${w}`));
}
