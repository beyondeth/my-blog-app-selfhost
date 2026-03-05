import api from "../index";

export interface SubmitFeedbackPayload {
  mode: "form" | "free";
  type?: "BUG" | "FEATURE" | "INQUIRY" | "OTHER";
  title?: string;
  message: string;
  pagePath?: string;
  theme?: string;
  userAgent?: string;
}

export const submitFeedback = async (payload: SubmitFeedbackPayload) => {
  const data = await api.post("/feedback", payload);
  return data;
};
