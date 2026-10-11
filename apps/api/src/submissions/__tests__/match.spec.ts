import { normalize } from 'submissions/services';
import { SubmitQuote, quoteText } from 'submissions/dto';

describe('normalize', () => {
	it('ignores case, punctuation and spacing', () => {
		expect(normalize('Make it work, make it right — make it FAST!')).toBe(
			normalize('make it work make it right make it fast')
		);
	});

	it('drops accents, keeps letters beyond ASCII and digits', () => {
		expect(normalize('Ça marche: 97% du temps')).toBe('ca marche 97 du temps');
		expect(normalize('Пример кода')).toBe('пример кода');
	});
});

describe('quote text', () => {
	const text = quoteText();

	it('strips surrounding quotation marks and extra whitespace', () => {
		expect(text.parse('  “Talk is   cheap.”  ')).toBe('Talk is cheap.');
		expect(text.parse('"Show me the code."')).toBe('Show me the code.');
	});

	it('counts the 280-character limit after cleaning', () => {
		expect(text.safeParse(`“${'a'.repeat(280)}”`).success).toBe(true);
		expect(text.safeParse('a'.repeat(281)).success).toBe(false);
	});
});

describe('SubmitQuote', () => {
	it('requires an original’s rights confirmation to be true', () => {
		const base = {
			type: 'original',
			text: 'My own words here.',
			topics: ['learning']
		};
		expect(SubmitQuote.safeParse(base).success).toBe(false);
		expect(SubmitQuote.safeParse({ ...base, rights: false }).success).toBe(
			false
		);
		expect(SubmitQuote.safeParse({ ...base, rights: true }).success).toBe(true);
	});

	it('lets a private quote skip topics', () => {
		expect(
			SubmitQuote.safeParse({ type: 'private', text: 'Just for me.' }).success
		).toBe(true);
	});
});
