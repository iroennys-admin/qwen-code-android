// ==========================================
// OpenCode Android v2 - Agent Loop
// ==========================================

import type { AppConfig, OpenCodeMessage, ApiMessage, ApiToolCall, AgentState, OpenCodeToolCall } from '../types';
import { streamChatCompletion } from './api';
import { executeToolCall } from './bridge';
import { SYSTEM_PROMPT } from '../utils/config';

export interface AgentCallbacks {
  onStateChange: (state: AgentState) => void;
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
  onToolCall: (tc: OpenCodeToolCall) => void;
  onToolStart: (id: string) => void;
  onToolResult: (id: string, output: string, error?: string) => void;
  onToolApproval: (tc: OpenCodeToolCall) => Promise<boolean>;
  onUsage?: (u: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
  onDone: () => void;
  onError: (err: string) => void;
  shouldAbort: () => boolean;
}

export function chatMessagesToApiMessages(messages: OpenCodeMessage[]): ApiMessage[] {
  const result: ApiMessage[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length) {
        const tcs: ApiToolCall[] = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.params) },
        }));
        result.push({ role: 'assistant', content: msg.content || null, tool_calls: tcs });
        for (const tc of msg.toolCalls) {
          if (tc.output !== undefined) {
            result.push({ role: 'tool', tool_call_id: tc.id, content: tc.output || '' });
          }
        }
      } else if (msg.content) {
        result.push({ role: 'assistant', content: msg.content });
      }
    }
  }
  return result;
}

export async function runAgentLoop(
  config: AppConfig,
  history: ApiMessage[],
  userMessage: string,
  cb: AgentCallbacks,
): Promise<void> {
  const sys: ApiMessage = { role: 'system', content: config.systemPrompt || SYSTEM_PROMPT };
  let convo: ApiMessage[] = [sys, ...history, { role: 'user', content: userMessage }];
  const maxSteps = config.maxAgentSteps || 25;
  let step = 0;

  while (step < maxSteps) {
    if (cb.shouldAbort()) return;
    step++;
    cb.onStateChange({ status: 'thinking', currentStep: step, totalSteps: maxSteps });

    let hasToolCalls = false;
    const collected: OpenCodeToolCall[] = [];

    try {
      const stream = streamChatCompletion(config, convo);
      for await (const chunk of stream) {
        if (cb.shouldAbort()) return;
        switch (chunk.type) {
          case 'content':  if (chunk.content) cb.onContent(chunk.content); break;
          case 'thinking': if (chunk.thinking) cb.onThinking(chunk.thinking); break;
          case 'tool_call':
            if (chunk.toolCall) {
              hasToolCalls = true;
              collected.push(chunk.toolCall);
              cb.onToolCall(chunk.toolCall);
            }
            break;
          case 'usage':
            if (chunk.usage && cb.onUsage) cb.onUsage(chunk.usage);
            break;
          case 'error':
            cb.onError(chunk.error || 'Unknown error');
            return;
          case 'done': break;
        }
      }
    } catch (err: any) {
      cb.onError(err?.message || 'Agent loop error');
      return;
    }

    if (!hasToolCalls) {
      cb.onDone();
      return;
    }

    // Execute tools
    for (const tc of collected) {
      if (cb.shouldAbort()) return;

      if (tc.requiresApproval && config.approvalMode !== 'yolo') {
        if (config.approvalMode === 'auto_edit' && (tc.name === 'file_edit' || tc.name === 'file_write' || tc.name === 'file_append' || tc.name === 'mkdir')) {
          // auto-approve safe file ops
        } else {
          const ok = await cb.onToolApproval(tc);
          if (!ok) {
            tc.output = 'Denied by user';
            tc.status = 'denied';
            cb.onToolResult(tc.id, 'Denied by user', 'denied');
            continue;
          }
        }
      }

      cb.onToolStart(tc.id);
      cb.onStateChange({ status: 'executing', currentStep: step, totalSteps: maxSteps, currentTool: tc.name });
      tc.startedAt = Date.now();
      try {
        const r = await executeToolCall(tc.name, tc.params, config);
        tc.output = r.output;
        tc.status = 'completed';
        tc.duration = Date.now() - tc.startedAt;
        cb.onToolResult(tc.id, r.output);
      } catch (err: any) {
        tc.output = err?.message || 'Tool execution failed';
        tc.status = 'error';
        tc.duration = Date.now() - tc.startedAt;
        cb.onToolResult(tc.id, tc.output, tc.output);
      }
    }

    // Push to conversation
    convo.push({
      role: 'assistant',
      content: null,
      tool_calls: collected.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.params) },
      })),
    });
    for (const tc of collected) {
      convo.push({ role: 'tool', tool_call_id: tc.id, content: tc.output || '' });
    }
  }

  cb.onDone();
}
