export const ReportType = {
  POST: 'post',
  COMMENT: 'comment',
  USER: 'user',
  MESSAGE: 'message'
} as const;

export type ReportType = typeof ReportType[keyof typeof ReportType];

export const ReportReason = {
  SPAM: 'spam',
  HATE_SPEECH: 'hate_speech',
  INAPPROPRIATE_CONTENT: 'inappropriate_content',
  HARASSMENT: 'harassment',
  COPYRIGHT_VIOLATION: 'copyright_violation',
  MISINFORMATION: 'misinformation',
  OTHER: 'other'
} as const;

export type ReportReason = typeof ReportReason[keyof typeof ReportReason];

export const ReportStatus = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  ESCALATED: 'escalated'
} as const;

export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus];

export const ReportAction = {
  NO_ACTION: 'no_action',
  WARNING_ISSUED: 'warning_issued',
  CONTENT_REMOVED: 'content_removed',
  USER_SUSPENDED: 'user_suspended',
  USER_BANNED: 'user_banned'
} as const;

export type ReportAction = typeof ReportAction[keyof typeof ReportAction];