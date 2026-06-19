import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { TECHNICIAN_LEVEL_CONFIG, type Technician, type GapInfo } from '@/types'
import { getLevelName, getTechnicianStatusColor, formatTime, formatDuration } from '@/utils/format'
import { Users, Clock, UserCog, Coffee, LogOut, Pause, Play, CalendarPlus } from 'lucide-react'
import GapBookingModal from './GapBookingModal'

export default function TechnicianPanel() {
  const { technicians, bookings, customers, updateTechnician, startService, completeService, getTechnicianCurrentStatus, getTechnicianActiveSegment, getBookingActiveDuration, getTechnicianGaps } = useStore()
  const [gapModalOpen, setGapModalOpen] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null)
  const [selectedGap, setSelectedGap] = useState<GapInfo | null>(null)

  const activeBookings = bookings.filter(
    b => b.status === 'confirmed' || b.status === 'in_progress'
  )

  const getTechnicianBookings = (techId: string) => {
    return activeBookings.filter(b => b.technicianId === techId)
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

  const handleGapClick = (tech: Technician, gap: GapInfo) => {
    setSelectedTechnician(tech)
    setSelectedGap(gap)
    setGapModalOpen(true)
  }

  const idleCount = technicians.filter(t => {
    const status = getTechnicianCurrentStatus(t.id)
    return status.status === 'idle'
  }).length

  const busyCount = technicians.filter(t => {
    const status = getTechnicianCurrentStatus(t.id)
    return status.status === 'in_service' && !status.isGap
  }).length

  const gapCount = technicians.filter(t => {
    const status = getTechnicianCurrentStatus(t.id)
    return status.status === 'in_service' && status.isGap
  }).length

  const breakCount = technicians.filter(t => t.status === 'break').length
  const offCount = technicians.filter(t => t.status === 'off').length

  const renderTimeline = (tech: Technician) => {
    const techBookings = getTechnicianBookings(tech.id)
    if (techBookings.length === 0) return null

    const activeSegment = getTechnicianActiveSegment(tech.id)
    const now = new Date()
    const gaps = getTechnicianGaps(tech.id)

    const allSegments = techBookings.flatMap(b => b.segments)

    const earliestStart = Math.min(...allSegments.map(s => s.startTime.getTime()))
    const latestEnd = Math.max(...allSegments.map(s => s.endTime.getTime()))
    const totalMs = latestEnd - earliestStart
    if (totalMs <= 0) return null

    const nowPosition = Math.max(0, Math.min(100, ((now.getTime() - earliestStart) / totalMs) * 100))

    return (
      <div className="mt-2">
        <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
          {techBookings.map(booking =>
            booking.segments.map((seg) => {
              const left = ((seg.startTime.getTime() - earliestStart) / totalMs) * 100
              const width = ((seg.duration * 60 * 1000) / totalMs) * 100
              const isActive = activeSegment?.segment.id === seg.id

              if (seg.status === 'cancelled') {
                const gapInfo = gaps.find(
                  g => g.startTime.getTime() === seg.startTime.getTime() && g.endTime.getTime() === seg.endTime.getTime()
                )
                const gap = gapInfo || { startTime: seg.startTime, endTime: seg.endTime, duration: seg.duration }
                return (
                  <div
                    key={seg.id}
                    className="absolute top-0 h-full bg-red-200 cursor-pointer hover:bg-red-300 transition-colors flex items-center justify-center"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`空挡: ${formatTime(seg.startTime)} - ${formatTime(seg.endTime)} (${formatDuration(seg.duration)}) - 点击预约`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleGapClick(tech, gap)
                    }}
                  >
                    <CalendarPlus className="w-3 h-3 text-red-600" />
                  </div>
                )
              }

              return (
                <div
                  key={seg.id}
                  className={`absolute top-0 h-full ${
                    isActive ? 'bg-secondary-500' : 'bg-secondary-300'
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${formatTime(seg.startTime)} - ${formatTime(seg.endTime)} (${formatDuration(seg.duration)}${isActive ? ' 进行中' : ''})`}
                />
              )
            })
          )}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-500 z-20"
            style={{ left: `${nowPosition}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(new Date(earliestStart))}</span>
          <span>{formatTime(new Date(latestEnd))}</span>
        </div>
      </div>
    )
  }

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
          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">空挡 {gapCount}</span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">休息 {breakCount}</span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">下班 {offCount}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {technicians.map(tech => {
            const currentStatus = getTechnicianCurrentStatus(tech.id)
            const techBookings = getTechnicianBookings(tech.id)
            const activeSegment = getTechnicianActiveSegment(tech.id)
            const customer = activeSegment ? getCustomer(activeSegment.booking.customerId) : null
            const gaps = getTechnicianGaps(tech.id)

            let statusBgColor = ''
            let statusText = ''

            if (currentStatus.status === 'in_service') {
              if (currentStatus.isGap) {
                statusBgColor = 'border-purple-200 bg-purple-50'
                statusText = '空挡中'
              } else {
                statusBgColor = 'border-red-200 bg-red-50'
                statusText = '服务中'
              }
            } else if (tech.status === 'idle') {
              statusBgColor = 'border-green-200 bg-green-50'
              statusText = '空闲'
            } else if (tech.status === 'break') {
              statusBgColor = 'border-yellow-200 bg-yellow-50'
              statusText = '休息'
            } else {
              statusBgColor = 'border-gray-200 bg-gray-50'
              statusText = '下班'
            }

            const avatarBgColor =
              currentStatus.status === 'in_service' && !currentStatus.isGap ? 'bg-red-500' :
              currentStatus.status === 'in_service' && currentStatus.isGap ? 'bg-purple-500' :
              tech.status === 'idle' ? 'bg-green-500' :
              tech.status === 'break' ? 'bg-yellow-500' : 'bg-gray-400'

            const isInGap = currentStatus.status === 'in_service' && currentStatus.isGap

            return (
              <div
                key={tech.id}
                className={`border rounded-lg p-3 transition-all ${statusBgColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white ${avatarBgColor}`}>
                    {tech.number}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{tech.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTechnicianStatusColor(tech.status)}`}>
                        {statusText}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <UserCog className="w-3 h-3" />
                      {getLevelName(tech.level)}
                      <span className="text-primary-600 ml-1">
                        ¥{TECHNICIAN_LEVEL_CONFIG[tech.level].pricePerHour}/小时
                      </span>
                    </div>

                    {isInGap && currentStatus.gapPeriod && (
                      <div className="mt-2 p-2 bg-white rounded text-sm border border-purple-200">
                        <div className="font-medium text-purple-700 flex items-center gap-1">
                          <Pause className="w-4 h-4" />
                          当前空挡中
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          空挡: {formatTime(currentStatus.gapPeriod.startTime)} - {formatTime(currentStatus.gapPeriod.endTime)}
                        </div>
                        {currentStatus.nextService && (
                          <div className="text-gray-600 text-xs">
                            下段服务: {formatTime(currentStatus.nextService.startTime)} - {formatTime(currentStatus.nextService.endTime)}
                          </div>
                        )}
                        <div className="text-gray-500 text-xs">
                          客人: {currentStatus.customerName} ({currentStatus.customerQueueNumber.toString().padStart(3, '0')}号)
                        </div>
                        <button
                          onClick={() => handleGapClick(tech, {
                            startTime: currentStatus.gapPeriod!.startTime,
                            endTime: currentStatus.gapPeriod!.endTime,
                            duration: Math.floor((currentStatus.gapPeriod!.endTime.getTime() - currentStatus.gapPeriod!.startTime.getTime()) / (60 * 1000)),
                          })}
                          className="mt-2 w-full py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors flex items-center justify-center gap-1"
                        >
                          <CalendarPlus className="w-3 h-3" />
                          预约此空挡
                        </button>
                      </div>
                    )}

                    {!isInGap && activeSegment && customer && (
                      <div className="mt-2 p-2 bg-white rounded text-sm">
                        <div className="font-medium text-gray-700 flex items-center gap-1">
                          <Play className="w-4 h-4 text-secondary-500" />
                          服务客人: {customer.name} ({customer.queueNumber.toString().padStart(3, '0')}号)
                        </div>
                        <div className="text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          本段: {formatTime(activeSegment.segment.startTime)}
                          <span className="mx-1">~</span>
                          {formatTime(activeSegment.segment.endTime)}
                        </div>
                      </div>
                    )}

                    {techBookings.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500 mb-1">活跃钟单 ({techBookings.length})</div>
                        {techBookings.map(booking => {
                          const bookingCustomer = getCustomer(booking.customerId)
                          const activeDur = getBookingActiveDuration(booking)
                          return (
                            <div key={booking.id} className="p-2 bg-white rounded text-sm mb-1 last:mb-0">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-700 text-xs font-medium">
                                  {bookingCustomer?.name || '未知'} ({bookingCustomer?.queueNumber.toString().padStart(3, '0') || '---'}号)
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  booking.status === 'in_progress' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {booking.status === 'in_progress' ? '进行中' : '已确认'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {formatTime(booking.startTime)} ~ {formatTime(booking.endTime)}
                                {activeDur < booking.duration && (
                                  <span className="text-orange-600 ml-1">
                                    (有效{formatDuration(activeDur)})
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-0.5 h-1.5 rounded overflow-hidden mt-1">
                                {booking.segments.map(seg => (
                                  <div
                                    key={seg.id}
                                    className={`h-full ${seg.status === 'cancelled' ? 'bg-red-300' : 'bg-secondary-400'}`}
                                    style={{ width: `${(seg.duration / booking.duration) * 100}%` }}
                                  />
                                ))}
                              </div>
                              <div className="mt-1 flex gap-1">
                                {booking.status === 'confirmed' && (
                                  <button
                                    onClick={() => startService(booking.id)}
                                    className="flex-1 px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                  >
                                    开始服务
                                  </button>
                                )}
                                {booking.status === 'in_progress' && (
                                  <button
                                    onClick={() => completeService(booking.id)}
                                    className="flex-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  >
                                    完成服务
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {renderTimeline(tech)}
                        {gaps.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span>可预约空挡: </span>
                            {gaps.slice(0, 3).map((gap, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleGapClick(tech, gap)}
                                className="inline-block ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                              >
                                {formatTime(gap.startTime)} ({formatDuration(gap.duration)})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {tech.status !== 'busy' && !isInGap && currentStatus.status !== 'in_service' && (
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

      <GapBookingModal
        open={gapModalOpen}
        onClose={() => setGapModalOpen(false)}
        technician={selectedTechnician}
        gap={selectedGap}
      />
    </div>
  )
}
