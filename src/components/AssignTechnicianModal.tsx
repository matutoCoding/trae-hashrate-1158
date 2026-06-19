import { useState, useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { TECHNICIAN_LEVEL_CONFIG, type Customer, type Technician } from '@/types'
import { getLevelName, formatDuration } from '@/utils/format'
import { X, UserCheck, Clock, Star } from 'lucide-react'

interface AssignTechnicianModalProps {
  open: boolean
  onClose: () => void
  customer: Customer
  suggestedTechnician?: Technician
}

const DURATION_OPTIONS = [30, 60, 90, 120]

export default function AssignTechnicianModal({
  open,
  onClose,
  customer,
  suggestedTechnician,
}: AssignTechnicianModalProps) {
  const { technicians, confirmAssignment, handlePass, getAvailableTechnicians } = useStore()
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(60)
  
  useEffect(() => {
    if (suggestedTechnician) {
      setSelectedTechnicianId(suggestedTechnician.id)
    } else {
      setSelectedTechnicianId('')
    }
    setSelectedDuration(60)
  }, [suggestedTechnician, open])
  
  const availableTechnicians = useMemo(() => {
    return getAvailableTechnicians(customer.requestedLevel, new Date(), selectedDuration)
  }, [getAvailableTechnicians, customer.requestedLevel, selectedDuration])
  
  const handleConfirm = () => {
    if (!selectedTechnicianId) {
      alert('请选择技师')
      return
    }
    
    const booking = confirmAssignment(customer.id, selectedTechnicianId, selectedDuration)
    if (booking) {
      onClose()
    } else {
      alert('派钟失败，技师该时段可能已被占用')
    }
  }
  
  const handlePassClick = () => {
    handlePass(customer.id)
    onClose()
  }
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary-500" />
            分配技师
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="bg-primary-50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                {customer.queueNumber.toString().padStart(3, '0')}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{customer.name}</div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  取号时间: {customer.queueTime.toLocaleTimeString()}
                </div>
              </div>
              {customer.requestedLevel && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">要求等级</div>
                  <div className="font-medium text-primary-600">
                    {getLevelName(customer.requestedLevel)}
                  </div>
                </div>
              )}
              {customer.requestedTechnicianId && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">指定技师</div>
                  <div className="font-medium text-primary-600">
                    {technicians.find(t => t.id === customer.requestedTechnicianId)?.name || '未知'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">服务时长</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(dur => (
                <button
                  key={dur}
                  onClick={() => setSelectedDuration(dur)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedDuration === dur
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {formatDuration(dur)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">选择技师</h4>
            {availableTechnicians.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                当前没有符合要求的空闲技师（{formatDuration(selectedDuration)}）
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-auto">
                {availableTechnicians.map(tech => (
                  <div
                    key={tech.id}
                    onClick={() => setSelectedTechnicianId(tech.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTechnicianId === tech.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-600">
                        {tech.number}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{tech.name}</div>
                        <div className="text-sm text-gray-500">
                          {getLevelName(tech.level)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">单价</div>
                        <div className="font-semibold text-primary-600">
                          ¥{TECHNICIAN_LEVEL_CONFIG[tech.level].pricePerHour}
                        </div>
                      </div>
                    </div>
                    {tech.id === suggestedTechnician?.id && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-secondary-600 bg-secondary-50 px-2 py-1 rounded">
                        <Star className="w-3 h-3" />
                        推荐
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handlePassClick}
              className="flex-1 px-4 py-2 border border-yellow-300 text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              过号重排
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTechnicianId || availableTechnicians.length === 0}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认派钟
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
