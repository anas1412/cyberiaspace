import type { User } from '../constants';

export function isPro(user: User | null): boolean {
  return user?.plan === 'pro';
}

export function isAuthenticated(user: User | null): boolean {
  return !!user?.id;
}
