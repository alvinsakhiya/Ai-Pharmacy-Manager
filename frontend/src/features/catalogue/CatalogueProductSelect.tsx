import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { Search } from "lucide-react";

import { inputClass, labelClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import {
  listCatalogueProducts,
  type CatalogueProduct,
} from "./catalogueApi";

interface CatalogueProductSelectProps {
  selectedProduct: CatalogueProduct | null;
  onSelect: (product: CatalogueProduct) => void;
  label?: string;
  placeholder?: string;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
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
  label = "Catalogue product",
  placeholder = "Search medicines, strengths, forms, or packs",
  loadingText = "Searching catalogue...",
  errorText = "Could not search the catalogue. Please retry.",
  emptyText = "No catalogue products found.",
}: CatalogueProductSelectProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

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
  const hasSearchTerm = debouncedSearch.length >= 2;
  const isResultsOpen = isOpen && hasSearchTerm;

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearch]);

  function chooseProduct(product: CatalogueProduct) {
    onSelect(product);
    setSearch(product.full_label);
    setIsOpen(false);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setIsOpen(value.trim().length >= 2);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (products.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isResultsOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((current) => Math.min(current + 1, products.length - 1));
      }
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isResultsOpen) {
        setIsOpen(true);
        setActiveIndex(products.length - 1);
      } else {
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
    }
    if (event.key === "Enter") {
      if (!isResultsOpen) {
        return;
      }
      event.preventDefault();
      // The list can shrink under a stale activeIndex when a refetch returns
      // fewer rows; never dereference past the end.
      const product = products[activeIndex];
      if (product) {
        chooseProduct(product);
      }
    }
  }

  return (
    <div>
      <label className={labelClass}>
        {label}
        <span className="relative mt-1.5 block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            aria-autocomplete="list"
            aria-controls="catalogue-product-results"
            aria-expanded={isResultsOpen}
            aria-label={label}
            className={cn(inputClass, "mt-0 pl-9")}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => setIsOpen(search.trim().length >= 2)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            type="search"
            value={search}
          />
        </span>
      </label>

      <div className="mt-2 min-h-10">
        {isResultsOpen && productsQuery.isLoading ? (
          <p className="rounded-xl border border-line bg-surface-subtle p-3 text-sm text-muted">
            {loadingText}
          </p>
        ) : null}

        {isResultsOpen && productsQuery.isError ? (
          <p className="rounded-xl border border-danger-border bg-danger-soft p-3 text-sm text-danger-ink">
            {errorText}
          </p>
        ) : null}

        {isResultsOpen && productsQuery.isSuccess && products.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface-subtle p-3 text-sm text-muted">
            {emptyText}
          </p>
        ) : null}

        {isResultsOpen && products.length > 0 ? (
          <ul
            className="max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface shadow-elev-2"
            id="catalogue-product-results"
            role="listbox"
          >
            {products.map((product, index) => (
              <li key={product.id} role="presentation">
                <button
                  aria-selected={selectedProduct?.id === product.id}
                  className={cn(
                    "block w-full px-3 py-3 text-left text-sm transition-colors duration-150 ease-soft",
                    index === activeIndex
                      ? "bg-brand-soft text-brand-ink"
                      : "text-ink-soft hover:bg-surface-subtle",
                  )}
                  onClick={() => chooseProduct(product)}
                  role="option"
                  type="button"
                >
                  <span className="block font-semibold">{product.full_label}</span>
                  <span className="mt-1 block text-xs text-muted">
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
