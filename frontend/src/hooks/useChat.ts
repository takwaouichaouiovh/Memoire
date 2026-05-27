import { ChatApiResponse, Source, postJson } from "../lib/api";

export type { Source };

interface ChatRequest {
  message: string;
  session_id: string;
  model?: string;
}

export async function sendChatMessage(
  message: string,
  sessionId: string,
  model?: string
): Promise<ChatApiResponse> {
  const payload: ChatRequest = {
    message,
    session_id: sessionId,
    model,
  };

  return postJson<ChatRequest, ChatApiResponse>("/api/chat/", payload);
}
