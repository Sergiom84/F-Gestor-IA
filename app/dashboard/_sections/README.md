# Dashboard sections

Each sidebar area lives in its own folder:

- `dashboard`: Dashboard and its tabs (`Contabilidad`, `Gestoría`, `Ventas y compras`).
- `sales`: Ventas and its internal sales document views.
- `purchases`: Compras and purchase invoice intake/review views.
- `contacts`: Contactos and contact detail tabs.
- `products`: Productos y servicios and pricing/discount subviews.
- `accounting`: Contabilidad and its accounting subviews.
- `banks`, `tax`, `reports`, `settings`: module folders reserved for dedicated implementations.
- `shared`: fallback/reference module surfaces shared by sections that are not yet fully connected.

Route-level orchestration belongs in `section-registry.tsx`. Shared dashboard chrome belongs in `../_components`, and Supabase reads belong in `../_data`.
