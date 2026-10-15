import type { Access } from 'payload'

// Any logged-in admin user. Editor vs admin roles arrive with the users collection work.
export const authenticated: Access = ({ req: { user } }) => Boolean(user)
