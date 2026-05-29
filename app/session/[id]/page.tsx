import { createServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function SessionRedirect({ params }: Props) {
  const { id } = await params
  const db = createServerClient()

  const { data: session } = await db.from('sessions').select('status').eq('id', id).single()
  if (!session) notFound()

  const dest: Record<string, string> = {
    collecting: `/session/${id}/upload`,
    confirming: `/session/${id}/confirm`,
    assigning: `/session/${id}/assign`,
    done: `/session/${id}/summary`,
    cancelled: '/',
  }

  redirect(dest[session.status] ?? `/session/${id}/upload`)
}
