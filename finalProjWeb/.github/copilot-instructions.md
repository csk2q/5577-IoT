# GitHub Copilot Instructions - IoT Web Dashboard Project

## Project Overview
This is a web-based IoT dashboard application for monitoring and managing IoT sensor data in real-time.

## Tech Stack
- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: MySQL
- **Real-time Communication**: Server-Sent Events
- **Styling**: Bootstrap and custom CSS when necessary

## Coding Standards

### General Principles
- Write clean, readable, and maintainable code
- Follow DRY (Don't Repeat Yourself) principle
- Use meaningful variable and function names
- Add comments for complex logic only
- Handle errors gracefully with proper error messages
- Favor simplicity over cleverness
- Favor composition over inheritance

### TypeScript/JavaScript
- Use TypeScript for type safety
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw promises
- Use functional programming patterns where appropriate
- Destructure objects and arrays for cleaner code

### React
- Use functional components with hooks
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use proper prop types and interfaces
- Implement proper error boundaries

### File Structure
- Components in `/src/components`
- Custom hooks in `/src/hooks`
- Utilities in `/src/utils`
- API calls in `/src/api` or `/src/services`
- Types/interfaces in `/src/types`

### Naming Conventions
- Components: PascalCase (e.g., `SensorDashboard.tsx`)
- Files: camelCase or kebab-case consistently
- Variables/Functions: camelCase (e.g., `sensorData`, `fetchSensorData`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- Interfaces/Types: PascalCase with 'I' prefix optional (e.g., `SensorData` or `ISensorData`)

## IoT-Specific Guidelines

### Data Handling
- Always validate sensor data before processing
- Handle missing or null sensor readings gracefully
- Implement data throttling for high-frequency sensor updates
- Use appropriate data structures for time-series data

### Security
- Never expose API keys or sensitive credentials in frontend code
- Implement proper authentication and authorization
- Validate and sanitize all user inputs
- Use HTTPS for all communications

### Performance
- Implement efficient real-time data updates (avoid unnecessary re-renders)
- Use pagination or virtualization for large datasets
- Cache sensor data when appropriate
- Optimize database queries

## Testing
- Write unit tests for utility functions and hooks
- Write integration tests for API endpoints
- Test edge cases (disconnections, invalid data, etc.)
- Aim for meaningful test coverage, not just high percentages

## Documentation
- Document all public APIs and interfaces
- Include JSDoc comments for complex functions
- Keep README.md updated with setup and usage instructions
- Document environment variables and configuration

## Error Handling
- Use try-catch blocks for async operations
- Provide user-friendly error messages
- Log errors appropriately for debugging
- Implement fallback UI states for errors

## Git Workflow
- Write clear, descriptive commit messages
- Keep commits atomic and focused
- Use feature branches for new development
- Review code before merging

## Notes
- Prioritize user experience and responsiveness
- Consider mobile/tablet views in design
- Plan for scalability (handling multiple devices/sensors)
- Keep accessibility (a11y) in mind

---

**Last Updated**: November 22, 2025
