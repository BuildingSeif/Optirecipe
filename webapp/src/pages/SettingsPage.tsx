import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassButton } from "@/components/ui/glass-button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { User, Mail, LogOut, Camera, Loader2, Check } from "lucide-react";


export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
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
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.raw("/api/user/avatar", {
        method: "POST",
        body: formData,
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
    <DashboardLayout
      title="Parametres"
      subtitle="Gerez votre profil et votre compte"
      breadcrumbs={[
        { label: "Accueil", href: "/dashboard" },
        { label: "Parametres" },
      ]}
    >
      <div className="max-w-2xl space-y-6">
        {/* Profile Section */}
        <div className="ct-card p-6 rounded-xl">
          <div className="mb-5">
            <h2 className="text-white text-lg font-semibold font-heading">Profil</h2>
            <p className="text-white/45 text-sm mt-0.5">Modifiez vos informations personnelles</p>
          </div>

          {/* Profile Picture */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={user?.name || "Profile"}
                  className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-2 ring-white/10">
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
              <p className="text-white font-medium text-sm">Photo de profil</p>
              <p className="text-xs text-white/40 mt-0.5">Cliquez sur l'icone pour changer</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-white/60 text-xs font-medium uppercase tracking-wider">Nom</label>
              <div className="ct-input flex items-center gap-3 rounded-xl px-4">
                <User className="h-4 w-4 text-white/40 shrink-0" />
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
              <label htmlFor="email" className="text-white/60 text-xs font-medium uppercase tracking-wider">Email</label>
              <div className="ct-input flex items-center gap-3 rounded-xl px-4 opacity-60">
                <Mail className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="flex-1 bg-transparent border-none outline-none text-white/50 py-3 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-white/30">L'email ne peut pas etre modifie</p>
            </div>

            {hasChanges && (
              <div className="pt-2">
                <GlassButton
                  onClick={handleSave}
                  disabled={isLoading || !name.trim()}
                  variant="primary"
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
                </GlassButton>
              </div>
            )}

            {updateProfileMutation.isSuccess && !hasChanges ? (
              <p className="text-emerald-400 text-sm flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Modifications enregistrees
              </p>
            ) : null}
          </div>
        </div>

        {/* Account Section */}
        <div className="ct-card p-6 rounded-xl">
          <div className="mb-5">
            <h2 className="text-white text-lg font-semibold font-heading">Compte</h2>
            <p className="text-white/45 text-sm mt-0.5">Gerez votre session</p>
          </div>
          <GlassButton
            variant="destructive"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Se deconnecter
          </GlassButton>
        </div>

        {/* About Section */}
        <div className="ct-card p-6 rounded-xl">
          <div className="mb-5">
            <h2 className="text-white text-lg font-semibold font-heading">A propos</h2>
          </div>
          <div className="text-sm text-white/50 space-y-2">
            <p>
              <strong className="text-white/80">OptiRecipe</strong> est un outil professionnel d'extraction de recettes
              pour la restauration collective.
            </p>
            <p>
              Developpe par <strong className="text-white/80">OptiMenu</strong> pour le systeme 1000CHEFS.
            </p>
            <p className="text-xs text-white/30 pt-1">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
