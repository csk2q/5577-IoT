import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, patientAPI, getErrorMessage } from '../services/api';
import type { User, UserRole, CreateUserRequest, Patient } from '../types';
import ThresholdConfigModal from '../components/ThresholdConfigModal';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<CreateUserRequest>({
    employee_id: '',
    password: '',
    role: 'nurse',
    first_name: '',
    last_name: '',
    email: '',
  });

  // Patient management state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Fetch users and patients on mount
  useEffect(() => {
    fetchUsers();
    fetchPatients();
  }, []);

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userAPI.getUsers({ limit: 100 });
      setUsers(response.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      setPatientsLoading(true);
      const response = await patientAPI.getPatients({ limit: 100, status: 'active' });
      setPatients(response.items);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    } finally {
      setPatientsLoading(false);
    }
  };

  const handleConfigureThresholds = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowThresholdModal(true);
  };

  const handleThresholdModalClose = () => {
    setShowThresholdModal(false);
    setSelectedPatient(null);
  };

  const handleThresholdSaveSuccess = () => {
    setSuccessMessage('Patient thresholds updated successfully');
    fetchPatients(); // Refresh patient list
  };

  const handleShowCreateModal = () => {
    setFormData({
      employee_id: '',
      password: '',
      role: 'nurse',
      first_name: '',
      last_name: '',
      email: '',
    });
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setFormData({
      employee_id: '',
      password: '',
      role: 'nurse',
      first_name: '',
      last_name: '',
      email: '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.employee_id.trim()) {
      setError('Employee ID is required');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const newUser = await userAPI.createUser(formData);
      
      setSuccessMessage(`User ${newUser.employee_id} created successfully with role: ${newUser.role}`);
      setUsers(prev => [...prev, newUser]);
      handleCloseCreateModal();
      
      // Refresh the list to ensure consistency
      fetchUsers();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getRoleBadgeVariant = (role: UserRole): string => {
    switch (role) {
      case 'admin':
        return 'danger';
      case 'nurse':
        return 'primary';
      case 'intake':
        return 'info';
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string): string => {
    return status === 'active' ? 'success' : 'secondary';
  };

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>Admin Dashboard</h2>
              <p className="text-muted mb-0">User Management System</p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <Badge bg="danger" className="px-3 py-2">
                <i className="bi bi-shield-lock-fill me-2"></i>
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

      {/* User Management Card */}
      <Row>
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center bg-dark text-white">
              <div>
                <i className="bi bi-people-fill me-2"></i>
                User Management
              </div>
              <Button variant="success" size="sm" onClick={handleShowCreateModal}>
                <i className="bi bi-person-plus-fill me-2"></i>
                Create New User
              </Button>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                  <p className="mt-3">No users found</p>
                </div>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Employee ID</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id}>
                        <td>{u.user_id}</td>
                        <td>
                          <strong>{u.employee_id}</strong>
                        </td>
                        <td>
                          <Badge bg={getRoleBadgeVariant(u.role)}>
                            {u.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={getStatusBadgeVariant(u.status)}>
                            {u.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td>{new Date(u.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              
              <div className="mt-3 text-muted">
                <small>
                  <i className="bi bi-info-circle me-2"></i>
                  Total Users: {users.length}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Patient Management Section */}
      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center bg-primary text-white">
              <div>
                <i className="bi bi-heart-pulse-fill me-2"></i>
                Patient Management
              </div>
              <Button variant="light" size="sm" onClick={fetchPatients}>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh
              </Button>
            </Card.Header>
            <Card.Body>
              {patientsLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Loading patients...</p>
                </div>
              ) : patients.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                  <p className="mt-3">No active patients found</p>
                </div>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Patient ID</th>
                      <th>Name</th>
                      <th>Room</th>
                      <th>Sensor ID</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.patient_id}>
                        <td>
                          <strong>{patient.patient_id}</strong>
                        </td>
                        <td>{patient.name}</td>
                        <td>
                          <Badge bg="info">{patient.room_number}</Badge>
                        </td>
                        <td>
                          {patient.sensor_id ? (
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              {patient.sensor_id}
                            </span>
                          ) : (
                            <span className="text-muted">No sensor</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={patient.status === 'active' ? 'success' : 'secondary'}>
                            {patient.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleConfigureThresholds(patient)}
                          >
                            <i className="bi bi-sliders me-1"></i>
                            Configure Thresholds
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              
              <div className="mt-3 text-muted">
                <small>
                  <i className="bi bi-info-circle me-2"></i>
                  Total Active Patients: {patients.length}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Threshold Configuration Modal */}
      {selectedPatient && (
        <ThresholdConfigModal
          show={showThresholdModal}
          onHide={handleThresholdModalClose}
          patientId={selectedPatient.patient_id}
          patientName={selectedPatient.name}
          onSuccess={handleThresholdSaveSuccess}
        />
      )}

      {/* Create User Modal */}
      <Modal show={showCreateModal} onHide={handleCloseCreateModal} centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>
            <i className="bi bi-person-plus-fill me-2"></i>
            Create New User
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateUser}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Employee ID <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="employee_id"
                placeholder="e.g., 200010, 300005"
                value={formData.employee_id}
                onChange={handleInputChange}
                required
                autoFocus
              />
              <Form.Text className="text-muted">
                Must be unique. Format: 6-digit number (200XXX for nurses, 300XXX for intake)
              </Form.Text>
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>First Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="first_name"
                    placeholder="Optional"
                    value={formData.first_name}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="last_name"
                    placeholder="Optional"
                    value={formData.last_name}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                placeholder="user@hospital.com (optional)"
                value={formData.email}
                onChange={handleInputChange}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Password <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
              />
              <Form.Text className="text-muted">
                Minimum 6 characters. User can change later.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Role <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                <option value="nurse">Nurse - Dashboard access only</option>
                <option value="intake">Intake - Patient management</option>
                <option value="admin">Admin - Full system access</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Defines user permissions in the system
              </Form.Text>
            </Form.Group>

            <Alert variant="info">
              <i className="bi bi-info-circle-fill me-2"></i>
              <small>
                New users will be able to log in immediately with these credentials.
              </small>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseCreateModal} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle-fill me-2"></i>
                  Create User
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}
