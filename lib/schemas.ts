import { z } from 'zod';

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  ai_name: z.string().trim().min(1).max(40).default('Baochat'),
  style: z.enum(['serious', 'casual', 'funny', 'playful']).default('casual'),
  humor_level: z.number().int().min(0).max(100).default(50),
  address_style: z.string().max(300).default(''),
  default_lang: z.enum(['auto', 'vi', 'en']).default('auto'),
  custom_instructions: z.string().max(2000).default(''),
  interests: z.string().max(800).default(''),
});
