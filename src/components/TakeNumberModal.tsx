import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { TECHNICIAN_LEVEL_CONFIG, type TechnicianLevel } from '@/types'
import { X, UserPlus } from 'lucide-react'

interface TakeNumberModalProps {
  open: boolean
  onClose: () => void
}

export default function TakeNumberModal({ open, onClose }: TakeNumberModalProps) {
  const { takeQueueNumber, technicians } = useStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [requestedLevel, setRequestedLevel] = useState<TechnicianLevel | ''>('')
  const [requestedTechnicianId, setRequestedTechnicianId] = useState('')
  
  const availableTechnicians = technicians.filter(t => t.status === 'idle')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('请输入客人姓名')
      return
    }
    
    takeQueueNumber({
      name: name.trim(),
      phone: phone.trim() || undefined,
      requestedLevel: requestedLevel || undefined,
      requestedTechnicianId: requestedTechnicianId || undefined,
    })
    
    setName('')
    setPhone('')
    setRequestedLevel('')
    setRequestedTechnicianId('')
    onClose()
  }
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-500" />
            客人取号
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              客人姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="请输入客人姓名"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              联系电话
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="请输入联系电话（选填）"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              要求技师等级
            </label>
            <select
              value={requestedLevel}
              onChange={e => {
                setRequestedLevel(e.target.value as TechnicianLevel | '')
                setRequestedTechnicianId('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">不指定（随机分配）</option>
              {Object.entries(TECHNICIAN_LEVEL_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name} - ¥{config.pricePerHour}/小时
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              指定技师
            </label>
            <select
              value={requestedTechnicianId}
              onChange={e => setRequestedTechnicianId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">不指定</option>
              {availableTechnicians
                .filter(t => !requestedLevel || t.level === requestedLevel)
                .map(tech => (
                  <option key={tech.id} value={tech.id}>
                    {tech.number}号 {tech.name} - {TECHNICIAN_LEVEL_CONFIG[tech.level].name}
                  </option>
                ))}
            </select>
            {requestedTechnicianId && availableTechnicians.length === 0 && (
              <p className="text-sm text-red-500 mt-1">当前没有空闲技师</p>
            )}
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              取号
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
