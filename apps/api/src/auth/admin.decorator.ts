import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';

/** Route requires a JWT whose role is "admin" (staff tokens get 403). */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
