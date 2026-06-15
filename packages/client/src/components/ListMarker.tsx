import React from 'react';

interface ListMarkerProps {
  ordered: boolean;
  index?: number | null;
  checked?: boolean;
}

export const ListMarker: React.FC<ListMarkerProps> = ({ ordered, index, checked }) => {
  if (checked !== undefined) {
    return (
      <span className="flex items-center justify-center w-4 h-4 mt-[3px] shrink-0">
        <input type="checkbox" checked={checked} readOnly className="w-3.5 h-3.5 accent-primary cursor-default" />
      </span>
    );
  }
  if (ordered) {
    return (
      <span className="tabular-nums text-muted-foreground text-[15px] shrink-0 min-w-[1.5rem] text-right">
        {index != null ? `${index}.` : '•'}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground shrink-0 mt-[3px]">•</span>
  );
};
