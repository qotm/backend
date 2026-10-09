import puppeteer from 'puppeteer';
import config from '#app/config.js';

export async function launchBrowser() {
	return await puppeteer.launch({
		headless: true,
		defaultViewport: null,
		userDataDir: './tmp',
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage'
		],
		executablePath: config.puppeteer.executablePath
	});
}
