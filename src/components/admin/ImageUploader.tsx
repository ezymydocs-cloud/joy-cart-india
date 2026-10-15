import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from "lucide-react";
import { uploadImage, type Bucket } from "@/lib/catalog";

export type Img = { url: string; storage_path?: string | null };

export function MultiImageUploader({ bucket, value, onChange }: { bucket: Bucket; value: Img[]; onChange: (v: Img[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Please choose image files");
    setBusy((b) => b + list.length);
    const added: Img[] = [];
    for (const f of list) {
      try {
        const r = await uploadImage(bucket, f);
        added.push({ url: r.url, storage_path: r.path });
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    onChange([...value, ...added]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const v = [...value];
    const [x] = v.splice(from, 1);
    v.splice(to, 0, x);
    onChange(v);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center ${over ? "border-secondary bg-sun-soft" : ""}`}
      >
        <Upload className="size-6 text-secondary" />
        <div className="font-bold">{busy ? `Uploading ${busy}…` : "Drag & drop images or click to choose"}</div>
        <div className="text-xs text-muted-foreground">Upload images from your device (URL not supported)</div>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((img, i) => (
            <div
              key={img.url + i}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (drag !== null) move(drag, i); setDrag(null); }}
              className={`relative overflow-hidden rounded-xl border-2 ${i === 0 ? "border-secondary" : ""}`}
            >
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground">MAIN</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/90 p-1">
                <button type="button" title="Move left" onClick={() => move(i, i - 1)}><ArrowLeft className="size-4" /></button>
                {i !== 0 && <button type="button" title="Set as main" onClick={() => move(i, 0)}><Star className="size-4" /></button>}
                <button type="button" title="Delete" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="size-4 text-destructive" /></button>
                <button type="button" title="Move right" onClick={() => move(i, i + 1)}><ArrowRight className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SingleImageUploader({ bucket, value, onChange, label }: { bucket: Bucket; value: string | null; onChange: (url: string | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { onChange((await uploadImage(bucket, f)).url); } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  };
  return (
    <div>
      {label && <div className="mb-1 text-xs font-bold">{label}</div>}
      <div
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-3"
      >
        {value ? <img src={value} alt="" className="size-16 rounded-lg object-cover" /> : <Upload className="size-6 text-secondary" />}
        <div className="text-xs">
          <div className="font-bold">{busy ? "Uploading…" : value ? "Click to replace" : "Click or drop an image"}</div>
          <div className="text-muted-foreground">Upload images from your device (URL not supported)</div>
        </div>
        {value && <button type="button" className="ml-auto text-destructive" onClick={(e) => { e.stopPropagation(); onChange(null); }}><Trash2 className="size-4" /></button>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
