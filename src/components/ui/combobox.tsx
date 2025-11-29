"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    items: { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    noItemsMessage: string;
}

export function Combobox({ items, value, onChange, placeholder, searchPlaceholder, noItemsMessage }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [internalItems, setInternalItems] = React.useState(items);
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    setInternalItems(items);
  }, [items]);

  const handleSelect = (currentValue: string) => {
    onChange(currentValue === value ? "" : currentValue)
    setOpen(false)
  }

  const handleInputChange = (search: string) => {
    setInputValue(search);
    if (search && !internalItems.some(item => item.value.toLowerCase() === search.toLowerCase())) {
      const newItem = { label: `הוסף "${search}"`, value: search };
      const filteredItems = items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));
      setInternalItems([newItem, ...filteredItems]);
    } else {
        const filteredItems = items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()));
        setInternalItems(filteredItems);
    }
  }
  
  const handleInputBlur = () => {
    // If the input value doesn't match any existing item, add it.
    if (inputValue && !items.some(item => item.value.toLowerCase() === inputValue.toLowerCase())) {
        onChange(inputValue);
    }
    setInputValue("");
  }


  return (
    <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            setInternalItems(items); // Reset items on close
        }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? items.find((item) => item.value === value)?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder} 
            onValueChange={handleInputChange}
            onBlur={handleInputBlur}
          />
          <CommandList>
            <CommandEmpty>{noItemsMessage}</CommandEmpty>
            <CommandGroup>
              {internalItems.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
