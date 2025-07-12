# Frontend API Integration Instructions

## API Endpoint Structure

All backend API endpoints are prefixed with `/api`. Please ensure all your API calls include this prefix.

## Authentication Endpoints

| Endpoint | HTTP Method | Description |
|----------|-------------|-------------|
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/login` | POST | Authenticate user and get token |

## User/Queue Endpoints

All user-related endpoints are under `/api/users/`:

| Endpoint | HTTP Method | Description |
|----------|-------------|-------------|
| `/api/users/queue/session/start` | POST | Initialize or Resume Queue Session |
| `/api/users/queue/session/:sessionId/next` | POST | Get Next Case in Queue Session |
| `/api/users/cases/:originalCaseIdString/status` | POST | Mark Case Interaction Status |

## Simulation Endpoints

All simulation-related endpoints are under `/api/simulation/`:

| Endpoint | HTTP Method | Description |
|----------|-------------|-------------|
| `/api/simulation/start` | POST | Start a simulation |
| `/api/simulation/ask` | POST | Ask a question in a simulation |
| `/api/simulation/cases` | GET | Get available cases |

## Example API Call (using fetch)

```javascript
// Login example
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

## Example API Call (using axios)

```javascript
// Login example with axios
async function login(email, password) {
  try {
    const response = await axios.post('/api/auth/login', {
      email,
      password,
    });
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}
```

## Common Issues

1. Missing `/api` prefix in API URLs
2. Incorrect endpoint paths
3. Missing or incorrect Content-Type headers

## Note on Current Backend Changes

We've added a temporary redirect from `/auth/login` to `/api/auth/login` to maintain backward compatibility, but all frontend code should be updated to use the correct `/api/auth/login` endpoint directly.