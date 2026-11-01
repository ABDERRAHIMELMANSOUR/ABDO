import type { ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import SubNav from "@/components/SubNav";

export default function WhatsAppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="WhatsApp & Meta"
        subtitle="Message templates, Cloud API numbers and webhooks for ALM and CPA, and the Meta Ads launch checklist."
      />
      <SubNav
        items={[
          { href: "/admin/whatsapp", label: "Templates", match: "/admin/whatsapp/templates" },
          { href: "/admin/whatsapp/webhooks", label: "Numbers & webhooks" },
          { href: "/admin/whatsapp/campaigns", label: "Meta Ads checklist" },
        ]}
      />
      {children}
    </>
  );
}
