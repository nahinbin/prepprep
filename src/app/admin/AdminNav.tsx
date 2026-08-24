import Link from "next/link";
import { adminLogout } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <div className="w-full max-w-5xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href}>
              <Button
                variant={active === tab.href ? "primary" : "outline"}
                size="sm"
                className="rounded-2xl font-bold"
              >
                {tab.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
      <form action={adminLogout}>
        <Button variant="ghost" size="sm" type="submit" className="text-danger hover:text-danger rounded-2xl">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </form>
    </div>
  );
}
