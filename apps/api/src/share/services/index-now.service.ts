import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { CustomConfigService, LoggerService } from 'common/services';

const ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Tells IndexNow's search engines (Bing, Yandex, Seznam, Naver…) that a
 * page changed, so a newly verified quote, a correction or a withdrawal is
 * recrawled within hours rather than whenever. Production only, and only
 * with INDEXNOW_KEY set; a failed ping is logged, never thrown.
 */
@Injectable()
export class IndexNowService {
	constructor(
		private http: HttpService,
		private config: CustomConfigService,
		private logger: LoggerService
	) {}

	/** The quote's page: `/q/8f2k1c`. */
	quote(publicId: string) {
		return this.ping([`/q/${publicId.replace(/^q_/, '')}`]);
	}

	async ping(paths: string[]) {
		const { indexNowKey: key, frontendHost, env } = this.config.app;
		if (!key || env !== 'production' || !paths.length) return false;
		const site = new URL(frontendHost);
		try {
			await firstValueFrom(
				this.http.post(ENDPOINT, {
					host: site.host,
					key,
					keyLocation: `${site.origin}/${key}.txt`,
					urlList: paths.map((p) => `${site.origin}${p}`)
				})
			);
			return true;
		} catch (error) {
			this.logger.warn({ error, paths }, 'IndexNow ping failed');
			return false;
		}
	}
}
