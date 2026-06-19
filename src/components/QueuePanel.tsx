import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { formatTime, waitTime, getCustomerStatusText, getCustomerStatusColor } from '@/utils/format'
import { UserPlus, Users, Clock, AlertTriangle, CheckCircle, XCircle, SkipForward, Phone } from 'lucide-react'
import TakeNumberModal from './TakeNumberModal'
import AssignTechnicianModal from './AssignTechnicianModal'
import type { Customer, Technician } from '@/types'

export default function QueuePanel() {
  const [showTakeModal, setShowTakeModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [calledCustomer, setCalledCustomer] = useState<Customer | null>(null)
  const [suggestedTechnician, setSuggestedTechnician] = useState<Technician | undefined>(undefined)
  
  const { customers, callNextCustomer, handlePass, cancelCustomer, maxPassCount } = useStore()
  
  const waitingCustomers = customers
    .filter(c => c.status === 'waiting')
    .sort((a, b) => a.queueTime.getTime() - b.queueTime.getTime())
  
  const calledCustomers = customers.filter(c => c.status === 'called')
  const servingCustomers = customers.filter(c => c.status === 'serving')
  
  const handleCallNext = () => {
    const result = callNextCustomer()
    if (result) {
      setCalledCustomer(result.customer)
      setSuggestedTechnician(result.technician)
      setShowAssignModal(true)
    } else {
      alert('当前没有排队的客人')
    }
  }
  
  const handleAssignClose = () => {
    setShowAssignModal(false)
    setCalledCustomer(null)
    setSuggestedTechnician(undefined)
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-primary-500" />
          排队派钟
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTakeModal(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            取号
          </button>
          <button
            onClick={handleCallNext}
            disabled={waitingCustomers.length === 0}
            className="px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-4 h-4" />
            叫号
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{waitingCustomers.length}</div>
          <div className="text-sm text-blue-600">等待中</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{calledCustomers.length}</div>
          <div className="text-sm text-orange-600">已叫号</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{servingCustomers.length}</div>
          <div className="text-sm text-green-600">服务中</div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">号码</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">姓名</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">状态</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">取号时间</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">等待时长</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">过号次数</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...waitingCustomers, ...calledCustomers, ...servingCustomers].map(customer => (
              <tr key={customer.id} className="hover:bg-gray-50">
                <td className="px-3 py-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-full font-bold">
                    {customer.queueNumber.toString().padStart(3, '0')}
                  </span>
                </td>
                <td className="px-3 py-3 font-medium">{customer.name}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCustomerStatusColor(customer.status)}`}>
                    {getCustomerStatusText(customer.status)}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600">{formatTime(customer.queueTime)}</td>
                <td className="px-3 py-3 text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {waitTime(customer.queueTime)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: maxPassCount }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full ${
                          i < customer.passCount ? 'bg-red-500' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                    {customer.passCount >= maxPassCount && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {customer.status === 'called' && (
                      <>
                        <button
                          onClick={() => handlePass(customer.id)}
                          className="p-1 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title="过号"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCalledCustomer(customer)
                            setShowAssignModal(true)
                          }}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="派钟"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {customer.status === 'waiting' && (
                      <button
                        onClick={() => cancelCustomer(customer.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="取消排队"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {waitingCustomers.length === 0 && calledCustomers.length === 0 && servingCustomers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  暂无排队客人
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <TakeNumberModal
        open={showTakeModal}
        onClose={() => setShowTakeModal(false)}
      />
      
      {calledCustomer && (
        <AssignTechnicianModal
          open={showAssignModal}
          onClose={handleAssignClose}
          customer={calledCustomer}
          suggestedTechnician={suggestedTechnician}
        />
      )}
    </div>
  )
}
