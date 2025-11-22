import axios, { AxiosInstance, AxiosError } from 'axios';
import type { 
  User, Patient, SensorReading, Alert, AlertThreshold,
  LoginRequest, LoginResponse, CreateUserRequest, CreatePatientRequest,
  UpdateThresholdsRequest, PaginatedResponse, ApiResponse 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

/**
 * Axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

/**
 * Request interceptor to add JWT token
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extract data from API response
 */
function extractData<T>(response: ApiResponse<T>): T {
  if (!response.data) {
    throw new Error(response.error?.message || 'Invalid response from server');
  }
  return response.data;
}

// ============================================================================
// Authentication API
// ============================================================================

export const authAPI = {
  /**
   * Login with employee ID and password
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    if (!response.data.data) {
      throw new Error('Invalid response from server');
    }
    return response.data.data;
  },

  /**
   * Logout and invalidate token
   */
  logout: async (): Promise<void> => {
    const token = localStorage.getItem('token');
    await apiClient.post('/auth/logout', { token });
  },

  /**
   * Refresh JWT token
   */
  refresh: async (): Promise<{ token: string; expiresIn: number }> => {
    const token = localStorage.getItem('token');
    const response = await apiClient.post<ApiResponse<{ token: string; expiresIn: number }>>('/auth/refresh', { token });
    return extractData(response.data);
  },
};

// ============================================================================
// User Management API (Admin only)
// ============================================================================

export const userAPI = {
  /**
   * Get all users with optional filtering
   */
  getUsers: async (params?: { page?: number; limit?: number; role?: string; status?: string }): Promise<PaginatedResponse<User>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<User>>>('/users', { params });
    return extractData(response.data);
  },

  /**
   * Create a new user
   */
  createUser: async (user: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/users', user);
    return extractData(response.data);
  },

  /**
   * Update user status (enable/disable)
   */
  updateUserStatus: async (employeeId: string, status: 'active' | 'disabled'): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${employeeId}/status`, { status });
    return extractData(response.data);
  },

  /**
   * Trigger password reset for user
   */
  requestPasswordReset: async (employeeId: string): Promise<void> => {
    await apiClient.post(`/users/${employeeId}/password-reset-request`);
  },
};

// ============================================================================
// Patient Management API
// ============================================================================

export const patientAPI = {
  /**
   * Get all patients with optional filtering and sorting
   */
  getPatients: async (params?: { 
    page?: number; 
    limit?: number; 
    status?: 'active' | 'discharged'; 
    sort?: 'room_number' | 'name' | 'patient_id' 
  }): Promise<PaginatedResponse<Patient>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Patient>>>('/patients', { params });
    return extractData(response.data);
  },

  /**
   * Get patient details with thresholds and latest reading
   */
  getPatient: async (patientId: string): Promise<Patient> => {
    const response = await apiClient.get<ApiResponse<Patient>>(`/patients/${patientId}`);
    return extractData(response.data);
  },

  /**
   * Create a new patient
   */
  createPatient: async (patient: CreatePatientRequest): Promise<Patient> => {
    const response = await apiClient.post<ApiResponse<Patient>>('/patients', patient);
    return extractData(response.data);
  },

  /**
   * Update patient information
   */
  updatePatient: async (patientId: string, updates: Partial<Patient>): Promise<Patient> => {
    const response = await apiClient.put<ApiResponse<Patient>>(`/patients/${patientId}`, updates);
    return extractData(response.data);
  },

  /**
   * Discharge a patient
   */
  dischargePatient: async (patientId: string): Promise<Patient> => {
    const response = await apiClient.post<ApiResponse<Patient>>(`/patients/${patientId}/discharge`);
    return extractData(response.data);
  },

  /**
   * Get alert thresholds for a patient
   */
  getThresholds: async (patientId: string): Promise<{ thresholds: Record<string, AlertThreshold> }> => {
    const response = await apiClient.get<ApiResponse<{ thresholds: Record<string, AlertThreshold> }>>(`/patients/${patientId}/thresholds`);
    return extractData(response.data);
  },

  /**
   * Update alert thresholds for a patient
   */
  updateThresholds: async (patientId: string, thresholds: UpdateThresholdsRequest): Promise<{ thresholds: Record<string, AlertThreshold> }> => {
    const response = await apiClient.put<ApiResponse<{ thresholds: Record<string, AlertThreshold> }>>(`/patients/${patientId}/thresholds`, thresholds);
    return extractData(response.data);
  },
};

// ============================================================================
// Sensor Data API
// ============================================================================

export const sensorAPI = {
  /**
   * Get recent readings for a sensor
   */
  getReadings: async (sensorId: string, params?: { limit?: number; since?: string }): Promise<{ readings: SensorReading[] }> => {
    const response = await apiClient.get<ApiResponse<{ readings: SensorReading[] }>>(`/sensors/${sensorId}/readings`, { params });
    return extractData(response.data);
  },
};

// ============================================================================
// Alert Management API
// ============================================================================

export const alertAPI = {
  /**
   * Get alerts with optional filtering
   */
  getAlerts: async (params?: { 
    patient_id?: string; 
    acknowledged?: boolean; 
    page?: number; 
    limit?: number 
  }): Promise<PaginatedResponse<Alert>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Alert>>>('/alerts', { params });
    return extractData(response.data);
  },

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert: async (alertId: number): Promise<Alert> => {
    const response = await apiClient.patch<ApiResponse<Alert>>(`/alerts/${alertId}/acknowledge`, { acknowledged: true });
    return extractData(response.data);
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract error message from API error
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data;
    if (apiError?.error?.message) {
      return apiError.error.message;
    }
    if (error.message) {
      return error.message;
    }
  }
  return 'An unexpected error occurred';
};

export default apiClient;
