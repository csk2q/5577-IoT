# Frontend - IoT Nursing Station Dashboard

React + TypeScript + Bootstrap frontend for the IoT Nursing Station Dashboard.

## Directory Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components (routes)
│   ├── services/       # API service layer
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React Context providers
│   │   └── AuthContext.tsx
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/          # Utility functions
│   ├── routes/         # Route configuration
│   │   └── AppRoutes.tsx
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # App entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Development Guidelines

### Component Structure

```tsx
import { FC } from 'react';

interface ComponentProps {
  // Define props
}

const Component: FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Component logic
  
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
};

export default Component;
```

### Using Bootstrap

```tsx
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

const Example = () => {
  return (
    <Container>
      <Row>
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>Title</Card.Title>
              <Card.Text>Content</Card.Text>
              <Button variant="primary">Action</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
```

### API Calls

```tsx
import apiClient from '@/services/api';
import { ApiResponse, Patient } from '@/types';

const fetchPatients = async () => {
  try {
    const response = await apiClient.get<ApiResponse<Patient[]>>('/patients');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }
};
```

### Custom Hooks Example

```tsx
import { useState, useEffect } from 'react';

export const usePatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch patients
  }, []);

  return { patients, loading, error };
};
```

### Server-Sent Events

```tsx
import { useEffect } from 'react';

const useSensorStream = () => {
  useEffect(() => {
    const token = localStorage.getItem('token');
    const eventSource = new EventSource(
      `${API_BASE_URL}/stream/sensor-data?token=${token}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle data
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);
};
```

## Component Checklist

### To Be Implemented by UI Developer:

#### Authentication
- [ ] Login form component
- [ ] Password validation
- [ ] Error display

#### Dashboard
- [ ] Patient grid layout
- [ ] Patient card component
- [ ] Sorting controls (room, name, ID)
- [ ] Real-time data updates via SSE

#### Patient Card
- [ ] Patient information display
- [ ] Current readings (O2, heart rate)
- [ ] Spark line graphs (last 20 readings)
- [ ] Alert state visualization
- [ ] Critical alert animation

#### Admin
- [ ] User list component
- [ ] User creation form
- [ ] User management actions (enable/disable)
- [ ] Password reset trigger

#### Patient Intake
- [ ] Patient intake form
- [ ] Sensor assignment
- [ ] Form validation

#### Alert Configuration
- [ ] Threshold configuration form
- [ ] Per-patient settings
- [ ] Range validation

## Testing

Run tests:
```bash
npm test
```

Type checking:
```bash
npm run type-check
```

Linting:
```bash
npm run lint
```

## Build for Production

```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Bootstrap Customization

Custom CSS variables are defined in `src/index.css`. Modify these to match healthcare design requirements:

```css
:root {
  --bs-primary: #0d6efd;
  --bs-danger: #dc3545;
  --bs-warning: #ffc107;
  --bs-success: #198754;
}
```

## Next Steps for UI Developer

1. Implement login page and authentication flow
2. Create patient dashboard grid layout
3. Develop patient card component with real-time updates
4. Implement spark line graphs using Chart.js
5. Add alert visualization and animations
6. Create admin user management interface
7. Build patient intake form
8. Implement alert threshold configuration
9. Add responsive design for tablet/mobile
10. Write component tests

---

**Assigned to:** Senior UI Developer
