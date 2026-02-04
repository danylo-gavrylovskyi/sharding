import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TracingService } from './tracingService.interface';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import * as grpc from '@grpc/grpc-js';

export class OpenTelemetryTracingService implements TracingService {
	private sdk: NodeSDK;

	constructor() {
		const traceExporter = new OTLPTraceExporter({
			url: 'jaeger:4317',
			credentials: grpc.credentials.createInsecure(),
		});

		const resource = resourceFromAttributes({
			[ATTR_SERVICE_NAME]: process.env.SHARD_NAME,
		});

		this.sdk = new NodeSDK({
			traceExporter,
			instrumentations: [
				getNodeAutoInstrumentations(),
				new HttpInstrumentation(),
				new ExpressInstrumentation(),
			],
			resource,
		});

		try {
			this.sdk.start();
			console.log('Tracing initialized');
		} catch (err) {
			console.error('Error initializing tracing', err);
		}
	}
}
