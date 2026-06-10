import { readProductsData } from "../../_data/commercial-data";
import { ProductsWorkspace } from "./products-workspace";

export async function ProductsSection({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const data = await readProductsData(organizationId);

  return (
    <ProductsWorkspace
      organizationId={organizationId}
      organizationName={organizationName}
      initialProducts={data.products}
      initialPriceLists={data.priceLists}
      initialDiscountGroups={data.discountGroups}
    />
  );
}
