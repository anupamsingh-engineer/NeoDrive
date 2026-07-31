import "dotenv/config";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const serviceName = process.env.OTEL_SERVICE_NAME || "neodrive-backend";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// Tracing is opt-in: without an OTLP endpoint configured we skip starting the SDK entirely
// rather than exporting to an unreachable default and littering logs with connection errors.
if (otlpEndpoint) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: "2.0.0",
    }),
    traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      sdk.shutdown().finally(() => process.exit(0));
    });
  }
}
