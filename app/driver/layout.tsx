import AdminGate from '@/components/AdminGate'

// Driver pages use the admin login until driver logins are built
export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>
}
