import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

type Gender = "male" | "female" | "other";

interface ImageTag {
  id: string;
  currentGender: Gender;
  newGender?: Gender;
}

export default function TagImagesPage() {
  const [tags, setTags] = useState<Record<string, Gender>>({});
  const [filter, setFilter] = useState<Gender | "all">("all");
  const [saving, setSaving] = useState(false);

  const { data: images, isLoading } = useQuery<{ id: string; gender: Gender }[]>({
    queryKey: ["/api/admin/images"],
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, Gender>) => {
      return apiRequest("POST", "/api/admin/images/tags", { tags: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/images"] });
      setTags({});
    },
  });

  const handleTag = (imageId: string, gender: Gender) => {
    setTags((prev) => ({ ...prev, [imageId]: gender }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveMutation.mutateAsync(tags);
    setSaving(false);
  };

  const buildImageUrl = (id: string) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=300&q=80`;

  const filteredImages = images?.filter(
    (img) => filter === "all" || (tags[img.id] || img.gender) === filter
  );

  const changedCount = Object.keys(tags).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Tag Images</h1>
            <span className="text-gray-500">({images?.length || 0} total)</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {(["all", "male", "female", "other"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            
            {changedCount > 0 && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save {changedCount} changes
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {filteredImages?.map((img) => {
            const currentTag = tags[img.id] || img.gender;
            const isChanged = tags[img.id] !== undefined;
            
            return (
              <div
                key={img.id}
                className={`relative rounded-lg overflow-hidden shadow-md ${
                  isChanged ? "ring-4 ring-green-500" : ""
                }`}
              >
                <img
                  src={buildImageUrl(img.id)}
                  alt=""
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                  <div className="flex gap-1 justify-center">
                    {(["male", "female", "other"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => handleTag(img.id, g)}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          currentTag === g
                            ? g === "male"
                              ? "bg-blue-500 text-white"
                              : g === "female"
                              ? "bg-pink-500 text-white"
                              : "bg-purple-500 text-white"
                            : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                        }`}
                      >
                        {g === "male" ? "M" : g === "female" ? "F" : "O"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
