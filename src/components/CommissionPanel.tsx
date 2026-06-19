import { useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { formatMoney, formatDateTime, formatDuration, getLevelName } from '@/utils/format'
import { Wallet, TrendingUp, Calendar, Download, DollarSign, Percent, Clock, Minus, CheckCircle2 } from 'lucide-react'

export default function CommissionPanel() {
  const { commissions, technicians, customers } = useStore()
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const filteredCommissions = useMemo(() => {
    let result = [...commissions]

    if (selectedTechnicianId) {
      result = result.filter(c => c.technicianId === selectedTechnicianId)
    }

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      result = result.filter(c => new Date(c.createdAt) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      result = result.filter(c => new Date(c.createdAt) <= end)
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [commissions, selectedTechnicianId, startDate, endDate])

  const totalRevenue = useMemo(() => {
    return filteredCommissions.reduce((sum, c) => sum + c.effectiveAmount, 0)
  }, [filteredCommissions])

  const totalCommission = useMemo(() => {
    return filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0)
  }, [filteredCommissions])

  const totalDuration = useMemo(() => {
    return filteredCommissions.reduce((sum, c) => sum + c.effectiveDuration, 0)
  }, [filteredCommissions])

  const totalOriginalDuration = useMemo(() => {
    return filteredCommissions.reduce((sum, c) => sum + c.duration, 0)
  }, [filteredCommissions])

  const totalCancelledDuration = useMemo(() => {
    return totalOriginalDuration - totalDuration
  }, [totalOriginalDuration, totalDuration])

  const ranking = useMemo(() => {
    const techMap = new Map<string, { total: number; records: typeof commissions; effectiveDuration: number; effectiveAmount: number; originalDuration: number }>()

    for (const record of filteredCommissions) {
      const existing = techMap.get(record.technicianId)
      if (existing) {
        existing.total += record.commissionAmount
        existing.records.push(record)
        existing.effectiveDuration += record.effectiveDuration
        existing.effectiveAmount += record.effectiveAmount
        existing.originalDuration += record.duration
      } else {
        techMap.set(record.technicianId, {
          total: record.commissionAmount,
          records: [record],
          effectiveDuration: record.effectiveDuration,
          effectiveAmount: record.effectiveAmount,
          originalDuration: record.duration,
        })
      }
    }

    return Array.from(techMap.entries())
      .map(([technicianId, data]) => {
        const technician = technicians.find(t => t.id === technicianId)
        return {
          technicianId,
          technician,
          total: data.total,
          recordCount: data.records.length,
          effectiveDuration: data.effectiveDuration,
          effectiveAmount: data.effectiveAmount,
          originalDuration: data.originalDuration,
          cancelledDuration: data.originalDuration - data.effectiveDuration,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [filteredCommissions, technicians])

  const handleExport = () => {
    const headers = [
      '提成日期',
      '技师姓名',
      '技师工号',
      '技师等级',
      '客人姓名',
      '客人号码',
      '原始时长(分钟)',
      '取消时长(分钟)',
      '有效时长(分钟)',
      '消费金额(元)',
      '提成比例',
      '提成金额(元)',
    ]

    const rows = filteredCommissions.map(record => {
      const tech = technicians.find(t => t.id === record.technicianId)
      const cust = customers.find(c => c.id === record.customerId)
      return [
        formatDateTime(new Date(record.createdAt)),
        tech?.name || '未知',
        tech?.number || '',
        tech ? getLevelName(tech.level) : '',
        cust?.name || '未知',
        cust?.queueNumber.toString().padStart(3, '0') || '',
        record.duration,
        record.duration - record.effectiveDuration,
        record.effectiveDuration,
        record.effectiveAmount.toFixed(2),
        `${(record.commissionRate * 100).toFixed(0)}%`,
        record.commissionAmount.toFixed(2),
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `提成分账_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getTechnician = (id: string) => technicians.find(t => t.id === id)
  const getCustomer = (id: string) => customers.find(c => c.id === id)

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-accent-500" />
          提成分账
        </h2>
        <button
          onClick={handleExport}
          disabled={filteredCommissions.length === 0}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          导出CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm">总营收</span>
          </div>
          <div className="text-2xl font-bold text-green-700">
            {formatMoney(totalRevenue)}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Percent className="w-5 h-5" />
            <span className="text-sm">总提成</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {formatMoney(totalCommission)}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Clock className="w-5 h-5" />
            <span className="text-sm">总服务时长</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {formatDuration(totalDuration)}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <Minus className="w-5 h-5" />
            <span className="text-sm">取消时长</span>
          </div>
          <div className="text-2xl font-bold text-red-700">
            {formatDuration(totalCancelledDuration)}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            开始日期
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            技师
          </label>
          <select
            value={selectedTechnicianId}
            onChange={(e) => setSelectedTechnicianId(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="">全部技师</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>
                {tech.name} ({tech.number}号)
              </option>
            ))}
          </select>
        </div>
        {(startDate || endDate || selectedTechnicianId) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setSelectedTechnicianId('') }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            重置筛选
          </button>
        )}
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-1/3 bg-gray-50 rounded-lg p-4 flex flex-col overflow-hidden">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-500" />
            技师排行榜
            <span className="text-sm text-gray-500 font-normal">
              ({ranking.length}人)
            </span>
          </h3>
          <div className="flex-1 overflow-auto">
            {ranking.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                暂无提成数据
              </div>
            ) : (
              <div className="space-y-2">
                {ranking.slice(0, 6).map((stat, index) => {
                  return (
                    <div
                      key={stat.technicianId}
                      className={`p-3 rounded-lg transition-colors ${
                        selectedTechnicianId === stat.technicianId
                          ? 'bg-accent-100 ring-2 ring-accent-500'
                          : 'bg-white hover:bg-gray-100 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (selectedTechnicianId === stat.technicianId) {
                          setSelectedTechnicianId('')
                        } else {
                          setSelectedTechnicianId(stat.technicianId)
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-300 text-orange-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {stat.technician?.name || '未知技师'}
                          </div>
                          <div className="text-xs text-gray-500 flex gap-2">
                            <span>{getLevelName(stat.technician?.level || 'junior')}</span>
                            <span>{formatDuration(stat.effectiveDuration)}</span>
                            <span className="text-green-600">¥{stat.effectiveAmount.toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-accent-600">
                            ¥{stat.total.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stat.recordCount}笔
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            提成明细
            <span className="text-sm text-gray-500 font-normal">
              ({filteredCommissions.length}条)
            </span>
          </h3>
          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">时间</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">技师</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">客人</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">原始时长</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">取消时长</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">有效时长</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">消费金额</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">提成比例</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">提成金额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                      暂无提成记录
                    </td>
                  </tr>
                ) : (
                  filteredCommissions.map(record => {
                    const tech = getTechnician(record.technicianId)
                    const cust = getCustomer(record.customerId)
                    const cancelledDur = record.duration - record.effectiveDuration
                    const hasCancellation = cancelledDur > 0
                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {formatDateTime(new Date(record.createdAt))}
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">
                            {tech?.name || '未知'}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            {tech ? `(${tech.number}号)` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {cust?.name || '未知'}
                          <span className="text-xs text-gray-500 ml-1">
                            {cust ? `(${cust.queueNumber.toString().padStart(3, '0')})` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {formatDuration(record.duration)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {hasCancellation ? (
                            <span className="text-red-600 font-medium">
                              -{formatDuration(cancelledDur)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-green-600">
                          {formatDuration(record.effectiveDuration)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ¥{record.effectiveAmount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {(record.commissionRate * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-accent-600">
                          ¥{record.commissionAmount.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
