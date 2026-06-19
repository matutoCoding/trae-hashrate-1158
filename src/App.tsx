import { useState } from 'react'
import { Users, CalendarClock, Wallet, UserCog, Settings, Bell, Clock } from 'lucide-react'
import QueuePanel from './components/QueuePanel'
import TechnicianPanel from './components/TechnicianPanel'
import BookingPanel from './components/BookingPanel'
import CommissionPanel from './components/CommissionPanel'
import { useStore } from './store/useStore'

type TabType = 'queue' | 'technicians' | 'bookings' | 'commission'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('queue')
  const { technicians, customers, bookings } = useStore()
  
  const waitingCount = customers.filter(c => c.status === 'waiting').length
  const calledCount = customers.filter(c => c.status === 'called').length
  const activeBookingsCount = bookings.filter(
    b => b.status === 'confirmed' || b.status === 'in_progress'
  ).length
  const idleTechniciansCount = technicians.filter(t => t.status === 'idle').length
  
  const tabs = [
    { key: 'queue' as TabType, label: '排队派钟', icon: Users, badge: waitingCount + calledCount },
    { key: 'technicians' as TabType, label: '技师状态', icon: UserCog, badge: idleTechniciansCount },
    { key: 'bookings' as TabType, label: '钟单管理', icon: CalendarClock, badge: activeBookingsCount },
    { key: 'commission' as TabType, label: '提成分账', icon: Wallet, badge: 0 },
  ]
  
  const currentTime = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">足浴技师派钟系统</h1>
              <p className="text-xs text-gray-500">智能排钟 · 自动合单 · 精准分账</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-lg">{currentTime}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">今日统计</div>
                <div className="text-xs text-gray-500">
                  服务 {bookings.filter(b => b.status === 'completed').length} 单
                </div>
              </div>
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                {waitingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {waitingCount}
                  </span>
                )}
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        <nav className="px-6 flex gap-1 border-t">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
              )}
            </button>
          ))}
        </nav>
      </header>
      
      <main className="p-6" style={{ height: 'calc(100vh - 140px)' }}>
        {activeTab === 'queue' && <QueuePanel />}
        {activeTab === 'technicians' && <TechnicianPanel />}
        {activeTab === 'bookings' && <BookingPanel />}
        {activeTab === 'commission' && <CommissionPanel />}
      </main>
    </div>
  )
}

export default App
