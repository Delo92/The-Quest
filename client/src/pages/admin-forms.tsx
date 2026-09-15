import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, Plus, Save, Trash2 } from "lucide-react";

type FieldType = "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox" | "signature" | "initials" | "heading" | "paragraph";
interface FormField { id: string; type: FieldType; label: string; required: boolean; placeholder?: string; options?: string[]; content?: string; }
interface FormDef { id: string; title: string; description?: string; formSlug: string; fields: FormField[]; status: "draft" | "published" | "archived"; isPublic: boolean; successMessage: string; submissionCount: number; }

const fieldTypes: Array<{ type: FieldType; label: string }> = [
  { type: "text", label: "Short text" }, { type: "textarea", label: "Long text" }, { type: "email", label: "Email" },
  { type: "phone", label: "Phone" }, { type: "number", label: "Number" }, { type: "date", label: "Date" },
  { type: "select", label: "Dropdown" }, { type: "radio", label: "Radio choice" }, { type: "checkbox", label: "Checkbox" },
  { type: "signature", label: "Signature" }, { type: "initials", label: "Initials" }, { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
];

function newField(type: FieldType): FormField {
  return { id: crypto.randomUUID(), type, label: fieldTypes.find((item) => item.type === type)?.label || "Field", required: false, options: ["Option 1", "Option 2"] };
}

export default function AdminFormsPage() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [successMessage, setSuccessMessage] = useState("Thank you! Your response has been submitted.");
  const [fields, setFields] = useState<FormField[]>([]);
  const formsQuery = useQuery<FormDef[]>({ queryKey: ["/api/admin/forms"] });

  useEffect(() => {
    if (!selected && formsQuery.data?.length) {
      const first = formsQuery.data[0];
      setSelected(first); setTitle(first.title); setDescription(first.description || ""); setSuccessMessage(first.successMessage); setFields(first.fields || []);
    }
  }, [formsQuery.data, selected]);

  const openForm = (form: FormDef) => {
    setSelected(form); setTitle(form.title); setDescription(form.description || ""); setSuccessMessage(form.successMessage); setFields(form.fields || []);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = selected
        ? await apiRequest("PUT", `/api/admin/forms/${selected.id}`, { title, description, fields, successMessage, status: selected.status, isPublic: selected.isPublic })
        : await apiRequest("POST", "/api/admin/forms", { title, description, fields, successMessage, status: "draft", isPublic: true });
      return response.json();
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/forms"] });
      openForm(saved);
      toast({ title: "Form saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save form", description: error.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "draft" | "published" | "archived") => {
      if (!selected) return;
      const response = await apiRequest("PUT", `/api/admin/forms/${selected.id}`, { status });
      return response.json();
    },
    onSuccess: (saved) => { if (saved) openForm(saved); queryClient.invalidateQueries({ queryKey: ["/api/admin/forms"] }); },
  });

  const startNew = () => { setSelected(null); setTitle("New agreement or intake form"); setDescription(""); setSuccessMessage("Thank you! Your response has been submitted."); setFields([newField("text")]); };
  const moveField = (index: number, direction: -1 | 1) => {
    const next = [...fields]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setFields(next);
  };

  return (
    <main className="quest-dashboard min-h-screen bg-[#0d0d0d] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Link href="/thequest/admin"><Button variant="ghost" size="icon" className="text-white/60"><ArrowLeft className="h-4 w-4" /></Button></Link><div><p className="text-xs uppercase tracking-[0.2em] text-orange-300">The Quest</p><h1 className="font-serif text-2xl">Form builder</h1></div></div>
          <Button onClick={startNew} className="bg-orange-500 text-white"><Plus className="mr-2 h-4 w-4" /> New form</Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-2">
            {(formsQuery.data || []).map((form) => <button key={form.id} onClick={() => openForm(form)} className={`w-full rounded-lg border p-4 text-left ${selected?.id === form.id ? "border-orange-400/50 bg-orange-400/10" : "border-white/10 bg-white/[0.03]"}`}><div className="font-medium">{form.title}</div><div className="mt-1 flex items-center justify-between text-xs text-white/45"><span>{form.submissionCount || 0} submissions</span><Badge variant="outline" className="border-white/15 text-white/50">{form.status}</Badge></div></button>)}
            {!formsQuery.isLoading && !(formsQuery.data || []).length && <div className="rounded-lg border border-dashed border-white/15 p-5 text-sm text-white/40">No forms yet. Create one to collect agreements, payment information, or participant details.</div>}
          </aside>
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-medium">{selected ? "Edit form" : "Create form"}</h2><p className="mt-1 text-sm text-white/45">Build a reusable public form with payment, agreement, and signature fields.</p></div>{selected && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => statusMutation.mutate(selected.status === "published" ? "draft" : "published")} className="border-white/15 text-white/75">{selected.status === "published" ? "Unpublish" : "Publish"}</Button>{selected.status === "published" && <a href={`/thequest/f/${selected.formSlug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="border-white/15 text-white/75"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview</Button></a>}</div>}</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><Label className="text-xs text-white/50">Form title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 border-white/15 bg-white/[0.06] text-white" /></div><div><Label className="text-xs text-white/50">Success message</Label><Input value={successMessage} onChange={(event) => setSuccessMessage(event.target.value)} className="mt-1 border-white/15 bg-white/[0.06] text-white" /></div></div>
            <div className="mt-4"><Label className="text-xs text-white/50">Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 border-white/15 bg-white/[0.06] text-white" /></div>
            <div className="mt-6 flex items-center justify-between"><div><h3 className="font-medium">Fields</h3><p className="text-xs text-white/40">{fields.length} fields · signatures and initials are supported for agreements.</p></div><select defaultValue="" onChange={(event) => { if (event.target.value) { setFields([...fields, newField(event.target.value as FieldType)]); event.target.value = ""; } }} className="h-9 rounded-md border border-white/20 bg-white/[0.08] px-3 text-sm text-white"><option value="" disabled>Add a field</option>{fieldTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></div>
            <div className="mt-3 space-y-3">{fields.map((field, index) => <div key={field.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start gap-3"><div className="flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-orange-300/30 text-orange-200">{field.type}</Badge><Input value={field.label} onChange={(event) => setFields(fields.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} className="h-8 min-w-0 flex-1 border-white/15 bg-white/[0.06] text-white" /></div>{["heading", "paragraph"].includes(field.type) ? <Textarea value={field.content || ""} onChange={(event) => setFields(fields.map((item) => item.id === field.id ? { ...item, content: event.target.value } : item))} placeholder="Static content shown to the signer" className="border-white/15 bg-white/[0.06] text-white" /> : <div className="flex flex-wrap items-center gap-3 text-xs text-white/55"><label className="flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={(event) => setFields(fields.map((item) => item.id === field.id ? { ...item, required: event.target.checked } : item))} /> Required</label><Input value={field.placeholder || ""} onChange={(event) => setFields(fields.map((item) => item.id === field.id ? { ...item, placeholder: event.target.value } : item))} placeholder="Placeholder (optional)" className="h-8 max-w-xs border-white/15 bg-white/[0.06] text-white" /></div>}</div><div className="flex gap-1"><Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveField(index, -1)} className="text-white/50"><ChevronUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)} className="text-white/50"><ChevronDown className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setFields(fields.filter((item) => item.id !== field.id))} className="text-red-300/70"><Trash2 className="h-4 w-4" /></Button></div></div></div>)}</div>
            <div className="mt-6 flex justify-end"><Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title.trim()} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white"><Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save form"}</Button></div>
          </section>
        </div>
      </div>
    </main>
  );
}