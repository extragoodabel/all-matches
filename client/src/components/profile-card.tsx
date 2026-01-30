import { Card, CardContent } from "@/components/ui/card";
import { type Profile } from "@shared/schema";

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <Card className="w-full max-w-sm mx-auto bg-white rounded-xl overflow-hidden shadow-lg select-none">
      <div className="relative aspect-[3/4]">
        <img
          src={profile.imageUrl}
          alt={profile.name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ 
            WebkitUserDrag: "none",
            userSelect: "none",
            pointerEvents: "none",
          } as React.CSSProperties}
          onDragStart={(e) => e.preventDefault()}
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
