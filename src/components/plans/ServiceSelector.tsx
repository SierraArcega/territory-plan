"use client";

import type { Service } from "@/lib/api";

interface ServiceSelectorProps {
  services: Service[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

export default function ServiceSelector({
  services,
  selectedIds,
  onChange,
  disabled = false,
}: ServiceSelectorProps) {
  const toggleService = (serviceId: number) => {
    if (disabled) return;

    if (selectedIds.includes(serviceId)) {
      onChange(selectedIds.filter((id) => id !== serviceId));
    } else {
      onChange([...selectedIds, serviceId]);
    }
  };

  return (
    <div className="space-y-2">
      {services.map((service) => {
        const isSelected = selectedIds.includes(service.id);
        return (
          <label
            key={service.id}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : isSelected
                ? "bg-gray-50"
                : "hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleService(service.id)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
            />
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: service.color }}
            />
            <span className="text-sm text-gray-700">{service.name}</span>
          </label>
        );
      })}
    </div>
  );
}
