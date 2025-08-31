export const Role = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const;

export type Role = typeof Role[keyof typeof Role]; 