import { Combobox } from "@base-ui/react/combobox";
import { ChevronsUpDown } from "lucide-react";

import { Input } from "./input";

type Country = { code: string; name: string };

function CountryCombobox({
  id,
  countries,
  value,
  onValueChange,
}: {
  id: string;
  countries: readonly Country[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const selectedCountry = countries.find((country) => country.code === value) ?? null;

  return (
    <Combobox.Root
      items={countries}
      value={selectedCountry}
      onValueChange={(country) => onValueChange(country?.code ?? "")}
      itemToStringLabel={(country) => country.name}
      itemToStringValue={(country) => country.code}
      filter={(country, query) =>
        `${country.name} ${country.code}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          placeholder="Search countries"
          render={<Input className="pr-10" />}
        />
        <Combobox.Trigger
          type="button"
          aria-label="Show country options"
          className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ChevronsUpDown aria-hidden="true" className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner className="z-50 w-[var(--anchor-width)] outline-none">
          <Combobox.Popup className="rounded-md border bg-card text-card-foreground shadow-md">
            <Combobox.List className="max-h-64 overflow-y-auto p-1">
              {(country: Country) => (
                <Combobox.Item
                  key={country.code}
                  value={country}
                  className="flex cursor-default items-center justify-between rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[selected]:font-medium"
                >
                  <span>{country.name}</span>
                  <span className="ml-4 text-xs text-muted-foreground">{country.code}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No countries found.
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export { CountryCombobox };
