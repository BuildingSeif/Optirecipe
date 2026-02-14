import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone, type FileRejection } from "react-dropzone";
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

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("optirecipe_session");
    if (raw) {
      const s = JSON.parse(raw);
      return s?.session?.token || null;
    }
  } catch { /* ignore */ }
  return null;
}

// Chunk size for large file uploads (5MB chunks)
const CHUNK_SIZE = 5 * 1024 * 1024;
// Files larger than 10MB use chunked upload
const CHUNKED_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

type TabType = "pdf" | "ckbk" | "web";

interface FileUploadState {
  id: string;
  file: File;
  name: string;
  progress: number;
  uploadedPath: string | null;
  status: "pending" | "uploading" | "uploaded" | "processing" | "completed" | "error";
  error?: string;
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
      Bientot disponible
    </span>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/80">
      <Check className="h-4 w-4 text-primary flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function CKBKTab() {
  return (
    <div className="max-w-lg mx-auto py-8">
      {/* Main Card Container */}
      <div className="glass-card-static p-8 rounded-2xl space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>

        {/* Badge */}
        <div className="text-center">
          <ComingSoonBadge />
        </div>

        {/* Heading */}
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">Import CKBK</h2>
          <p className="text-white/80 max-w-md mx-auto leading-relaxed">
            Importez directement depuis la base de donnees CKBK, la plus grande collection de livres de cuisine premium au monde. Les recettes en anglais seront automatiquement traduites et converties en grammes.
          </p>
        </div>

        {/* Disabled Preview */}
        <div className="bg-white/5 p-5 rounded-xl space-y-4 opacity-60 pointer-events-none">
          <Input
            placeholder="https://app.ckbk.com/recipe/..."
            disabled
            className="bg-white/10 border-white/20 text-white/50"
          />
          <Button disabled className="w-full">
            Importer
          </Button>
        </div>

        {/* Features */}
        <div className="bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] p-5 rounded-xl text-left space-y-3 border border-white/10">
          <h3 className="text-sm font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-3">Fonctionnalites</h3>
          <FeatureItem text="Traduction automatique anglais -> francais" />
          <FeatureItem text="Conversion cups/oz -> grammes" />
          <FeatureItem text="Import en lot (plusieurs recettes)" />
          <FeatureItem text="Reformulation automatique (droits d'auteur)" />
        </div>
      </div>
    </div>
  );
}

function WebSitesTab() {
  const sites = [
    { name: "Elle a Table", initials: "ET", color: "bg-pink-500" },
    { name: "Saveurs", initials: "S", color: "bg-red-500" },
    { name: "Regal", initials: "R", color: "bg-amber-500" },
    { name: "Cuisine Actuelle", initials: "CA", color: "bg-blue-500" },
  ];

  return (
    <div className="max-w-lg mx-auto py-8">
      {/* Main Card Container */}
      <div className="glass-card-static p-8 rounded-2xl space-y-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <Globe className="h-8 w-8 text-primary" />
        </div>

        {/* Badge */}
        <div className="text-center">
          <ComingSoonBadge />
        </div>

        {/* Heading */}
        <div className="space-y-3 text-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent">Import depuis sites web</h2>
          <p className="text-white/80 max-w-md mx-auto leading-relaxed">
            Extrayez des recettes depuis les meilleurs sites culinaires francais. Contenu editorial de qualite, sans les publicites.
          </p>
        </div>

        {/* Supported Sites Grid */}
        <div className="bg-gradient-to-br from-[#0a1628] to-[#0d1f3c] p-5 rounded-xl border border-white/10">
          <h3 className="text-sm font-semibold bg-gradient-to-r from-[#00D4FF] via-[#0080FF] to-[#0066FF] bg-clip-text text-transparent mb-4 text-center">Sites supportes</h3>
          <div className="grid grid-cols-2 gap-3">
            {sites.map((site) => (
              <div
                key={site.name}
                className="bg-white/10 p-4 rounded-xl flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-lg ${site.color} flex items-center justify-center text-white text-xs font-bold`}>
                  {site.initials}
                </div>
                <span className="text-sm text-white font-medium">{site.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disabled Preview */}
        <div className="bg-white/5 p-5 rounded-xl space-y-4 opacity-60 pointer-events-none">
          <Input
            placeholder="https://www.ellatable.fr/recettes/..."
            disabled
            className="bg-white/10 border-white/20 text-white/50"
          />
          <Button disabled className="w-full">
            Importer
          </Button>
        </div>

        {/* Footer Note */}
        <p className="text-sm text-white/60 text-center">
          Les recettes seront automatiquement reformulees pour respecter les droits d'auteur.
        </p>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("pdf");
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Handle rejected files (e.g., too large)
    rejectedFiles.forEach(({ file, errors }) => {
      const errorMessages = errors.map((e) => {
        if (e.code === "file-too-large") {
          return `Fichier trop volumineux (max 500 MB)`;
        }
        if (e.code === "file-invalid-type") {
          return `Type de fichier non supporte (PDF uniquement)`;
        }
        return e.message;
      }).join(", ");

      const rejectedFile: FileUploadState = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name.replace(/\.pdf$/i, ""),
        progress: 0,
        uploadedPath: null,
        status: "error",
        error: errorMessages,
      };
      setFiles((prev) => [...prev, rejectedFile]);
    });

    // Handle accepted files
    const newFiles: FileUploadState[] = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name.replace(/\.pdf$/i, ""),
      progress: 0,
      uploadedPath: null,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 500 * 1024 * 1024, // 500MB max
    multiple: true,
    // Disable default browser file size validation which can be inconsistent
    validator: undefined,
  });

  const updateFileState = (id: string, updates: Partial<FileUploadState>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const updateFileName = (id: string, name: string) => {
    updateFileState(id, { name });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  // Chunked upload for large files
  const uploadChunked = async (fileState: FileUploadState): Promise<string> => {
    const file = fileState.file;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    updateFileState(fileState.id, { status: "uploading", progress: 0 });

    try {
      // Step 1: Initialize upload
      const token = getAuthToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const initResponse = await fetch(`${API_BASE_URL}/api/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(error.error?.message || "Failed to initialize upload");
      }

      const { data: initData } = await initResponse.json();
      const { uploadId } = initData;

      // Step 2: Upload chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk);

        const chunkResponse = await fetch(
          `${API_BASE_URL}/api/upload/chunk/${uploadId}/${i}`,
          {
            method: "POST",
            headers: authHeaders,
            credentials: "include",
            body: formData,
          }
        );

        if (!chunkResponse.ok) {
          // Abort on failure
          await fetch(`${API_BASE_URL}/api/upload/abort/${uploadId}`, {
            method: "DELETE",
            headers: authHeaders,
            credentials: "include",
          });
          throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks}`);
        }

        // Update progress
        const progress = Math.round(((i + 1) / totalChunks) * 95); // Leave 5% for completion
        updateFileState(fileState.id, { progress });
      }

      // Step 3: Complete upload
      updateFileState(fileState.id, { progress: 98 });

      const completeResponse = await fetch(
        `${API_BASE_URL}/api/upload/complete/${uploadId}`,
        {
          method: "POST",
          headers: authHeaders,
          credentials: "include",
        }
      );

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error?.message || "Failed to complete upload");
      }

      const { data: completeData } = await completeResponse.json();

      updateFileState(fileState.id, {
        status: "uploaded",
        progress: 100,
        uploadedPath: completeData.filePath,
      });

      return completeData.filePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      updateFileState(fileState.id, {
        status: "error",
        error: message,
      });
      throw error;
    }
  };

  // Direct upload for small files (using XHR for progress)
  const uploadDirect = async (fileState: FileUploadState): Promise<string> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", fileState.file);

      updateFileState(fileState.id, { status: "uploading", progress: 0 });

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          updateFileState(fileState.id, { progress });
        }
      });

      xhr.addEventListener("load", () => {
        try {
          const result = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300 && result.data) {
            updateFileState(fileState.id, {
              status: "uploaded",
              progress: 100,
              uploadedPath: result.data.filePath,
            });
            resolve(result.data.filePath);
          } else {
            const errorMessage = result.error?.message || "Upload failed";
            updateFileState(fileState.id, {
              status: "error",
              error: errorMessage,
            });
            reject(new Error(errorMessage));
          }
        } catch {
          updateFileState(fileState.id, {
            status: "error",
            error: "Failed to parse server response",
          });
          reject(new Error("Failed to parse server response"));
        }
      });

      xhr.addEventListener("error", () => {
        updateFileState(fileState.id, {
          status: "error",
          error: "Network error - please check your connection",
        });
        reject(new Error("Network error"));
      });

      xhr.addEventListener("timeout", () => {
        updateFileState(fileState.id, {
          status: "error",
          error: "Upload timed out - please try again",
        });
        reject(new Error("Upload timed out"));
      });

      xhr.open("POST", `${API_BASE_URL}/api/upload/pdf`);
      xhr.withCredentials = true;
      const token = getAuthToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 600000; // 10 minute timeout for large files
      xhr.send(formData);
    });
  };

  // Main upload function - chooses between chunked and direct based on file size
  const uploadSingleFile = async (fileState: FileUploadState): Promise<string> => {
    // Use chunked upload for files larger than 10MB
    if (fileState.file.size > CHUNKED_UPLOAD_THRESHOLD) {
      console.log(`Using chunked upload for ${fileState.file.name} (${(fileState.file.size / 1024 / 1024).toFixed(1)} MB)`);
      return uploadChunked(fileState);
    } else {
      console.log(`Using direct upload for ${fileState.file.name} (${(fileState.file.size / 1024 / 1024).toFixed(1)} MB)`);
      return uploadDirect(fileState);
    }
  };

  const createCookbookForFile = async (fileState: FileUploadState): Promise<Cookbook> => {
    if (!fileState.uploadedPath) throw new Error("No file uploaded");

    updateFileState(fileState.id, { status: "processing" });

    const cookbook = await api.post<Cookbook>("/api/cookbooks", {
      name: fileState.name,
      filePath: fileState.uploadedPath,
      fileSize: fileState.file.size,
      totalPages: 10,
      generateDescriptions: true,
      reformulateForCopyright: true,
      convertToGrams: true,
    });

    await api.post("/api/processing/start", { cookbookId: cookbook.id });
    updateFileState(fileState.id, { status: "completed" });
    return cookbook;
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (const fileState of pendingFiles) {
      try {
        await uploadSingleFile(fileState);
      } catch {
        // Error already handled in uploadSingleFile
      }
    }

    setIsUploading(false);
  };

  const handleProcessAll = async () => {
    const uploadedFiles = files.filter((f) => f.status === "uploaded");
    if (uploadedFiles.length === 0) return;

    setIsProcessing(true);
    const createdCookbooks: Cookbook[] = [];

    for (const fileState of uploadedFiles) {
      try {
        const cookbook = await createCookbookForFile(fileState);
        createdCookbooks.push(cookbook);
      } catch {
        updateFileState(fileState.id, {
          status: "error",
          error: "Erreur lors du traitement",
        });
      }
    }

    setIsProcessing(false);

    // Navigate to the first created cookbook or cookbooks list
    if (createdCookbooks.length === 1) {
      navigate(`/cookbooks/${createdCookbooks[0].id}`);
    } else if (createdCookbooks.length > 1) {
      navigate("/cookbooks");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: FileUploadState["status"]) => {
    switch (status) {
      case "uploading":
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "uploaded":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusText = (status: FileUploadState["status"]) => {
    switch (status) {
      case "uploading":
        return "Upload en cours...";
      case "uploaded":
        return "Pret a traiter";
      case "processing":
        return "Traitement...";
      case "completed":
        return "Termine";
      case "error":
        return "Erreur";
      default:
        return "En attente";
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const allUploaded = files.length > 0 && files.every((f) => f.status === "uploaded" || f.status === "completed" || f.status === "error");
  const hasUploadedFiles = uploadedCount > 0;

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
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-lg shadow-primary/30"
                  : "text-white/70 hover:text-white"
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
          {/* Upload Zone - Always visible */}
          <div
            {...getRootProps()}
            className={`glass-card-static p-12 text-center cursor-pointer border-2 border-dashed rounded-xl transition-all ${
              isDragActive ? "border-primary bg-primary/20" : "border-primary/30 hover:border-primary/60"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto text-primary mb-4" />
            <p className="text-white font-semibold text-lg">
              {isDragActive ? "Deposez ici" : "Glissez vos PDFs"}
            </p>
            <p className="text-sm text-white/60 mt-1">ou cliquez pour selectionner (plusieurs fichiers possibles)</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="glass-card-static p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">
                  {files.length} fichier{files.length > 1 ? "s" : ""} selectionne{files.length > 1 ? "s" : ""}
                </h3>
                <Button variant="ghost" size="sm" onClick={clearAllFiles} disabled={isUploading || isProcessing} className="text-white/70 hover:text-white">
                  Tout effacer
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {files.map((fileState) => (
                  <div key={fileState.id} className="bg-white/10 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusIcon(fileState.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{fileState.file.name}</p>
                          <p className="text-xs text-white/60">
                            {formatFileSize(fileState.file.size)} - {getStatusText(fileState.status)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0 text-white/70 hover:text-white"
                        onClick={() => removeFile(fileState.id)}
                        disabled={fileState.status === "uploading" || fileState.status === "processing"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    {(fileState.status === "uploading" || fileState.status === "processing") && (
                      <div className="space-y-1">
                        <Progress value={fileState.progress} className="h-1.5" />
                        <p className="text-xs text-white/60 text-right">{fileState.progress}%</p>
                      </div>
                    )}

                    {/* Cookbook Name Input - shown after upload */}
                    {fileState.status === "uploaded" && (
                      <div className="pt-2">
                        <Input
                          value={fileState.name}
                          onChange={(e) => updateFileName(fileState.id, e.target.value)}
                          placeholder="Nom du livre"
                          className="glass-input text-sm text-white"
                        />
                      </div>
                    )}

                    {/* Error Message */}
                    {fileState.status === "error" && fileState.error && (
                      <p className="text-xs text-destructive font-medium">{fileState.error}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {pendingCount > 0 && (
                  <Button
                    onClick={handleUploadAll}
                    disabled={isUploading}
                    className="w-full gradient-primary font-semibold shadow-lg shadow-primary/30"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Upload en cours...
                      </>
                    ) : (
                      `Uploader ${pendingCount} fichier${pendingCount > 1 ? "s" : ""}`
                    )}
                  </Button>
                )}

                {allUploaded && hasUploadedFiles && (
                  <Button
                    onClick={handleProcessAll}
                    disabled={isProcessing || uploadedCount === 0}
                    className="w-full gradient-primary font-semibold shadow-lg shadow-primary/30"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Traitement en cours...
                      </>
                    ) : (
                      `Lancer le traitement (${uploadedCount} livre${uploadedCount > 1 ? "s" : ""})`
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "ckbk" && <CKBKTab />}
      {activeTab === "web" && <WebSitesTab />}
    </DashboardLayout>
  );
}
