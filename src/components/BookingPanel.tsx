import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { formatTime, formatDuration, getBookingStatusText, getBookingStatusColor, getLevelName } from '@/utils/format'
import { CalendarClock, Merge, Split, XCircle, CheckCircle, Link, Link2Off } from 'lucide-react'

export default function BookingPanel() {
  const { bookings, customers, technicians, mergeBookings, splitBooking, cancelBooking, completeService } = useStore()
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitBookingId, setSplitBookingId] = useState<string | null>(null)
  const [splitMinutes, setSplitMinutes] = useState(30)
  
  const activeBookings = bookings
    .filter(b => b.status !== 'cancelled' && b.status !== 'completed')
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  
  const getCustomer = (customerId: string) => customers.find(c => c.id === customerId)
  const getTechnician = (technicianId: string) => technicians.find(t => t.id === technicianId)
  
  const toggleSelectBooking = (bookingId: string) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    )
  }
  
  const handleMerge = () => {
    if (selectedBookings.length < 2) {
      alert('请至少选择2个钟单进行合并')
      return
    }
    
    const booking1 = bookings.find(b => b.id === selectedBookings[0])
    if (!booking1) return
    
    const sameCustomer = selectedBookings.every(id => {
      const b = bookings.find(booking => booking.id === id)
      return b && b.customerId === booking1.customerId && b.technicianId === booking1.technicianId
    })
    
    if (!sameCustomer) {
      alert('只能合并同一客人和同一技师的连续钟单')
      return
    }
    
    const result = mergeBookings(selectedBookings)
    if (result) {
      alert('合并成功')
      setSelectedBookings([])
    } else {
      alert('合并失败，请确保钟单时间连续')
    }
  }
  
  const handleSplit = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking || !booking.isMerged) {
      alert('只能拆分已合并的钟单')
      return
    }
    setSplitBookingId(bookingId)
    setSplitMinutes(Math.floor(booking.duration / 2))
    setShowSplitModal(true)
  }
  
  const confirmSplit = () => {
    if (!splitBookingId) return
    
    const booking = bookings.find(b => b.id === splitBookingId)
    if (!booking) return
    
    const splitTime = new Date(booking.startTime.getTime() + splitMinutes * 60 * 1000)
    const result = splitBooking(splitBookingId, splitTime)
    
    if (result) {
      alert('拆分成功')
      setShowSplitModal(false)
      setSplitBookingId(null)
    } else {
      alert('拆分失败')
    }
  }
  
  const handleCancel = (bookingId: string) => {
    if (confirm('确定要取消这个钟单吗？')) {
      cancelBooking(bookingId)
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-purple-500" />
          钟单管理
        </h2>
        <div className="flex gap-2">
          {selectedBookings.length > 0 && (
            <>
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                已选 {selectedBookings.length} 个
              </span>
              <button
                onClick={handleMerge}
                disabled={selectedBookings.length < 2}
                className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Merge className="w-4 h-4" />
                合并
              </button>
              <button
                onClick={() => setSelectedBookings([])}
                className="px-3 py-1 bg-gray-200 text-gray-600 text-sm rounded hover:bg-gray-300 transition-colors"
              >
                取消选择
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-600 w-8">
                {selectedBookings.length > 0 && <span className="text-xs">选</span>}
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">客人</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">技师</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">时段</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">时长</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">状态</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">合并</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeBookings.map(booking => {
              const customer = getCustomer(booking.customerId)
              const technician = getTechnician(booking.technicianId)
              const isSelected = selectedBookings.includes(booking.id)
              
              return (
                <tr key={booking.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-purple-50' : ''}`}>
                  <td className="px-2 py-2">
                    {selectedBookings.length > 0 && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectBooking(booking.id)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">
                      {customer?.name || '未知'} ({customer?.queueNumber.toString().padStart(3, '0') || '---'})
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">{technician?.number}号 {technician?.name}</div>
                    <div className="text-xs text-gray-500">{technician ? getLevelName(technician.level) : ''}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    <div>{formatTime(booking.startTime)}</div>
                    <div className="text-xs">{formatTime(booking.endTime)}</div>
                  </td>
                  <td className="px-2 py-2 text-gray-600">
                    {formatDuration(booking.duration)}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBookingStatusColor(booking.status)}`}>
                      {getBookingStatusText(booking.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {booking.isMerged ? (
                      <span className="flex items-center gap-1 text-xs text-purple-600">
                        <Link className="w-3 h-3" />
                        已合并
                      </span>
                    ) : booking.splitFrom ? (
                      <span className="flex items-center gap-1 text-xs text-orange-600">
                        <Link2Off className="w-3 h-3" />
                        拆分来
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {booking.isMerged && (
                        <button
                          onClick={() => handleSplit(booking.id)}
                          className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                          title="拆分"
                        >
                          <Split className="w-4 h-4" />
                        </button>
                      )}
                      {booking.status === 'in_progress' && (
                        <button
                          onClick={() => completeService(booking.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="完成"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {(booking.status === 'confirmed' || booking.status === 'pending') && (
                        <button
                          onClick={() => handleCancel(booking.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="取消"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {activeBookings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  暂无进行中的钟单
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {showSplitModal && splitBookingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Split className="w-5 h-5 text-purple-500" />
              拆分钟单
            </h3>
            
            {(() => {
              const booking = bookings.find(b => b.id === splitBookingId)
              if (!booking) return null
              
              return (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      当前钟单时段: {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                    <p className="text-sm text-gray-600">
                      总时长: {formatDuration(booking.duration)}
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      拆分点（开始后多少分钟）
                    </label>
                    <input
                      type="range"
                      min={15}
                      max={booking.duration - 15}
                      step={15}
                      value={splitMinutes}
                      onChange={e => setSplitMinutes(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatDuration(15)}</span>
                      <span className="font-medium text-purple-600">{formatDuration(splitMinutes)}</span>
                      <span>{formatDuration(booking.duration - 15)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-gray-500 text-xs">拆分后</div>
                      <div className="font-medium">
                        {formatTime(booking.startTime)} - {formatTime(new Date(booking.startTime.getTime() + splitMinutes * 60 * 1000))}
                      </div>
                      <div className="text-primary-600">{formatDuration(splitMinutes)}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded">
                      <div className="text-gray-500 text-xs">拆分后</div>
                      <div className="font-medium">
                        {formatTime(new Date(booking.startTime.getTime() + splitMinutes * 60 * 1000))} - {formatTime(booking.endTime)}
                      </div>
                      <div className="text-primary-600">{formatDuration(booking.duration - splitMinutes)}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSplitModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmSplit}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      确认拆分
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
