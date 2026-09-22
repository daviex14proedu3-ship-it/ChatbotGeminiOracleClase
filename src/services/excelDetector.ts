import * as XLSX from 'xlsx';
import { ExcelColumnMapping, ParsedContactRow } from '../types';

export interface ParseResult {
  headers: string[];
  rawRows: Record<string, any>[];
  mappings: ExcelColumnMapping[];
}

/**
 * Parses tab-separated text (pasted from Excel / Google Sheets) or CSV
 */
export function parsePastedExcel(text: string): ParseResult {
  if (!text || text.trim() === '') {
    return { headers: [], rawRows: [], mappings: [] };
  }

  const lines = text.trim().split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return { headers: [], rawRows: [], mappings: [] };
  }

  // Detect delimiter (Tab \t or Comma , or Semicolon ;)
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes(',')) delimiter = ',';

  const headers = firstLine.split(delimiter).map((h, i) => h.trim() || `Columna_${i + 1}`);

  const rawRows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const rowObj: Record<string, any> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = (cols[idx] || '').trim();
    });
    rawRows.push(rowObj);
  }

  const mappings = detectColumnMappings(headers, rawRows);
  return { headers, rawRows, mappings };
}

/**
 * Parses an Excel binary file (.xlsx, .xls, .csv)
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (jsonData.length === 0) {
    return { headers: [], rawRows: [], mappings: [] };
  }

  const headers = Object.keys(jsonData[0]);
  const mappings = detectColumnMappings(headers, jsonData);

  return {
    headers,
    rawRows: jsonData,
    mappings,
  };
}

/**
 * Smart Column Detection Engine: Heuristics on headers & sample values
 */
export function detectColumnMappings(
  headers: string[],
  rows: Record<string, any>[]
): ExcelColumnMapping[] {
  const sampleRows = rows.slice(0, 25);
  let bestPhoneHeader: string | null = null;
  let bestPhoneScore = -1;

  let bestNameHeader: string | null = null;
  let bestNameScore = -1;

  const PHONE_HEADER_REGEX = /(tel|cel|phone|movil|móvil|whatsapp|wa|numero|número|num|fono)/i;
  const NAME_HEADER_REGEX = /(nombre|name|nom|cliente|destinatario|contacto|full_name|apellidos)/i;

  const mappings: ExcelColumnMapping[] = headers.map(header => {
    let phoneScore = 0;
    let nameScore = 0;

    // Header name heuristics
    if (PHONE_HEADER_REGEX.test(header)) phoneScore += 10;
    if (NAME_HEADER_REGEX.test(header)) nameScore += 10;

    // Value pattern heuristics
    for (const row of sampleRows) {
      const val = String(row[header] || '').trim();
      if (!val) continue;

      // Clean digits
      const digitsOnly = val.replace(/[^0-9]/g, '');

      // Check if value looks like a phone number (e.g. 8 to 15 digits)
      if (digitsOnly.length >= 8 && digitsOnly.length <= 16 && (val.startsWith('+') || /^\d+$/.test(digitsOnly))) {
        phoneScore += 2;
      }

      // Check if value looks like a human name (letters, spaces, length > 2, no long digit sequences)
      if (/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(val) && val.length > 2 && digitsOnly.length === 0) {
        nameScore += 1;
      }
    }

    if (phoneScore > bestPhoneScore) {
      bestPhoneScore = phoneScore;
      bestPhoneHeader = header;
    }

    if (nameScore > bestNameScore) {
      bestNameScore = nameScore;
      bestNameHeader = header;
    }

    return {
      originalHeader: header,
      detectedType: 'variable',
      assignedType: 'variable',
      variableName: cleanVariableName(header),
    };
  });

  // Assign the best phone column
  if (bestPhoneHeader && bestPhoneScore >= 5) {
    const phoneMap = mappings.find(m => m.originalHeader === bestPhoneHeader);
    if (phoneMap) {
      phoneMap.detectedType = 'phone';
      phoneMap.assignedType = 'phone';
    }
  }

  // Assign the best name column
  if (bestNameHeader && bestNameScore >= 3 && bestNameHeader !== bestPhoneHeader) {
    const nameMap = mappings.find(m => m.originalHeader === bestNameHeader);
    if (nameMap) {
      nameMap.detectedType = 'name';
      nameMap.assignedType = 'name';
    }
  }

  return mappings;
}

function cleanVariableName(header: string): string {
  return header
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '') || 'variable';
}

/**
 * Builds final contacts list based on assigned column mappings and message template
 */
export function buildCompiledContacts(
  rows: Record<string, any>[],
  mappings: ExcelColumnMapping[],
  templateMessage: string
): { contacts: ParsedContactRow[]; invalidRowsCount: number } {
  const phoneMapping = mappings.find(m => m.assignedType === 'phone');
  const nameMapping = mappings.find(m => m.assignedType === 'name');
  const varMappings = mappings.filter(m => m.assignedType === 'variable');

  const contacts: ParsedContactRow[] = [];
  let invalidRowsCount = 0;

  for (const row of rows) {
    const rawPhone = phoneMapping ? String(row[phoneMapping.originalHeader] || '').trim() : '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 8) {
      invalidRowsCount++;
      continue;
    }

    const name = nameMapping ? String(row[nameMapping.originalHeader] || '').trim() : undefined;

    const variables: Record<string, string> = {};
    varMappings.forEach(vm => {
      variables[vm.variableName] = String(row[vm.originalHeader] || '').trim();
    });

    // Also include name in variables
    if (name) {
      variables['Nombre'] = name;
      variables['nombre'] = name;
    }

    contacts.push({
      phone: cleanPhone,
      name,
      variables,
      raw: row,
    });
  }

  return { contacts, invalidRowsCount };
}

/**
 * Interpolates variables into template: {{Variable}} -> value
 */
export function interpolateTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, value || '');
  }
  return result;
}
