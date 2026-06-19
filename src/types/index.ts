export type TechnicianLevel = 'junior' | 'intermediate' | 'senior' | 'supervisor'

export const TECHNICIAN_LEVEL_CONFIG: Record<TechnicianLevel, {
  name: string
  pricePerHour: number
  commissionRate: number
}> = {
  junior: { name: '初级技师', pricePerHour: 158, commissionRate: 0.3 },
  intermediate: { name: '中级技师', pricePerHour: 198, commissionRate: 0.35 },
  senior: { name: '高级技师', pricePerHour: 258, commissionRate: 0.4 },
  supervisor: { name: '督导技师', pricePerHour: 328, commissionRate: 0.45 },
}

export type TechnicianStatus = 'idle' | 'busy' | 'break' | 'off'

export type TechnicianCurrentStatus =
  | { status: 'idle' | 'break' | 'off' }
  | {
      status: 'in_service'
      bookingId: string
      customerName: string
      customerQueueNumber: number
      endTime: Date
      isGap?: boolean
      gapPeriod?: { startTime: Date; endTime: Date }
      nextService?: { startTime: Date; endTime: Date }
    }

export interface Technician {
  id: string
  name: string
  number: number
  level: TechnicianLevel
  status: TechnicianStatus
  currentBookingId?: string
}

export type CustomerStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled' | 'invalid'

export interface Customer {
  id: string
  queueNumber: number
  name: string
  phone?: string
  status: CustomerStatus
  requestedLevel?: TechnicianLevel
  requestedTechnicianId?: string
  queueTime: Date
  passCount: number
  lastPassTime?: Date
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'split'

export interface TimeSegment {
  id: string
  startTime: Date
  endTime: Date
  duration: number
  status: 'active' | 'cancelled' | 'completed'
}

export interface Booking {
  id: string
  customerId: string
  technicianId: string
  startTime: Date
  endTime: Date
  duration: number
  status: BookingStatus
  isMerged: boolean
  mergedFrom?: string[]
  splitFrom?: string
  segments: TimeSegment[]
  createdAt: Date
  cancelledAt?: Date
  completedAt?: Date
}

export interface CommissionRecord {
  id: string
  bookingId: string
  technicianId: string
  customerId: string
  startTime: Date
  duration: number
  effectiveDuration: number
  totalAmount: number
  effectiveAmount: number
  commissionRate: number
  commissionAmount: number
  technicianLevel: TechnicianLevel
  createdAt: Date
}

export interface AppState {
  technicians: Technician[]
  customers: Customer[]
  bookings: Booking[]
  commissions: CommissionRecord[]
  currentQueueNumber: number
  maxPassCount: number
  timeSlotMinutes: number
}

export interface GapInfo {
  startTime: Date
  endTime: Date
  duration: number
  prevSegment?: { bookingId: string; endTime: Date }
  nextSegment?: { bookingId: string; startTime: Date }
}
