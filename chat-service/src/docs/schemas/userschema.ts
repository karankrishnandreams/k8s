export const userCreateRequestSchema = {
  type: 'object',
  required: ['userName', 'email', 'password', 'confirm_password'],
  properties: {
    userName: { type: 'string', example: 'johndoe' },
    email: { type: 'string', format: 'email', example: 'john@example.com' },
    password: { type: 'string', format: 'password', example: 'strongPassword123' },
    confirm_password: { type: 'string', format: 'password', example: 'strongPassword123' },
    workSpace: { type: 'string', example: 'myWorkspace' },
  },
};

export const userSchema = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '68392f9fd07655e9b2b1d40e' },
    userName: { type: 'string', example: 'johndoe' },
    email: { type: 'string', format: 'email', example: 'john@example.com' },
    isDefaultGlobalAdmin: { type: 'boolean', example: true },
    workSpace: { type: 'string', example: 'myWorkspace' },
    createdAt: { type: 'string', format: 'date-time', example: '2025-05-30T04:10:07.635Z' },
    updatedAt: { type: 'string', format: 'date-time', example: '2025-05-30T04:10:07.635Z' },
  },
  required: ['_id', 'userName', 'email', 'isDefaultGlobalAdmin', 'workSpace', 'createdAt', 'updatedAt'],
};
