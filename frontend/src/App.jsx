import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing          from './pages/Landing';
import StoryPage        from './pages/StoryPage';
import DashboardLayout  from './pages/dashboard/DashboardLayout';
import UserPaymentFlow  from './pages/UserPaymentFlow';
import CustomCursor     from './components/landing/CustomCursor';
import './App.css';

function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        {/* Landing page */}
        <Route path="/" element={
          <>
            <CustomCursor />
            <Landing />
          </>
        } />

        {/* Story — scroll-driven payment overview */}
        <Route path="/story" element={<StoryPage />} />

        {/* User Payment Flow — Dhokha Cyber-Detective Aesthetic */}
        <Route path="/pay" element={<UserPaymentFlow />} />

        {/* Admin Dashboard */}
        <Route path="/dashboard/*" element={<DashboardLayout />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
