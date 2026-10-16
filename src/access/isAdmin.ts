import type { Access, FieldAccess, PayloadRequest } from 'payload'

export const userIsAdmin = (req: PayloadRequest): boolean =>
  (req.user as { role?: string } | null)?.role === 'admin'

export const isAdmin: Access = ({ req }) => userIsAdmin(req)

export const isAdminField: FieldAccess = ({ req }) => userIsAdmin(req)

/** Admins see every user; editors only their own account. */
export const isAdminOrSelf: Access = ({ req }) => {
  if (!req.user) return false
  if (userIsAdmin(req)) return true
  return { id: { equals: req.user.id } }
}
