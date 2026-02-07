import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
} from "lucide-react";
import type { Cookbook } from "../../../backend/src/types";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [cookbookName, setCookbookName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const [options, setOptions] = useState({
    generateDescriptions: true,
    reformulateForCopyright: true,
    convertToGrams: true,
  });

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
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate upload progress
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

      return api.post<Cookbook>("/api/cookbooks", {
        name: cookbookName,
        filePath: uploadedPath,
        fileSize: file?.size,
        totalPages: 10, // This would be determined by actual PDF processing
        ...options,
      });
    },
    onSuccess: (cookbook) => {
      // Start processing
      api.post("/api/processing/start", { cookbookId: cookbook.id }).then(() => {
        navigate(`/cookbooks/${cookbook.id}`);
      });
    },
  });

  const handleUpload = async () => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const handleStartProcessing = async () => {
    createCookbookMutation.mutate();
  };

  const clearFile = () => {
    setFile(null);
    setCookbookName("");
    setUploadProgress(0);
    setUploadedPath(null);
    uploadMutation.reset();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <DashboardLayout
      title="Uploader un livre de recettes"
      description="Importez un PDF pour extraire automatiquement les recettes"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Upload Zone */}
        <div className="glass-card-static p-8 rounded-2xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Fichier PDF</h3>
            <p className="text-sm text-gray-400">
              Glissez un fichier PDF ou cliquez pour sélectionner (max 100 Mo)
            </p>
          </div>
          <div>
            {!file ? (
              <div
                {...getRootProps()}
                className={`
                  glass-card p-12 text-center cursor-pointer border-2 border-dashed border-white/20 rounded-xl transition-all
                  ${isDragActive ? "border-primary bg-primary/10" : "hover:border-primary/50"}
                `}
              >
                <input {...getInputProps()} />
                <div className="icon-container w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-xl">
                  <Upload className="h-8 w-8 text-white/70" />
                </div>
                <p className="text-lg font-medium text-white">
                  {isDragActive ? "Deposez le fichier ici" : "Glissez un fichier PDF ici"}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  ou cliquez pour selectionner
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="icon-container w-12 h-12 flex items-center justify-center rounded-xl">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{file.name}</p>
                      <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearFile} className="text-white/70 hover:text-white">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Upload Progress */}
                {uploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white">Upload en cours...</span>
                      <span className="text-gray-400">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Upload Status */}
                {uploadMutation.isSuccess && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Fichier uploade avec succes</span>
                  </div>
                )}

                {uploadMutation.isError && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      {uploadMutation.error?.message || "Erreur lors de l'upload"}
                    </span>
                  </div>
                )}

                {/* Upload Button */}
                {!uploadedPath && !uploadMutation.isPending && (
                  <Button onClick={handleUpload} className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Uploader le fichier
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        {uploadedPath && (
          <>
            <div className="glass-card-static p-8 rounded-2xl">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Nom du livre</h3>
              </div>
              <div>
                <Input
                  value={cookbookName}
                  onChange={(e) => setCookbookName(e.target.value)}
                  placeholder="Ex: Les classiques de la cuisine francaise"
                  className="glass-input"
                />
              </div>
            </div>

            <div className="glass-card-static p-8 rounded-2xl">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Options de traitement</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="descriptions"
                    checked={options.generateDescriptions}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, generateDescriptions: !!checked }))
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="descriptions" className="font-medium text-white">
                      Generer des descriptions
                    </Label>
                    <p className="text-sm text-gray-400">
                      Creer automatiquement une description appetissante pour chaque recette
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="reformulate"
                    checked={options.reformulateForCopyright}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, reformulateForCopyright: !!checked }))
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="reformulate" className="font-medium text-white">
                      Reformuler pour droits d'auteur
                    </Label>
                    <p className="text-sm text-gray-400">
                      Reecrire les instructions dans un style different pour eviter le plagiat
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="convert"
                    checked={options.convertToGrams}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, convertToGrams: !!checked }))
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="convert" className="font-medium text-white">
                      Convertir en grammes
                    </Label>
                    <p className="text-sm text-gray-400">
                      Convertir toutes les quantites (cuilleres, pieces, etc.) en grammes exacts
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="glass-card-static p-8 rounded-2xl border-primary/30">
              <div className="flex gap-3">
                <div className="icon-container w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-primary">Comment ca marche ?</p>
                  <p className="text-gray-400 mt-1">
                    OptiRecipe analyse chaque page du PDF avec l'IA pour identifier et extraire
                    les recettes. Les quantites sont automatiquement converties en grammes pour
                    faciliter le calcul des couts dans OptiMenu.
                  </p>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={handleStartProcessing}
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
                "Lancer le traitement"
              )}
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
