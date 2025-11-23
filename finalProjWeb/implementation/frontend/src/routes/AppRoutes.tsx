import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import IntakeDashboardPage from '../pages/IntakeDashboardPage';

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

/**
 * Role-based redirect - sends users to their appropriate dashboard
 */
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'intake':
      return <Navigate to="/intake" replace />;
    case 'nurse':
      return <Navigate to="/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={isAuthenticated ? <RoleBasedRedirect /> : <LoginPage />} />
      
      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      
      {/* Intake Dashboard */}
      <Route
        path="/intake"
        element={
          <ProtectedRoute allowedRoles={['intake', 'admin']}>
            <IntakeDashboardPage />
          </ProtectedRoute>
        }
      />
      
      {/* Nurse Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['nurse', 'admin']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect - role-based */}
      <Route path="/" element={<RoleBasedRedirect />} />
      
      {/* Unauthorized */}
      <Route 
        path="/unauthorized" 
        element={
          <div className="container mt-5 text-center">
            <h1 className="text-danger">Access Denied</h1>
            <p>You do not have permission to access this page.</p>
            <a href="/" className="btn btn-primary">Go to Dashboard</a>
          </div>
        } 
      />
      
      {/* 404 */}
      <Route path="*" element={<div className="container mt-5"><h1>404 - Page Not Found</h1></div>} />
    </Routes>
  );
};

export default AppRoutes;
