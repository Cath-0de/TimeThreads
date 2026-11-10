export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}
