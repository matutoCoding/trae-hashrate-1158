import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { type Technician, type GapInfo } from '@/types'
import { formatTime, formatDuration } from '@/utils/format'
import { X, Clock, UserPlus, CalendarClock } from 'lucide-react'

interface GapBookingModalProps {
  open: boolean
  onClose: () => void
  technician: Technician | null
  gap: GapInfo | null
}

const DURATION_OPTIONS = [30, 60, 90, 120]

export default function GapBookingModal({
  open,
  onClose,
  technician,
  gap,
}: GapBookingModalProps) {
  const { customers, createBookingAtTime, takeQueueNumber } = useStore()
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(60)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  
  const waitingCustomers = useMemo(() => {
    return customers.filter(c => c.status === 'waiting' || c.status === 'called')
  }, [customers])

  const maxDuration = useMemo(() => {
    if (!gap) return 0
    return gap.duration
  }, [gap])
  
  const availableDurations = useMemo(() => {
    return DURATION_OPTIONS.filter(d => d <= maxDuration)
  }, [maxDuration])

  const startTime = gap?.startTime || new Date()

  useEffect(() => {
    if (open) {
      setSelectedCustomerId('')
      setSelectedDuration(Math.min(60, maxDuration) || 30)
      setNewCustomerName('')
      setShowNewCustomer(false)
    }
  }, [open, maxDuration])
  
  const handleConfirm = () => {
    if (!technician || !gap) return

    let targetCustomerId = selectedCustomerId

    if (showNewCustomer && newCustomerName.trim()) {
      const newCustomer = takeQueueNumber({ name: newCustomerName.trim() })
      targetCustomerId = newCustomer.id
    }

    if (!targetCustomerId) {
      alert('请选择或创建客人')
      return
    }
    
    const booking = createBookingAtTime(
      targetCustomerId,
      technician.id,
      startTime,
      selectedDuration
    )
    if (booking) {
      onClose()
    } else {
      alert('预约失败，该时段可能已被占用')
    }
  }
  
  if (!open || !technician || !gap) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-secondary-500" />
            空挡预约
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <div className="font-medium text-purple-700 mb-2">
              技师: {technician.name} ({technician.number}号)
            </div>
            <div className="text-sm text-purple-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              空挡时间: {formatTime(gap.startTime)} - {formatTime(gap.endTime)}
            </div>
            <div className="text-sm text-purple-600 mt-1">
              空挡时长: {formatDuration(maxDuration)}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">服务时长</label>
            <div className="flex gap-2">
              {availableDurations.length === 0 ? (
                <span className="text-sm text-gray-500">空挡时间过短，无法预约</span>
              ) : (
                availableDurations.map(dur => (
                  <button
                    key={dur}
                    onClick={() => setSelectedDuration(dur)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      selectedDuration === dur
                        ? 'bg-secondary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {formatDuration(dur)}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">选择客人</label>
              <button
                onClick={() => setShowNewCustomer(!showNewCustomer)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                {showNewCustomer ? '选已有客人' : '新客取号'}
              </button>
            </div>

            {showNewCustomer ? (
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="请输入客人姓名"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              <div className="max-h-40 overflow-auto border border-gray-200 rounded-lg">
                {waitingCustomers.length === 0 ? (
                  <div className="p-3 text-center text-gray-500 text-sm">
                    暂无等待中的客人
                  </div>
                ) : (
                  waitingCustomers.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                        selectedCustomerId === customer.id
                          ? 'bg-primary-50 border-l-2 border-l-primary-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {customer.queueNumber.toString().padStart(3, '0')} {customer.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {customer.status === 'waiting' ? '等待中' : '已叫号'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <div className="flex justify-between mb-1">
              <span>开始时间</span>
              <span className="font-medium">{formatTime(startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>预计结束</span>
              <span className="font-medium">{formatTime(new Date(startTime.getTime() + selectedDuration * 60 * 1000))}</span>
            </div>
          </div>
          
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={availableDurations.length === 0 || (!selectedCustomerId && !(showNewCustomer && newCustomerName.trim()))}
              className="flex-1 px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认预约
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
