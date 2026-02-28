
import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { LayoutDashboard, Flame, Package, ClipboardList, ShoppingCart, BarChart3, Menu, X, Coffee, BrainCircuit, Languages, Sun, Moon, Keyboard, ChevronRight, ChevronLeft, Zap, UserCircle, LogOut, Clock, AlertTriangle, Settings, Loader2, Users, DollarSign, TrendingUp } from 'lucide-react';
import DashboardView from './views/DashboardView';
import RoastingView from './views/RoastingView';
import InventoryView from './views/InventoryView';
import POSView from './views/POSView';
import ReportsView from './views/ReportsView';
import AIInsights from './views/AIInsights';
import LoginView from './views/LoginView';
import ConfigurationView from './views/ConfigurationView';
import StaffView from './views/StaffView';
import BranchPerformanceView from './views/BranchPerformanceView';
import BranchFinancialsView from './views/BranchFinancialsView';
import CRMView from './views/CRMView';
import { translations, Language } from './translations';
import { UserRole } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations.ar;
}

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiration

const AppContent: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, isLoading, logout, sessionExpiresAt, refreshSession, error } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'staff' | 'roasting' | 'inventory' | 'pos' | 'reports' | 'branchPerformance' | 'branchFinancials' | 'crm' | 'ai' | 'configuration'>(() => (localStorage.getItem('activeTab') as any) || 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('sidebarOpen') !== 'false');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  const allMenuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
    { id: 'staff', label: t.staff, icon: Users, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR] },
    { id: 'roasting', label: t.roasting, icon: Flame, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER] },
    { id: 'inventory', label: t.inventory, icon: ClipboardList, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
    { id: 'pos', label: t.pos, icon: ShoppingCart, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
    { id: 'reports', label: t.reports, icon: BarChart3, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.HR] },
    { id: 'branchPerformance', label: t.branchPerformance || 'Branch Performance', icon: TrendingUp, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'branchFinancials', label: t.branchFinancials || 'Branch Financials', icon: DollarSign, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'crm', label: t.crm || 'CRM', icon: Users, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] },
    { id: 'ai', label: t.ai, icon: BrainCircuit, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'configuration', label: t.configuration, icon: Settings, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.ROASTER, UserRole.CASHIER, UserRole.WAREHOUSE_STAFF] },
  ];

  const userRole = user?.role || UserRole.CASHIER;
  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  // Guard against unauthorized tab access (e.g. from localStorage or manually switching state)
  useEffect(() => {
    if (isAuthenticated && user) {
      const isAllowed = allMenuItems.find(i => i.id === activeTab)?.roles.includes(user.role);
      if (!isAllowed) {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, isAuthenticated, user]);

  useEffect(() => {
    if (sessionExpiresAt) {
      const timeUntilExpiry = sessionExpiresAt.getTime() - Date.now();
      const warningTime = timeUntilExpiry - WARNING_THRESHOLD;

      if (warningTime > 0) {
        const timer = setTimeout(() => setShowSessionWarning(true), warningTime);
        return () => clearTimeout(timer);
      } else if (timeUntilExpiry > 0) {
        setShowSessionWarning(true);
      }
    }
  }, [sessionExpiresAt]);

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang, t.dir]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { 
    if (isAuthenticated) localStorage.setItem('activeTab', activeTab); 
  }, [activeTab, isAuthenticated]);

  useEffect(() => { localStorage.setItem('sidebarOpen', isSidebarOpen.toString()); }, [isSidebarOpen]);

  const handleTabChange = useCallback((id: any) => {
    const isAllowed = allMenuItems.find(item => item.id === id)?.roles.includes(userRole);
    if (!isAllowed) return;
    
    setActiveTab(id);
    setActiveDetailId(null);
    setIsMobileMenuOpen(false);
  }, [userRole, allMenuItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticated) return;
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case '1': case 'd': handleTabChange('dashboard'); break;
          case '2': case 'r': handleTabChange('roasting'); break;
          case '3': case 'i': handleTabChange('inventory'); break;
          case '4': case 'p': handleTabChange('pos'); break;
          case '5': case 'm': handleTabChange('reports'); break;
          case '6': case 'a': handleTabChange('ai'); break;
          case '7': case 's': handleTabChange('configuration'); break;
          case 'l': setLang(lang === 'ar' ? 'en' : 'ar'); break;
          case 'q': setShowQuickActions(prev => !prev); break;
        }
      }
      if (e.key === '?') setShowShortcuts(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lang, theme, isAuthenticated, setLang, toggleTheme, handleTabChange]);

  const handleLoginSuccess = (role: string) => {
    switch (role) {
      case UserRole.ADMIN: case UserRole.MANAGER: case UserRole.HR: setActiveTab('dashboard'); break;
      case UserRole.ROASTER: setActiveTab('roasting'); break;
      case UserRole.WAREHOUSE_STAFF: setActiveTab('inventory'); break;
      default: setActiveTab('pos'); break;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 text-orange-600 animate-spin" />
      </div>
    );
  }

  if (error === "Account disabled") {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-8 text-center" dir={t.dir}>
        <div className="bg-orange-50 p-6 rounded-full text-black mb-6 border-2 border-orange-600">
          <AlertTriangle size={64} />
        </div>
        <h1 className="text-3xl font-bold mb-4">{t.accountDisabled}</h1>
        <button onClick={() => window.location.reload()} className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-bold border-2 border-transparent  transition-all">
          {t.backToLogin}
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLoginSuccess} />;
  }

  const Breadcrumbs = () => {
    const activeItem = allMenuItems.find(i => i.id === activeTab);
    return (
      <nav className="flex items-center gap-2 text-xs md:text-sm text-black  mb-4 transition-all overflow-x-auto no-scrollbar whitespace-nowrap">
        <button onClick={() => handleTabChange('dashboard')} className="hover:text-black  transition-colors">
          {t.home}
        </button>
        {activeTab !== 'dashboard' && (
          <>
            {t.dir === 'rtl' ? <ChevronLeft size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <button 
              onClick={() => setActiveDetailId(null)}
              className={`hover:text-black  transition-colors ${!activeDetailId ? 'font-bold text-black ' : ''}`}
            >
              {activeItem?.label}
            </button>
          </>
        )}
        {activeDetailId && (
          <>
            {t.dir === 'rtl' ? <ChevronLeft size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            <span className="font-bold text-black ">
              {activeDetailId}
            </span>
          </>
        )}
      </nav>
    );
  };

  const QuickActions = () => (
    <div className="relative">
      <button 
        onClick={() => setShowQuickActions(!showQuickActions)}
        className="flex items-center gap-2 bg-orange-600   text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg transition-all active:scale-95 border-2 border-transparent  "
      >
        <Zap size={16} fill="currentColor" />
        <span className="hidden sm:inline">{t.quickActions}</span>
      </button>
      {showQuickActions && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setShowQuickActions(false)} />
          <div className={`absolute top-full mt-2 ${t.dir === 'rtl' ? 'left-0' : 'right-0'} w-48 bg-white  rounded-2xl shadow-2xl border border-orange-100  p-2 z-[70] animate-in fade-in zoom-in-95 duration-200`}>
            {userRole !== UserRole.CASHIER && userRole !== UserRole.WAREHOUSE_STAFF && (
              <button onClick={() => { handleTabChange('roasting'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-right">
                <Flame size={16} className="text-black " />
                <span className="text-sm font-medium ">{t.newBatch}</span>
              </button>
            )}
            {userRole !== UserRole.ROASTER && userRole !== UserRole.WAREHOUSE_STAFF && (
              <button onClick={() => { handleTabChange('pos'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-right">
                <ShoppingCart size={16} className="text-black " />
                <span className="text-sm font-medium ">{t.newSale}</span>
              </button>
            )}
            <button onClick={() => { handleTabChange('inventory'); setShowQuickActions(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-right">
              <ClipboardList size={16} className="text-black " />
              <span className="text-sm font-medium ">{t.inventoryReport}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`flex h-screen bg-white overflow-hidden transition-colors duration-300 ${lang === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={t.dir}>
      {showSessionWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-white/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white  rounded-[32px] p-8 max-md w-full shadow-2xl border border-orange-100  text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-orange-50  p-4 rounded-full text-orange-600  border-2 border-orange-600 ">
                <Clock size={48} className="animate-pulse" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-black  mb-4">{t.sessionTimeout}</h3>
            <p className="text-black  mb-8 leading-relaxed">{t.sessionWarning}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowSessionWarning(false); refreshSession(); }} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl  transition-all active:scale-95 border-2 border-transparent hover">{t.stayLoggedIn}</button>
              <button onClick={() => { logout(); setShowSessionWarning(false); }} className="w-full py-4 text-black hover:text-black  font-bold transition-colors">{t.logout}</button>
            </div>
          </div>
        </div>
      )}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-white/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white  rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-orange-100 ">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-black "><Keyboard className="text-black " />{t.shortcuts}</h3>
              <button onClick={() => setShowShortcuts(false)} className="p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {menuItems.map((item, i) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-orange-50  last:border-0">
                  <span className="text-black  text-sm">{item.label}</span>
                  <kbd className="bg-white  px-2 py-1 rounded text-xs font-mono font-bold text-black  border border-orange-100 ">Alt + {item.id.charAt(0).toUpperCase()}</kbd>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 border-b border-orange-50  last:border-0">
                <span className="text-black  text-sm">{t.changeLanguage}</span>
                <kbd className="bg-white  px-2 py-1 rounded text-xs font-mono font-bold text-black  border border-orange-100 ">Alt + L</kbd>
              </div>

            </div>
          </div>
        </div>
      )}
      <aside className={`fixed inset-y-0 ${t.dir === 'rtl' ? 'right-0' : 'left-0'} z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isMobileMenuOpen ? 'translate-x-0' : (t.dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')} bg-white  text-black  border-r border-orange-100  flex-shrink-0 flex flex-col shadow-xl ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 flex items-center justify-between border-b border-orange-50 ">
          <div className={`flex items-center gap-3 overflow-hidden transition-all ${!isSidebarOpen && 'opacity-0 w-0 lg:hidden'}`}>
            <div className="bg-orange-600 p-2 rounded-lg"><Coffee className="w-6 h-6 text-white" /></div>
            <span className="font-bold text-xl whitespace-nowrap">{t.appName}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 rounded hidden lg:block transition-colors">{isSidebarOpen ? (t.dir === 'rtl' ? <ChevronRight size={20} /> : <ChevronLeft size={20} />) : <Menu size={20} />}</button>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded lg:hidden transition-colors"><X size={24} /></button>
        </div>
        <nav className="flex-1 mt-6 px-3 space-y-2 overflow-y-auto no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => handleTabChange(item.id)} className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-black   '}`}>
                <Icon size={22} className={`shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className={`font-medium whitespace-nowrap overflow-hidden transition-all ${!isSidebarOpen ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>{item.label}</span>
                {!isSidebarOpen && <div className={`absolute ${t.dir === 'rtl' ? 'right-full mr-4' : 'left-full ml-4'} px-2 py-1 bg-white text-orange-600 border border-orange-200 shadow-lg text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50`}>{item.label}</div>}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-orange-50">
          <button 
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl   transition-colors ${!isSidebarOpen ? 'justify-center' : ''}`}
            title={t.logout}
          >
            <LogOut size={20} />
            <span className={`font-medium whitespace-nowrap transition-all duration-300 ${!isSidebarOpen ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.logout}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 bg-white  shadow-sm flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-lg lg:hidden transition-colors"><Menu size={24} className="text-black " /></button>
            <h2 className="text-xl font-bold text-black ">{allMenuItems.find(i => i.id === activeTab)?.label}</h2>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex items-center gap-2">
              <QuickActions />
            </div>

            <button onClick={toggleLang} className="flex items-center gap-2 text-xs font-bold px-3 py-2 bg-white border border-orange-100 rounded-full shadow-sm transition-colors">
              <Languages size={16} />
              {lang === 'ar' ? t.languageEnglish : t.languageArabic}
            </button>

            <div className="h-8 w-px bg-orange-100  mx-2 hidden md:block" />

            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-bold text-black">{user?.name}</span>
                <span className="text-xs text-black">{user?.role}</span>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 border-2 border-orange-200">
                <UserCircle size={24} />
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Breadcrumbs />
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'staff' && <StaffView />}
            {activeTab === 'roasting' && <RoastingView onDetailOpen={setActiveDetailId} />}
            {activeTab === 'inventory' && <InventoryView />}
            {activeTab === 'pos' && <POSView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'branchPerformance' && <BranchPerformanceView />}
            {activeTab === 'branchFinancials' && <BranchFinancialsView />}
            {activeTab === 'crm' && <CRMView />}
            {activeTab === 'ai' && <AIInsights />}
            {activeTab === 'configuration' && <ConfigurationView />}
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'ar');
  const theme = 'light';
  
  const t = translations[lang];

  const toggleTheme = () => {};

  return (
    <AuthProvider>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <LanguageContext.Provider value={{ lang, setLang, t }}>
          <AppContent />
        </LanguageContext.Provider>
      </ThemeContext.Provider>
    </AuthProvider>
  );
};

export default App;
