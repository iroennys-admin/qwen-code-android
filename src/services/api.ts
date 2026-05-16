import type { AppConfig, StreamChunk, ToolCall, ApiMessage, ApiToolCall } from '../types';
import { TOOL_DEFINITIONS } from '../utils/config';

const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

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
  return provider?.apiKey || '';
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
  
  if (!baseUrl || !apiKey) {
    throw new Error('Provider not configured or API key missing');
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
  
  const response = await fetch(url, { method: 'POST', headers, body });
  
  if (!response.ok) {
    const errText = await response.text();
    if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
      throw new Error('Proxy bloqueado por Cloudflare. Intenta de nuevo o cambia la URL del proxy.');
    }
    throw new Error(`API Error ${response.status}: ${errText.substring(0, 500)}`);
  }
  
  const data = await response.json();
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
 * Returns accumulated result at the end.
 */
export async function* streamChatCompletion(
  config: AppConfig,
  messages: ApiMessage[],
): AsyncGenerator<StreamChunk> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  
  if (!baseUrl || !apiKey) {
    yield { type: 'error', error: 'Provider not configured or API key missing' };
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
  
  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    
    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
        yield { type: 'error', error: 'Proxy bloqueado por Cloudflare. Intenta de nuevo o cambia la URL del proxy.' };
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
    
    // Accumulate tool calls across chunks
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
          // Yield accumulated tool calls
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
          
          // Accumulate tool calls from stream chunks
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
            // Yield accumulated tool calls
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
  
  const baseUrl = config.proxyEnabled ? provider.proxyBaseUrl : provider.baseUrl;
  const url = `${baseUrl}/models`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'User-Agent': MOBILE_USER_AGENT,
      },
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((m: any) => m.id).sort();
  } catch {
    return [];
  }
}

export async function testApiKey(config: AppConfig): Promise<{success: boolean; error?: string; modelCount?: number}> {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return { success: false, error: 'Provider not found' };
  
  const baseUrl = config.proxyEnabled ? provider.proxyBaseUrl : provider.baseUrl;
  const url = `${baseUrl}/models`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'User-Agent': MOBILE_USER_AGENT,
      },
    });
    
    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes('Just a moment') || errText.includes('challenge-platform')) {
        return { success: false, error: 'Proxy bloqueado por Cloudflare' };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { success: true, modelCount: data.data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
