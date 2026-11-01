import { requireUser } from "@/lib/auth";
import { metaConfigured } from "@/lib/whatsapp/graph";
import TemplateEditor from "../TemplateEditor";

export default async function NewTemplatePage() {
  await requireUser("admin");
  return (
    <TemplateEditor
      metaReady={metaConfigured()}
      initial={{
        id: null,
        brand: "ALM",
        name: "",
        language: "fr",
        category: "UTILITY",
        header: "",
        body: "",
        footer: "",
        buttons: [],
        samples: [],
        status: "draft",
        rejectionReason: "",
        metaTemplateId: null,
      }}
    />
  );
}
