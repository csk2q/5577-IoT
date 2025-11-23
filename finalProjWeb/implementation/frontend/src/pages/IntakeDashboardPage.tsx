import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { patientAPI, getErrorMessage } from '../services/api';

export default function IntakeDashboardPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form state - individual fields
  const [patientId, setPatientId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [sensorId, setSensorId] = useState('');

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleResetForm = () => {
    setPatientId('');
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setRoomNumber('');
    setSensorId('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!patientId.trim()) {
      setError('Patient ID is required');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }
    if (!roomNumber.trim()) {
      setError('Room number is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Combine first and last name for backend
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      const requestData = {
        patient_id: patientId.trim(),
        name: fullName,
        room_number: roomNumber.trim(),
        sensor_id: sensorId.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
      };
      
      const newPatient = await patientAPI.createPatient(requestData);
      
      setSuccessMessage(
        `Patient ${newPatient.name} (${newPatient.patient_id}) successfully admitted to room ${newPatient.room_number}` +
        (newPatient.sensor_id ? ` with sensor ${newPatient.sensor_id}` : '')
      );
      
      // Reset form after success
      handleResetForm();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Generate next patient ID suggestion
  const generatePatientId = () => {
    const today = new Date();
    const year = today.getFullYear();
    const randomNum = Math.floor(Math.random() * 900) + 100; // 100-999
    return `P-${year}-${randomNum.toString().padStart(3, '0')}`;
  };

  const handleGeneratePatientId = () => {
    setPatientId(generatePatientId());
  };

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>Patient Intake</h2>
              <p className="text-muted mb-0">Admit New Patients</p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <Badge bg="info" className="px-3 py-2">
                <i className="bi bi-clipboard2-plus-fill me-2"></i>
                {user?.role.toUpperCase()}
              </Badge>
              <span className="text-muted">{user?.employee_id}</span>
              <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-2"></i>
                Logout
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Success Message */}
      {successMessage && (
        <Row className="mb-3">
          <Col>
            <Alert variant="success" dismissible onClose={() => setSuccessMessage(null)}>
              <i className="bi bi-check-circle-fill me-2"></i>
              {successMessage}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Error Message */}
      {error && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </Alert>
          </Col>
        </Row>
      )}

      {/* Patient Admission Form */}
      <Row className="justify-content-center">
        <Col lg={8} xl={6}>
          <Card>
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-person-plus-fill me-2"></i>
                New Patient Admission
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleCreatePatient}>
                {/* Patient ID */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    Patient ID <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="text"
                      name="patient_id"
                      placeholder="e.g., P-2025-011"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                      required
                    />
                    <Button 
                      variant="outline-secondary" 
                      onClick={handleGeneratePatientId}
                      disabled={loading}
                    >
                      <i className="bi bi-arrow-clockwise"></i> Generate
                    </Button>
                  </div>
                  <Form.Text className="text-muted">
                    Unique identifier. Format: P-YYYY-XXX
                  </Form.Text>
                </Form.Group>

                {/* Name Fields */}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        First Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="first_name"
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        Last Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="last_name"
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Date of Birth */}
                <Form.Group className="mb-3">
                  <Form.Label>Date of Birth</Form.Label>
                  <Form.Control
                    type="date"
                    name="date_of_birth"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]} // Can't be future date
                  />
                  <Form.Text className="text-muted">
                    Optional - used for age calculation and records
                  </Form.Text>
                </Form.Group>

                {/* Room Number */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    Room Number <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="room_number"
                    placeholder="e.g., 106A, 201B"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">
                    Physical room location on the ward
                  </Form.Text>
                </Form.Group>

                {/* Sensor Assignment */}
                <Form.Group className="mb-4">
                  <Form.Label>Sensor ID (Optional)</Form.Label>
                  <Form.Select
                    name="sensor_id"
                    value={sensorId}
                    onChange={(e) => setSensorId(e.target.value)}
                  >
                    <option value="">-- Assign later --</option>
                    <optgroup label="Available Sensors">
                      <option value="ESP32-VS-011">ESP32-VS-011</option>
                      <option value="ESP32-VS-012">ESP32-VS-012</option>
                      <option value="ESP32-VS-013">ESP32-VS-013</option>
                      <option value="ESP32-VS-014">ESP32-VS-014</option>
                      <option value="ESP32-VS-015">ESP32-VS-015</option>
                      <option value="ESP32-VS-016">ESP32-VS-016</option>
                      <option value="ESP32-VS-017">ESP32-VS-017</option>
                      <option value="ESP32-VS-018">ESP32-VS-018</option>
                      <option value="ESP32-VS-019">ESP32-VS-019</option>
                      <option value="ESP32-VS-020">ESP32-VS-020</option>
                    </optgroup>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Assign vital signs monitoring sensor. Can be configured later.
                  </Form.Text>
                </Form.Group>

                {/* Info Box */}
                <Alert variant="info" className="mb-4">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  <small>
                    <strong>Note:</strong> Patient will be immediately visible to nursing staff after admission. 
                    If a sensor is assigned, real-time monitoring will begin automatically.
                  </small>
                </Alert>

                {/* Action Buttons */}
                <div className="d-flex gap-2 justify-content-end">
                  <Button 
                    variant="outline-secondary" 
                    type="button" 
                    onClick={handleResetForm}
                    disabled={loading}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Clear Form
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Admitting Patient...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill me-2"></i>
                        Admit Patient
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          {/* Quick Help Card */}
          <Card className="mt-3 border-0 bg-light">
            <Card.Body>
              <h6 className="text-muted mb-3">
                <i className="bi bi-lightbulb me-2"></i>
                Quick Guide
              </h6>
              <ul className="small text-muted mb-0">
                <li>Patient ID is unique and cannot be changed after admission</li>
                <li>Room number helps nurses locate patients quickly</li>
                <li>Sensor assignment enables real-time vital signs monitoring</li>
                <li>Unassigned sensors (ESP32-VS-011 through ESP32-VS-020) are available</li>
                <li>Date of birth is optional but recommended for comprehensive records</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
