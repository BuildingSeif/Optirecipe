import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
          <CardHeader>
            <CardTitle>Fichier PDF</CardTitle>
            <CardDescription>
              Glissez un fichier PDF ou cliquez pour sélectionner (max 100 Mo)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isDragActive ? "Déposez le fichier ici" : "Glissez un fichier PDF ici"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  ou cliquez pour sélectionner
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-10 w-10 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Upload Progress */}
                {uploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Upload en cours...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Upload Status */}
                {uploadMutation.isSuccess && (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Fichier uploadé avec succès</span>
                  </div>
                )}

                {uploadMutation.isError && (
                  <div className="flex items-center gap-2 text-destructive">
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
          </CardContent>
        </Card>

        {/* Configuration */}
        {uploadedPath && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Nom du livre</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={cookbookName}
                  onChange={(e) => setCookbookName(e.target.value)}
                  placeholder="Ex: Les classiques de la cuisine française"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Options de traitement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="descriptions"
                    checked={options.generateDescriptions}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, generateDescriptions: !!checked }))
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="descriptions" className="font-medium">
                      Générer des descriptions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Créer automatiquement une description appétissante pour chaque recette
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
                    <Label htmlFor="reformulate" className="font-medium">
                      Reformuler pour droits d'auteur
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Réécrire les instructions dans un style différent pour éviter le plagiat
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
                    <Label htmlFor="convert" className="font-medium">
                      Convertir en grammes
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Convertir toutes les quantités (cuillères, pièces, etc.) en grammes exacts
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Box */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Comment ça marche ?</p>
                    <p className="text-muted-foreground mt-1">
                      OptiRecipe analyse chaque page du PDF avec l'IA pour identifier et extraire
                      les recettes. Les quantités sont automatiquement converties en grammes pour
                      faciliter le calcul des coûts dans OptiMenu.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  Démarrage...
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
