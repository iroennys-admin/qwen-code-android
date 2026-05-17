// ==========================================
// OpenCode Android - Agent Engine
// ==========================================

import type { AppConfig, OpenCodeMessage, ApiMessage, ApiToolCall, AgentState, StreamChunk } from '../types';
import { streamChatCompletion } from './api';
import { executeToolCall } from './bridge';
import { SYSTEM_PROMPT } from '../utils/config';

export interface AgentCallbacks {
  onStateChange: (state: AgentState) => void;
  onContent: (text: string) => void;
  onThinking: (text: string) => void;
  onToolCall: (tc: any) => void;
  onToolStart: (toolCallId: string) => void;
  onToolResult: (toolCallId: string, output: string, error?: string) => void;
  onToolApproval: (tc: any) => Promise<boolean>;
  onDone: () => void;
  onError: (error: string) => void;
  shouldAbort: () => boolean;
}

export function chatMessagesToApiMessages(messages: OpenCodeMessage[]): ApiMessage[] {
  const result: ApiMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const apiToolCalls: ApiToolCall[] = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.params),
          },
        }));
        result.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: apiToolCalls,
        });
        // Add tool results
        for (const tc of msg.toolCalls) {
          if (tc.output !== undefined) {
            result.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: tc.output || '',
            });
          }
        }
      } else {
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
  callbacks: AgentCallbacks,
): Promise<void> {
  const systemMsg: ApiMessage = {
    role: 'system',
    content: config.systemPrompt || SYSTEM_PROMPT,
  };

  let currentMessages: ApiMessage[] = [
    systemMsg,
    ...history,
    { role: 'user' as const, content: userMessage },
  ];

  let step = 0;
  const maxSteps = config.maxAgentSteps || 30;

  while (step < maxSteps) {
    if (callbacks.shouldAbort()) break;
    step++;

    callbacks.onStateChange({
      status: 'thinking',
      currentStep: step,
      totalSteps: maxSteps,
    });

    try {
      const stream = streamChatCompletion(config, currentMessages);
      let hasToolCalls = false;
      const toolCallsCollected: any[] = [];

      for await (const chunk of stream) {
        if (callbacks.shouldAbort()) break;

        switch (chunk.type) {
          case 'content':
            if (chunk.content) callbacks.onContent(chunk.content);
            break;

          case 'thinking':
            if (chunk.thinking) callbacks.onThinking(chunk.thinking);
            break;

          case 'tool_call':
            if (chunk.toolCall) {
              hasToolCalls = true;
              toolCallsCollected.push(chunk.toolCall);
              callbacks.onToolCall(chunk.toolCall);
            }
            break;

          case 'error':
            callbacks.onError(chunk.error || 'Unknown error');
            return;

          case 'done':
            break;
        }
      }

      if (!hasToolCalls) {
        callbacks.onDone();
        return;
      }

      // Execute tool calls
      for (const tc of toolCallsCollected) {
        if (callbacks.shouldAbort()) break;

        // Check approval
        if (tc.requiresApproval && config.approvalMode !== 'yolo') {
          const approved = await callbacks.onToolApproval(tc);
          if (!approved) {
            tc.output = 'Denied by user';
            tc.status = 'error';
            callbacks.onToolResult(tc.id, 'Denied by user', 'Denied');
            continue;
          }
        }

        callbacks.onToolStart(tc.id);
        callbacks.onStateChange({
          status: 'executing',
          currentStep: step,
          totalSteps: maxSteps,
          currentTool: tc.name,
        });

        try {
          const result = await executeToolCall(tc.name, tc.params, config);
          tc.output = result.output || result.stdout || '';
          tc.status = 'completed';
          callbacks.onToolResult(tc.id, tc.output);
        } catch (err: any) {
          tc.output = err.message || 'Tool execution failed';
          tc.status = 'error';
          callbacks.onToolResult(tc.id, tc.output, err.message);
        }
      }

      // Update message history for next iteration
      const assistantToolCalls: ApiToolCall[] = toolCallsCollected.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.params),
        },
      }));

      currentMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: assistantToolCalls,
      });

      for (const tc of toolCallsCollected) {
        currentMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: tc.output || '',
        });
      }

    } catch (err: any) {
      callbacks.onError(err.message || 'Agent loop error');
      return;
    }
  }

  callbacks.onDone();
}
