import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import CustomCursor from './components/landing/CustomCursor';
import './App.css';

function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={
          <>
            <CustomCursor />
            <Landing />
          </>
        } />
        <Route path="/dashboard/*" element={<DashboardLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
