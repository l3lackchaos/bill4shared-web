export type BillStatus = 'collecting' | 'confirming' | 'assigning' | 'done' | 'cancelled'
export type BillType = 'group_order' | 'physical' | 'typed' | 'unknown'
export type SplitMode = 1 | 2 | 3

export interface BillSession {
  id: string
  status: BillStatus
  bill_type: BillType
  split_mode: SplitMode
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
  created_at: string
  ocr_raw?: unknown
}

export interface BillItem {
  id: string
  session_id: string
  name: string
  unit_price: number
  quantity: number
  pre_assigned_name: string | null
  assignments?: ItemAssignment[]
}

export interface ItemAssignment {
  id: string
  item_id: string
  display_name: string
  share_numerator: number
  share_denominator: number
}

export interface PersonTotal {
  display_name: string
  food_amount: number
  discount_received: number
  delivery_share: number
  total: number
}

export interface SplitResult {
  session_id: string
  split_mode: SplitMode
  persons: PersonTotal[]
  grand_total: number
  verified: boolean
}

// OCR types
export interface ParsedItem {
  name: string
  unit_price: number
  quantity: number
}

export interface ParsedPerson {
  name: string
  items: ParsedItem[]
  person_subtotal: number
}

export interface ParsedBill {
  bill_type: BillType
  persons: ParsedPerson[]
  items: ParsedItem[]
  food_subtotal: number
  delivery_fee: number
  total_discount: number
  grand_total: number
  has_vat: boolean
  vat_amount: number
}
