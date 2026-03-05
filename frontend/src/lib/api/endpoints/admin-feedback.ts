import api from "../index";

export interface AdminFeedbackListParams {
  page?: number;
  limit?: number;
  status?: "new" | "in_progress" | "done";
  type?: "BUG" | "FEATURE" | "INQUIRY" | "OTHER";
  q?: string;
}

export interface FeedbackTicket {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
  mode: "form" | "free";
  type: "BUG" | "FEATURE" | "INQUIRY" | "OTHER" | null;
  title: string;
  message: string;
  pagePath: string;
  theme: string;
  userAgent: string;
  status: "new" | "in_progress" | "done";
  emailSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeedbackListResponse {
  items: FeedbackTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getAdminFeedbackList = async (params: AdminFeedbackListParams) => {
  const data = await api.get<AdminFeedbackListResponse>("/admin/feedback", { params });
  return data;
};

export const updateFeedbackStatus = async (id: string, status: "new" | "in_progress" | "done") => {
  const data = await api.patch<FeedbackTicket>(`/admin/feedback/${id}/status`, { status });
  return data;
};
