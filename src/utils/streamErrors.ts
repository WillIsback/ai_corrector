/**
 * Classify errors surfaced by the OpenAI SDK streaming iterator as a benign
 * stream-teardown race rather than a genuine failure.
 *
 * When vLLM (SGLang) finishes a chat-completion SSE stream, Bun/Node can
 * double-close the response-body ReadableStream controller. The SDK iterator
 * then throws:
 *
 *     TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed
 *
 * at the point where the last SSE frame has already been consumed and
 * `fullContent` holds the complete response. In that situation the stream has
 * successfully delivered all of its data — rethrowing this error turns a
 * completed ~12s stream into an `llm.chat` ERROR span and an SSE `error` event.
 */
const TEARDOWN_MARKER = "Controller is already closed";

export function isStreamTeardownError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.message.includes(TEARDOWN_MARKER)) return true;
  // Node/Bun ERR_INVALID_STATE errors carry the marker on `code` too.
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && code.includes(TEARDOWN_MARKER);
}
