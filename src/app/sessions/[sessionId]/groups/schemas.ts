import { z } from 'zod';

const savedGroupSchema = z.object({
  id: z.string().uuid('Invalid group id'),
  name: z.string().trim().min(1, 'Group name is required'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity is required' })
    .int('Capacity must be a whole number')
    .positive('Capacity must be greater than 0'),
  memberIds: z.array(z.string().uuid('Invalid student id'))
});

export const savedGroupsPayloadSchema = z.object({
  groups: z.array(savedGroupSchema).min(1, 'At least one group is required')
});
