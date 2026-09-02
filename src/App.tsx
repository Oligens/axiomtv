/**
 * Axiom TV — Coquille applicative & routage.
 * Hub communautaire + Studio AgwèStream intégré sur /studio/agwestream.
 */
import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar, TopBar, BottomNav } from "./components/layout";
import AuthModal from "./components/AuthModal";
import { ToastStack, type Toast } from "./components/ui";
import { useStore } from "./store/useStore";
import HomePage from "./pages/HomePage";
import ProPage from "./pages/ProPage";
import AgweStreamPage from "./pages/AgweStreamPage";
import StudioPage from "./pages/StudioPage";
import EarningsPage from "./pages/EarningsPage";
import CreatorProfilePage from "./pages/CreatorProfilePage";
import { SearchPage, LoginPage, SettingsPage, PublicationsPage, NotFoundPage } from "./pages/MiscPages";
import AmbientOcean from "./components/AmbientOcean";
import ScifiDirectorPanel from "./components/ScifiDirectorPanel";

function Protected({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function GlobalToasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return <ToastStack toasts={toasts as Toast[]} onDismiss={dismiss} />;
}

function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const boot = useStore((s) => s.boot);
  const user = useStore((s) => s.user);
  const location = useLocation();

  useEffect(() => {
    void boot();
  }, [boot]);

  const isAgwe = location.pathname === "/studio/agwestream" && Boolean(user);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(0,229,255,0.06), transparent 60%), radial-gradient(ellipse 70% 45% at 85% 110%, rgba(157,78,221,0.07), transparent 60%), radial-gradient(ellipse 50% 40% at 8% 90%, rgba(245,197,66,0.035), transparent 60%)" }} />
        <div className="bg-grid absolute inset-0" />
        <div className="grain animate-grain absolute inset-0 opacity-[0.05]" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(4,6,10,0.7) 100%)" }} />
      </div>
      <GlobalToasts />
      <AmbientOcean />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <TopBar />
      <main className={`relative z-10 px-4 pb-32 pt-[76px] transition-[padding] duration-300 sm:px-6 md:pb-20 ${collapsed ? "md:pl-[92px]" : "md:pl-[92px] lg:pl-[264px]"}`}>
        {isAgwe && <ScifiDirectorPanel />}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pro" element={<ProPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/creator/earnings" element={<Protected><EarningsPage /></Protected>} />
          <Route path="/creator/:handle" element={<CreatorProfilePage />} />
          <Route path="/studio" element={<Protected><StudioPage /></Protected>} />
          <Route path="/studio/agwestream" element={<Protected><AgweStreamPage /></Protected>} />
          <Route path="/studio/publications" element={<Protected><PublicationsPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <BottomNav />
      <AuthModal />
    </div>
  );
}

export default function App() {
  return <HashRouter><Shell /></HashRouter>;
}
