import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center px-4">
        <div className="text-8xl font-serif font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-white/40 mb-8">The page you're looking for doesn't exist.</p>
        <Link href="/">
          <Button className="bg-gradient-to-r from-orange-500 to-amber-500 border-0 text-white" data-testid="button-go-home">
            <Trophy className="h-4 w-4 mr-2" /> Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
