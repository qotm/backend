/**
 * One CSV field (RFC 4180): quoted when it holds a comma, quote or line
 * break. A leading `=`, `+`, `-`, `@`, tab or CR is prefixed with `'`, so a
 * spreadsheet never runs a quote as a formula (CSV injection).
 */
export function csvField(value: string | number | null | undefined) {
	if (value === null || value === undefined) return '';
	let text = String(value);
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (values: (string | number | null | undefined)[]) =>
	`${values.map(csvField).join(',')}\r\n`;
