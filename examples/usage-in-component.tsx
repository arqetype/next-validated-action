import { signUpAction } from './actions/sign-up';

async function handleSignUp(formData: FormData) {
  const result = await signUpAction({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (result.success) {
    console.log('User created:', result.data.userId);
    console.log('Message:', result.data.message);
  } else {
    console.error('Error:', result.error, result.message);
  }
}
