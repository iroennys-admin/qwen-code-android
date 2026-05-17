import type { AppConfig, StreamChunk, ToolCall, ApiMessage, ApiToolCall } from '../types';
import { TOOL_DEFINITIONS } from '../utils/config';

const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

/**
 * Check if we're running in the native Android app with bridge access.
 */
function isNative(): boolean {
  return !!(window as any)?.QwenCodeBridge?.httpRequest;
}

/**
 * Make an HTTP request using the native bridge (bypasses CORS) or fetch as fallback.
 */
async function apiRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; body: string }> {
  // Use native HTTP bridge on Android (bypasses CORS completely)
  if (isNative()) {
    try {
      const result = await (window as any).QwenCodeBridge.httpRequest({
        url,
        method,
        headers,
        body: body || undefined,
        timeout: 120,
        followRedirects: true,
      });
      return { status: result.status, body: result.body || '' };
    } catch (err: any) {
      throw new Error(`Network error: ${err.message}`);
    }
  }
  
  // Fallback: use fetch for web/browser development
  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  return { status: response.status, body: text };
}

function getBaseUrl(config: AppConfig): string {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return '';
  
  if (config.proxyEnabled && provider.proxyBaseUrl) {
    return provider.proxyBaseUrl;
  }
  return provider.baseUrl;
}

function getApiKey(config: AppConfig): string {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return '';
  // OpenCode Zen free models use "public" as API key
  if (provider.id === 'opencode' && !provider.apiKey) {
    return 'public';
  }
  return provider.apiKey || '';
}

function buildHeaders(config: AppConfig, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'User-Agent': MOBILE_USER_AGENT,
    'Accept': 'application/json',
  };
  
  if (config.activeProvider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/iroennys-admin/qwen-code-android';
    headers['X-Title'] = 'Qwen Code Android';
  }
  
  // Z.ai/GLM works best with its own User-Agent
  if (config.activeProvider === 'zai' || config.activeProvider === 'modal') {
    headers['User-Agent'] = 'QwenCode/3.0';
  }
  
  return headers;
}

/**
 * Build API messages from conversation history.
 * This handles the proper OpenAI format with tool_calls and tool results.
 */
export function buildApiMessages(
  messages: ApiMessage[], 
  systemPrompt: string
): ApiMessage[] {
  const result: ApiMessage[] = [];
  
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }
  
  result.push(...messages);
  
  return result;
}

/**
 * Make a single chat completion request (non-streaming) and return the full response.
 * Used by the agentic loop for reliable tool call handling.
 * Uses native HTTP bridge on Android to bypass CORS.
 */
export async function chatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): Promise<{
  content: string;
  toolCalls: ApiToolCall[];
  thinking: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  
  if (!baseUrl) {
    throw new Error('Provider not configured');
  }
  // OpenCode Zen doesn't require an API key for free models
  if (!apiKey && config.activeProvider !== 'opencode') {
    throw new Error('API key missing. Go to Settings to configure it.');
  }
  
  const url = `${baseUrl}/chat/completions`;
  const apiMessages = buildApiMessages(messages, config.systemPrompt);
  const headers = buildHeaders(config, apiKey);
  
  const body = JSON.stringify({
    model: config.activeModel,
    messages: apiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
    tools: TOOL_DEFINITIONS,
  });
  
  const response = await apiRequest(url, 'POST', headers, body);
  
  if (response.status !== 200) {
    const errText = response.body;
    if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
      throw new Error('Proxy bloqueado por Cloudflare. Intenta de nuevo o cambia la URL del proxy.');
    }
    // Handle OpenCode Zen rate limit error
    if (errText.includes('FreeUsageLimitError')) {
      throw new Error('Limite de uso gratuito alcanzado. Espera un momento o cambia de modelo gratuito.');
    }
    throw new Error(`API Error ${response.status}: ${errText.substring(0, 500)}`);
  }
  
  let data: any;
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error(`Invalid API response: ${response.body.substring(0, 200)}`);
  }
  
  const choice = data.choices?.[0];
  
  if (!choice?.message) {
    throw new Error('No response from API');
  }
  
  return {
    content: choice.message.content || '',
    toolCalls: choice.message.tool_calls || [],
    thinking: choice.message.reasoning_content || '',
    usage: data.usage,
  };
}

/**
 * Streaming chat completion - yields chunks as they arrive.
 * On native Android: uses non-streaming request and parses the full response
 * (since native HTTP doesn't support SSE streaming).
 * On web: uses fetch with ReadableStream for real SSE streaming.
 * Returns accumulated result at the end.
 */
export async function* streamChatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  
  if (!baseUrl) {
    yield { type: 'error', error: 'Provider not configured' };
    return;
  }
  // OpenCode Zen doesn't require an API key for free models
  if (!apiKey && config.activeProvider !== 'opencode') {
    yield { type: 'error', error: 'API key missing. Ve a Configuracion para agregarla.' };
    return;
  }
  
  const url = `${baseUrl}/chat/completions`;
  const apiMessages = buildApiMessages(messages, config.systemPrompt);
  const headers = buildHeaders(config, apiKey);
  
  const body = JSON.stringify({
    model: config.activeModel,
    messages: apiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
    tools: TOOL_DEFINITIONS,
  });
  
  // On native Android, we need to handle streaming differently
  // because the native HTTP bridge doesn't support SSE streaming.
  // We'll use non-streaming mode and simulate streaming.
  if (isNative()) {
    yield* streamViaNativeHttp(url, headers, body, config);
    return;
  }
  
  // Web fallback: use fetch with SSE streaming
  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    
    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
        yield { type: 'error', error: 'Proxy bloqueado por Cloudflare. Intenta de nuevo o cambia la URL del proxy.' };
        return;
      }
      if (errText.includes('FreeUsageLimitError')) {
        yield { type: 'error', error: 'Limite de uso gratuito alcanzado. Espera un momento o cambia de modelo gratuito.' };
        return;
      }
      yield { type: 'error', error: `API Error ${response.status}: ${errText.substring(0, 500)}` };
      return;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          for (const [, tc] of toolCallMap) {
            const toolCall: ToolCall = {
              id: tc.id || `tc_${Date.now()}`,
              type: mapToolType(tc.name),
              name: tc.name,
              params: parseToolArgs(tc.arguments),
              status: 'pending',
              requiresApproval: tc.name === 'shell' || tc.name === 'code_execute',
            };
            yield { type: 'tool_call', toolCall };
          }
          yield { type: 'done' };
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta;
          
          if (delta?.content) {
            yield { type: 'content', content: delta.content };
          }
          if (delta?.reasoning_content) {
            yield { type: 'thinking', thinking: delta.reasoning_content };
          }
          
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallMap.has(idx)) {
                toolCallMap.set(idx, {
                  id: tc.id || `tc_${Date.now()}_${idx}`,
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                });
              } else {
                const existing = toolCallMap.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          }
          
          if (choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls') {
            for (const [, tc] of toolCallMap) {
              const toolCall: ToolCall = {
                id: tc.id || `tc_${Date.now()}`,
                type: mapToolType(tc.name),
                name: tc.name,
                params: parseToolArgs(tc.arguments),
                status: 'pending',
                requiresApproval: tc.name === 'shell' || tc.name === 'code_execute',
              };
              yield { type: 'tool_call', toolCall };
            }
            yield { type: 'done', usage: parsed.usage };
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } catch (err: any) {
    yield { type: 'error', error: `Network error: ${err.message}` };
  }
}

/**
 * Native HTTP streaming: Since the Android bridge doesn't support SSE,
 * we make a non-streaming request and simulate the streaming experience
 * by yielding content in chunks as we parse the full response.
 */
async function* streamViaNativeHttp(
  url: string,
  headers: Record<string, string>,
  _streamBody: string,
  config: AppConfig,
): AsyncGenerator<StreamChunk> {
  try {
    // Make non-streaming request for native (more reliable)
    const nonStreamBody = JSON.stringify({
      model: config.activeModel,
      messages: (JSON.parse(_streamBody)).messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: false,  // Non-streaming for native HTTP
      tools: TOOL_DEFINITIONS,
    });
    
    const response = await apiRequest(url, 'POST', headers, nonStreamBody);
    
    if (response.status !== 200) {
      const errText = response.body;
      if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
        yield { type: 'error', error: 'Proxy bloqueado por Cloudflare. Intenta de nuevo o cambia la URL del proxy.' };
        return;
      }
      if (errText.includes('FreeUsageLimitError')) {
        yield { type: 'error', error: 'Limite de uso gratuito alcanzado. Espera un momento o cambia de modelo gratuito.' };
        return;
      }
      yield { type: 'error', error: `API Error ${response.status}: ${errText.substring(0, 500)}` };
      return;
    }
    
    let data: any;
    try {
      data = JSON.parse(response.body);
    } catch {
      yield { type: 'error', error: `Invalid API response: ${response.body.substring(0, 200)}` };
      return;
    }
    
    const choice = data.choices?.[0];
    if (!choice?.message) {
      yield { type: 'error', error: 'No response from API' };
      return;
    }
    
    // Yield thinking content first
    if (choice.message.reasoning_content) {
      yield { type: 'thinking', thinking: choice.message.reasoning_content };
    }
    
    // Yield content in simulated chunks for better UX
    const content = choice.message.content || '';
    if (content) {
      // Split content into chunks of ~50 chars for streaming effect
      const chunkSize = 50;
      for (let i = 0; i < content.length; i += chunkSize) {
        yield { type: 'content', content: content.slice(i, i + chunkSize) };
      }
    }
    
    // Yield tool calls
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        const toolCall: ToolCall = {
          id: tc.id || `tc_${Date.now()}`,
          type: mapToolType(tc.function?.name),
          name: tc.function?.name || '',
          params: parseToolArgs(tc.function?.arguments),
          status: 'pending',
          requiresApproval: tc.function?.name === 'shell' || tc.function?.name === 'code_execute',
        };
        yield { type: 'tool_call', toolCall };
      }
    }
    
    yield { type: 'done', usage: data.usage };
  } catch (err: any) {
    yield { type: 'error', error: `Network error: ${err.message}` };
  }
}

function parseToolArgs(argsStr: string): Record<string, unknown> {
  try {
    return JSON.parse(argsStr || '{}');
  } catch {
    // Try to handle partial JSON
    try {
      return JSON.parse(argsStr + '}');
    } catch {
      return {};
    }
  }
}

function mapToolType(name: string): ToolCall['type'] {
  const map: Record<string, ToolCall['type']> = {
    shell: 'shell',
    file_read: 'file_read',
    file_write: 'file_write',
    file_edit: 'file_edit',
    web_fetch: 'web_fetch',
    glob: 'glob',
    grep: 'grep',
    code_execute: 'code_execute',
    mkdir: 'mkdir',
    rm: 'rm',
    mv: 'mv',
    cp: 'cp',
    list_dir: 'list_dir',
  };
  return map[name] || 'shell';
}

export async function fetchModels(config: AppConfig): Promise<string[]> {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return [];
  
  const baseUrl = config.proxyEnabled ? (provider.proxyBaseUrl || provider.baseUrl) : provider.baseUrl;
  const url = `${baseUrl}/models`;
  const apiKey = provider.id === 'opencode' ? (provider.apiKey || 'public') : provider.apiKey;
  
  try {
    const response = await apiRequest(url, 'GET', {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': MOBILE_USER_AGENT,
    });
    
    if (response.status !== 200) return [];
    const data = JSON.parse(response.body);
    return (data.data || []).map((m: any) => m.id).sort();
  } catch {
    return [];
  }
}

export async function testApiKey(config: AppConfig): Promise<{success: boolean; error?: string; modelCount?: number}> {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return { success: false, error: 'Provider not found' };
  
  const baseUrl = config.proxyEnabled ? (provider.proxyBaseUrl || provider.baseUrl) : provider.baseUrl;
  const url = `${baseUrl}/models`;
  const apiKey = provider.id === 'opencode' ? (provider.apiKey || 'public') : provider.apiKey;
  
  if (!apiKey && provider.id !== 'opencode') {
    return { success: false, error: 'API key required' };
  }
  
  try {
    const response = await apiRequest(url, 'GET', {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': MOBILE_USER_AGENT,
    });
    
    if (response.status !== 200) {
      const errText = response.body;
      if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
        return { success: false, error: 'Proxy bloqueado por Cloudflare' };
      }
      if (errText.includes('FreeUsageLimitError')) {
        return { success: false, error: 'Limite de uso gratuito alcanzado. Espera un momento.' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = JSON.parse(response.body);
    return { success: true, modelCount: data.data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
