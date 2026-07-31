/**
 * Minimal dependency-free CSV parser.
 * Handles quoted fields, embedded delimiters/newlines, escaped quotes and BOM.
 */

export type CsvRow = string[];

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Guess the delimiter by counting occurrences outside quotes on the first lines. */
export function detectDelimiter(text: string): string {
  const candidates = [',', ';', '\t', '|'];
  const sample = stripBom(text).split(/\r?\n/).slice(0, 5).join('\n');
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i++) {
      const ch = sample[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter: string): CsvRow[] {
  const src = stripBom(text);
  const rows: CsvRow[] = [];
  let field = '';
  let row: CsvRow = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0].trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i++;
      pushRow();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) pushRow();

  return rows;
}

/** Guess a date format from a set of sample values. */
export function guessDateFormat(samples: string[]): 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' {
  let firstOver12 = false;
  let secondOver12 = false;
  let isoLike = false;

  for (const raw of samples) {
    const digits = (raw || '').split(/[^0-9]+/).filter(Boolean);
    if (digits.length < 3) continue;
    if (digits[0].length === 4) {
      isoLike = true;
      continue;
    }
    if (Number(digits[0]) > 12) firstOver12 = true;
    if (Number(digits[1]) > 12) secondOver12 = true;
  }

  if (isoLike) return 'YYYY-MM-DD';
  if (secondOver12) return 'MM/DD/YYYY';
  if (firstOver12) return 'DD/MM/YYYY';
  return 'DD/MM/YYYY';
}

const HEADER_HINTS: Record<string, string[]> = {
  date: ['date', 'transaction date', 'posted date', 'post date', 'date de transaction', 'date d\u2019op\u00e9ration'],
  name: ['description', 'name', 'details', 'narrative', 'memo', 'libell\u00e9', 'description originale'],
  amount: ['amount', 'montant', 'value', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'd\u00e9bit', 'retrait', 'money out'],
  credit: ['credit', 'deposit', 'cr\u00e9dit', 'd\u00e9p\u00f4t', 'money in'],
  merchant_name: ['merchant', 'payee', 'commer\u00e7ant'],
  notes: ['notes', 'note', 'comment', 'reference'],
  currency: ['currency', 'devise', 'iso currency'],
};

/** Suggest a header -> field mapping based on common bank export column names. */
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<number>();

  for (const [field, hints] of Object.entries(HEADER_HINTS)) {
    let matchIndex = -1;
    headers.forEach((h, idx) => {
      if (matchIndex !== -1 || used.has(idx)) return;
      const normalized = h.trim().toLowerCase();
      if (hints.some(hint => normalized === hint)) matchIndex = idx;
    });
    if (matchIndex === -1) {
      headers.forEach((h, idx) => {
        if (matchIndex !== -1 || used.has(idx)) return;
        const normalized = h.trim().toLowerCase();
        if (hints.some(hint => normalized.includes(hint))) matchIndex = idx;
      });
    }
    if (matchIndex !== -1) {
      mapping[field] = String(matchIndex);
      used.add(matchIndex);
    }
  }

  return mapping;
}
