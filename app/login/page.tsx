import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Misale ATS</h1>
        <p className="mt-1 text-sm text-neutral-500">Operator sign in</p>
        <LoginForm next={next ?? '/dashboard'} />
      </div>
    </main>
  )
}
