import { Routes, Route, useLocation } from 'react-router-dom';
import CustomCursor from './components/landing/CustomCursor';
import Landing from './pages/Landing';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import CommandCenter from './pages/dashboard/CommandCenter';

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <>
      {isLanding && <CustomCursor />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<CommandCenter />} />
        </Route>
      </Routes>
    </>
  );
}
