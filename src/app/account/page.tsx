import { AppHeader } from '@/components/AppHeader'
import { TabBar } from '@/components/TabBar'
import { AccountForm } from '@/components/AccountForm'
import { requireProfile } from '@/lib/day'

export default async function AccountPage() {
  const profile = await requireProfile()

  return (
    <>
      <AppHeader name={profile.name} />

      <main className="flex-1 space-y-6 px-5 pt-2 pb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Account</h1>
        <AccountForm profile={profile} />
      </main>

      <TabBar />
    </>
  )
}
