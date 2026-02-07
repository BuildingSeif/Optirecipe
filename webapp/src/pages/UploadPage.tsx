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
} from "lucide-react";
import type { Cookbook } from "../../../backend/src/types";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export default function UploadPage() {
  const navigate = useNavigate();
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

  return (
    <DashboardLayout title="Uploader">
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
    </DashboardLayout>
  );
}
