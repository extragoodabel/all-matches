import { useState } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@/components/splash-screen";
import Home from "@/pages/home";
import Chat from "@/pages/chat";
import Inbox from "@/pages/inbox";
import DesignPreview from "@/pages/design";
import TagImages from "@/pages/tag-images";
import NotFound from "@/pages/not-found";

const SPLASH_SESSION_KEY = "seenSplash";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/chat/:id" component={Chat} />
      <Route path="/design" component={DesignPreview} />
      <Route path="/tag-images" component={TagImages} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_SESSION_KEY);
    } catch {
      return true;
    }
  });

  const handleSplashComplete = () => {
    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
    } catch {}
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {showSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
