/**
 * User roles in the system
 */
export type UserRole = 'nurse' | 'admin' | 'intake';

/**
 * User status
 */
export type UserStatus = 'active' | 'disabled';

/**
 * User entity
 */
export interface User {
  user_id: number;
  employee_id: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Patient status
 */
export type PatientStatus = 'active' | 'discharged';

/**
 * Patient entity
 */
export interface Patient {
  patient_id: string;
  name: string;
  room_number: string;
  sensor_id: string;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Sensor reading
 */
export interface SensorReading {
  reading_id: number;
  sensor_id: string;
  oxygen_level: number;
  heart_rate: number;
  timestamp: string;
}

/**
 * Alert types
 */
export type AlertType = 'button_pressed' | 'vitals_critical' | 'sensor_offline';

/**
 * Metric types
 */
export type MetricType = 'oxygen_level' | 'heart_rate' | 'none';

/**
 * Threshold exceeded direction
 */
export type ThresholdExceeded = 'upper' | 'lower' | 'none';

/**
 * Alert entity
 */
export interface Alert {
  alert_id: number;
  patient_id: string;
  sensor_id: string;
  alert_type: AlertType;
  metric_type?: MetricType;
  metric_value?: number;
  threshold_exceeded?: ThresholdExceeded;
  acknowledged: boolean;
  acknowledged_by?: number;
  timestamp: string;
  acknowledged_at?: string;
}

/**
 * Alert threshold configuration
 */
export interface AlertThreshold {
  threshold_id: number;
  patient_id: string;
  metric_type: MetricType;
  lower_limit: number;
  upper_limit: number;
  created_at: string;
  updated_at: string;
}

/**
 * Patient with current readings and alert status
 */
export interface PatientWithData extends Patient {
  latest_reading?: SensorReading;
  alert_thresholds?: {
    oxygen_level?: AlertThreshold;
    heart_rate?: AlertThreshold;
  };
  has_active_alert?: boolean;
  sensor_status?: 'online' | 'offline' | 'error';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  employee_id: string;
  password: string;
}

/**
 * Auth response
 */
export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: User;
}

/**
 * SSE event types
 */
export type SSEEventType = 
  | 'connected'
  | 'sensor_reading'
  | 'sensor_status'
  | 'alert_triggered'
  | 'heartbeat';

/**
 * SSE event data
 */
export interface SSEEvent {
  type: SSEEventType;
  data?: any;
  message?: string;
  timestamp?: string;
}
