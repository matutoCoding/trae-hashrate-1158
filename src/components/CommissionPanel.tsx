import { useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { formatMoney, formatDateTime, formatDuration, getLevelName } from '@/utils/format'
import { Wallet, TrendingUp, Calendar, Download, DollarSign, Percent, Clock } from 'lucide-react'

export default function CommissionPanel() {
  const { commissions, technicians, getTotalCommissions } = useStore()
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('today')
  
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    let start = new Date()
    let end = new Date()
    
    switch (dateRange) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        break
      case 'all':
      default:
        start = new Date(0)
        break
    }
    
    return { startDate: start, endDate: end }
  }, [dateRange])
  
  const totalStats = useMemo(() => {
    const filtered = commissions.filter(c => {
      if (c.startTime < startDate) return false
      if (c.startTime > endDate) return false
      return true
    })
    
    const totalRevenue = filtered.reduce((sum, c) => sum + c.effectiveAmount, 0)
    const totalCommission = filtered.reduce((sum, c) => sum + c.commissionAmount, 0)
    const totalServiceTime = filtered.reduce((sum, c) => sum + c.effectiveDuration, 0)
    
    return {
      count: filtered.length,
      totalRevenue,
      totalCommission,
      totalServiceTime,
      profit: totalRevenue - totalCommission,
    }
  }, [commissions, startDate, endDate])
  
  const technicianStats = useMemo(() => {
    return getTotalCommissions(startDate, endDate).map(stat => {
      const tech = technicians.find(t => t.id === stat.technicianId)
      return {
        ...stat,
        technician: tech,
      }
    }).sort((a, b) => b.total - a.total)
  }, [getTotalCommissions, startDate, endDate, technicians])
  
  const getTechnician = (id: string) => technicians.find(t => t.id === id)
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-green-500" />
          提成分账
        </h2>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {[
              { key: 'today', label: '今日' },
              { key: 'week', label: '本周' },
              { key: 'month', label: '本月' },
              { key: 'all', label: '全部' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setDateRange(item.key as typeof dateRange)}
                className={`px-3 py-1 text-sm transition-colors ${
                  dateRange === item.key
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 transition-colors flex items-center gap-1">
            <Download className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
            <Calendar className="w-4 h-4" />
            服务单数
          </div>
          <div className="text-2xl font-bold text-blue-700">{totalStats.count}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            总营收
          </div>
          <div className="text-2xl font-bold text-green-700">{formatMoney(totalStats.totalRevenue)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
            <Percent className="w-4 h-4" />
            技师提成
          </div>
          <div className="text-2xl font-bold text-orange-700">{formatMoney(totalStats.totalCommission)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            服务时长
          </div>
          <div className="text-2xl font-bold text-purple-700">{formatDuration(totalStats.totalServiceTime)}</div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            技师提成排行
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {technicianStats.slice(0, 6).map((stat, index) => {
              return (
                <div key={stat.technicianId} className="border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' :
                      'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {stat.technician?.number}号 {stat.technician?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {stat.technician ? getLevelName(stat.technician.level) : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary-600">{formatMoney(stat.total)}</div>
                      <div className="text-xs text-gray-500">{stat.records.length}单</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {technicianStats.length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-400">
                暂无提成数据
              </div>
            )}
          </div>
        </div>
        
        <h3 className="font-semibold text-gray-700 mb-2">提成明细</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">时间</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">技师</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">等级</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">时长</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">消费金额</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">提成比例</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">提成金额</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commissions
              .filter(c => c.startTime >= startDate && c.startTime <= endDate)
              .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
              .map(commission => {
                const tech = getTechnician(commission.technicianId)
                return (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">
                      {formatDateTime(commission.startTime)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">
                        {tech?.number}号 {tech?.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {getLevelName(commission.technicianLevel)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {formatDuration(commission.effectiveDuration)}
                      {commission.duration !== commission.effectiveDuration && (
                        <span className="text-xs text-red-500 ml-1">
                          (原{formatDuration(commission.duration)})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 font-medium">
                      {formatMoney(commission.effectiveAmount)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {(commission.commissionRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-green-600 font-semibold">
                      {formatMoney(commission.commissionAmount)}
                    </td>
                  </tr>
                )
              })}
            {commissions.filter(c => c.startTime >= startDate && c.startTime <= endDate).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  暂无提成记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
