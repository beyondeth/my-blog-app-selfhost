import { Role } from '../../common/enums/role.enum';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string; // UUID로 변경
    username: string;
    role: Role;
    profileImage?: string;
    isEmailVerified: boolean;
    createdAt: Date;
  };
  blog?: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    isPublic: boolean;
    createdAt: Date;
  };
} 