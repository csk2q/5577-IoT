import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { patientAPI, getErrorMessage } from '../services/api';
import type { UpdateThresholdsRequest } from '../types';

interface ThresholdConfigModalProps {
  show: boolean;
  onHide: () => void;
  patientId: string;
  patientName: string;
  onSuccess?: () => void;
}

interface ThresholdValues {
  lower_limit: number;
  upper_limit: number;
}

interface ThresholdState {
  heart_rate: ThresholdValues;
  blood_oxygen: ThresholdValues;
  temperature: ThresholdValues;
}

// Default threshold values based on medical standards
const DEFAULT_THRESHOLDS: ThresholdState = {
  heart_rate: {
    lower_limit: 60,
    upper_limit: 100
  },
  blood_oxygen: {
    lower_limit: 90,
    upper_limit: 100
  },
  temperature: {
    lower_limit: 36.5,
    upper_limit: 37.5
  }
};

export default function ThresholdConfigModal({ 
  show, 
  onHide, 
  patientId, 
  patientName,
  onSuccess 
}: ThresholdConfigModalProps) {
  const [thresholds, setThresholds] = useState<ThresholdState>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch current thresholds when modal opens
  useEffect(() => {
    if (show && patientId) {
      fetchThresholds();
    }
  }, [show, patientId]);

  const fetchThresholds = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await patientAPI.getThresholds(patientId);
      
      // Merge with defaults to ensure all fields are present
      const fetchedThresholds = { ...DEFAULT_THRESHOLDS };
      
      if (response.thresholds.heart_rate) {
        fetchedThresholds.heart_rate = {
          lower_limit: response.thresholds.heart_rate.lower_limit,
          upper_limit: response.thresholds.heart_rate.upper_limit
        };
      }
      
      if (response.thresholds.blood_oxygen) {
        fetchedThresholds.blood_oxygen = {
          lower_limit: response.thresholds.blood_oxygen.lower_limit,
          upper_limit: response.thresholds.blood_oxygen.upper_limit
        };
      }
      
      if (response.thresholds.temperature) {
        fetchedThresholds.temperature = {
          lower_limit: response.thresholds.temperature.lower_limit,
          upper_limit: response.thresholds.temperature.upper_limit
        };
      }
      
      setThresholds(fetchedThresholds);
    } catch (err) {
      console.error('Failed to fetch thresholds:', err);
      // Use defaults if fetch fails
      setThresholds(DEFAULT_THRESHOLDS);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (
    metric: keyof ThresholdState,
    field: 'lower_limit' | 'upper_limit',
    value: string
  ) => {
    const numValue = parseFloat(value);
    
    if (!isNaN(numValue)) {
      setThresholds(prev => ({
        ...prev,
        [metric]: {
          ...prev[metric],
          [field]: numValue
        }
      }));
      
      // Clear validation error for this field
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${metric}_${field}`];
        return newErrors;
      });
    }
  };

  const validateThresholds = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Heart Rate validation
    if (thresholds.heart_rate.lower_limit < 30 || thresholds.heart_rate.lower_limit > 120) {
      errors.heart_rate_lower = 'Lower limit should be between 30-120 bpm';
    }
    if (thresholds.heart_rate.upper_limit < 60 || thresholds.heart_rate.upper_limit > 200) {
      errors.heart_rate_upper = 'Upper limit should be between 60-200 bpm';
    }
    if (thresholds.heart_rate.lower_limit >= thresholds.heart_rate.upper_limit) {
      errors.heart_rate = 'Lower limit must be less than upper limit';
    }
    
    // Blood Oxygen validation
    if (thresholds.blood_oxygen.lower_limit < 70 || thresholds.blood_oxygen.lower_limit > 100) {
      errors.blood_oxygen_lower = 'Lower limit should be between 70-100%';
    }
    if (thresholds.blood_oxygen.upper_limit < 90 || thresholds.blood_oxygen.upper_limit > 100) {
      errors.blood_oxygen_upper = 'Upper limit should be between 90-100%';
    }
    if (thresholds.blood_oxygen.lower_limit >= thresholds.blood_oxygen.upper_limit) {
      errors.blood_oxygen = 'Lower limit must be less than upper limit';
    }
    
    // Temperature validation
    if (thresholds.temperature.lower_limit < 34 || thresholds.temperature.lower_limit > 38) {
      errors.temperature_lower = 'Lower limit should be between 34-38°C';
    }
    if (thresholds.temperature.upper_limit < 36 || thresholds.temperature.upper_limit > 42) {
      errors.temperature_upper = 'Upper limit should be between 36-42°C';
    }
    if (thresholds.temperature.lower_limit >= thresholds.temperature.upper_limit) {
      errors.temperature = 'Lower limit must be less than upper limit';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    // Validate
    if (!validateThresholds()) {
      setError('Please fix validation errors before saving');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const updateRequest: UpdateThresholdsRequest = {
        heart_rate: thresholds.heart_rate,
        blood_oxygen: thresholds.blood_oxygen,
        temperature: thresholds.temperature
      };
      
      await patientAPI.updateThresholds(patientId, updateRequest);
      
      if (onSuccess) {
        onSuccess();
      }
      
      onHide();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    setValidationErrors({});
    setError(null);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Configure Alert Thresholds</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading thresholds...</span>
            </Spinner>
            <p className="mt-2 text-muted">Loading current thresholds...</p>
          </div>
        ) : (
          <>
            <p className="text-muted mb-4">
              Set alert thresholds for <strong>{patientName}</strong> (ID: {patientId})
            </p>
            
            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            {/* Heart Rate */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold">Heart Rate (bpm)</Form.Label>
              <Row>
                <Col>
                  <Form.Label className="small text-muted">Lower Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="30"
                    max="120"
                    step="1"
                    value={thresholds.heart_rate.lower_limit}
                    onChange={(e) => handleThresholdChange('heart_rate', 'lower_limit', e.target.value)}
                    isInvalid={!!validationErrors.heart_rate_lower || !!validationErrors.heart_rate}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.heart_rate_lower}
                  </Form.Control.Feedback>
                </Col>
                <Col>
                  <Form.Label className="small text-muted">Upper Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="60"
                    max="200"
                    step="1"
                    value={thresholds.heart_rate.upper_limit}
                    onChange={(e) => handleThresholdChange('heart_rate', 'upper_limit', e.target.value)}
                    isInvalid={!!validationErrors.heart_rate_upper || !!validationErrors.heart_rate}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.heart_rate_upper}
                  </Form.Control.Feedback>
                </Col>
              </Row>
              {validationErrors.heart_rate && (
                <Form.Text className="text-danger">
                  {validationErrors.heart_rate}
                </Form.Text>
              )}
              <Form.Text className="text-muted">
                Normal range: 60-100 bpm
              </Form.Text>
            </Form.Group>
            
            {/* Blood Oxygen */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold">Blood Oxygen (%)</Form.Label>
              <Row>
                <Col>
                  <Form.Label className="small text-muted">Lower Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="70"
                    max="100"
                    step="0.1"
                    value={thresholds.blood_oxygen.lower_limit}
                    onChange={(e) => handleThresholdChange('blood_oxygen', 'lower_limit', e.target.value)}
                    isInvalid={!!validationErrors.blood_oxygen_lower || !!validationErrors.blood_oxygen}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.blood_oxygen_lower}
                  </Form.Control.Feedback>
                </Col>
                <Col>
                  <Form.Label className="small text-muted">Upper Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="90"
                    max="100"
                    step="0.1"
                    value={thresholds.blood_oxygen.upper_limit}
                    onChange={(e) => handleThresholdChange('blood_oxygen', 'upper_limit', e.target.value)}
                    isInvalid={!!validationErrors.blood_oxygen_upper || !!validationErrors.blood_oxygen}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.blood_oxygen_upper}
                  </Form.Control.Feedback>
                </Col>
              </Row>
              {validationErrors.blood_oxygen && (
                <Form.Text className="text-danger">
                  {validationErrors.blood_oxygen}
                </Form.Text>
              )}
              <Form.Text className="text-muted">
                Normal range: 95-100%
              </Form.Text>
            </Form.Group>
            
            {/* Temperature */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold">Temperature (°C)</Form.Label>
              <Row>
                <Col>
                  <Form.Label className="small text-muted">Lower Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="34"
                    max="38"
                    step="0.1"
                    value={thresholds.temperature.lower_limit}
                    onChange={(e) => handleThresholdChange('temperature', 'lower_limit', e.target.value)}
                    isInvalid={!!validationErrors.temperature_lower || !!validationErrors.temperature}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.temperature_lower}
                  </Form.Control.Feedback>
                </Col>
                <Col>
                  <Form.Label className="small text-muted">Upper Limit</Form.Label>
                  <Form.Control
                    type="number"
                    min="36"
                    max="42"
                    step="0.1"
                    value={thresholds.temperature.upper_limit}
                    onChange={(e) => handleThresholdChange('temperature', 'upper_limit', e.target.value)}
                    isInvalid={!!validationErrors.temperature_upper || !!validationErrors.temperature}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.temperature_upper}
                  </Form.Control.Feedback>
                </Col>
              </Row>
              {validationErrors.temperature && (
                <Form.Text className="text-danger">
                  {validationErrors.temperature}
                </Form.Text>
              )}
              <Form.Text className="text-muted">
                Normal range: 36.5-37.5°C
              </Form.Text>
            </Form.Group>
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={handleReset} disabled={loading || saving}>
          Reset to Defaults
        </Button>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={loading || saving}
        >
          {saving ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                className="me-2"
              />
              Saving...
            </>
          ) : (
            'Save Thresholds'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
