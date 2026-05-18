/** Ceiling for OpenAI `chat/completions` calls from edge functions. */
export const OPENAI_FETCH_TIMEOUT_MS = 28_000;

export class OpenAiUpstreamTimeoutError extends Error {
  constructor() {
    super('upstream_timeout');
    this.name = 'OpenAiUpstreamTimeoutError';
  }
}

export async function fetchOpenAiWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = OPENAI_FETCH_TIMEOUT_MS
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OpenAiUpstreamTimeoutError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function openAiTimeoutResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'AI request timed out', code: 'upstream_timeout' }),
    { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
