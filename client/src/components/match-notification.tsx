import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Profile } from "@shared/schema";
import { Heart } from "lucide-react";

interface MatchNotificationProps {
  profile: Profile;
  onClose: () => void;
  onStartChat: () => void;
}

export function MatchNotification({
  profile,
  onClose,
  onStartChat,
}: MatchNotificationProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Heart className="w-6 h-6 text-red-500" />
              It's a Match!
              <Heart className="w-6 h-6 text-red-500" />
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-32 h-32 rounded-full object-cover"
          />
          <h3 className="text-xl font-semibold">
            You and {profile.name} liked each other!
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Keep Swiping
            </Button>
            <Button onClick={onStartChat}>Start Chat</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
