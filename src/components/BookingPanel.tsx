import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { formatTime, formatDuration, getBookingStatusText, getBookingStatusColor, getLevelName } from '@/utils/format'
import { CalendarClock, Merge, Split, XCircle, CheckCircle, Link, Link2Off, Plus, Clock as ClockIcon, Scissors } from 'lucide-react'
import type { Booking } from '@/types'

export default function BookingPanel() {
  const { bookings, customers, technicians, mergeBookings, splitBooking, cancelBooking, cancelBookingSegment, extendBooking, completeService, getBookingActiveDuration } = useStore()
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitBookingId, setSplitBookingId] = useState<string | null>(null)
  const [splitMinutes, setSplitMinutes] = useState(30)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [extendBookingId, setExtendBookingId] = useState<string | null>(null)
  const [extendMinutes, setExtendMinutes] = useState(60)
  const [showPartialCancelModal, setShowPartialCancelModal] = useState(false)
  const [partialCancelBookingId, setPartialCancelBookingId] = useState<string | null>(null)
  const [cancelStartMinutes, setCancelStartMinutes] = useState(30)
  const [cancelEndMinutes, setCancelEndMinutes] = useState(60)

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
    if (!booking) {
      alert('钟单不存在')
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

  const handleExtend = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      alert('该钟单无法续钟')
      return
    }
    setExtendBookingId(bookingId)
    setExtendMinutes(60)
    setShowExtendModal(true)
  }

  const confirmExtend = () => {
    if (!extendBookingId) return
    const result = extendBooking(extendBookingId, extendMinutes)
    if (result) {
      alert(`续钟成功，延长 ${formatDuration(extendMinutes)}`)
      setShowExtendModal(false)
      setExtendBookingId(null)
    } else {
      alert('续钟失败')
    }
  }

  const handlePartialCancel = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    if (!booking) return
    setPartialCancelBookingId(bookingId)
    setCancelStartMinutes(Math.floor(booking.duration / 3))
    setCancelEndMinutes(Math.floor(booking.duration * 2 / 3))
    setShowPartialCancelModal(true)
  }

  const confirmPartialCancel = () => {
    if (!partialCancelBookingId) return
    const booking = bookings.find(b => b.id === partialCancelBookingId)
    if (!booking) return

    if (cancelStartMinutes >= cancelEndMinutes) {
      alert('取消开始时间必须早于结束时间')
      return
    }
    if (cancelStartMinutes < 0 || cancelEndMinutes > booking.duration) {
      alert('取消时间超出钟单范围')
      return
    }

    const cancelStart = new Date(booking.startTime.getTime() + cancelStartMinutes * 60 * 1000)
    const cancelEnd = new Date(booking.startTime.getTime() + cancelEndMinutes * 60 * 1000)

    const result = cancelBookingSegment(partialCancelBookingId, cancelStart, cancelEnd)
    if (result) {
      alert(`已取消 ${formatDuration(cancelEndMinutes - cancelStartMinutes)} 的服务时段`)
      setShowPartialCancelModal(false)
      setPartialCancelBookingId(null)
    } else if (result === null) {
      alert('全部时段已取消，钟单已取消')
      setShowPartialCancelModal(false)
      setPartialCancelBookingId(null)
    } else {
      alert('部分取消失败')
    }
  }

  const handleCancel = (bookingId: string) => {
    if (confirm('确定要取消整个钟单吗？')) {
      cancelBooking(bookingId)
    }
  }

  const renderTimeline = (booking: Booking) => {
    const activeDuration = getBookingActiveDuration(booking)
    return (
      <div className="mt-1">
        <div className="flex gap-0.5 h-2 rounded overflow-hidden">
          {booking.segments.map(seg => (
            <div
              key={seg.id}
              className={`h-full ${seg.status === 'cancelled' ? 'bg-red-300' : 'bg-secondary-400'}`}
              style={{ width: `${(seg.duration / booking.duration) * 100}%` }}
              title={`${formatTime(seg.startTime)} - ${formatTime(seg.endTime)} (${formatDuration(seg.duration)}${seg.status === 'cancelled' ? ' 已取消' : ''})`}
            />
          ))}
        </div>
        {activeDuration < booking.duration && (
          <div className="text-xs text-red-500 mt-1">
            有效: {formatDuration(activeDuration)} / 原: {formatDuration(booking.duration)}
          </div>
        )}
      </div>
    )
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
              <th className="px-2 py-2 text-left font-medium text-gray-600">时长/时段</th>
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
                    <div className="font-medium">{formatDuration(booking.duration)}</div>
                    {renderTimeline(booking)}
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
                    <div className="flex items-center gap-0.5">
                      {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                        <button
                          onClick={() => handleExtend(booking.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="续钟"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePartialCancel(booking.id)}
                        className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                        title="部分取消"
                      >
                        <Scissors className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSplit(booking.id)}
                        className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="拆分"
                      >
                        <Split className="w-4 h-4" />
                      </button>
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
                          title="取消全部"
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

      {showExtendModal && extendBookingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              续钟
            </h3>

            {(() => {
              const booking = bookings.find(b => b.id === extendBookingId)
              if (!booking) return null
              const technician = getTechnician(booking.technicianId)
              const activeDuration = getBookingActiveDuration(booking)

              return (
                <>
                  <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">客人:</span> {getCustomer(booking.customerId)?.name}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">技师:</span> {technician?.number}号 {technician?.name}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">当前结束时间:</span> {formatTime(booking.endTime)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">有效时长:</span> {formatDuration(activeDuration)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      续钟时长
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[30, 60, 90, 120].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setExtendMinutes(mins)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            extendMinutes === mins
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {formatDuration(mins)}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={240}
                      step={15}
                      value={extendMinutes}
                      onChange={e => setExtendMinutes(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium text-blue-600 mt-1">
                      {formatDuration(extendMinutes)}
                    </div>
                  </div>

                  <div className="mb-4 bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <ClockIcon className="w-4 h-4 text-green-600" />
                      延长后结束时间:
                      <span className="font-semibold text-green-700">
                        {formatTime(new Date(booking.endTime.getTime() + extendMinutes * 60 * 1000))}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      总时长将变为: {formatDuration(booking.duration + extendMinutes)}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowExtendModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmExtend}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      确认续钟
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {showPartialCancelModal && partialCancelBookingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-orange-500" />
              部分取消服务时段
            </h3>

            {(() => {
              const booking = bookings.find(b => b.id === partialCancelBookingId)
              if (!booking) return null

              if (cancelStartMinutes >= cancelEndMinutes) {
                setCancelEndMinutes(Math.min(cancelStartMinutes + 15, booking.duration))
              }

              return (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">
                      钟单时段: {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </p>
                    <p className="text-sm text-gray-600">
                      总时长: {formatDuration(booking.duration)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden mb-2">
                      <div
                        className="absolute top-0 h-full bg-orange-200 border-x-2 border-orange-500"
                        style={{
                          left: `${(cancelStartMinutes / booking.duration) * 100}%`,
                          width: `${((cancelEndMinutes - cancelStartMinutes) / booking.duration) * 100}%`,
                        }}
                      />
                      {booking.segments.filter(s => s.status === 'cancelled').map(seg => (
                        <div
                          key={seg.id}
                          className="absolute top-0 h-full bg-red-300 opacity-50"
                          style={{
                            left: `${((seg.startTime.getTime() - booking.startTime.getTime()) / (booking.duration * 60 * 1000)) * 100}%`,
                            width: `${(seg.duration / booking.duration) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatTime(booking.startTime)}</span>
                      <span>{formatTime(booking.endTime)}</span>
                    </div>
                  </div>

                  <div className="mb-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        取消开始时间: {formatTime(new Date(booking.startTime.getTime() + cancelStartMinutes * 60 * 1000))}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={booking.duration - 15}
                        step={15}
                        value={cancelStartMinutes}
                        onChange={e => {
                          const val = Number(e.target.value)
                          setCancelStartMinutes(val)
                          if (val >= cancelEndMinutes) {
                            setCancelEndMinutes(Math.min(val + 15, booking.duration))
                          }
                        }}
                        className="w-full"
                      />
                      <div className="text-center text-xs text-gray-500">
                        {formatDuration(cancelStartMinutes)} 后开始
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        取消结束时间: {formatTime(new Date(booking.startTime.getTime() + cancelEndMinutes * 60 * 1000))}
                      </label>
                      <input
                        type="range"
                        min={15}
                        max={booking.duration}
                        step={15}
                        value={cancelEndMinutes}
                        onChange={e => {
                          const val = Number(e.target.value)
                          setCancelEndMinutes(val)
                          if (val <= cancelStartMinutes) {
                            setCancelStartMinutes(Math.max(val - 15, 0))
                          }
                        }}
                        className="w-full"
                      />
                      <div className="text-center text-xs text-gray-500">
                        {formatDuration(cancelEndMinutes)} 后结束
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-500">前段保留</div>
                      <div className="font-medium text-blue-700">
                        {formatDuration(cancelStartMinutes)}
                      </div>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-500">本次取消</div>
                      <div className="font-medium text-red-700">
                        {formatDuration(cancelEndMinutes - cancelStartMinutes)}
                      </div>
                    </div>
                    <div className="bg-green-50 p-2 rounded text-center">
                      <div className="text-xs text-gray-500">后段保留</div>
                      <div className="font-medium text-green-700">
                        {formatDuration(booking.duration - cancelEndMinutes)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ 确认取消后，中间时段将不会占用技师时间，提成也将按剩余有效时长计算。
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPartialCancelModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmPartialCancel}
                      className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      确认取消该时段
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
