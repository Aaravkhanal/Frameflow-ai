import toast from "react-hot-toast";
import { WS_BACKEND_URL } from "./config";
import {
  APP_ERROR_WEB_SOCKET_CODE,
  USER_CLOSE_WEB_SOCKET_CODE,
} from "./constants";
import { FullGenerationSettings } from "./types";

const ERROR_MESSAGE =
  "Error generating code. Check the Developer Console AND the backend logs for details. Feel free to open a Github issue.";

const CANCEL_MESSAGE = "Code generation cancelled";

type WebSocketResponse = {
  type:
    | "chunk"
    | "status"
    | "setCode"
    | "error"
    | "variantComplete"
    | "variantError"
    | "variantCount"
    | "variantModels"
    | "thinking"
    | "assistant"
    | "toolStart"
    | "toolResult"
    | "agentStart"
    | "agentComplete"
    | "agentCritique"
    | "debateRound"
    | "pipelineStage";
  value?: string;
  // Typed as a plain object instead of `any` to avoid accidental type-unsafety.
  // Consumers must narrow to their expected shape.
  data?: Record<string, unknown>;
  eventId?: string;
  variantIndex: number;
};

interface CodeGenerationCallbacks {
  onChange: (chunk: string, variantIndex: number) => void;
  onSetCode: (code: string, variantIndex: number) => void;
  onStatusUpdate: (status: string, variantIndex: number) => void;
  onVariantComplete: (variantIndex: number) => void;
  onVariantError: (variantIndex: number, error: string) => void;
  onVariantCount: (count: number) => void;
  onVariantModels: (models: string[]) => void;
  onThinking: (content: string, variantIndex: number, eventId?: string) => void;
  onAssistant: (content: string, variantIndex: number, eventId?: string) => void;
  onToolStart: (
    data: Record<string, unknown>,
    variantIndex: number,
    eventId?: string
  ) => void;
  onToolResult: (
    data: Record<string, unknown>,
    variantIndex: number,
    eventId?: string
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAgentStart?: (data: any, variantIndex: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAgentComplete?: (data: any, variantIndex: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAgentCritique?: (data: any, variantIndex: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDebateRound?: (data: any, variantIndex: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPipelineStage?: (data: any, variantIndex: number) => void;
  onCancel: (
    reason: "user_cancelled" | "request_failed" | "connection_error",
    errorMessage?: string
  ) => void;
  onComplete: () => void;
}

export function generateCode(
  wsRef: React.MutableRefObject<WebSocket | null>,
  params: FullGenerationSettings,
  callbacks: CodeGenerationCallbacks,
  retryCount: number = 0
) {
  const MAX_RETRIES = 3;
  const wsUrl = `${WS_BACKEND_URL}/generate-code`;
  console.log(`Connecting to backend @ ${wsUrl} (Attempt ${retryCount + 1})`);

  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;

  let hasReceivedData = false;

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify(params));
  });

  let errorToastShown = false;

  ws.addEventListener("message", async (event: MessageEvent) => {
    hasReceivedData = true;
    // Guard against malformed JSON — a parse failure here would silently crash
    // the entire message handler and leave the UI in a broken state.
    let response: WebSocketResponse;
    try {
      response = JSON.parse(event.data as string) as WebSocketResponse;
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err, "Raw data:", event.data);
      toast.error("Received an unreadable message from the server.");
      return;
    }

    if (response.type === "chunk") {
      callbacks.onChange(response.value || "", response.variantIndex);
    } else if (response.type === "status") {
      callbacks.onStatusUpdate(response.value || "", response.variantIndex);
    } else if (response.type === "setCode") {
      callbacks.onSetCode(response.value || "", response.variantIndex);
    } else if (response.type === "variantComplete") {
      callbacks.onVariantComplete(response.variantIndex);
    } else if (response.type === "variantError") {
      callbacks.onVariantError(response.variantIndex, response.value || "");
    } else if (response.type === "variantCount") {
      callbacks.onVariantCount(parseInt(response.value || "1"));
    } else if (response.type === "variantModels") {
      const modelsData = response.data?.models;
      callbacks.onVariantModels(Array.isArray(modelsData) ? (modelsData as string[]) : []);
    } else if (response.type === "thinking") {
      callbacks.onThinking(response.value || "", response.variantIndex, response.eventId);
    } else if (response.type === "assistant") {
      callbacks.onAssistant(response.value || "", response.variantIndex, response.eventId);
    } else if (response.type === "toolStart") {
      callbacks.onToolStart(response.data ?? {}, response.variantIndex, response.eventId);
    } else if (response.type === "toolResult") {
      callbacks.onToolResult(response.data ?? {}, response.variantIndex, response.eventId);
    } else if (response.type === "agentStart" && callbacks.onAgentStart) {
      callbacks.onAgentStart(response.data, response.variantIndex);
    } else if (response.type === "agentComplete" && callbacks.onAgentComplete) {
      callbacks.onAgentComplete(response.data, response.variantIndex);
    } else if (response.type === "agentCritique" && callbacks.onAgentCritique) {
      callbacks.onAgentCritique(response.data, response.variantIndex);
    } else if (response.type === "debateRound" && callbacks.onDebateRound) {
      callbacks.onDebateRound(response.data, response.variantIndex);
    } else if (response.type === "pipelineStage" && callbacks.onPipelineStage) {
      callbacks.onPipelineStage(response.data, response.variantIndex);
    } else if (response.type === "error") {
      console.error("Error generating code", response.value);
      errorToastShown = true;
      toast.error(response.value || ERROR_MESSAGE);
    }
  });

  ws.addEventListener("close", (event) => {
    console.log("Connection closed", event.code, event.reason);
    if (event.code === USER_CLOSE_WEB_SOCKET_CODE) {
      toast.success(CANCEL_MESSAGE);
      callbacks.onCancel("user_cancelled");
    } else if (event.code === APP_ERROR_WEB_SOCKET_CODE) {
      console.error("Known server error", event);
      if (!errorToastShown) {
        toast.error(event.reason || ERROR_MESSAGE);
        errorToastShown = true;
      }
      callbacks.onCancel("request_failed", event.reason || ERROR_MESSAGE);
    } else if (event.code !== 1000) {
      console.error("Unknown server or connection error", event);
      
      // Automatic Reconnection Logic for abnormal closure
      if (!hasReceivedData && retryCount < MAX_RETRIES) {
        const timeout = Math.pow(2, retryCount) * 1000;
        console.log(`Reconnecting in ${timeout}ms...`);
        toast.loading(`Connection lost. Reconnecting... (Attempt ${retryCount + 1})`, { id: "reconnect-toast" });
        setTimeout(() => {
          toast.dismiss("reconnect-toast");
          generateCode(wsRef, params, callbacks, retryCount + 1);
        }, timeout);
        return;
      }

      if (!errorToastShown) {
        toast.error(ERROR_MESSAGE);
        errorToastShown = true;
      }
      callbacks.onCancel("connection_error", event.reason || ERROR_MESSAGE);
    } else {
      callbacks.onComplete();
    }
  });

  ws.addEventListener("error", (error) => {
    console.error("WebSocket error", error);
    // Let the close handler manage the retries/errors
  });
}

