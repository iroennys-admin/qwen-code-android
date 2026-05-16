/**
 * Agent Engine - The core agentic loop for Qwen Code.
 * 
 * This implements the ReAct (Reasoning + Acting) pattern:
 * 1. AI receives user message
 * 2. AI reasons about what to do
 * 3. AI calls tools if needed
 * 4. Tool results are fed back to the AI
 * 5. AI continues reasoning and acting until task is complete
 * 
 * The agent loop continues until:
 * - The AI gives a final response with no tool calls
 * - The maximum number of steps is reached
 * - The user aborts
 * - An error occurs
 */

import type { AppConfig, ApiMessage, ApiToolCall, ChatMessage, ToolCall, AgentState } from '../types';
import { streamChatCompletion, chatCompletion } from './api';
import { executeToolCall } from './bridge';

export interface AgentCallbacks {
  /** Called when the agent's state changes (thinking, executing tool, etc.) */
  onStateChange: (state: AgentState) => void;
  /** Called when text content is streamed */
  onContent: (text: string) => void;
  /** Called when thinking content is received */
  onThinking: (text: string) => void;
  /** Called when a tool call is detected */
  onToolCall: (toolCall: ToolCall) => void;
  /** Called when a tool starts executing */
  onToolStart: (toolCallId: string) => void;
  /** Called when a tool execution completes */
  onToolResult: (toolCallId: string, output: string, error?: string) => void;
  /** Called when a tool needs approval */
  onToolApproval: (toolCall: ToolCall) => Promise<boolean>;
  /** Called when the agent loop completes */
  onDone: (messages: ApiMessage[], usage?: any) => void;
  /** Called on error */
  onError: (error: string) => void;
  /** Check if the agent should abort */
  shouldAbort: () => boolean;
}

/**
 * Run the agentic loop.
 * 
 * @param config - App configuration
 * @param apiMessages - Previous conversation history in API format
 * @param userMessage - The new user message
 * @param callbacks - Callbacks for UI updates
 */
export async function runAgentLoop(
  config: AppConfig,
  apiMessages: ApiMessage[],
  userMessage: string,
  callbacks: AgentCallbacks,
): Promise<void> {
  const maxSteps = config.maxAgentSteps || 25;
  
  // Add user message to conversation
  const messages: ApiMessage[] = [
    ...apiMessages,
    { role: 'user', content: userMessage },
  ];
  
  let step = 0;
  
  try {
    while (step < maxSteps) {
      if (callbacks.shouldAbort()) {
        callbacks.onStateChange({ status: 'done', currentStep: step, totalSteps: step });
        break;
      }
      
      step++;
      callbacks.onStateChange({ 
        status: 'thinking', 
        currentStep: step, 
        totalSteps: step,
        thinkingText: 'Pensando...',
      });
      
      // Call the API
      let content = '';
      let thinking = '';
      let toolCalls: ApiToolCall[] = [];
      
      if (config.streaming) {
        // Streaming mode
        for await (const chunk of streamChatCompletion(config, messages)) {
          if (callbacks.shouldAbort()) break;
          
          if (chunk.type === 'content' && chunk.content) {
            content += chunk.content;
            callbacks.onContent(chunk.content);
            callbacks.onStateChange({
              status: 'thinking',
              currentStep: step,
              totalSteps: step,
              thinkingText: content.substring(0, 100),
            });
          }
          
          if (chunk.type === 'thinking' && chunk.thinking) {
            thinking += chunk.thinking;
            callbacks.onThinking(chunk.thinking);
            callbacks.onStateChange({
              status: 'thinking',
              currentStep: step,
              totalSteps: step,
              thinkingText: thinking.substring(0, 200),
            });
          }
          
          if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCalls.push({
              id: chunk.toolCall.id,
              type: 'function',
              function: {
                name: chunk.toolCall.name,
                arguments: JSON.stringify(chunk.toolCall.params),
              },
            });
            callbacks.onToolCall(chunk.toolCall);
          }
          
          if (chunk.type === 'error' && chunk.error) {
            callbacks.onError(chunk.error);
            return;
          }
        }
      } else {
        // Non-streaming mode
        const result = await chatCompletion(config, messages);
        content = result.content;
        thinking = result.thinking;
        toolCalls = result.toolCalls;
        
        if (thinking) {
          callbacks.onThinking(thinking);
        }
        if (content) {
          callbacks.onContent(content);
        }
        for (const tc of toolCalls) {
          const toolCall: ToolCall = {
            id: tc.id,
            type: mapToolName(tc.function.name),
            name: tc.function.name,
            params: JSON.parse(tc.function.arguments || '{}'),
            status: 'pending',
            requiresApproval: tc.function.name === 'shell' || tc.function.name === 'code_execute',
          };
          callbacks.onToolCall(toolCall);
        }
      }
      
      // If no tool calls, we're done - the AI has given its final answer
      if (toolCalls.length === 0) {
        // Add assistant message to history
        messages.push({
          role: 'assistant',
          content: content || null,
        });
        
        callbacks.onStateChange({ 
          status: 'done', 
          currentStep: step, 
          totalSteps: step 
        });
        callbacks.onDone(messages);
        return;
      }
      
      // Add assistant message with tool calls to conversation history
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: toolCalls,
      });
      
      // Execute each tool call
      for (const apiTc of toolCalls) {
        if (callbacks.shouldAbort()) break;
        
        const name = apiTc.function.name;
        const params = JSON.parse(apiTc.function.arguments || '{}');
        
        // Check if this tool needs approval
        const needsApproval = name === 'shell' || name === 'code_execute' || name === 'rm';
        let approved = true;
        
        if (needsApproval && config.approvalMode === 'ask') {
          const tc: ToolCall = {
            id: apiTc.id,
            type: mapToolName(name),
            name,
            params,
            status: 'waiting_approval',
            requiresApproval: true,
          };
          approved = await callbacks.onToolApproval(tc);
        } else if (needsApproval && config.approvalMode === 'auto_edit') {
          // In auto_edit mode, only shell/code_execute need approval
          const tc: ToolCall = {
            id: apiTc.id,
            type: mapToolName(name),
            name,
            params,
            status: 'waiting_approval',
            requiresApproval: true,
          };
          approved = await callbacks.onToolApproval(tc);
        }
        
        if (!approved) {
          // User denied - add denied result
          messages.push({
            role: 'tool',
            tool_call_id: apiTc.id,
            content: 'Tool execution denied by user. Please find an alternative approach or ask the user for guidance.',
          });
          callbacks.onToolResult(apiTc.id, 'Denied by user', 'Denied');
          continue;
        }
        
        // Execute the tool
        callbacks.onToolStart(apiTc.id);
        callbacks.onStateChange({
          status: 'executing',
          currentStep: step,
          totalSteps: step,
          currentTool: name,
        });
        
        const startTime = Date.now();
        const result = await executeToolCall(name, params);
        const duration = Date.now() - startTime;
        
        callbacks.onToolResult(apiTc.id, result.output, result.error);
        
        // Add tool result to conversation
        const toolContent = result.error 
          ? `Error: ${result.error}\n\nOutput:\n${result.output}`
          : result.output;
        
        messages.push({
          role: 'tool',
          tool_call_id: apiTc.id,
          content: toolContent || '(no output)',
        });
      }
      
      // Clear content for next iteration — the AI will generate new content
      // based on the tool results
      content = '';
      thinking = '';
      toolCalls = [];
    }
    
    // Max steps reached
    if (step >= maxSteps) {
      callbacks.onStateChange({ status: 'done', currentStep: step, totalSteps: step });
      callbacks.onDone(messages);
    }
    
  } catch (err: any) {
    callbacks.onError(err.message || 'Unknown error occurred');
    callbacks.onStateChange({ status: 'error', currentStep: step, totalSteps: step });
  }
}

function mapToolName(name: string): ToolCall['type'] {
  const map: Record<string, ToolCall['type']> = {
    shell: 'shell',
    file_read: 'file_read',
    file_write: 'file_write',
    file_edit: 'file_edit',
    web_fetch: 'web_fetch',
    web_search: 'web_search',
    web_scrape: 'web_scrape',
    glob: 'glob',
    grep: 'grep',
    code_execute: 'code_execute',
    mkdir: 'mkdir',
    rm: 'rm',
    mv: 'mv',
    cp: 'cp',
    list_dir: 'list_dir',
    npx_install: 'npx_install',
  };
  return map[name] || 'shell';
}

/**
 * Convert ChatMessage[] to ApiMessage[] for the conversation history.
 * This is needed because the UI stores messages differently than the API format.
 */
export function chatMessagesToApiMessages(messages: ChatMessage[]): ApiMessage[] {
  const result: ApiMessage[] = [];
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // Assistant message with tool calls
        result.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.params),
            },
          })),
        });
        
        // Add tool result messages
        for (const tc of msg.toolCalls) {
          if (tc.output !== undefined) {
            result.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: tc.status === 'error' && tc.output 
                ? `Error: ${tc.output}` 
                : tc.output || '(no output)',
            });
          }
        }
      } else {
        // Assistant message without tool calls
        result.push({ role: 'assistant', content: msg.content });
      }
    }
    // Skip 'system' and 'tool' role messages - they're handled above
  }
  
  return result;
}
