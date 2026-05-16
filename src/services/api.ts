import type { AppConfig, ChatMessage, StreamChunk, ToolCall } from '../types';
import { TOOL_DEFINITIONS } from '../utils/config';

function getBaseUrl(config: AppConfig): string {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  if (!provider) return '';
  
  if (config.proxyEnabled && config.proxyBaseUrl) {
    return provider.proxyBaseUrl;
  }
  return provider.baseUrl;
}

function getApiKey(config: AppConfig): string {
  const provider = config.providers.find(p => p.id === config.activeProvider);
  return provider?.apiKey || '';
}

function buildMessages(messages: ChatMessage[], systemPrompt: string): Array<{role: string; content: string}> {
  const result: Array<{role: string; content: string}> = [];
  
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      let content = msg.content;
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const toolContents = msg.toolCalls.map(tc => 
          `[Tool: ${tc.name}(${JSON.stringify(tc.params)}) => ${tc.output || 'pending'}]`
        ).join('\n');
        content = content ? `${content}\n${toolContents}` : toolContents;
      }
      result.push({ role: 'assistant', content });
    } else if (msg.role === 'tool' && msg.toolResults) {
      for (const tr of msg.toolResults) {
        result.push({ 
          role: 'tool', 
          content: tr.error ? `Error: ${tr.error}` : tr.output 
        });
      }
    }
  }
  
  return result;
}

export async function* streamChat(
  config: AppConfig,
  messages: ChatMessage[]
): AsyncGenerator<StreamChunk> {
  const baseUrl = getBaseUrl(config);
  const apiKey = getApiKey(config);
  
  if (!baseUrl || !apiKey) {
    yield { type: 'error', error: 'Provider not configured or API key missing' };
    return;
  }
  
  const url = `${baseUrl}/chat/completions`;
  const apiMessages = buildMessages(messages, config.systemPrompt);
  
  const body = JSON.stringify({
    model: config.activeModel,
    messages: apiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: config.streaming,
    tools: TOOL_DEFINITIONS,
  });
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
  
  // OpenRouter specific headers
  if (config.activeProvider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/iroennys-admin/qwen-code-android';
    headers['X-Title'] = 'Qwen Code Android';
  }
  
  if (!config.streaming) {
    // Non-streaming request
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
      
      if (!response.ok) {
        const errText = await response.text();
        yield { type: 'error', error: `API Error ${response.status}: ${errText}` };
        return;
      }
      
      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          const toolCall: ToolCall = {
            id: tc.id || `tc_${Date.now()}`,
            type: mapToolType(tc.function.name),
            name: tc.function.name,
            params: JSON.parse(tc.function.arguments || '{}'),
            status: 'pending',
            requiresApproval: tc.function.name === 'shell',
          };
          yield { type: 'tool_call', toolCall };
        }
      }
      
      if (choice?.message?.content) {
        yield { type: 'content', content: choice.message.content };
      }
      
      yield { type: 'done', usage: data.usage };
    } catch (err: any) {
      yield { type: 'error', error: `Network error: ${err.message}` };
    }
    return;
  }
  
  // Streaming request using SSE
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    
    if (!response.ok) {
      const errText = await response.text();
      yield { type: 'error', error: `API Error ${response.status}: ${errText}` };
      return;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
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
          yield { type: 'done' };
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          
          if (!choice) continue;
          
          // Content delta
          const delta = choice.delta;
          if (delta?.content) {
            yield { type: 'content', content: delta.content };
          }
          
          // Thinking/reasoning delta
          if (delta?.reasoning_content) {
            yield { type: 'thinking', thinking: delta.reasoning_content };
          }
          
          // Tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                const toolCall: ToolCall = {
                  id: tc.id || `tc_${Date.now()}`,
                  type: mapToolType(tc.function.name),
                  name: tc.function.name,
                  params: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
                  status: 'pending',
                  requiresApproval: tc.function.name === 'shell',
                };
                yield { type: 'tool_call', toolCall };
              }
            }
          }
          
          // Finish reason
          if (choice.finish_reason === 'tool_calls') {
            // Tool calls will be handled by the UI
          }
          
          if (choice.finish_reason === 'stop') {
            yield { type: 'done', usage: parsed.usage };
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

function mapToolType(name: string): ToolCall['type'] {
  switch (name) {
    case 'shell': return 'shell';
    case 'file_read': return 'file_read';
    case 'file_write': return 'file_write';
    case 'file_edit': return 'file_edit';
    case 'web_fetch': return 'web_fetch';
    case 'glob': return 'glob';
    case 'grep': return 'grep';
    default: return 'shell';
  }
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
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${await response.text()}` };
    }
    const data = await response.json();
    return { success: true, modelCount: data.data?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
