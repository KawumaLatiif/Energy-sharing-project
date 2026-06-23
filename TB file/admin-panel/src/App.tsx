import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import Users from "./pages/Users";
import Meters from "./pages/Meters";
import AdminTokens from "./pages/AdminTokens";
import AdminTransactions from "./pages/AdminTransactions";
import CreditLoans from "./pages/CreditLoans";
import Reports from "./pages/Reports";
import FinancialStats from "./pages/FinancialStats";
import SystemHealth from "./pages/SystemHealth";
import AuditLog from "./pages/AuditLog";
import StaffAccounts from "./pages/StaffAccounts";
import Settings from "./pages/Settings";
import SupportTickets from "./pages/SupportTickets";
import { getAdminToken } from "./lib/auth";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  return getAdminToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<AdminDashboard />} />
          <Route path="users"        element={<Users />} />
          <Route path="support"      element={<SupportTickets />} />
          <Route path="meters"       element={<Meters />} />
          <Route path="tokens"       element={<AdminTokens />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="credit-loans" element={<CreditLoans />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="financials"   element={<FinancialStats />} />
          <Route path="health"       element={<SystemHealth />} />
          <Route path="audit"        element={<AuditLog />} />
          <Route path="staff"        element={<StaffAccounts />} />
          <Route path="settings"     element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
