export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at: string;
};

export type AuthResult = {
  access_token: string;
  user: SafeUser;
};

export function toSafeUser(user: {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createTime: Date;
}): SafeUser {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name ?? user.email.split('@')[0],
    avatar_url: user.avatarUrl,
    created_at: user.createTime.toISOString(),
  };
}
