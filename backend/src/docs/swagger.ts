import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kanban Board Collaborative API',
      version: '1.0.0',
      description: 'Production-ready REST and WebSocket endpoints for the Collaborative Kanban board application.',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
        description: 'Target API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [], // Swagger docs are annotated dynamically or can be self-described. We will write definitions statically in options.
};

// We will document basic entities to keep it simple, clean and structured.
options.definition!.paths = {
  '/api/auth/register': {
    post: {
      summary: 'Register new user',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                password: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['email', 'password', 'name'],
            },
          },
        },
      },
      responses: {
        201: { description: 'Registration successful' },
        400: { description: 'Validation failed' },
      },
    },
  },
  '/api/auth/login': {
    post: {
      summary: 'Authenticate and login user',
      tags: ['Authentication'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                password: { type: 'string' },
              },
              required: ['email', 'password'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Login successful' },
        401: { description: 'Invalid email or password' },
      },
    },
  },
  '/api/workspaces': {
    get: {
      summary: 'Get all workspaces for authenticated user',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Success' },
      },
    },
    post: {
      summary: 'Create a new workspace',
      tags: ['Workspaces'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
              required: ['name'],
            },
          },
        },
      },
      responses: {
        201: { description: 'Created' },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
export { swaggerSpec };
