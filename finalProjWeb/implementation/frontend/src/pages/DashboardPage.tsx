import { useState, useEffect } from 'react';
import { Container, Row, Col, Navbar, Nav, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { patientAPI, authAPI, sensorAPI, alertAPI, getErrorMessage } from '../services/api';
import { Patient } from '../types';
import PatientCard from '../components/PatientCard';
import { useSSE, SSESensorReadingEvent, SSEAlertTriggeredEvent, SSEAlertAcknowledgedEvent } from '../hooks/useSSE';

type SortOption = 'room_number' | 'name' | 'patient_id';

interface SensorReading {
  oxygen_level: number;
  heart_rate: number;
  temperature: number;
  timestamp: string;
}

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('room_number');
  
  // Real-time sensor data: Map<sensor_id, latest_reading>
  const [sensorData, setSensorData] = useState<Map<string, SensorReading>>(new Map());
  
  // Active alerts: Set<patient_id>
  const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  
  // Alert IDs for each patient: Map<patient_id, alert_id>
  const [patientAlertIds, setPatientAlertIds] = useState<Map<string, number>>(new Map());

  // SSE Connection for real-time updates
  const { connectionState, reconnect } = useSSE({
    url: '/stream/sensor-data',
    enabled: true,
    onSensorReading: (event: SSESensorReadingEvent) => {
      // Update sensor data map
      setSensorData((prev) => {
        const newMap = new Map(prev);
        newMap.set(event.data.sensor_id, {
          oxygen_level: event.data.oxygen_level || 0,
          heart_rate: event.data.heart_rate || 0,
          temperature: event.data.temperature || 0,
          timestamp: event.data.timestamp,
        });
        return newMap;
      });
    },
    onAlertTriggered: (event: SSEAlertTriggeredEvent) => {
      // Add patient to active alerts and track alert ID
      const { patient_id, alert_id } = event.data;
      setActiveAlerts((prev) => {
        const newSet = new Set(prev);
        newSet.add(patient_id);
        return newSet;
      });
      setPatientAlertIds((prev) => {
        const newMap = new Map(prev);
        newMap.set(patient_id, alert_id);
        return newMap;
      });
      console.log('Alert triggered:', event.data.message);
    },
    onAlertAcknowledged: (event: SSEAlertAcknowledgedEvent) => {
      // Remove patient from active alerts when acknowledged
      // PL-001 fix: backend now includes patient_id in this event
      const { patient_id } = event.data;
      if (patient_id) {
        setActiveAlerts((prev) => {
          const newSet = new Set(prev);
          newSet.delete(patient_id);
          return newSet;
        });
        setPatientAlertIds((prev) => {
          const newMap = new Map(prev);
          newMap.delete(patient_id);
          return newMap;
        });
        console.log('Alert acknowledged for patient:', patient_id);
      }
    },
    onConnected: () => {
      console.log('SSE connected - receiving real-time updates');
    },
    onError: (error) => {
      console.error('SSE connection error:', error);
    },
  });

  // Fetch patients on mount and when sort changes
  useEffect(() => {
    fetchPatients();
  }, [sortBy]);

  // Fetch initial sensor data for all patients with sensors
  useEffect(() => {
    const fetchInitialSensorData = async () => {
      // Wait for patients to load
      if (patients.length === 0) return;

      // Fetch last reading for each patient with a sensor
      const fetchPromises = patients
        .filter(p => p.sensor_id) // Only patients with assigned sensors
        .map(async (patient) => {
          try {
            const response = await sensorAPI.getReadings(patient.sensor_id!, { limit: 1 });
            if (response.readings && response.readings.length > 0) {
              const reading = response.readings[0];
              return {
                sensor_id: patient.sensor_id!,
                reading: {
                  oxygen_level: reading.oxygen_level || 0,
                  heart_rate: reading.heart_rate || 0,
                  temperature: reading.temperature || 0,
                  timestamp: reading.timestamp
                }
              };
            }
          } catch (err) {
            console.warn(`Failed to fetch initial reading for sensor ${patient.sensor_id}:`, err);
          }
          return null;
        });

      const results = await Promise.all(fetchPromises);
      
      // Update sensor data map with initial readings
      setSensorData((prev) => {
        const newMap = new Map(prev);
        results.forEach(result => {
          if (result) {
            newMap.set(result.sensor_id, result.reading);
          }
        });
        return newMap;
      });
    };

    fetchInitialSensorData();
  }, [patients]); // Re-fetch when patient list changes

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await patientAPI.getPatients({
        status: 'active',
        sort: sortBy,
        limit: 100
      });
      setPatients(response.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption);
  };

  const handleAcknowledgeAlert = async (patientId: string) => {
    try {
      // Get the alert_id for this patient
      const alertId = patientAlertIds.get(patientId);
      if (!alertId) {
        console.warn('No alert ID found for patient:', patientId);
        return;
      }

      // Call the API to acknowledge the alert
      await alertAPI.acknowledgeAlert(alertId);
      
      // The SSE event will handle removing from activeAlerts
      console.log('Alert acknowledged successfully for patient:', patientId);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      // Could show a toast notification here
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      {/* Navigation Bar */}
      <Navbar bg="primary" variant="dark" className="shadow-sm">
        <Container fluid>
          <Navbar.Brand>
            <strong>IoT Nursing Station</strong>
          </Navbar.Brand>
          <Nav className="ms-auto align-items-center">
            {/* Connection Status Indicator */}
            <Nav.Item className="me-3">
              {connectionState === 'connected' && (
                <span className="badge bg-success">
                  <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                  Live
                </span>
              )}
              {connectionState === 'connecting' && (
                <span className="badge bg-warning text-dark">
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Connecting...
                </span>
              )}
              {(connectionState === 'disconnected' || connectionState === 'error') && (
                <span 
                  className="badge bg-danger" 
                  style={{ cursor: 'pointer' }}
                  onClick={reconnect}
                  title="Click to reconnect"
                >
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Offline (Click to reconnect)
                </span>
              )}
            </Nav.Item>
            <Nav.Item className="text-light me-3">
              <small>
                <strong>{user?.role?.toUpperCase()}</strong> | Employee ID: {user?.employee_id}
              </small>
            </Nav.Item>
            <Button variant="outline-light" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </Nav>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container fluid className="py-4">
        {/* Header and Controls */}
        <Row className="mb-4">
          <Col md={6}>
            <h2 className="mb-0">Patient Monitoring Dashboard</h2>
            <small className="text-muted">Real-time vital signs monitoring</small>
          </Col>
          <Col md={6} className="text-md-end">
            <Form.Group className="d-inline-block">
              <Form.Label className="me-2 mb-0">
                <small><strong>Sort by:</strong></small>
              </Form.Label>
              <Form.Select 
                size="sm" 
                value={sortBy} 
                onChange={handleSortChange}
                style={{ width: 'auto', display: 'inline-block' }}
              >
                <option value="room_number">Room Number</option>
                <option value="name">Patient Name</option>
                <option value="patient_id">Patient ID</option>
              </Form.Select>
            </Form.Group>
            <Button 
              variant="outline-primary" 
              size="sm" 
              className="ms-2"
              onClick={fetchPatients}
            >
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </Button>
          </Col>
        </Row>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Loading patients...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            <Alert.Heading>Error Loading Patients</Alert.Heading>
            <p>{error}</p>
            <Button variant="outline-danger" size="sm" onClick={fetchPatients}>
              Try Again
            </Button>
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && patients.length === 0 && (
          <Alert variant="info">
            <Alert.Heading>No Active Patients</Alert.Heading>
            <p>There are currently no active patients assigned to sensors.</p>
          </Alert>
        )}

        {/* Patient Grid */}
        {!loading && !error && patients.length > 0 && (
          <Row className="g-3">
            {patients.map((patient) => {
              const reading = patient.sensor_id ? sensorData.get(patient.sensor_id) : undefined;
              const hasAlert = activeAlerts.has(patient.patient_id);
              
              return (
                <Col key={patient.patient_id} xs={12} sm={6} lg={4} xl={3}>
                  <PatientCard
                    patient={patient}
                    latestReading={reading}
                    hasActiveAlert={hasAlert}
                    onClick={() => console.log('Patient clicked:', patient.patient_id)}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                  />
                </Col>
              );
            })}
          </Row>
        )}

        {/* Footer Info */}
        <Row className="mt-4">
          <Col className="text-center">
            <small className="text-muted">
              {!loading && patients.length > 0 && (
                <>Monitoring {patients.length} active patient{patients.length !== 1 ? 's' : ''}</>
              )}
            </small>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default DashboardPage;
