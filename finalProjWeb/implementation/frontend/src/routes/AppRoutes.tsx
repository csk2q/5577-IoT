import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
// Import other pages as they are created

const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      
      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['nurse', 'admin']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      
      {/* Admin routes */}
      {/* <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        }
      /> */}
      
      {/* Intake routes */}
      {/* <Route
        path="/intake/patients"
        element={
          <ProtectedRoute allowedRoles={['intake', 'admin']}>
            <PatientIntakePage />
          </ProtectedRoute>
        }
      /> */}

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<div className="container mt-5"><h1>404 - Page Not Found</h1></div>} />
    </Routes>
  );
};

export default AppRoutes;
