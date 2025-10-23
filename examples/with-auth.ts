'use server';

import { action } from '@arqetype/next-validated-action';
import { IsString, IsNotEmpty } from 'class-validator';

class UpdateProfileInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  bio?: string;
}

class UpdateProfileOutput {
  @IsString()
  message: string;
}

async function getCurrentUser() {
  return { id: '123', email: 'user@example.com' };
}

export const updateProfileAction = action
  .inputDto(UpdateProfileInput)
  .outputDto(UpdateProfileOutput)
  .needsAuth(getCurrentUser)
  .action(async ({ parsedInput, user }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await updateUserProfile(user.id, parsedInput);

    return {
      message: 'Profile updated successfully',
    };
  });

async function updateUserProfile(userId: string, data: UpdateProfileInput) {
  console.warn('Updating user', userId, 'with', data);
}
