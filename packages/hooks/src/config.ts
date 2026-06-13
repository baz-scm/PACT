// Placeholder — full implementation in hooks-config task
export interface PactConfig {
  enabled: boolean;
  server: string;
  redact: string[];
  nudge: boolean;
  gate_timeout_seconds: number;
}

export const defaultConfig: PactConfig = {
  enabled: true,
  server: 'http://localhost:3000',
  redact: [],
  nudge: true,
  gate_timeout_seconds: 300,
};
