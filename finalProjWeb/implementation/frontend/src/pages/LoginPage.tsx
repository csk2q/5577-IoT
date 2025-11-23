import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, getErrorMessage } from '../services/api';

const LoginPage = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!employeeId || !password) {
      setError('Please enter both employee ID and password');
      return;
    }

    if (employeeId.length !== 6 || !/^\d{6}$/.test(employeeId)) {
      setError('Employee ID must be exactly 6 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login({ employee_id: employeeId, password });
      
      // Update auth context (which also stores in localStorage)
      login(response.token, response.user as any);
      
      // Redirect based on user role
      switch (response.user.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'intake':
          navigate('/intake');
          break;
        case 'nurse':
          navigate('/dashboard');
          break;
        default:
          navigate('/dashboard');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100 justify-content-center">
        <Col xs={12} sm={10} md={8} lg={6} xl={4}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary">IoT Nursing Station</h2>
                <p className="text-muted">Patient Monitoring Dashboard</p>
              </div>

              {error && (
                <Alert variant="danger" dismissible onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Employee ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter 6-digit employee ID"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    maxLength={6}
                    autoFocus
                    disabled={loading}
                  />
                  <Form.Text className="text-muted">
                    Enter your 6-digit employee identification number
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </Form.Group>

                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>

              <div className="text-center mt-3">
                <small className="text-muted">
                  Authorized personnel only. All access is logged.
                </small>
              </div>
            </Card.Body>
          </Card>

          <div className="text-center mt-3">
            <small className="text-muted">
              <strong>Test Accounts:</strong><br />
              Admin: 100000 / admin123<br />
              Nurse: 200000 / nurse123<br />
              Intake: 300000 / intake123
            </small>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginPage;
