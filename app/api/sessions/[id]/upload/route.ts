import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { parseReceiptImage, mergeParsedBills } from '@/lib/ocr'
import type { ParsedBill } from '@/types'

// OCR over several images via Claude can take a while — raise the serverless
// timeout above the platform default so multi-page uploads don't get cut off.
// (Vercel caps this at 60s on Hobby/Pro; ignored on other hosts.)
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params

  const formData = await req.formData()
  const files = formData.getAll('images') as File[]

  if (files.length === 0) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  const parsed: ParsedBill[] = []
  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mime = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
    const result = await parseReceiptImage(base64, mime)
    parsed.push(result)
  }

  const bill = mergeParsedBills(parsed)
  const db = createServerClient()

  // Update session with parsed totals and raw OCR data
  await db.from('sessions').update({
    bill_type: bill.bill_type,
    food_subtotal: bill.food_subtotal,
    delivery_fee: bill.delivery_fee,
    total_discount: bill.total_discount,
    grand_total: bill.grand_total,
    ocr_raw: bill,
    status: 'confirming',
  }).eq('id', id)

  // Delete old items then insert fresh
  await db.from('items').delete().eq('session_id', id)

  // Insert BOTH person-grouped items and any flat (orphan) items. A multi-image
  // group_order can have a page OCR'd as physical → those items live in bill.items
  // with no person. Keeping them as unassigned (rather than dropping) lets the user
  // see and claim them instead of silently losing part of the bill.
  const personItems = bill.persons.flatMap(person =>
    person.items.map(item => ({
      session_id: id,
      name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      pre_assigned_name: person.name,
    })),
  )
  const flatItems = bill.items.map(item => ({
    session_id: id,
    name: item.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    pre_assigned_name: null as string | null,
  }))
  const itemsToInsert = [...personItems, ...flatItems]

  if (itemsToInsert.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.from('items').insert(itemsToInsert as any)
  }

  return NextResponse.json({ parsed: bill })
}
