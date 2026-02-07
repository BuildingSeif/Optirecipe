import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, User, Camera, Upload } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionLoading } = useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name || "");
  const [imagePreview, setImagePreview] = useState<string | null>(user?.image || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; image?: string }) => {
      return api.patch("/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/dashboard");
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/user/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Upload failed");
      }

      const result = await response.json();
      return result.data.url;
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    let imageUrl = imagePreview;

    // Upload image if selected
    if (imageFile) {
      try {
        imageUrl = await uploadImageMutation.mutateAsync(imageFile);
      } catch (error) {
        console.error("Image upload failed:", error);
        // Continue without image
      }
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      image: imageUrl || undefined,
    });
  };

  const isLoading = updateProfileMutation.isPending || uploadImageMutation.isPending;

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Spline 3D Background */}
      <div className="absolute inset-0 z-0">
        <iframe
          src="https://my.spline.design/celestialflowabstractdigitalform-ObUlVgj70g2y4bbx5vBKSfxN/"
          frameBorder="0"
          width="100%"
          height="100%"
          id="aura-spline"
          title="Background Animation"
          style={{ pointerEvents: "none" }}
        />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="p-8 rounded-2xl animate-slide-up backdrop-blur-xl bg-black/60 border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">
              Completez votre profil
            </h1>
            <p className="text-white/70 mt-2">
              Dites-nous comment vous appeler
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center">
              <div className="relative">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center cursor-pointer hover:from-primary/40 hover:to-accent/40 transition-all border-2 border-primary/30 overflow-hidden"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white/50" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/80 transition-colors"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>
            <p className="text-center text-xs text-white/50">
              Cliquez pour ajouter une photo (optionnel)
            </p>

            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80 font-medium">
                Votre nom
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 text-white placeholder:text-white/40 bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none transition-colors"
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            {updateProfileMutation.isError && (
              <p className="text-sm text-red-400 animate-fade-in">
                Une erreur est survenue. Veuillez reessayer.
              </p>
            )}

            <Button
              type="submit"
              className="gradient-primary w-full text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/30"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Continuer"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/80">
          OptiRecipe par OptiMenu &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
