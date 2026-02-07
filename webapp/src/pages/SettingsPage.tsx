import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession, signOut } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { User, Mail, LogOut, Camera, Loader2, Check } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name || "");
  const [imagePreview, setImagePreview] = useState<string | null>(user?.image || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update state when user data loads
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setImagePreview(user.image || null);
    }
  }, [user]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; image?: string }) => {
      return api.patch("/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      setHasChanges(false);
      setImageFile(null);
      // Force refresh session
      window.location.reload();
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
      setHasChanges(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    setHasChanges(newName !== user?.name || imageFile !== null);
  };

  const handleSave = async () => {
    let imageUrl = user?.image || undefined;

    // Upload image if selected
    if (imageFile) {
      try {
        imageUrl = await uploadImageMutation.mutateAsync(imageFile);
      } catch (error) {
        console.error("Image upload failed:", error);
      }
    }

    updateProfileMutation.mutate({
      name: name.trim(),
      image: imageUrl,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const isLoading = updateProfileMutation.isPending || uploadImageMutation.isPending;

  return (
    <DashboardLayout title="Parametres">
      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">Profil</h2>
            <p className="text-white/60">Modifiez vos informations personnelles</p>
          </div>

          {/* Profile Picture */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={user?.name || "Profile"}
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-white font-bold text-xl">{initials}</span>
                </div>
              )}
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
            <div>
              <p className="text-white font-medium">Photo de profil</p>
              <p className="text-sm text-white/50">Cliquez sur l'icone pour changer</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-white/80 text-sm font-medium">Nom</label>
              <div className="glass-card-static flex items-center gap-3 rounded-xl px-4">
                <User className="h-4 w-4 text-primary" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/40 py-3"
                  placeholder="Votre nom"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-white/80 text-sm font-medium">Email</label>
              <div className="glass-card-static flex items-center gap-3 rounded-xl px-4">
                <Mail className="h-4 w-4 text-primary" />
                <input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="flex-1 bg-transparent border-none outline-none text-white/50 py-3 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-white/40">L'email ne peut pas etre modifie</p>
            </div>

            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={isLoading || !name.trim()}
                className="gradient-primary font-semibold shadow-lg shadow-primary/30"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Enregistrer les modifications
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Account */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">Compte</h2>
            <p className="text-white/60">Gerez votre session</p>
          </div>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="hover:scale-105 transition-transform duration-200"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se deconnecter
          </Button>
        </div>

        {/* About */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-white text-xl font-bold">A propos</h2>
          </div>
          <div className="text-sm text-white/60 space-y-2">
            <p>
              <strong className="text-white">OptiRecipe</strong> est un outil professionnel d'extraction de recettes
              pour la restauration collective.
            </p>
            <p>
              Developpe par <strong className="text-white">OptiMenu</strong> pour le systeme 1000CHEFS.
            </p>
            <p className="text-xs text-white/40">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
