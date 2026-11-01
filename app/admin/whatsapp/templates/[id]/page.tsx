import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { metaConfigured } from "@/lib/whatsapp/graph";
import { getTemplate } from "@/lib/whatsapp/store";
import { parseJsonArray, type TemplateButton } from "@/lib/whatsapp/templates";
import { deleteTemplate } from "../../actions";
import TemplateEditor from "../TemplateEditor";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("admin");
  const { id } = await params;
  const t = getTemplate(Number(id));
  if (!t) notFound();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/whatsapp" className="text-sm text-slate-600 hover:text-slate-900">
          ← All templates
        </Link>
        <form action={deleteTemplate}>
          <input type="hidden" name="id" value={t.id} />
          <button type="submit" className="btn btn-danger py-1.5">
            Delete template
          </button>
        </form>
      </div>
      <TemplateEditor
        key={t.updated_at}
        metaReady={metaConfigured()}
        initial={{
          id: t.id,
          brand: t.brand,
          name: t.name,
          language: t.language,
          category: t.category,
          header: t.header ?? "",
          body: t.body,
          footer: t.footer ?? "",
          buttons: parseJsonArray<TemplateButton>(t.buttons),
          samples: parseJsonArray<string>(t.samples),
          status: t.status,
          rejectionReason: t.rejection_reason ?? "",
          metaTemplateId: t.meta_template_id,
        }}
      />
    </>
  );
}
