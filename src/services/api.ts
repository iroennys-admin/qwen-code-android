// ==========================================
// OpenCode Android - API Service
// ==========================================

import type { AppConfig, StreamChunk, OpenCodeToolCall, ApiMessage, ApiToolCall } from '../types';
import { TOOL_DEFINITIONS } from '../utils/config';
import { registerPlugin, Capacitor } from '@capacitor/core';

const OpenCodeBridge = registerPlugin<any>('OpenCodeBridge');

const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function getProviderConfig(config: AppConfig) {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) throw new Error('No active provider');

  const baseUrl = config.proxyEnabled && provider.proxyBaseUrl
    ? provider.proxyBaseUrl
    : provider.baseUrl;

  const apiKey = provider.apiKey || 'public';

  return { baseUrl, apiKey, provider };
}

// ---- Non-streaming request (for native Android) ----
export async function chatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): Promise<any> {
  const { baseUrl, apiKey, provider } = getProviderConfig(config);

  const body = {
    model: config.activeModel,
    messages,
    tools: TOOL_DEFINITIONS,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };

  if (isNative()) {
    try {
      const result = await OpenCodeBridge.httpRequest({
        url: `${baseUrl}/chat/completions`,
        method: 'POST',
        body: JSON.stringify(body),
        headers: JSON.stringify({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': MOBILE_USER_AGENT,
        }),
        timeout: 180,
      });

      if (result.status >= 400) {
        throw new Error(`API Error ${result.status}: ${result.body?.substring(0, 200)}`);
      }

      return JSON.parse(result.body);
    } catch (err: any) {
      throw new Error(`Request failed: ${err.message}`);
    }
  }

  // Web fallback
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`);
  }

  return await response.json();
}

// ---- Streaming request (for web) ----
export async function* streamChatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const { baseUrl, apiKey } = getProviderConfig(config);

  const body = {
    model: config.activeModel,
    messages,
    tools: TOOL_DEFINITIONS,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  };

  // On native Android, use non-streaming with simulated streaming
  if (isNative()) {
    const fullResponse = await chatCompletion(config, messages);
    const choice = fullResponse.choices?.[0];
    if (!choice) throw new Error('No response from API');

    const content = choice.message?.content || '';
    const thinking = choice.message?.reasoning_content || '';
    const toolCalls = choice.message?.tool_calls;

    // Yield thinking
    if (thinking) {
      yield { type: 'thinking', thinking };
    }

    // Simulate streaming by yielding content in chunks
    if (content) {
      const chunkSize = 50;
      for (let i = 0; i < content.length; i += chunkSize) {
        yield { type: 'content', content: content.substring(i, i + chunkSize) };
      }
    }

    // Yield tool calls
    if (toolCalls) {
      for (const tc of toolCalls) {
        let args = tc.function?.arguments || '{}';
        try { args = JSON.parse(args); } catch {}

        const toolCall: OpenCodeToolCall = {
          id: tc.id,
          type: args.command ? 'shell' : 'file_read',
          name: tc.function?.name || 'unknown',
          params: typeof args === 'string' ? { raw: args } : args,
          status: 'pending',
          requiresApproval: ['shell', 'code_execute', 'rm'].includes(tc.function?.name),
        };
        yield { type: 'tool_call', toolCall };
      }
    }

    yield { type: 'done' };
    return;
  }

  // Web: real SSE streaming
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Content
          if (delta.content) {
            yield { type: 'content', content: delta.content };
          }

          // Thinking/reasoning
          if (delta.reasoning_content) {
            yield { type: 'thinking', thinking: delta.reasoning_content };
          }

          // Tool calls (streaming)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallBuffers.has(idx)) {
                toolCallBuffers.set(idx, {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  args: '',
                });
              }
              const buf = toolCallBuffers.get(idx)!;
              if (tc.id) buf.id = tc.id;
              if (tc.function?.name) buf.name = tc.function.name;
              if (tc.function?.arguments) buf.args += tc.function.arguments;
            }
          }

          // Finish reason
          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const [, buf] of toolCallBuffers) {
              let args: any = {};
              try { args = JSON.parse(buf.args); } catch {}

              const toolCall: OpenCodeToolCall = {
                id: buf.id,
                type: args.command ? 'shell' : 'file_read',
                name: buf.name,
                params: args,
                status: 'pending',
                requiresApproval: ['shell', 'code_execute', 'rm'].includes(buf.name),
              };
              yield { type: 'tool_call', toolCall };
            }
            toolCallBuffers.clear();
          }

          // Usage
          if (parsed.usage) {
            yield {
              type: 'done',
              usage: {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              },
            };
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
