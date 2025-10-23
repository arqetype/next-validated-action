'use server';

import { action } from '@arqetype/next-validated-action';
import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

class SignUpInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class SignUpOutput {
  @IsString()
  userId: string;

  @IsString()
  message: string;
}

export const signUpAction = action
  .inputDto(SignUpInput)
  .outputDto(SignUpOutput)
  .action(async ({ parsedInput }) => {
    const user = await createUser({
      name: parsedInput.name,
      email: parsedInput.email,
      password: parsedInput.password,
    });

    return {
      userId: user.id,
      message: 'User created successfully',
    };
  });

async function createUser(_data: {
  name: string;
  email: string;
  password: string;
}) {
  return { id: '123' };
}
