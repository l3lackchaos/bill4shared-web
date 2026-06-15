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
  thai_help_enabled: boolean
  thai_help_balance: number // remaining subsidy balance the user entered for this bill
  thai_help_amount: number // subsidy actually applied = min(60%, cap, balance)
  created_at: string
  ocr_raw?: unknown
}

// ไทยช่วยไทย — government co-pay subsidy applied across the whole bill
export const THAI_HELP_RATE = 0.6 // state covers 60% of the bill
export const THAI_HELP_CAP = 200 // ...up to 200 THB per bill

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
  thai_help_received: number // ไทยช่วยไทย subsidy applied to this person
  total: number
}

export interface SplitResult {
  session_id: string
  split_mode: SplitMode
  persons: PersonTotal[]
  grand_total: number
  thai_help_amount: number // total subsidy applied to the bill
  net_payable: number // grand_total − thai_help_amount (what the group actually pays)
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
