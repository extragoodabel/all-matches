import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ProfileCard } from "@/components/profile-card";
import type { Profile } from "@shared/schema";

interface ProfileCardModalProps {
  profileId: number;
  onClose: () => void;
}

export function ProfileCardModal({ profileId, onClose }: ProfileCardModalProps) {
  const [visible, setVisible] = useState(false);

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${profileId}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: profileId > 0,
  });

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ transition: "opacity 200ms ease", opacity: visible ? 1 : 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      <div className="relative w-full max-w-sm z-10">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 w-10 h-10 rounded-full bg-white flex items-center justify-center eg-outline-thick eg-shadow-offset-sm hover:translate-x-[1px] hover:translate-y-[1px] transition-transform"
        >
          <X className="w-5 h-5" />
        </button>

        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center eg-outline-thick">
            <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto" />
          </div>
        ) : profile ? (
          <ProfileCard profile={profile} />
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center eg-outline-thick">
            <p className="font-bold">Profile not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
