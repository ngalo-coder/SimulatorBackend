# Frontend Instructions for Forgot Password Feature

This document provides instructions for frontend developers to integrate the forgot password feature.

## 1. Forgot Password

To initiate the forgot password process, send a POST request to the following endpoint:

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

*   **200 OK:** If the email is valid and the user exists, a password reset token will be sent to the user's email address.

    ```json
    {
      "status": "success",
      "message": "Token sent to email!"
    }
    ```

*   **404 Not Found:** If the user with the given email does not exist.

    ```json
    {
      "message": "User not found."
    }
    ```

## 2. Reset Password

To reset the password, the user will click on a link in their email which will redirect them to a page on your frontend. This page should have a form with a new password and password confirmation fields.

The link in the email will look like this: `http://<your-frontend-url>/reset-password/<reset-token>`

You will need to extract the `reset-token` from the URL and send a PATCH request to the following endpoint:

**Endpoint:** `PATCH /api/auth/reset-password/:token`

**Request Body:**

```json
{
  "password": "newPassword123"
}
```

**Response:**

*   **200 OK:** If the token is valid and the password is reset successfully. The response will include a new JWT token.

    ```json
    {
      "message": "Password reset successful.",
      "data": {
        "token": "new-jwt-token",
        "user": {
          "id": "user-id",
          "username": "username",
          "email": "user@example.com",
          "role": "user"
        }
      }
    }
    ```

*   **400 Bad Request:** If the token is invalid or has expired.

    ```json
    {
      "message": "Token is invalid or has expired."
    }
    ```
# Existing API Integration Instructions

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