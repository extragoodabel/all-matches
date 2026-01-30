import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { type Profile } from "@shared/schema";

interface ProfileCardProps {
  profile: Profile;
  onImageError?: () => void;
}

const FALLBACK_IMAGE = "/images/fallback.png";

export function ProfileCard({ profile, onImageError }: ProfileCardProps) {
  const [imageSrc, setImageSrc] = useState(profile.imageUrl);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(FALLBACK_IMAGE);
      // Notify parent to skip this profile
      onImageError?.();
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto bg-white rounded-xl overflow-hidden shadow-lg select-none">
      <div className="relative aspect-[3/4]">
        <img
          src={imageSrc}
          alt={profile.name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ 
            WebkitUserDrag: "none",
            userSelect: "none",
            pointerEvents: "none",
          } as React.CSSProperties}
          onDragStart={(e) => e.preventDefault()}
          onError={handleImageError}
        />
      </div>
      <CardContent className="p-4">
        <h2 className="text-2xl font-bold">
          {profile.name}, {profile.age}
        </h2>
        <p className="mt-2 text-gray-600">{profile.bio}</p>
      </CardContent>
    </Card>
  );
}
