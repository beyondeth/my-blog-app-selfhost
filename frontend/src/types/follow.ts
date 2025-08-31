export interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  profileImage?: string;
  bio?: string;
}