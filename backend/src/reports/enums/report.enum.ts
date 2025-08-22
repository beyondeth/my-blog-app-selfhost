export enum ReportType {
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export enum ReportReason {
  SPAM = 'spam',
  HATE_SPEECH = 'hate_speech',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  COPYRIGHT_VIOLATION = 'copyright_violation',
  MISINFORMATION = 'misinformation',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated',
}

export enum ReportAction {
  NO_ACTION = 'no_action',
  WARNING_ISSUED = 'warning_issued',
  CONTENT_REMOVED = 'content_removed',
  USER_SUSPENDED = 'user_suspended',
  USER_BANNED = 'user_banned',
}