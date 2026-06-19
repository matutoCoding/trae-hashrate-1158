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
  
  mergeBookings: (bookingIds: string[]) => Booking | null
  splitBooking: (bookingId: string, splitTime: Date) => Booking[] | null
  cancelBooking: (bookingId: string) => void
  
  calculateCommission: (booking: Booking) => CommissionRecord
  getTechnicianBookings: (technicianId: string) => Booking[]
  getTechnicianCommissions: (technicianId: string, startDate?: Date, endDate?: Date) => CommissionRecord[]
  getTotalCommissions: (startDate?: Date, endDate?: Date) => { technicianId: string; total: number; records: CommissionRecord[] }[]
  
  isTechnicianBusy: (technicianId: string, time: Date) => boolean
  getAvailableTechnicians: (level?: TechnicianLevel) => Technician[]
  getCustomerBookings: (customerId: string) => Booking[]
  checkAndMergeConsecutiveBookings: (customerId: string, technicianId: string, newStartTime: Date, duration: number) => Booking | null
}

const generateId = () => Math.random().toString(36).substr(2, 9)

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
      if (requestedTech && requestedTech.status === 'idle') {
        assignedTechnician = requestedTech
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

    if (!customer || !technician || technician.status !== 'idle') return null

    const startTime = new Date()
    const duration = state.timeSlotMinutes
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000)

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
            ? { ...t, status: 'busy' as TechnicianStatus, currentBookingId: mergedBooking.id }
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
      createdAt: new Date(),
    }

    set((s) => ({
      bookings: [...s.bookings, newBooking],
      customers: s.customers.map((c) =>
        c.id === customerId ? { ...c, status: 'serving' as CustomerStatus } : c
      ),
      technicians: s.technicians.map((t) =>
        t.id === technicianId
          ? { ...t, status: 'busy' as TechnicianStatus, currentBookingId: newBooking.id }
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

    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'completed' as BookingStatus,
              completedAt: new Date(),
              endTime: new Date(),
            }
          : b
      ),
      customers: s.customers.map((c) =>
        c.id === booking.customerId
          ? { ...c, status: 'completed' as CustomerStatus }
          : c
      ),
      technicians: s.technicians.map((t) =>
        t.currentBookingId === bookingId
          ? { ...t, status: 'idle' as TechnicianStatus, currentBookingId: undefined }
          : t
      ),
      commissions: [...s.commissions, commission],
    }))
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

    if (!booking || !booking.isMerged) return null

    if (splitTime <= booking.startTime || splitTime >= booking.endTime) {
      return null
    }

    const firstBooking: Booking = {
      id: generateId(),
      customerId: booking.customerId,
      technicianId: booking.technicianId,
      startTime: booking.startTime,
      endTime: splitTime,
      duration: Math.ceil((splitTime.getTime() - booking.startTime.getTime()) / (60 * 1000)),
      status: booking.status,
      isMerged: false,
      splitFrom: bookingId,
      createdAt: new Date(),
    }

    const secondBooking: Booking = {
      id: generateId(),
      customerId: booking.customerId,
      technicianId: booking.technicianId,
      startTime: splitTime,
      endTime: booking.endTime,
      duration: Math.ceil((booking.endTime.getTime() - splitTime.getTime()) / (60 * 1000)),
      status: booking.status,
      isMerged: false,
      splitFrom: bookingId,
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

  cancelBooking: (bookingId) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return

    if (booking.isMerged && booking.mergedFrom) {
      const originalBookings = state.bookings.filter((b) => booking.mergedFrom?.includes(b.id))
      if (originalBookings.length === 0) {
        const splitTime = new Date(booking.startTime.getTime() + (booking.endTime.getTime() - booking.startTime.getTime()) / 2)
        state.splitBooking(bookingId, splitTime)
      }
    }

    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? { ...b, status: 'cancelled' as BookingStatus, cancelledAt: new Date() }
          : b
      ),
      customers: s.customers.map((c) =>
        c.id === booking.customerId
          ? { ...c, status: 'cancelled' as CustomerStatus }
          : c
      ),
      technicians: s.technicians.map((t) =>
        t.currentBookingId === bookingId
          ? { ...t, status: 'idle' as TechnicianStatus, currentBookingId: undefined }
          : t
      ),
    }))
  },

  calculateCommission: (booking) => {
    const state = get()
    const technician = state.technicians.find((t) => t.id === booking.technicianId)
    if (!technician) {
      throw new Error('Technician not found')
    }

    const levelConfig = TECHNICIAN_LEVEL_CONFIG[technician.level]
    const hours = booking.duration / 60
    const totalAmount = levelConfig.pricePerHour * hours
    const commissionAmount = totalAmount * levelConfig.commissionRate

    const commission: CommissionRecord = {
      id: generateId(),
      bookingId: booking.id,
      technicianId: booking.technicianId,
      customerId: booking.customerId,
      startTime: booking.startTime,
      duration: booking.duration,
      totalAmount: Math.round(totalAmount * 100) / 100,
      commissionRate: levelConfig.commissionRate,
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
      total: records.reduce((sum, r) => sum + r.totalAmount * r.commissionRate, 0),
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
        time <= b.endTime
    )
  },

  getAvailableTechnicians: (level?) => {
    const state = get()
    return state.technicians.filter(
      (t) => t.status === 'idle' && (!level || t.level === level)
    )
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
}))
