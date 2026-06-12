import { readContactsData } from "../../_data/commercial-data";
import { ContactsWorkspace } from "./contacts-workspace";

export async function ContactsSection({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const data = await readContactsData(organizationId);

  return (
    <ContactsWorkspace
      organizationId={organizationId}
      organizationName={organizationName}
      initialClients={data.clients}
      initialEmployees={data.employees}
      initialSuppliers={data.suppliers}
    />
  );
}
