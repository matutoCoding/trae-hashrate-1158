import { create } from 'zustand'
import {
  Technician,
  Customer,
  Booking,
  AppState,
  TechnicianLevel,
  TechnicianStatus,
  CustomerStatus,
  BookingStatus,
  TECHNICIAN_LEVEL_CONFIG,
} from '../src/types'

const generateId = () => Math.random().toString(36).substr(2, 9)

const initialTechnicians: Technician[] = [
  { id: 'tech1', name: '张三', number: 1, level: 'senior', status: 'idle' },
  { id: 'tech2', name: '李四', number: 2, level: 'intermediate', status: 'idle' },
  { id: 'tech3', name: '王五', number: 3, level: 'junior', status: 'idle' },
]

interface TestActions {
  addTechnician: (tech: Omit<Technician, 'id'>) => void
  takeQueueNumber: (customer: Omit<Customer, 'id' | 'queueNumber' | 'status' | 'queueTime' | 'passCount'>) => Customer
  callNextCustomer: () => { customer: Customer; technician?: Technician } | null
  confirmAssignment: (customerId: string, technicianId: string) => Booking | null
  handlePass: (customerId: string) => void
  mergeBookings: (bookingIds: string[]) => Booking | null
  splitBooking: (bookingId: string, splitTime: Date) => Booking[] | null
  cancelBooking: (bookingId: string) => void
  completeService: (bookingId: string) => void
  calculateCommission: (booking: Booking) => { totalAmount: number; commission: number }
  getAvailableTechnicians: (level?: TechnicianLevel) => Technician[]
  checkAndMergeConsecutiveBookings: (customerId: string, technicianId: string, newStartTime: Date, duration: number) => Booking | null
}

const useTestStore = create<AppState & TestActions>((set, get) => ({
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

  completeService: (bookingId) => {
    const state = get()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) return

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
        (sortedBookings[sortedBookings.length - 1].endTime.getTime() - sortedBookings[0].startTime.getTime()
      ) / (60 * 1000),
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
      duration: Math.ceil((splitTime.getTime() - booking.startTime.getTime()) / (60 * 1000),
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
      duration: Math.ceil((booking.endTime.getTime() - splitTime.getTime()) / (60 * 1000),
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
    const commission = totalAmount * levelConfig.commissionRate

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
    }
  },

  getAvailableTechnicians: (level?) => {
    const state = get()
    return state.technicians.filter(
      (t) => t.status === 'idle' && (!level || t.level === level)
    )
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
        duration: Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (60 * 1000),
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

function runTests() {
  console.log('=== 足浴店技师派钟系统 - 业务逻辑测试\n')
  
  const store = useTestStore.getState()
  
  console.log('1. 测试取号排队...')
  const customer1 = store.takeQueueNumber({ name: '客人A' })
  const customer2 = store.takeQueueNumber({ name: '客人B', requestedLevel: 'senior' })
  const customer3 = store.takeQueueNumber({ name: '客人C' })
  
  console.log(`  ✓ 取号成功: ${customer1.name} (#${customer1.queueNumber}), ${customer2.name} (#${customer2.queueNumber}), ${customer3.name} (#${customer3.queueNumber})`)
  console.log(`  ✓ 当前排队人数: ${store.customers.filter(c => c.status === 'waiting').length}\n`)
  
  console.log('2. 测试叫号...')
  const callResult1 = store.callNextCustomer()
  console.log(`  ✓ 叫到: ${callResult1?.customer.name} (${callResult1?.customer.queueNumber}号)`)
  console.log(`  ✓ 推荐技师: ${callResult1?.technician?.name || '无'}\n`)
  
  console.log('3. 测试派钟...')
  if (callResult1 && callResult1.technician) {
    const booking1 = store.confirmAssignment(callResult1.customer.id, callResult1.technician.id)
    console.log(`  ✓ 派钟成功: ${callResult1.customer.name} -> ${callResult1.technician.name} (${TECHNICIAN_LEVEL_CONFIG[callResult1.technician.level].name})`)
    console.log(`  ✓ 技师状态变为: ${store.technicians.find(t => t.id === callResult1?.technician?.id)?.status}\n`)
  }
  
  console.log('4. 测试过号处理...')
  const callResult2 = store.callNextCustomer()
  console.log(`  ✓ 叫到: ${callResult2?.customer.name}`)
  
  if (callResult2) {
    store.handlePass(callResult2.customer.id)
    const updatedCustomer = store.customers.find(c => c.id === callResult2.customer.id)
    console.log(`  ✓ 过号1次，重新排队，过号次数: ${updatedCustomer?.passCount}\n`)
  }
  
  console.log('5. 测试连续过号作废...')
  const customer4 = store.takeQueueNumber({ name: '客人D' })
  for (let i = 0; i < 3; i++) {
    const result = store.callNextCustomer()
    if (result && result.customer.id === customer4.id) {
      store.handlePass(result.customer.id)
    }
  }
  const invalidCustomer = store.customers.find(c => c.id === customer4.id)
  console.log(`  ✓ 连续过号3次后状态: ${invalidCustomer?.status} (应为 invalid 表示已作废)\n`)
  
  console.log('6. 测试钟单合并...')
  const testBooking1: Booking = {
    id: 'test-booking-1',
    customerId: customer1.id,
    technicianId: 'tech2',
    startTime: new Date(),
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    duration: 60,
    status: 'confirmed',
    isMerged: false,
    createdAt: new Date(),
  }
  
  const testBooking2: Booking = {
    id: 'test-booking-2',
    customerId: customer1.id,
    technicianId: 'tech2',
    startTime: new Date(Date.now() + 60 * 60 * 1000 - 1000),
    endTime: new Date(Date.now() + 120 * 60 * 1000),
    duration: 60,
    status: 'confirmed',
    isMerged: false,
    createdAt: new Date(),
  }
  
  store.bookings.push(testBooking1, testBooking2)
  const merged = store.mergeBookings(['test-booking-1', 'test-booking-2'])
  console.log(`  ✓ 合并结果: ${merged ? '成功' : '失败'}`)
  if (merged) {
    console.log(`  ✓ 合并后时长: ${merged.duration}分钟`)
    console.log(`  ✓ 合并标记: ${merged.isMerged}\n`)
  }
  
  console.log('7. 测试拆分钟单...')
  if (merged) {
    const splitTime = new Date(merged.startTime.getTime() + 45 * 60 * 1000)
    const splitResult = store.splitBooking(merged.id, splitTime)
    console.log(`  ✓ 拆分结果: ${splitResult ? '成功' : '失败'} (拆分为 ${splitResult?.length || 0} 个钟单)\n`)
  }
  
  console.log('8. 测试提成分账计算...')
  const tech = store.technicians[0]
  const testBooking: Booking = {
    id: 'test-commission',
    customerId: customer1.id,
    technicianId: tech.id,
    startTime: new Date(),
    endTime: new Date(Date.now() + 90 * 60 * 1000),
    duration: 90,
    status: 'completed',
    isMerged: false,
    createdAt: new Date(),
  }
  const commissionResult = store.calculateCommission(testBooking)
  const levelConfig = TECHNICIAN_LEVEL_CONFIG[tech.level]
  console.log(`  ✓ 技师: ${tech.name} (${levelConfig.name})`)
  console.log(`  ✓ 单价: ¥${levelConfig.pricePerHour}/小时, 提成比例: ${levelConfig.commissionRate * 100}%`)
  console.log(`  ✓ 时长: ${testBooking.duration}分钟 = ${testBooking.duration / 60}小时`)
  console.log(`  ✓ 消费金额: ¥${commissionResult.totalAmount}`)
  console.log(`  ✓ 提成金额: ¥${commissionResult.commission}`)
  
  console.log('\n=== 所有测试完成!')
}

runTests()
