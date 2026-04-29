import { fetchUnits } from "@/lib/sheet";
import AppShell from "@/components/AppShell";

export const revalidate = 30;

export default async function Page() {
  const payload = await fetchUnits();
  return <AppShell payload={payload} />;
}
