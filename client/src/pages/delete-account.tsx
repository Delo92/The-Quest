import { Link } from "wouter";
import SiteNavbar from "@/components/site-navbar";
import SiteFooter from "@/components/site-footer";
import DeleteAccountSettings from "@/components/delete-account-settings";
import { useAuth } from "@/hooks/use-auth";

export default function DeleteAccountPage() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <div className="min-h-[100dvh] bg-[#111113] text-white">
      <SiteNavbar />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-32">
        <h1 className="text-2xl font-semibold">Delete your Quest account</h1>
        <p className="mt-3 text-sm text-white/65">
          Sign in to permanently delete your account and the profile and competition entries attached to it.
        </p>
        <div className="mt-6">
          {isLoading ? null : isAuthenticated ? (
            <DeleteAccountSettings />
          ) : (
            <Link href="/login?returnTo=/delete-account" className="inline-flex min-h-11 items-center rounded-md bg-[#FF5A09] px-6 text-sm font-semibold text-white">
              Sign in to continue
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
