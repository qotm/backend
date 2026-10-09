import moment from 'moment';

export class DateUtil {
	static parse(value: string, format = 'DD/MM/YYYY'): Date | null {
		const parsed = moment(value, format, true);
		return parsed.isValid() ? parsed.toDate() : null;
	}

	static today() {
		return moment().startOf('date').toDate();
	}

	static previousDay() {
		return moment().startOf('date').subtract(1, 'day').toDate();
	}

	static sevenDays() {
		return moment().startOf('date').subtract(7, 'days').toDate();
	}

	static thirtyDays() {
		return moment().startOf('date').subtract(30, 'days').toDate();
	}

	static oneYear() {
		return moment().startOf('date').subtract(1, 'years').toDate();
	}

	static getWeeks(date: Date) {
		return moment().diff(moment(date), 'weeks');
	}

	static diffDays(date: Date) {
		return moment().startOf('date').diff(moment(date), 'days');
	}

	static diff(a: Date, b: Date) {
		return a.getTime() - b.getTime();
	}

	static dayToSeconds() {
		return 3600 * 24;
	}

	static dayToMilliseconds() {
		return 1000 * DateUtil.dayToSeconds();
	}

	static dayOfWeek(date?: Date) {
		const DOW_WORD: Record<number, string> = {
			1: 'Monday',
			2: 'Tuesday',
			3: 'Wednesday',
			4: 'Thursday',
			5: 'Friday',
			6: 'Saturday',
			7: 'Sunday'
		};

		if (date) return DOW_WORD[moment(date.toISOString()).isoWeekday()];
		return DOW_WORD[moment().isoWeekday()];
	}

	static isWeekday(date: Date) {
		const dayOfWeek = moment(date.toISOString()).isoWeekday();
		return dayOfWeek >= 1 && dayOfWeek <= 5;
	}
}
