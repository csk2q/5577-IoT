import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Alert, ButtonGroup } from 'react-bootstrap';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Patient, Alert as AlertType } from '../types';
import { sensorAPI, alertAPI } from '../services/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PatientHistoryModalProps {
  show: boolean;
  onHide: () => void;
  patient: Patient;
}

interface HistoricalReading {
  reading_id: number;
  oxygen_level: number | null;
  heart_rate: number;
  temperature: number | null;
  pressure?: number;
  timestamp: string;
}

type TimeRange = '24h' | '7d' | '30d';

const PatientHistoryModal: React.FC<PatientHistoryModalProps> = ({ show, onHide, patient }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [readings, setReadings] = useState<HistoricalReading[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && patient.sensor_id) {
      fetchHistoricalData();
    }
  }, [show, patient.sensor_id, timeRange]);

  const fetchHistoricalData = async () => {
    if (!patient.sensor_id) return;

    setLoading(true);
    setError('');

    try {
      // Calculate time range
      const now = new Date();
      const since = new Date();
      if (timeRange === '24h') {
        since.setHours(now.getHours() - 24);
      } else if (timeRange === '7d') {
        since.setDate(now.getDate() - 7);
      } else if (timeRange === '30d') {
        since.setDate(now.getDate() - 30);
      }

      // Fetch readings
      const readingsResponse = await sensorAPI.getReadings(patient.sensor_id, {
        limit: timeRange === '24h' ? 100 : timeRange === '7d' ? 100 : 100,
        since: since.toISOString()
      });

      // Fetch alerts for this patient
      const alertsResponse = await alertAPI.getAlerts({
        patient_id: patient.patient_id,
        acknowledged: 'all'
      });

      // Filter alerts to time range
      const filteredAlerts = alertsResponse.items.filter((alert: AlertType) => {
        const alertTime = new Date(alert.triggered_at);
        return alertTime >= since;
      });

      setReadings(readingsResponse.readings.reverse()); // Reverse to chronological order
      setAlerts(filteredAlerts);
    } catch (err) {
      setError('Failed to load historical data');
      console.error('Error fetching historical data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createChartData = (metric: 'oxygen_level' | 'heart_rate' | 'temperature') => {
    const labels = readings.map(r => new Date(r.timestamp).toLocaleTimeString());
    const data = readings.map(r => r[metric]);

    // Find alerts for this metric
    const metricAlerts = alerts.filter(alert => {
      if (metric === 'oxygen_level') {
        return alert.alert_type?.includes('oxygen');
      } else if (metric === 'heart_rate') {
        return alert.alert_type?.includes('heart_rate');
      } else if (metric === 'temperature') {
        return alert.alert_type?.includes('temperature');
      }
      return false;
    });

    // Create alert markers
    const alertPoints = readings.map((reading) => {
      const readingTime = new Date(reading.timestamp).getTime();
      const hasAlert = metricAlerts.some(alert => {
        const alertTime = new Date(alert.triggered_at).getTime();
        // Match if alert triggered within 30 seconds of reading
        return Math.abs(alertTime - readingTime) < 30000;
      });
      return hasAlert ? reading[metric] : null;
    });

    // Find button press alerts
    const buttonPressAlerts = alerts.filter(alert => alert.alert_type === 'button_pressed');
    
    // Create button press markers
    const buttonPressPoints = readings.map((reading) => {
      const readingTime = new Date(reading.timestamp).getTime();
      const hasButtonPress = buttonPressAlerts.some(alert => {
        const alertTime = new Date(alert.triggered_at).getTime();
        // Match if button pressed within 30 seconds of reading
        return Math.abs(alertTime - readingTime) < 30000;
      });
      return hasButtonPress ? reading[metric] : null;
    });

    // Create pressure off markers (when pressure = 0)
    const pressureOffPoints = readings.map((reading) => {
      return reading.pressure === 0 ? reading[metric] : null;
    });

    return {
      labels,
      datasets: [
        {
          label: metric === 'oxygen_level' ? 'Blood Oxygen (%)' : 
                 metric === 'heart_rate' ? 'Heart Rate (bpm)' :
                 'Temperature (°C)',
          data,
          borderColor: metric === 'oxygen_level' ? 'rgb(75, 192, 192)' :
                       metric === 'heart_rate' ? 'rgb(255, 99, 132)' :
                       'rgb(255, 159, 64)',
          backgroundColor: metric === 'oxygen_level' ? 'rgba(75, 192, 192, 0.2)' :
                           metric === 'heart_rate' ? 'rgba(255, 99, 132, 0.2)' :
                           'rgba(255, 159, 64, 0.2)',
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: 'Vital Sign Alerts',
          data: alertPoints,
          borderColor: 'rgb(220, 53, 69)',
          backgroundColor: 'rgba(220, 53, 69, 0.8)',
          pointRadius: 8,
          pointStyle: 'triangle',
          showLine: false,
        },
        {
          label: 'Call Button Pressed',
          data: buttonPressPoints,
          borderColor: 'rgb(13, 110, 253)',
          backgroundColor: 'rgba(13, 110, 253, 0.8)',
          pointRadius: 8,
          pointStyle: 'circle',
          showLine: false,
        },
        {
          label: 'Pressure Off',
          data: pressureOffPoints,
          borderColor: 'rgb(220, 53, 69)',
          backgroundColor: 'rgba(220, 53, 69, 0.8)',
          pointRadius: 8,
          pointStyle: 'rect',
          showLine: false,
        },
      ],
    };
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Patient History - {patient.name}
          <div className="text-muted small">Room {patient.room_number} | Patient ID: {patient.patient_id}</div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Time Range Selector */}
        <div className="mb-4">
          <ButtonGroup>
            <Button
              variant={timeRange === '24h' ? 'primary' : 'outline-primary'}
              onClick={() => setTimeRange('24h')}
            >
              Last 24 Hours
            </Button>
            <Button
              variant={timeRange === '7d' ? 'primary' : 'outline-primary'}
              onClick={() => setTimeRange('7d')}
            >
              Last 7 Days
            </Button>
            <Button
              variant={timeRange === '30d' ? 'primary' : 'outline-primary'}
              onClick={() => setTimeRange('30d')}
            >
              Last 30 Days
            </Button>
          </ButtonGroup>
          {alerts.length > 0 && (
            <div className="text-muted small mt-2">
              <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i>
              {alerts.length} alert event{alerts.length !== 1 ? 's' : ''} in this time range
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-2 text-muted">Loading historical data...</p>
          </div>
        )}

        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        {!loading && !error && readings.length === 0 && (
          <Alert variant="info">No data available for the selected time range.</Alert>
        )}

        {!loading && !error && readings.length > 0 && (
          <>
            {/* Blood Oxygen Chart */}
            <div className="mb-4">
              <h5>Blood Oxygen Level</h5>
              <div style={{ height: '250px' }}>
                <Line data={createChartData('oxygen_level')} options={chartOptions} />
              </div>
            </div>

            {/* Heart Rate Chart */}
            <div className="mb-4">
              <h5>Heart Rate</h5>
              <div style={{ height: '250px' }}>
                <Line data={createChartData('heart_rate')} options={chartOptions} />
              </div>
            </div>

            {/* Temperature Chart */}
            <div className="mb-4">
              <h5>Temperature</h5>
              <div style={{ height: '250px' }}>
                <Line data={createChartData('temperature')} options={chartOptions} />
              </div>
            </div>

            {/* Alert Summary */}
            {alerts.length > 0 && (
              <div className="mt-4">
                <h5>Alert Events</h5>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Message</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.slice(0, 10).map(alert => (
                        <tr key={alert.alert_id}>
                          <td>{new Date(alert.triggered_at).toLocaleString()}</td>
                          <td>
                            <span className={`badge bg-${alert.severity === 'critical' ? 'danger' : 'warning'}`}>
                              {alert.alert_type}
                            </span>
                          </td>
                          <td>{alert.message}</td>
                          <td>
                            {alert.acknowledged ? (
                              <span className="text-success">
                                <i className="bi bi-check-circle-fill"></i> Acknowledged
                              </span>
                            ) : (
                              <span className="text-danger">
                                <i className="bi bi-exclamation-circle-fill"></i> Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {alerts.length > 10 && (
                    <p className="text-muted small">Showing 10 of {alerts.length} alerts</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PatientHistoryModal;
