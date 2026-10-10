import { ShieldOff } from "lucide-react";

export default function NoAccess() {
  return (
    <div className="card mx-auto mt-16 max-w-md p-8 text-center">
      <ShieldOff className="mx-auto h-10 w-10 text-faint" />
      <h1 className="mt-4 text-lg font-semibold">Ruxsat yo&apos;q</h1>
      <p className="mt-2 text-sm text-muted">
        Bu bo&apos;limni ko&apos;rish uchun rolingizda ruxsat yo&apos;q. Kerak bo&apos;lsa, administratorga murojaat qiling.
      </p>
    </div>
  );
}
