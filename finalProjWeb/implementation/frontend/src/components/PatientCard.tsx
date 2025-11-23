import React from 'react';
import { Patient } from '../types';
import Sparkline from './Sparkline';

interface PatientCardProps {
  patient: Patient;
  latestReading?: {
    oxygen_level: number;
    heart_rate: number;
    temperature: number;
    timestamp: string;
  };
  history?: {
    oxygen_level: number[];
    heart_rate: number[];
    temperature: number[];
  };
  hasActiveAlert?: boolean;
  onClick?: () => void;
  onAcknowledgeAlert?: (patientId: string) => void;
}

/**
 * PatientCard Component
 * 
 * Displays patient information and current vital signs.
 * Visual indicators for alert status (red border, pulse animation).
 * Click handler for viewing detailed patient information.
 */
const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  latestReading,
  history,
  hasActiveAlert = false,
  onClick,
  onAcknowledgeAlert
}) => {
  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (onAcknowledgeAlert) {
      onAcknowledgeAlert(patient.patient_id);
    }
  };
  // Format timestamp to readable time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Determine status badge based on readings
  const getStatusBadge = () => {
    if (!latestReading) {
      return <span className="badge bg-secondary">Offline</span>;
    }

    if (hasActiveAlert) {
      return <span className="badge bg-danger">Critical</span>;
    }

    // Warning thresholds
    const o2 = latestReading.oxygen_level;
    const hr = latestReading.heart_rate;

    if (o2 < 95 || hr < 60 || hr > 100) {
      return <span className="badge bg-warning text-dark">Warning</span>;
    }

    return <span className="badge bg-success">Normal</span>;
  };

  // Determine vital sign styling based on thresholds
  const getVitalClass = (type: 'oxygen' | 'heart_rate' | 'temperature', value: number) => {
    if (type === 'oxygen') {
      if (value < 90) return 'text-danger fw-bold';
      if (value < 95) return 'text-warning';
      return 'text-success';
    }

    if (type === 'heart_rate') {
      if (value < 55 || value > 110) return 'text-danger fw-bold';
      if (value < 60 || value > 100) return 'text-warning';
      return 'text-success';
    }

    if (type === 'temperature') {
      if (value < 36.0 || value > 38.3) return 'text-danger fw-bold';
      if (value > 37.9) return 'text-warning';
      return 'text-success';
    }

    return '';
  };

  return (
    <div
      className={`card h-100 ${hasActiveAlert ? 'border-danger border-3 shadow-lg' : 'border-secondary'} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        animation: hasActiveAlert ? 'pulse 2s ease-in-out infinite' : 'none'
      }}
    >
      <div className="card-body">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 className="card-title mb-1">{patient.name}</h5>
            <p className="text-muted small mb-0">Room {patient.room_number}</p>
          </div>
          {getStatusBadge()}
        </div>

        {/* Patient Info */}
        <div className="mb-3">
          <div className="d-flex justify-content-between small text-muted">
            <span>Patient ID:</span>
            <span className="fw-semibold">{patient.patient_id}</span>
          </div>
          <div className="d-flex justify-content-between small text-muted">
            <span>Sensor ID:</span>
            <span className="fw-semibold">{patient.sensor_id}</span>
          </div>
        </div>

        {/* Vital Signs */}
        {latestReading ? (
          <>
            <hr />
            <div className="vital-signs">
              {/* Oxygen Level */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    <i className="bi bi-droplet-fill text-primary me-2"></i>
                    <span className="small">O₂ Saturation</span>
                  </div>
                  <span className={`fs-5 ${getVitalClass('oxygen', latestReading.oxygen_level)}`}>
                    {latestReading.oxygen_level.toFixed(1)}%
                  </span>
                </div>
                {history && history.oxygen_level.length > 1 && (
                  <Sparkline
                    data={history.oxygen_level}
                    width={280}
                    height={30}
                    color="#0d6efd"
                    strokeWidth={2}
                    min={50}
                    max={100}
                  />
                )}
              </div>

              {/* Heart Rate */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    <i className="bi bi-heart-pulse-fill text-danger me-2"></i>
                    <span className="small">Heart Rate</span>
                  </div>
                  <span className={`fs-5 ${getVitalClass('heart_rate', latestReading.heart_rate)}`}>
                    {latestReading.heart_rate}
                    <small className="ms-1 text-muted">bpm</small>
                  </span>
                </div>
                {history && history.heart_rate.length > 1 && (
                  <Sparkline
                    data={history.heart_rate}
                    width={280}
                    height={30}
                    color="#dc3545"
                    strokeWidth={2}
                    min={30}
                    max={250}
                  />
                )}
              </div>

              {/* Temperature */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    <i className="bi bi-thermometer-half text-warning me-2"></i>
                    <span className="small">Temperature</span>
                  </div>
                  <span className={`fs-5 ${getVitalClass('temperature', latestReading.temperature)}`}>
                    {latestReading.temperature.toFixed(1)}°C
                  </span>
                </div>
                {history && history.temperature.length > 1 && (
                  <Sparkline
                    data={history.temperature}
                    width={280}
                    height={30}
                    color="#ffc107"
                    strokeWidth={2}
                    min={30}
                    max={45}
                  />
                )}
              </div>

              {/* Last Update */}
              <div className="text-end mt-2">
                <small className="text-muted">
                  <i className="bi bi-clock me-1"></i>
                  {formatTime(latestReading.timestamp)}
                </small>
              </div>
            </div>
          </>
        ) : (
          <>
            <hr />
            <div className="text-center text-muted py-4">
              <i className="bi bi-wifi-off fs-3 d-block mb-2"></i>
              <small>No sensor data available</small>
            </div>
          </>
        )}

        {/* Alert Indicator */}
        {hasActiveAlert && (
          <div className="alert alert-danger mt-3 mb-0 py-2 d-flex justify-content-between align-items-center" role="alert">
            <div>
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Alert Active</strong>
            </div>
            {onAcknowledgeAlert && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={handleAcknowledge}
                title="Acknowledge alert"
              >
                <i className="bi bi-check-circle me-1"></i>
                Acknowledge
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientCard;
