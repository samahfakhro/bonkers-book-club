// Who counts as an admin — matches the admin_read_all_* rules in the database.
// Safe to import in the browser (no secrets); the server check lives in lib/admin-auth.ts.
export const ADMIN_EMAILS = ['samahfakhro@gmail.com']

export const isAdminEmail = (email: string | null | undefined) => !!email && ADMIN_EMAILS.includes(email.toLowerCase())
