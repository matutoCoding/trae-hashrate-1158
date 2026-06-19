import { useStore } from '@/store/useStore'
import { TECHNICIAN_LEVEL_CONFIG } from '@/types'
import { getLevelName, getTechnicianStatusText, getTechnicianStatusColor, formatTime } from '@/utils/format'
import { Users, Clock, UserCog, Coffee, LogOut } from 'lucide-react'

export default function TechnicianPanel() {
  const { technicians, bookings, customers, updateTechnician, startService, completeService } = useStore()
  
  const activeBookings = bookings.filter(
    b => b.status === 'confirmed' || b.status === 'in_progress'
  )
  
  const getTechnicianBooking = (techId: string) => {
    return activeBookings.find(b => b.technicianId === techId)
  }
  
  const getCustomer = (customerId: string) => {
    return customers.find(c => c.id === customerId)
  }
  
  const toggleTechnicianStatus = (techId: string, currentStatus: string) => {
    let newStatus: 'idle' | 'break' | 'off' = 'idle'
    if (currentStatus === 'idle') newStatus = 'break'
    else if (currentStatus === 'break') newStatus = 'off'
    else newStatus = 'idle'
    
    updateTechnician(techId, { status: newStatus })
  }
  
  const idleCount = technicians.filter(t => t.status === 'idle').length
  const busyCount = technicians.filter(t => t.status === 'busy').length
  const breakCount = technicians.filter(t => t.status === 'break').length
  const offCount = technicians.filter(t => t.status === 'off').length
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-secondary-500" />
          技师状态
        </h2>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">空闲 {idleCount}</span>
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">服务中 {busyCount}</span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">休息 {breakCount}</span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">下班 {offCount}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {technicians.map(tech => {
            const booking = getTechnicianBooking(tech.id)
            const customer = booking ? getCustomer(booking.customerId) : null
            
            return (
              <div
                key={tech.id}
                className={`border rounded-lg p-3 transition-all ${
                  tech.status === 'busy' ? 'border-red-200 bg-red-50' :
                  tech.status === 'idle' ? 'border-green-200 bg-green-50' :
                  tech.status === 'break' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                    tech.status === 'busy' ? 'bg-red-500 text-white' :
                    tech.status === 'idle' ? 'bg-green-500 text-white' :
                    tech.status === 'break' ? 'bg-yellow-500 text-white' :
                    'bg-gray-400 text-white'
                  }`}>
                    {tech.number}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{tech.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTechnicianStatusColor(tech.status)}`}>
                        {getTechnicianStatusText(tech.status)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <UserCog className="w-3 h-3" />
                      {getLevelName(tech.level)}
                      <span className="text-primary-600 ml-1">
                        ¥{TECHNICIAN_LEVEL_CONFIG[tech.level].pricePerHour}/小时
                      </span>
                    </div>
                    
                    {booking && customer && (
                      <div className="mt-2 p-2 bg-white rounded text-sm">
                        <div className="font-medium text-gray-700">
                          服务客人: {customer.name} ({customer.queueNumber.toString().padStart(3, '0')}号)
                        </div>
                        <div className="text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          开始: {formatTime(booking.startTime)}
                          <span className="mx-1">~</span>
                          结束: {formatTime(booking.endTime)}
                        </div>
                        <div className="mt-2 flex gap-2">
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => startService(booking.id)}
                              className="flex-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                            >
                              开始服务
                            </button>
                          )}
                          {booking.status === 'in_progress' && (
                            <button
                              onClick={() => completeService(booking.id)}
                              className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              完成服务
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {tech.status !== 'busy' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => toggleTechnicianStatus(tech.id, tech.status)}
                      className={`flex-1 px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                        tech.status === 'idle' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                        tech.status === 'break' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' :
                        'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {tech.status === 'idle' ? <Coffee className="w-3 h-3" /> :
                       tech.status === 'break' ? <LogOut className="w-3 h-3" /> :
                       <UserCog className="w-3 h-3" />}
                      {tech.status === 'idle' ? '休息' :
                       tech.status === 'break' ? '下班' : '上班'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
