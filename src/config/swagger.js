import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Virtual Patient Simulation API',
    version: '1.0.0',
    description: 'Comprehensive API documentation for the Virtual Patient Simulation backend system. This API provides endpoints for authentication, simulation management, user management, and educational content delivery.',
    contact: {
      name: 'API Support',
      email: 'support@virtualpatientsimulation.com'
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
    }
  },
  servers: [
    {
  url: 'http://localhost:5001',
      description: 'Local development server'
    },
    {
      url: 'https://simulator-l9qx.onrender.com',
      description: 'Production server on Render'
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints'
    },
    {
      name: 'Users',
      description: 'User management and profile operations'
    },
    {
      name: 'Simulation',
      description: 'Virtual patient simulation management'
    },
    {
      name: 'Progress',
      description: 'Student progress tracking and analytics'
    },
    {
      name: 'Admin',
      description: 'Administrative operations and system management'
    },
    {
      name: 'Cases',
      description: 'Medical case management and workflow'
    },
    {
      name: 'Analytics',
      description: 'Learning analytics and performance metrics'
    },
    {
      name: 'Feedback',
      description: 'Feedback and review system'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      AuditLog: {
        type: 'object',
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          event: {
            type: 'string'
          },
          userId: {
            type: 'string'
          },
          username: {
            type: 'string'
          },
          ip: {
            type: 'string'
          },
          userAgent: {
            type: 'string'
          },
          path: {
            type: 'string'
          },
          method: {
            type: 'string'
          },
          metadata: {
            type: 'object'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: 'Error description'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            example: 'johndoe'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john.doe@example.com'
          },
          password: {
            type: 'string',
            format: 'password',
            example: 'password123'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Login successful'
          },
          token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          },
          user: {
            type: 'object',
            properties: {
              _id: {
                type: 'string',
                example: '507f1f77bcf86cd799439011'
              },
              username: {
                type: 'string',
                example: 'johndoe'
              },
              email: {
                type: 'string',
                example: 'john.doe@example.com'
              },
              primaryRole: {
                type: 'string',
                example: 'student'
              },
              discipline: {
                type: 'string',
                example: 'medicine'
              }
            }
          },
          expiresIn: {
            type: 'string',
            example: '7d'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string' },
          primaryRole: { type: 'string' },
          discipline: { type: 'string' }
        }
      },
      WorkflowStep: {
        type: 'object',
        properties: {
          stepId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          requiredFields: { type: 'array', items: { type: 'string' } },
          completed: { type: 'boolean' },
          validationRules: { type: 'object' }
        }
      },
      StepValidationResult: {
        type: 'object',
        properties: {
          valid: { type: 'boolean' },
          errors: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } }
        }
      },
      CaseDraft: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string' },
          discipline: { type: 'string' },
          status: { type: 'string' },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/WorkflowStep' }
          },
          collaborators: {
            type: 'array',
            items: { $ref: '#/components/schemas/Collaborator' }
          }
        }
      },
      Collaborator: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          accessLevel: { type: 'string' },
          joinedAt: { type: 'string', format: 'date-time' }
        }
      },
      PaginatedTemplates: {
        type: 'object',
        properties: {
          templates: { type: 'array', items: { $ref: '#/components/schemas/CaseTemplate' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        }
      },
      CaseTemplate: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          discipline: { type: 'string' },
          usageCount: { type: 'integer' }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          pages: { type: 'integer' }
        }
      }
    }
  }
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/routes/**/*.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

// Swagger UI setup
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Virtual Patient Simulation API Documentation'
};

export { swaggerSpec, swaggerUi, swaggerUiOptions };