import { BookOpenCheck, LogOut, Loader2 } from 'lucide-react';
import { ModeToggle } from '../mode-toggle';
import { useAuth, useUser } from '@/firebase';
import { Button } from '../ui/button';

export default function Header() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:px-6 md:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              מורה מחליף
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isUserLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : user ? (
              <Button variant="ghost" size="icon" onClick={() => auth.signOut()}>
                <LogOut className="h-5 w-5" />
              </Button>
            ) : null}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
