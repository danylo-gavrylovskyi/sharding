import pino from 'pino';
import { LoggingService } from './loggingService.interface';

export class PinoLoggingService implements LoggingService {
	private logger = pino({
		level: 'info',
		transport: undefined,
	});

	constructor() {}

	info(message: string) {
		this.logger.info(message);
	}

	warn(message: string) {
		this.logger.info(message);
	}

	error(message: string) {
		this.logger.info(message);
	}
}
