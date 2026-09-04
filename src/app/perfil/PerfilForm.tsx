"use client";

import { useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { updateProfile, uploadAvatar } from "@/lib/actions/profile";
import { resizeAndCompressImage } from "@/lib/image";
import Card from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { IconCamera } from "@/components/icons";

export default function PerfilForm({ profile }: { profile: Profile }) {
  const [fotoUrl, setFotoUrl] = useState(profile.foto_url);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "La foto no puede superar los 5 MB." });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const compressed = await resizeAndCompressImage(file);
      const formData = new FormData();
      formData.set("file", compressed);
      const result = await uploadAvatar(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.foto_url) {
        setFotoUrl(result.foto_url);
        setMessage({ type: "ok", text: "Foto actualizada." });
      }
    } catch {
      setMessage({ type: "error", text: "No se pudo procesar la imagen." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await updateProfile(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "ok", text: "Perfil actualizado." });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col items-center gap-3 p-6">
        <div className="relative">
          <Avatar src={fotoUrl} alt={profile.apodo} size={96} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-black shadow-lg ring-2 ring-surface transition hover:brightness-110 disabled:opacity-50"
          >
            <IconCamera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </div>
        <div className="text-center">
          <p className="font-semibold text-white">{profile.apodo}</p>
          <Badge variant={profile.rol === "admin" ? "gold" : "neutral"} className="mt-1.5">
            {profile.rol === "admin" ? "Admin" : "Jugador"}
          </Badge>
        </div>
        {uploading && <p className="text-xs text-zinc-500">Subiendo foto...</p>}
      </Card>

      <Card className="p-6">
        <form action={handleSubmit} className="flex flex-col gap-4">
          <Label>
            Nombre
            <Input type="text" name="nombre" defaultValue={profile.nombre} required />
          </Label>
          <Label>
            Apellido
            <Input type="text" name="apellido" defaultValue={profile.apellido} required />
          </Label>
          <Label>
            Apodo
            <Input type="text" name="apodo" defaultValue={profile.apodo} required />
          </Label>
          <Button type="submit" disabled={saving} className="mt-1">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </Card>

      {message && (
        <p
          className={`rounded-xl border px-3.5 py-2.5 text-sm ${
            message.type === "ok"
              ? "border-primary-500/20 bg-primary-500/10 text-primary-400"
              : "border-danger-500/20 bg-danger-500/10 text-danger-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
