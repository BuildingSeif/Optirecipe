import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  BookOpen,
  Globe,
  Check,
} from "lucide-react";
import type { Cookbook } from "../../../backend/src/types";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

type TabType = "pdf" | "ckbk" | "web";

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
      Bientôt disponible
    </span>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-300">
      <Check className="h-4 w-4 text-primary flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function CKBKTab() {
  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
        <BookOpen className="h-8 w-8 text-orange-500" />
      </div>

      {/* Badge */}
      <ComingSoonBadge />

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Import CKBK</h2>
        <p className="text-gray-400 max-w-md mx-auto">
          Importez directement depuis la base de données CKBK, la plus grande collection de livres de cuisine premium au monde. Les recettes en anglais seront automatiquement traduites et converties en grammes.
        </p>
      </div>

      {/* Disabled Preview */}
      <div className="glass-card-static p-6 rounded-xl space-y-4 opacity-50 pointer-events-none">
        <Input
          placeholder="https://app.ckbk.com/recipe/..."
          disabled
          className="bg-white/5 border-white/10 text-gray-500"
        />
        <Button disabled className="w-full">
          Importer
        </Button>
      </div>

      {/* Features */}
      <div className="glass-card-static p-6 rounded-xl text-left space-y-3">
        <FeatureItem text="Traduction automatique anglais → français" />
        <FeatureItem text="Conversion cups/oz → grammes" />
        <FeatureItem text="Import en lot (plusieurs recettes)" />
        <FeatureItem text="Reformulation automatique (droits d'auteur)" />
      </div>
    </div>
  );
}

function WebSitesTab() {
  const sites = [
    { name: "Elle à Table", initials: "ET", color: "bg-pink-500" },
    { name: "Saveurs", initials: "S", color: "bg-red-500" },
    { name: "Régal", initials: "R", color: "bg-amber-500" },
    { name: "Cuisine Actuelle", initials: "CA", color: "bg-blue-500" },
  ];

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
        <Globe className="h-8 w-8 text-orange-500" />
      </div>

      {/* Badge */}
      <ComingSoonBadge />

      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Import depuis sites web</h2>
        <p className="text-gray-400 max-w-md mx-auto">
          Extrayez des recettes depuis les meilleurs sites culinaires français. Contenu éditorial de qualité, sans les publicités.
        </p>
      </div>

      {/* Supported Sites Grid */}
      <div className="grid grid-cols-2 gap-3">
        {sites.map((site) => (
          <div
            key={site.name}
            className="glass-card-static p-4 rounded-xl flex items-center gap-3"
          >
            <div className={`w-8 h-8 rounded-lg ${site.color} flex items-center justify-center text-white text-xs font-bold`}>
              {site.initials}
            </div>
            <span className="text-sm text-white font-medium">{site.name}</span>
          </div>
        ))}
      </div>

      {/* Disabled Preview */}
      <div className="glass-card-static p-6 rounded-xl space-y-4 opacity-50 pointer-events-none">
        <Input
          placeholder="https://www.ellatable.fr/recettes/..."
          disabled
          className="bg-white/5 border-white/10 text-gray-500"
        />
        <Button disabled className="w-full">
          Importer
        </Button>
      </div>

      {/* Footer Note */}
      <p className="text-sm text-gray-500">
        Les recettes seront automatiquement reformulées pour respecter les droits d'auteur.
      </p>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [cookbookName, setCookbookName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles[0];
    if (pdfFile) {
      setFile(pdfFile);
      setCookbookName(pdfFile.name.replace(/\.pdf$/i, ""));
      setUploadProgress(0);
      setUploadedPath(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 100 * 1024 * 1024,
    multiple: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      try {
        const response = await fetch(`${API_BASE_URL}/api/upload/pdf`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "Upload failed");
        }

        const result = await response.json();
        return result.data;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      setUploadedPath(data.filePath);
    },
  });

  const createCookbookMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedPath) throw new Error("No file uploaded");

      const cookbook = await api.post<Cookbook>("/api/cookbooks", {
        name: cookbookName,
        filePath: uploadedPath,
        fileSize: file?.size,
        totalPages: 10,
        generateDescriptions: true,
        reformulateForCopyright: true,
        convertToGrams: true,
      });

      await api.post("/api/processing/start", { cookbookId: cookbook.id });
      return cookbook;
    },
    onSuccess: (cookbook) => {
      navigate(`/cookbooks/${cookbook.id}`);
    },
  });

  const handleUpload = () => {
    if (file) uploadMutation.mutate(file);
  };

  const clearFile = () => {
    setFile(null);
    setCookbookName("");
    setUploadProgress(0);
    setUploadedPath(null);
    uploadMutation.reset();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const tabs = [
    { id: "pdf" as TabType, label: "PDF" },
    { id: "ckbk" as TabType, label: "CKBK" },
    { id: "web" as TabType, label: "Sites Web" },
  ];

  return (
    <DashboardLayout title="Uploader">
      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex glass-card-static rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "pdf" && (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Upload Zone */}
          {!file ? (
            <div
              {...getRootProps()}
              className={`glass-card-static p-12 text-center cursor-pointer border-2 border-dashed rounded-xl transition-all ${
                isDragActive ? "border-primary bg-primary/10" : "border-white/20 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto text-gray-500 mb-4" />
              <p className="text-white font-medium">
                {isDragActive ? "Deposez ici" : "Glissez un PDF"}
              </p>
              <p className="text-sm text-gray-500 mt-1">ou cliquez pour selectionner</p>
            </div>
          ) : (
            <div className="glass-card-static p-6 rounded-xl space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Upload Progress */}
              {uploadMutation.isPending && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-xs text-gray-500 text-center">{uploadProgress}%</p>
                </div>
              )}

              {/* Upload Status */}
              {uploadMutation.isSuccess && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Fichier uploade
                </div>
              )}

              {uploadMutation.isError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Erreur d'upload
                </div>
              )}

              {/* Upload Button */}
              {!uploadedPath && !uploadMutation.isPending && (
                <Button onClick={handleUpload} className="w-full">
                  Uploader
                </Button>
              )}
            </div>
          )}

          {/* Configuration */}
          {uploadedPath && (
            <div className="space-y-4">
              <div className="glass-card-static p-6 rounded-xl">
                <label className="text-sm text-gray-400 block mb-2">Nom du livre</label>
                <Input
                  value={cookbookName}
                  onChange={(e) => setCookbookName(e.target.value)}
                  placeholder="Nom du livre"
                  className="glass-input"
                />
              </div>

              {createCookbookMutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Erreur lors du traitement
                </div>
              )}

              <Button
                onClick={() => createCookbookMutation.mutate()}
                disabled={!cookbookName || createCookbookMutation.isPending}
                className="w-full"
                size="lg"
              >
                {createCookbookMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Demarrage...
                  </>
                ) : (
                  "Lancer"
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === "ckbk" && <CKBKTab />}
      {activeTab === "web" && <WebSitesTab />}
    </DashboardLayout>
  );
}
