import { AuthGate } from '@/components/AuthGate';
import { AppShell } from '@/components/AppShell';

export default function Page() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
