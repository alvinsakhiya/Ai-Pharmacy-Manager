import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  listCatalogueProducts,
  type CatalogueProduct,
} from "./catalogueApi";

interface CatalogueProductSelectProps {
  selectedProduct: CatalogueProduct | null;
  onSelect: (product: CatalogueProduct) => void;
}

function productMetadata(product: CatalogueProduct): string {
  const parts = [
    product.dose_form,
    product.strength,
    product.pack_size === null
      ? ""
      : `pack ${product.pack_size}${product.pack_unit ? ` ${product.pack_unit}` : ""}`,
    product.manufacturer,
  ];
  return parts.filter(Boolean).join(" | ");
}

export function CatalogueProductSelect({
  selectedProduct,
  onSelect,
}: CatalogueProductSelectProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  const productsQuery = useQuery({
    queryKey: ["catalogue-products", debouncedSearch],
    queryFn: () => listCatalogueProducts(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const products = useMemo(
    () => productsQuery.data ?? [],
    [productsQuery.data],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearch]);

  function chooseProduct(product: CatalogueProduct) {
    onSelect(product);
    setSearch(product.full_label);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (products.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, products.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      chooseProduct(products[activeIndex]);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        Catalogue product
        <input
          aria-autocomplete="list"
          aria-controls="catalogue-product-results"
          aria-expanded={products.length > 0}
          aria-label="Catalogue product"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search medicines, strengths, forms, or packs"
          role="combobox"
          type="search"
          value={search}
        />
      </label>

      <div className="mt-2 min-h-10">
        {productsQuery.isLoading ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Searching catalogue...
          </p>
        ) : null}

        {productsQuery.isError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Could not search the catalogue. Please retry.
          </p>
        ) : null}

        {productsQuery.isSuccess && products.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No catalogue products found.
          </p>
        ) : null}

        {products.length > 0 ? (
          <ul
            className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm"
            id="catalogue-product-results"
            role="listbox"
          >
            {products.map((product, index) => (
              <li key={product.id} role="presentation">
                <button
                  aria-selected={selectedProduct?.id === product.id}
                  className={[
                    "block w-full px-3 py-3 text-left text-sm transition",
                    index === activeIndex
                      ? "bg-teal-50 text-slate-950"
                      : "text-slate-800 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => chooseProduct(product)}
                  role="option"
                  type="button"
                >
                  <span className="block font-semibold">{product.full_label}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {productMetadata(product)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
