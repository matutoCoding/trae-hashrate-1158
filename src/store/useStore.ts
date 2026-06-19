import { create } from 'zustand'
import {
  Technician,
  Customer,
  Booking,
  CommissionRecord,
  AppState,
  TechnicianLevel,
  TechnicianStatus,
  CustomerStatus,
  BookingStatus,
  TECHNICIAN_LEVEL_CONFIG,
  TimeSegment,
  TechnicianCurrentStatus,
} from '@/types'

interface AppActions {
  addTechnician: (tech: Omit<Technician, 'id'>) => void
  updateTechnician: (id: string, updates: Partial<Technician>) => void
  removeTechnician: (id: string) => void

  takeQueueNumber: (customer: Omit<Customer, 'id' | 'queueNumber' | 'status' | 'queueTime' | 'passCount'>) => Customer
  callNextCustomer: () => { customer: Customer; technician?: Technician } | null
  confirmAssignment: (customerId: string, technicianId: string) => Booking | null
  startService: (bookingId: string) => void
  completeService: (bookingId: string) => void

  handlePass: (customerId: string) => void
  cancelCustomer: (customerId: string) => void

  extendBooking: (bookingId: string, additionalMinutes: number) => Booking | null
  mergeBookings: (bookingIds: string[]) => Booking | null
  splitBooking: (bookingId: string, splitTime: Date) => Booking[] | null
  cancelBookingSegment: (bookingId: string, cancelStart: Date, cancelEnd: Date) => Booking | null
  cancelBooking: (bookingId: string) => void

  calculateCommission: (booking: Booking) => CommissionRecord
  getTechnicianBookings: (technicianId: string) => Booking[]
  getTechnicianCommissions: (technicianId: string, startDate?: Date, endDate?: Date) => CommissionRecord[]
  getTotalCommissions: (startDate?: Date, endDate?: Date) => { technicianId: string; total: number; records: CommissionRecord[] }[]

  isTechnicianBusy: (technicianId: string, time: Date) => boolean
  getAvailableTechnicians: (level?: TechnicianLevel, forTime?: Date) => Technician[]
  getCustomerBookings: (customerId: string) => Booking[]
  checkAndMergeConsecutiveBookings: (customerId: string, technicianId: string, newStartTime: Date, duration: number) => Booking | null
  getBookingActiveDuration: (booking: Booking) => number
  getTechnicianCurrentStatus: (technicianId: string, time?: Date) => TechnicianCurrentStatus
  isTechnicianAvailableForTime: (technicianId: string, startTime: Date, duration: number) => boolean
  getTechnicianActiveSegment: (technicianId: string, time?: Date) => { booking: Booking; segment: TimeSegment } | null
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const createSegment = (startTime: Date, duration: number): TimeSegment => {
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000)
  return {
    id: generateId(),
    startTime,
    endTime,
    duration,
    status: 'active',
  }
}

const calculateSegmentsDuration = (segments: TimeSegment[]): number => {
  return segments
    .filter(s => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.duration, 0)
}

const initialTechnicians: Technician[] = [
  { id: generateId(), name: '张三', number: 1, level: 'senior', status: 'idle' },
  { id: generateId(), name: '李四', number: 2, level: 'intermediate', status: 'idle' },
  { id: generateId(), name: '王五', number: 3, level: 'junior', status: 'idle' },
  { id: generateId(), name: '赵六', number: 6, level: 'supervisor', status: 'idle' },
  { id: generateId(), name: '钱七', number: 8, level: 'senior', status: 'idle' },
  { id: generateId(), name: '孙八', number: 12, level: 'intermediate', status: 'idle' },
]

export const useStore = create<AppState & AppActions>((set, get) => ({
  technicians: initialTechnicians,
  customers: [],
  bookings: [],
  commissions: [],
  currentQueueNumber: 0,
  maxPassCount: 3,
  timeSlotMinutes: 60,

  addTechnician: (tech) => {
    set((state) => ({
      technicians: [...state.technicians, { ...tech, id: generateId() }],
    }))
  },

  updateTechnician: (id, updates) => {
    set((state) => ({
      technicians: state.technicians.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }))
  },

  removeTechnician: (id) => {
    set((state) => ({
      technicians: state.technicians.filter((t) => t.id !== id),
    }))
  },

  takeQueueNumber: (customerData) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      queueNumber: get().currentQueueNumber + 1,
      status: 'waiting',
      queueTime: new Date(),
      passCount: 0,
    }
    set((state) => ({
      customers: [...state.customers, newCustomer],
      currentQueueNumber: state.currentQueueNumber + 1,
    }))
    return newCustomer
  },

  callNextCustomer: () => {
    const state = get()
    const waitingCustomers = state.customers
      .filter((c) => c.status === 'waiting')
      .sort((a, b) => a.queueTime.getTime() - b.queueTime.getTime())

    if (waitingCustomers.length === 0) return null

    const nextCustomer = waitingCustomers[0]
    let assignedTechnician: Technician | undefined

    if (nextCustomer.requestedTechnicianId) {
      const requestedTech = state.technicians.find(
        (t) => t.id === nextCustomer.requestedTechnicianId
      )
      if (requestedTech && requestedTech.status !== 'break' && requestedTech.status !== 'off') {
        if (!state.isTechnicianBusy(requestedTech.id, new Date())) {
          assignedTechnician = requestedTech
        }
      }
    } else {
      const availableTechs = state.getAvailableTechnicians(
        nextCustomer.requestedLevel
      )
      if (availableTechs.length > 0) {
        assignedTechnician = availableTechs[0]
      }
    }

    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === nextCustomer.id ? { ...c, status: 'called' as CustomerStatus } : c
      ),
    }))

    return { customer: nextCustomer, technician: assignedTechnician }
  },

  confirmAssignment: (customerId, technicianId) => {
    const state = get()
    const customer = state.customers.find((c) => c.id === customerId)
    const technician = state.technicians.find((t) => t.id === technicianId)

    if (!customer || !technician) return null
    if (technician.status === 'break' || technician.status === 'off') return null

    const startTime = new Date()
    const duration = state.timeSlotMinutes
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

    if (!state.isTechnicianAvailableForTime(technicianId, startTime, duration)) return null

    const mergedBooking = state.checkAndMergeConsecutiveBookings(
      customerId,
      technicianId,
      startTime,
      duration
    )

    if (mergedBooking) {
      set((s) => ({
        customers: s.customers.map((c) =>
          c.id === customerId ? { ...c, status: 'serving' as CustomerStatus } : c
        ),
        technicians: s.technicians.map((t) =>
          t.id === technicianId
            ? {
                ...t,
                status: 'busy' as TechnicianStatus,
                currentBookingId: t.currentBookingId || mergedBooking.id,
              }
            : t
        ),
      }))
      return mergedBooking
    }

    const newBooking: Booking = {
      id: generateId(),
      customerId,
      technicianId,
      startTime,
      endTime,
      duration,
      status: 'confirmed',
      isMerged: false,
      segments: [createSegment(startTime, duration)],
      createdAt: new Date(),
    }

    set((s) => ({
      bookings: [...s.bookings, newBooking],
      customers: s.customers.map((c) =>
        c.id === customerId ? { ...c, status: 'serving' as CustomerStatus } : c
      ),
      technicians: s.technicians.map((t) =>
        t.id === technicianId
          ? {
              ...t,
              status: 'busy' as TechnicianStatus,
              currentBookingId: t.currentBookingId || newBooking.id,
            }
          : t
      ),
    }))

    return newBooking
  },

  startService: (bookingId) => {
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === bookingId
          ? { ...b, status: 'in_progress' as BookingStatus, startTime: new Date() }
          : b
      ),
    }))
  },

  completeService: (bookingId) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return

    const commission = state.calculateCommission(booking)

    const technicianId = booking.technicianId

    set((s) => {
      const updatedBookings = s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'completed' as BookingStatus,
              completedAt: new Date(),
              endTime: new Date(),
            }
          : b
      )

      const hasOtherActiveBookings = updatedBookings.some(
        (b) =>
          b.technicianId === technicianId &&
          b.id !== bookingId &&
          b.status !== 'cancelled' &&
          b.status !== 'completed'
      )

      return {
        bookings: updatedBookings,
        customers: s.customers.map((c) =>
          c.id === booking.customerId
            ? { ...c, status: 'completed' as CustomerStatus }
            : c
        ),
        technicians: s.technicians.map((t) => {
          if (t.id !== technicianId) return t
          if (hasOtherActiveBookings) {
            const otherActive = updatedBookings.find(
              (b) =>
                b.technicianId === technicianId &&
                b.id !== bookingId &&
                b.status !== 'cancelled' &&
                b.status !== 'completed'
            )
            return {
              ...t,
              status: 'busy' as TechnicianStatus,
              currentBookingId: otherActive?.id || t.currentBookingId,
            }
          }
          return { ...t, status: 'idle' as TechnicianStatus, currentBookingId: undefined }
        }),
        commissions: [...s.commissions, commission],
      }
    })
  },

  handlePass: (customerId) => {
    const state = get()
    const customer = state.customers.find((c) => c.id === customerId)
    if (!customer) return

    const newPassCount = customer.passCount + 1

    if (newPassCount >= state.maxPassCount) {
      set((s) => ({
        customers: s.customers.map((c) =>
          c.id === customerId
            ? { ...c, status: 'invalid' as CustomerStatus, passCount: newPassCount }
            : c
        ),
      }))
      return
    }

    set((s) => ({
      customers: s.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              status: 'waiting' as CustomerStatus,
              passCount: newPassCount,
              lastPassTime: new Date(),
              queueTime: new Date(),
            }
          : c
      ),
    }))
  },

  cancelCustomer: (customerId) => {
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === customerId ? { ...c, status: 'cancelled' as CustomerStatus } : c
      ),
    }))
  },

  extendBooking: (bookingId, additionalMinutes) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return null
    if (booking.status === 'cancelled' || booking.status === 'completed') return null

    const newEndTime = new Date(booking.endTime.getTime() + additionalMinutes * 60 * 1000)
    const newSegment = createSegment(booking.endTime, additionalMinutes)

    const updatedBooking: Booking = {
      ...booking,
      endTime: newEndTime,
      duration: booking.duration + additionalMinutes,
      segments: [...booking.segments, newSegment],
      isMerged: true,
    }

    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? updatedBooking : b)),
    }))

    return updatedBooking
  },

  mergeBookings: (bookingIds) => {
    const state = get()
    const bookingsToMerge = state.bookings.filter((b) => bookingIds.includes(b.id))

    if (bookingsToMerge.length < 2) return null

    const customerId = bookingsToMerge[0].customerId
    const technicianId = bookingsToMerge[0].technicianId

    if (!bookingsToMerge.every((b) => b.customerId === customerId && b.technicianId === technicianId)) {
      return null
    }

    const sortedBookings = [...bookingsToMerge].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    )

    for (let i = 1; i < sortedBookings.length; i++) {
      const gap = sortedBookings[i].startTime.getTime() - sortedBookings[i - 1].endTime.getTime()
      if (gap > 60 * 1000) {
        return null
      }
    }

    const allSegments: TimeSegment[] = []
    sortedBookings.forEach((b) => {
      allSegments.push(...b.segments)
    })

    const mergedBooking: Booking = {
      id: generateId(),
      customerId,
      technicianId,
      startTime: sortedBookings[0].startTime,
      endTime: sortedBookings[sortedBookings.length - 1].endTime,
      duration: Math.ceil(
        (sortedBookings[sortedBookings.length - 1].endTime.getTime() - sortedBookings[0].startTime.getTime()) / (60 * 1000)
      ),
      status: 'confirmed',
      isMerged: true,
      mergedFrom: bookingIds,
      segments: allSegments,
      createdAt: new Date(),
    }

    set((s) => ({
      bookings: [
        ...s.bookings.filter((b) => !bookingIds.includes(b.id)),
        mergedBooking,
      ],
    }))

    return mergedBooking
  },

  splitBooking: (bookingId, splitTime) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)

    if (!booking) return null

    if (splitTime <= booking.startTime || splitTime >= booking.endTime) {
      return null
    }

    const firstSegments: TimeSegment[] = []
    const secondSegments: TimeSegment[] = []

    booking.segments.forEach((seg) => {
      if (seg.endTime <= splitTime) {
        firstSegments.push(seg)
      } else if (seg.startTime >= splitTime) {
        secondSegments.push(seg)
      } else {
        const firstPartDuration = Math.ceil(
          (splitTime.getTime() - seg.startTime.getTime()) / (60 * 1000)
        )
        const secondPartDuration = seg.duration - firstPartDuration

        firstSegments.push({
          ...seg,
          id: generateId(),
          endTime: splitTime,
          duration: firstPartDuration,
        })
        secondSegments.push({
          ...seg,
          id: generateId(),
          startTime: splitTime,
          duration: secondPartDuration,
        })
      }
    })

    const firstDuration = firstSegments.reduce((sum, s) => sum + s.duration, 0)
    const secondDuration = secondSegments.reduce((sum, s) => sum + s.duration, 0)

    const firstBooking: Booking = {
      id: generateId(),
      customerId: booking.customerId,
      technicianId: booking.technicianId,
      startTime: booking.startTime,
      endTime: splitTime,
      duration: firstDuration,
      status: booking.status,
      isMerged: false,
      splitFrom: bookingId,
      segments: firstSegments,
      createdAt: new Date(),
    }

    const secondBooking: Booking = {
      id: generateId(),
      customerId: booking.customerId,
      technicianId: booking.technicianId,
      startTime: splitTime,
      endTime: booking.endTime,
      duration: secondDuration,
      status: booking.status,
      isMerged: false,
      splitFrom: bookingId,
      segments: secondSegments,
      createdAt: new Date(),
    }

    set((s) => ({
      bookings: [
        ...s.bookings.filter((b) => b.id !== bookingId),
        firstBooking,
        secondBooking,
      ],
    }))

    return [firstBooking, secondBooking]
  },

  cancelBookingSegment: (bookingId, cancelStart, cancelEnd) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return null

    if (cancelStart < booking.startTime) cancelStart = booking.startTime
    if (cancelEnd > booking.endTime) cancelEnd = booking.endTime
    if (cancelStart >= cancelEnd) return null

    const newSegments: TimeSegment[] = []

    booking.segments.forEach((seg) => {
      if (seg.status === 'cancelled') {
        newSegments.push(seg)
        return
      }

      if (seg.endTime <= cancelStart || seg.startTime >= cancelEnd) {
        newSegments.push(seg)
      } else if (seg.startTime >= cancelStart && seg.endTime <= cancelEnd) {
        newSegments.push({ ...seg, status: 'cancelled' })
      } else if (seg.startTime < cancelStart && seg.endTime > cancelEnd) {
        const beforeDuration = Math.ceil(
          (cancelStart.getTime() - seg.startTime.getTime()) / (60 * 1000)
        )
        const afterDuration = Math.ceil(
          (seg.endTime.getTime() - cancelEnd.getTime()) / (60 * 1000)
        )

        newSegments.push({
          ...seg,
          id: generateId(),
          endTime: cancelStart,
          duration: beforeDuration,
        })
        newSegments.push({
          ...seg,
          id: generateId(),
          startTime: cancelStart,
          endTime: cancelEnd,
          duration: Math.ceil(
            (cancelEnd.getTime() - cancelStart.getTime()) / (60 * 1000)
          ),
          status: 'cancelled',
        })
        newSegments.push({
          ...seg,
          id: generateId(),
          startTime: cancelEnd,
          duration: afterDuration,
        })
      } else if (seg.startTime < cancelStart) {
        const keepDuration = Math.ceil(
          (cancelStart.getTime() - seg.startTime.getTime()) / (60 * 1000)
        )
        const cancelDuration = seg.duration - keepDuration

        newSegments.push({
          ...seg,
          id: generateId(),
          endTime: cancelStart,
          duration: keepDuration,
        })
        newSegments.push({
          ...seg,
          id: generateId(),
          startTime: cancelStart,
          duration: cancelDuration,
          status: 'cancelled',
        })
      } else {
        const cancelDuration = Math.ceil(
          (cancelEnd.getTime() - seg.startTime.getTime()) / (60 * 1000)
        )
        const keepDuration = seg.duration - cancelDuration

        newSegments.push({
          ...seg,
          id: generateId(),
          duration: cancelDuration,
          endTime: cancelEnd,
          status: 'cancelled',
        })
        newSegments.push({
          ...seg,
          id: generateId(),
          startTime: cancelEnd,
          duration: keepDuration,
        })
      }
    })

    const activeSegments = newSegments.filter((s) => s.status !== 'cancelled')
    if (activeSegments.length === 0) {
      get().cancelBooking(bookingId)
      return null
    }

    const updatedBooking: Booking = {
      ...booking,
      segments: newSegments,
    }

    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? updatedBooking : b)),
    }))

    return updatedBooking
  },

  cancelBooking: (bookingId) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return

    const technicianId = booking.technicianId

    set((s) => {
      const updatedBookings = s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'cancelled' as BookingStatus,
              cancelledAt: new Date(),
              segments: b.segments.map((seg) => ({ ...seg, status: 'cancelled' as const })),
            }
          : b
      )

      const hasOtherActiveBookings = updatedBookings.some(
        (b) =>
          b.technicianId === technicianId &&
          b.id !== bookingId &&
          b.status !== 'cancelled' &&
          b.status !== 'completed'
      )

      return {
        bookings: updatedBookings,
        customers: s.customers.map((c) =>
          c.id === booking.customerId
            ? { ...c, status: 'cancelled' as CustomerStatus }
            : c
        ),
        technicians: s.technicians.map((t) => {
          if (t.id !== technicianId) return t
          if (hasOtherActiveBookings) {
            const otherActive = updatedBookings.find(
              (b) =>
                b.technicianId === technicianId &&
                b.id !== bookingId &&
                b.status !== 'cancelled' &&
                b.status !== 'completed'
            )
            return {
              ...t,
              status: 'busy' as TechnicianStatus,
              currentBookingId: otherActive?.id || t.currentBookingId,
            }
          }
          return { ...t, status: 'idle' as TechnicianStatus, currentBookingId: undefined }
        }),
      }
    })
  },

  calculateCommission: (booking) => {
    const state = get()
    const technician = state.technicians.find((t) => t.id === booking.technicianId)
    if (!technician) {
      throw new Error('Technician not found')
    }

    const levelConfig = TECHNICIAN_LEVEL_CONFIG[technician.level]
    const effectiveDuration = state.getBookingActiveDuration(booking)
    const totalHours = booking.duration / 60
    const effectiveHours = effectiveDuration / 60
    const totalAmount = levelConfig.pricePerHour * totalHours
    const effectiveAmount = levelConfig.pricePerHour * effectiveHours
    const commissionAmount = effectiveAmount * levelConfig.commissionRate

    const commission: CommissionRecord = {
      id: generateId(),
      bookingId: booking.id,
      technicianId: booking.technicianId,
      customerId: booking.customerId,
      startTime: booking.startTime,
      duration: booking.duration,
      effectiveDuration,
      totalAmount: Math.round(totalAmount * 100) / 100,
      effectiveAmount: Math.round(effectiveAmount * 100) / 100,
      commissionRate: levelConfig.commissionRate,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      technicianLevel: technician.level,
      createdAt: new Date(),
    }

    return commission
  },

  getTechnicianBookings: (technicianId) => {
    return get().bookings.filter((b) => b.technicianId === technicianId)
  },

  getTechnicianCommissions: (technicianId, startDate?, endDate?) => {
    const state = get()
    return state.commissions.filter((c) => {
      if (c.technicianId !== technicianId) return false
      if (startDate && c.startTime < startDate) return false
      if (endDate && c.startTime > endDate) return false
      return true
    })
  },

  getTotalCommissions: (startDate?, endDate?) => {
    const state = get()
    const grouped: Record<string, CommissionRecord[]> = {}

    state.commissions.forEach((c) => {
      if (startDate && c.startTime < startDate) return
      if (endDate && c.startTime > endDate) return

      if (!grouped[c.technicianId]) {
        grouped[c.technicianId] = []
      }
      grouped[c.technicianId].push(c)
    })

    return Object.entries(grouped).map(([technicianId, records]) => ({
      technicianId,
      total: records.reduce((sum, r) => sum + r.commissionAmount, 0),
      records,
    }))
  },

  isTechnicianBusy: (technicianId, time) => {
    const state = get()
    return state.bookings.some(
      (b) =>
        b.technicianId === technicianId &&
        b.status !== 'cancelled' &&
        b.status !== 'completed' &&
        time >= b.startTime &&
        time <= b.endTime &&
        b.segments.some(
          (s) => s.status !== 'cancelled' && time >= s.startTime && time <= s.endTime
        )
    )
  },

  getAvailableTechnicians: (level?, forTime?) => {
    const state = get()
    const checkTime = forTime || new Date()
    return state.technicians.filter((t) => {
      if (t.status === 'break' || t.status === 'off') return false
      if (level && t.level !== level) return false
      return !state.isTechnicianBusy(t.id, checkTime)
    })
  },

  getTechnicianActiveSegment: (technicianId, time?) => {
    const state = get()
    const checkTime = time || new Date()
    const activeBookings = state.bookings.filter(
      (b) =>
        b.technicianId === technicianId &&
        b.status !== 'cancelled' &&
        b.status !== 'completed'
    )
    for (const booking of activeBookings) {
      for (const segment of booking.segments) {
        if (
          segment.status !== 'cancelled' &&
          checkTime >= segment.startTime &&
          checkTime <= segment.endTime
        ) {
          return { booking, segment }
        }
      }
    }
    return null
  },

  getTechnicianCurrentStatus: (technicianId, time?) => {
    const state = get()
    const checkTime = time || new Date()
    const tech = state.technicians.find((t) => t.id === technicianId)
    if (!tech) return { status: 'off' as const }
    if (tech.status === 'break') return { status: 'break' as const }
    if (tech.status === 'off') return { status: 'off' as const }

    const activeSegment = state.getTechnicianActiveSegment(technicianId, checkTime)
    if (activeSegment) {
      const customer = state.customers.find(
        (c) => c.id === activeSegment.booking.customerId
      )
      return {
        status: 'in_service' as const,
        bookingId: activeSegment.booking.id,
        customerName: customer?.name || '未知',
        customerQueueNumber: customer?.queueNumber || 0,
        endTime: activeSegment.segment.endTime,
      }
    }

    const activeBookings = state.bookings.filter(
      (b) =>
        b.technicianId === technicianId &&
        b.status !== 'cancelled' &&
        b.status !== 'completed'
    )

    let gapPeriod: { startTime: Date; endTime: Date } | undefined

    for (const booking of activeBookings) {
      const isInBookingRange = checkTime >= booking.startTime && checkTime <= booking.endTime
      if (!isInBookingRange) continue

      for (const seg of booking.segments) {
        if (seg.status === 'cancelled' && checkTime >= seg.startTime && checkTime <= seg.endTime) {
          gapPeriod = { startTime: seg.startTime, endTime: seg.endTime }
          break
        }
      }
      if (gapPeriod) break
    }

    const allUpcomingSegments: { booking: Booking; segment: TimeSegment }[] = []
    for (const booking of activeBookings) {
      for (const segment of booking.segments) {
        if (segment.status !== 'cancelled' && segment.startTime > checkTime) {
          allUpcomingSegments.push({ booking, segment })
        }
      }
    }
    allUpcomingSegments.sort(
      (a, b) => a.segment.startTime.getTime() - b.segment.startTime.getTime()
    )

    if (allUpcomingSegments.length > 0) {
      const next = allUpcomingSegments[0]
      const customer = state.customers.find(
        (c) => c.id === next.booking.customerId
      )
      const result: TechnicianCurrentStatus = {
        status: 'in_service' as const,
        bookingId: next.booking.id,
        customerName: customer?.name || '未知',
        customerQueueNumber: customer?.queueNumber || 0,
        endTime: next.segment.endTime,
        isGap: true,
        nextService: {
          startTime: next.segment.startTime,
          endTime: next.segment.endTime,
        },
      }
      if (gapPeriod) {
        result.gapPeriod = gapPeriod
      }
      return result
    }

    if (gapPeriod) {
      const booking = activeBookings.find(
        (b) => checkTime >= b.startTime && checkTime <= b.endTime
      )
      const customer = booking
        ? state.customers.find((c) => c.id === booking.customerId)
        : undefined
      return {
        status: 'in_service' as const,
        bookingId: booking?.id || '',
        customerName: customer?.name || '未知',
        customerQueueNumber: customer?.queueNumber || 0,
        endTime: gapPeriod.endTime,
        isGap: true,
        gapPeriod,
      }
    }

    return { status: 'idle' as const }
  },

  isTechnicianAvailableForTime: (technicianId, startTime, duration) => {
    const state = get()
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)
    const activeBookings = state.bookings.filter(
      (b) =>
        b.technicianId === technicianId &&
        b.status !== 'cancelled' &&
        b.status !== 'completed'
    )
    for (const booking of activeBookings) {
      for (const segment of booking.segments) {
        if (segment.status === 'cancelled') continue
        if (
          (startTime >= segment.startTime && startTime < segment.endTime) ||
          (endTime > segment.startTime && endTime <= segment.endTime) ||
          (startTime <= segment.startTime && endTime >= segment.endTime)
        ) {
          return false
        }
      }
    }
    return true
  },

  getCustomerBookings: (customerId) => {
    return get().bookings.filter((b) => b.customerId === customerId)
  },

  checkAndMergeConsecutiveBookings: (customerId, technicianId, newStartTime, duration) => {
    const state = get()
    const newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000)

    const existingBookings = state.bookings.filter(
      (b) =>
        b.customerId === customerId &&
        b.technicianId === technicianId &&
        b.status !== 'cancelled' &&
        b.status !== 'completed'
    )

    const bookingsToMerge: string[] = []
    const allSegments: TimeSegment[] = [createSegment(newStartTime, duration)]
    let earliestStart = newStartTime
    let latestEnd = newEndTime

    for (const booking of existingBookings) {
      const gapBefore = booking.endTime.getTime() - newStartTime.getTime()
      const gapAfter = newEndTime.getTime() - booking.startTime.getTime()

      if (
        (gapBefore >= 0 && gapBefore <= 60 * 1000) ||
        (gapAfter >= 0 && gapAfter <= 60 * 1000) ||
        (booking.startTime <= newStartTime && booking.endTime >= newEndTime)
      ) {
        bookingsToMerge.push(booking.id)
        allSegments.push(...booking.segments)
        if (booking.startTime < earliestStart) earliestStart = booking.startTime
        if (booking.endTime > latestEnd) latestEnd = booking.endTime
      }
    }

    if (bookingsToMerge.length > 0) {
      const newBooking: Booking = {
        id: generateId(),
        customerId,
        technicianId,
        startTime: earliestStart,
        endTime: latestEnd,
        duration: Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (60 * 1000)),
        status: 'confirmed',
        isMerged: true,
        mergedFrom: bookingsToMerge,
        segments: allSegments,
        createdAt: new Date(),
      }

      set((s) => ({
        bookings: [
          ...s.bookings.filter((b) => !bookingsToMerge.includes(b.id)),
          newBooking,
        ],
      }))

      return newBooking
    }

    return null
  },

  getBookingActiveDuration: (booking) => {
    return calculateSegmentsDuration(booking.segments)
  },
}))
