import { StaffPinSetupForm } from "@/components/admin/StaffPinSetupForm";

export default async function StaffPinSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <StaffPinSetupForm token={token || ""} />;
}
