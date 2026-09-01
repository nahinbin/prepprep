import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/NavMenu";
import { updateProfile } from "@/app/actions/user";
import { User, Mail, Link as LinkIcon, Shield, Lock, Eye } from "lucide-react";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
  });

  if (!dbUser) redirect("/login");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Settings</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage your account and profile preferences.</p>
        </div>

        <form action={updateProfile} className="space-y-6">
          <div className="p-5 md:p-7 rounded-3xl bg-card border-2 border-border shadow-sm space-y-6">
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Public Profile
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Username</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    name="username"
                    defaultValue={dbUser.username}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Display Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    name="name"
                    defaultValue={dbUser.name || ""}
                    placeholder="e.g. John Doe"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Bio</label>
                <textarea
                  name="bio"
                  defaultValue={dbUser.bio || ""}
                  placeholder="Tell everyone a little about yourself"
                  className="w-full p-4 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-medium min-h-[100px] resize-y mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Profile Picture URL</label>
                <div className="relative mt-1">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    name="profilePicture"
                    defaultValue={dbUser.profilePicture || ""}
                    placeholder="https://..."
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-medium text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 md:p-7 rounded-3xl bg-card border-2 border-border shadow-sm space-y-6">
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Account & Privacy
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Email Address</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    name="email"
                    defaultValue={dbUser.email || ""}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-border/50 bg-muted/30">
                <div className="space-y-1 pr-4">
                  <label className="font-bold text-foreground flex items-center gap-2">
                    {dbUser.isPublic ? <Eye className="w-4 h-4 text-primary" /> : <Lock className="w-4 h-4 text-danger" />}
                    Public Profile
                  </label>
                  <p className="text-xs font-medium text-muted-foreground">
                    Allow anyone to see your profile and appear on leaderboards. Private profiles are only visible to friends.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" name="isPublic" value="true" defaultChecked={dbUser.isPublic} className="sr-only peer" />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Save Changes
          </button>
        </form>
      </div>
    </AppShell>
  );
}
