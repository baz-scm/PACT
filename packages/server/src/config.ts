export interface ServerConfig {
  port: number;
  dataDir: string;
  sweepIntervalMs: number;
  plansTtlHours: number;
  gateTimeoutSeconds: number;
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    dataDir: process.env.DATA_DIR ?? './data',
    sweepIntervalMs: Number(process.env.SWEEP_INTERVAL_MS ?? 5 * 60 * 1000),
    plansTtlHours: Number(process.env.PLANS_TTL_HOURS ?? 24),
    gateTimeoutSeconds: Number(process.env.GATE_TIMEOUT_SECONDS ?? 300),
  };
}
