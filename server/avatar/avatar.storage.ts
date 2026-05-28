import { UserAvatars } from '../db';

export const AvatarStorage = {
  getByUserId: (userId: string) => UserAvatars.getByUserId(userId),
  upsert: (userId: string, data: any) => UserAvatars.upsert(userId, data),
  delete: (userId: string) => UserAvatars.delete(userId),
};
