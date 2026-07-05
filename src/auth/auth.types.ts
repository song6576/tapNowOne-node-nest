export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  social_link?: string | null;
  country?: string | null;
  city?: string | null;
  profession?: string | null;
  show_join_date?: boolean;
  created_at: string;
};

export type AuthResult = {
  access_token: string;
  user: SafeUser;
};

type UserLike = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  socialLink?: string | null;
  country?: string | null;
  city?: string | null;
  profession?: string | null;
  showJoinDate?: boolean;
  createTime: Date;
};

export function toSafeUser(user: UserLike): SafeUser {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name ?? user.email.split('@')[0],
    avatar_url: user.avatarUrl,
    banner_url: user.bannerUrl ?? null,
    bio: user.bio ?? null,
    social_link: user.socialLink ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    profession: user.profession ?? null,
    show_join_date: user.showJoinDate ?? true,
    created_at: user.createTime.toISOString(),
  };
}
