import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");
  const formQuery = useQuery<any>({ queryKey: [`/api/forms/f/${slug}`], enabled: Boolean(slug) });
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/forms/f/${slug}/submit`, { answers });
      return response.json();
    },
    onSuccess: (result) => setMessage(result.message || "Thank you! Your response has been submitted."),
    onError: (error: Error) => setMessage(error.message),
  });
  const form = formQuery.data;
  if (formQuery.isLoading) return <main className="min-h-screen bg-[#0d0d0d] p-8 text-white/60">Loading form...</main>;
  if (!form) return <main className="min-h-screen bg-[#0d0d0d] p-8 text-white">This form is not available.</main>;

  return <main className="min-h-screen bg-[#0d0d0d] px-4 py-10 text-white sm:px-6"><div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.2em] text-orange-300">The Quest</p><h1 className="mt-2 font-serif text-3xl">{form.title}</h1>{form.description && <p className="mt-2 text-sm leading-relaxed text-white/55">{form.description}</p>}<div className="mt-8 space-y-5">{form.fields.map((field: any) => { if (field.type === "heading") return <h2 key={field.id} className="pt-3 text-lg font-medium">{field.content || field.label}</h2>; if (field.type === "paragraph") return <p key={field.id} className="text-sm leading-relaxed text-white/60">{field.content || field.label}</p>; const value = answers[field.id] || ""; return <div key={field.id}><Label className="text-sm text-white/80">{field.label}{field.required && <span className="ml-1 text-orange-300">*</span>}</Label>{field.type === "textarea" ? <Textarea value={value} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} placeholder={field.placeholder || ""} className="mt-2 border-white/15 bg-white/[0.06] text-white" /> : field.type === "select" ? <select value={value} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} className="mt-2 h-10 w-full rounded-md border border-white/20 bg-white/[0.08] px-3 text-sm text-white"><option value="">Select an option</option>{(field.options || []).map((option: string) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "checkbox" ? <label className="mt-2 flex items-center gap-2 text-sm text-white/65"><input type="checkbox" checked={Boolean(value)} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.checked })} /> I agree</label> : field.type === "signature" || field.type === "initials" ? <Input value={value} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} placeholder={field.type === "signature" ? "Type your full legal name" : "Type your initials"} className="mt-2 border-white/15 bg-white/[0.06] text-white" /> : <Input type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={value} onChange={(event) => setAnswers({ ...answers, [field.id]: event.target.value })} placeholder={field.placeholder || ""} className="mt-2 border-white/15 bg-white/[0.06] text-white" />}</div>; })}</div>{message && <div className="mt-6 rounded-md border border-orange-300/20 bg-orange-300/10 p-3 text-sm text-orange-100">{message}</div>}<div className="mt-7 flex justify-end"><Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="bg-orange-500 text-white">{submitMutation.isPending ? "Submitting..." : "Submit response"}</Button></div></div></main>;
}