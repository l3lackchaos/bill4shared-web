import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
import AssignClient from './AssignClient'

type Props = { params: Promise<{ id: string }> }

export default async function AssignPage({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  const { data: session } = await db.from('sessions').select('*').eq('id', id).single()
  if (!session) notFound()
  if (session.status === 'done') redirect(`/session/${id}/summary`)

  const { data: items } = await db
    .from('items')
    .select('*, assignments(*)')
    .eq('session_id', id)

  return (
    <AssignClient
      sessionId={id}
      session={session}
      items={(items ?? []) as Parameters<typeof AssignClient>[0]['items']}
    />
  )
}
