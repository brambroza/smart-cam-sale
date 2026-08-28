import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';
export const SUPERADMIN_ONLY_KEY = 'superadminOnly';

/** Route requires role "admin" (org owner) or "superadmin"; plain staff gets 403. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

/** Route requires the platform "superadmin" role (org management). */
export const SuperadminOnly = () => SetMetadata(SUPERADMIN_ONLY_KEY, true);
