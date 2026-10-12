export async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Account connection timed out'), {code: 'account-timeout'})), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
