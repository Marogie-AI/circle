// Centered-card shell for signed-out entry points. Deliberately has no sidebar:
// these pages are reached by people who may not have an account yet.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}
