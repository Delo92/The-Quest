import type { Express } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "./firebase-admin";
import { firebaseAuth, requireAdmin } from "./auth-middleware";

const FORMS = "form_definitions";
const SUBMISSIONS = "form_submissions";
const FIELD_TYPES = ["text", "textarea", "email", "phone", "number", "date", "select", "radio", "checkbox", "signature", "initials", "heading", "paragraph"] as const;
const FORM_STATUSES = ["draft", "published", "archived"] as const;

const db = () => getFirestore();

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "form";
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function serialize(id: string, data: Record<string, any>) {
  const output: Record<string, any> = { id, ...data };
  for (const key of ["createdAt", "updatedAt"]) {
    if (key in output && typeof output[key]?.toDate === "function") output[key] = output[key].toDate().toISOString();
  }
  return output;
}

async function uniqueSlug(base: string, excludeId?: string) {
  let suffix = 0;
  while (suffix < 100) {
    const candidate = suffix ? `${base}-${suffix}` : base;
    const snap = await db().collection(FORMS).where("formSlug", "==", candidate).limit(2).get();
    if (!snap.docs.some((doc) => doc.id !== excludeId)) return candidate;
    suffix++;
  }
  return `${base}-${Date.now()}`;
}

function normalizeFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((field: any, index) => ({
    id: clean(field?.id, 120) || `field_${index + 1}`,
    type: FIELD_TYPES.includes(field?.type) ? field.type : "text",
    label: clean(field?.label, 180) || `Field ${index + 1}`,
    required: Boolean(field?.required),
    placeholder: clean(field?.placeholder, 240) || null,
    helpText: clean(field?.helpText, 500) || null,
    options: Array.isArray(field?.options) ? field.options.map((item: unknown) => clean(item, 120)).filter(Boolean).slice(0, 50) : [],
    width: field?.width === "half" ? "half" : "full",
    content: clean(field?.content, 2_000) || null,
  }));
}

function publicForm(data: any) {
  return {
    id: data.id,
    title: data.title,
    description: data.description || null,
    formSlug: data.formSlug,
    fields: data.fields || [],
    successMessage: data.successMessage || "Thank you! Your response has been submitted.",
    isPublic: Boolean(data.isPublic),
    status: data.status,
  };
}

export function registerQuestForms(app: Express) {
  app.get("/api/admin/forms", firebaseAuth, requireAdmin, async (_req: any, res: any) => {
    try {
      const snap = await db().collection(FORMS).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load forms." });
    }
  });

  app.post("/api/admin/forms", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const title = clean(req.body?.title, 180);
      if (!title) return res.status(400).json({ message: "Form title is required." });
      const ref = db().collection(FORMS).doc();
      const record = {
        title,
        description: clean(req.body?.description, 2_000) || null,
        formSlug: await uniqueSlug(slugify(title)),
        fields: normalizeFields(req.body?.fields),
        status: FORM_STATUSES.includes(req.body?.status) ? req.body.status : "draft",
        isPublic: req.body?.isPublic !== false,
        successMessage: clean(req.body?.successMessage, 500) || "Thank you! Your response has been submitted.",
        submissionCount: 0,
        createdBy: req.firebaseUser?.uid || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await ref.set(record);
      res.status(201).json(serialize(ref.id, record));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not create form." });
    }
  });

  app.put("/api/admin/forms/:formId", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ref = db().collection(FORMS).doc(req.params.formId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Form not found." });
      const current = snap.data() || {};
      const update: Record<string, any> = { updatedAt: Timestamp.now() };
      if (req.body?.title !== undefined) {
        update.title = clean(req.body.title, 180);
        update.formSlug = await uniqueSlug(slugify(update.title), req.params.formId);
      }
      if (req.body?.description !== undefined) update.description = clean(req.body.description, 2_000);
      if (req.body?.fields !== undefined) update.fields = normalizeFields(req.body.fields);
      if (FORM_STATUSES.includes(req.body?.status)) update.status = req.body.status;
      if (req.body?.isPublic !== undefined) update.isPublic = Boolean(req.body.isPublic);
      if (req.body?.successMessage !== undefined) update.successMessage = clean(req.body.successMessage, 500);
      await ref.update(update);
      res.json(serialize(req.params.formId, { ...current, ...update }));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not update form." });
    }
  });

  app.delete("/api/admin/forms/:formId", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const ref = db().collection(FORMS).doc(req.params.formId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Form not found." });
      await ref.update({ status: "archived", updatedAt: Timestamp.now() });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not archive form." });
    }
  });

  app.get("/api/admin/forms/:formId/submissions", firebaseAuth, requireAdmin, async (req: any, res: any) => {
    try {
      const snap = await db().collection(SUBMISSIONS).where("formId", "==", req.params.formId).get();
      res.json(snap.docs.map((doc) => serialize(doc.id, doc.data())).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load submissions." });
    }
  });

  app.get("/api/forms/f/:slug", async (req, res) => {
    try {
      const snap = await db().collection(FORMS).where("formSlug", "==", req.params.slug).where("status", "==", "published").limit(1).get();
      if (snap.empty || snap.docs[0].data().isPublic === false) return res.status(404).json({ message: "Form not found." });
      res.json(publicForm({ id: snap.docs[0].id, ...snap.docs[0].data() }));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load form." });
    }
  });

  app.post("/api/forms/f/:slug/submit", async (req, res) => {
    try {
      const snap = await db().collection(FORMS).where("formSlug", "==", req.params.slug).where("status", "==", "published").limit(1).get();
      if (snap.empty || snap.docs[0].data().isPublic === false) return res.status(404).json({ message: "Form not found." });
      const form = snap.docs[0].data();
      const answers = req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {};
      const missing = (form.fields || [])
        .filter((field: any) => field.required && !["heading", "paragraph"].includes(field.type))
        .filter((field: any) => answers[field.id] === undefined || answers[field.id] === null || answers[field.id] === "");
      if (missing.length) return res.status(400).json({ message: `Complete required fields: ${missing.map((field: any) => field.label).join(", ")}` });
      const ref = db().collection(SUBMISSIONS).doc();
      const submission = {
        formId: snap.docs[0].id,
        formSlug: req.params.slug,
        answers,
        submitterName: clean(req.body?.submitterName, 180) || null,
        submitterEmail: clean(req.body?.submitterEmail, 320).toLowerCase() || null,
        status: "new",
        createdAt: Timestamp.now(),
      };
      await ref.set(submission);
      await snap.docs[0].ref.update({ submissionCount: FieldValue.increment(1), updatedAt: Timestamp.now() });
      res.status(201).json({ id: ref.id, success: true, message: form.successMessage || "Thank you! Your response has been submitted." });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Could not submit form." });
    }
  });
}