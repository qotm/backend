import {
	OnQueueEvent,
	QueueEventsHost,
	QueueEventsListener
} from '@nestjs/bullmq';
import { ShareImagesService } from 'share/services';
import { MATCHING_QUEUE } from './submissions.service';

/** What the worker's originality check returns (`checkOriginality`), as far as it matters here. */
type CheckResult = { outcome?: string; publicId?: string } | null | undefined;

/**
 * An original the worker's originality check published went public without
 * a decision here, so nothing else queues its share images: this does, as
 * the check completes, so they are ready before anyone shares it. Every
 * replica hears the event; the render queue drops the duplicates. One missed
 * while the API was down is drawn by the hourly backfill.
 */
@QueueEventsListener(MATCHING_QUEUE)
export class OriginalityEvents extends QueueEventsHost {
	constructor(private share: ShareImagesService) {
		super();
	}

	@OnQueueEvent('completed')
	async completed({ returnvalue }: { returnvalue: unknown }) {
		const result = returnvalue as CheckResult;
		if (result?.outcome === 'published' && result.publicId) {
			await this.share.rerender(result.publicId);
		}
	}
}
