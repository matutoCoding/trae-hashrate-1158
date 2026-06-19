import dayjs from 'dayjs'
import { TECHNICIAN_LEVEL_CONFIG, type TechnicianLevel, type TechnicianStatus, type CustomerStatus, type BookingStatus } from '@/types'

export const formatTime = (date: Date): string => {
  return dayjs(date).format('HH:mm:ss')
}

export const formatDateTime = (date: Date): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}小时${mins > 0 ? `${mins}分钟` : ''}`
  }
  return `${mins}分钟`
}

export const formatMoney = (amount: number): string => {
  return `¥${amount.toFixed(2)}`
}

export const getLevelName = (level: TechnicianLevel): string => {
  return TECHNICIAN_LEVEL_CONFIG[level]?.name || level
}

export const getLevelPrice = (level: TechnicianLevel): number => {
  return TECHNICIAN_LEVEL_CONFIG[level]?.pricePerHour || 0
}

export const getLevelCommissionRate = (level: TechnicianLevel): number => {
  return TECHNICIAN_LEVEL_CONFIG[level]?.commissionRate || 0
}

export const getTechnicianStatusText = (status: TechnicianStatus): string => {
  const map: Record<TechnicianStatus, string> = {
    idle: '空闲',
    busy: '服务中',
    break: '休息',
    off: '下班',
  }
  return map[status] || status
}

export const getTechnicianStatusColor = (status: TechnicianStatus): string => {
  const map: Record<TechnicianStatus, string> = {
    idle: 'bg-green-100 text-green-800',
    busy: 'bg-red-100 text-red-800',
    break: 'bg-yellow-100 text-yellow-800',
    off: 'bg-gray-100 text-gray-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

export const getCustomerStatusText = (status: CustomerStatus): string => {
  const map: Record<CustomerStatus, string> = {
    waiting: '排队中',
    called: '已叫号',
    serving: '服务中',
    completed: '已完成',
    cancelled: '已取消',
    invalid: '已作废',
  }
  return map[status] || status
}

export const getCustomerStatusColor = (status: CustomerStatus): string => {
  const map: Record<CustomerStatus, string> = {
    waiting: 'bg-blue-100 text-blue-800',
    called: 'bg-orange-100 text-orange-800',
    serving: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    invalid: 'bg-purple-100 text-purple-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

export const getBookingStatusText = (status: BookingStatus): string => {
  const map: Record<BookingStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    split: '已拆分',
  }
  return map[status] || status
}

export const getBookingStatusColor = (status: BookingStatus): string => {
  const map: Record<BookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    split: 'bg-purple-100 text-purple-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

export const waitTime = (startTime: Date): string => {
  const diff = dayjs().diff(startTime, 'minute')
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${diff}分钟`
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  return `${hours}小时${mins > 0 ? `${mins}分钟` : ''}`
}
