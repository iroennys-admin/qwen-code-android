// ==========================================
// OpenCode Android v2 - API Service
// Supports OpenAI-compatible and Anthropic providers.
// ==========================================

import type { AppConfig, StreamChunk, OpenCodeToolCall, ApiMessage, Provider } from '../types';
import { TOOL_DEFINITIONS, APPROVAL_REQUIRED_TOOLS } from '../utils/config';
import { registerPlugin, Capacitor } from '@capacitor/core';

const OpenCodeBridge = registerPlugin<any>('OpenCodeBridge');

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';

export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export interface ResolvedProvider {
  baseUrl: string;
  apiKey: string;
  provider: Provider;
}

export function getProviderConfig(config: AppConfig): ResolvedProvider {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) throw new Error('No hay proveedor activo configurado.');
  const baseUrl = (config.proxyEnabled && provider.proxyBaseUrl) ? provider.proxyBaseUrl : provider.baseUrl;
  const apiKey = provider.apiKey || '';
  return { baseUrl, apiKey, provider };
}

function buildHeaders(provider: Provider, apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': MOBILE_UA,
    'Accept': 'application/json',
  };
  if (provider.style === 'anthropic') {
    if (apiKey) h['x-api-key'] = apiKey;
    h['anthropic-version'] = '2023-06-01';
  } else if (provider.id === 'github') {
    if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
    h['api-key'] = apiKey;
  } else {
    if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider.extraHeaders) Object.assign(h, provider.extraHeaders);
  return h;
}

function isToolApprovalRequired(name: string): boolean {
  return APPROVAL_REQUIRED_TOOLS.has(name);
}

function guessToolType(name: string, _args: any): string {
  return name;
}

// =========================================================
// OpenAI-style request (streaming SSE + non-streaming)
// =========================================================
async function* streamOpenAI(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const { baseUrl, apiKey, provider } = getProviderConfig(config);

  const body: any = {
    model: config.activeModel,
    messages,
    tools: TOOL_DEFINITIONS,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: config.streaming,
  };
  if (provider.extraBody) Object.assign(body, provider.extraBody);
  if (config.enableThinkingMode && provider.id === 'zai') {
    body.thinking = { type: 'enabled' };
  }

  const url = `${baseUrl}/chat/completions`;
  const headers = buildHeaders(provider, apiKey);

  // ---- Native: non-streaming with simulated chunking (CapacitorHttp) ----
  if (isNative()) {
    body.stream = false;
    const result = await OpenCodeBridge.httpRequest({
      url,
      method: 'POST',
      body: JSON.stringify(body),
      headers,
      timeout: 240,
    });
    if (result.status >= 400 || result.status === 0) {
      throw new Error(`HTTP ${result.status}: ${(result.body || '').substring(0, 400)}`);
    }
    let parsed: any;
    try { parsed = JSON.parse(result.body); }
    catch { throw new Error(`Invalid JSON: ${(result.body || '').substring(0, 200)}`); }
    if (parsed.error) {
      throw new Error(parsed.error?.message || JSON.stringify(parsed.error));
    }
    const choice = parsed.choices?.[0];
    if (!choice) throw new Error('No response from API.');

    const content = choice.message?.content || '';
    const thinking = choice.message?.reasoning_content || choice.message?.thinking;
    const toolCalls = choice.message?.tool_calls;

    if (thinking) yield { type: 'thinking', thinking };

    // simulate streaming by chunking the text
    if (content) {
      const chunk = 40;
      for (let i = 0; i < content.length; i += chunk) {
        yield { type: 'content', content: content.substring(i, i + chunk) };
      }
    }

    if (toolCalls) {
      for (const tc of toolCalls) {
        let args: any = tc.function?.arguments || '{}';
        try { args = typeof args === 'string' ? JSON.parse(args) : args; } catch {}
        const name = tc.function?.name || 'unknown';
        const tcObj: OpenCodeToolCall = {
          id: tc.id || `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: guessToolType(name, args),
          name,
          params: typeof args === 'string' ? { raw: args } : args,
          status: 'pending',
          requiresApproval: isToolApprovalRequired(name),
        };
        yield { type: 'tool_call', toolCall: tcObj };
      }
    }

    if (parsed.usage) {
      yield {
        type: 'usage',
        usage: {
          promptTokens: parsed.usage.prompt_tokens || 0,
          completionTokens: parsed.usage.completion_tokens || 0,
          totalTokens: parsed.usage.total_tokens || 0,
        },
      };
    }
    yield { type: 'done' };
    return;
  }

  // ---- Web: real SSE streaming ----
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 400)}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream.');
  const decoder = new TextDecoder();
  let buffer = '';
  const toolBuf = new Map<number, { id: string; name: string; args: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') { yield { type: 'done' }; return; }
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            yield { type: 'error', error: parsed.error?.message || JSON.stringify(parsed.error) };
            return;
          }
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) yield { type: 'content', content: delta.content };
          if (delta.reasoning_content || delta.thinking) {
            yield { type: 'thinking', thinking: delta.reasoning_content || delta.thinking };
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolBuf.has(idx)) toolBuf.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
              const b = toolBuf.get(idx)!;
              if (tc.id) b.id = tc.id;
              if (tc.function?.name) b.name = tc.function.name;
              if (tc.function?.arguments) b.args += tc.function.arguments;
            }
          }
          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const [, b] of toolBuf) {
              let args: any = {};
              try { args = JSON.parse(b.args || '{}'); } catch {}
              const tc: OpenCodeToolCall = {
                id: b.id || `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type: guessToolType(b.name, args),
                name: b.name,
                params: args,
                status: 'pending',
                requiresApproval: isToolApprovalRequired(b.name),
              };
              yield { type: 'tool_call', toolCall: tc };
            }
            toolBuf.clear();
          }
          if (parsed.usage) {
            yield {
              type: 'usage',
              usage: {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              },
            };
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  yield { type: 'done' };
}

// =========================================================
// Anthropic Messages API
// =========================================================
async function* streamAnthropic(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const { baseUrl, apiKey, provider } = getProviderConfig(config);

  // Convert OpenAI-style messages to Anthropic format
  const systemMsg = messages.find(m => m.role === 'system')?.content as string || '';
  const convo: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') convo.push({ role: 'user', content: m.content || '' });
    else if (m.role === 'assistant') {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          let input: any = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
      }
      convo.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool') {
      convo.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: String(m.content || '') }],
      });
    }
  }

  const tools = TOOL_DEFINITIONS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const body: any = {
    model: config.activeModel,
    system: systemMsg,
    messages: convo,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    tools,
    stream: config.streaming && !isNative(),
  };

  const url = `${baseUrl}/messages`;
  const headers = buildHeaders(provider, apiKey);

  if (isNative() || !config.streaming) {
    body.stream = false;
    const result = isNative()
      ? await OpenCodeBridge.httpRequest({ url, method: 'POST', body: JSON.stringify(body), headers, timeout: 240 })
      : { status: 0, body: '' };
    if (!isNative()) {
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      result.status = resp.status;
      result.body = await resp.text();
    }
    if (result.status >= 400 || result.status === 0) {
      throw new Error(`HTTP ${result.status}: ${(result.body || '').substring(0, 400)}`);
    }
    const parsed = JSON.parse(result.body);
    if (parsed.error) throw new Error(parsed.error?.message || JSON.stringify(parsed.error));
    for (const block of parsed.content || []) {
      if (block.type === 'text') {
        const c = block.text || '';
        const ch = 40;
        for (let i = 0; i < c.length; i += ch) yield { type: 'content', content: c.substring(i, i + ch) };
      } else if (block.type === 'tool_use') {
        const tc: OpenCodeToolCall = {
          id: block.id,
          type: guessToolType(block.name, block.input),
          name: block.name,
          params: block.input || {},
          status: 'pending',
          requiresApproval: isToolApprovalRequired(block.name),
        };
        yield { type: 'tool_call', toolCall: tc };
      } else if (block.type === 'thinking') {
        yield { type: 'thinking', thinking: block.thinking || '' };
      }
    }
    if (parsed.usage) {
      yield { type: 'usage', usage: {
        promptTokens: parsed.usage.input_tokens || 0,
        completionTokens: parsed.usage.output_tokens || 0,
        totalTokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
      }};
    }
    yield { type: 'done' };
    return;
  }

  // Streaming SSE (web)
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).substring(0, 400)}`);
  const reader = resp.body?.getReader();
  if (!reader) throw new Error('No stream');
  const decoder = new TextDecoder();
  let buffer = '';
  const toolBlocks = new Map<number, { id: string; name: string; args: string }>();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const ln of lines) {
        const t = ln.trim();
        if (!t.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(t.slice(5).trim());
          if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
            toolBlocks.set(ev.index, { id: ev.content_block.id, name: ev.content_block.name, args: '' });
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta?.type === 'text_delta') yield { type: 'content', content: ev.delta.text };
            if (ev.delta?.type === 'thinking_delta') yield { type: 'thinking', thinking: ev.delta.thinking };
            if (ev.delta?.type === 'input_json_delta') {
              const b = toolBlocks.get(ev.index); if (b) b.args += ev.delta.partial_json || '';
            }
          } else if (ev.type === 'content_block_stop') {
            const b = toolBlocks.get(ev.index);
            if (b) {
              let input: any = {}; try { input = JSON.parse(b.args || '{}'); } catch {}
              const tc: OpenCodeToolCall = {
                id: b.id, type: guessToolType(b.name, input), name: b.name, params: input,
                status: 'pending', requiresApproval: isToolApprovalRequired(b.name),
              };
              yield { type: 'tool_call', toolCall: tc };
              toolBlocks.delete(ev.index);
            }
          } else if (ev.type === 'message_delta' && ev.usage) {
            yield { type: 'usage', usage: {
              promptTokens: 0, completionTokens: ev.usage.output_tokens || 0, totalTokens: ev.usage.output_tokens || 0,
            }};
          }
        } catch {}
      }
    }
  } finally { try { reader.releaseLock(); } catch {} }
  yield { type: 'done' };
}

// =========================================================
// Public entry
// =========================================================
export async function* streamChatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const { provider } = getProviderConfig(config);
  if (provider.style === 'anthropic') {
    yield* streamAnthropic(config, messages);
  } else {
    yield* streamOpenAI(config, messages);
  }
}

// Simple ping for "Test connection" in Settings
export async function testProvider(config: AppConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const { baseUrl, apiKey, provider } = getProviderConfig(config);
    const headers = buildHeaders(provider, apiKey);
    if (provider.style === 'anthropic') {
      const r = isNative()
        ? await OpenCodeBridge.httpRequest({
            url: `${baseUrl}/messages`, method: 'POST',
            body: JSON.stringify({ model: config.activeModel, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] }),
            headers, timeout: 30,
          })
        : await fetch(`${baseUrl}/messages`, {
            method: 'POST', headers,
            body: JSON.stringify({ model: config.activeModel, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] }),
          }).then(async r => ({ status: r.status, body: await r.text() }));
      return r.status < 400
        ? { ok: true, message: `OK (${r.status})` }
        : { ok: false, message: `HTTP ${r.status}: ${(r.body || '').slice(0, 200)}` };
    }
    const r = isNative()
      ? await OpenCodeBridge.httpRequest({
          url: `${baseUrl}/chat/completions`, method: 'POST',
          body: JSON.stringify({ model: config.activeModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false }),
          headers, timeout: 30,
        })
      : await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST', headers,
          body: JSON.stringify({ model: config.activeModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false }),
        }).then(async r => ({ status: r.status, body: await r.text() }));
    return r.status < 400
      ? { ok: true, message: `OK (${r.status})` }
      : { ok: false, message: `HTTP ${r.status}: ${(r.body || '').slice(0, 200)}` };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}
