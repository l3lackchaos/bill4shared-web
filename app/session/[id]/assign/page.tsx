import { createServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import AssignClient from './AssignClient'

type Props = { params: Promise<{ id: string }> }

export default async function AssignPage({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  // Note: do NOT redirect when status === 'done'. The summary page's
  // "แก้ไขการแบ่ง" button links here to re-edit a finished bill — bouncing back
  // to the summary made editing impossible. finalize() re-saves and returns to
  // the summary, so allowing this page to load on a done bill is correct.
  const [{ data: session }, { data: items }] = await Promise.all([
    db.from('sessions').select('*').eq('id', id).single(),
    db.from('items').select('*, assignments(*)').eq('session_id', id),
  ])
  if (!session) notFound()

  return (
    <AssignClient
      sessionId={id}
      session={session}
      items={(items ?? []) as Parameters<typeof AssignClient>[0]['items']}
    />
  )
}
